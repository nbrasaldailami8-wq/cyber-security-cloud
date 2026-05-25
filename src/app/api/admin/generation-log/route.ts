import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, UnauthorizedError, ForbiddenError } from "@/lib/errors";

const ACCESS_SECRET = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!);

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("accessToken")?.value;
  if (!accessToken) throw new UnauthorizedError();

  const { payload } = await jwtVerify(accessToken, ACCESS_SECRET);
  if (payload.role !== "ADMIN" && payload.role !== "MANAGEMENT") {
    throw new ForbiddenError();
  }

  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role");
  const level = searchParams.get("level");
  const search = searchParams.get("search");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);

  const where: any = { deletedAt: null };

  if (payload.role === "MANAGEMENT" && payload.level) {
    where.level = payload.level as string;
  } else if (level) {
    where.level = level;
  }

  if (role) {
    if (role === "TEACHER") {
      where.OR = [{ role: "TEACHER" }, { subjectName: { not: null } }];
    } else {
      where.role = role;
    }
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
    ];
  }

  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    prisma.generationLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.generationLog.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    data,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
});
