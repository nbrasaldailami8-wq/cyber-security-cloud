import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // الألوان الأساسية
        primary: {
          neon: "#00e5ff",
          DEFAULT: "#00e5ff",
        },
        bg: {
          space: "#010204",
          navy: "#0a1128",
          panel: "#0d1117",
          card: "#161b22",
          input: "#0d1117",
          glass: "rgba(10, 18, 30, 0.7)",
        },
        text: {
          primary: "#e6edf3",
          secondary: "#8b949e",
          white: "#ffffff",
        },
        border: {
          DEFAULT: "#30363d",
          glass: "rgba(48, 54, 61, 0.5)",
        },
        // ألوان النظام والتنبيهات
        danger: {
          light: "#ff4d4d",
          DEFAULT: "#ff3131",
          dark: "#f85149",
        },
        success: {
          light: "#39ff14",
          DEFAULT: "#2ea043",
        },
        warning: {
          light: "#e3b341",
          DEFAULT: "#ffca28",
        },
        purple: {
          light: "#bf5af2",
          DEFAULT: "#7a00ff",
          dark: "#bc13fe",
        },
        // ألوان Glassmorphism
        glass: {
          panel: "rgba(13, 17, 23, 0.92)",
          card: "rgba(22, 27, 34, 0.85)",
          sidebar: "rgba(13, 17, 23, 0.98)",
          modal: "rgba(13, 17, 23, 0.95)",
        },
      },
      fontFamily: {
        arabic: ["Cairo", "Tajawal", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      backdropBlur: {
        glass: "20px",
      },
      boxShadow: {
        neon: "0 0 10px rgba(0, 229, 255, 0.3), 0 0 20px rgba(0, 229, 255, 0.1)",
        "neon-strong":
          "0 0 15px rgba(0, 229, 255, 0.5), 0 0 30px rgba(0, 229, 255, 0.2)",
        glass: "0 8px 32px rgba(0, 0, 0, 0.3)",
        card: "0 4px 16px rgba(0, 0, 0, 0.2)",
      },
      animation: {
        "scan-line": "scanLine 3s linear infinite",
        float: "float 6s ease-in-out infinite",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        glow: "glow 2s ease-in-out infinite alternate",
      },
      keyframes: {
        scanLine: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-20px)" },
        },
        glow: {
          "0%": { boxShadow: "0 0 5px rgba(0, 229, 255, 0.2)" },
          "100%": { boxShadow: "0 0 20px rgba(0, 229, 255, 0.6)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
