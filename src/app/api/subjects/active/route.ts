import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { withErrorHandler } from "@/lib/errors";

const ACCESS_SECRET = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!);

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(async function GET(request: NextRequest) {
    // التحقق من التوثيق
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;
    if (!accessToken) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 401 },
      );
    }

    const { payload } = await jwtVerify(accessToken, ACCESS_SECRET);
    const userLevel = payload.level as string | undefined;

    const { searchParams } = new URL(request.url);
    const level = searchParams.get("level") || userLevel;
    const semester = searchParams.get("semester") || null;
    const teacherId = searchParams.get("teacherId");

    if (!level) {
      return NextResponse.json(
        { success: false, message: "المستوى الدراسي مطلوب" },
        { status: 400 },
      );
    }

    // عزل أكاديمي: الطالب/المعلم/الإدارة يرى فقط مواد مستواه (الأدمن يمكنه تحديد أي مستوى)
    const effectiveLevel = payload.role === "ADMIN" ? level : userLevel;
    if (!effectiveLevel) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 403 },
      );
    }

    const where: any = {
      level: effectiveLevel as any,
      isActive: true,
      isVisible: true,
      deletedAt: null,
    };

    if (semester) {
      where.semester = semester as any;
    }

    if (teacherId) {
      where.teacherId = teacherId;
    }

    const subjects = await prisma.subject.findMany({
      where,
      include: {
        teacher: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    });

    const data = subjects.map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      level: s.level,
      semester: s.semester,
      teacherName: s.teacher?.name || null,
    }));

    return NextResponse.json({ success: true, data });
  });
