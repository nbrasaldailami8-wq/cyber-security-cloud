"use client";

import { useEffect, useState, useRef } from "react";

const colors = [
  "rgba(0, 229, 255, 0.7)",
  "rgba(191, 90, 242, 0.7)",
  "rgba(0, 255, 136, 0.7)",
  "rgba(255, 49, 49, 0.6)",
  "rgba(255, 202, 40, 0.6)",
  "rgba(163, 113, 247, 0.6)",
];

export default function ScanLine() {
  const [position, setPosition] = useState(0);
  const [colorIndex, setColorIndex] = useState(0);
  const [height, setHeight] = useState(2);
  const colorTimerRef = useRef<NodeJS.Timeout | null>(null);
  const posRef = useRef(0);

  useEffect(() => {
    const speed = 8 + Math.random() * 12;
    const interval = setInterval(() => {
      posRef.current = posRef.current >= 100 ? 0 : posRef.current + 0.2 + Math.random() * 0.5;
      setPosition(posRef.current);
      setHeight(1.5 + Math.random() * 3);
    }, speed);

    colorTimerRef.current = setInterval(() => {
      setColorIndex((prev) => (prev + 1) % colors.length);
    }, 3000);

    return () => {
      clearInterval(interval);
      if (colorTimerRef.current) clearInterval(colorTimerRef.current);
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: `${position}%`,
        left: 0,
        width: "100%",
        height: `${height}px`,
        background: `linear-gradient(90deg, transparent 0%, ${colors[colorIndex]} 50%, transparent 100%)`,
        boxShadow: `0 0 ${10 + height * 5}px ${colors[colorIndex].replace("0.6", "0.3")}, 0 0 ${20 + height * 8}px ${colors[colorIndex].replace("0.6", "0.1")}`,
        transition: "background 0.8s ease, box-shadow 0.8s ease, height 0.3s ease",
        zIndex: 100,
        pointerEvents: "none",
      }}
    />
  );
}
