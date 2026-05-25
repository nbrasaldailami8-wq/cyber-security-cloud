import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SessionService } from "@/services/auth/SessionService";
import { refreshRateLimiter } from "@/lib/ratelimit";
import { withErrorHandler } from "@/lib/errors";

export const POST = withErrorHandler(async function POST(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ip = forwardedFor?.split(",")[0]?.trim() || realIp?.trim() || "unknown";
  const userAgent = request.headers.get("user-agent") || undefined;

  // منع flooding من IP واحد
  const { success: ipLimitOk } = await refreshRateLimiter.limit(ip);
  if (!ipLimitOk) {
    return NextResponse.json(
      { success: false, message: "محاولات كثيرة. حاول لاحقاً." },
      { status: 429 },
    );
  }

  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("refreshToken")?.value;
  if (!refreshToken) {
    return NextResponse.json(
      { success: false, message: "لا توجد جلسة نشطة" },
      { status: 401 },
    );
  }

  const accessToken = await SessionService.refreshSession(refreshToken, ip, userAgent);
  return NextResponse.json({
    success: true,
    message: "تم تجديد الجلسة",
    token: accessToken,
  });
});
