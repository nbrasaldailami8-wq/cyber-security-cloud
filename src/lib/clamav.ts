import { prisma } from "@/lib/prisma";

interface ScanResult {
  isInfected: boolean;
  viruses: string[];
  error?: string;
}

let clamAvNode: any = null;

async function getScanner() {
  if (clamAvNode) return clamAvNode;

  try {
    const NodeClam = (await import("clamscan")).default;
    clamAvNode = await new NodeClam().init({
      clamdscan: {
        socket: process.env.CLAMAV_SOCKET || false,
        host: process.env.CLAMAV_HOST || "localhost",
        port: Number(process.env.CLAMAV_PORT) || 3310,
        timeout: 30000,
        bypassTest: true,
      },
      preference: "clamdscan",
    });
    return clamAvNode;
  } catch (err) {
    console.warn("⚠️ ClamAV not available:", err);
    return null;
  }
}

export async function scanFile(
  fileBuffer: Buffer,
  fileName: string,
): Promise<ScanResult> {
  // في وضع التطوير، نتجاوز الفحص
  if (process.env.NODE_ENV === "development") {
    return { isInfected: false, viruses: [] };
  }

  try {
    const scanner = await getScanner();
    if (!scanner) {
      return {
        isInfected: false,
        viruses: [],
        error: "ClamAV غير متاح",
      };
    }

    const { isInfected, viruses } = await scanner.scanBuffer(fileBuffer);
    return { isInfected, viruses: viruses || [] };
  } catch (err: any) {
    return {
      isInfected: false,
      viruses: [],
      error: err.message,
    };
  }
}

export async function scanAndReject(
  fileBuffer: Buffer,
  fileName: string,
  userId: string,
): Promise<boolean> {
  const result = await scanFile(fileBuffer, fileName);

  if (result.isInfected) {
    await prisma.auditLog.create({
      data: {
        userId,
        action: "SUSPICIOUS_ACTIVITY",
        severity: "CRITICAL",
        description: `ملف مصاب بفيروس: ${fileName} - ${result.viruses.join(", ")}`,
      },
    });
    return true; // ملف مصاب
  }

  return false; // آمن
}
