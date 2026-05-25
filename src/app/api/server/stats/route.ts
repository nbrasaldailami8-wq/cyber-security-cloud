import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { withErrorHandler } from "@/lib/errors";

const ACCESS_SECRET = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!);

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("accessToken")?.value;
  if (!accessToken) {
    return NextResponse.json(
      { success: false, message: "غير مصرح" },
      { status: 401 },
    );
  }

  const { payload } = await jwtVerify(accessToken, ACCESS_SECRET);
  const userRole = payload.role as string;
  const userLevel = payload.level as string | undefined;

  if (userRole !== "ADMIN" && userRole !== "MANAGEMENT") {
    return NextResponse.json(
      { success: false, message: "غير مصرح" },
      { status: 403 },
    );
  }

  const isManagement = userRole === "MANAGEMENT";
  const userFilter = isManagement && userLevel ? { level: userLevel as any } : {};
  const contentFilter = isManagement && userLevel ? { level: userLevel as any } : {};

  const [
    totalUsers,
    activeUsers,
    pendingUsers,
    totalAssignments,
    evaluatedAssignments,
    totalContent,
    totalSubjects,
  ] = await Promise.all([
    prisma.user.count({ where: { ...userFilter, deletedAt: null } }),
    prisma.user.count({
      where: { ...userFilter, status: "ACTIVE", deletedAt: null },
    }),
    prisma.user.count({
      where: { ...userFilter, status: "PENDING", deletedAt: null },
    }),
    prisma.assignment.count({ where: { deletedAt: null } }),
    prisma.assignment.count({
      where: { grade: { not: null }, deletedAt: null },
    }),
    prisma.content.count({ where: { ...contentFilter, deletedAt: null } }),
    prisma.subject.count({ where: { ...userFilter, deletedAt: null } }),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      totalUsers,
      activeUsers,
      pendingUsers,
      totalAssignments,
      evaluatedAssignments,
      totalContent,
      totalSubjects,
    },
  });
});
