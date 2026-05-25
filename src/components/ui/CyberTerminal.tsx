"use client";

import { useEffect, useRef } from "react";

interface CyberTerminalProps {
  logs: string[];
  prompt?: string;
  className?: string;
  minHeight?: string;
}

export default function CyberTerminal({
  logs = [],
  prompt = "$",
  className = "",
  minHeight = "400px",
}: CyberTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div
      className={className}
      style={{
        background: "rgba(1,2,4,0.96)",
        border: "1px solid rgba(48,54,61,0.5)",
        borderRadius: "14px",
        overflow: "hidden",
        boxShadow:
          "0 15px 50px rgba(0,0,0,0.6), inset 0 0 80px rgba(0,0,0,0.4)",
        fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
        direction: "ltr",
        textAlign: "left",
      }}
    >
      {/* شريط العنوان */}
      <div
        style={{
          background: "rgba(22,27,34,0.9)",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          borderBottom: "1px solid rgba(48,54,61,0.4)",
        }}
      >
        <div style={{ display: "flex", gap: "6px" }}>
          <span
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              background: "#f85149",
              cursor: "pointer",
            }}
          />
          <span
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              background: "#ffca28",
              cursor: "pointer",
            }}
          />
          <span
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              background: "#2ea043",
              cursor: "pointer",
            }}
          />
        </div>
        <span
          style={{
            color: "#8b949e",
            fontSize: "0.75rem",
            flex: 1,
            textAlign: "center",
          }}
        >
          admin@cybersec — bash — 80×24
        </span>
      </div>

      {/* جسم الطرفية */}
      <div
        ref={terminalRef}
        style={{
          height: "auto",
          minHeight,
          maxHeight: "600px",
          overflowY: "auto",
          padding: "16px 20px",
          fontSize: "0.78rem",
          lineHeight: 1.9,
          color: "#00ff41",
        }}
      >
        {logs.length === 0 ? (
          <div style={{ color: "#8b949e" }}>
            <div>
              <span style={{ color: "#00e5ff" }}>{prompt}</span> نظام سحابة
              الأمن السيبراني - Terminal v1.0
            </div>
            <div>
              <span style={{ color: "#00e5ff" }}>{prompt}</span> جاهز لاستقبال
              السجلات...
            </div>
            <div>
              <span style={{ color: "#00e5ff" }}>{prompt}</span>{" "}
              <span
                style={{
                  display: "inline-block",
                  width: "10px",
                  height: "16px",
                  background: "#00e5ff",
                  animation: "blink 0.8s step-end infinite",
                  verticalAlign: "middle",
                  borderRadius: "2px",
                }}
              />
            </div>
          </div>
        ) : (
          <>
            {logs.map((log, idx) => {
              const isError = log.includes("[ERROR]") || log.includes("❌");
              const isWarning = log.includes("[WARN]") || log.includes("⚠️");
              const isCritical =
                log.includes("[CRITICAL]") || log.includes("💀");
              const isInfo = log.includes("[INFO]") || log.includes("ℹ️");

              let logColor = "#00ff41";
              if (isCritical) logColor = "#ff3131";
              else if (isError) logColor = "#f85149";
              else if (isWarning) logColor = "#ffca28";
              else if (isInfo) logColor = "#00e5ff";

              return (
                <div
                  key={idx}
                  style={{
                    color: logColor,
                    padding: "1px 0",
                    borderBottom: "1px solid rgba(255,255,255,0.015)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                  }}
                >
                  <span style={{ color: "#8b949e" }}>{prompt}</span> {log}
                </div>
              );
            })}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginTop: "8px",
              }}
            >
              <span style={{ color: "#00e5ff" }}>{prompt}</span>
              <span
                style={{
                  display: "inline-block",
                  width: "10px",
                  height: "16px",
                  background: "#00e5ff",
                  animation: "blink 0.8s step-end infinite",
                  verticalAlign: "middle",
                  borderRadius: "2px",
                }}
              />
            </div>
          </>
        )}
      </div>

      {/* شريط الحالة */}
      <div
        style={{
          background: "rgba(22,27,34,0.9)",
          borderTop: "1px solid rgba(48,54,61,0.4)",
          padding: "6px 16px",
          display: "flex",
          flexWrap: "wrap",
          gap: "14px",
          fontSize: "0.7rem",
          color: "#8b949e",
        }}
      >
        <span>🟢 متصل</span>
        <span>📊 {logs.length} سجل</span>
        <span>bash</span>
        <span>UTF-8</span>
      </div>

      {/* أنيميشن المؤشر */}
      <style jsx>{`
        @keyframes blink {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0;
          }
        }
        ::-webkit-scrollbar {
          width: 5px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(0, 229, 255, 0.12);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}
