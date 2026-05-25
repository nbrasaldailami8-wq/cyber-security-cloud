"use client";

import { useState, useEffect } from "react";

export default function Header() {
  const [clock, setClock] = useState("00:00:00 AM");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      let h = now.getHours();
      const m = now.getMinutes().toString().padStart(2, "0");
      const s = now.getSeconds().toString().padStart(2, "0");
      const ampm = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      setClock(`${h}:${m}:${s} ${ampm}`);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: "rgba(2, 4, 8, 0.85)",
        backdropFilter: "blur(30px)",
        WebkitBackdropFilter: "blur(30px)",
        borderBottom: "1.5px solid rgba(0, 229, 255, 0.25)",
        boxShadow:
          "0 8px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(0, 229, 255, 0.08)",
        fontFamily: "'Cairo', sans-serif",
      }}
    >
      {isMobile ? (
        /* تصميم الجوال - صف واحد */
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 16px",
            gap: "8px",
          }}
        >
          <span
            style={{
              fontFamily: "'Orbitron', sans-serif",
              fontSize: "0.9rem",
              fontWeight: 700,
              color: "#00e5ff",
              textShadow: "0 0 10px #00e5ff",
              direction: "ltr",
              whiteSpace: "nowrap",
            }}
          >
            {clock}
          </span>
          <div style={{ textAlign: "center", flex: 1 }}>
            <span
              style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                color: "#fff",
                textShadow: "0 0 8px rgba(0,229,255,0.3)",
              }}
            >
              سحابة الأمن السيبراني
            </span>
          </div>
          <span
            style={{
              fontSize: "0.7rem",
              fontWeight: 600,
              color: "#00e5ff",
              textShadow: "0 0 6px rgba(0,229,255,0.3)",
              whiteSpace: "nowrap",
            }}
          >
            ذمار
          </span>
        </div>
      ) : (
        /* تصميم الكمبيوتر - 3 أقسام */
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 4%",
            gap: "10px",
          }}
        >
          {/* الساعة */}
          <div
            style={{
              fontFamily: "'Orbitron', sans-serif",
              fontSize: "clamp(1.2rem, 2.5vw, 1.6rem)",
              fontWeight: 700,
              color: "#00e5ff",
              textShadow: "0 0 15px #00e5ff, 0 0 30px rgba(0,229,255,0.4)",
              direction: "ltr",
              whiteSpace: "nowrap",
              minWidth: "130px",
            }}
          >
            {clock}
          </div>

          {/* اسم الموقع */}
          <div style={{ textAlign: "center", flex: 1 }}>
            <h2
              style={{
                fontSize: "clamp(1rem, 2vw, 1.4rem)",
                fontWeight: 800,
                color: "#fff",
                textShadow: "0 0 15px #00e5ff, 0 0 30px rgba(0,229,255,0.4)",
                margin: 0,
                letterSpacing: "1px",
              }}
            >
              سحابة الأمن السيبراني
            </h2>
            <p
              style={{
                fontFamily: "'Orbitron', sans-serif",
                fontSize: "clamp(0.65rem, 1.2vw, 0.8rem)",
                color: "#00e5ff",
                textTransform: "uppercase",
                letterSpacing: "3px",
                margin: "2px 0 0",
                opacity: 0.9,
              }}
            >
              Cybersecurity Cloud
            </p>
          </div>

          {/* الجامعة */}
          <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
            <h1
              style={{
                fontSize: "clamp(0.9rem, 2vw, 1.2rem)",
                color: "#fff",
                fontWeight: 900,
                textShadow: "0 0 10px rgba(0,229,255,0.3)",
                margin: 0,
              }}
            >
              - كلية الأمن السيبراني
            </h1>
            <p
              style={{
                fontSize: "clamp(0.7rem, 1.5vw, 0.85rem)",
                color: "#00e5ff",
                fontFamily: "'Orbitron', sans-serif",
                fontWeight: 500,
                margin: "2px 0 0",
                opacity: 0.8,
              }}
            >
              Cyber Security Department
            </p>
          </div>
        </div>
      )}
    </header>
  );
}
