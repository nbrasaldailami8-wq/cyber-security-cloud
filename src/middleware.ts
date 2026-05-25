import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_ACCESS_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_ACCESS_SECRET environment variable is required");
}
const ACCESS_SECRET = new TextEncoder().encode(JWT_SECRET);

const RAW_APP_URL = process.env.NEXT_PUBLIC_APP_URL;
if (!RAW_APP_URL) {
  throw new Error(
    "NEXT_PUBLIC_APP_URL environment variable is required",
  );
}
let APP_URL: string;
try {
  APP_URL = new URL(RAW_APP_URL).origin;
} catch {
  throw new Error(
    `NEXT_PUBLIC_APP_URL is not a valid URL: ${RAW_APP_URL}`,
  );
}
if (APP_URL !== "http://localhost:3000" && !APP_URL.startsWith("https://")) {
  throw new Error(
    `NEXT_PUBLIC_APP_URL must use HTTPS in production: ${APP_URL}`,
  );
}

const publicPaths = [
  "/",
  "/login",
  "/onboarding",
  "/activate",
  "/forgot-password",
  "/api/auth/login",
  "/api/auth/activate",
  "/api/auth/forgot-password",
  "/api/auth/verify-reset-code",
  "/api/auth/reset-password",
  "/api/auth/refresh",
  "/api/auth/logout",
  "/api/auth/webauthn/login/start",
  "/api/auth/webauthn/login/complete",
];

const csrfExemptPaths = [
  "/api/auth/login",
  "/api/auth/activate",
  "/api/auth/forgot-password",
  "/api/auth/verify-reset-code",
  "/api/auth/reset-password",
  "/api/auth/refresh",
  "/api/auth/logout",
  "/api/auth/webauthn",
  "/api/auth/2fa",
];

const adminPaths = ["/admin"];
const managementPaths = ["/management"];
const teacherPaths = ["/teacher"];
const studentPaths = ["/student"];

function isPublicPath(pathname: string): boolean {
  return publicPaths.some(
    (p) =>
      pathname === p ||
      pathname.startsWith("/_next") ||
      pathname.startsWith("/api/auth"),
  );
}

