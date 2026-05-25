import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { TwoFactorService } from "@/services/auth/TwoFactorService";
import { twoFARateLimiter } from "@/lib/ratelimit";
import { withErrorHandler } from "@/lib/errors";

const ACCESS_SECRET = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!);

export const POST = withErrorHandler(async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("accessToken")?.value;
  if (!accessToken) {
    return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 401 });
  }

  const { payload } = await jwtVerify(accessToken, ACCESS_SECRET);
  const userId = payload.sub as string;

  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const { success: rateLimitOk } = await twoFARateLimiter.limit(`${userId}:${ip}`);
  if (!rateLimitOk) {
    return NextResponse.json({ success: false, message: "محاولات كثيرة. حاول لاحقاً." }, { status: 429 });
  }

  const { token } = await request.json();
  if (!token) {
    return NextResponse.json({ success: false, message: "الكود مطلوب" }, { status: 400 });
  }

  const { backupCodes } = await TwoFactorService.verify(userId, token);
  return NextResponse.json({
    success: true,
    message: "تم تفعيل المصادقة الثنائية",
    backupCodes,
  });
});
