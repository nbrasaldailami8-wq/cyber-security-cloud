import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/auth";
import { ForbiddenError, UnauthorizedError, ValidationError } from "@/lib/errors";
import { deriveStaticChannelName } from "@/lib/realtimeChannels";

export class SecurityService {
  static async getSecurityLogs(
    userId: string,
    role: string,
    query?: {
      page?: number;
      limit?: number;
      type?: string;
      severity?: string;
      search?: string;
      from?: string;
      to?: string;
    },
  ) {
    if (role !== "ADMIN") throw new ForbiddenError("غير مصرح - للأدمن فقط");

    const page = Math.max(1, query?.page || 1);
    const limit = Math.min(100, Math.max(1, query?.limit || 20));
    const type = query?.type || "all";
    const severity = query?.severity || "all";
    const search = query?.search || "";
    const from = query?.from || "";
    const to = query?.to || "";

    const where: any = {};

    if (type !== "all") {
      switch (type) {
        case "intrusion":
          where.action = "SUSPICIOUS_ACTIVITY";
          break;
        case "vulnerability":
          where.severity = "CRITICAL";
          break;
        case "attack":
          where.OR = [{ action: "FAILED_LOGIN" }, { action: "SUSPICIOUS_ACTIVITY" }];
          break;
        case "ban":
          where.description = { contains: "حظر" };
          break;
        case "error":
          where.severity = { in: ["ERROR", "CRITICAL"] };
          break;
      }
    }

    if (severity !== "all") {
      where.severity = severity;
    }

    if (search) {
      where.AND = [
        {
          OR: [
            { description: { contains: search, mode: "insensitive" } },
            { ipAddress: { contains: search, mode: "insensitive" } },
          ],
        },
      ];
    }

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          action: true,
          severity: true,
          description: true,
          ipAddress: true,
          deviceInfo: true,
          level: true,
          metadata: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      }),
    ]);

    return {
      data: logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  static async createSecurityLog(
    userId: string,
    role: string,
    data: {
      action: string;
      severity?: string;
      description: string;
      ipAddress?: string;
      deviceInfo?: string;
      level?: string;
      metadata?: any;
    },
  ) {
    if (role !== "ADMIN") throw new ForbiddenError("غير مصرح - للأدمن فقط");

    const { action, severity, description, ipAddress, deviceInfo, level, metadata } = data;

    if (!action || !description) {
      throw new ValidationError("الحقول المطلوبة مفقودة");
    }

    const log = await prisma.auditLog.create({
      data: {
        userId,
        action: action as any,
        severity: (severity as any) || "WARNING",
        description,
        ipAddress: ipAddress || "",
        deviceInfo: deviceInfo || "",
        level: level ? (level as any) : undefined,
        metadata: metadata || undefined,
      },
    });

    try {
      const { broadcastEvent } = await import("@/lib/supabaseRealtime");
      await broadcastEvent(deriveStaticChannelName("security-terminal"), "new-log", {
        id: log.id,
        action: log.action,
        severity: log.severity,
        description: log.description,
        ipAddress: log.ipAddress,
        deviceInfo: log.deviceInfo,
        createdAt: log.createdAt.toISOString(),
      });
      await broadcastEvent(deriveStaticChannelName("security-radar"), "stats-update", {
        timestamp: new Date().toISOString(),
      });
    } catch {
      /* صامت */
    }

    return log;
  }

  static async getSecurityStats(userId: string, role: string) {
    if (role !== "ADMIN") throw new ForbiddenError("غير مصرح - للأدمن فقط");

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalErrors,
      totalWarnings,
      totalIntrusions,
      totalVulnerabilities,
      totalAttackAttempts,
      totalBans,
      recentIntrusions,
      criticalLogs,
      attacksLast24h,
      attacksLast7d,
    ] = await Promise.all([
      prisma.auditLog.count({ where: { severity: { in: ["ERROR", "CRITICAL"] } } }),
      prisma.auditLog.count({ where: { severity: "WARNING" } }),
      prisma.auditLog.count({ where: { OR: [{ action: "SUSPICIOUS_ACTIVITY" }, { action: "FAILED_LOGIN" }] } }),
      prisma.auditLog.count({ where: { severity: "CRITICAL" } }),
      prisma.auditLog.count({ where: { OR: [{ action: "FAILED_LOGIN" }, { action: "SUSPICIOUS_ACTIVITY" }] } }),
      prisma.auditLog.count({ where: { description: { contains: "حظر" }, createdAt: { gte: last7d } } }),
      prisma.auditLog.findMany({
        where: { OR: [{ action: "SUSPICIOUS_ACTIVITY" }, { action: "FAILED_LOGIN" }] },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true, action: true, severity: true, description: true, ipAddress: true,
          deviceInfo: true, createdAt: true,
          user: { select: { name: true, email: true } },
        },
      }),
      prisma.auditLog.findMany({
        where: { severity: "CRITICAL" },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true, action: true, severity: true, description: true, ipAddress: true,
          deviceInfo: true, createdAt: true,
          user: { select: { name: true, email: true } },
        },
      }),
      prisma.auditLog.count({
        where: {
          OR: [{ action: "FAILED_LOGIN" }, { action: "SUSPICIOUS_ACTIVITY" }, { severity: "CRITICAL" }],
          createdAt: { gte: last24h },
        },
      }),
      prisma.auditLog.count({
        where: {
          OR: [{ action: "FAILED_LOGIN" }, { action: "SUSPICIOUS_ACTIVITY" }, { severity: "CRITICAL" }],
          createdAt: { gte: last7d },
        },
      }),
    ]);

    return {
      stats: {
        errors: totalErrors,
        warnings: totalWarnings,
        intrusions: totalIntrusions,
        vulnerabilities: totalVulnerabilities,
        attackAttempts: totalAttackAttempts,
        bans: totalBans,
      },
      trends: { attacksLast24h, attacksLast7d },
      recentIntrusions,
      criticalLogs,
    };
  }
}
