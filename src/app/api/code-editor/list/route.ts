import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth";
import { imagekit } from "@/lib/imagekit";
import { withErrorHandler, UnauthorizedError } from "@/lib/errors";

export const GET = withErrorHandler(async function GET(request: NextRequest) {
  const token = request.cookies.get("accessToken")?.value;
  if (!token) throw new UnauthorizedError();

  const payload = await verifyAccessToken(token);
  if (!payload) throw new UnauthorizedError();

  const { searchParams } = new URL(request.url);
  const level = searchParams.get("level") || payload.level || "LEVEL_1";
  const folder = `/code-editor/${level}/${payload.sub}`;

  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
  const skip = (page - 1) * limit;

  const files = await imagekit.listFiles({ path: folder, skip, limit });

  const data = files.map((f: any) => ({
    fileId: f.fileId,
    fileName: f.name,
    fileUrl: f.url,
    fileSize: f.size,
    createdAt: f.createdAt,
  }));

  return NextResponse.json({ success: true, data });
});
