import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SessionService } from "@/services/auth/SessionService";
import { withErrorHandler } from "@/lib/errors";

export const POST = withErrorHandler(async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("refreshToken")?.value;
  await SessionService.logout(refreshToken || "");
  return NextResponse.json({
    success: true,
    message: "تم تسجيل الخروج بنجاح",
  });
});
