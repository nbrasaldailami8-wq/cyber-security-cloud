import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { loginRateLimiter } from "@/lib/ratelimit";
import { ValidationError } from "@/lib/errors";
import { withErrorHandler } from "@/lib/errors";
import { AuthService } from "@/services/auth/AuthService";
import { z } from "zod";

const loginSchema = z.object({
  username: z.string().min(3, "الاسم قصير جداً"),
  password: z.string().min(6, "كلمة المرور قصيرة جداً"),
});

export const POST = withErrorHandler(async function POST(request: NextRequest) {
  const body = await request.json();
  const validation = loginSchema.safeParse(body);
  if (!validation.success) throw new ValidationError(validation.error.issues[0].message);

  const { username, password } = validation.data;
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";

  const { success: rateLimitOk } = await loginRateLimiter.limit(`${username}:${ip}`);
  if (!rateLimitOk) {
    return NextResponse.json(
      { success: false, message: "محاولات كثيرة. حاول لاحقاً." },
      { status: 429 },
    );
  }

  const result = await AuthService.login(username, password, ip, userAgent);

  if ("requiresTwoFactor" in result && result.requiresTwoFactor) {
    return NextResponse.json({
      success: true,
      requiresTwoFactor: true,
      challengeId: result.challengeId,
      challengeToken: result.challengeToken,
      message: "الرجاء إدخال رمز المصادقة الثنائية",
    });
  }

  return NextResponse.json({
    success: true,
    message: "تم تسجيل الدخول بنجاح",
    token: result.accessToken,
    role: result.user.role,
    level: result.user.level,
    email: result.user.email,
    user: {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      role: result.user.role,
      level: result.user.level,
      webAuthnEnabled: result.user.webAuthnEnabled || false,
      managementLevel: result.user.managementLevel || null,
    },
  });
});
