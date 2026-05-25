"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Sidebar from "@/components/layout/Sidebar";
import PageTransition from "@/components/layout/PageTransition";
import { useAuth } from "@/hooks/useAuth";
import { useSupabaseRealtime } from "@/hooks/useSupabaseRealtime";
import { deriveStaticChannelName } from "@/lib/realtimeChannels";
import { useToast } from "@/components/ui/Toast";

interface SharedFile {
  id: string;
  fileName: string;
  language: string;
  fileUrl: string;
  authorName: string;
  showAuthor: boolean;
  level: string;
  createdAt: string;
  authorId: string;
}

const LEVELS = ["LEVEL_1", "LEVEL_2", "LEVEL_3", "LEVEL_4"];
const LEVEL_LABELS: Record<string, string> = {
  LEVEL_1: "المستوى الأول",
  LEVEL_2: "المستوى الثاني",
  LEVEL_3: "المستوى الثالث",
  LEVEL_4: "المستوى الرابع",
};
const LANG_ICONS: Record<string, string> = {
  cpp: "⚡",
  csharp: "🔷",
  python: "🐍",
  html: "🌐",
};

export default function SharedFilesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLevel, setActiveLevel] = useState<string>("LEVEL_1");

  const effectiveRole =
    user?.role === "ADMIN"
      ? "ADMIN"
      : user?.managementLevel
        ? "MANAGEMENT"
        : user?.role;
  const userLevel = user?.level || "LEVEL_1";
  const isAdminOrManagement =
    effectiveRole === "ADMIN" || effectiveRole === "MANAGEMENT";
  const availableLevels = effectiveRole === "ADMIN" ? LEVELS : [userLevel];

  const loadFiles = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/code-editor/shared-list?level=${activeLevel}`,
      );
      const data = await res.json();
      if (data.success) {
        setFiles(data.data);
      }
    } catch (err) {
      console.error("Load shared files error:", err);
    } finally {
      setLoading(false);
    }
  }, [activeLevel]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  useSupabaseRealtime(deriveStaticChannelName("code-editor"), "file-shared", () => {
    loadFiles();
    showToast("📢 تمت مشاركة ملف جديد", "info");
  });

  const handleView = (file: SharedFile) => {
    window.open(file.fileUrl, "_blank");
  };

  const handleRun = (file: SharedFile) => {
    fetch(file.fileUrl)
      .then((r) => r.text())
      .then((code) => {
        if (file.language === "html") {
          const blob = new Blob([code], { type: "text/html" });
          window.open(
            URL.createObjectURL(blob),
            "_blank",
            "width=1024,height=768",
          );
        } else {
          showToast("التشغيل متاح فقط لملفات HTML من هنا", "warning");
        }
      })
      .catch(() => showToast("فشل تحميل الملف", "error"));
  };

  const handleDownload = (file: SharedFile) => {
    const a = document.createElement("a");
    a.href = file.fileUrl;
    a.download = file.fileName;
    a.click();
    showToast("📥 تم التنزيل", "success");
  };

  const handleDelete = async (file: SharedFile) => {
    if (!confirm("هل أنت متأكد من حذف هذا الملف؟")) return;
    try {
      const res = await fetch("/api/code-editor/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: file.id }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("🗑️ تم الحذف", "warning");
        loadFiles();
      } else {
        showToast(data.error || "فشل الحذف", "error");
      }
    } catch {
      showToast("فشل الاتصال", "error");
    }
  };

  const handleToggleAuthor = async (file: SharedFile) => {
    try {
      const res = await fetch("/api/code-editor/share", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: file.id, showAuthor: !file.showAuthor }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(
          file.showAuthor ? "🙈 تم إخفاء الاسم" : "👁 تم إظهار الاسم",
          "success",
        );
        loadFiles();
      }
    } catch {
      showToast("فشل الاتصال", "error");
    }
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
      <Sidebar />
      <PageTransition>
        <main
          style={{
            padding: "90px 12px 50px",
            maxWidth: "1100px",
            margin: "0 auto",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          {/* الهيدر */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "20px",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={() => router.push("/code-editor")}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "10px",
                padding: "8px 14px",
                color: "#8b949e",
                cursor: "pointer",
                fontSize: "0.85rem",
                fontFamily: "'Cairo', sans-serif",
              }}
            >
              ⬅ رجوع
            </button>
            <h2
              style={{
                color: "#bf5af2",
                fontSize: "clamp(1.1rem, 4vw, 1.5rem)",
                fontWeight: 800,
                margin: 0,
                textShadow: "0 0 20px rgba(191,90,242,0.3)",
              }}
            >
              📂 الملفات المشتركة
            </h2>
          </div>

          {/* أيقونات المستويات (للأدمن فقط) */}
          {effectiveRole === "ADMIN" && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                marginBottom: "20px",
              }}
            >
              {availableLevels.map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setActiveLevel(lvl)}
                  style={{
                    background:
                      activeLevel === lvl
                        ? "rgba(191,90,242,0.12)"
                        : "rgba(255,255,255,0.03)",
                    border: `1.5px solid ${activeLevel === lvl ? "rgba(191,90,242,0.5)" : "rgba(255,255,255,0.1)"}`,
                    borderRadius: "12px",
                    padding: "8px 14px",
                    color: activeLevel === lvl ? "#bf5af2" : "#8b949e",
                    cursor: "pointer",
                    fontSize: "clamp(0.75rem, 3vw, 0.85rem)",
                    fontWeight: activeLevel === lvl ? 700 : 500,
                    fontFamily: "'Cairo', sans-serif",
                    transition: "all 0.2s",
                  }}
                >
                  {LEVEL_LABELS[lvl]}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div
              style={{ textAlign: "center", padding: "60px", color: "#8b949e" }}
            >
              ⏳ جاري التحميل...
            </div>
          ) : files.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "60px",
                background: "rgba(13,17,23,0.6)",
                border: "1px solid rgba(48,54,61,0.4)",
                borderRadius: "14px",
              }}
            >
              <div style={{ fontSize: "3rem", marginBottom: "10px" }}>📭</div>
              <p style={{ color: "#8b949e" }}>لا توجد ملفات مشتركة بعد</p>
            </div>
          ) : (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "10px" }}
            >
              {files.map((file, idx) => (
                <motion.div
                  key={file.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  style={{
                    background: "rgba(13,17,23,0.85)",
                    backdropFilter: "blur(12px)",
                    border: "1px solid rgba(48,54,61,0.45)",
                    borderRadius: "14px",
                    padding: "14px 16px",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "10px",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: "1.5rem" }}>
                    {LANG_ICONS[file.language] || "📄"}
                  </span>
                  <div style={{ flex: 1, minWidth: "150px" }}>
                    <div
                      style={{
                        color: "#e6edf3",
                        fontWeight: 600,
                        fontSize: "0.9rem",
                        wordBreak: "break-word",
                      }}
                    >
                      {file.fileName}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        flexWrap: "wrap",
                        marginTop: "2px",
                      }}
                    >
                      <span style={{ color: "#8b949e", fontSize: "0.7rem" }}>
                        {LEVEL_LABELS[file.level] || file.level}
                      </span>
                      {(isAdminOrManagement || file.showAuthor) && (
                        <span
                          style={{
                            color: "#00e5ff",
                            fontSize: "0.7rem",
                            fontWeight: 600,
                          }}
                        >
                          👤 {file.authorName}
                          {!file.showAuthor && isAdminOrManagement && (
                            <span
                              style={{ color: "#f85149", marginLeft: "4px" }}
                            >
                              (مخفي)
                            </span>
                          )}
                        </span>
                      )}
                      <span style={{ color: "#8b949e", fontSize: "0.7rem" }}>
                        {new Date(file.createdAt).toLocaleDateString("ar-YE")}
                      </span>
                    </div>
                  </div>
                  <div
                    style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}
                  >
                    <button
                      onClick={() => handleRun(file)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: "8px",
                        border: "1px solid rgba(46,160,67,0.3)",
                        background: "rgba(46,160,67,0.08)",
                        color: "#2ea043",
                        cursor: "pointer",
                        fontSize: "0.75rem",
                        fontFamily: "'Cairo', sans-serif",
                      }}
                    >
                      ▶ تشغيل
                    </button>
                    <button
                      onClick={() => handleView(file)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: "8px",
                        border: "1px solid rgba(0,229,255,0.3)",
                        background: "rgba(0,229,255,0.08)",
                        color: "#00e5ff",
                        cursor: "pointer",
                        fontSize: "0.75rem",
                        fontFamily: "'Cairo', sans-serif",
                      }}
                    >
                      👁 فتح
                    </button>
                    <button
                      onClick={() => handleDownload(file)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: "8px",
                        border: "1px solid rgba(255,202,40,0.3)",
                        background: "rgba(255,202,40,0.08)",
                        color: "#ffca28",
                        cursor: "pointer",
                        fontSize: "0.75rem",
                        fontFamily: "'Cairo', sans-serif",
                      }}
                    >
                      📥 تحميل
                    </button>
                    {isAdminOrManagement && (
                      <>
                        <button
                          onClick={() => handleToggleAuthor(file)}
                          style={{
                            padding: "6px 10px",
                            borderRadius: "8px",
                            border: "1px solid rgba(191,90,242,0.3)",
                            background: "rgba(191,90,242,0.08)",
                            color: "#bf5af2",
                            cursor: "pointer",
                            fontSize: "0.75rem",
                            fontFamily: "'Cairo', sans-serif",
                          }}
                        >
                          {file.showAuthor ? "🙈" : "👁"}
                        </button>
                        <button
                          onClick={() => handleDelete(file)}
                          style={{
                            padding: "6px 10px",
                            borderRadius: "8px",
                            border: "1px solid rgba(248,81,73,0.3)",
                            background: "rgba(248,81,73,0.08)",
                            color: "#f85149",
                            cursor: "pointer",
                            fontSize: "0.75rem",
                            fontFamily: "'Cairo', sans-serif",
                          }}
                        >
                          🗑
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </main>
      </PageTransition>
    </div>
  );
}
