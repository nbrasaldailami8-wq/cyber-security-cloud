import { NextRequest, NextResponse } from "next/server";
import { WebAuthnService } from "@/services/auth/WebAuthnService";
import { webauthnRateLimiter } from "@/lib/ratelimit";
import { withErrorHandler, ValidationError, RateLimitError } from "@/lib/errors";

export const POST = withErrorHandler(async function POST(request: NextRequest) {
  const body = await request.json();
  const { email } = body;

  if (!email) throw new ValidationError("البريد الإلكتروني مطلوب");

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "127.0.0.1";
  const userAgent = request.headers.get("user-agent") || undefined;
  const rateKey = `${email}:${ip}`;
  const { success: rateLimitOk } = await webauthnRateLimiter.limit(rateKey);
  if (!rateLimitOk) throw new RateLimitError();

  const { options, userId } = await WebAuthnService.startLogin(email, ip, userAgent);
  return NextResponse.json({ success: true, options, userId });
});
