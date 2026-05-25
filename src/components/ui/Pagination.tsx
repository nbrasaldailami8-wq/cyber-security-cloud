"use client";

import { motion } from "framer-motion";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const btnBase: React.CSSProperties = {
  padding: "8px 16px",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "8px",
  background: "transparent",
  color: "#8b949e",
  cursor: "pointer",
  fontFamily: "'Cairo', sans-serif",
  fontSize: "0.85rem",
  fontWeight: 600,
  transition: "all 0.2s",
};

export default function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages: (number | "...")[] = [];
  const delta = 2;
  const left = Math.max(2, page - delta);
  const right = Math.min(totalPages - 1, page + delta);

  pages.push(1);
  if (left > 2) pages.push("...");
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < totalPages - 1) pages.push("...");
  if (totalPages > 1) pages.push(totalPages);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", marginTop: "20px", flexWrap: "wrap" }}>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        style={{ ...btnBase, opacity: page <= 1 ? 0.4 : 1, cursor: page <= 1 ? "not-allowed" : "pointer" }}
      >
        السابق
      </motion.button>

      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`ellipsis-${i}`} style={{ color: "#484f58", padding: "8px 4px", fontSize: "0.85rem" }}>...</span>
        ) : (
          <motion.button
            key={p}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onPageChange(p)}
            style={{
              ...btnBase,
              background: p === page ? "rgba(0,229,255,0.15)" : "transparent",
              borderColor: p === page ? "rgba(0,229,255,0.4)" : "rgba(255,255,255,0.1)",
              color: p === page ? "#00e5ff" : "#8b949e",
              minWidth: "38px",
              textAlign: "center",
            }}
          >
            {p}
          </motion.button>
        ),
      )}

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        style={{ ...btnBase, opacity: page >= totalPages ? 0.4 : 1, cursor: page >= totalPages ? "not-allowed" : "pointer" }}
      >
        التالي
      </motion.button>
    </div>
  );
}
