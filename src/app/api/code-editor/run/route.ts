import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth";
import { withErrorHandler, UnauthorizedError, ValidationError } from "@/lib/errors";

const JDOODLE_API = "https://api.jdoodle.com/v1/execute";

const LANG_CONFIG: Record<string, { language: string; versionIndex: string }> = {
  python: { language: "python3", versionIndex: "4" },
  cpp: { language: "cpp17", versionIndex: "0" },
  csharp: { language: "csharp", versionIndex: "4" },
};

export const POST = withErrorHandler(async function POST(request: NextRequest) {
  const token = request.cookies.get("accessToken")?.value;
  if (!token) throw new UnauthorizedError();

  const payload = await verifyAccessToken(token);
  if (!payload) throw new UnauthorizedError();

  const { language, code } = await request.json();
  if (!language || !code) throw new ValidationError("اللغة والكود مطلوبان");

  const langConfig = LANG_CONFIG[language];
  if (!langConfig) throw new ValidationError("لغة غير مدعومة");

  const clientId = process.env.JDOODLE_CLIENT_ID || "";
  const clientSecret = process.env.JDOODLE_CLIENT_SECRET || "";

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { success: false, error: "مفاتيح JDoodle غير موجودة" },
      { status: 500 },
    );
  }

  let res;
  try {
    res = await fetch(JDOODLE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        clientSecret,
        script: code,
        language: langConfig.language,
        versionIndex: langConfig.versionIndex,
      }),
    });
  } catch {
    return NextResponse.json({
      success: true,
      output: "⚠️ فشل الاتصال بخادم JDoodle. حاول مرة أخرى.",
    });
  }

  const data = await res.json();

  let output = "";
  if (data.output) output += data.output;
  if (data.error) output += `\n[خطأ]: ${data.error}`;
  if (data.statusCode && data.statusCode !== 200) {
    output += `\n[حالة]: ${data.error || data.message || "خطأ غير معروف"}`;
  }
  if (!output.trim()) output = "✅ تم التشغيل بدون مخرجات";

  return NextResponse.json({ success: true, output });
});
