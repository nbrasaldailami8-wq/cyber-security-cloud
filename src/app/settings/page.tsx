"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import PageTransition from "@/components/layout/PageTransition";

import TwoFATab from "@/components/settings/TwoFATab";
import { useToast } from "@/components/ui/Toast";
import WebAuthnTab from "@/components/settings/WebAuthnTab";
import { csrfFetch } from "@/lib/csrfClient";

interface ProfileData {
  id: string;
  name: string;
  email: string;
  role: string;
  level: string | null;
  status: string;
  isActivated: boolean;
  twoFactorEnabled: boolean;
  webAuthnEnabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  stats: { assignmentsCount: number };
}

const tabs = [
  "الملف الشخصي",
  "تغيير كلمة المرور",
  "تعديل البيانات",
  "المصادقة الثنائية",
  "الدخول بالبصمة",
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState(0);
  const { showToast } = useToast();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordMsgType, setPasswordMsgType] = useState<"success" | "error">(
    "success",
  );

  const [newName, setNewName] = useState("");
  const [nameMsg, setNameMsg] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailMsg, setEmailMsg] = useState("");

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/settings/profile");
      const data = await res.json();
      if (data.success) setProfile(data.user || data.data);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    setPasswordMsg("");
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMsg("جميع الحقول مطلوبة");
      setPasswordMsgType("error");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg("كلمة المرور الجديدة غير متطابقة مع التأكيد");
      setPasswordMsgType("error");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg("كلمة المرور الجديدة قصيرة جداً");
      setPasswordMsgType("error");
      return;
    }
    try {
      const res = await csrfFetch("/api/settings/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setPasswordMsg("تم تغيير كلمة المرور بنجاح");
        setPasswordMsgType("success");
        showToast("✅ تم تغيير كلمة المرور بنجاح", "success");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setPasswordMsg(data.message);
        setPasswordMsgType("error");
      }
    } catch {
      setPasswordMsg("حدث خطأ في الاتصال");
      setPasswordMsgType("error");
    }
  };

  const handleNameRequest = async () => {
    setNameMsg("");
    if (!newName || newName.trim().length < 2) {
      setNameMsg("الاسم الجديد غير صالح");
      return;
    }
    try {
      const res = await csrfFetch("/api/settings/change-name-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newName: newName.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setNameMsg("تم إرسال طلب تغيير الاسم");
        showToast("✅ تم إرسال طلب تغيير الاسم", "success");
        setNewName("");
      } else {
        setNameMsg(data.message);
      }
    } catch {
      setNameMsg("حدث خطأ في الاتصال");
    }
  };

  const handleEmailRequest = async () => {
    setEmailMsg("");
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      setEmailMsg("البريد الإلكتروني غير صالح");
      return;
    }
    try {
      const res = await csrfFetch("/api/settings/change-email-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newEmail }),
      });
      const data = await res.json();
      if (data.success) {
        setEmailMsg("تم إرسال طلب تغيير البريد الإلكتروني");
        showToast("✅ تم إرسال طلب تغيير البريد", "success");
        setNewEmail("");
      } else {
        setEmailMsg(data.message);
      }
    } catch {
      setEmailMsg("حدث خطأ في الاتصال");
    }
  };

  const roleLabel = (role: string) => {
    switch (role) {
      case "ADMIN":
        return "أدمن";
      case "MANAGEMENT":
        return "إدارة";
      case "TEACHER":
        return "معلم";
      default:
        return "طالب";
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "نشط";
      case "PENDING":
        return "قيد الانتظار";
      case "LOCKED":
        return "مقفل";
      case "SUSPENDED":
        return "موقوف";
      default:
        return status;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "#2ea043";
      case "PENDING":
        return "#f0883e";
      case "LOCKED":
        return "#ff3131";
      case "SUSPENDED":
        return "#ff3131";
      default:
        return "#8b949e";
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#010204",
        fontFamily: "'Cairo', sans-serif",
        color: "#fff",
      }}
    >
      <Header />
      <Sidebar />
      <PageTransition>
        <main
          style={{
            padding: "100px 20px 60px",
            maxWidth: "900px",
            margin: "0 auto",
          }}
        >
          <h2
            style={{
              color: "#00e5ff",
              fontSize: "1.8rem",
              fontWeight: 800,
              marginBottom: "25px",
            }}
          >
            ⚙️ إعدادات الحساب
          </h2>

          <div
            style={{
              display: "flex",
              gap: "10px",
              marginBottom: "25px",
              flexWrap: "wrap",
            }}
          >
            {tabs.map((tab, i) => (
              <motion.button
                key={i}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab(i)}
                style={{
                  padding: "10px 24px",
                  borderRadius: "12px",
                  border:
                    activeTab === i
                      ? "1px solid #00e5ff"
                      : "1px solid rgba(255,255,255,0.1)",
                  background:
                    activeTab === i ? "rgba(0,229,255,0.1)" : "transparent",
                  color: activeTab === i ? "#00e5ff" : "#8b949e",
                  cursor: "pointer",
                  fontFamily: "'Cairo', sans-serif",
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  transition: "all 0.3s",
                }}
              >
                {tab}
              </motion.button>
            ))}
          </div>

          {activeTab === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {loading ? (
                <p style={{ textAlign: "center", color: "#8b949e" }}>
                  ⏳ جاري التحميل...
                </p>
              ) : profile ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "20px",
                  }}
                >
                  <div
                    style={{
                      background: "rgba(22,27,34,0.6)",
                      backdropFilter: "blur(15px)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "16px",
                      padding: "25px",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fill, minmax(200px, 1fr))",
                        gap: "20px",
                      }}
                    >
                      {[
                        { label: "الاسم", value: profile.name },
                        { label: "البريد الإلكتروني", value: profile.email },
                        { label: "الدور", value: roleLabel(profile.role) },
                        {
                          label: "المستوى",
                          value: profile.level
                            ? profile.level === "LEVEL_1"
                              ? "المستوى الأول"
                              : "المستوى الثاني"
                            : "—",
                        },
                        {
                          label: "الحالة",
                          value: statusLabel(profile.status),
                          color: statusColor(profile.status),
                        },
                        {
                          label: "تاريخ التسجيل",
                          value: new Date(profile.createdAt).toLocaleDateString(
                            "ar-YE",
                          ),
                        },
                        {
                          label: "آخر تسجيل دخول",
                          value: profile.lastLoginAt
                            ? new Date(profile.lastLoginAt).toLocaleDateString(
                                "ar-YE",
                              )
                            : "—",
                        },
                      ].map((item, i) => (
                        <div key={i}>
                          <p
                            style={{
                              color: "#8b949e",
                              fontSize: "0.8rem",
                              marginBottom: "4px",
                            }}
                          >
                            {item.label}
                          </p>
                          <p
                            style={{
                              color: (item as any).color || "#fff",
                              fontWeight: 700,
                              fontSize: "1rem",
                            }}
                          >
                            {item.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

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
                      style={{
                        color: "#00e5ff",
                        marginBottom: "15px",
                        fontSize: "1.1rem",
                      }}
                    >
                      📊 الإحصائيات
                    </h3>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fill, minmax(150px, 1fr))",
                        gap: "15px",
                      }}
                    >
                      <div
                        style={{
                          textAlign: "center",
                          padding: "15px",
                          background: "rgba(0,229,255,0.05)",
                          borderRadius: "12px",
                          border: "1px solid rgba(0,229,255,0.15)",
                        }}
                      >
                        <p
                          style={{
                            fontSize: "1.8rem",
                            fontWeight: 800,
                            color: "#00e5ff",
                          }}
                        >
                          {profile.stats.assignmentsCount}
                        </p>
                        <p style={{ color: "#8b949e", fontSize: "0.8rem" }}>
                          التكاليف المسلمة
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p style={{ textAlign: "center", color: "#ff3131" }}>
                  فشل تحميل الملف الشخصي
                </p>
              )}
            </motion.div>
          )}

          {activeTab === 1 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
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
                  style={{
                    color: "#00e5ff",
                    marginBottom: "20px",
                    fontSize: "1.1rem",
                  }}
                >
                  🔑 تغيير كلمة المرور
                </h3>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  <input
                    type="password"
                    placeholder="كلمة المرور الحالية"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "12px",
                      background: "rgba(0,0,0,0.5)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "10px",
                      color: "#fff",
                      fontFamily: "'Cairo', sans-serif",
                    }}
                  />
                  <input
                    type="password"
                    placeholder="كلمة المرور الجديدة"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "12px",
                      background: "rgba(0,0,0,0.5)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "10px",
                      color: "#fff",
                      fontFamily: "'Cairo', sans-serif",
                    }}
                  />
                  <input
                    type="password"
                    placeholder="تأكيد كلمة المرور الجديدة"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "12px",
                      background: "rgba(0,0,0,0.5)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "10px",
                      color: "#fff",
                      fontFamily: "'Cairo', sans-serif",
                    }}
                  />
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handlePasswordChange}
                    style={{
                      padding: "12px",
                      background: "linear-gradient(135deg, #238636, #2ea043)",
                      color: "#fff",
                      border: "none",
                      borderRadius: "10px",
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "'Cairo', sans-serif",
                    }}
                  >
                    تغيير كلمة المرور
                  </motion.button>
                  {passwordMsg && (
                    <p
                      style={{
                        color:
                          passwordMsgType === "success" ? "#2ea043" : "#ff3131",
                        textAlign: "center",
                        fontWeight: 600,
                      }}
                    >
                      {passwordMsg}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 2 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "20px",
                }}
              >
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
                    style={{
                      color: "#00e5ff",
                      marginBottom: "15px",
                      fontSize: "1.1rem",
                    }}
                  >
                    ✏️ طلب تغيير الاسم
                  </h3>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    <input
                      type="text"
                      placeholder="الاسم الجديد"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "12px",
                        background: "rgba(0,0,0,0.5)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "10px",
                        color: "#fff",
                        fontFamily: "'Cairo', sans-serif",
                      }}
                    />
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleNameRequest}
                      style={{
                        padding: "12px",
                        background: "rgba(0,229,255,0.1)",
                        border: "1px solid #00e5ff",
                        borderRadius: "10px",
                        color: "#00e5ff",
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "'Cairo', sans-serif",
                      }}
                    >
                      إرسال طلب تغيير الاسم
                    </motion.button>
                    {nameMsg && (
                      <p
                        style={{
                          color: "#2ea043",
                          textAlign: "center",
                          fontWeight: 600,
                        }}
                      >
                        {nameMsg}
                      </p>
                    )}
                  </div>
                </div>

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
                    style={{
                      color: "#00e5ff",
                      marginBottom: "15px",
                      fontSize: "1.1rem",
                    }}
                  >
                    📧 طلب تغيير البريد الإلكتروني
                  </h3>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    <input
                      type="email"
                      placeholder="البريد الإلكتروني الجديد"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "12px",
                        background: "rgba(0,0,0,0.5)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "10px",
                        color: "#fff",
                        fontFamily: "'Cairo', sans-serif",
                      }}
                    />
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleEmailRequest}
                      style={{
                        padding: "12px",
                        background: "rgba(0,229,255,0.1)",
                        border: "1px solid #00e5ff",
                        borderRadius: "10px",
                        color: "#00e5ff",
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "'Cairo', sans-serif",
                      }}
                    >
                      إرسال طلب تغيير البريد
                    </motion.button>
                    {emailMsg && (
                      <p
                        style={{
                          color: "#2ea043",
                          textAlign: "center",
                          fontWeight: 600,
                        }}
                      >
                        {emailMsg}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 3 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <TwoFATab
                twoFactorEnabled={profile?.twoFactorEnabled || false}
                onUpdate={() => fetchProfile()}
              />
            </motion.div>
          )}
          {activeTab === 4 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <WebAuthnTab
                webAuthnEnabled={profile?.webAuthnEnabled || false}
                onUpdate={() => fetchProfile()}
              />
            </motion.div>
          )}
        </main>
      </PageTransition>
    </div>
  );
}
