import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { WebAuthnService } from "@/services/auth/WebAuthnService";
import { withErrorHandler, UnauthorizedError } from "@/lib/errors";

const ACCESS_SECRET = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!);

export const POST = withErrorHandler(async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("accessToken")?.value;

  if (!accessToken) throw new UnauthorizedError();

  const { payload } = await jwtVerify(accessToken, ACCESS_SECRET);
  const userId = payload.sub as string;
  const userEmail = payload.email as string;
  const ip = request.headers.get("x-forwarded-for") || undefined;
  const userAgent = request.headers.get("user-agent") || undefined;

  const { options } = await WebAuthnService.startRegister(userId, userEmail, ip, userAgent);
  return NextResponse.json({ success: true, options });
});
