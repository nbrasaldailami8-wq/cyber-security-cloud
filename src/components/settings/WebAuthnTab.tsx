"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { startRegistration } from "@simplewebauthn/browser";
import { useToast } from "@/components/ui/Toast";

interface Props {
  webAuthnEnabled: boolean;
  onUpdate: () => void;
}

export default function WebAuthnTab({ webAuthnEnabled, onUpdate }: Props) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [showEnableConfirm, setShowEnableConfirm] = useState(false);

  const handleEnable = async () => {
    setLoading(true);
    setMessage("");
    try {
      const startRes = await fetch("/api/auth/webauthn/register/start", {
        method: "POST",
      });
      const startData = await startRes.json();
      if (!startData.success) throw new Error(startData.message);

      const regResponse = await startRegistration({
        optionsJSON: startData.options,
      });

      const completeRes = await fetch("/api/auth/webauthn/register/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(regResponse),
      });
      const completeData = await completeRes.json();
      if (!completeData.success) throw new Error(completeData.message);

      showToast("✅ تم تفعيل البصمة بنجاح", "success");
      onUpdate();
    } catch (err: any) {
      showToast(err.message || "فشل تفعيل البصمة", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = () => {
    setShowDisableConfirm(true);
  };

  const confirmDisable = async () => {
    setShowDisableConfirm(false);
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/settings/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "webauthn" }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("🔒 تم إيقاف الدخول بالبصمة", "warning");
        onUpdate();
      } else {
        showToast(data.message || "فشل الإيقاف", "error");
      }
    } catch {
      showToast("حدث خطأ في الاتصال", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        background: "rgba(22,27,34,0.6)",
        backdropFilter: "blur(15px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "16px",
        padding: "25px",
      }}
    >
      <h3
        style={{ color: "#00e5ff", marginBottom: "15px", fontSize: "1.1rem" }}
      >
        🖐️ الدخول بالبصمة (Passkey)
      </h3>

      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <div
          style={{
            width: "80px",
            height: "80px",
            borderRadius: "50%",
            background: webAuthnEnabled
              ? "rgba(46,160,67,0.15)"
              : "rgba(255,255,255,0.05)",
            border: `2px solid ${webAuthnEnabled ? "#2ea043" : "rgba(255,255,255,0.15)"}`,
            margin: "0 auto 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "2rem",
          }}
        >
          {webAuthnEnabled ? "✅" : "🖐️"}
        </div>
        <p
          style={{
            color: webAuthnEnabled ? "#2ea043" : "#8b949e",
            fontWeight: 600,
          }}
        >
          {webAuthnEnabled ? "البصمة مفعلة" : "البصمة غير مفعلة"}
        </p>
        <p style={{ color: "#8b949e", fontSize: "0.8rem", marginTop: "4px" }}>
          {webAuthnEnabled
            ? "يمكنك الدخول ببصمة إصبعك بدون إدخال البريد وكلمة المرور"
            : "فعّل البصمة للدخول السريع باستخدام إصبعك"}
        </p>
      </div>

      {message && (
        <p
          style={{
            color: "#ff3131",
            textAlign: "center",
            fontWeight: 600,
            marginBottom: "12px",
          }}
        >
          {message}
        </p>
      )}

      <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
        {!webAuthnEnabled ? (
          <>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowEnableConfirm(true)}
            disabled={loading}
            style={{
              padding: "12px 30px",
              background: "linear-gradient(135deg, #7a00ff, #a855f7)",
              color: "#fff",
              border: "none",
              borderRadius: "10px",
              fontWeight: 700,
              fontSize: "0.95rem",
              cursor: "pointer",
              fontFamily: "'Cairo', sans-serif",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "⏳ جاري التفعيل..." : "🖐️ تفعيل البصمة"}
          </motion.button>

          {/* نافذة تأكيد تفعيل البصمة */}
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
                  border: "1px solid rgba(168,85,247,0.3)", borderRadius: "24px",
                  padding: "30px", maxWidth: "420px", width: "100%",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "2.5rem", marginBottom: "15px" }}>⚠️</div>
                <h3 style={{ color: "#fff", fontSize: "1.2rem", fontWeight: 800, marginBottom: "8px" }}>
                  تفعيل الدخول بالبصمة
                </h3>
                <p style={{ color: "#ffca28", fontSize: "0.9rem", marginBottom: "10px", fontWeight: 600 }}>
                  سيتم تسجيل خروجك من جميع الأجهزة النشطة.
                </p>
                <p style={{ color: "#8b949e", fontSize: "0.85rem", marginBottom: "25px" }}>
                  هل أنت متأكد من تفعيل الدخول بالبصمة؟
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
                    onClick={() => { setShowEnableConfirm(false); handleEnable(); }}
                    style={{
                      flex: 1.5, padding: "13px", borderRadius: "12px",
                      background: "linear-gradient(135deg, #7a00ff, #a855f7)", border: "none",
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
          </>
        ) : (
          <>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleDisable}
            disabled={loading}
            style={{
              padding: "12px 30px",
              background: "rgba(248,81,73,0.1)",
              border: "1px solid rgba(248,81,73,0.3)",
              color: "#f85149",
              borderRadius: "10px",
              fontWeight: 700,
              fontSize: "0.95rem",
              cursor: "pointer",
              fontFamily: "'Cairo', sans-serif",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "⏳ جاري..." : "🔒 إيقاف البصمة"}
          </motion.button>

          {/* نافذة تأكيد إيقاف البصمة */}
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
                  إيقاف الدخول بالبصمة
                </h3>
                <p style={{ color: "#f85149", fontSize: "0.9rem", marginBottom: "10px", fontWeight: 600 }}>
                  سيتم تسجيل خروجك من جميع الأجهزة النشطة.
                </p>
                <p style={{ color: "#8b949e", fontSize: "0.85rem", marginBottom: "25px" }}>
                  هل أنت متأكد من إيقاف الدخول بالبصمة؟
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
                    نعم، إيقاف
                  </button>
                </div>
              </div>
            </div>
          )}
          </>
        )}
      </div>
    </div>
  );
}
