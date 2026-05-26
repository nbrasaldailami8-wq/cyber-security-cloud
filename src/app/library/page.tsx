"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Sidebar from "@/components/layout/Sidebar";
import { useToast } from "@/components/ui/Toast";
import PageTransition from "@/components/layout/PageTransition";
import Pagination from "@/components/ui/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { csrfFetch } from "@/lib/csrfClient";
import { useAuthStore } from "@/store/authStore";
import { APP_CONFIG } from "@/config";
import { useSupabaseRealtime } from "@/hooks/useSupabaseRealtime";
import { deriveStaticChannelName } from "@/lib/realtimeChannels";

// ==================== الأنواع ====================
type ContentType =
  | "PDF"
  | "DOCX"
  | "XLSX"
  | "PNG"
  | "JPG"
  | "YOUTUBE_LINK"
  | "MP3"
  | "WAV";

interface ContentItem {
  id: string;
  title: string;
  description?: string;
  type: ContentType;
  fileUrl?: string;
  youtubeUrl?: string;
  fileSize?: number;
  level: string;
  semester: string;
  subjectId?: string;
  publisherId: string;
  createdAt: string;
  publisher: { id: string; name: string; role: string };
  subject?: { id: string; name: string };
}

interface Subject {
  id: string;
  name: string;
  code: string;
}

// ==================== الأيقونات SVG ====================
const UploadIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const FilterIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

