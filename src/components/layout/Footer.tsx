export default function Footer() {
  return (
    <footer
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        padding: "6px 16px",
        textAlign: "center",
        background: "rgba(2, 4, 8, 0.85)",
        backdropFilter: "blur(25px)",
        WebkitBackdropFilter: "blur(25px)",
        borderTop: "1px solid rgba(0, 229, 255, 0.15)",
        fontFamily: "'Cairo', sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "8px",
          flexWrap: "wrap",
          fontSize: "clamp(0.65rem, 1.3vw, 0.78rem)",
          color: "#bbb",
        }}
      >
        <span>تطوير وإشراف:</span>
        <span
          style={{
            color: "#00e5ff",
            fontWeight: "bold",
            textShadow: "0 0 8px rgba(0,229,255,0.3)",
          }}
        >
          محمد إبراهيم الديلمي | أحمد الهيدمة
        </span>
      </div>
      <div
        style={{
          fontFamily: "'Orbitron', sans-serif",
          fontSize: "clamp(0.55rem, 1vw, 0.65rem)",
          opacity: 0.5,
          marginTop: "2px",
          letterSpacing: "1px",
        }}
      >
        OFFICIAL CYBER SECURITY PLATFORM - DHAMAR UNIVERSITY &copy; 2026
      </div>
    </footer>
  );
}
