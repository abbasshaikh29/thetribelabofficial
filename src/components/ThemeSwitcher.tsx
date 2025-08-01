"use client";

import { useState, useEffect } from "react";
import { Moon, Sun, Monitor } from "lucide-react";

type ThemeOption = "light" | "dark" | "system";

export default function ThemeSwitcher() {
  const [currentTheme, setCurrentTheme] = useState<ThemeOption>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  // Detect system theme preference
  const getSystemTheme = (): "light" | "dark" => {
    if (typeof window !== "undefined") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
  };

  // Apply theme with smooth transitions
  const applyTheme = (theme: "light" | "dark") => {
    // Add transition class temporarily
    document.documentElement.style.setProperty('transition', 'var(--theme-transition)');

    // Set the theme at document level
    document.documentElement.setAttribute("data-theme", theme);
    document.body.setAttribute("data-theme", theme);

    // Dispatch custom event for components that need to react to theme changes
    window.dispatchEvent(new CustomEvent('theme-change', { detail: { theme } }));

    // Remove transition after a short delay to avoid affecting other animations
    setTimeout(() => {
      document.documentElement.style.removeProperty('transition');
    }, 300);
  };

  // Resolve theme based on current selection
  const resolveTheme = (themeOption: ThemeOption): "light" | "dark" => {
    if (themeOption === "system") {
      return getSystemTheme();
    }
    return themeOption;
  };

  useEffect(() => {
    // Get the theme preference from localStorage or use system default
    const savedTheme = (localStorage.getItem("theme") as ThemeOption) || "system";
    setCurrentTheme(savedTheme);

    const resolved = resolveTheme(savedTheme);
    setResolvedTheme(resolved);
    applyTheme(resolved);

    // Listen for system theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = () => {
      if (currentTheme === "system") {
        const newResolvedTheme = getSystemTheme();
        setResolvedTheme(newResolvedTheme);
        applyTheme(newResolvedTheme);
      }
    };

    mediaQuery.addEventListener("change", handleSystemThemeChange);
    return () => mediaQuery.removeEventListener("change", handleSystemThemeChange);
  }, [currentTheme]);

  const toggleTheme = (theme: ThemeOption) => {
    setCurrentTheme(theme);
    localStorage.setItem("theme", theme);

    const resolved = resolveTheme(theme);
    setResolvedTheme(resolved);
    applyTheme(resolved);
  };

  const getThemeIcon = () => {
    if (currentTheme === "system") {
      return <Monitor className="h-5 w-5" />;
    }
    return resolvedTheme === "dark" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />;
  };

  return (
    <div className="dropdown dropdown-end">
      <button
        tabIndex={0}
        type="button"
        className="btn btn-ghost btn-circle transition-all duration-200 hover:bg-opacity-80"
        title={`Current theme: ${currentTheme === "system" ? `System (${resolvedTheme})` : currentTheme}`}
      >
        {getThemeIcon()}
      </button>
      <ul
        tabIndex={0}
        className="dropdown-content z-[1] menu p-2 shadow-xl rounded-box w-56 mt-4 border"
        style={{ 
          backgroundColor: "var(--dropdown-bg)", 
          borderColor: "var(--border-color)",
          opacity: "1",
          backdropFilter: "none"
        }}
      >
        <li className="menu-title">
          <span style={{ color: "var(--text-secondary)" }}>Choose Theme</span>
        </li>
        <li>
          <button
            type="button"
            onClick={() => toggleTheme("light")}
            className={`flex items-center gap-3 transition-all duration-200 ${
              currentTheme === "light" ? "active bg-primary text-primary-content" : ""
            }`}
          >
            <Sun className="h-4 w-4" />
            <span>Light</span>
            {currentTheme === "light" && <span className="ml-auto text-xs opacity-70">✓</span>}
          </button>
        </li>
        <li>
          <button
            type="button"
            onClick={() => toggleTheme("dark")}
            className={`flex items-center gap-3 transition-all duration-200 ${
              currentTheme === "dark" ? "active bg-primary text-primary-content" : ""
            }`}
          >
            <Moon className="h-4 w-4" />
            <span>Dark</span>
            {currentTheme === "dark" && <span className="ml-auto text-xs opacity-70">✓</span>}
          </button>
        </li>
        <li>
          <button
            type="button"
            onClick={() => toggleTheme("system")}
            className={`flex items-center gap-3 transition-all duration-200 ${
              currentTheme === "system" ? "active bg-primary text-primary-content" : ""
            }`}
          >
            <Monitor className="h-4 w-4" />
            <span>System</span>
            {currentTheme === "system" && <span className="ml-auto text-xs opacity-70">✓</span>}
          </button>
        </li>
        <li className="mt-2 pt-2 border-t border-base-300">
          <div className="text-xs opacity-60 px-3 py-1" style={{ color: "var(--text-muted)" }}>
            {currentTheme === "system" ? `Following system (${resolvedTheme})` : `Using ${currentTheme} theme`}
          </div>
        </li>
      </ul>
    </div>
  );
}
