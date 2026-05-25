import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";

const ACCESS_SECRET = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!);

export async function POST(request: NextRequest) {
  try {
    const accessToken = request.cookies.get("accessToken")?.value;
    if (!accessToken) {
      return NextResponse.json({ valid: false, reason: "NO_TOKEN", hardLogout: true });
    }

    const { payload } = await jwtVerify(accessToken, ACCESS_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: payload.sub, deletedAt: null },
      select: { tokenVersion: true, status: true, id: true },
    });

    if (!user) {
      return NextResponse.json({ valid: false, reason: "USER_NOT_FOUND", hardLogout: true });
    }

    if (user.status !== "ACTIVE") {
      return NextResponse.json({ valid: false, reason: "ACCOUNT_DISABLED", hardLogout: true });
    }

    if (payload.tokenVersion !== undefined && payload.tokenVersion !== user.tokenVersion) {
      return NextResponse.json({ valid: false, reason: "TOKEN_VERSION_MISMATCH", hardLogout: false });
    }

    return NextResponse.json({ valid: true });
  } catch {
    return NextResponse.json({ valid: false });
  }
}
