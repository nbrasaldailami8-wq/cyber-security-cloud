import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth";
import { SemesterService } from "@/services/academic/SemesterService";
import { withErrorHandler } from "@/lib/errors";

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

  const data = await SemesterService.getSemesterStats(payload.sub);

  return NextResponse.json({ success: true, data });
});
