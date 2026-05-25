const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({
  to,
  subject,
  html,
}: SendEmailOptions): Promise<boolean> {
  // المحاولة الأولى: Brevo API
  try {
    const apiKey = process.env.BREVO_API_KEY;
    if (apiKey) {
      const res = await fetch(BREVO_API_URL, {
        method: "POST",
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: {
            name: process.env.BREVO_FROM_NAME || "سحابة الأمن السيبراني",
            email:
              process.env.BREVO_FROM_EMAIL || "nbrasaldailami138@gmail.com",
          },
          to: [{ email: to }],
          subject,
          htmlContent: html,
        }),
      });

      if (res.ok) {
        return true;
      }
      console.error("Brevo API error:", await res.text());
    }
  } catch (error) {
    console.error("Brevo API failed:", error);
  }

  // المحاولة الثانية: SMTP
  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.default.createTransport({
      host: process.env.BREVO_SMTP_HOST || "smtp-relay.brevo.com",
      port: Number(process.env.BREVO_SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.BREVO_SMTP_USER || "",
        pass: process.env.BREVO_SMTP_KEY || "",
      },
    });

    await transporter.sendMail({
      from: `"${process.env.BREVO_FROM_NAME}" <${process.env.BREVO_FROM_EMAIL}>`,
      to,
      subject,
      html,
    });
    return true;
  } catch (error) {
    console.error("SMTP also failed:", error);
    return false;
  }
}

export function generateActivationEmail(activationCode: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a1128; color: #ffffff; padding: 30px; border-radius: 12px; border: 1px solid #00e5ff;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #00e5ff; margin: 0;">سحابة الأمن السيبراني</h1>
        <p style="color: #8b949e;">جامعة ذمار - كلية الحاسبات</p>
      </div>
      <div style="background: rgba(0, 229, 255, 0.1); border: 1px solid #00e5ff; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
        <p style="font-size: 14px; color: #8b949e; margin-bottom: 10px;">كود التفعيل الخاص بك:</p>
        <h2 style="color: #00e5ff; font-size: 32px; letter-spacing: 8px; margin: 10px 0; direction: ltr;">${activationCode}</h2>
        <p style="font-size: 12px; color: #ffca28;">هذا الكود صالح للاستخدام مرة واحدة فقط</p>
      </div>
      <p style="color: #e6edf3; text-align: center; font-size: 14px;">يرجى إدخال هذا الكود في صفحة تفعيل الحساب</p>
      <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #30363d;">
        <p style="color: #8b949e; font-size: 12px;">إذا لم تقم بطلب هذا الكود، يرجى تجاهل هذه الرسالة</p>
      </div>
    </div>
  `;
}

export function generateResetPasswordEmail(resetCode: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a1128; color: #ffffff; padding: 30px; border-radius: 12px; border: 1px solid #ffca28;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #ffca28; margin: 0;">إعادة تعيين كلمة المرور</h1>
        <p style="color: #8b949e;">سحابة الأمن السيبراني</p>
      </div>
      <div style="background: rgba(255, 202, 40, 0.1); border: 1px solid #ffca28; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
        <p style="font-size: 14px; color: #8b949e; margin-bottom: 10px;">كود إعادة التعيين:</p>
        <h2 style="color: #ffca28; font-size: 32px; letter-spacing: 8px; margin: 10px 0; direction: ltr;">${resetCode}</h2>
      </div>
      <p style="color: #e6edf3; text-align: center; font-size: 14px;">يرجى إدخال هذا الكود لتعيين كلمة مرور جديدة</p>
      <p style="color: #ff3131; text-align: center; font-size: 12px;">إذا لم تقم بطلب إعادة التعيين، يرجى تجاهل هذه الرسالة فوراً</p>
    </div>
  `;
}
