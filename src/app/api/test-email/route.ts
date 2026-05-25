import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { withErrorHandler } from "@/lib/errors";

export const GET = withErrorHandler(async function GET(request: NextRequest) {
    const result = await sendEmail({
      to: "nbrasalsma@gmail.com",
      subject: "🧪 اختبار الإيميل - سحابة الأمن السيبراني",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #0d1117; color: #e6edf3; padding: 20px; border-radius: 12px; border: 1px solid #00e5ff;">
          <h2 style="color: #00e5ff;">✅ اختبار الإيميل ناجح</h2>
          <p>إذا وصلتك هذه الرسالة، فنظام الإيميلات يعمل بشكل صحيح.</p>
          <p><strong>الوقت:</strong> ${new Date().toLocaleString("ar-YE")}</p>
          <hr style="border-color: rgba(0,229,255,0.3);" />
          <p style="color: #8b949e; font-size: 0.85rem;">سحابة الأمن السيبراني - جامعة ذمار</p>
        </div>
      `,
    });

    if (result) {
      return NextResponse.json({
        success: true,
        message: "تم إرسال الإيميل بنجاح",
      });
    } else {
      return NextResponse.json(
        { success: false, message: "فشل إرسال الإيميل" },
        { status: 500 },
      );
    }
  });
