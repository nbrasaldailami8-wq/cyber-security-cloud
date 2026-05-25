import { NextRequest, NextResponse } from "next/server";
import { WebAuthnService } from "@/services/auth/WebAuthnService";
import { withErrorHandler, ValidationError } from "@/lib/errors";

export const POST = withErrorHandler(async function POST(request: NextRequest) {
  const body = await request.json();
  const { userId, authResponse } = body;
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const userAgent = request.headers.get("user-agent") || undefined;

  if (!userId || !authResponse) throw new ValidationError("بيانات غير كافية");

  const { role, level, email, name } = await WebAuthnService.completeLogin(userId, authResponse, ip, userAgent);
  return NextResponse.json({
    success: true,
    message: "تم الدخول بالبصمة بنجاح",
    role,
    level,
    email,
    name,
  });
});