const ShieldIcon = () => (
  <svg
    width="22"
    height="22"
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

const PlayIcon = () => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="currentColor"
    opacity="0.9"
  >
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const ExpandIcon = () => (
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
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);

const DownloadIcon = () => (
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
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const EditIcon = () => (
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
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
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
    width="20"
    height="20"
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
export default function LibraryPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { showToast } = useToast();

  // البيانات
  const [content, setContent] = useState<ContentItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  // النوافذ المنبثقة
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [currentVideo, setCurrentVideo] = useState<{
    url: string;
    title: string;
  } | null>(null);

  // الفلترة
  const [filterType, setFilterType] = useState<string>("");
  const [filterSubject, setFilterSubject] = useState<string>("");
  const [filterSearch, setFilterSearch] = useState("");

  // الترقيم
  const pag = usePagination(1, APP_CONFIG.itemsPerPage);

  // نافذة النشر
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDesc, setUploadDesc] = useState("");
  const [uploadType, setUploadType] = useState<"material" | "general">(
    "general",
  );
  const [uploadSubjectId, setUploadSubjectId] = useState("");
  const [uploadYoutubeUrl, setUploadYoutubeUrl] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTargetLevel, setUploadTargetLevel] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // التعديل
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editSubjectId, setEditSubjectId] = useState("");

  const userRole = user?.role || "";
  const userLevel = user?.level || "";
  const userId = user?.id || "";

  useSupabaseRealtime(deriveStaticChannelName(`library-level-${userLevel}`), "new-content", () => {
    loadContent();
  });
  useSupabaseRealtime(deriveStaticChannelName(`library-level-${userLevel}`), "content-deleted", () => {
    loadContent();
  });
  // ==================== تحميل المحتوى ====================
  const loadContent = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterType) params.set("type", filterType);
      if (filterSubject) params.set("subjectId", filterSubject);
      if (filterSearch) params.set("search", filterSearch);
      params.set("page", String(pag.page));
      params.set("limit", String(pag.limit));

      const res = await fetch(`/api/library/content?${params}`);
      const data = await res.json();
      if (data.success) {
        setContent(data.data);
        pag.setTotal(data.total || 0);
      }
    } catch {
      // صامت
    } finally {
      setLoading(false);
    }
  }, [filterType, filterSubject, filterSearch, pag.page, pag.limit]);

  // ==================== تحميل المواد ====================
  const loadSubjects = useCallback(async () => {
    if (!userLevel) return;
    try {
      const res = await fetch(`/api/subjects/active?level=${userLevel}`);
      const data = await res.json();
      if (data.success && data.data?.length) {
        setSubjects(data.data);
      }
    } catch {
      // صامت
    }
  }, [userLevel]);

  useEffect(() => {
    loadContent();
    loadSubjects();
  }, [loadContent, loadSubjects]);

  // ==================== النشر ====================
  const handleUpload = async () => {
    if (!uploadTitle.trim()) {
      showToast("يرجى إدخال عنوان المنشور", "warning");
      return;
    }

    if (uploadType === "general" && !uploadYoutubeUrl.trim()) {
      showToast("يرجى إدخال رابط اليوتيوب", "warning");
      return;
    }

    if (uploadType === "material" && !uploadFile && !uploadYoutubeUrl.trim()) {
      showToast("يرجى إرفاق ملف أو رابط فيديو", "warning");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("title", uploadTitle.trim());
      formData.append("description", uploadDesc.trim());
      formData.append("uploadType", uploadType);
      if (uploadSubjectId) formData.append("subjectId", uploadSubjectId);
      if (uploadYoutubeUrl.trim())
        formData.append("youtubeUrl", uploadYoutubeUrl.trim());
      if (uploadFile) formData.append("file", uploadFile);
      if (userRole === "ADMIN" && uploadTargetLevel)
        formData.append("targetLevel", uploadTargetLevel);

      // محاكاة شريط التقدم
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 15, 90));
      }, 300);

      const res = await csrfFetch("/api/library/upload", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const data = await res.json();
      if (data.success) {
        showToast("تم نشر المحتوى بنجاح 🚀", "success");
        resetUploadForm();
        setShowUploadModal(false);
        loadContent();
      } else {
        showToast(data.message || "فشل النشر", "error");
      }
    } catch {
      showToast("فشل الاتصال بالخادم", "error");
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 500);
    }
  };

  const resetUploadForm = () => {
    setUploadTitle("");
    setUploadDesc("");
    setUploadType("general");
    setUploadSubjectId("");
    setUploadYoutubeUrl("");
    setUploadFile(null);
    setUploadProgress(0);
  };

  // ==================== التعديل ====================
  const handleEdit = (item: ContentItem) => {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditDesc(item.description || "");
    setEditSubjectId(item.subjectId || "");
  };

  const handleSaveEdit = async () => {
    if (!editingItem || !editTitle.trim()) return;
    try {
      const res = await csrfFetch(`/api/library/content`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingItem.id,
          title: editTitle.trim(),
          description: editDesc.trim(),
          subjectId: editSubjectId || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("تم تعديل المنشور بنجاح", "success");
        setEditingItem(null);
        loadContent();
      } else {
        showToast(data.message || "فشل التعديل", "error");
      }
    } catch {
      showToast("فشل الاتصال بالخادم", "error");
    }
  };

  // ==================== الحذف ====================
  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا المنشور؟")) return;
    try {
      const res = await csrfFetch(`/api/library/content`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("تم حذف المنشور", "warning");
        loadContent();
      } else {
        showToast(data.message || "فشل الحذف", "error");
      }
    } catch {
      showToast("فشل الاتصال بالخادم", "error");
    }
  };

  // ==================== استخراج ID اليوتيوب ====================
  const getYoutubeId = (url: string): string | null => {
    if (!url) return null;
    const patterns = [
      /(?:youtube\.com\/watch\?v=)([^&]+)/,
      /(?:youtu\.be\/)([^?]+)/,
      /(?:youtube\.com\/embed\/)([^?]+)/,
      /(?:youtube\.com\/shorts\/)([^?]+)/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  // ==================== استخراج عنوان اليوتيوب تلقائياً ====================
  useEffect(() => {
    if (uploadYoutubeUrl && !uploadTitle) {
      const id = getYoutubeId(uploadYoutubeUrl);
      if (id) {
        setUploadTitle("فيديو تعليمي");
      }
    }
  }, [uploadYoutubeUrl]);

  useEffect(() => {
    if (userRole === "ADMIN" && uploadTargetLevel) {
      fetch(`/api/subjects/active?level=${uploadTargetLevel}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.success) setSubjects(res.data || []);
        })
        .catch(() => {});
    }
  }, [uploadTargetLevel, userRole]);

  // ==================== أدوات العرض ====================
  const getTypeIcon = (type: string): string => {
    const icons: Record<string, string> = {
      PDF: "📄",
      DOCX: "📝",
      XLSX: "📊",
      PNG: "🖼️",
      JPG: "🖼️",
      YOUTUBE_LINK: "▶️",
      MP3: "🎵",
      WAV: "🎵",
    };
    return icons[type] || "📁";
  };

  const getTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      PDF: "ملف PDF",
      DOCX: "مستند Word",
      XLSX: "جدول Excel",
      PNG: "صورة",
      JPG: "صورة",
      YOUTUBE_LINK: "فيديو تعليمي",
      MP3: "ملف صوتي",
      WAV: "ملف صوتي",
    };
    return labels[type] || "ملف";
  };

  const formatSize = (bytes?: number): string => {
    if (!bytes) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const formatDate = (date: string): string => {
    return new Date(date).toLocaleDateString("ar-YE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getLevelLabel = (level: string): string => {
    const labels: Record<string, string> = {
      LEVEL_1: "المستوى الأول",
      LEVEL_2: "المستوى الثاني",
      LEVEL_3: "المستوى الثالث",
      LEVEL_4: "المستوى الرابع",
    };
    return labels[level] || level;
  };

  const [userHasUploadPermission, setUserHasUploadPermission] = useState(false);

  useEffect(() => {
    const checkPermission = async () => {
      if (
        userRole === "ADMIN" ||
        userRole === "MANAGEMENT" ||
        userRole === "TEACHER"
      ) {
        setUserHasUploadPermission(true);
        return;
      }
      try {
        const res = await fetch("/api/settings/profile");
        const data = await res.json();
        if (data.success && data.user?.uploadPermissions?.length > 0) {
          setUserHasUploadPermission(true);
        }
      } catch {
        setUserHasUploadPermission(false);
      }
    };
    if (userId) checkPermission();
  }, [userId, userRole]);

  const canPublish = userHasUploadPermission;
  const canManagePermissions =
    userRole === "ADMIN" || userRole === "MANAGEMENT";

  // ==================== التنسيقات العامة ====================
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
    transition: "all 0.3s",
  };

  const btnPrimary: React.CSSProperties = {
    width: "100%",
    padding: "13px",
    background: "linear-gradient(135deg, #00e5ff, #0077b6)",
    color: "#010204",
    border: "none",
    borderRadius: "14px",
    fontWeight: 800,
    fontSize: "1rem",
    cursor: "pointer",
    fontFamily: "'Cairo', sans-serif",
    transition: "all 0.3s",
    letterSpacing: "0.5px",
  };

  // ==================== الواجهة ====================
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
            paddingTop: "90px",
            paddingBottom: "60px",
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
              <div style={{ fontSize: "2rem" }}>📚</div>
              <div>
                <h2
                  style={{
                    color: "#00e5ff",
                    fontSize: "clamp(1.2rem, 3vw, 1.8rem)",
                    fontWeight: 800,
                    margin: 0,
                  }}
                >
                  المكتبة التعليمية
                </h2>
                <p
                  style={{
                    color: "#8b949e",
                    fontSize: "0.85rem",
                    margin: "4px 0 0",
                  }}
                >
                  {getLevelLabel(userLevel)}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {/* أيقونة الفلترة */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowFilterModal(true)}
                style={{
                  padding: "12px 18px",
                  background: "rgba(0, 229, 255, 0.08)",
                  border: "1px solid rgba(0, 229, 255, 0.25)",
                  borderRadius: "14px",
                  color: "#00e5ff",
                  cursor: "pointer",
                  fontFamily: "'Cairo', sans-serif",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "0.9rem",
                }}
              >
                <FilterIcon /> فلترة
              </motion.button>

              {/* أيقونة ترقية الحسابات */}
              {canManagePermissions && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => router.push("/library/permissions")}
                  style={{
                    padding: "12px 18px",
                    background: "rgba(122, 0, 255, 0.1)",
                    border: "1px solid rgba(122, 0, 255, 0.3)",
                    borderRadius: "14px",
                    color: "#bf5af2",
                    cursor: "pointer",
                    fontFamily: "'Cairo', sans-serif",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "0.9rem",
                  }}
                >
                  <ShieldIcon /> ترقية الحسابات
                </motion.button>
              )}

              {/* أيقونة نشر منشور */}
              {canPublish && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    resetUploadForm();
                    loadSubjects();
                    setShowUploadModal(true);
                  }}
                  style={{
                    padding: "12px 24px",
                    background: "linear-gradient(135deg, #00e5ff, #0099cc)",
                    border: "none",
                    borderRadius: "14px",
                    color: "#010204",
                    cursor: "pointer",
                    fontFamily: "'Cairo', sans-serif",
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "0.95rem",
                    boxShadow: "0 8px 30px rgba(0, 229, 255, 0.2)",
                  }}
                >
                  <UploadIcon /> نشر منشور
                </motion.button>
              )}
            </div>
          </motion.div>

          {/* ========== البطاقات ========== */}
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
              <p>جاري تحميل المكتبة...</p>
            </div>
          ) : content.length === 0 ? (
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
                المكتبة فارغة
              </h3>
              <p style={{ color: "#5a6a7a" }}>
                لا يوجد محتوى حالياً في هذا المستوى الدراسي
              </p>
            </motion.div>
          ) : (
            <motion.div
              layout
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: "20px",
              }}
            >
              <AnimatePresence mode="popLayout">
                {content.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ duration: 0.4, type: "spring" }}
                    whileHover={{
                      y: -5,
                      boxShadow: "0 20px 50px rgba(0, 229, 255, 0.15)",
                    }}
                    style={{
                      ...glassStyle,
                      overflow: "hidden",
                      cursor: "default",
                    }}
                  >
                    {/* محتوى البطاقة - صورة أو فيديو */}
                    {item.type === "YOUTUBE_LINK" &&
                      (item.youtubeUrl || item.fileUrl) && (
                        <div
                          style={{
                            position: "relative",
                            width: "100%",
                            paddingTop: "56.25%",
                            background: "#000",
                          }}
                        >
                          <iframe
                            src={`https://www.youtube.com/embed/${getYoutubeId(item.youtubeUrl || item.fileUrl || "")}`}
                            style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              width: "100%",
                              height: "100%",
                              border: "none",
                            }}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            title={item.title}
                          />
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() =>
                              setCurrentVideo({
                                url: item.youtubeUrl || item.fileUrl || "",
                                title: item.title,
                              })
                            }
                            style={{
                              position: "absolute",
                              top: "10px",
                              right: "10px",
                              width: "36px",
                              height: "36px",
                              borderRadius: "50%",
                              background: "rgba(0,0,0,0.7)",
                              border: "1px solid rgba(255,255,255,0.3)",
                              color: "#fff",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              zIndex: 5,
                            }}
                          >
                            <ExpandIcon />
                          </motion.button>
                        </div>
                      )}

                    {(item.type === "PNG" || item.type === "JPG") &&
                      item.fileUrl && (
                        <div
                          style={{
                            width: "100%",
                            height: "220px",
                            overflow: "hidden",
                            borderBottom: "1px solid rgba(255,255,255,0.05)",
                          }}
                        >
                          <img
                            src={item.fileUrl}
                            alt={item.title}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                        </div>
                      )}

                    {(item.type === "MP3" || item.type === "WAV") &&
                      item.fileUrl && (
                        <div
                          style={{
                            padding: "15px",
                            borderBottom: "1px solid rgba(255,255,255,0.05)",
                          }}
                        >
                          <audio
                            controls
                            style={{ width: "100%", borderRadius: "10px" }}
                          >
                            <source
                              src={item.fileUrl}
                              type={
                                item.type === "MP3" ? "audio/mpeg" : "audio/wav"
                              }
                            />
                          </audio>
                        </div>
                      )}

                    {/* جسم البطاقة */}
                    <div style={{ padding: "20px" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "12px",
                          marginBottom: "12px",
                        }}
                      >
                        <span style={{ fontSize: "2.2rem", lineHeight: 1 }}>
                          {getTypeIcon(item.type)}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h3
                            style={{
                              fontWeight: 700,
                              fontSize: "1rem",
                              margin: "0 0 4px",
                              color: "#e6edf3",
                              wordBreak: "break-word",
                            }}
                          >
                            {item.title}
                          </h3>
                          {item.description && (
                            <p
                              style={{
                                color: "#8b949e",
                                fontSize: "0.8rem",
                                margin: 0,
                                lineHeight: 1.5,
                              }}
                            >
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* الوسوم */}
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
                            background: "rgba(0,229,255,0.1)",
                            color: "#00e5ff",
                            padding: "4px 10px",
                            borderRadius: "20px",
                            fontSize: "0.7rem",
                            fontWeight: 600,
                          }}
                        >
                          {getTypeLabel(item.type)}
                        </span>
                        {item.subject && (
                          <span
                            style={{
                              background: "rgba(191,90,242,0.1)",
                              color: "#bf5af2",
                              padding: "4px 10px",
                              borderRadius: "20px",
                              fontSize: "0.7rem",
                              fontWeight: 600,
                            }}
                          >
                            📘 {item.subject.name}
                          </span>
                        )}
                        {item.fileSize && (
                          <span
                            style={{
                              background: "rgba(255,255,255,0.05)",
                              color: "#8b949e",
                              padding: "4px 10px",
                              borderRadius: "20px",
                              fontSize: "0.7rem",
                            }}
                          >
                            {formatSize(item.fileSize)}
                          </span>
                        )}
                      </div>

                      {/* معلومات الناشر + التاريخ */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "12px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <div
                            style={{
                              width: "32px",
                              height: "32px",
                              borderRadius: "50%",
                              background:
                                item.publisher.role === "TEACHER"
                                  ? "rgba(191,90,242,0.2)"
                                  : item.publisher.role === "ADMIN"
                                    ? "rgba(255,49,49,0.2)"
                                    : "rgba(0,229,255,0.2)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 800,
                              fontSize: "0.8rem",
                              color:
                                item.publisher.role === "TEACHER"
                                  ? "#bf5af2"
                                  : item.publisher.role === "ADMIN"
                                    ? "#ff3131"
                                    : "#00e5ff",
                            }}
                          >
                            {item.publisher.name.charAt(0)}
                          </div>
                          <div>
                            <p
                              style={{
                                fontSize: "0.8rem",
                                fontWeight: 700,
                                color: "#e6edf3",
                                margin: 0,
                              }}
                            >
                              {item.publisher.name}
                            </p>
                            <p
                              style={{
                                fontSize: "0.7rem",
                                color: "#8b949e",
                                margin: 0,
                              }}
                            >
                              {formatDate(item.createdAt)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* الأزرار */}
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          flexWrap: "wrap",
                        }}
                      >
                        {item.type !== "YOUTUBE_LINK" && item.fileUrl && (
                          <a
                            href={item.fileUrl}
                            download
                            style={{
                              flex: 1,
                              textAlign: "center",
                              textDecoration: "none",
                              padding: "10px",
                              borderRadius: "10px",
                              background: "rgba(0,229,255,0.08)",
                              border: "1px solid rgba(0,229,255,0.2)",
                              color: "#00e5ff",
                              fontWeight: 700,
                              fontSize: "0.8rem",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "6px",
                            }}
                          >
                            <DownloadIcon /> تحميل
                          </a>
                        )}

                        {item.type === "YOUTUBE_LINK" &&
                          (item.youtubeUrl || item.fileUrl) && (
                            <a
                              href={item.youtubeUrl || item.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                flex: 1,
                                textAlign: "center",
                                textDecoration: "none",
                                padding: "10px",
                                borderRadius: "10px",
                                background: "rgba(255,0,0,0.1)",
                                border: "1px solid rgba(255,0,0,0.2)",
                                color: "#ff4444",
                                fontWeight: 700,
                                fontSize: "0.8rem",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "6px",
                              }}
                            >
                              ▶️ فتح في اليوتيوب
                            </a>
                          )}

                        {/* أزرار التعديل والحذف لصاحب المنشور أو الأدمن */}
                        {(item.publisherId === userId ||
                          userRole === "ADMIN") && (
                          <>
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleEdit(item)}
                              style={{
                                padding: "10px",
                                borderRadius: "10px",
                                background: "rgba(255,202,40,0.1)",
                                border: "1px solid rgba(255,202,40,0.2)",
                                color: "#ffca28",
                                cursor: "pointer",
                                fontWeight: 700,
                                fontSize: "0.8rem",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <EditIcon />
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleDelete(item.id)}
                              style={{
                                padding: "10px",
                                borderRadius: "10px",
                                background: "rgba(248,81,73,0.1)",
                                border: "1px solid rgba(248,81,73,0.2)",
                                color: "#f85149",
                                cursor: "pointer",
                                fontWeight: 700,
                                fontSize: "0.8rem",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <DeleteIcon />
                            </motion.button>
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ========== الترقيم ========== */}
          {content.length > 0 && (
            <div style={{ marginTop: "30px" }}>
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

      {/* ==================== نافذة النشر ==================== */}
      <AnimatePresence>
        {showUploadModal && (
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
              background: "rgba(0,0,0,0.75)",
              backdropFilter: "blur(10px)",
              padding: "20px",
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowUploadModal(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 30 }}
              transition={{ type: "spring", damping: 20, stiffness: 200 }}
              style={{
                ...glassStyle,
                maxWidth: "550px",
                width: "100%",
                maxHeight: "90vh",
                overflowY: "auto",
                padding: "30px",
                boxShadow: "0 0 80px rgba(0, 229, 255, 0.2)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "25px",
                }}
              >
                <h3
                  style={{
                    color: "#00e5ff",
                    fontSize: "1.4rem",
                    fontWeight: 800,
                    margin: 0,
                  }}
                >
                  📤 نشر محتوى جديد
                </h3>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowUploadModal(false)}
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

              {/* نوع المنشور */}
              <div
                style={{ display: "flex", gap: "10px", marginBottom: "20px" }}
              >
                {[
                  {
                    value: "general",
                    label: "📺 للاستفادة العامة",
                    desc: "كورس يوتيوب",
                  },
                  {
                    value: "material",
                    label: "📘 مرتبط بمادة",
                    desc: "ملزمة - محاضرة - ملف",
                  },
                ].map((opt) => (
                  <motion.button
                    key={opt.value}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setUploadType(opt.value as "general" | "material");
                      if (opt.value === "general") setUploadSubjectId("");
                    }}
                    style={{
                      flex: 1,
                      padding: "15px",
                      borderRadius: "14px",
                      cursor: "pointer",
                      background:
                        uploadType === opt.value
                          ? "rgba(0,229,255,0.12)"
                          : "rgba(255,255,255,0.03)",
                      border:
                        uploadType === opt.value
                          ? "1px solid #00e5ff"
                          : "1px solid rgba(255,255,255,0.08)",
                      color: uploadType === opt.value ? "#00e5ff" : "#8b949e",
                      textAlign: "center",
                      fontFamily: "'Cairo', sans-serif",
                      fontWeight: 700,
                      fontSize: "0.9rem",
                      transition: "all 0.3s",
                    }}
                  >
                    <div style={{ fontSize: "1.3rem", marginBottom: "4px" }}>
                      {opt.label.split(" ")[0]}
                    </div>
                    <div style={{ fontSize: "0.75rem", opacity: 0.7 }}>
                      {opt.desc}
                    </div>
                  </motion.button>
                ))}
              </div>
              {/* تحديد المستوى الدراسي (للأدمن فقط) */}
              {userRole === "ADMIN" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  style={{ marginBottom: "16px" }}
                >
                  <label
                    style={{
                      color: "#ffca28",
                      fontSize: "0.85rem",
                      marginBottom: "8px",
                      display: "block",
                    }}
                  >
                    👑 تحديد المستوى الدراسي المستهدف
                  </label>
                  <select
                    value={uploadTargetLevel || userLevel}
                    onChange={(e) => setUploadTargetLevel(e.target.value)}
                    style={{
                      ...inputStyle,
                      appearance: "none",
                      cursor: "pointer",
                      border: "1px solid rgba(255,202,40,0.3)",
                    }}
                  >
                    <option value="LEVEL_1">المستوى الأول</option>
                    <option value="LEVEL_2">المستوى الثاني</option>
                    <option value="LEVEL_3">المستوى الثالث</option>
                    <option value="LEVEL_4">المستوى الرابع</option>
                  </select>
                </motion.div>
              )}

              {/* اختيار المادة (للمرتبط بمادة) */}
              {uploadType === "material" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  style={{ marginBottom: "16px" }}
                >
                  <label
                    style={{
                      color: "#bf5af2",
                      fontSize: "0.85rem",
                      marginBottom: "8px",
                      display: "block",
                      textAlign: "center",
                      fontWeight: 600,
                    }}
                  >
                    📘 اختر المادة الدراسية
                  </label>
                  {subjects.length === 0 ? (
                    <div
                      style={{
                        ...inputStyle,
                        textAlign: "center",
                        color: "#f85149",
                        background: "rgba(248,81,73,0.1)",
                        border: "1px solid rgba(248,81,73,0.2)",
                      }}
                    >
                      ⚠️ لا توجد مواد متاحة
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        maxHeight: "200px",
                        overflowY: "auto",
                        padding: "4px",
                      }}
                    >
                      {subjects.map((s) => (
                        <motion.button
                          key={s.id}
                          type="button"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setUploadSubjectId(s.id)}
                          style={{
                            width: "100%",
                            padding: "12px",
                            borderRadius: "12px",
                            background:
                              uploadSubjectId === s.id
                                ? "rgba(191,90,242,0.15)"
                                : "rgba(255,255,255,0.03)",
                            border:
                              uploadSubjectId === s.id
                                ? "1px solid #bf5af2"
                                : "1px solid rgba(255,255,255,0.08)",
                            color:
                              uploadSubjectId === s.id ? "#bf5af2" : "#e6edf3",
                            cursor: "pointer",
                            fontFamily: "'Cairo', sans-serif",
                            fontWeight: 600,
                            fontSize: "0.9rem",
                            textAlign: "center",
                            transition: "all 0.2s",
                          }}
                        >
                          <span style={{ fontSize: "1rem", marginLeft: "6px" }}>
                            📘
                          </span>
                          {s.name}
                          <span
                            style={{
                              display: "block",
                              fontSize: "0.7rem",
                              color: "#8b949e",
                              marginTop: "2px",
                            }}
                          >
                            {s.code}
                          </span>
                        </motion.button>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* رابط اليوتيوب */}
              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    color: "#8b949e",
                    fontSize: "0.85rem",
                    marginBottom: "8px",
                    display: "block",
                  }}
                >
                  {uploadType === "general"
                    ? "🔗 رابط كورس اليوتيوب *"
                    : "🔗 رابط فيديو يوتيوب (اختياري)"}
                </label>
                <input
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={uploadYoutubeUrl}
                  onChange={(e) => setUploadYoutubeUrl(e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* عنوان المنشور */}
              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    color: "#8b949e",
                    fontSize: "0.85rem",
                    marginBottom: "8px",
                    display: "block",
                  }}
                >
                  عنوان المنشور *
                </label>
                <input
                  type="text"
                  placeholder="أدخل عنوان المنشور..."
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* وصف المنشور */}
              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    color: "#8b949e",
                    fontSize: "0.85rem",
                    marginBottom: "8px",
                    display: "block",
                  }}
                >
                  وصف المنشور
                </label>
                <textarea
                  placeholder="أدخل وصفاً مختصراً..."
                  value={uploadDesc}
                  onChange={(e) => setUploadDesc(e.target.value)}
                  rows={3}
                  style={{
                    ...inputStyle,
                    resize: "vertical",
                    minHeight: "80px",
                  }}
                />
              </div>

              {/* رفع ملف (للمرتبط بمادة فقط) */}
              {uploadType === "material" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  style={{ marginBottom: "16px" }}
                >
                  <label
                    style={{
                      color: "#8b949e",
                      fontSize: "0.85rem",
                      marginBottom: "8px",
                      display: "block",
                    }}
                  >
                    📎 إرفاق ملف (PDF, Word, Excel, صورة, صوت)
                  </label>
                  <motion.div
                    whileHover={{ borderColor: "rgba(0,229,255,0.4)" }}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      ...inputStyle,
                      border: "2px dashed rgba(255,255,255,0.15)",
                      padding: "25px",
                      textAlign: "center",
                      cursor: "pointer",
                      color: "#8b949e",
                    }}
                  >
                    {uploadFile ? (
                      <span style={{ color: "#00e5ff" }}>
                        📎 {uploadFile.name} ({formatSize(uploadFile.size)})
                      </span>
                    ) : (
                      <span>اسحب وأفلت الملف هنا أو انقر للاختيار</span>
                    )}
                  </motion.div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.mp3,.wav"
                    style={{ display: "none" }}
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  />
                  {uploadFile && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setUploadFile(null)}
                      style={{
                        marginTop: "8px",
                        padding: "6px 14px",
                        borderRadius: "8px",
                        background: "rgba(248,81,73,0.1)",
                        border: "1px solid rgba(248,81,73,0.2)",
                        color: "#f85149",
                        cursor: "pointer",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                      }}
                    >
                      إزالة الملف
                    </motion.button>
                  )}
                </motion.div>
              )}

              {/* شريط التقدم */}
              {uploading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{ marginBottom: "16px" }}
                >
                  <div
                    style={{
                      height: "6px",
                      background: "rgba(255,255,255,0.1)",
                      borderRadius: "3px",
                      overflow: "hidden",
                    }}
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadProgress}%` }}
                      style={{
                        height: "100%",
                        background: "linear-gradient(90deg, #00e5ff, #39ff14)",
                        borderRadius: "3px",
                      }}
                    />
                  </div>
                  <p
                    style={{
                      color: "#8b949e",
                      fontSize: "0.8rem",
                      textAlign: "center",
                      marginTop: "6px",
                    }}
                  >
                    {uploadProgress}%
                  </p>
                </motion.div>
              )}

              {/* زر النشر */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleUpload}
                disabled={uploading}
                style={{
                  ...btnPrimary,
                  opacity: uploading ? 0.6 : 1,
                  boxShadow: "0 10px 30px rgba(0, 229, 255, 0.25)",
                }}
              >
                {uploading ? "⏳ جاري النشر..." : "🚀 نشر المنشور"}
              </motion.button>

              <p
                style={{
                  color: "#5a6a7a",
                  fontSize: "0.75rem",
                  textAlign: "center",
                  marginTop: "12px",
                }}
              >
                الحد الأقصى للملف: 20MB | الأنواع المسموحة: PDF, DOCX, XLSX,
                PNG, JPG, MP3
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== نافذة الفلترة ==================== */}
      <AnimatePresence>
        {showFilterModal && (
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
              background: "rgba(0,0,0,0.75)",
              backdropFilter: "blur(10px)",
              padding: "20px",
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowFilterModal(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 30 }}
              transition={{ type: "spring", damping: 20, stiffness: 200 }}
              style={{
                ...glassStyle,
                maxWidth: "500px",
                width: "100%",
                padding: "30px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "25px",
                }}
              >
                <h3
                  style={{
                    color: "#00e5ff",
                    fontSize: "1.3rem",
                    fontWeight: 800,
                    margin: 0,
                  }}
                >
                  🔍 فلترة المكتبة
                </h3>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowFilterModal(false)}
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

              {/* بحث */}
              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    color: "#8b949e",
                    fontSize: "0.85rem",
                    marginBottom: "8px",
                    display: "block",
                  }}
                >
                  بحث بالعنوان
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    placeholder="ابحث عن منشور..."
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                    style={{ ...inputStyle, paddingRight: "40px" }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#8b949e",
                    }}
                  >
                    <SearchIcon />
                  </span>
                </div>
              </div>

              {/* نوع المحتوى */}
              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    color: "#8b949e",
                    fontSize: "0.85rem",
                    marginBottom: "8px",
                    display: "block",
                  }}
                >
                  نوع المحتوى
                </label>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {[
                    { value: "", label: "الكل" },
                    { value: "PDF", label: "📄 PDF" },
                    { value: "DOCX", label: "📝 Word" },
                    { value: "XLSX", label: "📊 Excel" },
                    { value: "PNG", label: "🖼️ PNG" },
                    { value: "JPG", label: "🖼️ JPG" },
                    { value: "YOUTUBE_LINK", label: "▶️ يوتيوب" },
                    { value: "MP3", label: "🎵 صوت" },
                  ].map((f) => (
                    <motion.button
                      key={f.value}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setFilterType(f.value)}
                      style={{
                        padding: "8px 14px",
                        borderRadius: "20px",
                        cursor: "pointer",
                        background:
                          filterType === f.value
                            ? "rgba(0,229,255,0.12)"
                            : "rgba(255,255,255,0.03)",
                        border:
                          filterType === f.value
                            ? "1px solid #00e5ff"
                            : "1px solid rgba(255,255,255,0.08)",
                        color: filterType === f.value ? "#00e5ff" : "#8b949e",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        fontFamily: "'Cairo', sans-serif",
                      }}
                    >
                      {f.label}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* المادة (للطلاب والمعلمين) */}
              <div style={{ marginBottom: "20px" }}>
                <label
                  style={{
                    color: "#8b949e",
                    fontSize: "0.85rem",
                    marginBottom: "8px",
                    display: "block",
                  }}
                >
                  المادة الدراسية
                </label>
                <select
                  value={filterSubject}
                  onChange={(e) => setFilterSubject(e.target.value)}
                  style={{
                    ...inputStyle,
                    appearance: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="">جميع المواد</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* أزرار */}
              <div style={{ display: "flex", gap: "10px" }}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setFilterType("");
                    setFilterSubject("");
                    setFilterSearch("");
                    setShowFilterModal(false);
                  }}
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
                  }}
                >
                  مسح الكل
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setShowFilterModal(false);
                    loadContent();
                  }}
                  style={{
                    flex: 2,
                    padding: "12px",
                    borderRadius: "12px",
                    background: "linear-gradient(135deg, #00e5ff, #0077b6)",
                    border: "none",
                    color: "#010204",
                    cursor: "pointer",
                    fontWeight: 800,
                    fontFamily: "'Cairo', sans-serif",
                  }}
                >
                  تطبيق الفلترة
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== نافذة تعديل المنشور ==================== */}
      <AnimatePresence>
        {editingItem && (
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
              background: "rgba(0,0,0,0.75)",
              backdropFilter: "blur(10px)",
              padding: "20px",
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setEditingItem(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 30 }}
              style={{
                ...glassStyle,
                maxWidth: "500px",
                width: "100%",
                padding: "30px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "25px",
                }}
              >
                <h3
                  style={{
                    color: "#ffca28",
                    fontSize: "1.3rem",
                    fontWeight: 800,
                    margin: 0,
                  }}
                >
                  ✏️ تعديل المنشور
                </h3>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setEditingItem(null)}
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

              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    color: "#8b949e",
                    fontSize: "0.85rem",
                    marginBottom: "8px",
                    display: "block",
                  }}
                >
                  العنوان
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    color: "#8b949e",
                    fontSize: "0.85rem",
                    marginBottom: "8px",
                    display: "block",
                  }}
                >
                  الوصف
                </label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={3}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label
                  style={{
                    color: "#8b949e",
                    fontSize: "0.85rem",
                    marginBottom: "8px",
                    display: "block",
                  }}
                >
                  المادة
                </label>
                <select
                  value={editSubjectId}
                  onChange={(e) => setEditSubjectId(e.target.value)}
                  style={{
                    ...inputStyle,
                    appearance: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="">بدون مادة</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setEditingItem(null)}
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
                  }}
                >
                  إلغاء
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSaveEdit}
                  style={{
                    flex: 2,
                    padding: "12px",
                    borderRadius: "12px",
                    background: "linear-gradient(135deg, #ffca28, #e3b341)",
                    border: "none",
                    color: "#010204",
                    cursor: "pointer",
                    fontWeight: 800,
                    fontFamily: "'Cairo', sans-serif",
                  }}
                >
                  💾 حفظ التعديلات
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== نافذة تكبير الفيديو ==================== */}
      <AnimatePresence>
        {showVideoModal && currentVideo && (
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
              background: "rgba(0,0,0,0.9)",
              backdropFilter: "blur(15px)",
              padding: "20px",
            }}
            onClick={() => {
              setShowVideoModal(false);
              setCurrentVideo(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              style={{
                width: "100%",
                maxWidth: "1000px",
                aspectRatio: "16/9",
                borderRadius: "20px",
                overflow: "hidden",
                boxShadow: "0 0 100px rgba(0,229,255,0.3)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <iframe
                src={`https://www.youtube.com/embed/${getYoutubeId(currentVideo.url)}?autoplay=1`}
                style={{ width: "100%", height: "100%", border: "none" }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={currentVideo.title}
              />
            </motion.div>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                setShowVideoModal(false);
                setCurrentVideo(null);
              }}
              style={{
                position: "absolute",
                top: "20px",
                right: "20px",
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                background: "rgba(0,0,0,0.7)",
                border: "1px solid rgba(255,255,255,0.3)",
                color: "#fff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.2rem",
              }}
            >
              <CloseIcon />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
