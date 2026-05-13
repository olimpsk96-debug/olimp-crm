"use client";

import { useState } from "react";
import type { Tender, WorkType } from "@/types/tender";

interface Props {
  tender: Tender;
  onClick?: () => void;
  onScored?: (updated: Pick<Tender, "name" | "ai_match_score" | "ai_recommendation">) => void;
}

const WORK_COLORS: Record<WorkType, { bg: string; color: string }> = {
  АКЗ:      { bg: "rgba(249,115,22,0.15)",  color: "var(--accent)" },
  Кровля:   { bg: "rgba(99,102,241,0.15)",  color: "var(--info)" },
  Промальп: { bg: "rgba(52,211,153,0.15)",  color: "var(--success)" },
  Монолит:  { bg: "rgba(168,85,247,0.15)",  color: "#C084FC" },
  Усиление: { bg: "rgba(236,72,153,0.15)",  color: "#F472B6" },
  Прочее:   { bg: "rgba(113,113,122,0.15)", color: "var(--text-secondary)" },
};

function formatMln(val?: number): string {
  if (!val) return "—";
  return (val / 1_000_000).toFixed(1);
}

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

function DeadlinePill({ days }: { days: number }) {
  if (days < 0)
    return <span style={{ fontSize: 10.5, color: "var(--text-tertiary)" }}>истёк</span>;
  const color = days <= 1 ? "var(--danger)" : days <= 3 ? "var(--warning)" : "var(--text-tertiary)";
  return (
    <span
      style={{
        fontSize: 10.5,
        fontFamily: "monospace",
        color,
        background: days <= 1 ? "rgba(248,113,113,0.1)" : days <= 3 ? "rgba(251,191,36,0.1)" : "transparent",
        padding: days <= 3 ? "1px 6px" : undefined,
        borderRadius: 999,
      }}
    >
      {days === 0 ? "сегодня" : `${days}д`}
    </span>
  );
}

function AiScoreBadge({ score }: { score: number }) {
  const color =
    score >= 75 ? "var(--success)" : score >= 50 ? "var(--warning)" : "var(--danger)";
  return (
    <span
      style={{
        fontSize: 10,
        fontFamily: "monospace",
        color,
        background: score >= 75
          ? "rgba(52,211,153,0.1)"
          : score >= 50
          ? "rgba(251,191,36,0.1)"
          : "rgba(248,113,113,0.1)",
        padding: "1px 6px",
        borderRadius: 999,
      }}
    >
      AI {score}%
    </span>
  );
}

export function TenderCard({ tender, onClick, onScored }: Props) {
  const [scoring, setScoring] = useState(false);
  const [localScore, setLocalScore] = useState(tender.ai_match_score);
  const [localRec, setLocalRec] = useState(tender.ai_recommendation);

  async function handleScore(e: React.MouseEvent) {
    e.stopPropagation();
    setScoring(true);
    try {
      const res = await fetch("/api/tenders/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tender_name: tender.name }),
      });
      const data = await res.json();
      if (data.score !== undefined) {
        setLocalScore(data.score);
        setLocalRec(data.recommendation);
        onScored?.({ name: tender.name, ai_match_score: data.score, ai_recommendation: data.recommendation });
      }
    } finally {
      setScoring(false);
    }
  }

  const days = daysUntil(tender.deadline_date);
  const isUrgent = days !== null && days <= 2 && days >= 0;
  const wt = tender.work_type ?? "Прочее";
  const wColors = WORK_COLORS[wt];

  const deadlineBarPct =
    days !== null && days >= 0 ? Math.min(100, Math.max(0, ((7 - days) / 7) * 100)) : 100;
  const barColor =
    days !== null && days <= 1
      ? "var(--danger)"
      : days !== null && days <= 3
      ? "var(--warning)"
      : "var(--success)";

  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--bg-card)",
        border: `1px solid var(--border-subtle)`,
        borderRadius: 12,
        padding: 12,
        cursor: "pointer",
        transition: "all 0.2s cubic-bezier(0.16,1,0.3,1)",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.background = "var(--bg-card-hover)";
        el.style.borderColor = "var(--border-strong)";
        el.style.transform = "translateY(-1px)";
        el.style.boxShadow = "0 8px 20px -8px rgba(0,0,0,0.5)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.background = "var(--bg-card)";
        el.style.borderColor = "var(--border-subtle)";
        el.style.transform = "";
        el.style.boxShadow = "";
      }}
    >
      {isUrgent && (
        <div
          style={{
            position: "absolute",
            left: 0, top: 0, bottom: 0,
            width: 3,
            background: "var(--danger)",
            borderRadius: "12px 0 0 12px",
          }}
        />
      )}

      {/* Шапка: иконка типа + закон + AI score + дедлайн */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <div
          style={{
            width: 22, height: 22, borderRadius: 6,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: wColors.bg, color: wColors.color, flexShrink: 0,
          }}
          title={wt}
        >
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="2" y="2" width="12" height="12" rx="2" />
          </svg>
        </div>
        <span style={{ fontSize: 10.5, fontFamily: "monospace", color: "var(--text-tertiary)", textTransform: "uppercase" }}>
          {tender.tender_law ?? ""}
        </span>
        {localScore !== undefined && localScore !== null && (
          <AiScoreBadge score={localScore} />
        )}
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
          <button
            onClick={handleScore}
            disabled={scoring}
            title={localScore !== undefined ? "Переоценить AI" : "Оценить тендер AI"}
            style={{
              fontSize: 9.5,
              padding: "1px 5px",
              borderRadius: 6,
              border: "1px solid var(--border-subtle)",
              background: "transparent",
              color: "var(--text-tertiary)",
              cursor: scoring ? "wait" : "pointer",
              opacity: scoring ? 0.5 : 1,
              lineHeight: 1.6,
            }}
          >
            {scoring ? "..." : localScore !== undefined ? "AI" : "AI?"}
          </button>
          {days !== null && <DeadlinePill days={days} />}
        </span>
      </div>

      {/* Название */}
      <h4 style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.35, marginBottom: 3 }}>
        {tender.title}
      </h4>

      {/* Заказчик · регион */}
      <p style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>
        {[tender.customer, tender.region].filter(Boolean).join(" · ") || "—"}
      </p>

      {/* Сумма + дедлайн */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
        <span style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 500 }}>
          {formatMln(tender.nmck)}{" "}
          <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>млн</span>
        </span>
        {tender.deadline_date && (
          <span style={{ fontSize: 10.5, fontFamily: "monospace", color: "var(--text-tertiary)" }}>
            {new Date(tender.deadline_date).toLocaleDateString("ru", { day: "2-digit", month: "2-digit" })}
          </span>
        )}
      </div>

      {/* Прогресс-бар дедлайна */}
      {days !== null && days >= 0 && (
        <div
          style={{
            height: 2, background: "var(--border-subtle)",
            borderRadius: 999, marginTop: 6, overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${deadlineBarPct}%`, height: "100%",
              background: barColor, borderRadius: 999,
              transition: "width 0.3s ease",
            }}
          />
        </div>
      )}
    </div>
  );
}
