import type { Config } from "tailwindcss";
import daisyui from "daisyui";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],

  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-poppins)", "sans-serif"], // Assuming Poppins is your default sans-serif
        thunder: ["var(--font-thunder)", "sans-serif"],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        muted: "var(--text-muted)",
      },
      boxShadow: {},
      backgroundImage: {},
    },
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        light: {
          "primary": "#ff7c7c",
          "primary-content": "#ffffff",
          "secondary": "#8f2c2c",
          "secondary-content": "#ffffff",
          "accent": "#06b6d4",
          "accent-content": "#ffffff",
          "neutral": "#6b7280",
          "neutral-content": "#ffffff",
          "base-100": "#faf7f4",
          "base-200": "#f8fafc",
          "base-300": "#f1f5f9",
          "base-content": "#0f172a",
          "info": "#06b6d4",
          "info-content": "#ffffff",
          "success": "#10b981",
          "success-content": "#ffffff",
          "warning": "#f59e0b",
          "warning-content": "#ffffff",
          "error": "#ef4444",
          "error-content": "#ffffff",
        },
      },
      {
        dark: {
          "primary": "#ff7c7c",
          "primary-content": "#ffffff",
          "secondary": "#8f2c2c",
          "secondary-content": "#ffffff",
          "accent": "#06b6d4",
          "accent-content": "#ffffff",
          "neutral": "#374151",
          "neutral-content": "#f9fafb",
          "base-100": "#24272c",
          "base-200": "#1a1e24",
          "base-300": "#1f2226",
          "base-content": "#feffe2",
          "info": "#06b6d4",
          "info-content": "#ffffff",
          "success": "#10b981",
          "success-content": "#ffffff",
          "warning": "#f59e0b",
          "warning-content": "#ffffff",
          "error": "#ef4444",
          "error-content": "#ffffff",
        },
      },
    ],
    darkTheme: "dark",
    base: true,
    styled: true,
    utils: true,
    prefix: "",
    logs: true,
    themeRoot: ":root",
  },
} satisfies Config;
