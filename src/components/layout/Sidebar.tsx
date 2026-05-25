"use client";

import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useUIStore } from "@/store/uiStore";

interface MenuItem {
  label: string;
  icon: string;
  path: string;
  roles: string[];
  color?: string;
}

const allMenuItems: MenuItem[] = [
  {
    label: "الرئيسية",
    icon: "🏠",
    path: "/dashboard",
    roles: ["ADMIN", "MANAGEMENT", "TEACHER", "STUDENT"],
    color: "#00e5ff",
  },
  {
    label: "سجل الإشعارات",
    icon: "🔔",
    path: "/notifications",
    roles: ["ADMIN", "MANAGEMENT", "TEACHER", "STUDENT"],
    color: "#ffca28",
  },
  {
    label: "المكتبة التعليمية",
    icon: "📚",
    path: "/library",
    roles: ["ADMIN", "MANAGEMENT", "TEACHER", "STUDENT"],
    color: "#00e5ff",
  },
  {
    label: "محرر الأكواد",
    icon: "💻",
    path: "/code-editor",
    roles: ["ADMIN", "MANAGEMENT", "TEACHER", "STUDENT"],
    color: "#00e5ff",
  },
  {
    label: "المحادثة",
    icon: "💬",
    path: "/chat",
    roles: ["ADMIN", "MANAGEMENT", "TEACHER", "STUDENT"],
    color: "#39ff14",
  },
  {
    label: "إدارة التوليد",
    icon: "🏗️",
    path: "/admin/generation",
    roles: ["ADMIN", "MANAGEMENT"],
    color: "#bf5af2",
  },
  {
    label: "سجل العمليات",
    icon: "📜",
    path: "/admin/audit-log",
    roles: ["ADMIN"],
    color: "#ffca28",
  },
  {
    label: "سجل العمليات",
    icon: "📜",
    path: "/management/audit-log",
    roles: ["MANAGEMENT"],
    color: "#ffca28",
  },
  {
    label: "المهام المنجزة",
    icon: "📋",
    path: "/teacher/audit-log",
    roles: ["TEACHER"],
    color: "#bf5af2",
  },
  {
    label: "ترقية المستخدمين",
    icon: "⬆️",
    path: "/admin/promotions",
    roles: ["ADMIN", "MANAGEMENT"],
    color: "#ff6b6b",
  },
  {
    label: "استهلاك السيرفر",
    icon: "💻",
    path: "/admin/server-usage",
    roles: ["ADMIN"],
    color: "#39ff14",
  },
  {
    label: "استهلاك السيرفر",
    icon: "💻",
    path: "/management/server-usage",
    roles: ["MANAGEMENT"],
    color: "#39ff14",
  },
  {
    label: "حسابات مفعلة",
    icon: "✅",
    path: "/admin/activated-accounts",
    roles: ["ADMIN", "MANAGEMENT"],
    color: "#2ea043",
  },
  {
    label: "رادار الأخطاء",
    icon: "🛡️",
    path: "/admin/security-radar",
    roles: ["ADMIN"],
    color: "#f85149",
  },
  {
    label: "إدارة الترم",
    icon: "📅",
    path: "/admin/semester",
    roles: ["ADMIN", "MANAGEMENT"],
    color: "#bf5af2",
  },

  {
    label: "نشر تعميم",
    icon: "📢",
    path: "/announcements/create",
    roles: ["ADMIN", "MANAGEMENT", "TEACHER"],
    color: "#ff3131",
  },
  {
    label: "توزيع الدرجات",
    icon: "📝",
    path: "/teacher/grades",
    roles: ["TEACHER"],
    color: "#bf5af2",
  },
  {
    label: "إعدادات الحساب",
    icon: "⚙️",
    path: "/settings",
    roles: ["ADMIN", "MANAGEMENT", "TEACHER", "STUDENT"],
    color: "#8b949e",
  },
];

const adminPages = [
  "/admin",
  "/admin/generation",
  "/admin/activated-accounts",
  "/admin/audit-log",
  "/admin/security-radar",
  "/admin/semester",
  "/admin/server-usage",
  "/admin/promotions",
  "/admin/upgrade",
];

