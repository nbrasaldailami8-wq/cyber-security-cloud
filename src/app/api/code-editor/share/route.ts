import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth";
import { withErrorHandler, UnauthorizedError } from "@/lib/errors";
import { CodeEditorService } from "@/services/academic/CodeEditorService";

export const POST = withErrorHandler(async function POST(request: NextRequest) {
  const token = request.cookies.get("accessToken")?.value;
  if (!token) throw new UnauthorizedError();

  const payload = await verifyAccessToken(token);
  if (!payload) throw new UnauthorizedError();

  const {
    fileUrl,
    fileName,
    language,
    showAuthor,
    level,
    title,
    authorName,
    note,
  } = await request.json();

  await CodeEditorService.shareCode(payload.sub, payload, {
    fileUrl,
    fileName,
    language,
    title,
    authorName,
    showAuthor,
    level,
    note,
  });

  return NextResponse.json({ success: true, message: "تمت المشاركة بنجاح" });
});

export const PUT = withErrorHandler(async function PUT(request: NextRequest) {
  const token = request.cookies.get("accessToken")?.value;
  if (!token) throw new UnauthorizedError();

  const payload = await verifyAccessToken(token);
  if (!payload) throw new UnauthorizedError();

  const { id, showAuthor } = await request.json();

  await CodeEditorService.updateSharedCodeVisibility(payload.sub, id, showAuthor);

  return NextResponse.json({ success: true, message: "تم التحديث" });
});
