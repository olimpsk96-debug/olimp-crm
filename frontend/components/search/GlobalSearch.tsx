"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface SearchResult {
  doctype: string;
  name: string;
  title: string;
  label: string;
  icon: string;
  href: string;
  extra: Record<string, unknown>;
  score: number;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // ⌘K / Ctrl+K — открыть/закрыть
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(v => !v);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  // Автофокус на input при открытии
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced fetch
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
        setSelectedIdx(0);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  // Стрелки + Enter
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const item = results[selectedIdx];
      if (item) {
        router.push(item.href);
        setOpen(false);
      }
    }
  }

  if (!open) return null;

  return (
    <div onClick={() => setOpen(false)} style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "12vh",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "min(640px, 92vw)",
        background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
        borderRadius: 14, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
      }}>
        {/* Input */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18, color: "var(--text-tertiary)" }}>🔍</span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Поиск по тендерам, проектам, КС-2, инцидентам, технике, клиентам..."
            style={{
              flex: 1, background: "transparent", border: "none",
              color: "var(--text-primary)", fontSize: 15, outline: "none",
            }}
          />
          <kbd style={{
            padding: "2px 8px", borderRadius: 5, fontSize: 11,
            background: "var(--bg-base)", border: "1px solid var(--border-subtle)",
            color: "var(--text-tertiary)", fontFamily: "monospace",
          }}>ESC</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
          {loading && (
            <div style={{ padding: 24, color: "var(--text-tertiary)", textAlign: "center", fontSize: 13 }}>Ищу...</div>
          )}
          {!loading && query.length >= 2 && results.length === 0 && (
            <div style={{ padding: 32, color: "var(--text-tertiary)", textAlign: "center", fontSize: 13 }}>
              По запросу «{query}» ничего не найдено
            </div>
          )}
          {!loading && query.length < 2 && (
            <div style={{ padding: 24, color: "var(--text-tertiary)", textAlign: "center", fontSize: 12.5, lineHeight: 1.6 }}>
              Ищет по: тендеры, проекты, сметы, КС-2/3, заявки, change orders, инциденты, прорабские отчёты, техника, клиенты, сделки, планёрки, каталог расценок, ресурсы CWICR.
              <br /><br />
              <kbd style={kbdStyle}>↑</kbd> <kbd style={kbdStyle}>↓</kbd> навигация · <kbd style={kbdStyle}>↵</kbd> открыть · <kbd style={kbdStyle}>ESC</kbd> закрыть
            </div>
          )}
          {!loading && results.map((r, i) => (
            <button
              key={`${r.doctype}-${r.name}`}
              onClick={() => { router.push(r.href); setOpen(false); }}
              onMouseEnter={() => setSelectedIdx(i)}
              style={{
                width: "100%", textAlign: "left",
                padding: "10px 18px", display: "flex", alignItems: "center", gap: 14,
                background: i === selectedIdx ? "rgba(249,115,22,0.10)" : "transparent",
                border: "none", borderTop: i > 0 ? "1px solid var(--border-subtle)" : "none",
                color: "var(--text-primary)", cursor: "pointer",
              }}
            >
              <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1 }}>{r.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
                <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", marginTop: 2, fontFamily: "monospace", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span>{r.label}</span>
                  <span>·</span>
                  <span>{r.name}</span>
                  {Object.entries(r.extra).filter(([_, v]) => v !== null && v !== undefined && v !== "").slice(0, 2).map(([k, v]) => (
                    <span key={k}>· <span style={{ color: "var(--text-secondary)" }}>{String(v).slice(0, 40)}</span></span>
                  ))}
                </div>
              </div>
              <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "monospace" }}>{r.score}%</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const kbdStyle: React.CSSProperties = {
  padding: "1px 6px", borderRadius: 4, fontSize: 10,
  background: "var(--bg-base)", border: "1px solid var(--border-subtle)",
  color: "var(--text-secondary)", fontFamily: "monospace",
};
