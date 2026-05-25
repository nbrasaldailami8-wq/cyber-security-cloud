import { create } from "zustand";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  level: string;
  webAuthnEnabled: boolean;
  managementLevel?: string | null;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user) => {
    localStorage.setItem("userRole", user.role);
    localStorage.setItem("userLevel", user.level);
    localStorage.setItem("userName", user.name);
    localStorage.setItem("userEmail", user.email);
    localStorage.setItem("userId", user.id);
    if ((user as any).managementLevel) {
      localStorage.setItem("managementLevel", (user as any).managementLevel);
    }
    set({ user, isAuthenticated: true, isLoading: false });
  },

  logout: () => {
    localStorage.removeItem("userRole");
    localStorage.removeItem("userLevel");
    localStorage.removeItem("userName");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userId");
    localStorage.removeItem("managementLevel");
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  hydrate: () => {
    const user: User | null = (() => {
      const role = localStorage.getItem("userRole");
      if (!role) return null;
      return {
        id: localStorage.getItem("userId") || "",
        email: localStorage.getItem("userEmail") || "",
        name: localStorage.getItem("userName") || "",
        role,
        level: localStorage.getItem("userLevel") || "",
        webAuthnEnabled: false,
        managementLevel: localStorage.getItem("managementLevel") || null,
      };
    })();
    set({
      user,
      isAuthenticated: !!user,
      isLoading: false,
    });
  },
}));
