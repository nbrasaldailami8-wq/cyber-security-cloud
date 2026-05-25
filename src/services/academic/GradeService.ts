import { prisma } from "@/lib/prisma";
import { getEffectiveRole } from "@/lib/auth";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { imagekit } from "@/lib/imagekit";
import { APP_CONFIG } from "@/config";
import { scanAndReject } from "@/lib/clamav";
import * as XLSX from "xlsx";
import { broadcastEvent } from "@/lib/supabaseRealtime";
import { deriveStaticChannelName, getUserChannelName } from "@/lib/realtimeChannels";

function extractTextFromExcel(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  let text = "";
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    text += csv + "\n";
  }
  return text;
}

async function extractTextFromFile(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<string> {
  const isExcel =
    fileName.endsWith(".xlsx") ||
    fileName.endsWith(".xls") ||
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel");
  if (isExcel) return extractTextFromExcel(buffer);

  if (mimeType === "application/pdf" || fileName.endsWith(".pdf")) {
    try {
      const pdfParse = await import("pdf-parse");
      const parseFn = (pdfParse as any).default || pdfParse;
      const data = await parseFn(buffer);
      const text = data.text || "";
      if (text.length < 100 || text.includes("obj") || text.includes("endstream")) {
        throw new Error("Invalid PDF text");
      }
      return text;
    } catch {
      return "";
    }
  }

  if (mimeType.startsWith("image/")) {
    try {
      const Tesseract = (await import("tesseract.js")).default;
      const { data: { text } } = await Tesseract.recognize(buffer, "ara+eng", { logger: () => {} });
      return text || "";
    } catch {
      return "";
    }
  }

  if (mimeType === "text/plain" || mimeType === "text/csv" || fileName.endsWith(".csv") || fileName.endsWith(".txt")) {
    return buffer.toString("utf-8");
  }

  return buffer.toString("utf-8");
}

function parseExtractedText(text: string): { name: string; grade: string; feedback: string }[] {
  const lines = text.split(/[\n\r]+/).filter((l) => l.trim());
  const results: { name: string; grade: string; feedback: string }[] = [];

  for (const line of lines) {
    if (line.length < 3) continue;
    if (line.includes("الاسم") || line.includes("الدرجة") || line.includes("Name") || line.includes("الرقم")) continue;

    const parts = line
      .split(/[,;\t|]+/)
      .map((p) => p.trim().replace(/^"(.*)"$/, "$1"))
      .filter((p) => p);

    if (parts.length >= 2) {
      let name = "";
      let grade = "";
      let feedback = "";

      for (const part of parts) {
        const num = parseFloat(part);
        if (!isNaN(num) && num >= 0 && num <= 100) {
          grade = String(num);
        } else if (/[\u0600-\u06FF]/.test(part) && part.length > name.length) {
          name = part;
        } else if (part.length > 2 && !/^\d+$/.test(part)) {
          if (!name) name = part;
          else feedback += part + " ";
        } else if (/^\d{1,3}$/.test(part) && !grade) {
          grade = part;
        } else {
          feedback += part + " ";
        }
      }

      if (name && grade) {
        results.push({ name: name.trim(), grade: grade.trim(), feedback: feedback.trim() });
      }
    }
  }

  return results;
}

function normalizeArabicName(name: string): string {
  return name
    .replace(/[اأإآ]/g, "ا")
    .replace(/[ىيئ]/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ؤو]/g, "و")
    .replace(/\s+/g, " ")
    .trim();
}

