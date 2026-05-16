"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";

interface TimelineEvent {
  kind: "version" | "comment" | "communication" | "linked";
  icon: string;
  time: string | null;
  who: string;
  summary: string;
}

/**
 * Единая лента событий по сущности (Activity Timeline).
 * Backend: api/entity_timeline.py → собирает Version + Comment + Communication.
 *
 * Использование:
 *   <EntityTimeline doctype="Deal" name="DL-2026-00001" />
 */
export function EntityTimeline({
  doctype,
  name,
  limit = 30,
  compact = false,
}: {
  doctype: string;
  name: string;
  limit?: number;
  compact?: boolean;
}) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);
  const toast = useToast();

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(
        `/api/entity-timeline?doctype=${encodeURIComponent(doctype)}&name=${encodeURIComponent(name)}&limit=${limit}`
      );
      const d = await r.json();
      setEvents(Array.isArray(d) ? d : []);
    } finally {
      setLoading(false);
    }
  }, [doctype, name, limit]);

  useEffect(() => { reload(); }, [reload]);

  async function postComment() {
    if (!newComment.trim()) return;
    setPosting(true);
    try {
      const r = await fetch("/api/entity-timeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctype, name, content: newComment.trim() }),
      });
      const d = await r.json();
      if (d.ok) {
        toast.success("Комментарий добавлен");
        setNewComment("");
        reload();
      } else {
        toast.error(d.error || "Ошибка добавления");
      }
    } finally {
      setPosting(false);
    }
  }

  return (
    <div style={{ marginTop: compact ? 8 : 16 }}>
      <div style={{
        fontSize: 10, color: "var(--text-tertiary)",
        textTransform: "uppercase", letterSpacing: "0.05em",
        fontFamily: "monospace", marginBottom: 10,
      }}>
        Лента событий{!compact && events.length > 0 && ` (${events.length})`}
      </div>

      {/* Compose area */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && newComment.trim()) postComment(); }}
          placeholder="Оставить комментарий..."
          style={{
            flex: 1, padding: "8px 12px", fontSize: 12.5,
            background: "var(--bg-base)", color: "var(--text-primary)",
            border: "1px solid var(--border-subtle)", borderRadius: 8, outline: "none",
          }}
        />
        <button onClick={postComment} disabled={!newComment.trim() || posting}
                style={{
                  padding: "8px 14px", fontSize: 12.5, fontWeight: 500,
                  background: "var(--accent)", color: "white",
                  border: "none", borderRadius: 8, cursor: "pointer",
                  opacity: !newComment.trim() || posting ? 0.5 : 1,
                }}>
          {posting ? "..." : "↵"}
        </button>
      </div>

      {/* Events list */}
      {loading ? (
        <div style={{ padding: 12, color: "var(--text-tertiary)", fontSize: 12, textAlign: "center" }}>
          Загрузка...
        </div>
      ) : events.length === 0 ? (
        <div style={{
          padding: 20, textAlign: "center", color: "var(--text-tertiary)", fontSize: 12,
          background: "var(--bg-base)", borderRadius: 8, border: "1px dashed var(--border-subtle)",
        }}>
          Событий пока нет. Изменения, комментарии и письма будут появляться здесь.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {events.map((e, i) => (
            <div key={i} style={{
              display: "flex", gap: 10, padding: "10px 0",
              borderBottom: i < events.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: kindBg(e.kind), display: "flex",
                alignItems: "center", justifyContent: "center",
                fontSize: 14, flexShrink: 0,
              }}>
                {e.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: "var(--text-primary)", lineHeight: 1.4 }}>
                  {e.summary}
                </div>
                <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", marginTop: 3, fontFamily: "monospace" }}>
                  {e.who} · {formatRelative(e.time)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function kindBg(kind: TimelineEvent["kind"]): string {
  switch (kind) {
    case "version":       return "rgba(168,139,250,0.15)";
    case "comment":       return "rgba(96,165,250,0.15)";
    case "communication": return "rgba(34,197,94,0.15)";
    default:              return "rgba(255,255,255,0.05)";
  }
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} дн назад`;
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "2-digit" });
}
