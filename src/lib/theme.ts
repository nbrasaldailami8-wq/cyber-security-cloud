import type { CSSProperties } from "react";

export const colors = {
  primary: "#00e5ff",
  secondary: "#39ff14",
  bg: "#010204",
  bgNavy: "#0a1128",
  card: "rgba(22,27,34,0.6)",
  cardBg: "#161b22",
  cardBorder: "rgba(255,255,255,0.08)",
  inputBg: "#0d1117",
  text: "#e6edf3",
  muted: "#8b949e",
  success: "#2ea043",
  danger: "#f85149",
  warning: "#ffca28",
  accent: "#bf5af2",
  supabase: "#3ecf8e",
  adminCyan: "#00e5ff",
  adminRed: "#ff3131",
  adminGreen: "#39ff14",
  adminGold: "#ffca28",
  roleAdmin: "#ff3131",
  roleManagement: "#ffca28",
  roleTeacher: "#bf5af2",
  roleStudent: "#00e5ff",
} as const;

export const glassCard: CSSProperties = {
  background: "rgba(13, 17, 23, 0.92)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(0, 229, 255, 0.2)",
  borderRadius: "16px",
  padding: "24px",
};

export const glassCardLight: CSSProperties = {
  background: "rgba(22,27,34,0.6)",
  backdropFilter: "blur(15px)",
  WebkitBackdropFilter: "blur(15px)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "16px",
  padding: "20px",
};

export const inputStyle: CSSProperties = {
  width: "100%",
  padding: "13px 15px",
  background: "rgba(0,0,0,0.5)",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "#fff",
  borderRadius: "14px",
  fontFamily: "'Cairo', sans-serif",
  outline: "none",
  transition: "border-color 0.3s",
  boxSizing: "border-box",
};

export const btnPrimary: CSSProperties = {
  padding: "12px 24px",
  background: "linear-gradient(135deg, #238636, #2ea043)",
  border: "none",
  borderRadius: "12px",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "'Cairo', sans-serif",
  fontSize: "0.95rem",
};

export const btnDanger: CSSProperties = {
  ...btnPrimary,
  background: "linear-gradient(135deg, #da3633, #f85149)",
};

export const btnOutline: CSSProperties = {
  padding: "10px 20px",
  background: "rgba(0,229,255,0.1)",
  border: "1px solid #00e5ff",
  borderRadius: "10px",
  color: "#00e5ff",
  cursor: "pointer",
  fontFamily: "'Cairo', sans-serif",
  fontWeight: 700,
};

export const badgeStyle = (color: string): CSSProperties => ({
  padding: "3px 10px",
  borderRadius: "6px",
  background: `${color}15`,
  color,
  fontSize: "0.75rem",
});

export const filterBtn = (active: boolean): CSSProperties => ({
  padding: "8px 16px",
  borderRadius: "20px",
  border: active ? "1px solid #00e5ff" : "1px solid rgba(255,255,255,0.1)",
  background: active ? "rgba(0,229,255,0.1)" : "transparent",
  color: active ? "#00e5ff" : "#8b949e",
  cursor: "pointer",
  fontFamily: "'Cairo', sans-serif",
  fontSize: "0.85rem",
});

export const pageContainer: CSSProperties = {
  minHeight: "100vh",
  background: "#010204",
  fontFamily: "'Cairo', sans-serif",
  color: "#fff",
};

export const mainContent: CSSProperties = {
  padding: "100px 20px 60px",
  maxWidth: "1200px",
  margin: "0 auto",
};

export const sectionTitle: CSSProperties = {
  color: "#00e5ff",
  fontSize: "1.8rem",
  fontWeight: 800,
  marginBottom: "25px",
};
