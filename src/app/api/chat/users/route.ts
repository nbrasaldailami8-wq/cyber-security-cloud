import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, UnauthorizedError } from "@/lib/errors";

const ACCESS_SECRET = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!);

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("accessToken")?.value;
  if (!accessToken) throw new UnauthorizedError();

  const { payload } = await jwtVerify(accessToken, ACCESS_SECRET);
  const userId = payload.sub as string;
  const userRole = payload.role as string;
  const userLevel = payload.level as string | undefined;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const filterLevel = searchParams.get("level") || "";
  const filterRole = searchParams.get("role") || "";

  const where: any = {
    id: { not: userId },
    deletedAt: null,
    isActivated: true,
  };

  if (search && search.trim()) {
    where.name = { contains: search.trim(), mode: "insensitive" };
  }

  // العزل الأكاديمي
  if (userRole === "STUDENT") {
    where.OR = [
      { role: "ADMIN" },
      { role: "MANAGEMENT", level: userLevel },
      { role: "TEACHER", level: userLevel },
    ];
  } else if (userRole === "TEACHER") {
    where.OR = [
      { role: "ADMIN" },
      { role: "MANAGEMENT", level: userLevel },
      { role: "STUDENT", level: userLevel },
    ];
  } else if (userRole === "MANAGEMENT") {
    if (filterRole === "STUDENT") {
      where.role = "STUDENT";
      where.level = userLevel;
    } else if (filterRole === "TEACHER") {
      where.role = "TEACHER";
      where.level = userLevel;
    } else {
      where.OR = [
        { role: "ADMIN" },
        { role: "TEACHER", level: userLevel },
        { role: "STUDENT", level: userLevel },
      ];
    }
  } else if (userRole === "ADMIN") {
    if (filterLevel) where.level = filterLevel;
    if (filterRole) where.role = filterRole;
  }

  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
  const skipVal = (page - 1) * limit;

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      role: true,
      level: true,
      lastSeenAt: true,
      lastLoginAt: true,
    },
    orderBy: { name: "asc" },
    skip: skipVal,
    take: limit,
  });

  return NextResponse.json({ success: true, data: users });
});
