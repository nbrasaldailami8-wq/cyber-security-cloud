import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { generateSecureToken } from "@/lib/security";

const CSRF_COOKIE_NAME = "csrf-token";

const csrfExemptPaths = [
  "/api/auth/login",
  "/api/auth/activate",
  "/api/auth/forgot-password",
  "/api/auth/verify-reset-code",
  "/api/auth/reset-password",
  "/api/auth/refresh",
  "/api/auth/logout",
  "/api/auth/webauthn",
  "/api/subjects/active",
];

export function isCsrfExempt(pathname: string): boolean {
  return csrfExemptPaths.some((p) => pathname.startsWith(p));
}

export async function generateCsrfToken(): Promise<string> {
  const token = generateSecureToken(4).slice(0, 8);
  return token;
}

export async function setCsrfCookie(): Promise<string> {
  const token = await generateCsrfToken();
  const cookieStore = await cookies();

  cookieStore.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 24 * 60 * 60,
    path: "/",
  });

  return token;
}

export function verifyCsrfRequest(request: NextRequest): boolean {
  const method = request.method;
  // GET/HEAD requests لا تحتاج CSRF
  if (method === "GET" || method === "HEAD") return true;
  // المسارات العامة لا تحتاج CSRF
  if (isCsrfExempt(request.nextUrl.pathname)) return true;

  const headerToken = request.headers.get("X-CSRF-Token");
  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  if (!headerToken || !cookieToken) return false;
  return headerToken === cookieToken;
}

export function csrfGuard(request: NextRequest): NextResponse | null {
  if (!verifyCsrfRequest(request)) {
    return NextResponse.json(
      { success: false, message: "طلب غير مصرح (CSRF)" },
      { status: 403 },
    );
  }
  return null;
}
