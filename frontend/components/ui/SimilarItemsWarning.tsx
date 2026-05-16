"use client";

import { useEffect, useState } from "react";

/** Linear-style "Similar Issues" warning.
 *
 * При вводе title в форме создания риска/доделки/задачи — debounced ищет
 * похожие через rapidfuzz на бэке. Если найдено что-то с score>=70 — показывает
 * до 5 ссылок с предупреждением «возможно, это дубль».
 */
export function SimilarItemsWarning({
  doctype, text, project, onItemClick, threshold = 70, limit = 5,
}: {
  doctype: string;          // "Project Risk" / "Punch List Item" / "Schedule Task" / "Construction Project Update"
  text: string;             // Title/title пользователь печатает
  project?: string;         // optional — сузить поиск проектом
  onItemClick?: (item: SimilarItem) => void;
  threshold?: number;
  limit?: number;
}) {
  const [items, setItems] = useState<SimilarItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!text || text.trim().length < 5) {
      setItems([]);
      return;
    }
    setDismissed(false);
    setLoading(true);
    const ctl = new AbortController();
    const t = setTimeout(() => {
      const p = new URLSearchParams({ doctype, text, threshold: String(threshold), limit: String(limit) });
      if (project) p.set("project", project);
      fetch(`/api/duplicates?${p}`, { signal: ctl.signal })
        .then((r) => r.json())
        .then((d) => setItems(Array.isArray(d) ? d : []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 500); // debounce
    return () => { clearTimeout(t); ctl.abort(); };
  }, [doctype, text, project, threshold, limit]);

  if (dismissed || items.length === 0) return null;

  return (
    <div style={{
      padding: 10, marginTop: 6, marginBottom: 6,
      background: "rgba(96,165,250,0.06)",
      border: "1px solid rgba(96,165,250,0.3)",
      borderRadius: 8,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <div style={{ fontSize: 11, color: "#3b82f6", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: "monospace" }}>
          🔍 Похожие записи ({items.length}) {loading && "·"}
        </div>
        <button onClick={() => setDismissed(true)} title="Скрыть"
                style={{ background: "none", border: "none", color: "var(--text-tertiary)", fontSize: 14, cursor: "pointer", padding: "0 4px" }}>
          ×
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {items.map((it) => (
          <button key={it.name} onClick={() => onItemClick?.(it)}
                  style={{
                    textAlign: "left", padding: "5px 8px", fontSize: 12,
                    background: "transparent", color: "var(--text-primary)",
                    border: "1px solid var(--border-subtle)", borderRadius: 6,
                    cursor: onItemClick ? "pointer" : "default",
                    display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center",
                  }}>
            <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
              <span style={{ fontFamily: "monospace", color: "var(--text-tertiary)", fontSize: 11 }}>{it.name}</span>
              {" · "}
              <span>{it.title || it.summary || "(без заголовка)"}</span>
              {it.project_title && (
                <span style={{ color: "var(--text-tertiary)", marginLeft: 6 }}>
                  · {it.project_title}
                </span>
              )}
            </div>
            <span style={{ flexShrink: 0, padding: "1px 7px", borderRadius: 4,
                            background: scoreBg(it.score), color: scoreColor(it.score),
                            fontSize: 11, fontWeight: 600, fontFamily: "monospace" }}>
              {it.score}%
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export interface SimilarItem {
  name: string;
  title?: string;
  summary?: string;
  project?: string;
  project_title?: string;
  score: number;
  // дополнительные поля могут быть
  [key: string]: unknown;
}

function scoreColor(s: number): string {
  if (s >= 90) return "var(--danger)";
  if (s >= 80) return "#ea580c";
  return "#3b82f6";
}
function scoreBg(s: number): string {
  if (s >= 90) return "rgba(248,113,113,0.15)";
  if (s >= 80) return "rgba(234,88,12,0.15)";
  return "rgba(96,165,250,0.15)";
}
