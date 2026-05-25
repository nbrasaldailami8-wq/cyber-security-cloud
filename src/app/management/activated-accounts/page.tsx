"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import PageTransition from "@/components/layout/PageTransition";

export default function ManagementActivatedAccountsPage() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const role = localStorage.getItem("userRole");
    if (role !== "MANAGEMENT" && role !== "ADMIN") { router.push("/login"); return; }
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const level = localStorage.getItem("userLevel") || "LEVEL_1";
      const res = await fetch(`/api/admin/users?level=${level}`);
      const data = await res.json();
      if (data.success) setUsers(data.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const filteredUsers = filter === "all" ? users : users.filter((u: any) =>
    filter === "active" ? u.isActivated : !u.isActivated
  );

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      ADMIN: "#ff3131",
      MANAGEMENT: "#ffca28",
      TEACHER: "#bf5af2",
      STUDENT: "#00e5ff",
    };
    return { color: colors[role] || "#8b949e", label: role };
  };

  const glassCard: React.CSSProperties = {
    background: "rgba(13, 17, 23, 0.92)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(0, 229, 255, 0.2)",
    borderRadius: "16px",
    padding: "24px",
  };

  return (
    <div className="min-h-screen bg-[#010204]" style={{ fontFamily: "'Cairo', sans-serif" }}>
      <Header />
      <Sidebar />
      <PageTransition>
      <div className="relative z-10 pr-0 lg:pr-[20px] p-4 lg:p-8 pt-[100px] max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-white mb-2 text-center">الحسابات المفعلة</h1>
          <p className="text-[#8b949e] text-sm mb-6 text-center">عرض وإدارة حسابات المستخدمين</p>

          <div className="flex gap-3 mb-6 justify-center">
            {["all", "active", "pending"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: "8px 20px",
                  borderRadius: "10px",
                  border: `1px solid ${filter === f ? "#00e5ff" : "rgba(255,255,255,0.1)"}`,
                  background: filter === f ? "rgba(0,229,255,0.1)" : "transparent",
                  color: filter === f ? "#00e5ff" : "#8b949e",
                  fontFamily: "'Cairo', sans-serif",
                  cursor: "pointer",
                  fontWeight: filter === f ? 700 : 400,
                }}
              >
                {f === "all" ? "الكل" : f === "active" ? "مفعل" : "غير مفعل"}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-center py-20">
              <div className="animate-spin w-10 h-10 border-2 border-[#00e5ff] border-t-transparent rounded-full mx-auto" />
            </div>
          ) : (
            <div style={glassCard}>
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <th className="p-3 text-[#8b949e] text-sm">الاسم</th>
                      <th className="p-3 text-[#8b949e] text-sm">البريد</th>
                      <th className="p-3 text-[#8b949e] text-sm">الدور</th>
                      <th className="p-3 text-[#8b949e] text-sm">الحالة</th>
                      <th className="p-3 text-[#8b949e] text-sm">تاريخ التسجيل</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user: any) => (
                      <tr key={user.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                        <td className="p-3 text-white">{user.name}</td>
                        <td className="p-3 text-[#8b949e] text-sm">{user.email}</td>
                        <td className="p-3">
                          <span style={{
                            padding: "4px 12px",
                            borderRadius: "8px",
                            background: `${getRoleBadge(user.role).color}15`,
                            color: getRoleBadge(user.role).color,
                            fontSize: "0.8rem",
                          }}>
                            {getRoleBadge(user.role).label === "ADMIN"
                              ? "أدمن"
                              : getRoleBadge(user.role).label === "MANAGEMENT"
                                ? "إدارة"
                                : getRoleBadge(user.role).label === "TEACHER"
                                  ? "معلم"
                                  : "طالب"}
                          </span>
                        </td>
                        <td className="p-3">
                          <span style={{
                            padding: "4px 12px",
                            borderRadius: "8px",
                            background: user.isActivated ? "rgba(46,160,67,0.1)" : "rgba(255,202,40,0.1)",
                            color: user.isActivated ? "#2ea043" : "#ffca28",
                            fontSize: "0.8rem",
                          }}>
                            {user.isActivated ? "مفعل" : "غير مفعل"}
                          </span>
                        </td>
                        <td className="p-3 text-[#8b949e] text-xs">
                          {new Date(user.createdAt).toLocaleDateString("ar-YE")}
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-[#8b949e]">
                          لا يوجد مستخدمين
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </motion.div>
      </div>
      </PageTransition>
    </div>
  );
}
