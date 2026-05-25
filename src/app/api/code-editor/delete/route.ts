import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth";
import { withErrorHandler, UnauthorizedError, ValidationError } from "@/lib/errors";
import { CodeEditorService } from "@/services/academic/CodeEditorService";

export const DELETE = withErrorHandler(async function DELETE(request: NextRequest) {
  const token = request.cookies.get("accessToken")?.value;
  if (!token) throw new UnauthorizedError();

  const payload = await verifyAccessToken(token);
  if (!payload) throw new UnauthorizedError();

  const { id, type } = await request.json();
  if (!id) throw new ValidationError("معرف الملف مطلوب");

  if (type === "shared" || !type) {
    await CodeEditorService.deleteSharedCode(payload.sub, id);
  }

  if (type === "myfile") {
    await CodeEditorService.deleteMyFile(payload.sub, id);
  }

  return NextResponse.json({ success: true, message: "تم الحذف بنجاح" });
});
