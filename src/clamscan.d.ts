declare module "clamscan" {
  interface ClamScanOptions {
    clamdscan?: {
      socket?: string | boolean;
      host?: string;
      port?: number;
      timeout?: number;
      bypassTest?: boolean;
    };
    preference?: string;
  }

  interface ScanResult {
    isInfected: boolean;
    viruses: string[];
  }

  class ClamScan {
    init(options?: ClamScanOptions): Promise<ClamScan>;
    scanBuffer(buffer: Buffer): Promise<ScanResult>;
  }

  export default ClamScan;
}
