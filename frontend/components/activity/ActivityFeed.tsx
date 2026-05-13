"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ActivityEvent } from "@/types/activity";

interface Props {
  project?: string;
  doctype?: string;
  days?: number;
  limit?: number;
  compact?: boolean;
}

function relativeTime(when: string) {
  const dt = new Date(when);
  const diffSec = Math.floor((Date.now() - dt.getTime()) / 1000);
  if (diffSec < 60) return "только что";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} мин назад`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} ч назад`;
  if (diffSec < 86400 * 3) return `${Math.floor(diffSec / 86400)} д назад`;
  return dt.toLocaleDateString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function actionLabel(action: ActivityEvent["action"]) {
  if (action === "created") return "создано";
  if (action === "status_changed") return "статус";
  return "изменено";
}

export function ActivityFeed({ project, doctype, days = 14, limit = 50, compact = false }: Props) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const p = new URLSearchParams();
    if (project) p.set("project", project);
    if (doctype) p.set("doctype_filter", doctype);
    p.set("days", String(days));
    p.set("limit", String(limit));
    setLoading(true);
    fetch(`/api/activity?${p}`)
      .then(r => r.json())
      .then((data) => setEvents(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [project, doctype, days, limit]);

  if (loading) {
    return <div style={{ padding: 16, color: "var(--text-tertiary)", fontSize: 12 }}>Загрузка ленты...</div>;
  }

  if (events.length === 0) {
    return <div style={{ padding: 20, color: "var(--text-tertiary)", fontSize: 12, textAlign: "center" }}>За {days} дн. событий нет</div>;
  }

  return (
    <div>
      {events.map((e, i) => (
        <Link
          key={`${e.doctype}-${e.name}-${i}`}
          href={e.href}
          style={{
            display: "flex", alignItems: "flex-start", gap: 12,
            padding: compact ? "8px 14px" : "10px 16px",
            borderBottom: i < events.length - 1 ? "1px solid var(--border-subtle)" : "none",
            textDecoration: "none",
            color: "var(--text-primary)",
          }}
        >
          <span style={{ fontSize: compact ? 14 : 16, flexShrink: 0, lineHeight: 1, marginTop: 1 }}>{e.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <span style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: "monospace" }}>{e.label}</span>
              <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>·</span>
              <span style={{ fontSize: 10, color: e.action === "created" ? "var(--success)" : "var(--text-tertiary)" }}>{actionLabel(e.action)}</span>
              {e.status && (
                <>
                  <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>·</span>
                  <span style={{ fontSize: 10, color: "var(--text-secondary)", padding: "1px 6px", background: "var(--bg-base)", borderRadius: 4 }}>{e.status}</span>
                </>
              )}
            </div>
            <div style={{
              fontSize: compact ? 12 : 13, lineHeight: 1.4,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              color: "var(--text-primary)",
            }}>{e.title}</div>
            <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", marginTop: 2, fontFamily: "monospace" }}>
              {e.name}{e.project ? ` · ${e.project}` : ""} · {e.who} · {relativeTime(e.when)}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
