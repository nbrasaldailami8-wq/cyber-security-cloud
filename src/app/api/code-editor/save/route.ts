import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth";
import { withErrorHandler, UnauthorizedError, ValidationError } from "@/lib/errors";

export const POST = withErrorHandler(async function POST(request: NextRequest) {
  const token = request.cookies.get("accessToken")?.value;
  if (!token) throw new UnauthorizedError();

  const payload = await verifyAccessToken(token);
  if (!payload) throw new UnauthorizedError();

  const body = await request.json();
  const { language, code, fileName, level } = body;

  if (!language || !code || !level) throw new ValidationError("البيانات غير مكتملة");

  const ext =
    language === "python" ? ".py"
    : language === "cpp" ? ".cpp"
    : language === "csharp" ? ".cs"
    : language === "html" ? ".html"
    : ".txt";
  const finalFileName = fileName || `code_${Date.now()}${ext}`;
  const folder = `/code-editor/${level}/${payload.sub}`;

  const formData = new FormData();
  formData.append("file", code);
  formData.append("fileName", finalFileName);
  formData.append("folder", folder);
  formData.append("useUniqueFileName", "true");

  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY || "";
  const auth = Buffer.from(`${privateKey}:`).toString("base64");

  const uploadResponse = await fetch(
    "https://upload.imagekit.io/api/v1/files/upload",
    {
      method: "POST",
      headers: { Authorization: `Basic ${auth}` },
      body: formData,
    },
  );

  const uploadData = await uploadResponse.json();

  if (!uploadResponse.ok) {
    console.error("ImageKit upload error:", uploadData);
    return NextResponse.json(
      { success: false, error: uploadData.message || "فشل الرفع إلى السحابة" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    data: { fileId: uploadData.fileId, fileUrl: uploadData.url, fileName: uploadData.name },
  });
});
