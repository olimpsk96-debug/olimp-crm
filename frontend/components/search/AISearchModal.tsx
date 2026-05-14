"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface SemanticHit {
  doc_name: string;
  resource_code: string;
  resource_name: string;
  resource_type: string;
  unit: string;
  price_avg: number;
  currency: string;
  category: string;
  collection: string;
  score: number;
}

const inputStyle: React.CSSProperties = {
  padding: "10px 14px", fontSize: 14, color: "var(--text-primary)",
  background: "var(--bg-base)", border: "1px solid var(--border-subtle)", borderRadius: 10,
  outline: "none", width: "100%",
};

/**
 * Модалка семантического поиска по каталогу ресурсов.
 * Открывается:
 *  - со страницы /resources (просмотр результата)
 *  - из EstimateDrawer (выбор → onPick передаст ресурс в форму)
 */
export default function AISearchModal({
  initialQuery = "",
  onClose,
  onPick,
}: {
  initialQuery?: string;
  onClose: () => void;
  onPick?: (hit: SemanticHit) => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [hits, setHits] = useState<SemanticHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Escape to close
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const doSearch = useCallback(async (q: string) => {
    if (!q || q.trim().length < 2) {
      setHits([]); setSearched(false); return;
    }
    setLoading(true); setError(null);
    try {
      const r = await fetch(`/api/semantic-search?query=${encodeURIComponent(q)}&limit=15`);
      const d = await r.json();
      if (!r.ok || d.error) {
        setError(d.error || `Ошибка ${r.status}`);
        setHits([]);
      } else {
        setHits(Array.isArray(d) ? d : []);
      }
      setSearched(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce
  useEffect(() => {
    if (!query) { setHits([]); setSearched(false); return; }
    const t = setTimeout(() => doSearch(query), 400);
    return () => clearTimeout(t);
  }, [query, doSearch]);

  // Auto search initial query on mount
  useEffect(() => {
    if (initialQuery) doSearch(initialQuery);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 200,
      display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 80,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 760, maxWidth: "94%", maxHeight: "80vh", background: "var(--bg-base)",
        border: "1px solid var(--border-subtle)", borderRadius: 14, overflow: "hidden",
        display: "flex", flexDirection: "column",
      }}>
        {/* Header / input */}
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 18 }}>🔍</span>
            <h2 style={{ fontSize: 15, fontWeight: 500, margin: 0, color: "var(--text-primary)" }}>
              AI-поиск по каталогу
            </h2>
            <span style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "monospace" }}>
              понимает естественный язык
            </span>
            <span style={{ marginLeft: "auto", color: "var(--text-tertiary)", fontSize: 12, fontFamily: "monospace" }}>Esc</span>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Например: "штукатурка по бетону", "монтаж кровли из мембраны", "пескоструй металла"'
            style={{ ...inputStyle, fontSize: 16, padding: "12px 14px" }}
          />
        </div>

        {/* Body / results */}
        <div style={{ overflow: "auto", flex: 1 }}>
          {error && (
            <div style={{
              padding: 16, margin: 14,
              background: "rgba(248,113,113,0.08)",
              border: "1px solid var(--danger)",
              borderRadius: 10, color: "var(--danger)", fontSize: 13, lineHeight: 1.5,
            }}>
              <strong style={{ fontSize: 12, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Ошибка</strong>
              {error}
            </div>
          )}

          {loading && (
            <div style={{ padding: 50, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
              Запрос embedding и поиск в Qdrant...
            </div>
          )}

          {!loading && !error && !query && (
            <div style={{ padding: 50, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13, maxWidth: 480, margin: "0 auto" }}>
              <p>Начни печатать запрос — система найдёт похожие позиции из каталога по смыслу, а не только по точному совпадению слов.</p>
              <p style={{ fontSize: 12, marginTop: 12 }}>
                Примеры:<br/>
                <span style={{ display: "inline-block", marginTop: 6, padding: "4px 8px", background: "var(--bg-elevated)", borderRadius: 6, fontFamily: "monospace" }}>штукатурка по бетону</span>{" "}
                <span style={{ display: "inline-block", marginTop: 6, padding: "4px 8px", background: "var(--bg-elevated)", borderRadius: 6, fontFamily: "monospace" }}>покраска кровли акрилом</span>
              </p>
            </div>
          )}

          {!loading && !error && searched && hits.length === 0 && (
            <div style={{ padding: 50, textAlign: "center", color: "var(--text-tertiary)" }}>
              Ничего не найдено. Попробуй переформулировать запрос.
            </div>
          )}

          {hits.length > 0 && (
            <div>
              {hits.map((h, i) => {
                const isTopMatch = h.score >= 0.7;
                return (
                  <div
                    key={`${h.doc_name}-${i}`}
                    onClick={() => onPick?.(h)}
                    style={{
                      padding: "12px 18px", borderBottom: "1px solid var(--border-subtle)",
                      cursor: onPick ? "pointer" : "default",
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 12, alignItems: "center",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => onPick && (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                    onMouseLeave={(e) => onPick && (e.currentTarget.style.background = "transparent")}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                        <span style={{
                          padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600,
                          fontFamily: "monospace",
                          background: isTopMatch ? "rgba(34,197,94,0.16)" : "rgba(96,165,250,0.14)",
                          color: isTopMatch ? "var(--success)" : "#60a5fa",
                        }}>
                          {(h.score * 100).toFixed(0)}%
                        </span>
                        <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "monospace" }}>
                          {h.resource_type || "—"}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.4 }}>
                        {h.resource_name}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 3, fontFamily: "monospace" }}>
                        {h.resource_code}
                        {h.category && <span> · {h.category}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, fontFamily: "monospace", color: "var(--accent)" }}>
                        {h.price_avg ? `${Math.round(h.price_avg).toLocaleString("ru-RU")} ₽` : "—"}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                        / {h.unit}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer hint */}
        {onPick && hits.length > 0 && (
          <div style={{
            padding: "8px 18px", borderTop: "1px solid var(--border-subtle)",
            background: "var(--bg-elevated)", fontSize: 11, color: "var(--text-tertiary)",
            display: "flex", justifyContent: "space-between",
          }}>
            <span>Клик по позиции — добавить в смету</span>
            <span style={{ fontFamily: "monospace" }}>{hits.length} результат(ов)</span>
          </div>
        )}
      </div>
    </div>
  );
}
