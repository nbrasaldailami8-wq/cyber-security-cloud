import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { withErrorHandler, UnauthorizedError } from "@/lib/errors";
import { AdminService } from "@/services/academic/AdminService";

const ACCESS_SECRET = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!);

export const GET = withErrorHandler(async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("accessToken")?.value;
  if (!accessToken) throw new UnauthorizedError();

  const { payload } = await jwtVerify(accessToken, ACCESS_SECRET);

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));

  const result = await AdminService.getAuditLogs(payload.sub as string, { page, limit });

  return NextResponse.json({
    success: true,
    data: result.data,
    total: result.total,
    page: result.page,
    limit: result.limit,
  });
});
