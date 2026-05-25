"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "@/components/layout/Sidebar";
import PageTransition from "@/components/layout/PageTransition";
import { useAuth } from "@/hooks/useAuth";
import { useSupabaseRealtime } from "@/hooks/useSupabaseRealtime";
import { deriveStaticChannelName } from "@/lib/realtimeChannels";
import { useToast } from "@/components/ui/Toast";
import { csrfFetch } from "@/lib/csrfClient";

interface SubjectItem {
  id: string;
  name: string;
  code: string;
}

const LANGUAGES = [
  {
    key: "cpp",
    label: "C++",
    icon: "⚡",
    ext: ".cpp",
    template:
      '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, Cyber Security!" << endl;\n    return 0;\n}',
  },
  {
    key: "csharp",
    label: "C#",
    icon: "🔷",
    ext: ".cs",
    template:
      'using System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hello, Cyber Security!");\n    }\n}',
  },
  {
    key: "python",
    label: "Python",
    icon: "🐍",
    ext: ".py",
    template: 'print("Hello, Cyber Security!")\n\n# اكتب كودك هنا',
  },
  {
    key: "html",
    label: "HTML/CSS",
    icon: "🌐",
    ext: ".html",
    template:
      '<!DOCTYPE html>\n<html lang="ar" dir="rtl">\n<head>\n    <meta charset="UTF-8">\n    <title>محرر الأكواد</title>\n    <style>\n        body { font-family: sans-serif; padding: 20px; background: #0d1117; color: #e6edf3; }\n        h1 { color: #00e5ff; }\n    </style>\n</head>\n<body>\n    <h1>مرحباً بك في محرر الأكواد</h1>\n    <p>سحابة الأمن السيبراني - جامعة ذمار</p>\n</body>\n</html>',
  },
];

