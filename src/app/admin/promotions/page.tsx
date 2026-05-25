"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Sidebar from "@/components/layout/Sidebar";
import { useToast } from "@/components/ui/Toast";
import PageTransition from "@/components/layout/PageTransition";
import { useAuthStore } from "@/store/authStore";
import { csrfFetch } from "@/lib/csrfClient";

// ==================== الأنواع ====================
interface SearchUser {
  id: string;
  name: string;
  email: string;
  role: string;
  level: string;
  managementLevel?: string;
  uploadPermissions?: { id: string; grantedAt: string }[];
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
const SearchIcon = () => (
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
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
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
export default function PromotionsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { showToast } = useToast();

  const userRole = user?.role || "";
  const userLevel = user?.level || "";

  // البحث
  const [searchLevel, setSearchLevel] = useState(
    userRole === "MANAGEMENT" ? userLevel : "",
  );
  const [searchRole, setSearchRole] = useState("");
  const [searchName, setSearchName] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);

  // كل المستخدمين
  const [allUsers, setAllUsers] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(true);

  // نافذة منح الصلاحيات
  const [permModal, setPermModal] = useState<SearchUser | null>(null);
  const [grantPublish, setGrantPublish] = useState(false);
  const [grantManagement, setGrantManagement] = useState(false);
  const [granting, setGranting] = useState(false);

