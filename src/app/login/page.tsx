"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import PageTransition from "@/components/layout/PageTransition";

import {
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import { useAuthStore } from "@/store/authStore";
import { useToast } from "@/components/ui/Toast";
import { registerPushNotifications } from "@/lib/pushClient";
// @ts-ignore
const OnboardingScene = dynamic(
  () => import("@/components/effects/OnboardingScene"),
  { ssr: false },
);
const OnboardingSceneMobile = dynamic(
  () => import("@/components/effects/OnboardingScene"),
  { ssr: false },
);

type Panel = "login" | "activate" | "forgot";
type ForgotStep = "email" | "code" | "newPassword";
type LoginStep = "credentials" | "twofa";

export default function LoginPage() {
  const router = useRouter();

  const setUser = useAuthStore((s) => s.setUser);
  const { showToast } = useToast();

  // حالة لوحة العرض
  const [panel, setPanel] = useState<Panel>("login");
  const [loginStep, setLoginStep] = useState<LoginStep>("credentials");
  const [twoFACode, setTwoFACode] = useState("");
  const [globeRight, setGlobeRight] = useState(false);

  // حقول تسجيل الدخول
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [clock, setClock] = useState("00:00:00 AM");

  // تفعيل البصمة بعد تسجيل الدخول
  const [showWebAuthnPrompt, setShowWebAuthnPrompt] = useState(false);
  const [pendingUser, setPendingUser] = useState<{
    id: string;
    email: string;
    name: string;
  } | null>(null);
  const [webAuthnRegistering, setWebAuthnRegistering] = useState(false);
  const [webAuthnDone, setWebAuthnDone] = useState(false);

  // Refs for pre-fetched WebAuthn options (preserve user gesture for WebAuthn API)
  const webAuthnLoginOptRef = useRef<any>(null);
  const webAuthnLoginUserIdRef = useRef<string | null>(null);
  const webAuthnRegOptRef = useRef<any>(null);

  // استعادة كلمة المرور
  const [forgotStep, setForgotStep] = useState<ForgotStep>("email");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotCode, setForgotCode] = useState("");
  const [forgotNewPass, setForgotNewPass] = useState("");
  const [forgotConfirmPass, setForgotConfirmPass] = useState("");

  // تفعيل الحساب
  const [activateCode, setActivateCode] = useState("");
  const [activateEmail, setActivateEmail] = useState("");
  const [activatePassword, setActivatePassword] = useState("");
  const [activateConfirm, setActivateConfirm] = useState("");
  const [showActivateHelp, setShowActivateHelp] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ==================== الساعة الرقمية ====================
  useEffect(() => {
    const update = () => {
      const now = new Date();
      let h = now.getHours();
      const m = now.getMinutes().toString().padStart(2, "0");
      const s = now.getSeconds().toString().padStart(2, "0");
      const ampm = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      setClock(`${h}:${m}:${s} ${ampm}`);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  // ==================== مطر الماتريكس ====================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);
    const chars = "01IO10ZxYyPpQq01αβγΔΣΦΩ01{}[]<>/\\01#$%@&01صدرفشبا01".split(
      "",
    );
    const fontSize = 16;
    const columns = Math.floor(w / fontSize);
    const drops: number[] = Array(columns).fill(0);
    const bgDrops: number[] = Array(Math.floor(w / (fontSize * 2))).fill(0);

    const draw = () => {
      ctx.fillStyle = "rgba(1, 4, 9, 0.08)";
      ctx.fillRect(0, 0, w, h);
      ctx.font = `${fontSize * 0.7}px "Courier New"`;
      for (let i = 0; i < bgDrops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        const x = i * fontSize * 2;
        const y = bgDrops[i] * fontSize * 0.7;
        ctx.fillStyle = "rgba(0, 229, 255, 0.15)";
        ctx.fillText(text, x, y);
        if (y > h && Math.random() > 0.98) bgDrops[i] = 0;
        bgDrops[i]++;
      }
      ctx.font = `${fontSize}px "Courier New"`;
      ctx.shadowBlur = 8;
      ctx.shadowColor = "#00e5ff";
      ctx.fillStyle = "#00e5ff";
      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;
        ctx.fillText(text, x, y);
        if (Math.random() > 0.96) {
          ctx.shadowColor = "#ffffff";
          ctx.fillStyle = "#ffffff";
          ctx.fillText(text, x, y);
          ctx.shadowColor = "#00e5ff";
          ctx.fillStyle = "#00e5ff";
        }
        if (y > h && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
      ctx.shadowBlur = 0;
      requestAnimationFrame(draw);
    };
    draw();
    const handleResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ==================== تحضير بصمة الدخول المسبق ====================
  // نجهّز خيارات WebAuthn فوراً عند تغيير البريد (قبل الضغط على زر البصمة)
  useEffect(() => {
    if (!username || username.length < 3) {
      webAuthnLoginOptRef.current = null;
      webAuthnLoginUserIdRef.current = null;
      return;
    }
    let cancelled = false;
    fetch("/api/auth/webauthn/login/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: username }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success) {
          webAuthnLoginOptRef.current = data.options;
          webAuthnLoginUserIdRef.current = data.userId;
        } else {
          webAuthnLoginOptRef.current = null;
          webAuthnLoginUserIdRef.current = null;
        }
      })
      .catch(() => {
        if (!cancelled) {
          webAuthnLoginOptRef.current = null;
          webAuthnLoginUserIdRef.current = null;
        }
      });
    return () => {
      cancelled = true;
    };
  }, [username]);

  // تحضير خيارات التسجيل المسبق للمستخدمين الجدد
  useEffect(() => {
    if (!showWebAuthnPrompt) {
      webAuthnRegOptRef.current = null;
      return;
    }
    fetch("/api/auth/webauthn/register/start", {
      method: "POST",
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          webAuthnRegOptRef.current = data.options;
        }
      })
      .catch(() => {
        webAuthnRegOptRef.current = null;
      });
  }, [showWebAuthnPrompt]);

  // ==================== تحضير بصمة الدخول التلقائي (لمن عنده جلسة سابقة) ====================
  useEffect(() => {
    if (!window.PublicKeyCredential) return;

    const storedEmail = localStorage.getItem("userEmail");
    if (!storedEmail) return;

    // نجهّز الخيارات للزر فقط (لا نستدعي startAuthentication بدون نقرة)
    fetch("/api/auth/webauthn/login/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: storedEmail }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          webAuthnLoginOptRef.current = data.options;
          webAuthnLoginUserIdRef.current = data.userId;
        }
      })
      .catch(() => {});
  }, []); // تشتغل مرة واحدة عند فتح الصفحة

  // ==================== التوجيه حسب الدور ====================
  const redirectToDashboard = (role: string) => {
    if (role === "ADMIN") router.push("/admin");
    else if (role === "MANAGEMENT") router.push("/management");
    else if (role === "TEACHER") router.push("/teacher");
    else router.push("/student");
  };

  // ==================== تفعيل الإشعارات ====================
  const tryEnablePush = () => {
    if (Notification.permission === "granted") {
      registerPushNotifications();
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((perm) => {
        if (perm === "granted") registerPushNotifications();
      });
    }
  };

  // ==================== تفعيل البصمة ====================
  const handleEnableWebAuthn = () => {
    if (!pendingUser) return;

    const options = webAuthnRegOptRef.current;
    if (!options) {
      setError("فشل تحضير بيانات البصمة، حاول مرة أخرى");
      return;
    }

    setWebAuthnRegistering(true);
    setError("");
    webAuthnRegOptRef.current = null; // استخدام لمرة واحدة

    // استدعاء startRegistration بشكل متزامن مع النقرة للحفاظ على user gesture
    startRegistration({ optionsJSON: options }).then(async (regResponse) => {
      const completeRes = await fetch("/api/auth/webauthn/register/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(regResponse),
      });
      const completeData = await completeRes.json();
      if (!completeData.success) throw new Error(completeData.message);

      setWebAuthnDone(true);
      tryEnablePush();
      setTimeout(() => {
        setShowWebAuthnPrompt(false);
        redirectToDashboard(localStorage.getItem("userRole") || "");
      }, 1500);
    }).catch((err: any) => {
      setError(err.message || "فشل تسجيل البصمة");
      setWebAuthnRegistering(false);
    });
  };

  const handleSkipWebAuthn = () => {
    setShowWebAuthnPrompt(false);
    tryEnablePush();
    redirectToDashboard(localStorage.getItem("userRole") || "");
  };

  // ==================== تبديل اللوحة ====================
  const switchPanel = (p: Panel) => {
    setGlobeRight(p !== "login");
    setPanel(p);
    setError("");
  };

  // ==================== تسجيل الدخول ====================
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          twoFactorToken: loginStep === "twofa" ? twoFACode : undefined,
        }),
      });
      const data = await res.json();

      // إذا كانت 2FA مطلوبة
      if (data.requiresTwoFactor) {
        setLoginStep("twofa");
        setLoading(false);
        return;
      }

      if (!res.ok) throw new Error(data.message || "فشل الدخول");
      setUser({
        id: data.user?.id || "",
        email: data.user?.email || data.email || "",
        name: data.user?.name || "",
        role: data.role,
        level: data.level || "",
        webAuthnEnabled: data.user?.webAuthnEnabled || false,
        managementLevel: data.user?.managementLevel || null,
      });
      // إذا المستخدم ما عنده بصمة مفعلة، اسأله
      if (data.user && !data.user.webAuthnEnabled) {
        setPendingUser({
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
        });
        setShowWebAuthnPrompt(true);
      } else {
        void tryEnablePush();
        redirectToDashboard(data.role);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ==================== استعادة كلمة المرور ====================
  const handleForgotPassword = async () => {
    setError("");
    if (forgotStep === "email") {
      if (!forgotEmail) return setError("يرجى إدخال البريد الإلكتروني");
      setLoading(true);
      try {
        const res = await fetch("/api/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: forgotEmail }),
        });
        const data = await res.json();
        if (data.success) {
          setForgotStep("code");
        } else {
          showToast(data.message || "فشل الإرسال", "error");
        }
      } catch {
        setError("حدث خطأ في الاتصال");
      } finally {
        setLoading(false);
      }
    } else if (forgotStep === "code") {
      if (!forgotCode) return setError("يرجى إدخال كود التحقق");
      setLoading(true);
      try {
        const res = await fetch("/api/auth/verify-reset-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: forgotEmail, code: forgotCode }),
        });
        const data = await res.json();
        if (data.status === "success") {
          setForgotStep("newPassword");
        } else {
          setError(data.message || "كود غير صحيح");
        }
      } catch {
        setError("حدث خطأ في الاتصال");
      } finally {
        setLoading(false);
      }
    } else if (forgotStep === "newPassword") {
      if (!forgotNewPass || forgotNewPass !== forgotConfirmPass) {
        return setError("كلمتا المرور غير متطابقتين");
      }
      setLoading(true);
      try {
        const res = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: forgotEmail,
            code: forgotCode,
            newPassword: forgotNewPass,
          }),
        });
        const data = await res.json();
        if (data.status === "success") {
          switchPanel("login");
          setForgotStep("email");
          setForgotEmail("");
          setForgotCode("");
          setForgotNewPass("");
          setForgotConfirmPass("");
          setTimeout(() => {
            showToast(
              "✅ تم تغيير كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول.",
              "success",
            );
          }, 300);
        } else {
          setError(data.message || "فشل التغيير");
        }
      } catch {
        setError("حدث خطأ في الاتصال");
      } finally {
        setLoading(false);
      }
    }
  };

  // ==================== تفعيل الحساب ====================
  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: activateCode,
          email: activateEmail,
          password: activatePassword,
          confirmPassword: activateConfirm,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // تخزين البيانات قبل المسح
        const savedEmail = activateEmail;
        const savedPassword = activatePassword;
        // مسح حقول التفعيل
        setActivateCode("");
        setActivateEmail("");
        setActivatePassword("");
        setActivateConfirm("");
        // ملء حقول تسجيل الدخول
        setUsername(savedEmail);
        setPassword(savedPassword);
        // التبديل إلى لوحة تسجيل الدخول
        setPanel("login");
        setGlobeRight(false);
        setTimeout(() => {
          showToast(
            "✅ تم تفعيل الحساب بنجاح. يمكنك الآن تسجيل الدخول.",
            "success",
          );
        }, 300);
      } else {
        setError(data.message || "فشل التفعيل");
      }
    } catch {
      setError("فشل الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  };

  // ==================== التنسيقات العامة ====================
  const glassPanelStyle: React.CSSProperties = {
    background: "rgba(10, 20, 40, 0.5)",
    backdropFilter: "blur(30px)",
    WebkitBackdropFilter: "blur(30px)",
    border: "1px solid rgba(0, 229, 255, 0.2)",
    borderRadius: "24px",
    padding: "clamp(25px, 4vw, 40px) clamp(20px, 4vw, 40px)",
    width: "100%",
    maxWidth: "430px",
    textAlign: "center",
    boxShadow: "0 0 60px rgba(0, 229, 255, 0.1), 0 20px 50px rgba(0,0,0,0.5)",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "13px 15px",
    marginBottom: "16px",
    background: "rgba(0, 0, 0, 0.5)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#fff",
    borderRadius: "14px",
    fontSize: "0.95rem",
    textAlign: "center",
    fontFamily: "'Cairo', sans-serif",
    transition: "all 0.3s ease",
  };

  const btnStyle: React.CSSProperties = {
    width: "100%",
    padding: "14px",
    color: "#fff",
    border: "none",
    borderRadius: "14px",
    fontWeight: 800,
    fontSize: "1rem",
    cursor: "pointer",
    fontFamily: "'Cairo', sans-serif",
    transition: "all 0.3s ease",
  };

  return (
    <PageTransition>
      <div
        style={{
          position: "relative",
          minHeight: "100vh",
          background: "#010204",
          fontFamily: "'Cairo', sans-serif",
          color: "#fff",
          overflow: "hidden",
        }}
      >
        {/* مطر الماتريكس */}
        <canvas
          ref={canvasRef}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            zIndex: 0,
            pointerEvents: "none",
          }}
        />

        {/* شبكة كمومية */}
        <div className="absolute inset-0 quantum-grid z-0" />

        {/* الكرة الأرضية - تتحرك يمين/يسار */}
        <motion.div
          animate={{
            left: globeRight ? "55%" : "5%",
            top: "50%",
            y: "-50%",
          }}
          transition={{
            duration: 0.8,
            type: "spring",
            stiffness: 70,
            damping: 16,
          }}
          className="absolute z-10 hidden lg:block pointer-events-none"
          style={{ width: "750px", height: "750px" }}
        >
          <div className="w-full h-full">
            <OnboardingScene showCard={false} />
          </div>
        </motion.div>

        {/* كرة للجوال - كبيرة وواضحة */}
        <div className="absolute inset-0 z-0 lg:hidden pointer-events-none">
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-[450px] h-[450px] opacity-40">
              <OnboardingSceneMobile showCard={false} />
            </div>
          </div>
        </div>

        {/* ==================== الهيدر ==================== */}
        <header
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 100,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 5%",
            background: "rgba(2, 4, 8, 0.75)",
            backdropFilter: "blur(25px)",
            WebkitBackdropFilter: "blur(25px)",
            borderBottom: "2px solid rgba(0, 229, 255, 0.3)",
            boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <div
            style={{
              fontFamily: "'Orbitron', sans-serif",
              fontSize: "clamp(1rem, 3vw, 1.8rem)",
              fontWeight: 700,
              color: "#00e5ff",
              textShadow: "0 0 15px #00e5ff, 0 0 30px rgba(0,229,255,0.4)",
              minWidth: "140px",
              direction: "ltr",
            }}
          >
            {clock}
          </div>

          <div style={{ textAlign: "center", flex: 1 }}>
            <h2
              style={{
                fontSize: "clamp(0.9rem, 2vw, 1.3rem)",
                fontWeight: 700,
                color: "#fff",
                textShadow: "0 0 15px #00e5ff, 0 0 30px rgba(0,229,255,0.4)",
                margin: 0,
              }}
            >
              سحابة الأمن السيبراني
            </h2>
            <p
              style={{
                fontFamily: "'Orbitron', sans-serif",
                fontSize: "clamp(0.6rem, 1.4vw, 0.85rem)",
                color: "#00e5ff",
                textTransform: "uppercase",
                letterSpacing: "2px",
                margin: "2px 0 0",
              }}
            >
              Cybersecurity Cloud
            </p>
          </div>

          <div style={{ textAlign: "right" }}>
            <h1
              style={{
                fontSize: "clamp(0.85rem, 2.5vw, 1.3rem)",
                color: "#fff",
                fontWeight: 900,
                textShadow: "0 0 10px rgba(0,229,255,0.3)",
                margin: 0,
              }}
            >
              جامعة ذمار - كلية الحاسبات
            </h1>
            <p
              style={{
                fontSize: "clamp(0.65rem, 1.8vw, 0.9rem)",
                color: "#00e5ff",
                fontFamily: "'Orbitron', sans-serif",
                fontWeight: 500,
                margin: "2px 0 0",
              }}
            >
              Cyber Security Department
            </p>
          </div>
        </header>

        {/* ==================== المحتوى الرئيسي ==================== */}
        <div
          style={{
            position: "relative",
            zIndex: 20,
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "100px 20px 80px",
          }}
        >
          <AnimatePresence mode="wait">
            {/* ========== لوحة تسجيل الدخول ========== */}
            {panel === "login" && (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: globeRight ? -80 : 80 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: globeRight ? -80 : 80 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                style={glassPanelStyle}
              >
                <h2
                  style={{
                    fontSize: "1.4rem",
                    fontWeight: 800,
                    marginBottom: 4,
                  }}
                >
                  مرحباً بكم في سحابة الأمن السيبراني
                </h2>
                <p
                  style={{
                    fontFamily: "'Orbitron', sans-serif",
                    fontSize: "0.85rem",
                    color: "#00e5ff",
                    letterSpacing: 1.5,
                    marginBottom: 15,
                  }}
                >
                  Welcome to Cyber Security Cloud
                </p>

                {error && (
                  <div
                    style={{
                      background: "rgba(248, 81, 73, 0.1)",
                      border: "1px solid #f85149",
                      color: "#f85149",
                      padding: "12px",
                      borderRadius: "12px",
                      marginBottom: "15px",
                      fontSize: "0.9rem",
                    }}
                  >
                    {error}
                  </div>
                )}

                <form onSubmit={handleLogin}>
                  <input
                    type="text"
                    placeholder="الاسم الرقمي (Username/Email)"
                    style={inputStyle}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                  <div style={{ position: "relative" }}>
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="مفتاح الدخول (Password)"
                      style={inputStyle}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <span
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: "absolute",
                        left: 12,
                        top: 12,
                        cursor: "pointer",
                        color: "#00e5ff",
                        fontSize: "1.2rem",
                        zIndex: 5,
                      }}
                    >
                      {showPassword ? "🔒" : "👁️"}
                    </span>
                  </div>

                  {/* حقل 2FA */}
                  {loginStep === "twofa" && (
                    <input
                      type="text"
                      placeholder="🔐 كود المصادقة الثنائية (Google Authenticator)"
                      style={{
                        ...inputStyle,
                        border: "1px solid rgba(255, 202, 40, 0.4)",
                      }}
                      value={twoFACode}
                      onChange={(e) => setTwoFACode(e.target.value)}
                      autoFocus
                      required
                    />
                  )}

                  {/* زران متجاوران */}
                  <div style={{ display: "flex", gap: "10px" }}>
                    {/* زر البصمة */}
                    <button
                      type="button"
                      onClick={() => {
                        const options = webAuthnLoginOptRef.current;
                        const userId = webAuthnLoginUserIdRef.current;
                        if (!options || !userId) {
                          setError("الرجاء إدخال البريد الإلكتروني أولاً");
                          return;
                        }

                        setLoading(true);
                        setError("");
                        webAuthnLoginOptRef.current = null;
                        webAuthnLoginUserIdRef.current = null;

                        // استدعاء startAuthentication بشكل متزامن مع النقرة
                        startAuthentication({ optionsJSON: options }).then(async (authResponse) => {
                          const completeRes = await fetch(
                            "/api/auth/webauthn/login/complete",
                            {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ userId, authResponse }),
                            },
                          );
                          const completeData = await completeRes.json();
                          if (!completeData.success)
                            throw new Error(completeData.message);
                          setUser({
                            id: userId || "",
                            email: completeData.email || "",
                            name: completeData.name || "",
                            role: completeData.role,
                            level: completeData.level || "",
                            webAuthnEnabled: true,
                          });
                          if (completeData.role === "ADMIN")
                            router.push("/admin");
                          else if (completeData.role === "MANAGEMENT")
                            router.push("/management");
                          else if (completeData.role === "TEACHER")
                            router.push("/teacher");
                          else router.push("/student");
                        }).catch((err: any) => {
                          setError(err.message || "فشل الدخول بالبصمة");
                        }).finally(() => {
                          setLoading(false);
                        });
                      }}
                      disabled={loading}
                      title="دخول بالبصمة"
                      style={{
                        width: "50px",
                        height: "50px",
                        padding: "0",
                        color: "#fff",
                        border: "1px solid rgba(122, 0, 255, 0.5)",
                        borderRadius: "14px",
                        fontWeight: 800,
                        fontSize: "1.2rem",
                        cursor: "pointer",
                        fontFamily: "'Cairo', sans-serif",
                        background: "rgba(122, 0, 255, 0.15)",
                        backdropFilter: "blur(10px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: loading ? 0.6 : 1,
                      }}
                    >
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        {/* خلفية البصمة */}
                        <rect
                          x="4"
                          y="2"
                          width="16"
                          height="20"
                          rx="4"
                          strokeWidth="1.2"
                          opacity="0.4"
                        />
                        {/* خطوط البصمة */}
                        <path d="M8 9c0-2.21 1.79-4 4-4s4 1.79 4 4" />
                        <path
                          d="M7 11c0-2.76 2.24-5 5-5s5 2.24 5 5"
                          opacity="0.8"
                        />
                        <path
                          d="M9 12c0-1.66 1.34-3 3-3s3 1.34 3 3"
                          opacity="0.6"
                        />
                        <path d="M8 15c0-2.21 1.79-4 4-4s4 1.79 4 4" />
                        <path
                          d="M9 17c0-1.66 1.34-3 3-3s3 1.34 3 3"
                          opacity="0.8"
                        />
                        <path d="M10 18.5c0-.83.67-1.5 1.5-1.5h1c.83 0 1.5.67 1.5 1.5" />
                        {/* نقطة البصمة المركزية */}
                        <circle
                          cx="12"
                          cy="18.5"
                          r="1.5"
                          fill="currentColor"
                          stroke="none"
                        />
                      </svg>
                    </button>

                    {/* زر تسجيل الدخول */}
                    <button
                      type="submit"
                      disabled={loading}
                      style={{
                        flex: 1,
                        padding: "14px",
                        color: "#fff",
                        border: "none",
                        borderRadius: "14px",
                        fontWeight: 800,
                        fontSize: "1rem",
                        cursor: "pointer",
                        fontFamily: "'Cairo', sans-serif",
                        background: "linear-gradient(135deg, #238636, #2ea043)",
                        boxShadow: "0 6px 25px rgba(35,134,54,0.35)",
                        opacity: loading ? 0.6 : 1,
                      }}
                    >
                      {loading
                        ? "⏳ جاري التحقق..."
                        : loginStep === "twofa"
                          ? "تأكيد الكود"
                          : "تسجيل الدخول"}
                    </button>
                  </div>
                </form>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: 20,
                    marginTop: 20,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    onClick={() => switchPanel("activate")}
                    style={{
                      color: "#00e5ff",
                      textDecoration: "none",
                      fontSize: "0.85rem",
                      padding: "6px 14px",
                      borderRadius: "20px",
                      background: "rgba(0,229,255,0.06)",
                      border: "1px solid rgba(0,229,255,0.2)",
                      cursor: "pointer",
                    }}
                  >
                    تفعيل الحساب
                  </span>
                  <span
                    onClick={() => switchPanel("forgot")}
                    style={{
                      color: "#00e5ff",
                      textDecoration: "none",
                      fontSize: "0.85rem",
                      padding: "6px 14px",
                      borderRadius: "20px",
                      background: "rgba(0,229,255,0.06)",
                      border: "1px solid rgba(0,229,255,0.2)",
                      cursor: "pointer",
                    }}
                  >
                    نسيت كلمة المرور
                  </span>
                </div>
              </motion.div>
            )}

            {/* ========== لوحة تفعيل الحساب ========== */}
            {panel === "activate" && (
              <motion.div
                key="activate"
                initial={{ opacity: 0, x: -80 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -80 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                style={glassPanelStyle}
              >
                <h2
                  style={{
                    color: "#00e5ff",
                    fontSize: "1.3rem",
                    marginBottom: 15,
                  }}
                >
                  تفعيل الحساب
                </h2>
                {/* أيقونة المساعدة */}
                <div style={{ textAlign: "left", marginBottom: "8px" }}>
                  <span
                    onClick={() => setShowActivateHelp(!showActivateHelp)}
                    style={{
                      cursor: "pointer",
                      fontSize: "1.2rem",
                      color: "#ffca28",
                    }}
                    title="كيفية التفعيل"
                  >
                    خطوات تفعيل الحساب
                  </span>
                </div>

                {/* تعليمات التفعيل */}
                {showActivateHelp && (
                  <div
                    style={{
                      background: "rgba(255,202,40,0.08)",
                      border: "1px solid rgba(255,202,40,0.25)",
                      borderRadius: "12px",
                      padding: "12px 14px",
                      marginBottom: "15px",
                      fontSize: "0.8rem",
                      color: "#e6edf3",
                      textAlign: "right",
                      lineHeight: 1.8,
                    }}
                  >
                    <p
                      style={{
                        margin: "0 0 8px",
                        fontWeight: 700,
                        color: "#ffca28",
                      }}
                    >
                      📋 خطوات تفعيل الحساب:
                    </p>
                    <p style={{ margin: "0 0 4px" }}>
                      1️⃣ أدخل <strong>كود تفعيل الحساب</strong> المرسل إليك.
                    </p>
                    <p style={{ margin: "0 0 4px" }}>
                      2️⃣ أدخل <strong>الإيميل الخاص بك</strong> حتى نتمكن من
                      إرسال كود استعادة كلمة المرور في حال نسيتها. يمكنك إنشاء
                      إيميل جديد وإدخاله للحفاظ على خصوصيتك.
                    </p>
                    <p style={{ margin: 0 }}>
                      3️⃣ أدخل <strong>كلمة مرور قوية</strong> تتكون من أحرف
                      كبيرة وصغيرة وأرقام.
                    </p>
                  </div>
                )}

                {error && (
                  <div
                    style={{
                      background: "rgba(248, 81, 73, 0.1)",
                      border: "1px solid #f85149",
                      color: "#f85149",
                      padding: "12px",
                      borderRadius: "12px",
                      marginBottom: "15px",
                      fontSize: "0.9rem",
                    }}
                  >
                    {error}
                  </div>
                )}

                <form onSubmit={handleActivate}>
                  <input
                    type="text"
                    placeholder="كود التفعيل"
                    style={inputStyle}
                    value={activateCode}
                    onChange={(e) => setActivateCode(e.target.value)}
                    required
                  />
                  <input
                    type="email"
                    placeholder="البريد الإلكتروني الحقيقي (example@gmail.com)"
                    style={inputStyle}
                    value={activateEmail}
                    onChange={(e) => setActivateEmail(e.target.value)}
                    pattern="[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"
                    title="يرجى إدخال بريد إلكتروني حقيقي مثل example@gmail.com"
                    required
                  />
                  <input
                    type="password"
                    placeholder="كلمة المرور الجديدة"
                    style={inputStyle}
                    value={activatePassword}
                    onChange={(e) => setActivatePassword(e.target.value)}
                    required
                  />
                  <input
                    type="password"
                    placeholder="تأكيد كلمة المرور"
                    style={inputStyle}
                    value={activateConfirm}
                    onChange={(e) => setActivateConfirm(e.target.value)}
                    required
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      ...btnStyle,
                      background: "linear-gradient(135deg, #238636, #2ea043)",
                      boxShadow: "0 6px 25px rgba(35,134,54,0.35)",
                      opacity: loading ? 0.6 : 1,
                    }}
                  >
                    {loading ? "⏳ جاري التفعيل..." : "تفعيل الحساب"}
                  </button>
                </form>

                <span
                  onClick={() => switchPanel("login")}
                  style={{
                    display: "inline-block",
                    marginTop: 15,
                    color: "#00e5ff",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    padding: "6px 14px",
                    borderRadius: "20px",
                    background: "rgba(0,229,255,0.06)",
                    border: "1px solid rgba(0,229,255,0.2)",
                  }}
                >
                  ← العودة إلى تسجيل الدخول
                </span>
              </motion.div>
            )}

            {/* ========== لوحة استعادة كلمة المرور ========== */}
            {panel === "forgot" && (
              <motion.div
                key="forgot"
                initial={{ opacity: 0, x: -80 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -80 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                style={glassPanelStyle}
              >
                <h3
                  style={{
                    color: "#00e5ff",
                    marginBottom: 15,
                    fontSize: "1.2rem",
                  }}
                >
                  {forgotStep === "email"
                    ? "استعادة كلمة المرور"
                    : forgotStep === "code"
                      ? "إدخال كود التحقق"
                      : "كلمة مرور جديدة"}
                </h3>

                {error && (
                  <div
                    style={{
                      background: "rgba(248, 81, 73, 0.1)",
                      border: "1px solid #f85149",
                      color: "#f85149",
                      padding: "12px",
                      borderRadius: "12px",
                      marginBottom: "15px",
                      fontSize: "0.9rem",
                    }}
                  >
                    {error}
                  </div>
                )}

                {forgotStep === "email" && (
                  <>
                    <p
                      style={{
                        color: "#8b949e",
                        fontSize: "0.85rem",
                        marginBottom: 15,
                      }}
                    >
                      أدخل بريدك الإلكتروني لإرسال كود التحقق
                    </p>
                    <input
                      type="email"
                      placeholder="البريد الإلكتروني"
                      style={inputStyle}
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                    />
                    <button
                      onClick={handleForgotPassword}
                      disabled={loading}
                      style={{
                        ...btnStyle,
                        background: "linear-gradient(135deg, #2188ff, #0066cc)",
                        boxShadow: "0 6px 25px rgba(33,136,255,0.35)",
                        opacity: loading ? 0.6 : 1,
                      }}
                    >
                      {loading ? "⏳ جاري الإرسال..." : "إرسال كود التحقق"}
                    </button>
                    <p
                      style={{
                        color: "#5a6a7a",
                        fontSize: "0.75rem",
                        marginTop: 10,
                      }}
                    >
                      تحقق من صندوق الوارد والبريد المزعج
                    </p>
                  </>
                )}

                {forgotStep === "code" && (
                  <>
                    <input
                      type="text"
                      placeholder="كود التحقق"
                      style={inputStyle}
                      value={forgotCode}
                      onChange={(e) => setForgotCode(e.target.value)}
                      required
                    />
                    <button
                      onClick={handleForgotPassword}
                      disabled={loading}
                      style={{
                        ...btnStyle,
                        background: "linear-gradient(135deg, #2188ff, #0066cc)",
                        boxShadow: "0 6px 25px rgba(33,136,255,0.35)",
                        opacity: loading ? 0.6 : 1,
                      }}
                    >
                      {loading ? "⏳ جاري التحقق..." : "تحقق من الكود"}
                    </button>
                    <button
                      onClick={async () => {
                        setLoading(true);
                        setError("");
                        try {
                          const res = await fetch("/api/auth/forgot-password", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              email: forgotEmail,
                            }),
                          });
                          const data = await res.json();
                          if (data.status === "success" || data.success) {
                            alert("📧 تم إعادة إرسال كود التحقق إلى بريدك");
                          } else {
                            setError(data.message || "فشل الإرسال");
                          }
                        } catch {
                          setError("حدث خطأ في الاتصال");
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading}
                      style={{
                        ...btnStyle,
                        background: "transparent",
                        border: "1px solid rgba(255,202,40,0.3)",
                        boxShadow: "none",
                        color: "#ffca28",
                        opacity: loading ? 0.6 : 1,
                        marginTop: "8px",
                      }}
                    >
                      {loading ? "⏳ جاري..." : "🔄 إعادة إرسال الكود"}
                    </button>
                  </>
                )}

                {forgotStep === "newPassword" && (
                  <>
                    <input
                      type="password"
                      placeholder="كلمة المرور الجديدة"
                      style={inputStyle}
                      value={forgotNewPass}
                      onChange={(e) => setForgotNewPass(e.target.value)}
                      required
                    />
                    <input
                      type="password"
                      placeholder="تأكيد كلمة المرور الجديدة"
                      style={inputStyle}
                      value={forgotConfirmPass}
                      onChange={(e) => setForgotConfirmPass(e.target.value)}
                      required
                    />
                    <button
                      onClick={handleForgotPassword}
                      disabled={loading}
                      style={{
                        ...btnStyle,
                        background: "linear-gradient(135deg, #2188ff, #0066cc)",
                        boxShadow: "0 6px 25px rgba(33,136,255,0.35)",
                        opacity: loading ? 0.6 : 1,
                      }}
                    >
                      {loading ? "⏳ جاري الحفظ..." : "حفظ كلمة المرور"}
                    </button>
                  </>
                )}

                <span
                  onClick={() => {
                    switchPanel("login");
                    setForgotStep("email");
                    setForgotEmail("");
                    setForgotCode("");
                    setForgotNewPass("");
                    setForgotConfirmPass("");
                  }}
                  style={{
                    display: "inline-block",
                    marginTop: 15,
                    color: "#00e5ff",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    padding: "6px 14px",
                    borderRadius: "20px",
                    background: "rgba(0,229,255,0.06)",
                    border: "1px solid rgba(0,229,255,0.2)",
                  }}
                >
                  ← العودة إلى تسجيل الدخول
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ==================== نافذة تفعيل البصمة ==================== */}
        {showWebAuthnPrompt && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 200,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.7)",
              backdropFilter: "blur(8px)",
              padding: 20,
            }}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              style={{
                background: "rgba(10, 20, 40, 0.95)",
                backdropFilter: "blur(30px)",
                border: "1px solid rgba(0, 229, 255, 0.25)",
                borderRadius: "24px",
                padding: "clamp(25px, 4vw, 40px)",
                maxWidth: "430px",
                width: "100%",
                textAlign: "center",
                boxShadow: "0 0 80px rgba(0, 229, 255, 0.15)",
              }}
            >
              {webAuthnDone ? (
                <>
                  <div style={{ fontSize: "3rem", marginBottom: 15 }}>✅</div>
                  <h3
                    style={{
                      color: "#39ff14",
                      marginBottom: 8,
                      fontSize: "1.3rem",
                    }}
                  >
                    تم تفعيل البصمة بنجاح!
                  </h3>
                  <p style={{ color: "#8b949e", fontSize: "0.9rem" }}>
                    يمكنك الآن الدخول ببصمة إصبعك في المرة القادمة
                  </p>
                </>
              ) : (
                <>
                  <div
                    style={{
                      width: 70,
                      height: 70,
                      margin: "0 auto 15px",
                      borderRadius: "50%",
                      background: "rgba(122, 0, 255, 0.15)",
                      border: "2px solid rgba(122, 0, 255, 0.4)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg
                      width="36"
                      height="36"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#a855f7"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M8 9c0-2.21 1.79-4 4-4s4 1.79 4 4" />
                      <path
                        d="M7 11c0-2.76 2.24-5 5-5s5 2.24 5 5"
                        opacity="0.8"
                      />
                      <path
                        d="M9 12c0-1.66 1.34-3 3-3s3 1.34 3 3"
                        opacity="0.6"
                      />
                      <path d="M8 15c0-2.21 1.79-4 4-4s4 1.79 4 4" />
                      <path d="M10 18.5c0-.83.67-1.5 1.5-1.5h1c.83 0 1.5.67 1.5 1.5" />
                      <circle
                        cx="12"
                        cy="18.5"
                        r="1.5"
                        fill="currentColor"
                        stroke="none"
                      />
                    </svg>
                  </div>
                  <h3
                    style={{
                      color: "#fff",
                      marginBottom: 8,
                      fontSize: "1.3rem",
                    }}
                  >
                    تفعيل الدخول بالبصمة
                  </h3>
                  <p
                    style={{
                      color: "#8b949e",
                      fontSize: "0.9rem",
                      marginBottom: 25,
                    }}
                  >
                    هل تريد تفعيل الدخول السريع باستخدام بصمة إصبعك؟
                    <br />
                    <span style={{ fontSize: "0.8rem", color: "#5a6a7a" }}>
                      (Passkey - متوافق مع Windows Hello و Touch ID)
                    </span>
                  </p>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      onClick={handleSkipWebAuthn}
                      disabled={webAuthnRegistering}
                      style={{
                        flex: 1,
                        padding: "14px",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: "14px",
                        background: "transparent",
                        color: "#8b949e",
                        fontWeight: 700,
                        fontSize: "0.95rem",
                        cursor: "pointer",
                        fontFamily: "'Cairo', sans-serif",
                      }}
                    >
                      ليس الآن
                    </button>
                    <button
                      onClick={handleEnableWebAuthn}
                      disabled={webAuthnRegistering}
                      style={{
                        flex: 1,
                        padding: "14px",
                        border: "none",
                        borderRadius: "14px",
                        background: webAuthnRegistering
                          ? "rgba(122, 0, 255, 0.3)"
                          : "linear-gradient(135deg, #7a00ff, #a855f7)",
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: "0.95rem",
                        cursor: "pointer",
                        fontFamily: "'Cairo', sans-serif",
                        opacity: webAuthnRegistering ? 0.7 : 1,
                      }}
                    >
                      {webAuthnRegistering
                        ? "⏳ جاري التسجيل..."
                        : "نعم، فعّل البصمة"}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}

        {/* ==================== الفوتر ==================== */}
        <footer
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 50,
            padding: "8px",
            textAlign: "center",
            background: "rgba(2, 4, 8, 0.75)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderTop: "1px solid rgba(0, 229, 255, 0.15)",
            fontSize: "clamp(0.65rem, 1.3vw, 0.8rem)",
            color: "#bbb",
          }}
        >
          <div>
            تطوير وإشراف:{" "}
            <span style={{ color: "#00e5ff", fontWeight: "bold" }}>
              محمد إبراهيم الديلمي | أحمد الهيدمة
            </span>
          </div>
          <div
            style={{
              fontFamily: "'Orbitron', sans-serif",
              fontSize: "0.65rem",
              opacity: 0.6,
              marginTop: "3px",
            }}
          >
            OFFICIAL CYBER SECURITY PLATFORM - DHAMAR UNIVERSITY &copy; 2026
          </div>
        </footer>
      </div>
    </PageTransition>
  );
}
