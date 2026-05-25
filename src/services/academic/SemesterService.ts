import { prisma } from "@/lib/prisma";
import { getEffectiveRole } from "@/lib/auth";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { deriveStaticChannelName } from "@/lib/realtimeChannels";

const levelLabels: Record<string, string> = {
  LEVEL_1: "المستوى الأول",
  LEVEL_2: "المستوى الثاني",
  LEVEL_3: "المستوى الثالث",
  LEVEL_4: "المستوى الرابع",
};

const levelOrder: Record<string, string | null> = {
  LEVEL_1: "LEVEL_2",
  LEVEL_2: "LEVEL_3",
  LEVEL_3: "LEVEL_4",
  LEVEL_4: null,
};

export class SemesterService {
  static async toggleSemester(userId: string, subjectIds: string[], isVisible: boolean) {
    const effective = await getEffectiveRole(userId);
    if (effective.role !== "ADMIN" && effective.role !== "MANAGEMENT") {
      throw new ForbiddenError("غير مصرح");
    }

    if (!subjectIds || !Array.isArray(subjectIds) || subjectIds.length === 0) {
      throw new ValidationError("يرجى تحديد المواد");
    }

    if (effective.role !== "ADMIN") {
      const userLevel = effective.level;
      const subjects = await prisma.subject.findMany({
        where: { id: { in: subjectIds } },
        select: { level: true },
      });
      const allFromSameLevel = subjects.every((s) => s.level === userLevel);
      if (!allFromSameLevel || subjects.length !== subjectIds.length) {
        throw new ForbiddenError("لا يمكنك تعديل مواد من مستوى آخر");
      }
    }

    await prisma.subject.updateMany({
      where: { id: { in: subjectIds } },
      data: { isVisible },
    });

    const subjects = await prisma.subject.findMany({
      where: { id: { in: subjectIds } },
      select: { name: true, level: true, semester: true },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: "SEMESTER_SWITCH",
        severity: "INFO",
        description: `تم ${isVisible ? "إظهار" : "إخفاء"} ${subjectIds.length} مادة`,
        metadata: {
          subjects: subjects.map((s) => ({
            name: s.name,
            level: s.level,
            semester: s.semester,
          })),
          isVisible,
        },
      },
    });

    try {
      const { broadcastEvent } = await import("@/lib/supabaseRealtime");
      broadcastEvent(deriveStaticChannelName("semester"), "subjects-update", {
        timestamp: new Date().toISOString(),
        isVisible,
        count: subjectIds.length,
      });
    } catch {
      /* صامت */
    }

