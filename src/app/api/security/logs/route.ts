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

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const type = searchParams.get("type") || "all";
  const severity = searchParams.get("severity") || "all";
  const search = searchParams.get("search") || "";
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";

  const result = await SecurityService.getSecurityLogs(payload.sub, payload.role, {
    page, limit, type, severity, search, from, to,
  });
  return NextResponse.json({ success: true, ...result });
});

export const POST = withErrorHandler(async (request: NextRequest) => {
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

  const body = await request.json();

  const log = await SecurityService.createSecurityLog(payload.sub, payload.role, {
    action: body.action,
    severity: body.severity || "WARNING",
    description: body.description,
    ipAddress: body.ipAddress || ip,
    deviceInfo: body.deviceInfo,
    level: body.level,
    metadata: body.metadata,
  });

  return NextResponse.json({ success: true, data: log }, { status: 201 });
});
