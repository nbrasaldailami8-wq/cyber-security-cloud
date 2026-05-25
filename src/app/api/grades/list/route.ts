import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAccessToken } from "@/lib/auth";
import { GradeService } from "@/services/academic/GradeService";
import { withErrorHandler } from "@/lib/errors";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(async (request: NextRequest) => {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("accessToken")?.value;
  if (!accessToken) {
    return NextResponse.json(
      { success: false, message: "غير مصرح" },
      { status: 401 },
    );
  }

  const payload = await verifyAccessToken(accessToken);
  if (!payload) {
    return NextResponse.json(
      { success: false, message: "غير مصرح" },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const semester = searchParams.get("semester") || undefined;

  const result = await GradeService.listGrades(payload.sub, {
    page,
    limit,
    semester,
  });

  return NextResponse.json({ success: true, ...result });
});

export const DELETE = withErrorHandler(async (request: NextRequest) => {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("accessToken")?.value;
  if (!accessToken) {
    return NextResponse.json(
      { success: false, message: "غير مصرح" },
      { status: 401 },
    );
  }

  const payload = await verifyAccessToken(accessToken);
  if (!payload) {
    return NextResponse.json(
      { success: false, message: "غير مصرح" },
      { status: 401 },
    );
  }

  const { id } = await request.json();
  if (!id) {
    return NextResponse.json(
      { success: false, message: "المعرف مطلوب" },
      { status: 400 },
    );
  }

  await GradeService.deleteGradeDistribution(payload.sub, id);

  return NextResponse.json({ success: true, message: "تم الحذف" });
});
