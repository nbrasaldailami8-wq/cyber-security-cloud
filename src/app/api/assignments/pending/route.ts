import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { withErrorHandler } from "@/lib/errors";

const ACCESS_SECRET = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!);

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(async function GET(request: NextRequest) {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;
    if (!accessToken) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 401 },
      );
    }

    const { payload } = await jwtVerify(accessToken, ACCESS_SECRET);
    const userId = payload.sub as string;
    const userRole = payload.role as string;
    const userLevel = payload.level as string | undefined;

    if (userRole !== "TEACHER" && userRole !== "ADMIN" && userRole !== "MANAGEMENT") {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20")));
    const subjectId = searchParams.get("subjectId");
    const level = searchParams.get("level");

    const where: any = {
      status: "pending",
      deletedAt: null,
    };

    if (userRole === "TEACHER") {
      const teachingSubjectIds = await prisma.subject.findMany({
        where: { teacherId: userId, deletedAt: null },
        select: { id: true },
      });
      const ids = teachingSubjectIds.map((s) => s.id);
      if (ids.length === 0) {
        return NextResponse.json({
          success: true,
          data: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
        });
      }
      where.subjectId = { in: ids };
    }

    if (subjectId) {
      where.subjectId = subjectId;
    }

    if (level) {
      where.subject = { level };
    }

    if (userRole === "ADMIN" || userRole === "MANAGEMENT") {
      if (level) {
        where.subject = { level };
      } else if (userLevel) {
        where.subject = { level: userLevel };
      }
    }

    const [data, total] = await Promise.all([
      prisma.assignment.findMany({
        where,
        include: {
          student: {
            select: { id: true, name: true, email: true },
          },
          subject: {
            select: { id: true, name: true, code: true, level: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.assignment.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  });
