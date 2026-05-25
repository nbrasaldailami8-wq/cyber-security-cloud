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
interface StudentRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  level: string;
  isActivated: boolean;
  hasUploadPermission: boolean;
  permissionId?: string;
  grantedAt?: string;
  grantedBy?: string;
}

// ==================== الأيقونات ====================
const SearchIcon = () => (
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
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

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

const ShieldIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const DeleteIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
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
export default function LibraryPermissionsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { showToast } = useToast();

  const userRole = user?.role || "";
  const userLevel = user?.level || "";

  // البيانات
  const [allStudents, setAllStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [grantingId, setGrantingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // نافذة التأكيد المخصصة
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    action: "grant" | "revoke";
    userId?: string;
    userName?: string;
    permissionId?: string;
  }>({ show: false, title: "", message: "", action: "grant" });

  // البحث المتقدم
  const [showSearch, setShowSearch] = useState(false);
  const [searchName, setSearchName] = useState("");
  const [searchEmail, setSearchEmail] = useState("");
  const [searchLevel, setSearchLevel] = useState("");

  // الترقيم
  const pag = usePagination(1, 20);

  // ==================== تحميل جميع الطلاب ====================
  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pag.page));
      params.set("limit", String(pag.limit));

      if (searchName.trim()) params.set("search", searchName.trim());
      if (searchEmail.trim()) params.set("email", searchEmail.trim());

      if (userRole === "ADMIN") {
        if (searchLevel) params.set("level", searchLevel);
      } else {
        params.set("level", userLevel);
      }

      const res = await fetch(`/api/admin/users?${params}`);
      const data = await res.json();
      if (data.success) {
        const students: StudentRecord[] = (data.data || [])
          .filter((u: any) => u.role === "STUDENT" || u.role === "TEACHER")
          .map((u: any) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            level: u.level,
            isActivated: u.isActivated,
            hasUploadPermission:
              u.uploadPermissions && u.uploadPermissions.length > 0,
            permissionId: u.uploadPermissions?.[0]?.id || undefined,
            grantedAt: u.uploadPermissions?.[0]?.grantedAt || undefined,
            grantedBy: u.uploadPermissions?.[0]?.grantedBy || undefined,
          }));
        setAllStudents(students);
        pag.setTotal(data.total || 0);
      }
    } catch {
      showToast("فشل تحميل البيانات", "error");
    } finally {
      setLoading(false);
    }
  }, [
    userRole,
    userLevel,
    searchName,
    searchEmail,
    searchLevel,
    pag.page,
    pag.limit,
    showToast,
  ]);

  useEffect(() => {
    if (userRole === "ADMIN" || userRole === "MANAGEMENT") {
      loadStudents();
    } else {
      router.push("/library");
    }
  }, [userRole, loadStudents, router]);

  // ==================== منح صلاحية (فتح نافذة التأكيد) ====================
  const handleGrant = (studentId: string, studentName: string) => {
    setConfirmModal({
      show: true,
      title: "تأكيد الترقية",
      message: `هل أنت متأكد من منح "${studentName}" صلاحية النشر في المكتبة؟`,
      action: "grant",
      userId: studentId,
      userName: studentName,
    });
  };

  const executeGrant = async () => {
    if (!confirmModal.userId || !confirmModal.userName) return;
    const uid = confirmModal.userId;
    const uname = confirmModal.userName;
    setConfirmModal({ show: false, title: "", message: "", action: "grant" });
    setGrantingId(uid);
    try {
      const res = await csrfFetch("/api/admin/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`🎉 تم ترقية "${uname}" بنجاح`, "success");
        loadStudents();
      } else {
        showToast(data.message || "فشلت الترقية", "error");
      }
    } catch {
      showToast("فشل الاتصال بالخادم", "error");
    } finally {
      setGrantingId(null);
    }
  };

  // ==================== سحب صلاحية (فتح نافذة التأكيد) ====================
  const handleRevoke = (permissionId: string, studentName: string) => {
    setConfirmModal({
      show: true,
      title: "تأكيد سحب الصلاحية",
      message: `هل أنت متأكد من سحب صلاحية النشر من "${studentName}"؟`,
      action: "revoke",
      permissionId: permissionId,
      userName: studentName,
    });
  };

  const executeRevoke = async () => {
    if (!confirmModal.permissionId || !confirmModal.userName) return;
    const pid = confirmModal.permissionId;
    const uname = confirmModal.userName;
    setConfirmModal({ show: false, title: "", message: "", action: "grant" });
    setRevokingId(pid);
    try {
      const res = await csrfFetch("/api/admin/upgrade", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionId: pid }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`⚠️ تم سحب صلاحية "${uname}"`, "warning");
        loadStudents();
      } else {
        showToast(data.message || "فشل سحب الصلاحية", "error");
      }
    } catch {
      showToast("فشل الاتصال بالخادم", "error");
    } finally {
      setRevokingId(null);
    }
  };

  // ==================== تطبيق البحث ====================
  const applySearch = () => {
    pag.goTo(1);
    setShowSearch(false);
    loadStudents();
  };

  // ==================== مسح البحث ====================
  const clearSearch = () => {
    setSearchName("");
    setSearchEmail("");
    setSearchLevel("");
    pag.goTo(1);
    loadStudents();
  };

  // ==================== أدوات مساعدة ====================
  const getLevelLabel = (level: string): string => {
    const labels: Record<string, string> = {
      LEVEL_1: "المستوى الأول",
      LEVEL_2: "المستوى الثاني",
      LEVEL_3: "المستوى الثالث",
      LEVEL_4: "المستوى الرابع",
    };
    return labels[level] || level;
  };

  const getRoleLabel = (role: string): string => {
    const labels: Record<string, string> = {
      ADMIN: "أدمن",
      MANAGEMENT: "إدارة",
      TEACHER: "معلم",
      STUDENT: "طالب",
    };
    return labels[role] || role;
  };

  const getRoleColor = (role: string): string => {
    const colors: Record<string, string> = {
      ADMIN: "#ff3131",
      MANAGEMENT: "#ffca28",
      TEACHER: "#bf5af2",
      STUDENT: "#00e5ff",
    };
    return colors[role] || "#8b949e";
  };

  // ==================== التنسيقات ====================
  const glassStyle: React.CSSProperties = {
    background: "rgba(10, 20, 40, 0.6)",
    backdropFilter: "blur(25px)",
    WebkitBackdropFilter: "blur(25px)",
    border: "1px solid rgba(0, 229, 255, 0.15)",
    borderRadius: "20px",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 16px",
    background: "rgba(0, 0, 0, 0.5)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "12px",
    color: "#e6edf3",
    fontSize: "0.95rem",
    fontFamily: "'Cairo', sans-serif",
    outline: "none",
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    appearance: "none",
    cursor: "pointer",
  };

  if (userRole !== "ADMIN" && userRole !== "MANAGEMENT") {
    return null;
  }

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
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "15px",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "15px" }}
              >
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => router.push("/library")}
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
                      color: "#bf5af2",
                      fontSize: "clamp(1.2rem, 3vw, 1.6rem)",
                      fontWeight: 800,
                      margin: 0,
                    }}
                  >
                    🛡️ ترقية الحسابات
                  </h2>
                  <p
                    style={{
                      color: "#8b949e",
                      fontSize: "0.85rem",
                      margin: "4px 0 0",
                    }}
                  >
                    {userRole === "ADMIN"
                      ? "جميع المستويات الدراسية"
                      : getLevelLabel(userLevel)}
                  </p>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowSearch(!showSearch)}
                style={{
                  padding: "12px 24px",
                  borderRadius: "14px",
                  background: showSearch
                    ? "rgba(0,229,255,0.15)"
                    : "rgba(0,229,255,0.06)",
                  border: showSearch
                    ? "1px solid #00e5ff"
                    : "1px solid rgba(0,229,255,0.2)",
                  color: "#00e5ff",
                  cursor: "pointer",
                  fontFamily: "'Cairo', sans-serif",
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <SearchIcon /> بحث متقدم
              </motion.button>
            </div>

            <AnimatePresence>
              {showSearch && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ overflow: "hidden", marginTop: "20px" }}
                >
                  <div
                    style={{
                      padding: "20px",
                      borderRadius: "16px",
                      background: "rgba(0,0,0,0.4)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(200px, 1fr))",
                        gap: "12px",
                        marginBottom: "16px",
                      }}
                    >
                      <div>
                        <label
                          style={{
                            color: "#8b949e",
                            fontSize: "0.8rem",
                            marginBottom: "6px",
                            display: "block",
                          }}
                        >
                          اسم المستخدم
                        </label>
                        <input
                          type="text"
                          placeholder="ابحث بالاسم..."
                          value={searchName}
                          onChange={(e) => setSearchName(e.target.value)}
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            color: "#8b949e",
                            fontSize: "0.8rem",
                            marginBottom: "6px",
                            display: "block",
                          }}
                        >
                          البريد الإلكتروني
                        </label>
                        <input
                          type="text"
                          placeholder="ابحث بالإيميل..."
                          value={searchEmail}
                          onChange={(e) => setSearchEmail(e.target.value)}
                          style={inputStyle}
                        />
                      </div>
                      {userRole === "ADMIN" && (
                        <div>
                          <label
                            style={{
                              color: "#8b949e",
                              fontSize: "0.8rem",
                              marginBottom: "6px",
                              display: "block",
                            }}
                          >
                            المستوى الدراسي
                          </label>
                          <select
                            value={searchLevel}
                            onChange={(e) => setSearchLevel(e.target.value)}
                            style={selectStyle}
                          >
                            <option value="">جميع المستويات</option>
                            <option value="LEVEL_1">المستوى الأول</option>
                            <option value="LEVEL_2">المستوى الثاني</option>
                            <option value="LEVEL_3">المستوى الثالث</option>
                            <option value="LEVEL_4">المستوى الرابع</option>
                          </select>
                        </div>
                      )}
                    </div>
                    <div
                      style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}
                    >
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={applySearch}
                        style={{
                          flex: 2,
                          padding: "12px",
                          borderRadius: "12px",
                          background:
                            "linear-gradient(135deg, #00e5ff, #0077b6)",
                          border: "none",
                          color: "#010204",
                          cursor: "pointer",
                          fontWeight: 800,
                          fontFamily: "'Cairo', sans-serif",
                          fontSize: "0.9rem",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px",
                        }}
                      >
                        <SearchIcon /> تطبيق البحث
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={clearSearch}
                        style={{
                          flex: 1,
                          padding: "12px",
                          borderRadius: "12px",
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          color: "#8b949e",
                          cursor: "pointer",
                          fontWeight: 700,
                          fontFamily: "'Cairo', sans-serif",
                          fontSize: "0.9rem",
                        }}
                      >
                        مسح البحث
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* ========== إحصائيات سريعة ========== */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "15px",
              marginBottom: "25px",
            }}
          >
            {[
              {
                label: "إجمالي المستخدمين",
                value: allStudents.length,
                color: "#00e5ff",
                icon: "👥",
              },
              {
                label: "مصرح لهم بالنشر",
                value: allStudents.filter((s) => s.hasUploadPermission).length,
                color: "#39ff14",
                icon: "✅",
              },
              {
                label: "غير مصرح لهم",
                value: allStudents.filter((s) => !s.hasUploadPermission).length,
                color: "#8b949e",
                icon: "🔒",
              },
            ].map((stat, i) => (
              <div
                key={i}
                style={{ ...glassStyle, padding: "20px", textAlign: "center" }}
              >
                <div style={{ fontSize: "2rem", marginBottom: "5px" }}>
                  {stat.icon}
                </div>
                <div
                  style={{
                    fontSize: "1.8rem",
                    fontWeight: 800,
                    color: stat.color,
                  }}
                >
                  {stat.value}
                </div>
                <div style={{ fontSize: "0.8rem", color: "#8b949e" }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </motion.div>

          {/* ========== السجل ========== */}
          {loading ? (
            <div
              style={{ textAlign: "center", padding: "60px", color: "#8b949e" }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                style={{
                  width: "50px",
                  height: "50px",
                  border: "3px solid rgba(0,229,255,0.2)",
                  borderTopColor: "#00e5ff",
                  borderRadius: "50%",
                  margin: "0 auto 20px",
                }}
              />
              <p>جاري تحميل السجل...</p>
            </div>
          ) : allStudents.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                ...glassStyle,
                padding: "60px 30px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "4rem", marginBottom: "15px" }}>📭</div>
              <h3
                style={{
                  color: "#8b949e",
                  fontSize: "1.3rem",
                  marginBottom: "8px",
                }}
              >
                لا يوجد طلاب
              </h3>
              <p style={{ color: "#5a6a7a" }}>
                لم يتم العثور على أي طالب في هذا المستوى
              </p>
            </motion.div>
          ) : (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ ...glassStyle, overflow: "hidden", display: "none" }}
                className="lg:block"
              >
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "0.9rem",
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.08)",
                          background: "rgba(0,0,0,0.3)",
                        }}
                      >
                        {[
                          "المستخدم",
                          "الدور",
                          "المستوى",
                          "الإيميل",
                          "الحالة",
                          "الصلاحية",
                          "الإجراء",
                        ].map((h) => (
                          <th
                            key={h}
                            style={{
                              padding: "14px 16px",
                              textAlign: "right",
                              color: "#00e5ff",
                              fontWeight: 700,
                              fontSize: "0.85rem",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence mode="popLayout">
                        {allStudents.map((student) => (
                          <motion.tr
                            key={student.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            style={{
                              borderBottom: "1px solid rgba(255,255,255,0.04)",
                              transition: "background 0.2s",
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.background =
                                "rgba(0,229,255,0.03)")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.background = "transparent")
                            }
                          >
                            <td style={{ padding: "12px 16px" }}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "10px",
                                }}
                              >
                                <div
                                  style={{
                                    width: "36px",
                                    height: "36px",
                                    borderRadius: "50%",
                                    background: `rgba(${student.role === "TEACHER" ? "191,90,242" : "0,229,255"}, 0.15)`,
                                    border: `2px solid ${getRoleColor(student.role)}`,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "0.9rem",
                                    fontWeight: 800,
                                    color: getRoleColor(student.role),
                                    flexShrink: 0,
                                  }}
                                >
                                  {student.name.charAt(0)}
                                </div>
                                <span
                                  style={{ fontWeight: 600, color: "#e6edf3" }}
                                >
                                  {student.name}
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              <span
                                style={{
                                  background: `rgba(${student.role === "TEACHER" ? "191,90,242" : "0,229,255"}, 0.1)`,
                                  color: getRoleColor(student.role),
                                  padding: "3px 10px",
                                  borderRadius: "20px",
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                }}
                              >
                                {getRoleLabel(student.role)}
                              </span>
                            </td>
                            <td
                              style={{ padding: "12px 16px", color: "#8b949e" }}
                            >
                              {getLevelLabel(student.level)}
                            </td>
                            <td
                              style={{
                                padding: "12px 16px",
                                color: "#8b949e",
                                fontSize: "0.8rem",
                                direction: "ltr",
                                textAlign: "right",
                              }}
                            >
                              {student.email}
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              <span
                                style={{
                                  padding: "4px 10px",
                                  borderRadius: "20px",
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  background: student.hasUploadPermission
                                    ? "rgba(46,160,67,0.15)"
                                    : "rgba(255,255,255,0.05)",
                                  color: student.hasUploadPermission
                                    ? "#2ea043"
                                    : "#8b949e",
                                }}
                              >
                                {student.hasUploadPermission
                                  ? "✅ ناشر"
                                  : "🔒 عادي"}
                              </span>
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              {student.hasUploadPermission &&
                              student.grantedAt ? (
                                <span
                                  style={{
                                    fontSize: "0.75rem",
                                    color: "#5a6a7a",
                                  }}
                                >
                                  {new Date(
                                    student.grantedAt,
                                  ).toLocaleDateString("ar-YE")}
                                </span>
                              ) : (
                                <span
                                  style={{
                                    fontSize: "0.75rem",
                                    color: "#5a6a7a",
                                  }}
                                >
                                  —
                                </span>
                              )}
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              {student.hasUploadPermission ? (
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() =>
                                    handleRevoke(
                                      student.permissionId!,
                                      student.name,
                                    )
                                  }
                                  disabled={revokingId === student.permissionId}
                                  style={{
                                    padding: "8px 16px",
                                    borderRadius: "10px",
                                    background: "rgba(248,81,73,0.1)",
                                    border: "1px solid rgba(248,81,73,0.25)",
                                    color: "#f85149",
                                    cursor: "pointer",
                                    fontWeight: 700,
                                    fontSize: "0.8rem",
                                    fontFamily: "'Cairo', sans-serif",
                                    opacity:
                                      revokingId === student.permissionId
                                        ? 0.5
                                        : 1,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "6px",
                                  }}
                                >
                                  <DeleteIcon /> سحب
                                </motion.button>
                              ) : (
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() =>
                                    handleGrant(student.id, student.name)
                                  }
                                  disabled={grantingId === student.id}
                                  style={{
                                    padding: "8px 16px",
                                    borderRadius: "10px",
                                    background:
                                      grantingId === student.id
                                        ? "rgba(0,229,255,0.2)"
                                        : "linear-gradient(135deg, #bf5af2, #7a00ff)",
                                    border: "none",
                                    color: "#fff",
                                    cursor: "pointer",
                                    fontWeight: 700,
                                    fontSize: "0.8rem",
                                    fontFamily: "'Cairo', sans-serif",
                                    opacity:
                                      grantingId === student.id ? 0.6 : 1,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "6px",
                                  }}
                                >
                                  <ShieldIcon /> ترقية
                                </motion.button>
                              )}
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              </motion.div>

              <div
                className="lg:hidden"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "15px",
                }}
              >
                <AnimatePresence mode="popLayout">
                  {allStudents.map((student) => (
                    <motion.div
                      key={student.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      style={{ ...glassStyle, padding: "20px" }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          marginBottom: "12px",
                        }}
                      >
                        <div
                          style={{
                            width: "44px",
                            height: "44px",
                            borderRadius: "50%",
                            background: `rgba(${student.role === "TEACHER" ? "191,90,242" : "0,229,255"}, 0.15)`,
                            border: `2px solid ${getRoleColor(student.role)}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "1rem",
                            fontWeight: 800,
                            color: getRoleColor(student.role),
                            flexShrink: 0,
                          }}
                        >
                          {student.name.charAt(0)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h3
                            style={{
                              fontWeight: 700,
                              fontSize: "0.95rem",
                              color: "#e6edf3",
                              margin: "0 0 2px",
                            }}
                          >
                            {student.name}
                          </h3>
                          <p
                            style={{
                              fontSize: "0.75rem",
                              color: "#8b949e",
                              margin: 0,
                              direction: "ltr",
                              textAlign: "right",
                            }}
                          >
                            {student.email}
                          </p>
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          flexWrap: "wrap",
                          marginBottom: "12px",
                        }}
                      >
                        <span
                          style={{
                            background: `rgba(${student.role === "TEACHER" ? "191,90,242" : "0,229,255"}, 0.1)`,
                            color: getRoleColor(student.role),
                            padding: "3px 10px",
                            borderRadius: "20px",
                            fontSize: "0.7rem",
                            fontWeight: 600,
                          }}
                        >
                          {getRoleLabel(student.role)}
                        </span>
                        <span
                          style={{
                            background: "rgba(0,229,255,0.1)",
                            color: "#00e5ff",
                            padding: "3px 10px",
                            borderRadius: "20px",
                            fontSize: "0.7rem",
                            fontWeight: 600,
                          }}
                        >
                          {getLevelLabel(student.level)}
                        </span>
                        <span
                          style={{
                            padding: "3px 10px",
                            borderRadius: "20px",
                            fontSize: "0.7rem",
                            fontWeight: 600,
                            background: student.hasUploadPermission
                              ? "rgba(46,160,67,0.15)"
                              : "rgba(255,255,255,0.05)",
                            color: student.hasUploadPermission
                              ? "#2ea043"
                              : "#8b949e",
                          }}
                        >
                          {student.hasUploadPermission ? "✅ ناشر" : "🔒 عادي"}
                        </span>
                      </div>
                      <div
                        style={{
                          borderTop: "1px solid rgba(255,255,255,0.05)",
                          paddingTop: "12px",
                        }}
                      >
                        {student.hasUploadPermission ? (
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() =>
                              handleRevoke(student.permissionId!, student.name)
                            }
                            disabled={revokingId === student.permissionId}
                            style={{
                              width: "100%",
                              padding: "10px",
                              borderRadius: "10px",
                              background: "rgba(248,81,73,0.1)",
                              border: "1px solid rgba(248,81,73,0.25)",
                              color: "#f85149",
                              cursor: "pointer",
                              fontWeight: 700,
                              fontSize: "0.85rem",
                              fontFamily: "'Cairo', sans-serif",
                              opacity:
                                revokingId === student.permissionId ? 0.5 : 1,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "6px",
                            }}
                          >
                            <DeleteIcon /> سحب الصلاحية
                          </motion.button>
                        ) : (
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() =>
                              handleGrant(student.id, student.name)
                            }
                            disabled={grantingId === student.id}
                            style={{
                              width: "100%",
                              padding: "10px",
                              borderRadius: "10px",
                              background:
                                grantingId === student.id
                                  ? "rgba(0,229,255,0.2)"
                                  : "linear-gradient(135deg, #bf5af2, #7a00ff)",
                              border: "none",
                              color: "#fff",
                              cursor: "pointer",
                              fontWeight: 700,
                              fontSize: "0.85rem",
                              fontFamily: "'Cairo', sans-serif",
                              opacity: grantingId === student.id ? 0.6 : 1,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "6px",
                            }}
                          >
                            <ShieldIcon /> ترقية
                          </motion.button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </>
          )}

          {allStudents.length > 0 && (
            <div style={{ marginTop: "25px" }}>
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

      {/* ==================== نافذة تأكيد زجاجية ==================== */}
      <AnimatePresence>
        {confirmModal.show && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 400,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.75)",
              backdropFilter: "blur(10px)",
              padding: "20px",
            }}
            onClick={() =>
              setConfirmModal({
                show: false,
                title: "",
                message: "",
                action: "grant",
              })
            }
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 30 }}
              transition={{ type: "spring", damping: 20, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "rgba(10, 20, 40, 0.95)",
                backdropFilter: "blur(30px)",
                border:
                  confirmModal.action === "revoke"
                    ? "1px solid rgba(248,81,73,0.3)"
                    : "1px solid rgba(191,90,242,0.3)",
                borderRadius: "24px",
                padding: "30px",
                maxWidth: "450px",
                width: "100%",
                textAlign: "center",
                boxShadow:
                  confirmModal.action === "revoke"
                    ? "0 0 60px rgba(248,81,73,0.15)"
                    : "0 0 60px rgba(191,90,242,0.15)",
              }}
            >
              <div
                style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  background:
                    confirmModal.action === "revoke"
                      ? "rgba(248,81,73,0.15)"
                      : "rgba(191,90,242,0.15)",
                  margin: "0 auto 15px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.8rem",
                }}
              >
                {confirmModal.action === "revoke" ? "⚠️" : "🛡️"}
              </div>
              <h3
                style={{
                  color: "#fff",
                  fontSize: "1.2rem",
                  fontWeight: 800,
                  marginBottom: "8px",
                }}
              >
                {confirmModal.title}
              </h3>
              <p
                style={{
                  color: "#8b949e",
                  fontSize: "0.9rem",
                  marginBottom: "25px",
                  lineHeight: 1.6,
                }}
              >
                {confirmModal.message}
              </p>
              <div style={{ display: "flex", gap: "10px" }}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() =>
                    setConfirmModal({
                      show: false,
                      title: "",
                      message: "",
                      action: "grant",
                    })
                  }
                  style={{
                    flex: 1,
                    padding: "13px",
                    borderRadius: "12px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#8b949e",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: "0.95rem",
                    fontFamily: "'Cairo', sans-serif",
                  }}
                >
                  إلغاء
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    if (confirmModal.action === "grant") executeGrant();
                    else executeRevoke();
                  }}
                  style={{
                    flex: 1.5,
                    padding: "13px",
                    borderRadius: "12px",
                    background:
                      confirmModal.action === "revoke"
                        ? "linear-gradient(135deg, #f85149, #da3633)"
                        : "linear-gradient(135deg, #bf5af2, #7a00ff)",
                    border: "none",
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: 800,
                    fontSize: "0.95rem",
                    fontFamily: "'Cairo', sans-serif",
                    boxShadow:
                      confirmModal.action === "revoke"
                        ? "0 8px 25px rgba(248,81,73,0.3)"
                        : "0 8px 25px rgba(122,0,255,0.3)",
                  }}
                >
                  {confirmModal.action === "grant"
                    ? "نعم، ترقية"
                    : "نعم، سحب الصلاحية"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
