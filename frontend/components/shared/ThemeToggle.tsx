"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = (localStorage.getItem("olimp-theme") as Theme | null);
    const system = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    const t = saved ?? system;
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("olimp-theme", next);
  }

  if (!mounted) return null;

  return (
    <button
      onClick={toggle}
      title={`Тема: ${theme === "dark" ? "тёмная" : "светлая"} — нажмите чтобы переключить`}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        width: "100%", padding: "7px 12px", borderRadius: 8,
        background: "var(--bg-base)", border: "1px solid var(--border-subtle)",
        color: "var(--text-secondary)", fontSize: 12, cursor: "pointer", outline: "none",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {theme === "dark" ? (
          // moon
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        ) : (
          // sun
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </>
        )}
      </svg>
      {theme === "dark" ? "Тёмная тема" : "Светлая тема"}
    </button>
  );
}