const DANGEROUS_PATTERNS = [
  /\beval\s*\(/i,
  /\bdocument\s*\./i,
  /\bwindow\s*\./i,
  /\bfetch\s*\(/i,
  /\bXMLHttpRequest\b/i,
  /\blocalStorage\b/i,
  /\bsessionStorage\b/i,
  /\bindexedDB\b/i,
  /\bWebSocket\b/i,
  /\bimport\s*\(/i,
];

export default function CodeEditorPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState("");
  const [output, setOutput] = useState("");
  const [fileName, setFileName] = useState("");
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveAuthorName, setSaveAuthorName] = useState("");
  const [saveFileName, setSaveFileName] = useState("");
  const [saveNote, setSaveNote] = useState("");
  const [shareTitle, setShareTitle] = useState("");
  const [shareAuthorName, setShareAuthorName] = useState("");
  const [shareNote, setShareNote] = useState("");
  const [shareLevel, setShareLevel] = useState("LEVEL_1");
  const [uploading, setUploading] = useState(false);
  const [myFiles, setMyFiles] = useState<any[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(
    null,
  );
  const codeRef = useRef<HTMLTextAreaElement>(null);

  const effectiveRole =
    user?.role === "ADMIN"
      ? "ADMIN"
      : user?.managementLevel
        ? "MANAGEMENT"
        : user?.role;
  const userLevel = user?.level || "LEVEL_1";

  useEffect(() => {
    const savedLang = localStorage.getItem("code-editor-lang") || "python";
    const savedCode = localStorage.getItem(`code-editor-${savedLang}`) || "";
    setLanguage(savedLang);
    setCode(
      savedCode || LANGUAGES.find((l) => l.key === savedLang)?.template || "",
    );
  }, []);

  useEffect(() => {
    if (language) {
      const saved = localStorage.getItem(`code-editor-${language}`);
      if (saved) {
        setCode(saved);
      } else {
        setCode(LANGUAGES.find((l) => l.key === language)?.template || "");
      }
      localStorage.setItem("code-editor-lang", language);
    }
  }, [language]);

  useEffect(() => {
    if (code) {
      localStorage.setItem(`code-editor-${language}`, code);
    }
  }, [code, language]);

  useEffect(() => {
    if (userLevel) {
      fetch(`/api/subjects/active?level=${userLevel}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.success) setSubjects(res.data);
        })
        .catch(() => {});
    }
  }, [userLevel]);

  useSupabaseRealtime(deriveStaticChannelName("code-editor"), "file-shared", () => {
    showToast("📢 تمت مشاركة ملف جديد في محرر الأكواد", "info");
  });

  const checkDangerousCode = (codeStr: string): string | null => {
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(codeStr)) {
        return `تم اكتشاف كود خبيث محظور: ${pattern.toString()}`;
      }
    }
    if (codeStr.includes("<script")) return "تم اكتشاف وسم script محظور";
    return null;
  };

  const handleRun = async () => {
    const danger = checkDangerousCode(code);
    if (danger) {
      setOutput(`❌ ${danger}`);
      showToast("تم اكتشاف كود خبيث", "error");
      return;
    }

    setRunning(true);
    setOutput("⏳ جاري التشغيل...");

    try {
      if (language === "html") {
        const blob = new Blob([code], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank", "width=1024,height=768");
        setOutput("✅ تم فتح الصفحة في نافذة جديدة");
      } else {
        const res = await csrfFetch("/api/code-editor/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ language, code }),
        });
        const data = await res.json();
        setOutput(data.success ? data.output : `❌ ${data.error}`);
      }
    } catch {
      setOutput("❌ فشل الاتصال بخادم التشغيل");
    } finally {
      setRunning(false);
    }
  };

  const handleSave = async (customFileName?: string) => {
    if (!code.trim()) {
      showToast("لا يوجد كود لحفظه", "warning");
      return;
    }

    const danger = checkDangerousCode(code);
    if (danger) {
      showToast("لا يمكن حفظ كود خبيث", "error");
      return;
    }

    const finalFileName =
      customFileName ||
      saveFileName ||
      fileName ||
      `كود_${language}_${Date.now()}${LANGUAGES.find((l) => l.key === language)?.ext}`;

    setSaving(true);
    try {
      const res = await csrfFetch("/api/code-editor/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language,
          code,
          fileName: finalFileName,
          level: userLevel,
          authorName: saveAuthorName || user?.name || "",
          note: saveNote || "",
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("✅ تم حفظ الملف بنجاح", "success");
        setShowSaveModal(false);
        loadMyFiles();
      } else {
        showToast(data.error || "فشل الحفظ", "error");
      }
    } catch {
      showToast("فشل الاتصال", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = () => {
    if (!code.trim()) {
      showToast("لا يوجد كود لتنزيله", "warning");
      return;
    }
    const ext = LANGUAGES.find((l) => l.key === language)?.ext || ".txt";
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName || `code_${Date.now()}${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("📥 تم تنزيل الملف", "success");
  };
  const handleShare = async (targetLevel?: string) => {
    if (!code.trim()) {
      showToast("لا يوجد كود لمشاركته", "warning");
      return;
    }

    const danger = checkDangerousCode(code);
    if (danger) {
      showToast("لا يمكن مشاركة كود خبيث", "error");
      return;
    }

    const shareTargetLevel = targetLevel || userLevel;

    setSaving(true);
    try {
      const saveRes = await csrfFetch("/api/code-editor/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language,
          code,
          fileName:
            fileName ||
            `مشاركة_${language}_${Date.now()}${LANGUAGES.find((l) => l.key === language)?.ext}`,
          level: shareTargetLevel,
        }),
      });
      const saveData = await saveRes.json();

      if (saveData.success) {
        const shareRes = await csrfFetch("/api/code-editor/share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileUrl: saveData.data.fileUrl,
            fileName: saveData.data.fileName,
            language,
            showAuthor: true,
            level: shareTargetLevel,
            title: shareTitle || fileName,
            authorName: shareAuthorName || user?.name || "مستخدم",
            note: shareNote || "",
          }),
        });
        const shareData = await shareRes.json();
        if (shareData.success) {
          showToast(
            `✅ تمت المشاركة في ${LEVEL_LABELS[shareTargetLevel] || shareTargetLevel}`,
            "success",
          );
          setShowShareModal(false);
        } else {
          showToast("تم الحفظ ولكن فشلت المشاركة", "warning");
        }
      } else {
        showToast("فشل حفظ الملف", "error");
      }
    } catch {
      showToast("فشل الاتصال", "error");
    } finally {
      setSaving(false);
    }
  };
  const handleUploadAsAssignment = async () => {
    if (!selectedSubject || !code.trim()) {
      showToast("اختر المادة وتأكد من وجود كود", "warning");
      return;
    }

    const danger = checkDangerousCode(code);
    if (danger) {
      showToast("لا يمكن رفع كود خبيث", "error");
      return;
    }

    setUploading(true);
    try {
      const ext = LANGUAGES.find((l) => l.key === language)?.ext || ".txt";
      const file = new File(
        [code],
        `${user?.name || "طالب"}_${fileName || "code"}${ext}`,
        { type: "text/plain" },
      );
      const fd = new FormData();
      fd.append("file", file);
      fd.append("subjectId", selectedSubject);

      const res = await csrfFetch("/api/assignments/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (data.success) {
        showToast("✅ تم رفع الكود كتكليف بنجاح", "success");
        setShowUploadModal(false);
      } else {
        showToast(data.message || "فشل الرفع", "error");
      }
    } catch {
      showToast("فشل الاتصال", "error");
    } finally {
      setUploading(false);
    }
  };

  const loadMyFiles = useCallback(async () => {
    if (!userLevel) return;
    setLoadingFiles(true);
    try {
      const res = await fetch(`/api/code-editor/list?level=${userLevel}`);
      const data = await res.json();
      if (data.success) {
        setMyFiles(data.data);
      }
    } catch {
      // صامت
    } finally {
      setLoadingFiles(false);
    }
  }, [userLevel]);

  useEffect(() => {
    loadMyFiles();
  }, [loadMyFiles]);

  const handleDeleteFile = async (fileId: string) => {
    try {
      // حذف من ImageKit
      const imagekitPrivateKey = process.env.NEXT_PUBLIC_IMAGEKIT_KEY || "";
      // نستخدم API محلي للحذف
      const res = await fetch(`/api/code-editor/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: fileId, type: "myfile" }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("🗑️ تم حذف الملف بنجاح", "warning");
        loadMyFiles();
      } else {
        showToast(data.error || "فشل الحذف", "error");
      }
    } catch {
      showToast("فشل الاتصال", "error");
    }
    setShowDeleteConfirm(null);
  };

  const handleShareMyFile = async (file: any) => {
    setCode("");
    setFileName(file.fileName || "");
    const ext = file.fileName?.split(".").pop() || "";
    const lang = LANGUAGES.find((l) => l.ext === `.${ext}` || l.key === ext);
    if (lang) setLanguage(lang.key);

    // تحميل محتوى الملف
    try {
      const res = await fetch(file.fileUrl);
      const content = await res.text();
      setCode(content);
    } catch {
      // صامت
    }

    setShareLevel(userLevel);
    setShareTitle(file.fileName || "");
    setShareAuthorName("");
    setShareNote("");
    setShowShareModal(true);
  };

  const currentLang = LANGUAGES.find((l) => l.key === language);

  const LEVEL_LABELS: Record<string, string> = {
    LEVEL_1: "المستوى الأول",
    LEVEL_2: "المستوى الثاني",
    LEVEL_3: "المستوى الثالث",
    LEVEL_4: "المستوى الرابع",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "transparent",
        fontFamily: "'Cairo', 'Fira Code', monospace",
        color: "#fff",
      }}
    >
      <Sidebar />
      <PageTransition>
        <main
          style={{
            padding: "90px 12px 50px",
            maxWidth: "1200px",
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
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "10px",
              marginBottom: "20px",
            }}
          >
            <h1
              style={{
                color: "#00e5ff",
                fontSize: "clamp(1.2rem, 4vw, 1.7rem)",
                fontWeight: 900,
                margin: 0,
                textShadow: "0 0 20px rgba(0,229,255,0.3)",
              }}
            >
              💻 محرر الأكواد
            </h1>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                onClick={() => router.push("/code-editor/shared")}
                style={{
                  background: "rgba(191,90,242,0.1)",
                  border: "1px solid rgba(191,90,242,0.3)",
                  borderRadius: "10px",
                  padding: "8px 14px",
                  color: "#bf5af2",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  fontFamily: "'Cairo', sans-serif",
                }}
              >
                📂 الملفات المشتركة
              </button>
            </div>
          </div>

          {/* اختيار اللغة */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              marginBottom: "16px",
            }}
          >
            {LANGUAGES.map((lang) => (
              <button
                key={lang.key}
                onClick={() => setLanguage(lang.key)}
                style={{
                  background:
                    language === lang.key
                      ? "rgba(0,229,255,0.12)"
                      : "rgba(255,255,255,0.03)",
                  border: `1.5px solid ${language === lang.key ? "rgba(0,229,255,0.5)" : "rgba(255,255,255,0.1)"}`,
                  borderRadius: "12px",
                  padding: "8px 14px",
                  color: language === lang.key ? "#00e5ff" : "#8b949e",
                  cursor: "pointer",
                  fontSize: "clamp(0.75rem, 3vw, 0.85rem)",
                  fontWeight: language === lang.key ? 700 : 500,
                  fontFamily: "'Cairo', sans-serif",
                  transition: "all 0.2s",
                }}
              >
                {lang.icon} {lang.label}
              </button>
            ))}
          </div>

          {/* محرر الأكواد */}
          <div
            style={{
              background: "rgba(1,2,4,0.96)",
              border: "1px solid rgba(48,54,61,0.5)",
              borderRadius: "14px",
              overflow: "hidden",
              marginBottom: "12px",
              boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
            }}
          >
            <div
              style={{
                background: "rgba(22,27,34,0.9)",
                padding: "8px 14px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                borderBottom: "1px solid rgba(48,54,61,0.4)",
              }}
            >
              <span
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  background: "#f85149",
                }}
              />
              <span
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  background: "#ffca28",
                }}
              />
              <span
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  background: "#2ea043",
                }}
              />
              <span
                style={{
                  color: "#8b949e",
                  fontSize: "0.75rem",
                  flex: 1,
                  textAlign: "center",
                }}
              >
                {currentLang?.label} {currentLang?.ext}
              </span>
            </div>
            <textarea
              ref={codeRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              style={{
                width: "100%",
                height: "400px",
                background: "transparent",
                border: "none",
                padding: "16px",
                color: "#00ff41",
                fontFamily: "'Fira Code', 'Consolas', monospace",
                fontSize: "clamp(0.75rem, 2.5vw, 0.85rem)",
                lineHeight: 1.7,
                resize: "vertical",
                outline: "none",
                direction: "ltr",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* اسم الملف */}
          <div style={{ marginBottom: "12px" }}>
            <input
              type="text"
              placeholder="اسم الملف (اختياري)..."
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "rgba(13,17,23,0.8)",
                border: "1px solid rgba(48,54,61,0.5)",
                borderRadius: "10px",
                color: "#e6edf3",
                fontSize: "0.85rem",
                fontFamily: "'Cairo', sans-serif",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* أزرار الإجراءات */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              marginBottom: "16px",
            }}
          >
            <button
              onClick={handleRun}
              disabled={running}
              style={{
                flex: "1 1 120px",
                padding: "12px",
                borderRadius: "12px",
                border: "none",
                background: "linear-gradient(135deg, #2ea043, #238636)",
                color: "#fff",
                cursor: running ? "not-allowed" : "pointer",
                fontWeight: 700,
                fontSize: "0.9rem",
                fontFamily: "'Cairo', sans-serif",
                opacity: running ? 0.7 : 1,
              }}
            >
              {running ? "⏳ جاري..." : "▶ تشغيل"}
            </button>
            <button
              onClick={() => {
                setSaveAuthorName(user?.name || "");
                setSaveFileName(fileName || "");
                setSaveNote("");
                setShowSaveModal(true);
              }}
              disabled={saving}
              style={{
                flex: "1 1 120px",
                padding: "12px",
                borderRadius: "12px",
                border: "none",
                background: "linear-gradient(135deg, #1f6feb, #1158c7)",
                color: "#fff",
                cursor: saving ? "not-allowed" : "pointer",
                fontWeight: 700,
                fontSize: "0.9rem",
                fontFamily: "'Cairo', sans-serif",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "⏳ جاري..." : "💾 حفظ"}
            </button>
            <button
              onClick={handleDownload}
              style={{
                flex: "1 1 120px",
                padding: "12px",
                borderRadius: "12px",
                border: "1px solid rgba(0,229,255,0.3)",
                background: "rgba(0,229,255,0.08)",
                color: "#00e5ff",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: "0.9rem",
                fontFamily: "'Cairo', sans-serif",
              }}
            >
              📥 تنزيل
            </button>
            <button
              onClick={() => setShowUploadModal(true)}
              style={{
                flex: "1 1 140px",
                padding: "12px",
                borderRadius: "12px",
                border: "1px solid rgba(191,90,242,0.3)",
                background: "rgba(191,90,242,0.08)",
                color: "#bf5af2",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: "0.9rem",
                fontFamily: "'Cairo', sans-serif",
              }}
            >
              📤 رفع كتكليف
            </button>
            <button
              onClick={() => {
                setShareLevel(userLevel);
                setShareTitle("");
                setShareAuthorName("");
                setShareNote("");
                setShowShareModal(true);
              }}
              disabled={saving}
              style={{
                flex: "1 1 140px",
                padding: "12px",
                borderRadius: "12px",
                border: "1px solid rgba(255,202,40,0.3)",
                background: "rgba(255,202,40,0.08)",
                color: "#ffca28",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: "0.9rem",
                fontFamily: "'Cairo', sans-serif",
              }}
            >
              📢 مشاركة
            </button>
          </div>

          {/* ملفاتي المحفوظة */}
          <div style={{ marginBottom: "16px" }}>
            <h3
              style={{
                color: "#00e5ff",
                fontSize: "1rem",
                fontWeight: 700,
                margin: "0 0 12px",
              }}
            >
              📁 ملفاتي ({myFiles.length})
            </h3>
            {loadingFiles ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "20px",
                  color: "#8b949e",
                }}
              >
                ⏳ جاري التحميل...
              </div>
            ) : myFiles.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "16px",
                  color: "#8b949e",
                  background: "rgba(13,17,23,0.5)",
                  borderRadius: "10px",
                  fontSize: "0.85rem",
                }}
              >
                لا توجد ملفات محفوظة بعد
              </div>
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: "8px" }}
              >
                {myFiles.slice(0, 10).map((file: any) => (
                  <div
                    key={file.fileId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "8px",
                      padding: "10px 14px",
                      background: "rgba(13,17,23,0.7)",
                      border: "1px solid rgba(48,54,61,0.4)",
                      borderRadius: "10px",
                    }}
                  >
                    <span
                      style={{
                        flex: 1,
                        minWidth: "120px",
                        color: "#e6edf3",
                        fontSize: "0.85rem",
                        wordBreak: "break-all",
                      }}
                    >
                      📄 {file.fileName}
                    </span>
                    <div
                      style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}
                    >
                      <button
                        onClick={() => window.open(file.fileUrl, "_blank")}
                        style={{
                          padding: "6px 10px",
                          borderRadius: "6px",
                          border: "1px solid rgba(0,229,255,0.3)",
                          background: "rgba(0,229,255,0.08)",
                          color: "#00e5ff",
                          cursor: "pointer",
                          fontSize: "0.7rem",
                          fontFamily: "'Cairo', sans-serif",
                        }}
                      >
                        👁 فتح
                      </button>
                      <button
                        onClick={() => {
                          fetch(file.fileUrl)
                            .then((r) => r.text())
                            .then((content) => {
                              setCode(content);
                              const ext = file.fileName?.split(".").pop() || "";
                              const lang = LANGUAGES.find(
                                (l) => l.ext === `.${ext}`,
                              );
                              if (lang) setLanguage(lang.key);
                              showToast("📂 تم تحميل الملف في المحرر", "info");
                            })
                            .catch(() => showToast("فشل تحميل الملف", "error"));
                        }}
                        style={{
                          padding: "6px 10px",
                          borderRadius: "6px",
                          border: "1px solid rgba(46,160,67,0.3)",
                          background: "rgba(46,160,67,0.08)",
                          color: "#2ea043",
                          cursor: "pointer",
                          fontSize: "0.7rem",
                          fontFamily: "'Cairo', sans-serif",
                        }}
                      >
                        ▶ تشغيل
                      </button>
                      <button
                        onClick={() => handleShareMyFile(file)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: "6px",
                          border: "1px solid rgba(255,202,40,0.3)",
                          background: "rgba(255,202,40,0.08)",
                          color: "#ffca28",
                          cursor: "pointer",
                          fontSize: "0.7rem",
                          fontFamily: "'Cairo', sans-serif",
                        }}
                      >
                        📢 مشاركة
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(file.fileId)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: "6px",
                          border: "1px solid rgba(248,81,73,0.3)",
                          background: "rgba(248,81,73,0.08)",
                          color: "#f85149",
                          cursor: "pointer",
                          fontSize: "0.7rem",
                          fontFamily: "'Cairo', sans-serif",
                        }}
                      >
                        🗑 حذف
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* مخرجات التشغيل */}
          {output && (
            <div
              style={{
                background: "rgba(1,2,4,0.9)",
                border: "1px solid rgba(48,54,61,0.5)",
                borderRadius: "12px",
                padding: "14px",
                fontFamily: "'Fira Code', monospace",
                fontSize: "0.8rem",
                color: output.includes("❌") ? "#f85149" : "#00ff41",
                whiteSpace: "pre-wrap",
                maxHeight: "250px",
                overflowY: "auto",
              }}
            >
              {output}
            </div>
          )}
        </main>
      </PageTransition>

      {/* نافذة رفع كتكليف */}
      <AnimatePresence mode="wait">
        {showUploadModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowUploadModal(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.7)",
              zIndex: 1000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px",
            }}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "rgba(13,17,23,0.97)",
                border: "1px solid rgba(48,54,61,0.5)",
                borderRadius: "16px",
                padding: "24px",
                width: "100%",
                maxWidth: "450px",
              }}
            >
              <h3
                style={{
                  color: "#bf5af2",
                  margin: "0 0 16px",
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  textAlign: "center",
                }}
              >
                📤 رفع الكود كتكليف
              </h3>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px",
                  background: "rgba(22,27,34,0.8)",
                  border: "1px solid rgba(48,54,61,0.5)",
                  borderRadius: "10px",
                  color: "#e6edf3",
                  fontSize: "0.9rem",
                  fontFamily: "'Cairo', sans-serif",
                  marginBottom: "16px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              >
                <option value="">-- اختر المادة --</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
              <button
                onClick={handleUploadAsAssignment}
                disabled={uploading}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: "12px",
                  border: "none",
                  background: "linear-gradient(135deg, #bf5af2, #7a00ff)",
                  color: "#fff",
                  cursor: uploading ? "not-allowed" : "pointer",
                  fontWeight: 700,
                  fontSize: "1rem",
                  fontFamily: "'Cairo', sans-serif",
                  opacity: uploading ? 0.7 : 1,
                }}
              >
                {uploading ? "⏳ جاري الرفع..." : "🚀 رفع"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* نافذة المشاركة الموحدة */}
      <AnimatePresence mode="wait">
        {showShareModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowShareModal(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.7)",
              zIndex: 1000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px",
            }}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "rgba(13,17,23,0.97)",
                border: "1px solid rgba(255,202,40,0.4)",
                borderRadius: "16px",
                padding: "24px",
                width: "100%",
                maxWidth: "480px",
                maxHeight: "85vh",
                overflowY: "auto",
              }}
            >
              <h3
                style={{
                  color: "#ffca28",
                  margin: "0 0 16px",
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  textAlign: "center",
                }}
              >
                📢 مشاركة الملف
              </h3>

              {/* اختيار المستوى (للأدمن فقط) */}
              {effectiveRole === "ADMIN" && (
                <div style={{ marginBottom: "14px" }}>
                  <label
                    style={{
                      color: "#8b949e",
                      fontSize: "0.8rem",
                      display: "block",
                      marginBottom: "6px",
                    }}
                  >
                    اختر المستوى:
                  </label>
                  <div
                    style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}
                  >
                    {["LEVEL_1", "LEVEL_2", "LEVEL_3", "LEVEL_4"].map((lvl) => (
                      <button
                        key={lvl}
                        onClick={() => setShareLevel(lvl)}
                        style={{
                          padding: "8px 12px",
                          borderRadius: "8px",
                          border: `1.5px solid ${shareLevel === lvl ? "rgba(255,202,40,0.5)" : "rgba(255,255,255,0.1)"}`,
                          background:
                            shareLevel === lvl
                              ? "rgba(255,202,40,0.1)"
                              : "rgba(255,255,255,0.03)",
                          color: shareLevel === lvl ? "#ffca28" : "#8b949e",
                          cursor: "pointer",
                          fontWeight: shareLevel === lvl ? 700 : 500,
                          fontSize: "0.8rem",
                          fontFamily: "'Cairo', sans-serif",
                        }}
                      >
                        {LEVEL_LABELS[lvl]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* عنوان الملف */}
              <div style={{ marginBottom: "12px" }}>
                <label
                  style={{
                    color: "#8b949e",
                    fontSize: "0.8rem",
                    display: "block",
                    marginBottom: "4px",
                  }}
                >
                  عنوان الملف:
                </label>
                <input
                  type="text"
                  placeholder="أدخل عنواناً للملف..."
                  value={shareTitle}
                  onChange={(e) => setShareTitle(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    background: "rgba(22,27,34,0.8)",
                    border: "1px solid rgba(48,54,61,0.5)",
                    borderRadius: "10px",
                    color: "#e6edf3",
                    fontSize: "0.85rem",
                    fontFamily: "'Cairo', sans-serif",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* اسم المشارك */}
              <div style={{ marginBottom: "12px" }}>
                <label
                  style={{
                    color: "#8b949e",
                    fontSize: "0.8rem",
                    display: "block",
                    marginBottom: "4px",
                  }}
                >
                  اسمك (اختياري):
                </label>
                <input
                  type="text"
                  placeholder="اتركه فارغاً للمشاركة باسمك"
                  value={shareAuthorName}
                  onChange={(e) => setShareAuthorName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    background: "rgba(22,27,34,0.8)",
                    border: "1px solid rgba(48,54,61,0.5)",
                    borderRadius: "10px",
                    color: "#e6edf3",
                    fontSize: "0.85rem",
                    fontFamily: "'Cairo', sans-serif",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* ملاحظة */}
              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    color: "#8b949e",
                    fontSize: "0.8rem",
                    display: "block",
                    marginBottom: "4px",
                  }}
                >
                  ملاحظة على الملف:
                </label>
                <textarea
                  placeholder="أضف ملاحظاتك..."
                  value={shareNote}
                  onChange={(e) => setShareNote(e.target.value)}
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    background: "rgba(22,27,34,0.8)",
                    border: "1px solid rgba(48,54,61,0.5)",
                    borderRadius: "10px",
                    color: "#e6edf3",
                    fontSize: "0.85rem",
                    fontFamily: "'Cairo', sans-serif",
                    outline: "none",
                    resize: "vertical",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <button
                onClick={() => handleShare(shareLevel)}
                disabled={saving}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: "12px",
                  border: "none",
                  background: "linear-gradient(135deg, #ffca28, #e3b341)",
                  color: "#000",
                  cursor: saving ? "not-allowed" : "pointer",
                  fontWeight: 700,
                  fontSize: "1rem",
                  fontFamily: "'Cairo', sans-serif",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? "⏳ جاري..." : "🚀 مشاركة"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* نافذة حفظ الملف */}
      <AnimatePresence mode="wait">
        {showSaveModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSaveModal(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.7)",
              zIndex: 1000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px",
            }}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "rgba(13,17,23,0.97)",
                border: "1px solid rgba(0,229,255,0.4)",
                borderRadius: "16px",
                padding: "24px",
                width: "100%",
                maxWidth: "480px",
                maxHeight: "85vh",
                overflowY: "auto",
              }}
            >
              <h3
                style={{
                  color: "#00e5ff",
                  margin: "0 0 16px",
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  textAlign: "center",
                }}
              >
                💾 حفظ الملف
              </h3>

              {/* اسم المستخدم */}
              <div style={{ marginBottom: "12px" }}>
                <label
                  style={{
                    color: "#8b949e",
                    fontSize: "0.8rem",
                    display: "block",
                    marginBottom: "4px",
                  }}
                >
                  اسمك (اختياري):
                </label>
                <input
                  type="text"
                  placeholder="اسم المستخدم..."
                  value={saveAuthorName}
                  onChange={(e) => setSaveAuthorName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    background: "rgba(22,27,34,0.8)",
                    border: "1px solid rgba(48,54,61,0.5)",
                    borderRadius: "10px",
                    color: "#e6edf3",
                    fontSize: "0.85rem",
                    fontFamily: "'Cairo', sans-serif",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* اسم الملف */}
              <div style={{ marginBottom: "12px" }}>
                <label
                  style={{
                    color: "#8b949e",
                    fontSize: "0.8rem",
                    display: "block",
                    marginBottom: "4px",
                  }}
                >
                  اسم الملف:
                </label>
                <input
                  type="text"
                  placeholder="اسم الملف..."
                  value={saveFileName}
                  onChange={(e) => setSaveFileName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    background: "rgba(22,27,34,0.8)",
                    border: "1px solid rgba(48,54,61,0.5)",
                    borderRadius: "10px",
                    color: "#e6edf3",
                    fontSize: "0.85rem",
                    fontFamily: "'Cairo', sans-serif",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* ملاحظة */}
              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    color: "#8b949e",
                    fontSize: "0.8rem",
                    display: "block",
                    marginBottom: "4px",
                  }}
                >
                  ملاحظة على الملف:
                </label>
                <textarea
                  placeholder="أضف ملاحظاتك..."
                  value={saveNote}
                  onChange={(e) => setSaveNote(e.target.value)}
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    background: "rgba(22,27,34,0.8)",
                    border: "1px solid rgba(48,54,61,0.5)",
                    borderRadius: "10px",
                    color: "#e6edf3",
                    fontSize: "0.85rem",
                    fontFamily: "'Cairo', sans-serif",
                    outline: "none",
                    resize: "vertical",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <button
                onClick={() => handleSave(saveFileName)}
                disabled={saving}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: "12px",
                  border: "none",
                  background: "linear-gradient(135deg, #1f6feb, #1158c7)",
                  color: "#fff",
                  cursor: saving ? "not-allowed" : "pointer",
                  fontWeight: 700,
                  fontSize: "1rem",
                  fontFamily: "'Cairo', sans-serif",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? "⏳ جاري..." : "💾 حفظ"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* نافذة تأكيد الحذف */}
      <AnimatePresence mode="wait">
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowDeleteConfirm(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.7)",
              zIndex: 1000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px",
            }}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "rgba(13,17,23,0.97)",
                border: "1px solid rgba(248,81,73,0.4)",
                borderRadius: "16px",
                padding: "24px",
                width: "100%",
                maxWidth: "400px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "2rem", marginBottom: "12px" }}>⚠️</div>
              <h3
                style={{
                  color: "#f85149",
                  margin: "0 0 8px",
                  fontSize: "1.1rem",
                }}
              >
                تأكيد الحذف
              </h3>
              <p
                style={{
                  color: "#8b949e",
                  margin: "0 0 20px",
                  fontSize: "0.9rem",
                }}
              >
                هل أنت متأكد من حذف هذا الملف؟
              </p>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "10px",
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.03)",
                    color: "#8b949e",
                    cursor: "pointer",
                    fontFamily: "'Cairo', sans-serif",
                  }}
                >
                  إلغاء
                </button>
                <button
                  onClick={() => handleDeleteFile(showDeleteConfirm)}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "10px",
                    border: "none",
                    background: "linear-gradient(135deg, #f85149, #da3633)",
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontFamily: "'Cairo', sans-serif",
                  }}
                >
                  نعم، احذف
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
