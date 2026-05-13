"use client";

import { useEffect, useState } from "react";
import { ActivityFeed } from "@/components/activity/ActivityFeed";
import type { ActivitySummary } from "@/types/activity";

const PERIODS = [
  { label: "Сегодня", days: 1 },
  { label: "Неделя", days: 7 },
  { label: "2 недели", days: 14 },
  { label: "Месяц", days: 30 },
];

const DOCTYPE_FILTERS = [
  { label: "Все", value: "" },
  { label: "📋 Тендеры", value: "Tender" },
  { label: "💰 Сметы", value: "Estimate" },
  { label: "📑 КС-2", value: "KS2 Act" },
  { label: "📊 КС-3", value: "KS3 Act" },
  { label: "📦 Снабжение", value: "Material Request" },
  { label: "🔄 Изменения", value: "Change Order" },
  { label: "👷 Прорабы", value: "Foreman Report" },
  { label: "⚠️ ОТ/ТБ", value: "Safety Incident" },
  { label: "🛠 Техника", value: "Equipment" },
  { label: "💬 CRM", value: "Interaction" },
  { label: "🤝 Сделки", value: "Deal" },
  { label: "🏗 Проекты", value: "Construction Project" },
  { label: "👥 Планёрки", value: "Meeting" },
];

export default function ActivityPage() {
  const [period, setPeriod] = useState(14);
  const [doctypeFilter, setDoctypeFilter] = useState("");
  const [summary, setSummary] = useState<ActivitySummary | null>(null);

  useEffect(() => {
    fetch(`/api/activity/summary?days=${period}`)
      .then(r => r.json())
      .then(setSummary);
  }, [period]);

  return (
    <div style={{ padding: 32, maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>Лента активности</h1>
        <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: "4px 0 0" }}>
          Что происходило в компании — все события по тендерам, сметам, КС-2, проектам, инцидентам
        </p>
      </div>

      {/* Summary */}
      {summary && (
        <div style={{
          background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
          borderRadius: 12, padding: "16px 22px", marginBottom: 20,
          display: "grid", gridTemplateColumns: "auto 1fr", gap: 30, alignItems: "center",
        }}>
          <div>
            <p style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0, fontFamily: "monospace" }}>За {summary.days} дн.</p>
            <p style={{ fontSize: 32, fontWeight: 700, color: "var(--accent)", margin: "4px 0 0", fontFamily: "monospace", lineHeight: 1 }}>
              {summary.total_events}
            </p>
            <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: "2px 0 0" }}>событий</p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {Object.entries(summary.by_type)
              .sort((a, b) => b[1] - a[1])
              .map(([label, count]) => (
                <div key={label} style={{
                  padding: "6px 12px", borderRadius: 8,
                  background: "var(--bg-base)", border: "1px solid var(--border-subtle)",
                  fontSize: 12, color: "var(--text-secondary)",
                }}>
                  {label}: <b style={{ color: "var(--accent)", fontFamily: "monospace" }}>{count}</b>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Period + filter */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {PERIODS.map(p => (
            <button key={p.days} onClick={() => setPeriod(p.days)} style={{
              padding: "6px 12px", borderRadius: 8, fontSize: 12,
              background: period === p.days ? "var(--accent)" : "transparent",
              border: `1px solid ${period === p.days ? "var(--accent)" : "var(--border-subtle)"}`,
              color: period === p.days ? "white" : "var(--text-secondary)",
              cursor: "pointer", fontWeight: period === p.days ? 500 : 400,
            }}>{p.label}</button>
          ))}
        </div>
        <select value={doctypeFilter} onChange={(e) => setDoctypeFilter(e.target.value)} style={{
          padding: "6px 14px", borderRadius: 8,
          background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
          color: "var(--text-primary)", fontSize: 12, outline: "none", marginLeft: "auto",
        }}>
          {DOCTYPE_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>

      {/* Feed */}
      <div style={{
        background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
        borderRadius: 12, overflow: "hidden",
      }}>
        <ActivityFeed days={period} doctype={doctypeFilter || undefined} limit={200} />
      </div>
    </div>
  );
}
