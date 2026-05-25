import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth";
import { withErrorHandler, UnauthorizedError } from "@/lib/errors";
import { CodeEditorService } from "@/services/academic/CodeEditorService";

export const GET = withErrorHandler(async function GET(request: NextRequest) {
  const token = request.cookies.get("accessToken")?.value;
  if (!token) throw new UnauthorizedError();

  const payload = await verifyAccessToken(token);
  if (!payload) throw new UnauthorizedError();

  const { searchParams } = new URL(request.url);
  const requestedLevel = searchParams.get("level");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));

  const result = await CodeEditorService.listSharedCode(payload.sub, {
    level: requestedLevel || undefined,
    page,
    limit,
  });

  return NextResponse.json({ success: true, ...result });
});
