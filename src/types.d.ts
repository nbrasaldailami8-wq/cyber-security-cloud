declare module "speakeasy" {
  interface GeneratedSecret {
    base32: string;
    otpauth_url?: string;
  }

  interface TotpVerifyOptions {
    secret: string;
    encoding: "base32";
    token: string;
    window?: number;
  }

  export function generateSecret(options: {
    name: string;
    issuer: string;
  }): GeneratedSecret;

  export namespace totp {
    function verify(options: TotpVerifyOptions): boolean;
  }
}

declare module "qrcode" {
  export function toDataURL(
    text: string,
    options?: Record<string, unknown>,
  ): Promise<string>;
}

declare module "web-push" {
  interface PushSubscriptionKeys {
    auth: string;
    p256dh: string;
  }

  interface PushSubscription {
    endpoint: string;
    keys: PushSubscriptionKeys;
  }

  interface RequestDetails {
    headers: Record<string, string>;
    body: string;
    endpoint: string;
    method: string;
  }

  export function setVapidDetails(
    subject: string,
    publicKey: string,
    privateKey: string,
  ): void;

  export function sendNotification(
    subscription: PushSubscription,
    payload: string,
    options?: Record<string, unknown>,
  ): Promise<RequestDetails>;

  export function generateVAPIDKeys(): {
    publicKey: string;
    privateKey: string;
  };
}
