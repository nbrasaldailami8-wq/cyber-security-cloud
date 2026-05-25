import crypto from "crypto";
import { logger } from "@/lib/logger";

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;
const SALT_LENGTH = 16;
const KEY_ITERATIONS = 100000;
const KEY_LENGTH = 32;

function getKey(salt: Buffer): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is required");
  }
  return crypto.pbkdf2Sync(key, salt, KEY_ITERATIONS, KEY_LENGTH, "sha512");
}

export function encryptMessage(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(salt), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return salt.toString("hex") + ":" + iv.toString("hex") + ":" + encrypted;
}

export function decryptMessage(encryptedText: string): string {
  try {
    const parts = encryptedText.split(":");
    // format قديم: iv:encrypted (جزئين) — format جديد: salt:iv:encrypted (ثلاثة أجزاء)
    const isNewFormat = parts.length >= 3;
    const saltHex = isNewFormat ? parts.shift()! : null;
    const ivHex = parts.shift()!;
    const salt = saltHex ? Buffer.from(saltHex, "hex") : Buffer.from("cyber-security-salt-2024", "utf8");
    const iv = Buffer.from(ivHex, "hex");
    const encrypted = parts.join(":");
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(salt), iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error) {
    logger.warn("Decryption failed", { error: String(error) });
    return "[رسالة مشفرة - تعذر فك التشفير]";
  }
}
