import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { NotificationService } from "@/services/notification/NotificationService";
import { withErrorHandler } from "@/lib/errors";

const ACCESS_SECRET = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!);

export const POST = withErrorHandler(async (request: NextRequest) => {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("accessToken")?.value;
  if (!accessToken)
    return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 401 });

  const { payload } = await jwtVerify(accessToken, ACCESS_SECRET);
  const userId = payload.sub as string;

  const { notificationId, all } = await request.json();

  await NotificationService.markRead(userId, notificationId, all);

  return NextResponse.json({ success: true, message: "تم تحديث الإشعارات" });
});
