import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, UnauthorizedError } from "@/lib/errors";

export const POST = withErrorHandler(async function POST(request: NextRequest) {
  const token = request.cookies.get("accessToken")?.value;
  if (!token) throw new UnauthorizedError();

  const payload = await verifyAccessToken(token);
  if (!payload || !payload.sub) throw new UnauthorizedError();

  await prisma.user.update({
    where: { id: payload.sub },
    data: { lastSeenAt: new Date() },
  });

  return NextResponse.json({ success: true });
});
