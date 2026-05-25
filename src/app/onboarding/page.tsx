"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import MatrixRain from "@/components/effects/MatrixRain";
import NeonParticles from "@/components/effects/NeonParticles";
import ScanLine from "@/components/effects/ScanLine";

const OnboardingScene = dynamic(
  () => import("@/components/effects/OnboardingScene"),
  { ssr: false },
);

const slides = [
  {
    id: 1,
    title: "سحابة الأمن السيبراني",
    subtitle: "جامعة ذمار - كلية الحاسبات",
    description:
      "مرحباً بك في بيئة تعليمية تفاعلية متكاملة تجمع بين الطلاب والمعلمين والإدارة في منصة واحدة مؤمنة بأعلى معايير الحماية.",
    icon: "🌍",
  },
  {
    id: 2,
    title: "هويات المستخدمين",
    subtitle: "أربعة أدوار رئيسية",
    description:
      "👑 الأدمن - المشرف العام على النظام\n🏢 الإدارة - مسؤول عن مستوى دراسي\n👨‍🏫 المعلم - يقيم التكاليف وينشر المحتوى\n🎓 الطالب - يرفع التكاليف ويتابع درجاته",
    icon: "👥",
  },
  {
    id: 3,
    title: "دور الطالب",
    subtitle: "قائد رحلته التعليمية",
    description:
      "📤 رفع التكاليف الجامعية إلى معلمي المواد\n💬 مراسلة المعلمين والإدارة مباشرة\n📚 تصفح المكتبة العلمية وتحميل المحتوى\n📊 متابعة الدرجات وملاحظات المعلمين",
    icon: "🎓",
  },
  {
    id: 4,
    title: "دور المعلم",
    subtitle: "صانع المعرفة",
    description:
      "📥 استقبال تكاليف الطلاب وتقييمها\n📚 نشر الملازم والمحاضرات في المكتبة\n📢 نشر التعميمات على طلاب مستواه\n📝 تصدير وتوزيع درجات الطلاب آلياً",
    icon: "👨‍🏫",
  },
  {
    id: 5,
    title: "دور الإدارة",
    subtitle: "منسق العملية التعليمية",
    description:
      "🏗️ توليد حسابات الطلاب والمعلمين\n📋 إدارة المواد الدراسية لكل ترم\n⬆️ منح صلاحيات النشر في المكتبة\n📜 مراقبة سير العملية التعليمية",
    icon: "🏢",
  },
  {
    id: 6,
    title: "تفعيل الحساب",
    subtitle: "خطوة واحدة للبدء",
    description:
      "1️⃣ احصل على كود التفعيل من الإدارة\n2️⃣ أدخل بريدك الإلكتروني وكلمة المرور\n3️⃣ أدخل كود التفعيل المرسل إليك\n4️⃣ تمتع بكامل صلاحيات حسابك فوراً",
    icon: "🔐",
  },
  {
    id: 7,
    title: "نسيت كلمة المرور",
    subtitle: "استعادة سهلة وآمنة",
    description:
      "📧 أدخل بريدك الإلكتروني\n📨 استلم كود التحقق على بريدك\n🔑 عيّن كلمة مرور جديدة\n✅ سجّل دخولك بشكل طبيعي",
    icon: "🔑",
  },
  {
    id: 8,
    title: "المكتبة العلمية",
    subtitle: "مصدرك للمعرفة",
    description:
      "🎥 كورسات يوتيوب تعليمية\n📄 ملازم ومحاضرات قابلة للتحميل\n🖼️ ملفات PDF وصور تعليمية\n🔍 محتوى منظم حسب مستواك الدراسي",
    icon: "📚",
  },
  {
    id: 9,
    title: "رفع التكاليف",
    subtitle: "بكل سهولة وأمان",
    description:
      "📌 اختر المادة الدراسية من القائمة\n📎 ارفع ملف التكليف من جهازك\n🛡️ يتم فحص الملف من الفيروسات تلقائياً\n📤 يصلك تقييم المعلم مع ملاحظاته",
    icon: "📤",
  },
  {
    id: 10,
    title: "تقييم وتصدير الدرجات",
    subtitle: "نظام متكامل للمعلمين",
    description:
      "📥 استقبل تكاليف الطلاب وقيمها\n📊 ارفع ملف درجات (Excel - PDF - صورة)\n🤖 يحلل النظام الملف ويطابق الأسماء\n📢 تنشر الدرجات للطلاب فور اعتمادك",
    icon: "📊",
  },
  {
    id: 11,
    title: "أمان وحماية",
    subtitle: "بأعلى المعايير العالمية",
    description:
      "🔒 تشفير Argon2id لكلمات المرور\n🛡️ حماية CSRF و XSS و SQL Injection\n🔐 مصادقة ثنائية (2FA)\n🕵️ كشف التسلل والهجمات التلقائي",
    icon: "🛡️",
  },
  {
    id: 12,
    title: "هل أنت مستعد؟",
    subtitle: "رحلتك التعليمية تبدأ الآن",
    description:
      "كل شيء جاهز لاستقبالك\nانطلق في رحلتك مع سحابة الأمن السيبراني\nنتمنى لك التوفيق والنجاح",
    icon: "🚀",
  },
];

