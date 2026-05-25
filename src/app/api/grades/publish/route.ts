import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAccessToken } from "@/lib/auth";
import { GradeService } from "@/services/academic/GradeService";
import { withErrorHandler } from "@/lib/errors";

export const POST = withErrorHandler(async (request: NextRequest) => {
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

  const body = await request.json();
  const result = await GradeService.publishGrades(payload.sub, body);

  return NextResponse.json({
    success: true,
    message: `تم نشر الدرجات لـ ${result.count} طالب`,
  });
});
