import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth";
import { SecurityService } from "@/services/security/SecurityService";
import { withErrorHandler, UnauthorizedError } from "@/lib/errors";
import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/redis";

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "60s"),
  analytics: true,
});

export const GET = withErrorHandler(async (request: NextRequest) => {
  const token = request.cookies.get("accessToken")?.value;
  if (!token) throw new UnauthorizedError();

  const payload = await verifyAccessToken(token);
  if (!payload) throw new UnauthorizedError();

  const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
  const { success } = await ratelimit.limit(`${payload.sub}:${ip}`);
  if (!success)
    return NextResponse.json(
      { success: false, error: "تجاوزت عدد الطلبات المسموح به" },
      { status: 429 },
    );

  const result = await SecurityService.getSecurityStats(payload.sub, payload.role);
  return NextResponse.json({ success: true, data: result });
});
