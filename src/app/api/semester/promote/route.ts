import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth";
import { SemesterService } from "@/services/academic/SemesterService";
import { withErrorHandler } from "@/lib/errors";

const levelLabels: Record<string, string> = {
  LEVEL_1: "المستوى الأول",
  LEVEL_2: "المستوى الثاني",
  LEVEL_3: "المستوى الثالث",
  LEVEL_4: "المستوى الرابع",
};

export const GET = withErrorHandler(async (request: NextRequest) => {
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

  const data = await SemesterService.getPromotePreview(payload.sub);

  return NextResponse.json({ success: true, data });
});

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
  const { level, studentIds } = body;

  const result = await SemesterService.promoteStudents(payload.sub, level, studentIds);

  return NextResponse.json({
    success: true,
    message: `تم ترقية ${result.count} طالب إلى ${levelLabels[result.toLevel]} بنجاح`,
  });
});
