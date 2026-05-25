"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { csrfFetch } from "@/lib/csrfClient";
import { motion } from "framer-motion";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import PageTransition from "@/components/layout/PageTransition";

export default function ManagementUpgradePage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const role = localStorage.getItem("userRole");
    if (role !== "MANAGEMENT" && role !== "ADMIN") { router.push("/login"); return; }
  }, []);

  const handleUpgrade = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await csrfFetch("/api/admin/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setMessage(data.success ? `✅ ${data.message}` : `❌ ${data.message}`);
      if (data.success) setEmail("");
    } catch {
      setMessage("❌ فشل الاتصال");
    } finally {
      setLoading(false);
    }
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
      <div className="relative z-10 pr-0 lg:pr-[20px] p-4 lg:p-8 pt-[100px] max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-white mb-2 text-center">ترقية المستخدمين</h1>
          <p className="text-[#8b949e] text-sm mb-8 text-center">منح صلاحية النشر في المكتبة التعليمية</p>

          <div style={glassCard}>
            {message && (
              <div style={{
                padding: "12px",
                borderRadius: "12px",
                marginBottom: "15px",
                background: message.startsWith("✅") ? "rgba(46,160,67,0.1)" : "rgba(248,81,73,0.1)",
                border: `1px solid ${message.startsWith("✅") ? "#2ea043" : "#f85149"}`,
                color: message.startsWith("✅") ? "#2ea043" : "#f85149",
                textAlign: "center",
              }}>
                {message}
              </div>
            )}

            <label className="text-[#8b949e] text-sm block mb-2">البريد الإلكتروني للمستخدم</label>
            <input
              type="email"
              placeholder="example@cybersec.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                padding: "13px 15px",
                marginBottom: "16px",
                background: "rgba(0,0,0,0.5)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#fff",
                borderRadius: "14px",
                fontSize: "0.95rem",
                fontFamily: "'Cairo', sans-serif",
              }}
            />
            <button
              onClick={handleUpgrade}
              disabled={loading || !email.trim()}
              style={{
                width: "100%",
                padding: "14px",
                border: "none",
                borderRadius: "14px",
                background: "linear-gradient(135deg, #bf5af2, #7a00ff)",
                color: "#fff",
                fontWeight: 700,
                fontSize: "1rem",
                fontFamily: "'Cairo', sans-serif",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "⚡ جاري..." : "⬆️ ترقية المستخدم"}
            </button>
          </div>
        </motion.div>
      </div>
      </PageTransition>
    </div>
  );
}
