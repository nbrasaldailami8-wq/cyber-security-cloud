import crypto from "crypto";

const CHANNEL_SECRET =
  process.env.REALTIME_CHANNEL_SECRET ||
  process.env.NEXT_PUBLIC_REALTIME_CHANNEL_SECRET ||
  process.env.JWT_ACCESS_SECRET ||
  "cyber-security-realtime-key";

function deriveHash(input: string): string {
  return crypto.createHmac("sha256", CHANNEL_SECRET).update(input).digest("hex").slice(0, 16);
}

export function getUserChannelName(userId: string): string {
  return `user-${deriveHash(userId)}`;
}

export function getPresenceChannelName(): string {
  return `presence-${deriveHash("presence-global")}`;
}

export function deriveStaticChannelName(input: string): string {
  return `sys-${deriveHash(input)}`;
}
