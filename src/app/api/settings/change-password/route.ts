import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { PasswordService } from "@/services/auth/PasswordService";
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

  const { currentPassword, newPassword } = await request.json();
  await PasswordService.changePassword(userId, currentPassword, newPassword);

  const refreshToken = cookieStore.get("refreshToken")?.value;
  await PasswordService.revokeOtherSessions(userId, refreshToken);

  return NextResponse.json({ success: true, message: "تم تغيير كلمة المرور بنجاح" });
});
