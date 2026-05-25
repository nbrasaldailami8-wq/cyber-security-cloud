import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { broadcastEvent } from "@/lib/supabaseRealtime";
import { deriveStaticChannelName } from "@/lib/realtimeChannels";
import { withErrorHandler } from "@/lib/errors";

const ACCESS_SECRET = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!);

export const dynamic = "force-dynamic";

// ==================== GET: جلب المحتوى ====================
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
    const userRole = payload.role as string;
    const userLevel = payload.level as string | undefined;

    const { searchParams } = new URL(request.url);
    const level = searchParams.get("level") || userLevel;
    const type = searchParams.get("type");
    const subjectId = searchParams.get("subjectId");
    const search = searchParams.get("search");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || String(20))),
    );

    const where: any = { deletedAt: null };

    // عزل أكاديمي
    if (userRole === "ADMIN") {
      if (level) {
        where.level = level;
      }
    } else {
      where.level = userLevel;
    }

    if (type) where.type = type;
    if (subjectId) where.subjectId = subjectId;
    if (search && search.trim()) {
      where.OR = [
        { title: { contains: search.trim(), mode: "insensitive" } },
        { description: { contains: search.trim(), mode: "insensitive" } },
      ];
    }

    const [content, total] = await Promise.all([
      prisma.content.findMany({
        where,
        include: {
          publisher: { select: { id: true, name: true, role: true } },
          subject: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.content.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: content,
      total,
      page,
      limit,
    });
  });

// ==================== PATCH: تعديل محتوى ====================
export const PATCH = withErrorHandler(async function PATCH(request: NextRequest) {
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

    const body = await request.json();
    const { id, title, description, subjectId } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, message: "معرف المحتوى مطلوب" },
        { status: 400 },
      );
    }

    // البحث عن المحتوى
    const existing = await prisma.content.findUnique({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "المحتوى غير موجود" },
        { status: 404 },
      );
    }

    // التحقق من الصلاحية: صاحب المنشور أو الأدمن فقط
    if (existing.publisherId !== userId && userRole !== "ADMIN") {
      return NextResponse.json(
        { success: false, message: "غير مصرح بتعديل هذا المحتوى" },
        { status: 403 },
      );
    }

    const updated = await prisma.content.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(description !== undefined && {
          description: description?.trim() || null,
        }),
        ...(subjectId !== undefined && { subjectId: subjectId || null }),
        version: { increment: 1 },
      },
      include: {
        publisher: { select: { id: true, name: true, role: true } },
        subject: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      success: true,
      message: "تم تعديل المحتوى بنجاح",
      data: updated,
    });
  });

// ==================== DELETE: حذف محتوى (Soft Delete) ====================
export const DELETE = withErrorHandler(async function DELETE(request: NextRequest) {
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
    const userLevel = payload.level as string;

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, message: "معرف المحتوى مطلوب" },
        { status: 400 },
      );
    }

    const existing = await prisma.content.findUnique({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "المحتوى غير موجود" },
        { status: 404 },
      );
    }

    // التحقق من الصلاحية
    if (existing.publisherId !== userId && userRole !== "ADMIN") {
      return NextResponse.json(
        { success: false, message: "غير مصرح بحذف هذا المحتوى" },
        { status: 403 },
      );
    }

    // Soft Delete
    await prisma.content.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // إشعار Supabase Broadcast
    try {
      broadcastEvent(
        deriveStaticChannelName(`library-level-${userLevel}`),
        "content-deleted",
        {
          id,
        },
      );
    } catch {
      // صامت
    }

    return NextResponse.json({
      success: true,
      message: "تم حذف المحتوى بنجاح",
    });
  });