  // نافذة تأكيد السحب
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    action: string;
    targetUser?: SearchUser;
  }>({ show: false, title: "", message: "", action: "" });

  // طلبات ترقية المستويات
  const [levelRequests, setLevelRequests] = useState<any[]>([]);
  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(
    new Set(),
  );

  // ==================== تحميل كل المستخدمين ====================
  const loadAllUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users?limit=1000");
      const data = await res.json();
      if (data.success) setAllUsers(data.data || []);
    } catch {
      /* صامت */
    } finally {
      setLoading(false);
    }
  }, []);

  // ==================== تحميل طلبات ترقية المستويات ====================
  const loadLevelRequests = useCallback(async () => {
    try {
      const res = await fetch("/api/promotion/list?status=PENDING&limit=100");
      const data = await res.json();
      if (data.success) setLevelRequests(data.data || []);
    } catch {
      /* صامت */
    }
  }, []);

  useEffect(() => {
    loadAllUsers();
    loadLevelRequests();
  }, [loadAllUsers, loadLevelRequests]);

  // ==================== بحث ====================
  const searchUsers = async () => {
    if (!searchName.trim()) {
      showToast("أدخل اسم المستخدم", "warning");
      return;
    }
    setSearching(true);
    try {
      const params = new URLSearchParams();
      params.set("search", searchName.trim());
      if (userRole === "ADMIN" && searchLevel) params.set("level", searchLevel);
      if (userRole === "MANAGEMENT") params.set("level", userLevel);
      if (searchRole) params.set("role", searchRole);
      const res = await fetch(`/api/admin/users?${params}`);
      const data = await res.json();
      if (data.success) setSearchResults(data.data || []);
      else showToast("لم يتم العثور على نتائج", "warning");
    } catch {
      showToast("فشل البحث", "error");
    } finally {
      setSearching(false);
    }
  };

  // ==================== فتح نافذة الصلاحيات ====================
  const openPermModal = (targetUser: SearchUser) => {
    setPermModal(targetUser);
    setGrantPublish(!(targetUser.uploadPermissions?.length ?? 0));
    setGrantManagement(!targetUser.managementLevel);
  };

  // ==================== حفظ الصلاحيات ====================
  const savePermissions = async () => {
    if (!permModal) return;
    setGranting(true);
    try {
      // منح نشر
      if (grantPublish && !permModal.uploadPermissions?.length) {
        await csrfFetch("/api/admin/upgrade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: permModal.id }),
        });
      }
      // ترقية لإدارة
      if (grantManagement && !permModal.managementLevel) {
        const lvl =
          userRole === "MANAGEMENT"
            ? userLevel
            : searchLevel || permModal.level;
        await csrfFetch("/api/admin/upgrade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: permModal.id, managementLevel: lvl }),
        });
      }
      showToast(`✅ تم تحديث صلاحيات ${permModal.name}`, "success");
      setPermModal(null);
      setSearchResults([]);
      setSearchName("");
      loadAllUsers();
    } catch {
      showToast("فشل الحفظ", "error");
    } finally {
      setGranting(false);
    }
  };

  // ==================== سحب صلاحية نشر ====================
  const handleRevokePublish = (u: SearchUser) => {
    setConfirmModal({
      show: true,
      title: "سحب صلاحية النشر",
      message: `هل أنت متأكد من سحب صلاحية النشر من ${u.name}؟`,
      action: "revoke-publish",
      targetUser: u,
    });
  };
  const executeRevokePublish = async () => {
    const u = confirmModal.targetUser;
    setConfirmModal({ show: false, title: "", message: "", action: "" });
    if (!u?.uploadPermissions?.[0]) return;
    try {
      await csrfFetch("/api/admin/upgrade", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionId: u.uploadPermissions[0].id }),
      });
      showToast(`⚠️ تم سحب النشر من ${u.name}`, "warning");
      loadAllUsers();
    } catch {
      showToast("فشل", "error");
    }
  };

  // ==================== سحب رتبة إدارة ====================
  const handleRevokeManagement = (u: SearchUser) => {
    setConfirmModal({
      show: true,
      title: "سحب رتبة الإدارة",
      message: `هل أنت متأكد من سحب رتبة الإدارة من ${u.name}؟`,
      action: "revoke-management",
      targetUser: u,
    });
  };
  const executeRevokeManagement = async () => {
    const u = confirmModal.targetUser;
    setConfirmModal({ show: false, title: "", message: "", action: "" });
    if (!u) return;
    try {
      await csrfFetch("/api/admin/upgrade", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: u.id, action: "revoke-management" }),
      });
      showToast(`⚠️ تم سحب الإدارة من ${u.name}`, "warning");
      loadAllUsers();
    } catch {
      showToast("فشل", "error");
    }
  };

  // ==================== حذف كل الترقيات ====================
  const handleDeleteAll = (u: SearchUser) => {
    setConfirmModal({
      show: true,
      title: "حذف جميع الترقيات",
      message: `هل أنت متأكد من حذف جميع ترقيات ${u.name}؟`,
      action: "delete-all",
      targetUser: u,
    });
  };
  const executeDeleteAll = async () => {
    const u = confirmModal.targetUser;
    setConfirmModal({ show: false, title: "", message: "", action: "" });
    if (!u) return;
    try {
      if (u.uploadPermissions?.[0])
        await csrfFetch("/api/admin/upgrade", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ permissionId: u.uploadPermissions[0].id }),
        });
      if (u.managementLevel)
        await csrfFetch("/api/admin/upgrade", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: u.id, action: "revoke-management" }),
        });
      showToast(`🗑️ تم حذف جميع ترقيات ${u.name}`, "warning");
      loadAllUsers();
    } catch {
      showToast("فشل", "error");
    }
  };

  // ==================== طلبات ترقية المستويات ====================
  const toggleSelect = (id: string) => {
    const n = new Set(selectedRequests);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelectedRequests(n);
  };
  const handleLevelAction = async (action: "APPROVED" | "REJECTED") => {
    if (!selectedRequests.size) {
      showToast("اختر طلباً", "warning");
      return;
    }
    try {
      const res = await csrfFetch("/api/promotion/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestIds: Array.from(selectedRequests),
          action,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(
          `✅ ${action === "APPROVED" ? "تمت الموافقة" : "تم الرفض"}`,
          "success",
        );
        setSelectedRequests(new Set());
        loadLevelRequests();
      } else showToast(data.message, "error");
    } catch {
      showToast("فشل", "error");
    }
  };

  // ==================== أدوات ====================
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
  const hasPermissions = (u: SearchUser) =>
    (u.uploadPermissions?.length ?? 0) > 0 || !!u.managementLevel;

  const glassStyle: React.CSSProperties = {
    background: "rgba(10,20,40,0.5)",
    backdropFilter: "blur(25px)",
    WebkitBackdropFilter: "blur(25px)",
    border: "1px solid rgba(0,229,255,0.12)",
    borderRadius: "18px",
  };
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "11px 14px",
    background: "rgba(0,0,0,0.5)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "12px",
    color: "#e6edf3",
    fontSize: "0.9rem",
    fontFamily: "'Cairo', sans-serif",
    outline: "none",
  };

  // ==================== تجميع المرقّين حسب المستوى ====================
  const promotedByLevel: Record<string, SearchUser[]> = {};
  allUsers
    .filter((u) => hasPermissions(u))
    .forEach((u) => {
      const lvl = u.level || "unknown";
      if (!promotedByLevel[lvl]) promotedByLevel[lvl] = [];
      promotedByLevel[lvl].push(u);
    });

  const levelOrder = ["LEVEL_1", "LEVEL_2", "LEVEL_3", "LEVEL_4"];

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
                onClick={() =>
                  router.push(userRole === "ADMIN" ? "/admin" : "/management")
                }
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
              <h2
                style={{
                  color: "#00e5ff",
                  fontSize: "clamp(1.2rem,3vw,1.5rem)",
                  fontWeight: 800,
                  margin: 0,
                }}
              >
                🏆 إدارة الترقيات
              </h2>
            </div>
          </motion.div>

          {/* ========== منطقة البحث ========== */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ ...glassStyle, padding: "20px", marginBottom: "25px" }}
          >
            <div
              style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
                marginBottom: "15px",
              }}
            >
              {userRole === "ADMIN" && (
                <select
                  value={searchLevel}
                  onChange={(e) => setSearchLevel(e.target.value)}
                  style={{
                    ...inputStyle,
                    flex: 1,
                    minWidth: "130px",
                    cursor: "pointer",
                    appearance: "none",
                  }}
                >
                  <option value="">كل المستويات</option>
                  {levelOrder.map((l) => (
                    <option key={l} value={l}>
                      {getLevelLabel(l)}
                    </option>
                  ))}
                </select>
              )}
              {userRole === "ADMIN" && (
                <select
                  value={searchRole}
                  onChange={(e) => setSearchRole(e.target.value)}
                  style={{
                    ...inputStyle,
                    flex: 1,
                    minWidth: "130px",
                    cursor: "pointer",
                    appearance: "none",
                  }}
                >
                  <option value="">كل الهويات</option>
                  <option value="STUDENT">طالب</option>
                  <option value="TEACHER">معلم</option>
                </select>
              )}
              <input
                type="text"
                placeholder="🔍 اسم المستخدم..."
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchUsers()}
                style={{ ...inputStyle, flex: 2, minWidth: "180px" }}
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={searchUsers}
                disabled={searching}
                style={{
                  padding: "11px 20px",
                  borderRadius: "12px",
                  background: "linear-gradient(135deg,#00e5ff,#0077b6)",
                  border: "none",
                  color: "#010204",
                  fontWeight: 800,
                  cursor: "pointer",
                  fontFamily: "'Cairo', sans-serif",
                  opacity: searching ? 0.6 : 1,
                }}
              >
                <SearchIcon /> بحث
              </motion.button>
            </div>
            {searchResults.length > 0 && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: "6px" }}
              >
                {searchResults.map((u) => (
                  <motion.div
                    key={u.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{
                      ...glassStyle,
                      padding: "14px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "10px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <span
                        style={{ color: getRoleColor(u.role), fontWeight: 700 }}
                      >
                        {u.name}
                      </span>
                      <span style={{ color: "#8b949e", fontSize: "0.75rem" }}>
                        {getRoleLabel(u.role)} • {getLevelLabel(u.level)}
                      </span>
                      {hasPermissions(u) && (
                        <span
                          style={{
                            color: "#ffca28",
                            fontSize: "0.65rem",
                            background: "rgba(255,202,40,0.15)",
                            padding: "2px 8px",
                            borderRadius: "10px",
                          }}
                        >
                          ⭐ مرقّى
                        </span>
                      )}
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => openPermModal(u)}
                      style={{
                        padding: "6px 16px",
                        borderRadius: "10px",
                        background: "linear-gradient(135deg,#bf5af2,#7a00ff)",
                        border: "none",
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: "0.8rem",
                        cursor: "pointer",
                        fontFamily: "'Cairo', sans-serif",
                      }}
                    >
                      ⚙️ إضافة صلاحيات
                    </motion.button>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>

          {/* ========== سجل الترقيات حسب المستويات ========== */}
          <motion.h3
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ color: "#ffca28", fontSize: "1rem", marginBottom: "15px" }}
          >
            🏆 سجل الترقيات
          </motion.h3>
          {loading ? (
            <div style={{ textAlign: "center", padding: "30px" }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                style={{
                  width: "36px",
                  height: "36px",
                  border: "3px solid rgba(0,229,255,0.2)",
                  borderTopColor: "#00e5ff",
                  borderRadius: "50%",
                  margin: "0 auto",
                }}
              />
            </div>
          ) : Object.keys(promotedByLevel).length === 0 ? (
            <div
              style={{
                ...glassStyle,
                padding: "40px",
                textAlign: "center",
                color: "#8b949e",
              }}
            >
              📭 لا توجد حسابات مرقّاة
            </div>
          ) : (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "20px" }}
            >
              {levelOrder
                .filter((l) => promotedByLevel[l]?.length)
                .map((lvl) => (
                  <div key={lvl}>
                    <h4
                      style={{
                        color: "#00e5ff",
                        fontSize: "0.95rem",
                        marginBottom: "8px",
                        padding: "8px 16px",
                        background: "rgba(0,229,255,0.06)",
                        borderRadius: "10px",
                        display: "inline-block",
                      }}
                    >
                      📁 {getLevelLabel(lvl)}
                    </h4>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      {promotedByLevel[lvl].map((u) => (
                        <motion.div
                          key={u.id}
                          whileHover={{ borderColor: "rgba(255,202,40,0.3)" }}
                          style={{
                            ...glassStyle,
                            padding: "14px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: "10px",
                            border: "1px solid rgba(255,202,40,0.15)",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              flexWrap: "wrap",
                            }}
                          >
                            <span
                              style={{
                                color: "#ffca28",
                                fontWeight: 700,
                                fontSize: "0.95rem",
                              }}
                            >
                              {u.name}
                            </span>
                            <span
                              style={{
                                color: getRoleColor(u.role),
                                fontSize: "0.7rem",
                                background: "rgba(255,255,255,0.05)",
                                padding: "2px 8px",
                                borderRadius: "10px",
                              }}
                            >
                              {getRoleLabel(u.role)}
                            </span>
                            {u.uploadPermissions && u.uploadPermissions.length > 0 && (
                              <span
                                style={{
                                  color: "#bf5af2",
                                  fontSize: "0.65rem",
                                  background: "rgba(191,90,242,0.15)",
                                  padding: "2px 8px",
                                  borderRadius: "10px",
                                }}
                              >
                                📤 ناشر
                              </span>
                            )}
                            {u.managementLevel && (
                              <span
                                style={{
                                  color: "#ffca28",
                                  fontSize: "0.65rem",
                                  background: "rgba(255,202,40,0.15)",
                                  padding: "2px 8px",
                                  borderRadius: "10px",
                                }}
                              >
                                ⭐ إدارة
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              gap: "6px",
                              flexWrap: "wrap",
                            }}
                          >
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => openPermModal(u)}
                              style={{
                                padding: "5px 10px",
                                borderRadius: "8px",
                                background: "rgba(0,229,255,0.1)",
                                border: "1px solid rgba(0,229,255,0.2)",
                                color: "#00e5ff",
                                cursor: "pointer",
                                fontSize: "0.7rem",
                                fontWeight: 600,
                                fontFamily: "'Cairo', sans-serif",
                              }}
                            >
                              ⚙️ تعديل
                            </motion.button>
                            {u.managementLevel && (
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleRevokeManagement(u)}
                                style={{
                                  padding: "5px 10px",
                                  borderRadius: "8px",
                                  background: "rgba(248,81,73,0.1)",
                                  border: "1px solid rgba(248,81,73,0.2)",
                                  color: "#f85149",
                                  cursor: "pointer",
                                  fontSize: "0.7rem",
                                  fontWeight: 600,
                                  fontFamily: "'Cairo', sans-serif",
                                }}
                              >
                                🗑️ سحب الإدارة
                              </motion.button>
                            )}
                            {hasPermissions(u) && (
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleDeleteAll(u)}
                                style={{
                                  padding: "5px 10px",
                                  borderRadius: "8px",
                                  background: "rgba(248,81,73,0.15)",
                                  border: "1px solid rgba(248,81,73,0.3)",
                                  color: "#f85149",
                                  cursor: "pointer",
                                  fontSize: "0.7rem",
                                  fontWeight: 600,
                                  fontFamily: "'Cairo', sans-serif",
                                }}
                              >
                                🗑️ حذف الكل
                              </motion.button>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* ========== ترقية المستويات (للأدمن فقط) ========== */}
          {userRole === "ADMIN" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ marginTop: "30px" }}
            >
              <h3
                style={{
                  color: "#8b949e",
                  fontSize: "0.95rem",
                  marginBottom: "10px",
                }}
              >
                🎓 طلبات ترقية المستويات
              </h3>
              {selectedRequests.size > 0 && (
                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    marginBottom: "15px",
                    justifyContent: "center",
                  }}
                >
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleLevelAction("APPROVED")}
                    style={{
                      padding: "12px 24px",
                      borderRadius: "12px",
                      background: "linear-gradient(135deg,#238636,#2ea043)",
                      border: "none",
                      color: "#fff",
                      fontWeight: 800,
                      cursor: "pointer",
                      fontFamily: "'Cairo', sans-serif",
                    }}
                  >
                    ✅ موافقة ({selectedRequests.size})
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleLevelAction("REJECTED")}
                    style={{
                      padding: "12px 24px",
                      borderRadius: "12px",
                      background: "linear-gradient(135deg,#da3633,#f85149)",
                      border: "none",
                      color: "#fff",
                      fontWeight: 800,
                      cursor: "pointer",
                      fontFamily: "'Cairo', sans-serif",
                    }}
                  >
                    ❌ رفض ({selectedRequests.size})
                  </motion.button>
                </div>
              )}
              {levelRequests.length === 0 ? (
                <div
                  style={{
                    ...glassStyle,
                    padding: "20px",
                    textAlign: "center",
                    color: "#8b949e",
                    fontSize: "0.85rem",
                  }}
                >
                  لا توجد طلبات معلقة
                </div>
              ) : (
                <div style={{ ...glassStyle, overflow: "hidden" }}>
                  <div style={{ overflowX: "auto" }}>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: "0.85rem",
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            borderBottom: "1px solid rgba(255,255,255,0.06)",
                            background: "rgba(0,0,0,0.3)",
                          }}
                        >
                          <th
                            style={{
                              padding: "12px",
                              textAlign: "center",
                              color: "#8b949e",
                              fontSize: "0.75rem",
                            }}
                          >
                            اختيار
                          </th>
                          <th
                            style={{
                              padding: "12px",
                              textAlign: "right",
                              color: "#8b949e",
                              fontSize: "0.75rem",
                            }}
                          >
                            الاسم
                          </th>
                          <th
                            style={{
                              padding: "12px",
                              textAlign: "right",
                              color: "#8b949e",
                              fontSize: "0.75rem",
                            }}
                          >
                            من
                          </th>
                          <th
                            style={{
                              padding: "12px",
                              textAlign: "right",
                              color: "#8b949e",
                              fontSize: "0.75rem",
                            }}
                          >
                            إلى
                          </th>
                          <th
                            style={{
                              padding: "12px",
                              textAlign: "right",
                              color: "#8b949e",
                              fontSize: "0.75rem",
                            }}
                          >
                            التاريخ
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {levelRequests.map((req: any) => (
                          <tr
                            key={req.id}
                            style={{
                              borderBottom: "1px solid rgba(255,255,255,0.03)",
                            }}
                          >
                            <td
                              style={{ padding: "10px", textAlign: "center" }}
                            >
                              <input
                                type="checkbox"
                                checked={selectedRequests.has(req.id)}
                                onChange={() => toggleSelect(req.id)}
                                style={{
                                  accentColor: "#00e5ff",
                                  transform: "scale(1.2)",
                                  cursor: "pointer",
                                }}
                              />
                            </td>
                            <td
                              style={{
                                padding: "10px",
                                color: "#e6edf3",
                                fontWeight: 600,
                              }}
                            >
                              {req.user?.name || "—"}
                            </td>
                            <td
                              style={{
                                padding: "10px",
                                color: "#00e5ff",
                                fontSize: "0.75rem",
                              }}
                            >
                              {getLevelLabel(req.fromLevel)}
                            </td>
                            <td
                              style={{
                                padding: "10px",
                                color: "#39ff14",
                                fontSize: "0.75rem",
                              }}
                            >
                              {getLevelLabel(req.toLevel)}
                            </td>
                            <td
                              style={{
                                padding: "10px",
                                color: "#8b949e",
                                fontSize: "0.7rem",
                              }}
                            >
                              {new Date(req.createdAt).toLocaleDateString(
                                "ar-YE",
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </main>
      </PageTransition>
      <Footer />

      {/* ==================== نافذة الصلاحيات ==================== */}
      <AnimatePresence>
        {permModal && (
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
              background: "rgba(0,0,0,0.8)",
              backdropFilter: "blur(10px)",
              padding: "20px",
            }}
            onClick={() => setPermModal(null)}
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
                maxWidth: "450px",
                width: "100%",
                border: "1px solid rgba(191,90,242,0.3)",
                boxShadow: "0 0 60px rgba(191,90,242,0.15)",
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
                    color: "#bf5af2",
                    fontSize: "1.2rem",
                    fontWeight: 800,
                    margin: 0,
                  }}
                >
                  ⚙️ صلاحيات {permModal.name}
                </h3>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setPermModal(null)}
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
              <p
                style={{
                  color: "#8b949e",
                  fontSize: "0.8rem",
                  marginBottom: "20px",
                }}
              >
                {getRoleLabel(permModal.role)} •{" "}
                {getLevelLabel(permModal.level)}
              </p>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  marginBottom: "25px",
                }}
              >
                <motion.label
                  whileHover={{ scale: 1.01 }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "14px",
                    borderRadius: "12px",
                    background: grantPublish
                      ? "rgba(191,90,242,0.1)"
                      : "rgba(255,255,255,0.03)",
                    border: grantPublish
                      ? "1px solid #bf5af2"
                      : "1px solid rgba(255,255,255,0.08)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={grantPublish}
                    onChange={(e) => setGrantPublish(e.target.checked)}
                    style={{ accentColor: "#bf5af2", transform: "scale(1.3)" }}
                  />
                  <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                    📤 صلاحية النشر في المكتبة
                  </span>
                </motion.label>
                <motion.label
                  whileHover={{ scale: 1.01 }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "14px",
                    borderRadius: "12px",
                    background: grantManagement
                      ? "rgba(255,202,40,0.1)"
                      : "rgba(255,255,255,0.03)",
                    border: grantManagement
                      ? "1px solid #ffca28"
                      : "1px solid rgba(255,255,255,0.08)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={grantManagement}
                    onChange={(e) => setGrantManagement(e.target.checked)}
                    style={{ accentColor: "#ffca28", transform: "scale(1.3)" }}
                  />
                  <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                    ⭐ ترقية إلى رتبة إدارة
                  </span>
                </motion.label>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={savePermissions}
                disabled={granting}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: "12px",
                  border: "none",
                  background: "linear-gradient(135deg,#238636,#2ea043)",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: "1rem",
                  cursor: "pointer",
                  fontFamily: "'Cairo', sans-serif",
                  opacity: granting ? 0.6 : 1,
                  boxShadow: "0 8px 25px rgba(35,134,54,0.3)",
                }}
              >
                {granting ? "⏳..." : "💾 حفظ الصلاحيات"}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== نافذة تأكيد ==================== */}
      <AnimatePresence>
        {confirmModal.show && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 500,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.8)",
              backdropFilter: "blur(10px)",
              padding: "20px",
            }}
            onClick={() =>
              setConfirmModal({
                show: false,
                title: "",
                message: "",
                action: "",
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
                ...glassStyle,
                padding: "30px",
                maxWidth: "420px",
                width: "100%",
                textAlign: "center",
                border: "1px solid rgba(248,81,73,0.3)",
                boxShadow: "0 0 60px rgba(248,81,73,0.15)",
              }}
            >
              <div
                style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  background: "rgba(248,81,73,0.15)",
                  margin: "0 auto 15px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.8rem",
                }}
              >
                ⚠️
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
                      action: "",
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
                    fontFamily: "'Cairo', sans-serif",
                  }}
                >
                  إلغاء
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    if (confirmModal.action === "revoke-publish")
                      executeRevokePublish();
                    else if (confirmModal.action === "revoke-management")
                      executeRevokeManagement();
                    else if (confirmModal.action === "delete-all")
                      executeDeleteAll();
                  }}
                  style={{
                    flex: 1.5,
                    padding: "13px",
                    borderRadius: "12px",
                    background: "linear-gradient(135deg,#f85149,#da3633)",
                    border: "none",
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: 800,
                    fontFamily: "'Cairo', sans-serif",
                    boxShadow: "0 8px 25px rgba(248,81,73,0.3)",
                  }}
                >
                  نعم، تأكيد
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
