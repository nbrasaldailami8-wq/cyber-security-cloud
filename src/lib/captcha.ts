const HCAPTCHA_SECRET = process.env.HCAPTCHA_SECRET_KEY;
const HCAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY;

const HCAPTCHA_TEST_SECRET = "0x0000000000000000000000000000000000000000";

export function getSiteKey(): string {
  return HCAPTCHA_SITE_KEY || "10000000-ffff-ffff-ffff-000000000000";
}

export async function verifyCaptcha(token: string): Promise<boolean> {
  if (!token) return false;

  if (HCAPTCHA_SECRET === HCAPTCHA_TEST_SECRET) {
    return true;
  }

  if (!HCAPTCHA_SECRET) {
    console.error("HCAPTCHA_SECRET_KEY is not configured — CAPTCHA verification impossible");
    return false;
  }

  try {
    const res = await fetch("https://api.hcaptcha.com/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: HCAPTCHA_SECRET,
        response: token,
      }),
    });

    const data = await res.json();
    return data.success === true;
  } catch (error) {
    console.error("hCaptcha verification failed:", error);
    return false;
  }
}