export default function Sidebar() {
  const { sidebarOpen: isOpen, toggleSidebar, setSidebarOpen } = useUIStore();
  const { user, role, level, managementLevel } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const userRole = role || "STUDENT";
  const userLevel = level || "";

  // ==================== الأدوار الفعالة ====================
  const validManagementLevels = ["LEVEL_1", "LEVEL_2", "LEVEL_3", "LEVEL_4"];
  const hasValidManagement =
    managementLevel &&
    managementLevel !== "null" &&
    managementLevel !== "undefined" &&
    validManagementLevels.includes(managementLevel);

  const effectiveRoles = [userRole];
  if (hasValidManagement) effectiveRoles.push("MANAGEMENT");

  // ==================== فلترة القائمة مع منع التكرار ====================
  const seenLabels = new Set<string>();
  const filteredMenu = allMenuItems.filter((item) => {
    if (!effectiveRoles.some((r) => item.roles.includes(r))) return false;
    if (seenLabels.has(item.label)) return false;
    seenLabels.add(item.label);
    return true;
  });

  // ==================== التسميات ====================
  const getRoleLabel = () => {
    const labels: Record<string, string> = {
      ADMIN: "👑 الأدمن",
      MANAGEMENT: "🏢 الإدارة",
      TEACHER: "👨‍🏫 معلم",
      STUDENT: "🎓 طالب",
    };
    return labels[userRole] || "مستخدم";
  };

  const getLevelLabel = (lvl?: string) => {
    const labels: Record<string, string> = {
      LEVEL_1: "المستوى الأول",
      LEVEL_2: "المستوى الثاني",
      LEVEL_3: "المستوى الثالث",
      LEVEL_4: "المستوى الرابع",
    };
    return lvl ? labels[lvl] || lvl : "";
  };

  const getManagementLevelLabel = () => {
    if (!managementLevel) return "";
    const labels: Record<string, string> = {
      LEVEL_1: "إدارة م1",
      LEVEL_2: "إدارة م2",
      LEVEL_3: "إدارة م3",
      LEVEL_4: "إدارة م4",
    };
    return labels[managementLevel] || "";
  };

  // ==================== تسجيل الخروج ====================
  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  // ==================== الواجهة ====================
  return (
    <>
      {/* زر فتح القائمة */}
      <motion.button
        onClick={toggleSidebar}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        style={{
          position: "fixed",
          top: "80px",
          right: "15px",
          zIndex: 150,
          width: "44px",
          height: "44px",
          borderRadius: "14px",
          background: isOpen ? "rgba(248,81,73,0.2)" : "rgba(0,229,255,0.12)",
          border: isOpen
            ? "1px solid rgba(248,81,73,0.4)"
            : "1px solid rgba(0,229,255,0.3)",
          color: isOpen ? "#f85149" : "#00e5ff",
          fontSize: "1.3rem",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backdropFilter: "blur(15px)",
          WebkitBackdropFilter: "blur(15px)",
          boxShadow: isOpen
            ? "0 4px 20px rgba(248,81,73,0.2)"
            : "0 4px 20px rgba(0,229,255,0.2)",
          transition: "all 0.3s",
        }}
        title={isOpen ? "إغلاق القائمة" : "فتح القائمة"}
      >
        {isOpen ? "✕" : "☰"}
      </motion.button>

      {/* القائمة الجانبية */}
      <motion.div
        animate={{ right: isOpen ? 0 : "-290px" }}
        transition={{ type: "spring", damping: 25, stiffness: 250 }}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          width: "285px",
          height: "100vh",
          zIndex: 140,
          background: "rgba(8, 16, 30, 0.97)",
          backdropFilter: "blur(30px)",
          WebkitBackdropFilter: "blur(30px)",
          borderLeft: "1px solid rgba(0, 229, 255, 0.12)",
          display: "flex",
          flexDirection: "column",
          padding: "85px 0 15px",
          overflowY: "auto",
          overflowX: "hidden",
          boxShadow: isOpen ? "0 0 80px rgba(0,0,0,0.5)" : "none",
        }}
      >
        {/* بطاقة المستخدم */}
        <div
          style={{
            padding: "0 16px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            marginBottom: "8px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "10px",
            }}
          >
            <motion.div
              animate={{
                boxShadow: managementLevel
                  ? [
                      "0 0 15px rgba(255,202,40,0.4)",
                      "0 0 25px rgba(255,202,40,0.2)",
                      "0 0 15px rgba(255,202,40,0.4)",
                    ]
                  : [
                      "0 0 15px rgba(0,229,255,0.3)",
                      "0 0 20px rgba(0,229,255,0.15)",
                      "0 0 15px rgba(0,229,255,0.3)",
                    ],
              }}
              transition={{ repeat: Infinity, duration: 2 }}
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "14px",
                background: managementLevel
                  ? "rgba(255,202,40,0.15)"
                  : "rgba(0,229,255,0.1)",
                border: `2px solid ${managementLevel ? "#ffca28" : "#00e5ff"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.3rem",
                fontWeight: 800,
                color: managementLevel ? "#ffca28" : "#00e5ff",
                flexShrink: 0,
              }}
            >
              {user?.name?.charAt(0) || "م"}
            </motion.div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  color: "#e6edf3",
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  margin: 0,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {user?.name || "المستخدم"}
              </p>
              <p
                style={{
                  color: "#00e5ff",
                  fontSize: "0.75rem",
                  margin: "2px 0 0",
                }}
              >
                {getRoleLabel()}
              </p>
            </div>
          </div>

          {/* شارات المستوى والإدارة */}
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {userLevel && (
              <span
                style={{
                  padding: "3px 10px",
                  borderRadius: "20px",
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  background: "rgba(0,229,255,0.1)",
                  color: "#00e5ff",
                  border: "1px solid rgba(0,229,255,0.2)",
                }}
              >
                {getLevelLabel(userLevel)}
              </span>
            )}
            {hasValidManagement && userRole !== "ADMIN" && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring" }}
                style={{
                  padding: "3px 10px",
                  borderRadius: "20px",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  background: "rgba(255,202,40,0.12)",
                  color: "#ffca28",
                  border: "1px solid rgba(255,202,40,0.3)",
                }}
              >
                ⭐ {getManagementLevelLabel()}
              </motion.span>
            )}
          </div>
        </div>

        {/* قائمة الأيقونات */}
        <nav style={{ flex: 1, padding: "0 8px" }}>
          <AnimatePresence mode="popLayout">
            {filteredMenu.map((item, index) => {
              const isActive =
                pathname === item.path ||
                (item.path !== "/dashboard" && pathname.startsWith(item.path));
              const isAdminPath = adminPages.some((p) =>
                pathname.startsWith(p),
              );
              const isManagementSection =
                item.roles.includes("MANAGEMENT") &&
                effectiveRoles.includes("MANAGEMENT") &&
                userRole !== "MANAGEMENT";

              return (
                <motion.button
                  key={item.label}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  whileHover={{
                    scale: 1.02,
                    background: isActive ? undefined : "rgba(255,255,255,0.04)",
                  }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    router.push(item.path);
                    setSidebarOpen(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    width: "100%",
                    padding: "11px 14px",
                    marginBottom: "3px",
                    borderRadius: "12px",
                    border: "none",
                    background: isActive
                      ? "rgba(0,229,255,0.1)"
                      : "transparent",
                    color: isActive ? "#00e5ff" : "#8b949e",
                    fontSize: "0.88rem",
                    fontFamily: "'Cairo', sans-serif",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    textAlign: "right",
                    position: "relative",
                    borderLeft: isActive
                      ? "3px solid #00e5ff"
                      : "3px solid transparent",
                  }}
                >
                  {/* شارة إدارة للعناصر المضافة */}
                  {isManagementSection && (
                    <span
                      style={{
                        position: "absolute",
                        top: "4px",
                        left: "8px",
                        fontSize: "0.5rem",
                        color: "#ffca28",
                        opacity: 0.8,
                      }}
                    >
                      ⭐
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: "1.2rem",
                      width: "28px",
                      textAlign: "center",
                      flexShrink: 0,
                    }}
                  >
                    {item.icon}
                  </span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {isActive && (
                    <motion.span
                      layoutId="activeDot"
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background: "#00e5ff",
                        boxShadow: "0 0 10px #00e5ff",
                        flexShrink: 0,
                      }}
                    />
                  )}
                </motion.button>
              );
            })}
          </AnimatePresence>
        </nav>

        {/* زر تسجيل الخروج */}
        <div
          style={{
            padding: "10px 12px",
            borderTop: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <motion.button
            whileHover={{ scale: 1.02, background: "rgba(248,81,73,0.1)" }}
            whileTap={{ scale: 0.97 }}
            onClick={handleLogout}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              width: "100%",
              padding: "11px 14px",
              borderRadius: "12px",
              border: "none",
              background: "transparent",
              color: "#f85149",
              fontSize: "0.88rem",
              fontFamily: "'Cairo', sans-serif",
              cursor: "pointer",
              textAlign: "right",
            }}
          >
            <span
              style={{ fontSize: "1.1rem", width: "28px", textAlign: "center" }}
            >
              🚪
            </span>
            <span>تسجيل الخروج</span>
          </motion.button>
        </div>
      </motion.div>

      {/* خلفية شفافة عند فتح القائمة */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 130,
              background: "rgba(0,0,0,0.65)",
              backdropFilter: "blur(6px)",
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
