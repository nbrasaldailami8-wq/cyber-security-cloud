import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { withErrorHandler, UnauthorizedError } from "@/lib/errors";
import { getUserChannelName, getPresenceChannelName } from "@/lib/realtimeChannels";

const ACCESS_SECRET = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!);

export const POST = withErrorHandler(async function POST(request: NextRequest) {
  const body = await request.json();
  const { channelUserId, channelType } = body;

  // Presence channel — return global presence channel name
  if (channelType === "presence") {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;
    if (!accessToken) throw new UnauthorizedError();
    await jwtVerify(accessToken, ACCESS_SECRET);
    return NextResponse.json({
      authorized: true,
      channelName: getPresenceChannelName(),
    });
  }

  // Validate authentication for all channels
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("accessToken")?.value;
  if (!accessToken) {
    throw new UnauthorizedError();
  }

  const { payload } = await jwtVerify(accessToken, ACCESS_SECRET);
  const authenticatedUserId = payload.sub as string;

  // System / generic channel — JWT-authenticated access granted
  if (!channelUserId) {
    return NextResponse.json({ authorized: true, channelName: "" });
  }

  // User broadcast channel — must match authenticated user
  if (authenticatedUserId !== channelUserId) {
    return NextResponse.json(
      { authorized: false, message: "غير مصرح بالاشتراك في هذه القناة" },
      { status: 403 },
    );
  }

  return NextResponse.json({
    authorized: true,
    channelName: getUserChannelName(channelUserId),
  });
});
