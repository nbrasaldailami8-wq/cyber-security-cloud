"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Sidebar from "@/components/layout/Sidebar";
import { useToast } from "@/components/ui/Toast";
import PageTransition from "@/components/layout/PageTransition";
import { useAuthStore } from "@/store/authStore";

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

const glassStyle: React.CSSProperties = {
  background: "rgba(10,20,40,0.5)",
  backdropFilter: "blur(25px)",
  WebkitBackdropFilter: "blur(25px)",
  border: "1px solid rgba(0,229,255,0.12)",
  borderRadius: "18px",
};

export default function GenerationHub() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { showToast } = useToast();

  const userRole = user?.role || "";
  const userLevel = user?.level || "";
  const managementLevel = (user as any)?.managementLevel || "";
  const isAdmin = userRole === "ADMIN";
  const effectiveLevel = managementLevel || userLevel;

  const sections = [
    {
      id: "students",
      icon: "👨‍🎓",
      title: "توليد حسابات الطلاب",
      desc: "إدخال أسماء الطلاب وتوليد أكواد التفعيل مع سجل كامل",
      color: "#00e5ff",
      href: "/admin/generation/students",
      allowed: true,
    },
    {
      id: "subjects",
      icon: "📚",
      title: "توليد المواد الدراسية",
      desc: "إضافة مواد دراسية مع توليد حسابات المعلمين وأكواد التفعيل",
      color: "#bf5af2",
      href: "/admin/generation/subjects",
      allowed: true,
    },
    {
      id: "management",
      icon: "👔",
      title: "توليد حسابات الإدارة",
      desc: "توليد حسابات إدارة للمستويات الدراسية مع أكواد التفعيل",
      color: "#ffca28",
      href: "/admin/generation/management",
      allowed: isAdmin,
    },
  ];

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
            maxWidth: "1000px",
            margin: "0 auto",
            padding: "100px 20px 60px",
          }}
        >
          {/* الهيدر */}
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
                onClick={() => router.push(isAdmin ? "/admin" : "/management")}
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
                    fontSize: "clamp(1.2rem,3vw,1.5rem)",
                    fontWeight: 800,
                    margin: 0,
                  }}
                >
                  🏗️ إدارة التوليد
                </h2>
                <p
                  style={{
                    color: "#8b949e",
                    fontSize: "0.85rem",
                    margin: "4px 0 0",
                  }}
                >
                  {isAdmin
                    ? "الأدمن - جميع المستويات"
                    : `الإدارة - ${effectiveLevel === "LEVEL_1" ? "المستوى الأول" : "المستوى الثاني"}`}
                </p>
              </div>
            </div>
          </motion.div>

          {/* أيقونات سريعة */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "16px",
              marginBottom: "30px",
              flexWrap: "wrap",
            }}
          >
            {sections
              .filter((s) => s.allowed)
              .map((section) => (
                <motion.button
                  key={section.id}
                  whileHover={{ scale: 1.08, y: -5 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => router.push(section.href)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "14px 28px",
                    background: `linear-gradient(135deg, ${section.color}22, transparent)`,
                    border: `1px solid ${section.color}44`,
                    borderRadius: "14px",
                    color: section.color,
                    fontSize: "1rem",
                    fontWeight: 700,
                    fontFamily: "'Cairo', sans-serif",
                    cursor: "pointer",
                    transition: "all 0.3s",
                    boxShadow: `0 0 20px ${section.color}11`,
                  }}
                >
                  <span style={{ fontSize: "1.8rem" }}>{section.icon}</span>
                  <span>{section.title}</span>
                  <span
                    style={{
                      background: `${section.color}22`,
                      padding: "2px 8px",
                      borderRadius: "20px",
                      fontSize: "0.7rem",
                      color: section.color,
                    }}
                  >
                    {isAdmin
                      ? "الأدمن"
                      : effectiveLevel === "LEVEL_1"
                        ? "المستوى الأول"
                        : "المستوى الثاني"}
                  </span>
                </motion.button>
              ))}
          </motion.div>

          {/* البطاقات */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "24px",
            }}
          >
            {sections
              .filter((s) => s.allowed)
              .map((section, i) => (
                <motion.button
                  key={section.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  whileHover={{
                    scale: 1.03,
                    y: -6,
                    boxShadow: `0 15px 40px ${section.color}22`,
                  }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => router.push(section.href)}
                  style={{
                    ...glassStyle,
                    padding: "35px 25px",
                    cursor: "pointer",
                    textAlign: "center",
                    border: `1px solid ${section.color}22`,
                    transition: "all 0.3s",
                  }}
                >
                  <motion.div
                    animate={{ y: [0, -10, 0] }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    style={{ fontSize: "3.5rem", marginBottom: "16px" }}
                  >
                    {section.icon}
                  </motion.div>
                  <h3
                    style={{
                      color: section.color,
                      fontSize: "1.3rem",
                      fontWeight: 800,
                      marginBottom: "8px",
                    }}
                  >
                    {section.title}
                  </h3>
                  <p
                    style={{
                      color: "#8b949e",
                      fontSize: "0.9rem",
                      lineHeight: 1.6,
                    }}
                  >
                    {section.desc}
                  </p>
                </motion.button>
              ))}
          </motion.div>
        </main>
      </PageTransition>
      <Footer />
    </div>
  );
}
