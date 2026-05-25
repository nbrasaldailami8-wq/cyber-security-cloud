import speakeasy from "speakeasy";
import qrcode from "qrcode";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "سحابة الأمن السيبراني";

export function generateTwoFASecret(userEmail: string) {
  const secret = speakeasy.generateSecret({
    name: `${APP_NAME}:${userEmail}`,
    issuer: APP_NAME,
  });

  return {
    base32: secret.base32,
    otpauthUrl: secret.otpauth_url || "",
  };
}

export async function generateQRCode(otpauthUrl: string): Promise<string> {
  return qrcode.toDataURL(otpauthUrl);
}

export function verifyTwoFACode(secret: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token,
    window: 1,
  });
}

export function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 8; i++) {
    const bytes = new Uint8Array(2);
    crypto.getRandomValues(bytes);
    const code =
      (bytes[0] % 10).toString() +
      (bytes[1] % 10).toString() +
      ((bytes[0] >> 4) % 10).toString() +
      ((bytes[1] >> 4) % 10).toString();
    codes.push(code);
  }
  return codes;
}
