import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { imagekit } from "@/lib/imagekit";
import { getEffectiveRole } from "@/lib/auth";
import { withErrorHandler } from "@/lib/errors";

const ACCESS_SECRET = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!);

export const GET = withErrorHandler(async function GET(request: NextRequest) {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;
    if (!accessToken)
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 401 },
      );

    const { payload } = await jwtVerify(accessToken, ACCESS_SECRET);
    const effective = await getEffectiveRole(payload.sub as string);

    const isAdmin = effective.role === "ADMIN";
    const isManager = effective.role === "MANAGEMENT";
    if (!isAdmin && !isManager) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 403 },
      );
    }
    const effectiveLevel = isAdmin ? null : effective.level;

    const allFiles = await imagekit.listFiles({ limit: 500 });

    const result: Record<string, any> = {};

    for (const file of allFiles) {
      const filePath = (file as any).filePath || (file as any).path || "/";
      const pathParts = filePath.split("/").filter((p: string) => p);

      let level = "غير مصنف";
      // استخراج المستوى من مسار code-editor (مثل /code-editor/LEVEL_1/...)
      const codeEditorMatch = filePath.match(/\/code-editor\/(LEVEL_\d)\//);
      if (codeEditorMatch) {
        level = codeEditorMatch[1];
      } else {
        for (const part of pathParts) {
          if (part.match(/level-\d/i)) {
            level = part.toUpperCase().replace("-", "_");
            break;
          }
          if (part.match(/level-LEVEL_\d/i)) {
            level = part.replace("level-", "").toUpperCase();
            break;
          }
        }
      }

      let subFolder = "ملفات أخرى";
      if (filePath.includes("/library/")) {
        const parts = filePath.split("/library/");
        if (parts.length > 1) {
          const subParts = parts[1].split("/");
          subFolder = "📚 " + (subParts[0] || "مكتبة");
        } else {
          subFolder = "📚 المكتبة التعليمية";
        }
      } else if (filePath.includes("/assignments/")) {
        const parts = filePath.split("/assignments/");
        if (parts.length > 1) {
          const subParts = parts[1].split("/");
          subFolder = "📤 " + (subParts[0] || "تكاليف");
        } else {
          subFolder = "📤 التكاليف";
        }
      } else if (filePath.includes("/grades/")) {
        const parts = filePath.split("/grades/");
        if (parts.length > 1) {
          const subParts = parts[1].split("/");
          subFolder = "📊 " + (subParts[0] || "درجات");
        } else {
          subFolder = "📊 توزيع الدرجات";
        }
      } else if (filePath.includes("/code-editor/")) {
        const parts = filePath.split("/code-editor/");
        if (parts.length > 1) {
          const subParts = parts[1].split("/");
          subFolder = "💻 " + (subParts[0] || "محرر أكواد");
        } else {
          subFolder = "💻 محرر الأكواد";
        }
      }
      // مجلد code-editor لا يخضع للفلترة حسب المستوى لأنه جديد
      const isCodeEditor = filePath.includes("/code-editor/");
      if (
        !isCodeEditor &&
        effectiveLevel &&
        level !== effectiveLevel &&
        level !== "غير مصنف"
      )
        continue;

      if (!result[level]) result[level] = {};
      if (!result[level][subFolder])
        result[level][subFolder] = { files: [], totalFiles: 0 };

      // استخراج اسم المستخدم من اسم الملف (عادة يحتوي على userId)
      let uploadedBy = "غير معروف";
      let targetUser = "غير معروف";

      // محاولة استخراج userId من اسم المجلد
      for (const part of pathParts) {
        if (part.match(/^[a-f0-9-]{36}$/i)) {
          targetUser = part.slice(0, 8) + "...";
        }
      }

      // تحديد نوع الناشر بناءً على المجلد
      if (filePath.includes("/library/")) uploadedBy = "مستخدم";
      else if (filePath.includes("/assignments/")) uploadedBy = "طالب";
      else if (filePath.includes("/grades/")) uploadedBy = "معلم";

      const f = file as any;
      result[level][subFolder].files.push({
        fileId: f.fileId,
        name: f.name,
        url: f.url,
        size: f.size || 0,
        updatedAt: f.updatedAt || f.createdAt,
        path: filePath,
        uploadedBy,
        targetUser,
      });
      result[level][subFolder].totalFiles++;
    }

    return NextResponse.json({ success: true, data: result });
  });
