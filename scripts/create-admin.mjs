import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    const passwordHash = await bcrypt.hash("Tarifa.store.777.nb", 12);

    const admin = await prisma.user.upsert({
      where: { email: "nbraskiani@gmail.com" },
      update: {
        passwordHash,
        isActivated: true,
        status: "ACTIVE",
        failedLoginAttempts: 0,
      },
      create: {
        name: "مدير النظام",
        email: "nbraskiani@gmail.com",
        passwordHash,
        role: "ADMIN",
        status: "ACTIVE",
        isActivated: true,
        failedLoginAttempts: 0,
      },
    });

    console.log("✅ تم إنشاء حساب الأدمن بنجاح!");
    console.log("📧 البريد: nbraskiani@gmail.com");
    console.log("🔑 كلمة المرور: Tarifa.store.777.nb");
    console.log("🆔 ID:", admin.id);
  } catch (error) {
    console.error("❌ فشل إنشاء الأدمن:", error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
