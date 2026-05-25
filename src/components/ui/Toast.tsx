"use client";

import {
  useState,
  useEffect,
  createContext,
  useContext,
  useCallback,
} from "react";
import { motion, AnimatePresence } from "framer-motion";

type ToastType = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const getColors = (type: ToastType) => {
    switch (type) {
      case "success":
        return { bg: "rgba(46,160,67,0.2)", border: "#2ea043", icon: "✅" };
      case "error":
        return { bg: "rgba(248,81,73,0.2)", border: "#f85149", icon: "❌" };
      case "warning":
        return { bg: "rgba(255,202,40,0.2)", border: "#ffca28", icon: "⚠️" };
      case "info":
        return { bg: "rgba(0,229,255,0.2)", border: "#00e5ff", icon: "ℹ️" };
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        style={{
          position: "fixed",
          top: "90px",
          left: "20px",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <AnimatePresence>
          {toasts.map((toast) => {
            const colors = getColors(toast.type);
            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, x: -100, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 100, scale: 0.9 }}
                transition={{ duration: 0.3 }}
                style={{
                  background: colors.bg,
                  backdropFilter: "blur(15px)",
                  border: `1px solid ${colors.border}`,
                  borderRadius: "12px",
                  padding: "14px 20px",
                  color: "#fff",
                  fontFamily: "'Cairo', sans-serif",
                  fontSize: "0.9rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  minWidth: "280px",
                  maxWidth: "400px",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
                }}
              >
                <span>{colors.icon}</span>
                <span>{toast.message}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
