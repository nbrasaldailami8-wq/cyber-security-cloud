import { prisma } from "@/lib/prisma";
import { getEffectiveRole } from "@/lib/auth";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";

export class AdminService {
  static async getUsers(
    userId: string,
    filters?: {
      level?: string;
      role?: string;
      status?: string;
      search?: string;
      email?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const effective = await getEffectiveRole(userId);
    if (effective.role !== "ADMIN" && effective.role !== "MANAGEMENT") {
      throw new ForbiddenError("غير مصرح");
    }

    const userLevel = effective.level as string;
    const page = Math.max(1, filters?.page || 1);
    const limit = Math.min(1000, Math.max(1, filters?.limit || 20));

    const where: any = { deletedAt: null };

    if (effective.role === "MANAGEMENT" && userLevel) {
      where.level = userLevel;
    } else if (filters?.level) {
      where.level = filters.level;
    }

    if (filters?.role) where.role = filters.role;
    if (filters?.status) where.status = filters.status;

    if (filters?.search?.trim()) {
      where.name = { contains: filters.search.trim(), mode: "insensitive" };
    }

    if (filters?.email?.trim()) {
      where.email = { contains: filters.email.trim(), mode: "insensitive" };
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          level: true,
          status: true,
          isActivated: true,
          createdAt: true,
          managementLevel: true,
          lastLoginAt: true,
          uploadPermissions: {
            where: { revokedAt: null },
            select: { id: true, grantedBy: true, grantedAt: true },
            orderBy: { grantedAt: "desc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return { data: users, total, page, limit };
  }

  static async getAuditLogs(
    userId: string,
    query?: { page?: number; limit?: number },
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: { role: true, level: true, managementLevel: true },
    });

    if (!user) throw new NotFoundError("المستخدم");

    const effectiveRole = user.managementLevel ? "MANAGEMENT" : user.role;
    if (effectiveRole !== "ADMIN" && effectiveRole !== "MANAGEMENT") {
      throw new ForbiddenError("غير مصرح");
    }

    const page = Math.max(1, query?.page || 1);
    const limit = Math.min(100, Math.max(1, query?.limit || 20));

    const where: any = {};
    if (effectiveRole === "MANAGEMENT" && user.managementLevel) {
      where.level = user.managementLevel;
    } else if (effectiveRole === "MANAGEMENT" && user.level) {
      where.level = user.level;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { name: true, role: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { data: logs, total, page, limit };
  }

  static async deleteServerUsage(userId: string, fileId: string) {
    const effective = await getEffectiveRole(userId);
    if (effective.role !== "ADMIN" && effective.role !== "MANAGEMENT") {
      throw new ForbiddenError("غير مصرح");
    }

    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY || "";
    const auth = Buffer.from(`${privateKey}:`).toString("base64");

    const res = await fetch(`https://api.imagekit.io/v1/files/${fileId}`, {
      method: "DELETE",
      headers: { Authorization: `Basic ${auth}` },
    });

    if (!res.ok) {
      throw new ValidationError("فشل حذف الملف");
    }
  }

  static async getServerFiles(userId: string, path: string) {
    const effective = await getEffectiveRole(userId);
    if (effective.role !== "ADMIN" && effective.role !== "MANAGEMENT") {
      throw new ForbiddenError("غير مصرح");
    }

    if (!path) throw new ValidationError("المسار مطلوب");

    const IMAGEKIT_URL = "https://api.imagekit.io/v1";
    const IMAGEKIT_KEY = Buffer.from(`${process.env.IMAGEKIT_PRIVATE_KEY}:`).toString("base64");

    const res = await fetch(
      `${IMAGEKIT_URL}/files?path=${encodeURIComponent(path)}&limit=100`,
      { headers: { Authorization: `Basic ${IMAGEKIT_KEY}` } },
    );
    const files = await res.json();

    const data = (Array.isArray(files) ? files : []).map((f: any) => ({
      fileId: f.fileId,
      name: f.name,
      url: f.url,
      size: f.size,
      updatedAt: f.updatedAt,
    }));

    return data;
  }

  static async getServerFolderUsage(userId: string) {
    const effective = await getEffectiveRole(userId);
    if (effective.role !== "ADMIN" && effective.role !== "MANAGEMENT") {
      throw new ForbiddenError("غير مصرح");
    }

    const imagekit = await import("@/lib/imagekit").then((m) => m.imagekit);
    const effectiveLevel = effective.role === "ADMIN" ? null : effective.level;

    const allFiles = await imagekit.listFiles({ limit: 500 });

    const result: Record<string, any> = {};

    for (const file of allFiles) {
      const filePath = (file as any).filePath || (file as any).path || "/";
      const pathParts = filePath.split("/").filter((p: string) => p);

      let level = "غير مصنف";
      const codeEditorMatch = filePath.match(/\/code-editor\/(LEVEL_\d)\//);
      if (codeEditorMatch) {
        level = codeEditorMatch[1];
      } else {
        for (const part of pathParts) {
          if (part.match(/level-\d/i)) {
            level = part.toUpperCase().replace("-", "_");
            break;
          }
          if (part.match(/level-LEVEL_\d/i)) {
            level = part.replace("level-", "").toUpperCase();
            break;
          }
        }
      }

      let subFolder = "ملفات أخرى";
      if (filePath.includes("/library/")) {
        const parts = filePath.split("/library/");
        subFolder = parts.length > 1 ? "📚 " + (parts[1].split("/")[0] || "مكتبة") : "📚 المكتبة التعليمية";
      } else if (filePath.includes("/assignments/")) {
        const parts = filePath.split("/assignments/");
        subFolder = parts.length > 1 ? "📤 " + (parts[1].split("/")[0] || "تكاليف") : "📤 التكاليف";
      } else if (filePath.includes("/grades/")) {
        const parts = filePath.split("/grades/");
        subFolder = parts.length > 1 ? "📊 " + (parts[1].split("/")[0] || "درجات") : "📊 توزيع الدرجات";
      } else if (filePath.includes("/code-editor/")) {
        const parts = filePath.split("/code-editor/");
        subFolder = parts.length > 1 ? "💻 " + (parts[1].split("/")[0] || "محرر أكواد") : "💻 محرر الأكواد";
      }

      const isCodeEditor = filePath.includes("/code-editor/");
      if (!isCodeEditor && effectiveLevel && level !== effectiveLevel && level !== "غير مصنف") continue;

      if (!result[level]) result[level] = {};
      if (!result[level][subFolder]) result[level][subFolder] = { files: [], totalFiles: 0 };

      let uploadedBy = "غير معروف";
      for (const part of pathParts) {
        if (part.match(/^[a-f0-9-]{36}$/i)) break;
      }
      if (filePath.includes("/library/")) uploadedBy = "مستخدم";
      else if (filePath.includes("/assignments/")) uploadedBy = "طالب";
      else if (filePath.includes("/grades/")) uploadedBy = "معلم";

      const f = file as any;
      result[level][subFolder].files.push({
        fileId: f.fileId,
        name: f.name,
        url: f.url,
        size: f.size || 0,
        updatedAt: f.updatedAt || f.createdAt,
        path: filePath,
        uploadedBy,
        targetUser: "غير معروف",
      });
      result[level][subFolder].totalFiles++;
    }

    return result;
  }
}