export default function OnboardingPage() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(1);
  const router = useRouter();

  const totalSlides = slides.length;
  const isLast = currentSlide === totalSlides - 1;

  const goToSlide = useCallback(
    (index: number) => {
      setDirection(index > currentSlide ? 1 : -1);
      setCurrentSlide(index);
    },
    [currentSlide],
  );

  const nextSlide = useCallback(() => {
    if (isLast) {
      localStorage.setItem("onboardingSeen", "true");
      setTimeout(() => {
        router.push("/login");
      }, 500);
    } else {
      goToSlide(currentSlide + 1);
    }
  }, [isLast, currentSlide, goToSlide, router]);

  const prevSlide = useCallback(() => {
    if (currentSlide > 0) goToSlide(currentSlide - 1);
  }, [currentSlide, goToSlide]);

  const handleSkip = () => {
    localStorage.setItem("onboardingSeen", "true");
    router.push("/login");
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") nextSlide();
      if (e.key === "ArrowLeft") prevSlide();
      if (e.key === "Escape") handleSkip();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [nextSlide, prevSlide]);

  const current = slides[currentSlide];

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 300 : -300,
      opacity: 0,
      scale: 0.9,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -300 : 300,
      opacity: 0,
      scale: 0.9,
    }),
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#010204",
        fontFamily: "'Cairo', sans-serif",
        color: "#fff",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* طبقات الخلفية */}
      <div className="absolute inset-0 quantum-grid z-0" />
      <MatrixRain />
      <NeonParticles />
      <ScanLine />

      {/* الكرة الأرضية في الخلفية */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          opacity: 0.25,
        }}
      >
        <OnboardingScene showCard={false} />
      </div>

      {/* هيدر علوي */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h2
          style={{
            color: "#00e5ff",
            fontSize: "clamp(0.9rem, 3vw, 1.1rem)",
            fontWeight: 700,
            margin: 0,
            textShadow: "0 0 15px rgba(0,229,255,0.4)",
          }}
        >
          جامعة ذمار - كلية الحاسبات
        </h2>

        <button
          onClick={handleSkip}
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: "25px",
            padding: "8px 18px",
            color: "#8b949e",
            cursor: "pointer",
            fontSize: "0.85rem",
            fontFamily: "'Cairo', sans-serif",
            fontWeight: 600,
            backdropFilter: "blur(10px)",
            transition: "all 0.3s",
          }}
        >
          تخطي ←
        </button>
      </div>

      {/* شريط التقدم */}
      <div
        style={{
          position: "absolute",
          top: "70px",
          left: "20px",
          right: "20px",
          zIndex: 50,
          display: "flex",
          gap: "6px",
          justifyContent: "center",
        }}
      >
        {slides.map((_, idx) => (
          <button
            key={idx}
            onClick={() => goToSlide(idx)}
            style={{
              height: "4px",
              borderRadius: "2px",
              border: "none",
              cursor: "pointer",
              transition: "all 0.4s ease",
              background:
                idx === currentSlide
                  ? "#00e5ff"
                  : idx < currentSlide
                    ? "rgba(0,229,255,0.4)"
                    : "rgba(255,255,255,0.15)",
              width: idx === currentSlide ? "28px" : "12px",
            }}
          />
        ))}
      </div>

      {/* المحتوى الرئيسي - عرض الجوال */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 40,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "100px 16px 120px",
        }}
      >
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentSlide}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.45, ease: "easeInOut" }}
            style={{
              width: "100%",
              maxWidth: "500px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
            }}
          >
            {/* الأيقونة */}
            <motion.div
              animate={{
                y: [0, -12, 0],
                scale: [1, 1.08, 1],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              style={{
                fontSize: "clamp(3.5rem, 12vw, 5rem)",
                marginBottom: "20px",
                filter: "drop-shadow(0 0 30px rgba(0,229,255,0.3))",
              }}
            >
              {current.icon}
            </motion.div>

            {/* العنوان */}
            <h1
              style={{
                color: "#00e5ff",
                fontSize: "clamp(1.3rem, 5vw, 2rem)",
                fontWeight: 900,
                margin: "0 0 6px",
                textShadow: "0 0 25px rgba(0,229,255,0.5)",
                lineHeight: 1.3,
              }}
            >
              {current.title}
            </h1>

            {/* العنوان الفرعي */}
            <p
              style={{
                color: "#bf5af2",
                fontSize: "clamp(0.75rem, 3vw, 0.9rem)",
                fontWeight: 600,
                margin: "0 0 16px",
                letterSpacing: "2px",
              }}
            >
              {current.subtitle}
            </p>

            {/* فاصل */}
            <div
              style={{
                width: "50px",
                height: "2px",
                background:
                  "linear-gradient(90deg, transparent, #00e5ff, transparent)",
                marginBottom: "20px",
              }}
            />

            {/* الوصف */}
            <div
              style={{
                background: "rgba(13,17,23,0.7)",
                backdropFilter: "blur(15px)",
                WebkitBackdropFilter: "blur(15px)",
                border: "1px solid rgba(48,54,61,0.5)",
                borderRadius: "18px",
                padding: "clamp(16px, 4vw, 24px)",
                width: "100%",
                boxSizing: "border-box",
              }}
            >
              {current.description.split("\n").map((line, i) => (
                <p
                  key={i}
                  style={{
                    color: "#e6edf3",
                    fontSize: "clamp(0.85rem, 3.5vw, 1rem)",
                    lineHeight: 1.9,
                    margin: "0 0 4px",
                    textAlign: "right",
                  }}
                >
                  {line}
                </p>
              ))}
            </div>

            {/* عداد الشرائح */}
            <p
              style={{
                color: "#8b949e",
                fontSize: "0.75rem",
                marginTop: "16px",
              }}
            >
              {currentSlide + 1} / {totalSlides}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* أزرار التنقل السفلية */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          padding: "16px 16px 28px",
          display: "flex",
          gap: "12px",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(to top, rgba(1,2,4,0.95) 0%, rgba(1,2,4,0.7) 60%, transparent 100%)",
        }}
      >
        {/* زر السابق */}
        <button
          onClick={prevSlide}
          disabled={currentSlide === 0}
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "14px",
            border: "1px solid rgba(255,255,255,0.1)",
            background:
              currentSlide === 0
                ? "rgba(255,255,255,0.02)"
                : "rgba(255,255,255,0.06)",
            color: currentSlide === 0 ? "#3a3f47" : "#8b949e",
            cursor: currentSlide === 0 ? "not-allowed" : "pointer",
            fontSize: "1.2rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'Cairo', sans-serif",
            transition: "all 0.3s",
            flexShrink: 0,
          }}
        >
          ←
        </button>

        {/* زر التالي / إنهاء */}
        <button
          onClick={nextSlide}
          style={{
            flex: 1,
            height: "52px",
            borderRadius: "14px",
            background: isLast
              ? "linear-gradient(135deg, #00e5ff, #007bff)"
              : "linear-gradient(135deg, rgba(0,229,255,0.2), rgba(0,229,255,0.05))",
            border: isLast ? "none" : "1px solid rgba(0,229,255,0.3)",
            color: isLast ? "#010204" : "#00e5ff",
            cursor: "pointer",
            fontSize: "1rem",
            fontWeight: 700,
            fontFamily: "'Cairo', sans-serif",
            boxShadow: isLast ? "0 8px 30px rgba(0,229,255,0.3)" : "none",
            transition: "all 0.3s",
          }}
        >
          {isLast ? "🚀 تسجيل الدخول" : "التالي →"}
        </button>
      </div>
    </main>
  );
}
