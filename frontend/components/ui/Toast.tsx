"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

interface ToastItem {
  id: string;
  kind: "success" | "error" | "info" | "warn";
  text: string;
  duration?: number;
}

interface ToastContextValue {
  notify: (kind: ToastItem["kind"], text: string, duration?: number) => void;
  success: (text: string, duration?: number) => void;
  error: (text: string, duration?: number) => void;
  info: (text: string, duration?: number) => void;
  warn: (text: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

const COLORS: Record<ToastItem["kind"], { bg: string; border: string; text: string }> = {
  success: { bg: "rgba(34,197,94,0.10)", border: "#22c55e", text: "var(--success)" },
  error:   { bg: "rgba(248,113,113,0.10)", border: "#f87171", text: "var(--danger)" },
  info:    { bg: "rgba(96,165,250,0.10)", border: "#60a5fa", text: "#60a5fa" },
  warn:    { bg: "rgba(251,191,36,0.10)", border: "#fbbf24", text: "var(--warning)" },
};

const ICONS: Record<ToastItem["kind"], string> = {
  success: "✓", error: "✕", info: "ℹ", warn: "⚠",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timersRef = useRef<Record<string, NodeJS.Timeout>>({});

  const dismiss = useCallback((id: string) => {
    setItems((arr) => arr.filter((i) => i.id !== id));
    const t = timersRef.current[id];
    if (t) { clearTimeout(t); delete timersRef.current[id]; }
  }, []);

  const notify = useCallback((kind: ToastItem["kind"], text: string, duration = 4000) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setItems((arr) => [...arr, { id, kind, text, duration }]);
    timersRef.current[id] = setTimeout(() => dismiss(id), duration);
  }, [dismiss]);

  const value: ToastContextValue = {
    notify,
    success: (t, d) => notify("success", t, d),
    error: (t, d) => notify("error", t, d),
    info: (t, d) => notify("info", t, d),
    warn: (t, d) => notify("warn", t, d),
  };

  useEffect(() => () => {
    Object.values(timersRef.current).forEach(clearTimeout);
  }, []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div style={{
        position: "fixed", bottom: 24, right: 24, zIndex: 300,
        display: "flex", flexDirection: "column", gap: 10, maxWidth: 380,
      }}>
        {items.map((t) => {
          const c = COLORS[t.kind];
          return (
            <div
              key={t.id}
              onClick={() => dismiss(t.id)}
              style={{
                padding: "12px 16px",
                background: c.bg,
                border: `1px solid ${c.border}`,
                color: c.text,
                borderRadius: 10, cursor: "pointer", fontSize: 13,
                display: "flex", alignItems: "flex-start", gap: 10,
                boxShadow: "0 4px 18px rgba(0,0,0,0.25)",
                animation: "toastSlideIn 0.2s ease-out",
              }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>{ICONS[t.kind]}</span>
              <span style={{ flex: 1 }}>{t.text}</span>
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes toastSlideIn {
          from { transform: translateX(20px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </ToastContext.Provider>
  );
}
