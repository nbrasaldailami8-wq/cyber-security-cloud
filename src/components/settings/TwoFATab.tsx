"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { csrfFetch } from "@/lib/csrfClient";

interface TwoFATabProps {
  twoFactorEnabled: boolean;
  onUpdate: () => void;
}

export default function TwoFATab({
  twoFactorEnabled,
  onUpdate,
}: TwoFATabProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [msgType, setMsgType] = useState<"success" | "error">("success");
  const [step, setStep] = useState<"idle" | "setup" | "verify">("idle");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verifyCode, setVerifyCode] = useState("");
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [showEnableConfirm, setShowEnableConfirm] = useState(false);

  const showMessage = (msg: string, type: "success" | "error") => {
    setMessage(msg);
    setMsgType(type);
    setTimeout(() => setMessage(""), 5000);
  };

  const handleSetup = async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await csrfFetch("/api/settings/2fa/setup", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setQrCode(data.data.qrCode);
        setSecret(data.data.secret);
        setBackupCodes(data.data.backupCodes);
        setStep("verify");
      } else {
        showMessage(data.message || "فشل الإعداد", "error");
      }
    } catch {
      showMessage("حدث خطأ في الاتصال", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!verifyCode) {
      showMessage("يرجى إدخال كود التحقق", "error");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const res = await csrfFetch("/api/settings/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: verifyCode }),
      });
      const data = await res.json();
      if (data.success) {
        showMessage("تم تفعيل المصادقة الثنائية بنجاح", "success");
        setStep("idle");
        setVerifyCode("");
        onUpdate();
      } else {
        showMessage(data.message || "الكود غير صحيح", "error");
      }
    } catch {
      showMessage("حدث خطأ في الاتصال", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    setShowDisableConfirm(true);
  };

  const confirmDisable = async () => {
    setShowDisableConfirm(false);
    setLoading(true);
    setMessage("");
    try {
      const res = await csrfFetch("/api/settings/2fa/disable", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        showMessage("تم إلغاء المصادقة الثنائية", "success");
        onUpdate();
      } else {
        showMessage(data.message || "فشل الإلغاء", "error");
      }
    } catch {
      showMessage("حدث خطأ في الاتصال", "error");
    } finally {
      setLoading(false);
    }
  };

  const resetSetup = () => {
    setStep("idle");
    setQrCode("");
    setSecret("");
    setBackupCodes([]);
    setVerifyCode("");
  };

  const pageStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  };

  const cardStyle: React.CSSProperties = {
    background: "rgba(22,27,34,0.6)",
    backdropFilter: "blur(15px)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "16px",
    padding: "25px",
  };

  const btnPrimary: React.CSSProperties = {
    padding: "12px 24px",
    background: "linear-gradient(135deg, #238636, #2ea043)",
    border: "none",
    borderRadius: "12px",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "'Cairo', sans-serif",
    fontSize: "0.95rem",
    opacity: loading ? 0.6 : 1,
  };

  const btnDanger: React.CSSProperties = {
    ...btnPrimary,
    background: "linear-gradient(135deg, #da3633, #f85149)",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px",
    background: "rgba(0,0,0,0.5)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "10px",
    color: "#fff",
    fontFamily: "'Cairo', sans-serif",
    fontSize: "1.2rem",
    textAlign: "center",
    letterSpacing: "4px",
    direction: "ltr",
    marginTop: "15px",
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h3 style={{ color: "#00e5ff", marginBottom: "15px", fontSize: "1.1rem" }}>
          المصادقة الثنائية (2FA)
        </h3>

        {message && (
          <div
            style={{
              background:
                msgType === "success"
                  ? "rgba(46,160,67,0.1)"
                  : "rgba(248,81,73,0.1)",
              border:
                msgType === "success"
                  ? "1px solid #2ea043"
                  : "1px solid #f85149",
              color: msgType === "success" ? "#2ea043" : "#f85149",
              padding: "12px",
              borderRadius: "12px",
              marginBottom: "15px",
              fontSize: "0.9rem",
            }}
          >
            {message}
          </div>
        )}

        {/* حالة 2FA مفعلة */}
        {twoFactorEnabled && step === "idle" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "15px",
                background: "rgba(46,160,67,0.1)",
                border: "1px solid rgba(46,160,67,0.3)",
                borderRadius: "12px",
              }}
            >
              <span style={{ fontSize: "1.5rem" }}>✅</span>
              <span style={{ color: "#2ea043", fontWeight: 600 }}>
                المصادقة الثنائية مفعلة - حسابك محمي
              </span>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleDisable}
              disabled={loading}
              style={btnDanger}
            >
              {loading ? "جاري الإلغاء..." : "إلغاء المصادقة الثنائية"}
            </motion.button>

            {/* نافذة تأكيد إلغاء 2FA */}
            {showDisableConfirm && (
              <div
                style={{
                  position: "fixed", inset: 0, zIndex: 500,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(0,0,0,0.8)", backdropFilter: "blur(10px)",
                  padding: "20px",
                }}
                onClick={() => setShowDisableConfirm(false)}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    background: "rgba(10,20,40,0.95)", backdropFilter: "blur(30px)",
                    border: "1px solid rgba(248,81,73,0.3)", borderRadius: "24px",
                    padding: "30px", maxWidth: "420px", width: "100%",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "2.5rem", marginBottom: "15px" }}>⚠️</div>
                  <h3 style={{ color: "#fff", fontSize: "1.2rem", fontWeight: 800, marginBottom: "8px" }}>
                    إلغاء المصادقة الثنائية
                  </h3>
                  <p style={{ color: "#f85149", fontSize: "0.9rem", marginBottom: "10px", fontWeight: 600 }}>
                    سيتم تسجيل خروجك من جميع الأجهزة النشطة.
                  </p>
                  <p style={{ color: "#8b949e", fontSize: "0.85rem", marginBottom: "25px" }}>
                    هل أنت متأكد من إلغاء المصادقة الثنائية؟ هذا سيقلل أمان حسابك.
                  </p>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      onClick={() => setShowDisableConfirm(false)}
                      style={{
                        flex: 1, padding: "13px", borderRadius: "12px",
                        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)",
                        color: "#8b949e", cursor: "pointer", fontWeight: 700,
                        fontFamily: "'Cairo', sans-serif", fontSize: "0.95rem",
                      }}
                    >
                      إلغاء
                    </button>
                    <button
                      onClick={confirmDisable}
                      style={{
                        flex: 1.5, padding: "13px", borderRadius: "12px",
                        background: "linear-gradient(135deg, #f85149, #da3633)", border: "none",
                        color: "#fff", cursor: "pointer", fontWeight: 800,
                        fontFamily: "'Cairo', sans-serif", fontSize: "0.95rem",
                      }}
                    >
                      نعم، إلغاء
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* حالة 2FA غير مفعلة - البداية */}
        {!twoFactorEnabled && step === "idle" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            <p style={{ color: "#8b949e", fontSize: "0.9rem" }}>
              المصادقة الثنائية تضيف طبقة حماية إضافية لحسابك. عند تفعيلها، ستحتاج
              إلى إدخال كود من تطبيق المصادقة (مثل Google Authenticator) بالإضافة
              إلى كلمة المرور عند تسجيل الدخول.
            </p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowEnableConfirm(true)}
              disabled={loading}
              style={btnPrimary}
            >
              {loading ? "جاري الإعداد..." : "تفعيل المصادقة الثنائية"}
            </motion.button>

            {/* نافذة تأكيد تفعيل 2FA */}
            {showEnableConfirm && (
              <div
                style={{
                  position: "fixed", inset: 0, zIndex: 500,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(0,0,0,0.8)", backdropFilter: "blur(10px)",
                  padding: "20px",
                }}
                onClick={() => setShowEnableConfirm(false)}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    background: "rgba(10,20,40,0.95)", backdropFilter: "blur(30px)",
                    border: "1px solid rgba(0,229,255,0.3)", borderRadius: "24px",
                    padding: "30px", maxWidth: "420px", width: "100%",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "2.5rem", marginBottom: "15px" }}>⚠️</div>
                  <h3 style={{ color: "#fff", fontSize: "1.2rem", fontWeight: 800, marginBottom: "8px" }}>
                    تفعيل المصادقة الثنائية
                  </h3>
                  <p style={{ color: "#ffca28", fontSize: "0.9rem", marginBottom: "10px", fontWeight: 600 }}>
                    سيتم تسجيل خروجك من جميع الأجهزة النشطة.
                  </p>
                  <p style={{ color: "#8b949e", fontSize: "0.85rem", marginBottom: "25px" }}>
                    هل أنت متأكد من تفعيل المصادقة الثنائية؟
                  </p>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      onClick={() => setShowEnableConfirm(false)}
                      style={{
                        flex: 1, padding: "13px", borderRadius: "12px",
                        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)",
                        color: "#8b949e", cursor: "pointer", fontWeight: 700,
                        fontFamily: "'Cairo', sans-serif", fontSize: "0.95rem",
                      }}
                    >
                      إلغاء
                    </button>
                    <button
                      onClick={() => { setShowEnableConfirm(false); handleSetup(); }}
                      style={{
                        flex: 1.5, padding: "13px", borderRadius: "12px",
                        background: "linear-gradient(135deg, #238636, #2ea043)", border: "none",
                        color: "#fff", cursor: "pointer", fontWeight: 800,
                        fontFamily: "'Cairo', sans-serif", fontSize: "0.95rem",
                      }}
                    >
                      نعم، تفعيل
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* مرحلة الإعداد - عرض QR والكود السري */}
        {step === "verify" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <p style={{ color: "#8b949e", fontSize: "0.9rem" }}>
              1. افتح تطبيق المصادقة (Google Authenticator)
              <br />
              2. امسح رمز QR أدناه أو أدخل الكود السري يدوياً
              <br />
              3. أدخل الكود الظاهر في التطبيق للتحقق
            </p>

            {qrCode && (
              <div style={{ textAlign: "center" }}>
                <img
                  src={qrCode}
                  alt="QR Code for 2FA"
                  style={{
                    width: "200px",
                    height: "200px",
                    borderRadius: "12px",
                    background: "#fff",
                    padding: "10px",
                  }}
                />
              </div>
            )}

            {secret && (
              <div
                style={{
                  background: "rgba(0,0,0,0.3)",
                  borderRadius: "10px",
                  padding: "12px",
                  textAlign: "center",
                  direction: "ltr",
                  fontFamily: "monospace",
                  fontSize: "0.9rem",
                  color: "#00e5ff",
                  wordBreak: "break-all",
                }}
              >
                {secret}
              </div>
            )}

            <div>
              <p style={{ color: "#ffca28", fontSize: "0.85rem", marginBottom: "8px" }}>
                ⚠️ أكواد الاسترجاع (احفظها في مكان آمن):
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: "8px",
                }}
              >
                {backupCodes.map((code, i) => (
                  <div
                    key={i}
                    style={{
                      background: "rgba(0,0,0,0.3)",
                      borderRadius: "8px",
                      padding: "8px",
                      textAlign: "center",
                      fontFamily: "monospace",
                      fontSize: "0.85rem",
                      color: "#8b949e",
                      direction: "ltr",
                    }}
                  >
                    {code}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p style={{ color: "#8b949e", fontSize: "0.85rem", marginBottom: "5px" }}>
                أدخل الكود من التطبيق للتحقق:
              </p>
              <input
                type="text"
                placeholder="000000"
                style={inputStyle}
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
                maxLength={6}
                autoFocus
              />
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={resetSetup}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: "12px",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: "12px",
                  background: "transparent",
                  color: "#8b949e",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "'Cairo', sans-serif",
                }}
              >
                إلغاء
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleVerify}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: loading
                    ? "rgba(0,229,255,0.3)"
                    : "linear-gradient(135deg, #238636, #2ea043)",
                  border: "none",
                  borderRadius: "12px",
                  color: "#fff",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "'Cairo', sans-serif",
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? "جاري التحقق..." : "تأكيد و تفعيل"}
              </motion.button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
