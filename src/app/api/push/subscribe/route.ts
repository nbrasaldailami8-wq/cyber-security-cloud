import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { getVapidPublicKey } from "@/lib/pushNotifications";
import { withErrorHandler } from "@/lib/errors";

const ACCESS_SECRET = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!);

export async function GET() {
  return NextResponse.json({
    success: true,
    publicKey: getVapidPublicKey(),
  });
}

export const POST = withErrorHandler(async function POST(request: NextRequest) {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;
    if (!accessToken) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 401 },
      );
    }

    const { payload } = await jwtVerify(accessToken, ACCESS_SECRET);
    const userId = payload.sub as string;

    const body = await request.json();
    const { endpoint, authKey, p256dhKey } = body;

    if (!endpoint || !authKey || !p256dhKey) {
      return NextResponse.json(
        { success: false, message: "بيانات الاشتراك غير كاملة" },
        { status: 400 },
      );
    }

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { userId, authKey, p256dhKey },
      create: { userId, endpoint, authKey, p256dhKey },
    });

    return NextResponse.json({
      success: true,
      message: "تم تفعيل الإشعارات بنجاح",
    });
  });

export const DELETE = withErrorHandler(async function DELETE(request: NextRequest) {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;
    if (!accessToken) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 401 },
      );
    }

    const { payload } = await jwtVerify(accessToken, ACCESS_SECRET);
    const userId = payload.sub as string;

    await prisma.pushSubscription.deleteMany({ where: { userId } });

    return NextResponse.json({
      success: true,
      message: "تم إلغاء الإشعارات",
    });
  });
