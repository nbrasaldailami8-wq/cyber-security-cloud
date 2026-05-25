import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// محدد المعدل: 5 محاولات في الدقيقة
// مسموح 8 محاولات في الدقيقة (لتغطية المراحل الثلاث: 5 + 3 + 1)
export const loginRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(8, "1 m"),
  analytics: true,
  prefix: "ratelimit:login",
});
// 3 طلبات إعادة تعيين كلمة مرور في الساعة
export const passwordResetRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, "1 h"),
  analytics: true,
  prefix: "ratelimit:reset",
});

// 10 رسائل في الدقيقة
export const messageRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  analytics: true,
  prefix: "ratelimit:message",
});

// 5 رفع ملفات في الدقيقة
export const uploadRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 m"),
  analytics: true,
  prefix: "ratelimit:upload",
});

// 3 محاولات 2FA في الدقيقة
export const twoFARateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, "1 m"),
  analytics: true,
  prefix: "ratelimit:2fa",
});

// 3 تغييرات كلمة مرور في الساعة
export const profileRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, "1 h"),
  analytics: true,
  prefix: "ratelimit:profile",
});

// 5 محاولات التحقق من كود إعادة تعيين كلمة المرور لكل IP كل 15 دقيقة
export const verifyResetRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "15 m"),
  analytics: true,
  prefix: "ratelimit:verify-reset",
});

// 3 محاولات إعادة تعيين كلمة مرور لكل IP كل 30 دقيقة
export const resetPasswordRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, "30 m"),
  analytics: true,
  prefix: "ratelimit:reset-password",
});

// 5 محاولات WebAuthn لكل بريد إلكتروني كل 15 دقيقة
export const webauthnRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "15 m"),
  analytics: true,
  prefix: "ratelimit:webauthn",
});

// 5 محاولات التحقق من WebAuthn لكل مستخدم كل 15 دقيقة
export const webauthnVerifyRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "15 m"),
  analytics: true,
  prefix: "ratelimit:webauthn-verify",
});

// 3 محاولات تسجيل WebAuthn لكل مستخدم كل 15 دقيقة
export const webauthnRegisterRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, "15 m"),
  analytics: true,
  prefix: "ratelimit:webauthn-register",
});

// 10 محاولات تحديث جلسة لكل IP في الدقيقة — منع flooding
export const refreshRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  analytics: true,
  prefix: "ratelimit:refresh",
});

// 20 محاولة تحديث جلسة لكل مستخدم في الدقيقة — منع rotation spam
export const refreshUserRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "1 m"),
  analytics: true,
  prefix: "ratelimit:refresh-user",
});

export default loginRateLimiter;
