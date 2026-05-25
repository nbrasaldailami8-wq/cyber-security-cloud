"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CyberGlobe from "@/components/effects/CyberGlobe";
import MatrixRain from "@/components/effects/MatrixRain";
import NeonParticles from "@/components/effects/NeonParticles";
import ScanLine from "@/components/effects/ScanLine";

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // فحص إذا كان localStorage متاح (للتأكد أننا في المتصفح)
    if (typeof window !== "undefined") {
      const onboardingSeen = localStorage.getItem("onboardingSeen");
      if (!onboardingSeen) {
        router.push("/onboarding");
      } else {
        router.push("/login");
      }
    }
    setLoading(false);
  }, [router]);

  if (!loading) return null;

  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden bg-bg-space">
      <div className="absolute inset-0 quantum-grid z-0" />
      <MatrixRain />
      <CyberGlobe />
      <NeonParticles />
      <ScanLine />

      <div className="relative z-20 text-center">
        <div className="glass-card p-10">
          <h1 className="text-4xl font-bold neon-text mb-4 font-arabic">
            جاري التحميل...
          </h1>
        </div>
      </div>
    </main>
  );
}
