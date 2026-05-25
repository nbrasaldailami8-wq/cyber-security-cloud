"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import PageTransition from "@/components/layout/PageTransition";

export default function DashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    const role = localStorage.getItem("userRole");
    if (role === "ADMIN") router.replace("/admin");
    else if (role === "MANAGEMENT") router.replace("/management");
    else if (role === "TEACHER") router.replace("/teacher");
    else if (role === "STUDENT") router.replace("/student");
    else router.replace("/login");
  }, [router]);

  return (
    <PageTransition className="min-h-screen bg-[#010204] flex items-center justify-center">
      <div className="animate-spin w-10 h-10 border-2 border-[#00e5ff] border-t-transparent rounded-full" />
    </PageTransition>
  );
}
