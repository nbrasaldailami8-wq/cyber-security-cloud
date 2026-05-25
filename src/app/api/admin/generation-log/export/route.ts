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
  const ids = searchParams.get("ids");

  const where: any = { deletedAt: null };

  if (payload.role === "MANAGEMENT" && payload.level) {
    where.level = payload.level as string;
  } else if (level) {
    where.level = level;
  }

  if (role) where.role = role;
  if (ids) {
    const idArray = ids.split(",").filter(Boolean);
    where.id = { in: idArray };
  }

  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50")));
  const skip = (page - 1) * limit;

  const [entries] = await Promise.all([
    prisma.generationLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.generationLog.count({ where }),
  ]);

  const lines: string[] = [];
  lines.push("==================================================================");
  lines.push("              سحابة الأمن السيبراني - جامعة ذمار");
  lines.push("                    أكواد التفعيل");
  lines.push("==================================================================");
  lines.push("");
  lines.push(`تاريخ التصدير: ${new Date().toLocaleDateString("ar-YE")}`);
  lines.push(`إجمالي الأكواد: ${entries.length}`);
  lines.push("");

  for (const entry of entries) {
    lines.push("------------------------------------------------------------------");
    const roleLabel = entry.role === "STUDENT" ? "طالب" : entry.role === "TEACHER" ? "معلم" : "إدارة";
    lines.push(`الاسم: ${entry.name}`);
    lines.push(`الدور: ${roleLabel}`);
    lines.push(`المستوى: ${entry.level === "LEVEL_1" ? "المستوى الأول" : "المستوى الثاني"}`);
    if (entry.subjectName) lines.push(`المادة: ${entry.subjectName}`);
    if (entry.subjectCode) lines.push(`كود المادة: ${entry.subjectCode}`);
    lines.push(`كود التفعيل: ${entry.code}`);
    lines.push("");
  }

  lines.push("==================================================================");
  lines.push("              Cybersecurity Cloud - Dhamar University");
  lines.push("==================================================================");

  const content = lines.join("\n");
  const filename = `activation-codes-${Date.now()}.txt`;

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
