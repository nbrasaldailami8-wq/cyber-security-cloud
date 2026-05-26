"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { startRegistration } from "@simplewebauthn/browser";
import { useToast } from "@/components/ui/Toast";

interface Credential {
  id: string;
  credentialId: string;
  deviceName: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

interface Props {
  webAuthnEnabled: boolean;
  onUpdate: () => void;
}

export default function WebAuthnTab({ webAuthnEnabled, onUpdate }: Props) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [credentialsLoading, setCredentialsLoading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState<string | null>(null);
  const [showEnableConfirm, setShowEnableConfirm] = useState(false);
  const registerOptRef = useRef<any>(null);

  // تحضير خيارات التسجيل قبل النقرة (للحفاظ على user gesture)
  useEffect(() => {
    if (!showEnableConfirm) {
      registerOptRef.current = null;
      return;
    }
    fetch("/api/auth/webauthn/register/start", {
      method: "POST",
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          registerOptRef.current = data.options;
        }
      })
      .catch(() => {
        registerOptRef.current = null;
      });
  }, [showEnableConfirm]);

  const fetchCredentials = useCallback(async () => {
    setCredentialsLoading(true);
    try {
      const res = await fetch("/api/auth/webauthn/list");
      const data = await res.json();
      if (data.success) {
        setCredentials(data.credentials);
      }
    } catch {
      // silent
    } finally {
      setCredentialsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (webAuthnEnabled) {
      fetchCredentials();
    } else {
      setCredentials([]);
    }
  }, [webAuthnEnabled, fetchCredentials]);

  const handleEnable = () => {
    const options = registerOptRef.current;
    if (!options) {
      showToast("فشل تحضير بيانات البصمة، حاول مرة أخرى", "error");
      return;
    }

    setLoading(true);
    setMessage("");
    registerOptRef.current = null; // استخدام لمرة واحدة

    // استدعاء startRegistration بشكل متزامن مع النقرة
    startRegistration({ optionsJSON: options }).then(async (regResponse) => {
      const completeRes = await fetch("/api/auth/webauthn/register/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(regResponse),
      });
      const completeData = await completeRes.json();
      if (!completeData.success) throw new Error(completeData.message);

      showToast("✅ تم تفعيل البصمة بنجاح", "success");
      onUpdate();
    }).catch((err: any) => {
      showToast(err.message || "فشل تفعيل البصمة", "error");
    }).finally(() => {
      setLoading(false);
    });
  };

  const handleRemoveCredential = async (credentialId: string) => {
    setShowRemoveConfirm(null);
    setRemovingId(credentialId);
    setMessage("");
    try {
      const res = await fetch("/api/auth/webauthn/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentialId }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("🗑️ تم إلغاء البصمة بنجاح", "warning");
        await fetchCredentials();
        onUpdate();
      } else {
        showToast(data.message || "فشل إلغاء البصمة", "error");
      }
    } catch {
      showToast("حدث خطأ في الاتصال", "error");
    } finally {
      setRemovingId(null);
    }
  };

  const handleRemoveAll = async () => {
    setShowRemoveConfirm(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/webauthn/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revokeAll: true }),
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

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("ar-SA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getDeviceLabel = (cred: Credential) => {
    return cred.deviceName || `بصمة ${cred.credentialId.slice(0, 8)}...`;
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
          <div style={{ width: "100%" }}>
            {/* قائمة البصمات المسجلة */}
            {credentialsLoading ? (
              <p style={{ textAlign: "center", color: "#8b949e", fontSize: "0.85rem" }}>
                ⏳ جاري تحميل البصمات...
              </p>
            ) : credentials.length === 0 ? (
              <p style={{ textAlign: "center", color: "#8b949e", fontSize: "0.85rem" }}>
                لا توجد بصمات مسجلة حالياً
              </p>
            ) : (
              <div style={{ marginBottom: "16px" }}>
                <p style={{ color: "#8b949e", fontSize: "0.8rem", marginBottom: "10px", textAlign: "right" }}>
                  البصمات المسجلة ({credentials.length})
                </p>
                {credentials.map((cred) => (
                  <div
                    key={cred.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      marginBottom: "8px",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "12px",
                    }}
                  >
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: "#e6edf3", fontSize: "0.9rem", fontWeight: 600 }}>
                        {getDeviceLabel(cred)}
                      </div>
                      <div style={{ color: "#8b949e", fontSize: "0.75rem", marginTop: "2px" }}>
                        آخر استخدام: {formatDate(cred.lastUsedAt)}
                      </div>
                    </div>
                    <button
                      onClick={() => setShowRemoveConfirm(cred.credentialId)}
                      disabled={removingId === cred.credentialId}
                      title="إلغاء هذه البصمة"
                      style={{
                        padding: "8px 16px",
                        background: removingId === cred.credentialId
                          ? "rgba(248,81,73,0.05)"
                          : "rgba(248,81,73,0.1)",
                        border: "1px solid rgba(248,81,73,0.3)",
                        color: removingId === cred.credentialId ? "#8b949e" : "#f85149",
                        borderRadius: "8px",
                        fontWeight: 700,
                        fontSize: "0.8rem",
                        cursor: removingId === cred.credentialId ? "not-allowed" : "pointer",
                        fontFamily: "'Cairo', sans-serif",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {removingId === cred.credentialId ? "⏳" : "🗑️ حذف"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* زر إيقاف الكل */}
            {credentials.length > 1 && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowRemoveConfirm("__all__")}
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
                  width: "100%",
                }}
              >
                {loading ? "⏳ جاري..." : "🔒 إيقاف الكل"}
              </motion.button>
            )}

            {/* نافذة تأكيد حذف بصمة */}
            {showRemoveConfirm && (
              <div
                style={{
                  position: "fixed", inset: 0, zIndex: 500,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(0,0,0,0.8)", backdropFilter: "blur(10px)",
                  padding: "20px",
                }}
                onClick={() => setShowRemoveConfirm(null)}
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
                    {showRemoveConfirm === "__all__" ? "إيقاف جميع البصمات" : "حذف البصمة"}
                  </h3>
                  <p style={{ color: "#8b949e", fontSize: "0.85rem", marginBottom: "25px" }}>
                    {showRemoveConfirm === "__all__"
                      ? "هل أنت متأكد من إيقاف الدخول بالبصمة؟ ستبقى جلسة الدخول الحالية نشطة."
                      : "هل أنت متأكد من حذف هذه البصمة؟ ستبقى جلسة الدخول الحالية نشطة."}
                  </p>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      onClick={() => setShowRemoveConfirm(null)}
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
                      onClick={() => {
                        if (showRemoveConfirm === "__all__") {
                          handleRemoveAll();
                        } else {
                          handleRemoveCredential(showRemoveConfirm);
                        }
                      }}
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
          </div>
        )}
      </div>
    </div>
  );
}