    return { count: subjectIds.length, isVisible };
  }

  static async promoteStudents(userId: string, level: string, studentIds: string[]) {
    const effective = await getEffectiveRole(userId);
    if (effective.role !== "ADMIN" && effective.role !== "MANAGEMENT") {
      throw new ForbiddenError("غير مصرح");
    }

    if (!level || !studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      throw new ValidationError("يرجى تحديد المستوى والطلاب");
    }

    const nextLevel = levelOrder[level];
    if (!nextLevel) {
      throw new ValidationError("لا يوجد مستوى أعلى للترقية");
    }

    const students = await prisma.user.findMany({
      where: { id: { in: studentIds }, role: "STUDENT", deletedAt: null },
      select: { id: true, name: true, level: true },
    });

    const invalidStudents = students.filter((s) => s.level !== level);
    if (invalidStudents.length > 0) {
      throw new ValidationError("بعض الطلاب ليسوا في المستوى المحدد");
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.updateMany({
        where: { id: { in: studentIds } },
        data: {
          level: nextLevel as any,
          previousLevel: level as any,
        },
      });

      await tx.assignment.deleteMany({
        where: { studentId: { in: studentIds } },
      });

      await tx.gradeDistribution.deleteMany({
        where: { level: level as any },
      });

      await tx.message.updateMany({
        where: {
          OR: [
            { senderId: { in: studentIds } },
            { receiverId: { in: studentIds } },
          ],
          deletedAt: null,
        },
        data: { deletedAt: new Date() },
      });

      for (const student of students) {
        await tx.auditLog.create({
          data: {
            userId: student.id,
            action: "PROMOTED",
            severity: "INFO",
            description: `تمت ترقية الطالب من ${levelLabels[level]} إلى ${levelLabels[nextLevel]}`,
            level: nextLevel as any,
            metadata: {
              fromLevel: level,
              toLevel: nextLevel,
              promotedBy: userId,
            },
          },
        });

        await tx.notification.create({
          data: {
            userId: student.id,
            type: "LEVEL_PROMOTED",
            title: "🎉 مبارك انتقالك!",
            body: `تمت ترقيتك إلى ${levelLabels[nextLevel]} في كلية الأمن السيبراني. نتمنى لك عالماً من النجاح والتفوق في عامك الدراسي الجديد. واصل الاجتهاد فأنت مستقبل هذا الوطن 🇾🇪`,
            linkUrl: "/student",
          },
        });
      }
    });

    try {
      const { sendPushToUsers } = await import("@/lib/pushNotifications");
      await sendPushToUsers(
        students.map((s) => s.id),
        {
          title: "🎉 مبارك انتقالك!",
          body: `تمت ترقيتك إلى ${levelLabels[nextLevel]} في كلية الأمن السيبراني.`,
          data: { url: "/student" },
          sound: "/sounds/alert.mp3",
          requireInteraction: true,
        },
      );
    } catch {
      /* صامت */
    }

    try {
      const { broadcastEvent } = await import("@/lib/supabaseRealtime");
      broadcastEvent(deriveStaticChannelName("semester"), "promotion-update", {
        timestamp: new Date().toISOString(),
        fromLevel: level,
        toLevel: nextLevel,
        count: students.length,
      });
      broadcastEvent(deriveStaticChannelName("semester"), "stats-update", {
        timestamp: new Date().toISOString(),
      });
    } catch {
      /* صامت */
    }

    return { count: students.length, fromLevel: level, toLevel: nextLevel };
  }

  static async getPromotePreview(userId: string) {
    const effective = await getEffectiveRole(userId);
    if (effective.role !== "ADMIN" && effective.role !== "MANAGEMENT") {
      throw new ForbiddenError("غير مصرح");
    }

    const effectiveRole = effective.role;
    const userLevel = effective.level || "LEVEL_1";

    const availableLevels =
      effectiveRole === "ADMIN"
        ? ["LEVEL_1", "LEVEL_2", "LEVEL_3", "LEVEL_4"]
        : [userLevel];

    const data = await Promise.all(
      availableLevels.map(async (lvl) => {
        const nextLevel = levelOrder[lvl];
        const students = await prisma.user.findMany({
          where: { level: lvl as any, role: "STUDENT", deletedAt: null },
          select: { id: true, name: true, email: true, level: true, createdAt: true },
          orderBy: { name: "asc" },
        });

        return {
          level: lvl,
          label: levelLabels[lvl] || lvl,
          totalStudents: students.length,
          students,
          nextLevel,
          nextLabel: nextLevel ? levelLabels[nextLevel] : null,
        };
      }),
    );

    return data;
  }

  static async getSubjects(userId: string) {
    const effective = await getEffectiveRole(userId);
    if (effective.role !== "ADMIN" && effective.role !== "MANAGEMENT") {
      throw new ForbiddenError("غير مصرح");
    }

    const effectiveRole = effective.role;
    const userLevel = effective.level;

    const availableLevels: string[] =
      effectiveRole === "ADMIN"
        ? ["LEVEL_1", "LEVEL_2", "LEVEL_3", "LEVEL_4"]
        : userLevel
          ? [userLevel]
          : [];

    const data = await Promise.all(
      availableLevels.map(async (lvl) => {
        const [term1Subjects, term2Subjects] = await Promise.all([
          prisma.subject.findMany({
            where: { level: lvl as any, semester: "TERM_1", deletedAt: null },
            select: {
              id: true,
              name: true,
              code: true,
              isVisible: true,
              teacher: { select: { name: true } },
            },
            orderBy: { name: "asc" },
          }),
          prisma.subject.findMany({
            where: { level: lvl as any, semester: "TERM_2", deletedAt: null },
            select: {
              id: true,
              name: true,
              code: true,
              isVisible: true,
              teacher: { select: { name: true } },
            },
            orderBy: { name: "asc" },
          }),
        ]);

        return {
          level: lvl,
          label: levelLabels[lvl] || lvl,
          term1Subjects,
          term2Subjects,
        };
      }),
    );

    return data;
  }

  static async getSemesterStats(userId: string) {
    const effective = await getEffectiveRole(userId);
    if (effective.role !== "ADMIN" && effective.role !== "MANAGEMENT") {
      throw new ForbiddenError("غير مصرح");
    }

    const effectiveRole = effective.role;
    const userLevel = effective.level;

    const availableLevels: string[] =
      effectiveRole === "ADMIN"
        ? ["LEVEL_1", "LEVEL_2", "LEVEL_3", "LEVEL_4"]
        : userLevel
          ? [userLevel]
          : [];

    const levelBreakdown = await Promise.all(
      availableLevels.map(async (lvl) => {
        const [term1Subjects, term2Subjects, totalStudents, lastPromotion] =
          await Promise.all([
            prisma.subject.count({
              where: { level: lvl as any, semester: "TERM_1", deletedAt: null },
            }),
            prisma.subject.count({
              where: { level: lvl as any, semester: "TERM_2", deletedAt: null },
            }),
            prisma.user.count({
              where: { level: lvl as any, role: "STUDENT", deletedAt: null },
            }),
            prisma.auditLog.findFirst({
              where: { action: "PROMOTED", level: lvl as any },
              orderBy: { createdAt: "desc" },
              select: { createdAt: true },
            }),
          ]);

        return {
          level: lvl,
          label: levelLabels[lvl] || lvl,
          term1Subjects,
          term2Subjects,
          totalStudents,
          lastPromotion: lastPromotion?.createdAt?.toISOString() || null,
        };
      }),
    );

    const totalSubjects = levelBreakdown.reduce(
      (sum, l) => sum + l.term1Subjects + l.term2Subjects,
      0,
    );

    return {
      totalLevels: availableLevels.length,
      totalSubjects,
      levelBreakdown,
    };
  }
}