function clearCookiesAndRedirect() {
  const redirectRes = NextResponse.redirect(new URL("/login", APP_URL));
  redirectRes.cookies.set("accessToken", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });
  redirectRes.cookies.set("refreshToken", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });
  return redirectRes;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  // Correlation ID للتتبع
  const correlationBytes = new Uint8Array(16);
  crypto.getRandomValues(correlationBytes);
  const correlationId = Array.from(correlationBytes, (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  request.headers.set("x-correlation-id", correlationId);
  response.headers.set("x-correlation-id", correlationId);

  // أمان الرؤوس
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload",
  );
  const isDev = process.env.NODE_ENV === "development";
  response.headers.set(
    "Content-Security-Policy",
    `default-src 'self'; script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://js.hcaptcha.com https://newassets.hcaptcha.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https://ik.imagekit.io; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.upstash.io https://sentry.hcaptcha.com https://*.supabase.co wss://*.supabase.co; frame-src 'self' https://www.youtube.com https://newassets.hcaptcha.com;`,
  );

  const method = request.method;

  // تعيين CSRF token إذا لم يكن موجوداً
  if (!request.cookies.get("csrf-token")?.value) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const token = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    response.cookies.set("csrf-token", token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60,
      path: "/",
    });
  }

  // التحقق من CSRF لـ API requests (POST/PUT/DELETE)
  if (
    ["POST", "PUT", "DELETE", "PATCH"].includes(method) &&
    pathname.startsWith("/api/") &&
    !csrfExemptPaths.some((p) => pathname.startsWith(p))
  ) {
    const headerToken = request.headers.get("X-CSRF-Token");
    const cookieToken = request.cookies.get("csrf-token")?.value;
    if (!headerToken || !cookieToken || headerToken !== cookieToken) {
      return NextResponse.json(
        { success: false, message: "طلب غير مصرح (CSRF)" },
        { status: 403 },
      );
    }
  }

  if (isPublicPath(pathname)) {
    return response;
  }

  const accessToken = request.cookies.get("accessToken")?.value;

  if (!accessToken) {
    const refreshToken = request.cookies.get("refreshToken")?.value;
    if (refreshToken) {
      try {
        const refreshResponse = await fetch(
          `${APP_URL}/api/auth/refresh`,
          {
            method: "POST",
            headers: { Cookie: `refreshToken=${refreshToken}` },
          },
        );

        if (refreshResponse.ok) {
          const data = await refreshResponse.json();
          // Inject into current request so downstream handler sees it
          request.cookies.set("accessToken", data.token);
          const newResponse = NextResponse.next();
          newResponse.cookies.set("accessToken", data.token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 15 * 60,
            path: "/",
          });
          return newResponse;
        }
      } catch (e) {
        // فشل التجديد
      }
    }

    return NextResponse.redirect(new URL("/login", APP_URL));
  }

  try {
    const { payload } = await jwtVerify(accessToken, ACCESS_SECRET);

    // P1-A: التحقق من الجلسة مع قاعدة البيانات
    try {
      const verifyRes = await fetch(
        `${APP_URL}/api/auth/verify-session`,
        { method: "POST", headers: { Cookie: request.headers.get("cookie") || "" } },
      );
      if (verifyRes.ok) {
        const data = await verifyRes.json();
        if (!data.valid) {
          if (data.hardLogout === false) {
            // SOFT: tokenVersion mismatch (role/level change)
            // clear only accessToken, attempt auto-refresh recovery
            const refreshToken = request.cookies.get("refreshToken")?.value;
            if (refreshToken) {
              try {
                const refreshResponse = await fetch(
                  `${APP_URL}/api/auth/refresh`,
                  {
                    method: "POST",
                    headers: { Cookie: `refreshToken=${refreshToken}` },
                  },
                );
                if (refreshResponse.ok) {
                  const refreshData = await refreshResponse.json();
                  // Inject into current request so downstream handler sees it
                  request.cookies.set("accessToken", refreshData.token);
                  const newResponse = NextResponse.next();
                  newResponse.cookies.set("accessToken", refreshData.token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                    sameSite: "strict",
                    maxAge: 15 * 60,
                    path: "/",
                  });
                  return newResponse;
                }
              } catch {
                // auto-refresh failed — fall through to hard logout
              }
            }
          }
          // HARD (default when hardLogout is undefined or true):
          return clearCookiesAndRedirect();
        }
      } else {
        // verify-session returned non-2xx — fail closed
        return clearCookiesAndRedirect();
      }
    } catch {
      // verify-session failed (network error, timeout) — fail closed
      return clearCookiesAndRedirect();
    }

    const userRole = payload.role as string;

    // ملاحظة: managementLevel أُزيل من JWT لأمن المعلومات.
    // الأدوار متعددة المستويات (ADMIN + managementLevel) تُفحص عبر
    // getEffectiveRole() من قاعدة البيانات في route handlers الفعلية.

    const isAdminPath = adminPaths.some((p) => pathname.startsWith(p));
    const isAllowedManagementPath =
      userRole === "MANAGEMENT" &&
      (pathname.startsWith("/admin/generation") ||
        pathname.startsWith("/admin/promotions") ||
        pathname.startsWith("/admin/server-usage") ||
        pathname.startsWith("/admin/activated-accounts") ||
        pathname.startsWith("/admin/audit-log") ||
        pathname.startsWith("/admin/semester"));
    if (isAdminPath && userRole !== "ADMIN" && !isAllowedManagementPath) {
      return NextResponse.redirect(new URL("/login", APP_URL));
    }

    if (
      managementPaths.some((p) => pathname.startsWith(p)) &&
      userRole !== "MANAGEMENT" &&
      userRole !== "ADMIN"
    ) {
      return NextResponse.redirect(new URL("/login", APP_URL));
    }

    if (
      teacherPaths.some((p) => pathname.startsWith(p)) &&
      userRole !== "TEACHER" &&
      userRole !== "ADMIN" &&
      userRole !== "MANAGEMENT"
    ) {
      return NextResponse.redirect(new URL("/login", APP_URL));
    }

    if (
      studentPaths.some((p) => pathname.startsWith(p)) &&
      userRole !== "STUDENT" &&
      userRole !== "ADMIN" &&
      userRole !== "MANAGEMENT" &&
      userRole !== "TEACHER"
    ) {
      return NextResponse.redirect(new URL("/login", APP_URL));
    }

    return response;
  } catch (error) {
    return NextResponse.redirect(new URL("/login", APP_URL));
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|push-sw.js|manifest.json).*)",
  ],
};
