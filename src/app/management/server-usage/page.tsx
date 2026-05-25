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

interface FileItem {
  fileId: string;
  name: string;
  url: string;
  size: number;
  updatedAt: string;
  path?: string;
}
interface SubFolderData {
  files: FileItem[];
  totalFiles: number;
}

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
const FolderIcon = () => (
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
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);
const FileIcon = () => (
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
    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <polyline points="13 2 13 9 20 9" />
  </svg>
);

export default function ManagementServerUsagePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { showToast } = useToast();

  const userLevel = user?.level || "";
  const managementLevel = (user as any)?.managementLevel || "";
  const effectiveLevel = managementLevel || userLevel;

  const [levelData, setLevelData] = useState<
    Record<string, Record<string, SubFolderData>>
  >({});
  const [loading, setLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState("");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    show: boolean;
    fileId: string;
    fileName: string;
  }>({ show: false, fileId: "", fileName: "" });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/server/usage/folders");
      const data = await res.json();
      if (data.success) setLevelData(data.data || {});
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDeleteFile = (fileId: string, fileName: string) => {
    setDeleteConfirm({ show: true, fileId, fileName });
  };

  const executeDelete = async () => {
    const { fileId, fileName } = deleteConfirm;
    setDeleteConfirm({ show: false, fileId: "", fileName: "" });
    try {
      const res = await csrfFetch("/api/server/usage/files", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("🗑️ تم حذف الملف", "warning");
        loadData();
        setFiles(files.filter((f) => f.fileId !== fileId));
      } else showToast(data.message, "error");
    } catch {
      showToast("فشل الحذف", "error");
    }
  };

  const handleDownload = (url: string, name: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(`📥 جاري تحميل ${name}`, "success");
  };

  const getLevelLabel = (l: string) =>
    ({
      LEVEL_1: "المستوى الأول",
      LEVEL_2: "المستوى الثاني",
      LEVEL_3: "المستوى الثالث",
      LEVEL_4: "المستوى الرابع",
    })[l] || l;
  const formatSize = (bytes: number) =>
    bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(1)} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("ar-YE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  const glassStyle: React.CSSProperties = {
    background: "rgba(10,20,40,0.5)",
    backdropFilter: "blur(25px)",
    WebkitBackdropFilter: "blur(25px)",
    border: "1px solid rgba(0,229,255,0.12)",
    borderRadius: "18px",
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
            maxWidth: "1300px",
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
                onClick={() => router.push("/management")}
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
                  💻 استهلاك السيرفر
                </h2>
                <p
                  style={{
                    color: "#8b949e",
                    fontSize: "0.85rem",
                    margin: "4px 0 0",
                  }}
                >
                  ImageKit - التخزين السحابي
                </p>
              </div>
            </div>
          </motion.div>

          {currentPath ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "15px",
                  flexWrap: "wrap",
                }}
              >
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setCurrentPath("");
                    setFiles([]);
                  }}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "10px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#8b949e",
                    cursor: "pointer",
                    fontFamily: "'Cairo', sans-serif",
                    fontWeight: 600,
                  }}
                >
                  ⬅ رجوع
                </motion.button>
                <span
                  style={{
                    color: "#00e5ff",
                    fontWeight: 600,
                    fontSize: "0.9rem",
                  }}
                >
                  📁 {currentPath} • {files.length} ملفات
                </span>
              </div>
              {files.length === 0 ? (
                <div
                  style={{
                    ...glassStyle,
                    padding: "40px",
                    textAlign: "center",
                    color: "#8b949e",
                  }}
                >
                  📭 لا توجد ملفات
                </div>
              ) : (
                <>
                  <div
                    style={{
                      ...glassStyle,
                      overflow: "hidden",
                      display: "none",
                    }}
                    className="lg:block"
                  >
                    <div style={{ overflowX: "auto" }}>
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          fontSize: "0.82rem",
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
                                padding: "10px",
                                textAlign: "right",
                                color: "#8b949e",
                                fontSize: "0.7rem",
                              }}
                            >
                              اسم الملف
                            </th>
                            <th
                              style={{
                                padding: "10px",
                                textAlign: "center",
                                color: "#8b949e",
                                fontSize: "0.7rem",
                              }}
                            >
                              الحجم
                            </th>
                            <th
                              style={{
                                padding: "10px",
                                textAlign: "center",
                                color: "#8b949e",
                                fontSize: "0.7rem",
                              }}
                            >
                              التاريخ
                            </th>
                            <th
                              style={{
                                padding: "10px",
                                textAlign: "center",
                                color: "#8b949e",
                                fontSize: "0.7rem",
                              }}
                            >
                              المسار
                            </th>
                            <th
                              style={{
                                padding: "10px",
                                textAlign: "center",
                                color: "#8b949e",
                                fontSize: "0.7rem",
                              }}
                            >
                              إجراءات
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {files.map((f) => (
                            <tr
                              key={f.fileId}
                              style={{
                                borderBottom:
                                  "1px solid rgba(255,255,255,0.03)",
                                transition: "background 0.2s",
                              }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.background =
                                  "rgba(0,229,255,0.03)")
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.background =
                                  "transparent")
                              }
                            >
                              <td
                                style={{
                                  padding: "10px",
                                  color: "#e6edf3",
                                  fontSize: "0.8rem",
                                }}
                              >
                                📄{" "}
                                {f.name.length > 50
                                  ? f.name.slice(0, 50) + "..."
                                  : f.name}
                              </td>
                              <td
                                style={{
                                  padding: "10px",
                                  textAlign: "center",
                                  color: "#8b949e",
                                  fontSize: "0.75rem",
                                }}
                              >
                                {formatSize(f.size)}
                              </td>
                              <td
                                style={{
                                  padding: "10px",
                                  textAlign: "center",
                                  color: "#8b949e",
                                  fontSize: "0.7rem",
                                }}
                              >
                                {formatDate(f.updatedAt)}
                              </td>
                              <td
                                style={{
                                  padding: "10px",
                                  textAlign: "center",
                                  color: "#5a6a7a",
                                  fontSize: "0.65rem",
                                  direction: "ltr",
                                }}
                              >
                                {(f.path || "/").slice(0, 40)}
                              </td>
                              <td
                                style={{ padding: "8px", textAlign: "center" }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    gap: "5px",
                                    justifyContent: "center",
                                  }}
                                >
                                  <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => window.open(f.url, "_blank")}
                                    style={{
                                      padding: "5px 9px",
                                      borderRadius: "6px",
                                      background: "rgba(0,229,255,0.1)",
                                      border: "1px solid rgba(0,229,255,0.2)",
                                      color: "#00e5ff",
                                      cursor: "pointer",
                                      fontSize: "0.65rem",
                                      fontFamily: "'Cairo', sans-serif",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    👁 فتح
                                  </motion.button>
                                  <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() =>
                                      handleDownload(f.url, f.name)
                                    }
                                    style={{
                                      padding: "5px 9px",
                                      borderRadius: "6px",
                                      background: "rgba(46,160,67,0.1)",
                                      border: "1px solid rgba(46,160,67,0.2)",
                                      color: "#2ea043",
                                      cursor: "pointer",
                                      fontSize: "0.65rem",
                                      fontFamily: "'Cairo', sans-serif",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    📥 تحميل
                                  </motion.button>
                                  <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() =>
                                      handleDeleteFile(f.fileId, f.name)
                                    }
                                    style={{
                                      padding: "5px 9px",
                                      borderRadius: "6px",
                                      background: "rgba(248,81,73,0.1)",
                                      border: "1px solid rgba(248,81,73,0.2)",
                                      color: "#f85149",
                                      cursor: "pointer",
                                      fontSize: "0.65rem",
                                      fontFamily: "'Cairo', sans-serif",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    🗑 حذف
                                  </motion.button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div
                    className="lg:hidden"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <AnimatePresence mode="popLayout">
                      {files.map((f, i) => (
                        <motion.div
                          key={f.fileId}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.02 }}
                          whileHover={{ borderColor: "rgba(0,229,255,0.3)" }}
                          style={{
                            ...glassStyle,
                            padding: "14px 16px",
                            transition: "border-color 0.3s",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: "10px",
                              marginBottom: "10px",
                            }}
                          >
                            <FileIcon />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p
                                style={{
                                  color: "#e6edf3",
                                  fontWeight: 600,
                                  fontSize: "0.85rem",
                                  margin: "0 0 4px",
                                  wordBreak: "break-word",
                                }}
                              >
                                {f.name}
                              </p>
                              <div
                                style={{
                                  display: "flex",
                                  gap: "8px",
                                  flexWrap: "wrap",
                                  fontSize: "0.7rem",
                                  color: "#8b949e",
                                }}
                              >
                                <span>{formatSize(f.size)}</span>
                                <span>{formatDate(f.updatedAt)}</span>
                              </div>
                            </div>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              gap: "6px",
                              flexWrap: "wrap",
                            }}
                          >
                            <motion.button
                              whileHover={{ scale: 1.03 }}
                              whileTap={{ scale: 0.97 }}
                              onClick={() => window.open(f.url, "_blank")}
                              style={{
                                flex: 1,
                                padding: "8px",
                                borderRadius: "8px",
                                background: "rgba(0,229,255,0.1)",
                                border: "1px solid rgba(0,229,255,0.2)",
                                color: "#00e5ff",
                                cursor: "pointer",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                fontFamily: "'Cairo', sans-serif",
                                textAlign: "center",
                              }}
                            >
                              👁 فتح
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.03 }}
                              whileTap={{ scale: 0.97 }}
                              onClick={() => handleDownload(f.url, f.name)}
                              style={{
                                flex: 1,
                                padding: "8px",
                                borderRadius: "8px",
                                background: "rgba(46,160,67,0.1)",
                                border: "1px solid rgba(46,160,67,0.2)",
                                color: "#2ea043",
                                cursor: "pointer",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                fontFamily: "'Cairo', sans-serif",
                                textAlign: "center",
                              }}
                            >
                              📥 تحميل
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.03 }}
                              whileTap={{ scale: 0.97 }}
                              onClick={() => handleDeleteFile(f.fileId, f.name)}
                              style={{
                                flex: 1,
                                padding: "8px",
                                borderRadius: "8px",
                                background: "rgba(248,81,73,0.1)",
                                border: "1px solid rgba(248,81,73,0.2)",
                                color: "#f85149",
                                cursor: "pointer",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                fontFamily: "'Cairo', sans-serif",
                                textAlign: "center",
                              }}
                            >
                              🗑 حذف
                            </motion.button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </>
              )}
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {loading ? (
                <div style={{ textAlign: "center", padding: "50px" }}>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    style={{
                      width: "40px",
                      height: "40px",
                      border: "3px solid rgba(0,229,255,0.2)",
                      borderTopColor: "#00e5ff",
                      borderRadius: "50%",
                      margin: "0 auto",
                    }}
                  />
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "20px",
                  }}
                >
                  {[effectiveLevel].map((lvl) => {
                    const levelFolders = levelData[lvl] || {};
                    const subFolders = Object.keys(levelFolders);
                    return (
                      <div key={lvl}>
                        <motion.h3
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          style={{
                            color: "#00e5ff",
                            fontSize: "1rem",
                            marginBottom: "12px",
                            padding: "8px 16px",
                            background: "rgba(0,229,255,0.06)",
                            borderRadius: "10px",
                            display: "inline-block",
                          }}
                        >
                          📁 {getLevelLabel(lvl)}
                        </motion.h3>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                          }}
                        >
                          {subFolders.length === 0 ? (
                            <div
                              style={{
                                ...glassStyle,
                                padding: "16px 20px",
                                textAlign: "center",
                                color: "#8b949e",
                                fontSize: "0.85rem",
                              }}
                            >
                              📭 لا توجد ملفات
                            </div>
                          ) : (
                            subFolders.map((subName: string, idx: number) => {
                              const subData = levelFolders[subName];
                              return (
                                <motion.div
                                  key={subName}
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: idx * 0.05 }}
                                  whileHover={{
                                    scale: 1.02,
                                    borderColor: "rgba(0,229,255,0.4)",
                                    boxShadow: "0 8px 30px rgba(0,229,255,0.1)",
                                  }}
                                  onClick={() => {
                                    setFiles(subData.files || []);
                                    setCurrentPath(
                                      `${getLevelLabel(lvl)} > ${subName}`,
                                    );
                                  }}
                                  style={{
                                    ...glassStyle,
                                    padding: "16px 20px",
                                    cursor: "pointer",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    flexWrap: "wrap",
                                    gap: "10px",
                                    transition: "all 0.3s",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "10px",
                                    }}
                                  >
                                    <motion.div
                                      animate={{ rotate: [0, 5, 0] }}
                                      transition={{
                                        repeat: Infinity,
                                        duration: 2,
                                      }}
                                      style={{
                                        width: "40px",
                                        height: "40px",
                                        borderRadius: "12px",
                                        background: "rgba(0,229,255,0.1)",
                                        border: "1px solid rgba(0,229,255,0.2)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: "1.2rem",
                                      }}
                                    >
                                      <FolderIcon />
                                    </motion.div>
                                    <span
                                      style={{
                                        color: "#e6edf3",
                                        fontWeight: 600,
                                        fontSize: "0.9rem",
                                      }}
                                    >
                                      {subName}
                                    </span>
                                  </div>
                                  <span
                                    style={{
                                      color: "#00e5ff",
                                      fontSize: "0.8rem",
                                      fontWeight: 700,
                                      background: "rgba(0,229,255,0.1)",
                                      padding: "4px 12px",
                                      borderRadius: "20px",
                                    }}
                                  >
                                    {subData.totalFiles} ملفات
                                  </span>
                                </motion.div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </main>
      </PageTransition>

      <AnimatePresence>
        {deleteConfirm.show && (
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
              setDeleteConfirm({ show: false, fileId: "", fileName: "" })
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
                تأكيد الحذف
              </h3>
              <p
                style={{
                  color: "#8b949e",
                  fontSize: "0.9rem",
                  marginBottom: "25px",
                }}
              >
                هل أنت متأكد من حذف "{deleteConfirm.fileName}"؟
              </p>
              <div style={{ display: "flex", gap: "10px" }}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() =>
                    setDeleteConfirm({ show: false, fileId: "", fileName: "" })
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
                  onClick={executeDelete}
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
                  نعم، احذف
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <Footer />
    </div>
  );
}
