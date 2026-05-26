"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Sidebar from "@/components/layout/Sidebar";
import { useToast } from "@/components/ui/Toast";
import PageTransition from "@/components/layout/PageTransition";
import Pagination from "@/components/ui/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { useAuthStore } from "@/store/authStore";
import { csrfFetch } from "@/lib/csrfClient";

// ==================== الأنواع ====================
interface GenerationRecord {
  id: string;
  name: string;
  email: string | null;
  role: string;
  level: string;
  code: string;
  subjectName?: string;
  subjectCode?: string;
  generatedByName?: string;
  createdAt: string;
}

interface ActivatedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  level: string;
  isActivated: boolean;
  status: string;
  createdAt: string;
}

// ==================== الأيقونات ====================
const BackIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const CloseIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// ==================== المكوّن الرئيسي ====================
export default function ActivatedAccountsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { showToast } = useToast();

  const userRole = user?.role || "";
  const userLevel = user?.level || "";
  const userId = user?.id || "";

  // التبويبات
  type ViewTab = "users" | "subjects";
  const [viewTab, setViewTab] = useState<ViewTab>("users");
  const [levelTab, setLevelTab] = useState<string>(
    userRole === "MANAGEMENT" ? userLevel : "LEVEL_1",
  );

  // البيانات
  const [records, setRecords] = useState<GenerationRecord[]>([]);
  const [activatedUsers, setActivatedUsers] = useState<ActivatedUser[]>([]);
  const [loading, setLoading] = useState(true);

  // نافذة التفعيل
  const [activateModal, setActivateModal] = useState<GenerationRecord | null>(
    null,
  );
  const [activateEmail, setActivateEmail] = useState("");
  const [activating, setActivating] = useState(false);
  const [activatePassword, setActivatePassword] = useState("Cyber@2024");
  const [activateConfirm, setActivateConfirm] = useState("Cyber@2024");
  // البحث
  const [searchTerm, setSearchTerm] = useState("");

  const pag = usePagination(1, 20);

  // ==================== تحميل سجل التوليد ====================
  const loadGenerationLog = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pag.page));
      params.set("limit", String(pag.limit));
      params.set("level", levelTab);
      if (viewTab === "subjects") params.set("role", "TEACHER");
      if (searchTerm) params.set("search", searchTerm);

      const res = await fetch(`/api/admin/generation-log?${params}`);
      const data = await res.json();
      if (data.success) {
        setRecords(data.data);
        pag.setTotal(data.total || 0);
      }
    } catch {
      /* صامت */
    } finally {
      setLoading(false);
    }
  }, [pag.page, pag.limit, levelTab, viewTab, searchTerm]);

  // ==================== تحميل المستخدمين المفعلين ====================
  const loadActivatedUsers = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("level", levelTab);
      params.set("status", "ACTIVE");
      if (viewTab === "subjects") params.set("role", "TEACHER");
      params.set("limit", "200");

      const res = await fetch(`/api/admin/users?${params}`);
      const data = await res.json();
      if (data.success) {
        setActivatedUsers(data.data || []);
      }
    } catch {
      /* صامت */
    }
  }, [levelTab, viewTab]);

  useEffect(() => {
    loadGenerationLog();
  }, [loadGenerationLog]);
  useEffect(() => {
    loadActivatedUsers();
  }, [loadActivatedUsers]);

  // ==================== تفعيل حساب يدوياً ====================
  const handleManualActivate = async () => {
    if (!activateModal || !activateEmail.trim()) {
      showToast("يرجى إدخال البريد الإلكتروني", "warning");
      return;
    }
    setActivating(true);
    try {
      if (activatePassword !== activateConfirm) {
        showToast("كلمتا المرور غير متطابقتين", "warning");
        setActivating(false);
        return;
      }
      const res = await csrfFetch("/api/auth/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: activateModal.code,
          email: activateEmail.trim(),
          password: activatePassword,
          confirmPassword: activateConfirm,

        }),
      });
      const data = await res.json();
      if (data.status === "success" || data.success) {
        showToast("✅ تم تفعيل الحساب بنجاح", "success");
        setActivateModal(null);
        setActivateEmail("");
        loadGenerationLog();
        loadActivatedUsers();
      } else {
        showToast(data.message || "فشل التفعيل", "error");
      }
    } catch {
      showToast("فشل الاتصال", "error");
    } finally {
      setActivating(false);
    }
  };

  // ==================== أدوات مساعدة ====================
  const getLevelLabel = (l: string) =>
    ({
      LEVEL_1: "المستوى الأول",
      LEVEL_2: "المستوى الثاني",
      LEVEL_3: "المستوى الثالث",
      LEVEL_4: "المستوى الرابع",
    })[l] || l;
  const getRoleLabel = (r: string) =>
    ({ ADMIN: "أدمن", MANAGEMENT: "إدارة", TEACHER: "معلم", STUDENT: "طالب" })[
      r
    ] || r;
  const getRoleColor = (r: string) =>
    ({
      ADMIN: "#ff3131",
      MANAGEMENT: "#ffca28",
      TEACHER: "#bf5af2",
      STUDENT: "#00e5ff",
    })[r] || "#8b949e";

  const levels =
    userRole === "MANAGEMENT"
      ? [userLevel]
      : ["LEVEL_1", "LEVEL_2", "LEVEL_3", "LEVEL_4"];

  // هل هذا الكود مفعل؟
  const isCodeActivated = (record: GenerationRecord) => {
    return (
      activatedUsers.some(
        (u) => u.email && record.email && u.email === record.email,
      ) ||
      activatedUsers.some(
        (u) => u.name === record.name && u.level === record.level,
      )
    );
  };

  const glassStyle: React.CSSProperties = {
    background: "rgba(10, 20, 40, 0.5)",
    backdropFilter: "blur(25px)",
    WebkitBackdropFilter: "blur(25px)",
    border: "1px solid rgba(0, 229, 255, 0.12)",
    borderRadius: "18px",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 16px",
    background: "rgba(0,0,0,0.5)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "12px",
    color: "#e6edf3",
    fontSize: "0.95rem",
    fontFamily: "'Cairo', sans-serif",
    outline: "none",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "transparent",
        fontFamily: "'Cairo', sans-serif",
        color: "#fff",
      }}
    >
      <Header />
      <Sidebar />
      <PageTransition>
        <main
          style={{
            maxWidth: "1400px",
            margin: "0 auto",
            padding: "100px 20px 60px",
          }}
        >
          {/* ========== الهيدر ========== */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              ...glassStyle,
              padding: "20px 30px",
              marginBottom: "25px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "15px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push("/admin")}
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "12px",
                  background: "rgba(0,229,255,0.08)",
                  border: "1px solid rgba(0,229,255,0.2)",
                  color: "#00e5ff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <BackIcon />
              </motion.button>
              <div>
                <h2
                  style={{
                    color: "#00e5ff",
                    fontSize: "clamp(1.2rem, 3vw, 1.6rem)",
                    fontWeight: 800,
                    margin: 0,
                  }}
                >
                  {viewTab === "users"
                    ? "📋 الحسابات المولدة"
                    : "📘 حسابات المواد"}
                </h2>
                <p
                  style={{
                    color: "#8b949e",
                    fontSize: "0.85rem",
                    margin: "4px 0 0",
                  }}
                >
                  {userRole === "ADMIN"
                    ? "جميع المستويات"
                    : getLevelLabel(userLevel)}
                </p>
              </div>
            </div>

            {/* تبديل المستخدمين / المواد */}
            <div style={{ display: "flex", gap: "6px" }}>
              {[
                { key: "users", label: "👥 المستخدمين" },
                { key: "subjects", label: "📘 المواد" },
              ].map((tab: any) => (
                <motion.button
                  key={tab.key}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    setViewTab(tab.key as ViewTab);
                    pag.goTo(1);
                  }}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "10px",
                    background:
                      viewTab === tab.key
                        ? "rgba(0,229,255,0.12)"
                        : "rgba(255,255,255,0.03)",
                    border:
                      viewTab === tab.key
                        ? "1px solid #00e5ff"
                        : "1px solid rgba(255,255,255,0.08)",
                    color: viewTab === tab.key ? "#00e5ff" : "#8b949e",
                    cursor: "pointer",
                    fontFamily: "'Cairo', sans-serif",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                  }}
                >
                  {tab.label}
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* ========== تبويبات المستويات ========== */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              display: "flex",
              gap: "8px",
              marginBottom: "20px",
              flexWrap: "wrap",
            }}
          >
            {levels.map((lvl) => (
              <motion.button
                key={lvl}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  setLevelTab(lvl);
                  pag.goTo(1);
                }}
                style={{
                  padding: "10px 20px",
                  borderRadius: "14px",
                  background:
                    levelTab === lvl
                      ? "rgba(0,229,255,0.12)"
                      : "rgba(255,255,255,0.03)",
                  border:
                    levelTab === lvl
                      ? "1px solid #00e5ff"
                      : "1px solid rgba(255,255,255,0.08)",
                  color: levelTab === lvl ? "#00e5ff" : "#8b949e",
                  cursor: "pointer",
                  fontFamily: "'Cairo', sans-serif",
                  fontWeight: levelTab === lvl ? 700 : 500,
                  fontSize: "0.9rem",
                }}
              >
                {getLevelLabel(lvl)}
              </motion.button>
            ))}
          </motion.div>

          {/* ========== بحث ========== */}
          <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
            <input
              type="text"
              placeholder="🔍 بحث بالاسم أو الإيميل أو الكود..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  pag.goTo(1);
                  loadGenerationLog();
                }
              }}
              style={{ ...inputStyle, flex: 1 }}
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                pag.goTo(1);
                loadGenerationLog();
              }}
              style={{
                padding: "12px 20px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #00e5ff, #0077b6)",
                border: "none",
                color: "#010204",
                fontWeight: 800,
                cursor: "pointer",
                fontFamily: "'Cairo', sans-serif",
              }}
            >
              بحث
            </motion.button>
          </div>

          {/* ========== السجل ========== */}
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px" }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                style={{
                  width: "40px",
                  height: "40px",
                  border: "3px solid rgba(0,229,255,0.2)",
                  borderTopColor: "#00e5ff",
                  borderRadius: "50%",
                  margin: "0 auto 15px",
                }}
              />
            </div>
          ) : records.length === 0 ? (
            <div
              style={{ ...glassStyle, padding: "50px", textAlign: "center" }}
            >
              <div style={{ fontSize: "3rem", marginBottom: "10px" }}>📭</div>
              <p style={{ color: "#8b949e" }}>لا توجد سجلات في هذا المستوى</p>
            </div>
          ) : (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              <AnimatePresence mode="popLayout">
                {records.map((rec, i) => {
                  const activated = isCodeActivated(rec);
                  return (
                    <motion.div
                      key={rec.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02 }}
                      whileHover={{ borderColor: "rgba(0,229,255,0.3)" }}
                      style={{
                        ...glassStyle,
                        padding: "14px 18px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "10px",
                        transition: "border-color 0.3s",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          flex: 1,
                          minWidth: "200px",
                        }}
                      >
                        <div
                          style={{
                            width: "40px",
                            height: "40px",
                            borderRadius: "12px",
                            background: activated
                              ? "rgba(46,160,67,0.15)"
                              : "rgba(255,202,40,0.15)",
                            border: `1.5px solid ${activated ? "#2ea043" : "#ffca28"}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "1.1rem",
                            flexShrink: 0,
                          }}
                        >
                          {activated ? "✅" : "⏳"}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 700,
                              color: "#e6edf3",
                              fontSize: "0.95rem",
                            }}
                          >
                            {rec.name}
                            {rec.subjectName && (
                              <span
                                style={{
                                  color: "#bf5af2",
                                  fontSize: "0.8rem",
                                  marginRight: "6px",
                                }}
                              >
                                📘 {rec.subjectName}
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              gap: "8px",
                              flexWrap: "wrap",
                              marginTop: "4px",
                              alignItems: "center",
                            }}
                          >
                            <span
                              style={{
                                color: getRoleColor(rec.role),
                                fontSize: "0.65rem",
                                background: "rgba(255,255,255,0.05)",
                                padding: "2px 8px",
                                borderRadius: "10px",
                              }}
                            >
                              {getRoleLabel(rec.role)}
                            </span>
                            <span
                              style={{ color: "#8b949e", fontSize: "0.65rem" }}
                            >
                              {getLevelLabel(rec.level)}
                            </span>
                            <span
                              style={{
                                color: "#5a6a7a",
                                fontSize: "0.65rem",
                                direction: "ltr",
                              }}
                            >
                              {rec.code}
                            </span>
                            {rec.email && (
                              <span
                                style={{
                                  color: "#00e5ff",
                                  fontSize: "0.65rem",
                                  direction: "ltr",
                                }}
                              >
                                {rec.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            padding: "4px 12px",
                            borderRadius: "20px",
                            fontSize: "0.7rem",
                            fontWeight: 600,
                            background: activated
                              ? "rgba(46,160,67,0.15)"
                              : "rgba(255,202,40,0.15)",
                            color: activated ? "#2ea043" : "#ffca28",
                          }}
                        >
                          {activated ? "مفعل" : "غير مفعل"}
                        </span>
                        {!activated && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              setActivateModal(rec);
                              setActivateEmail(rec.email || "");
                            }}
                            style={{
                              padding: "6px 14px",
                              borderRadius: "10px",
                              background:
                                "linear-gradient(135deg, #238636, #2ea043)",
                              border: "none",
                              color: "#fff",
                              cursor: "pointer",
                              fontWeight: 700,
                              fontSize: "0.8rem",
                              fontFamily: "'Cairo', sans-serif",
                            }}
                          >
                            تفعيل
                          </motion.button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              <Pagination
                page={pag.page}
                totalPages={pag.totalPages}
                onPageChange={pag.goTo}
              />
            </div>
          )}
        </main>
      </PageTransition>
      <Footer />

      {/* ==================== نافذة التفعيل اليدوي ==================== */}
      <AnimatePresence>
        {activateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 300,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.8)",
              backdropFilter: "blur(10px)",
              padding: "20px",
            }}
            onClick={() => setActivateModal(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 30 }}
              transition={{ type: "spring", damping: 20, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                ...glassStyle,
                padding: "30px",
                maxWidth: "480px",
                width: "100%",
                border: "1px solid rgba(0,229,255,0.25)",
                boxShadow: "0 0 60px rgba(0,229,255,0.15)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "20px",
                }}
              >
                <h3
                  style={{
                    color: "#00e5ff",
                    fontSize: "1.2rem",
                    fontWeight: 800,
                    margin: 0,
                  }}
                >
                  🔑 تفعيل الحساب يدوياً
                </h3>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setActivateModal(null)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#8b949e",
                    cursor: "pointer",
                  }}
                >
                  <CloseIcon />
                </motion.button>
              </div>

              <div
                style={{
                  marginBottom: "15px",
                  padding: "12px",
                  borderRadius: "10px",
                  background: "rgba(0,229,255,0.06)",
                  border: "1px solid rgba(0,229,255,0.15)",
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    color: "#8b949e",
                    fontSize: "0.8rem",
                    margin: "0 0 4px",
                  }}
                >
                  كود التفعيل
                </p>
                <p
                  style={{
                    color: "#00e5ff",
                    fontSize: "1.5rem",
                    fontWeight: 800,
                    margin: 0,
                    letterSpacing: "4px",
                    direction: "ltr",
                  }}
                >
                  {activateModal.code}
                </p>
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label
                  style={{
                    color: "#8b949e",
                    fontSize: "0.8rem",
                    marginBottom: "4px",
                    display: "block",
                    textAlign: "center",
                  }}
                >
                  البريد الإلكتروني للمستخدم
                </label>
                <input
                  type="email"
                  placeholder="أدخل البريد الإلكتروني..."
                  value={activateEmail}
                  onChange={(e) => setActivateEmail(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label
                  style={{
                    color: "#8b949e",
                    fontSize: "0.8rem",
                    marginBottom: "4px",
                    display: "block",
                    textAlign: "center",
                  }}
                >
                  كلمة المرور
                </label>
                <input
                  type="text"
                  placeholder="كلمة المرور"
                  value={activatePassword}
                  onChange={(e) => setActivatePassword(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: "15px" }}>
                <label
                  style={{
                    color: "#8b949e",
                    fontSize: "0.8rem",
                    marginBottom: "4px",
                    display: "block",
                    textAlign: "center",
                  }}
                >
                  تأكيد كلمة المرور
                </label>
                <input
                  type="text"
                  placeholder="تأكيد كلمة المرور"
                  value={activateConfirm}
                  onChange={(e) => setActivateConfirm(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleManualActivate}
                disabled={activating}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: "12px",
                  border: "none",
                  background: "linear-gradient(135deg, #238636, #2ea043)",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: "1rem",
                  cursor: "pointer",
                  fontFamily: "'Cairo', sans-serif",
                  opacity: activating ? 0.6 : 1,
                  boxShadow: "0 8px 25px rgba(35,134,54,0.3)",
                }}
              >
                {activating ? "⏳ جاري التفعيل..." : "✅ تفعيل الحساب"}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
