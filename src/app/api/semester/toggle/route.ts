import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth";
import { SemesterService } from "@/services/academic/SemesterService";
import { withErrorHandler } from "@/lib/errors";

export const POST = withErrorHandler(async (request: NextRequest) => {
  const token = request.cookies.get("accessToken")?.value;
  if (!token) {
    return NextResponse.json(
      { success: false, error: "غير مصرح" },
      { status: 401 },
    );
  }

  const payload = await verifyAccessToken(token);
  if (!payload) {
    return NextResponse.json(
      { success: false, error: "غير مصرح" },
      { status: 401 },
    );
  }

  const body = await request.json();
  const { subjectIds, isVisible } = body;

  const result = await SemesterService.toggleSemester(payload.sub, subjectIds, isVisible);

  return NextResponse.json({
    success: true,
    message: `تم ${isVisible ? "إظهار" : "إخفاء"} ${result.count} مادة بنجاح`,
  });
});