export class GradeService {
  static async canManageGrades(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: { role: true, managementLevel: true, name: true, level: true },
    });

    if (!user) throw new ForbiddenError("غير مصرح");

    const hasAccess =
      user.role === "TEACHER" ||
      user.role === "ADMIN" ||
      !!user.managementLevel;

    if (!hasAccess) throw new ForbiddenError("غير مصرح");
    return user;
  }

  static async publishGrades(
    userId: string,
    data: {
      distributionId?: string;
      students?: any[];
      publishType?: string;
      manualStudents?: any[];
      subjectId?: string;
    },
  ) {
    const user = await this.canManageGrades(userId);
    const { distributionId, students, publishType, manualStudents, subjectId } = data;

    let subjectName = "";
    let targetLevel = user.level || "";
    const studentNotifications: { id: string; grade: string; feedback: string }[] = [];

    if (manualStudents?.length) {
      const subject = subjectId
        ? await prisma.subject.findUnique({
            where: { id: subjectId },
            select: { name: true, level: true },
          })
        : null;
      subjectName = subject?.name || "المادة";
      if (subject?.level) targetLevel = subject.level;

      for (const s of manualStudents) {
        if (s.grade || s.feedback) {
          studentNotifications.push({ id: s.id, grade: s.grade || "—", feedback: s.feedback || "" });
          await prisma.assignment.create({
            data: {
              studentId: s.id,
              subjectId: subjectId || "",
              fileUrl: "",
              fileName: "نشر يدوي",
              fileSize: 0,
              grade: s.grade ? parseFloat(s.grade) || 0 : null,
              feedback: s.feedback || null,
              status: s.grade ? "evaluated" : "pending",
              evaluatedAt: s.grade ? new Date() : null,
              evaluatorId: userId,
              semester: "TERM_1",
            },
          });
        }
      }
    }

    if (distributionId && students?.length) {
      const distribution = await prisma.gradeDistribution.findUnique({
        where: { id: distributionId },
        include: { subject: { select: { name: true, code: true } } },
      });
      if (!distribution) throw new NotFoundError("التوزيع");
      subjectName = distribution.subject.name;
      targetLevel = distribution.level || targetLevel;

      await prisma.gradeDistribution.update({
        where: { id: distributionId },
        data: {
          distributionData: {
            students,
            publishedAt: new Date().toISOString(),
            publishedBy: user.name,
            publishType,
          },
          studentsCount: students.length,
        },
      });

      for (const s of students) {
        if (s.dbId && s.grade) {
          studentNotifications.push({ id: s.dbId, grade: s.grade, feedback: s.feedback || "" });
        }
      }
    }

    if (studentNotifications.length > 0) {
      const msgType = publishType || "التقييم";
      const notificationsData = studentNotifications.map((sn) => {
        let body = `قام معلم ${subjectName} برفع درجاتك في ${msgType}. درجتك: ${sn.grade}`;
        if (sn.feedback) body += ` - ملاحظة: ${sn.feedback}`;
        return {
          userId: sn.id,
          type: "GRADES_DISTRIBUTED" as const,
          title: "📊 توزيع درجات",
          body,
          linkUrl: "/student",
        };
      });

      if (notificationsData.length > 0) {
        await prisma.notification.createMany({ data: notificationsData });
      }

      broadcastEvent(deriveStaticChannelName(`level-${targetLevel}`), "grades-published", {
        type: "GRADES_DISTRIBUTED",
        title: "📊 توزيع درجات",
        body: `قام معلم ${subjectName} برفع درجات ${msgType} لـ ${studentNotifications.length} طالب`,
        linkUrl: "/student",
        level: targetLevel,
      });

      try {
        const { sendPushToUsers } = await import("@/lib/pushNotifications");
        await sendPushToUsers(
          studentNotifications.map((s) => s.id),
          {
            title: "📊 توزيع درجات",
            body: `قام معلم ${subjectName} برفع درجاتك في ${msgType}`,
            data: { url: "/student" },
            sound: "/sounds/notification.mp3",
          },
        );
      } catch {
        /* صامت */
      }
    }

    await prisma.auditLog.create({
      data: {
        userId,
        action: "PUBLISH",
        severity: "INFO",
        description: `نشر درجات ${subjectName} لـ ${studentNotifications.length} طالب`,
        level: targetLevel as any,
        metadata: { distributionId, studentsCount: studentNotifications.length, publishType },
      },
    });

    return { count: studentNotifications.length };
  }

  static async listGrades(userId: string, query: { page?: number; limit?: number; semester?: string }) {
    const user = await prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: { role: true, managementLevel: true, level: true },
    });

    if (!user) throw new NotFoundError("المستخدم");

    const isTeacher = user.role === "TEACHER";
    const isManagement = user.role === "MANAGEMENT" || !!user.managementLevel;
    const isAdmin = user.role === "ADMIN";
    const userRole = user.role;

    if (userRole !== "STUDENT" && !isTeacher && !isManagement && !isAdmin) {
      throw new ForbiddenError("غير مصرح");
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, Math.max(1, query.limit || 20));

    if (userRole === "STUDENT") {
      const semester = query.semester;
      const where: any = { studentId: userId, grade: { not: null }, deletedAt: null };
      if (semester) where.semester = semester;

      const [assignments, total] = await Promise.all([
        prisma.assignment.findMany({
          where,
          include: { subject: { select: { name: true } }, evaluator: { select: { name: true } } },
          orderBy: { evaluatedAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.assignment.count({ where }),
      ]);

      const data = assignments.map((a) => ({
        id: a.id,
        subjectName: a.subject.name,
        grade: a.grade,
        feedback: a.feedback,
        evaluatorName: a.evaluator?.name || null,
        evaluatedAt: a.evaluatedAt,
        semester: a.semester,
      }));

      return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    const whereDist: any = { deletedAt: null };
    if (isTeacher) whereDist.teacherId = userId;

    const [distributions, total] = await Promise.all([
      prisma.gradeDistribution.findMany({
        where: whereDist,
        select: {
          id: true,
          fileName: true,
          fileUrl: true,
          studentsCount: true,
          createdAt: true,
          distributionData: true,
          subject: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.gradeDistribution.count({ where: whereDist }),
    ]);

    const data = distributions.map((d) => ({
      id: d.id,
      subjectName: d.subject?.name || "—",
      fileName: d.fileName,
      fileUrl: d.fileUrl,
      studentsCount: d.studentsCount,
      createdAt: d.createdAt,
      distributionData: d.distributionData,
    }));

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  static async deleteGradeDistribution(userId: string, id: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user) throw new NotFoundError("المستخدم");

    const dist = await prisma.gradeDistribution.findUnique({ where: { id } });
    if (!dist) throw new NotFoundError("التوزيع");
    if (dist.teacherId !== userId && user.role !== "ADMIN") {
      throw new ForbiddenError("غير مصرح");
    }

    await prisma.gradeDistribution.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  static async analyzeGrades(
    userId: string,
    formData: { file: File; subjectId: string },
  ) {
    const user = await this.canManageGrades(userId);
    const userLevel = user.level || "LEVEL_1";

    const { file, subjectId } = formData;

    if (!file || !subjectId) {
      throw new ValidationError("الملف والمادة مطلوبان");
    }

    if (file.size > APP_CONFIG.maxFileSize) {
      throw new ValidationError("حجم الملف كبير جداً");
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const infected = await scanAndReject(buffer, file.name, userId);
    if (infected) throw new ValidationError("الملف مصاب بفيروس!");

    const uploadResponse = await imagekit.upload({
      file: buffer.toString("base64"),
      fileName: `${Date.now()}-${file.name}`,
      folder: `/level-${userLevel}/grades/${subjectId}`,
    });

    let extractedText = await extractTextFromFile(buffer, file.type, file.name);
    extractedText = extractedText
      .replace(/\u0000/g, "")
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "")
      .trim();

    const parsedStudents = parseExtractedText(extractedText);

    const dbStudents = await prisma.user.findMany({
      where: { role: "STUDENT", level: userLevel as any, status: "ACTIVE", deletedAt: null },
      select: { id: true, name: true },
    });

    const matched = parsedStudents.map((parsed) => {
      const normalizedParsed = normalizeArabicName(parsed.name);
      let bestMatch: (typeof dbStudents)[0] | null = null;
      let bestScore = 0;

      for (const db of dbStudents) {
        const normalizedDb = normalizeArabicName(db.name);
        if (normalizedDb === normalizedParsed) {
          bestMatch = db;
          bestScore = 100;
          break;
        }
        if (normalizedDb.includes(normalizedParsed) || normalizedParsed.includes(normalizedDb)) {
          const score = (Math.min(normalizedDb.length, normalizedParsed.length) / Math.max(normalizedDb.length, normalizedParsed.length)) * 100;
          if (score > bestScore) {
            bestMatch = db;
            bestScore = score;
          }
        }
      }

      return {
        dbId: bestMatch?.id || "",
        dbName: bestMatch?.name || "—",
        extractedName: parsed.name,
        grade: parsed.grade,
        feedback: parsed.feedback,
        matched: bestScore >= 60,
      };
    });

    const cleanData = JSON.parse(
      JSON.stringify({ extracted: parsedStudents, matched })
        .replace(/\u0000/g, "")
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ""),
    );

    const distribution = await prisma.gradeDistribution.create({
      data: {
        teacherId: userId,
        subjectId,
        fileUrl: uploadResponse.url,
        fileName: file.name,
        level: userLevel as any,
        studentsCount: matched.length,
        distributionData: cleanData,
      },
    });

    try {
      broadcastEvent(getUserChannelName(userId), "notification", {
        type: "ANALYSIS_COMPLETED",
        title: "✅ اكتمل التحليل",
        body: `تم استخراج ${parsedStudents.length} طالب من ${file.name}`,
        linkUrl: "/teacher/grades/analysis",
      });
    } catch {
      /* صامت */
    }

    try {
      const { sendPushNotification } = await import("@/lib/pushNotifications");
      await sendPushNotification(userId, "✅ اكتمل التحليل", `تم استخراج ${parsedStudents.length} طالب`, "/teacher/grades/analysis");
    } catch {
      /* صامت */
    }

    return {
      extracted: parsedStudents,
      matched,
      distributionId: distribution.id,
    };
  }
}
