import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore";

export function useAuth() {
  const { user, isAuthenticated, isLoading, logout } = useAuthStore();

  useEffect(() => {
    useAuthStore.getState().hydrate();
  }, []);

  return {
    user,
    isAuthenticated,
    isLoading,
    role: user?.role || null,
    level: user?.level || null,
    isAdmin: user?.role === "ADMIN",
    isManagement: user?.role === "MANAGEMENT",
    isTeacher: user?.role === "TEACHER",
    isStudent: user?.role === "STUDENT",
    managementLevel:
      user?.role !== "ADMIN" ? (user as any)?.managementLevel || null : null,
    logout,
  };
}
