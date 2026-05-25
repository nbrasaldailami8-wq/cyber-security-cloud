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

  const formData = await request.formData();
  const file = formData.get("file") as File;
  const subjectId = formData.get("subjectId") as string;

  const result = await GradeService.analyzeGrades(payload.sub, { file, subjectId });

  return NextResponse.json({
    success: true,
    message: `تم استخراج ${result.extracted.length} طالب`,
    ...result,
  });
});
