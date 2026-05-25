"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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

// ==================== الأنواع ====================
interface EvaluatedAssignment {
  id: string;
  studentName: string;
  studentEmail: string;
  subjectName: string;
  subjectCode: string;
  fileName: string;
  fileUrl: string;
  grade: number;
  feedback: string;
  createdAt: string;
  evaluatedAt: string;
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

const ExcelIcon = () => (
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
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="16" y2="17" />
  </svg>
);

const PdfIcon = () => (
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
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="12" y2="17" />
  </svg>
);

const EyeIcon = () => (
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
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

// ==================== المكوّن الرئيسي ====================
export default function TeacherAuditLogPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { showToast } = useToast();

  const userRole = user?.role || "";
  const userName = user?.name || "";

  const [assignments, setAssignments] = useState<EvaluatedAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const pag = usePagination(1, 15);

  // ==================== تحميل البيانات ====================
  const loadAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/assignments/history?page=${pag.page}&limit=${pag.limit}`,
      );
      const data = await res.json();
      if (data.success) {
        const mapped: EvaluatedAssignment[] = (data.data || []).map(
          (a: any) => ({
            id: a.id,
            studentName: a.student?.name || "—",
            studentEmail: a.student?.email || "—",
            subjectName: a.subject?.name || "—",
            subjectCode: a.subject?.code || "—",
            fileName: a.fileName || "—",
            fileUrl: a.fileUrl || "",
            grade: a.grade ?? 0,
            feedback: a.feedback || "",
            createdAt: a.createdAt,
            evaluatedAt: a.evaluatedAt || a.createdAt,
          }),
        );
        setAssignments(mapped);
        pag.setTotal(data.total || 0);
      }
    } catch {
      /* صامت */
    } finally {
      setLoading(false);
    }
  }, [pag.page, pag.limit]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  // ==================== تصدير Excel ====================
  const exportExcel = () => {
    setExporting("excel");
    try {
      let html = `
        <html dir="rtl">
        <head><meta charset="utf-8">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
            @page { size: A4 landscape; margin: 12mm; }
            body { font-family: 'Cairo', sans-serif; direction: rtl; background: #fff; color: #000; margin: 0; padding: 0; }
            .header { text-align: center; border-bottom: 2px solid #1a3a5c; padding-bottom: 8px; margin-bottom: 10px; }
            .header h1 { color: #1a3a5c; font-size: 14px; margin: 0 0 2px; }
            .header h2 { color: #2c5f8a; font-size: 11px; margin: 0 0 1px; }
            .header p { color: #666; font-size: 9px; margin: 0; }
            .info { text-align: center; margin-bottom: 10px; font-size: 10px; color: #444; }
            .info p { margin: 2px 0; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            th { background: #1a3a5c; color: #fff; padding: 6px 4px; border: 1px solid #1a3a5c; text-align: center; font-size: 9px; }
            td { padding: 5px 4px; border: 1px solid #ccc; text-align: center; font-size: 9px; }
            tr:nth-child(even) { background: #f5f8fc; }
            .grade-high { color: #2ea043; font-weight: bold; }
            .grade-low { color: #f85149; font-weight: bold; }
            .footer { text-align: center; margin-top: 12px; font-size: 8px; color: #888; border-top: 1px solid #ddd; padding-top: 6px; }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>سحابة الأمن السيبراني</h1>
            <h2>جامعة ذمار - كلية الحاسبات - قسم الأمن السيبراني</h2>
          </div>
          <div class="info">
            <p><strong>المعلم:</strong> ${userName} &nbsp;&nbsp;|&nbsp;&nbsp; <strong>التاريخ:</strong> ${new Date().toLocaleDateString("ar-YE")} &nbsp;&nbsp;|&nbsp;&nbsp; <strong>عدد التكاليف:</strong> ${assignments.length}</p>
          </div>
          <table>
            <thead><tr><th>#</th><th>اسم الطالب</th><th>المادة</th><th>تاريخ الرفع</th><th>ملاحظات المعلم</th><th>الدرجة</th></tr></thead>
            <tbody>
              ${assignments
                .map(
                  (a, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${a.studentName}</td>
                  <td>${a.subjectName}</td>
                  <td>${new Date(a.createdAt).toLocaleDateString("ar-YE")}</td>
                  <td>${a.feedback || "—"}</td>
                  <td class="${a.grade >= 50 ? "grade-high" : "grade-low"}">${a.grade}</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
          <div class="footer">
            <p>تم التصدير من سحابة الأمن السيبراني © ${new Date().getFullYear()} - جميع الحقوق محفوظة</p>
          </div>
        </body></html>`;

      const blob = new Blob([html], {
        type: "application/vnd.ms-excel;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `سجل_التقييمات_${new Date().toLocaleDateString("ar-YE")}.xls`;
      link.click();
      URL.revokeObjectURL(url);
      showToast("📊 تم تصدير ملف Excel بنجاح", "success");
    } catch {
      showToast("فشل التصدير", "error");
    } finally {
      setExporting(null);
    }
  };

  // ==================== تصدير PDF ====================
  const exportPDF = () => {
    setExporting("pdf");
    try {
      let html = `
        <html dir="rtl">
        <head><meta charset="utf-8"><style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
          body { font-family: 'Cairo', sans-serif; direction: rtl; background: #fff; color: #000; margin: 0; padding: 20px; }
          .header { text-align: center; border-bottom: 3px solid #1a3a5c; padding-bottom: 15px; margin-bottom: 20px; }
          .header h1 { color: #1a3a5c; font-size: 18px; margin: 0 0 5px; }
          .header h2 { color: #2c5f8a; font-size: 14px; margin: 0 0 3px; }
          .header p { color: #666; font-size: 11px; margin: 0; }
          .info { text-align: center; margin-bottom: 20px; font-size: 12px; color: #444; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th { background: #1a3a5c; color: #fff; padding: 10px 8px; border: 1px solid #1a3a5c; text-align: center; }
          td { padding: 8px; border: 1px solid #ddd; text-align: center; }
          tr:nth-child(even) { background: #f5f8fc; }
          .grade-high { color: #2ea043; font-weight: bold; }
          .grade-low { color: #f85149; font-weight: bold; }
          .footer { text-align: center; margin-top: 30px; font-size: 10px; color: #888; border-top: 1px solid #ddd; padding-top: 10px; }
          @media print { body { padding: 0; } }
        </style></head>
        <body>
          <div class="header">
            <h1>سحابة الأمن السيبراني</h1>
            <h2>جامعة ذمار - كلية الحاسبات</h2>
            <p>قسم الأمن السيبراني</p>
          </div>
          <div class="info">
            <p><strong>المعلم:</strong> ${userName}</p>
            <p><strong>التاريخ:</strong> ${new Date().toLocaleDateString("ar-YE")}</p>
            <p><strong>عدد التكاليف المقيمة:</strong> ${assignments.length}</p>
          </div>
          <table>
            <thead><tr><th>اسم الطالب</th><th>المادة</th><th>تاريخ الرفع</th><th>ملاحظات المعلم</th><th>الدرجة</th></tr></thead>
            <tbody>
              ${assignments
                .map(
                  (a) => `
                <tr>
                  <td>${a.studentName}</td>
                  <td>${a.subjectName}</td>
                  <td>${new Date(a.createdAt).toLocaleDateString("ar-YE")}</td>
                  <td>${a.feedback || "—"}</td>
                  <td class="${a.grade >= 50 ? "grade-high" : "grade-low"}">${a.grade}</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
          <div class="footer">
            <p>تم التصدير من سحابة الأمن السيبراني © ${new Date().getFullYear()}</p>
          </div>
        </body></html>`;
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      if (win) {
        win.onload = () => {
          win.print();
        };
      }
      URL.revokeObjectURL(url);
      showToast("📄 تم تصدير PDF (اضغط Ctrl+P للطباعة)", "success");
    } catch {
      showToast("فشل التصدير", "error");
    } finally {
      setExporting(null);
    }
  };

  // ==================== أدوات مساعدة ====================
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("ar-YE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  const getGradeColor = (g: number) =>
    g >= 80 ? "#2ea043" : g >= 50 ? "#ffca28" : "#f85149";

  const glassStyle: React.CSSProperties = {
    background: "rgba(10, 20, 40, 0.5)",
    backdropFilter: "blur(25px)",
    WebkitBackdropFilter: "blur(25px)",
    border: "1px solid rgba(0, 229, 255, 0.12)",
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
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push("/teacher")}
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
                    fontSize: "clamp(1.2rem, 3vw, 1.5rem)",
                    fontWeight: 800,
                    margin: 0,
                  }}
                >
                  📋 سجل التقييمات
                </h2>
                <p
                  style={{
                    color: "#8b949e",
                    fontSize: "0.85rem",
                    margin: "4px 0 0",
                  }}
                >
                  {userName} - التكاليف المقيمة
                </p>
              </div>
            </div>

            {/* أزرار التصدير */}
            <div style={{ display: "flex", gap: "8px" }}>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={exportExcel}
                disabled={exporting === "excel" || assignments.length === 0}
                style={{
                  padding: "10px 18px",
                  borderRadius: "12px",
                  background: "rgba(46,160,67,0.1)",
                  border: "1px solid rgba(46,160,67,0.3)",
                  color: "#2ea043",
                  cursor: "pointer",
                  fontFamily: "'Cairo', sans-serif",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  opacity: assignments.length === 0 ? 0.5 : 1,
                }}
              >
                <ExcelIcon /> Excel
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={exportPDF}
                disabled={exporting === "pdf" || assignments.length === 0}
                style={{
                  padding: "10px 18px",
                  borderRadius: "12px",
                  background: "rgba(248,81,73,0.1)",
                  border: "1px solid rgba(248,81,73,0.3)",
                  color: "#f85149",
                  cursor: "pointer",
                  fontFamily: "'Cairo', sans-serif",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  opacity: assignments.length === 0 ? 0.5 : 1,
                }}
              >
                <PdfIcon /> PDF
              </motion.button>
            </div>
          </motion.div>

          {/* ========== المحتوى ========== */}
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px" }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                style={{
                  width: "44px",
                  height: "44px",
                  border: "3px solid rgba(0,229,255,0.2)",
                  borderTopColor: "#00e5ff",
                  borderRadius: "50%",
                  margin: "0 auto 20px",
                }}
              />
              <p style={{ color: "#8b949e" }}>جاري تحميل السجل...</p>
            </div>
          ) : assignments.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{ ...glassStyle, padding: "60px", textAlign: "center" }}
            >
              <div style={{ fontSize: "4rem", marginBottom: "15px" }}>📭</div>
              <h3
                style={{
                  color: "#8b949e",
                  fontSize: "1.3rem",
                  marginBottom: "8px",
                }}
              >
                لا توجد تقييمات بعد
              </h3>
              <p style={{ color: "#5a6a7a" }}>
                سيتم عرض التكاليف التي قمت بتقييمها هنا
              </p>
            </motion.div>
          ) : (
            <>
              {/* عرض جدولي للشاشات الكبيرة */}
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
                        {[
                          "الطالب",
                          "المادة",
                          "الملف",
                          "تاريخ الرفع",
                          "تاريخ التقييم",
                          "الملاحظات",
                          "الدرجة",
                        ].map((h) => (
                          <th
                            key={h}
                            style={{
                              padding: "14px 12px",
                              textAlign: "center",
                              color: "#00e5ff",
                              fontWeight: 700,
                              fontSize: "0.8rem",
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
                        {assignments.map((a, i) => (
                          <motion.tr
                            key={a.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.02 }}
                            style={{
                              borderBottom: "1px solid rgba(255,255,255,0.03)",
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.background =
                                "rgba(0,229,255,0.03)")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.background = "transparent")
                            }
                          >
                            <td
                              style={{
                                padding: "12px",
                                textAlign: "center",
                                fontWeight: 600,
                                color: "#e6edf3",
                              }}
                            >
                              {a.studentName}
                            </td>
                            <td
                              style={{
                                padding: "12px",
                                textAlign: "center",
                                color: "#00e5ff",
                                fontSize: "0.8rem",
                              }}
                            >
                              {a.subjectName}
                            </td>
                            <td
                              style={{ padding: "12px", textAlign: "center" }}
                            >
                              {a.fileUrl ? (
                                <motion.a
                                  whileHover={{ scale: 1.1 }}
                                  href={a.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    color: "#00e5ff",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    fontSize: "0.75rem",
                                  }}
                                >
                                  <EyeIcon /> {a.fileName}
                                </motion.a>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td
                              style={{
                                padding: "12px",
                                textAlign: "center",
                                color: "#8b949e",
                                fontSize: "0.75rem",
                              }}
                            >
                              {formatDate(a.createdAt)}
                            </td>
                            <td
                              style={{
                                padding: "12px",
                                textAlign: "center",
                                color: "#8b949e",
                                fontSize: "0.75rem",
                              }}
                            >
                              {formatDate(a.evaluatedAt)}
                            </td>
                            <td
                              style={{
                                padding: "12px",
                                textAlign: "center",
                                color: "#8b949e",
                                fontSize: "0.8rem",
                                maxWidth: "200px",
                              }}
                            >
                              {a.feedback || "—"}
                            </td>
                            <td
                              style={{ padding: "12px", textAlign: "center" }}
                            >
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "6px 14px",
                                  borderRadius: "10px",
                                  fontWeight: 800,
                                  fontSize: "0.9rem",
                                  background: `${getGradeColor(a.grade)}18`,
                                  color: getGradeColor(a.grade),
                                  border: `1px solid ${getGradeColor(a.grade)}30`,
                                }}
                              >
                                {a.grade}
                              </span>
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              </motion.div>

              {/* عرض بطاقات للجوال */}
              <div
                className="lg:hidden"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <AnimatePresence mode="popLayout">
                  {assignments.map((a, i) => (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      whileHover={{ borderColor: "rgba(0,229,255,0.25)" }}
                      style={{ ...glassStyle, padding: "16px" }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          marginBottom: "10px",
                        }}
                      >
                        <div>
                          <p
                            style={{
                              fontWeight: 700,
                              color: "#e6edf3",
                              fontSize: "0.95rem",
                              margin: "0 0 2px",
                            }}
                          >
                            {a.studentName}
                          </p>
                          <p
                            style={{
                              color: "#00e5ff",
                              fontSize: "0.75rem",
                              margin: 0,
                            }}
                          >
                            {a.subjectName}
                          </p>
                        </div>
                        <span
                          style={{
                            padding: "5px 12px",
                            borderRadius: "10px",
                            fontWeight: 800,
                            fontSize: "0.85rem",
                            background: `${getGradeColor(a.grade)}18`,
                            color: getGradeColor(a.grade),
                            border: `1px solid ${getGradeColor(a.grade)}30`,
                          }}
                        >
                          {a.grade}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: "6px",
                          flexWrap: "wrap",
                          marginBottom: "6px",
                          alignItems: "center",
                        }}
                      >
                        <span style={{ color: "#8b949e", fontSize: "0.7rem" }}>
                          📅 {formatDate(a.createdAt)}
                        </span>
                        {a.fileUrl && (
                          <a
                            href={a.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: "#00e5ff",
                              fontSize: "0.7rem",
                              display: "flex",
                              alignItems: "center",
                              gap: "3px",
                            }}
                          >
                            <EyeIcon /> ملف
                          </a>
                        )}
                      </div>
                      {a.feedback && (
                        <div
                          style={{
                            padding: "8px 10px",
                            borderRadius: "8px",
                            background: "rgba(255,255,255,0.03)",
                            color: "#8b949e",
                            fontSize: "0.8rem",
                          }}
                        >
                          💬 {a.feedback}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* ترقيم */}
              <div style={{ marginTop: "20px" }}>
                <Pagination
                  page={pag.page}
                  totalPages={pag.totalPages}
                  onPageChange={pag.goTo}
                />
              </div>
            </>
          )}
        </main>
      </PageTransition>
      <Footer />
    </div>
  );
}
