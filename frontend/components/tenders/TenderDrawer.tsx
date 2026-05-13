"use client";

import { useEffect, useState } from "react";
import type { Tender, TenderStatus } from "@/types/tender";

interface Props {
  name: string | null;
  onClose: () => void;
  onStatusChange?: (name: string, status: TenderStatus) => void;
}

const STATUS_OPTIONS: TenderStatus[] = [
  "Новый", "Оценивается", "Готовится заявка",
  "Заявка подана", "Выиграли", "Проиграли", "Отклонён",
];

const STATUS_COLOR: Record<string, string> = {
  "Новый":             "var(--info)",
  "Оценивается":       "var(--warning)",
  "Готовится заявка":  "var(--accent)",
  "Заявка подана":     "#C084FC",
  "Выиграли":          "var(--success)",
  "Проиграли":         "var(--danger)",
  "Отклонён":          "var(--text-tertiary)",
};

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "7px 0", borderBottom: "1px solid var(--border-subtle)" }}>
      <span style={{ fontSize: 12, color: "var(--text-tertiary)", flexShrink: 0, marginRight: 16 }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--text-primary)", textAlign: "right", fontFamily: typeof value === "number" ? "monospace" : undefined }}>{value}</span>
    </div>
  );
}

function formatMln(v?: number | null) {
  if (!v) return null;
  return `${(v / 1_000_000).toFixed(2)} млн ₽`;
}

function AiBlock({ tender, onScored }: { tender: Tender; onScored: (score: number, rec: string, analysis: string) => void }) {
  const [scoring, setScoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runScore() {
    setScoring(true);
    setError(null);
    try {
      const res = await fetch("/api/tenders/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tender_name: tender.name }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      onScored(data.score, data.recommendation, data.analysis ?? "");
    } catch {
      setError("Ошибка соединения");
    } finally {
      setScoring(false);
    }
  }

  const aiScore = tender.ai_match_score;
  const color = aiScore === undefined || aiScore === null ? "var(--text-tertiary)"
    : aiScore >= 75 ? "var(--success)"
    : aiScore >= 50 ? "var(--warning)"
    : "var(--danger)";

  return (
    <div style={{ marginTop: 20, padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-subtle)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "monospace" }}>AI-оценка</span>
        <button
          onClick={runScore}
          disabled={scoring}
          style={{
            fontSize: 11, padding: "3px 10px", borderRadius: 7,
            border: "1px solid var(--border-subtle)",
            background: "transparent", color: "var(--text-secondary)",
            cursor: scoring ? "wait" : "pointer", opacity: scoring ? 0.5 : 1,
          }}
        >
          {scoring ? "Оцениваю..." : tender.ai_match_score !== undefined ? "Переоценить" : "Оценить"}
        </button>
      </div>

      {aiScore !== undefined && aiScore !== null && (
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 28, fontWeight: 300, fontFamily: "monospace", color }}>{aiScore}%</span>
          <span style={{ fontSize: 13, color }}>{tender.ai_recommendation}</span>
        </div>
      )}

      {tender.ai_analysis && (
        <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55, marginTop: 6 }}>
          {tender.ai_analysis}
        </p>
      )}

      {error && (
        <p style={{ fontSize: 11.5, color: "var(--danger)", marginTop: 8 }}>{error}</p>
      )}

      {!aiScore && !scoring && !error && (
        <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Нажмите «Оценить» чтобы получить рекомендацию</p>
      )}
    </div>
  );
}

export function TenderDrawer({ name, onClose, onStatusChange }: Props) {
  const [tender, setTender] = useState<Tender | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  useEffect(() => {
    if (!name) { setTender(null); return; }
    setLoading(true);
    fetch(`/api/tenders/${encodeURIComponent(name)}`)
      .then((r) => r.json())
      .then(setTender)
      .finally(() => setLoading(false));
  }, [name]);

  async function handleStatusChange(newStatus: TenderStatus) {
    if (!tender) return;
    setSavingStatus(true);
    try {
      await fetch(`/api/tenders/${encodeURIComponent(tender.name)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      setTender((t) => t ? { ...t, status: newStatus } : t);
      onStatusChange?.(tender.name, newStatus);
    } finally {
      setSavingStatus(false);
    }
  }

  const isOpen = !!name;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 40,
          background: "rgba(0,0,0,0.45)",
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
          transition: "opacity 0.25s ease",
          backdropFilter: "blur(2px)",
        }}
      />

      {/* Drawer */}
      <div
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0,
          width: 440, zIndex: 50,
          background: "var(--bg-elevated)",
          borderLeft: "1px solid var(--border-subtle)",
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s cubic-bezier(0.16,1,0.3,1)",
          display: "flex", flexDirection: "column",
          overflowY: "auto",
        }}
      >
        {/* Шапка */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {loading ? (
                <div style={{ height: 20, borderRadius: 6, background: "var(--border-subtle)", width: "70%" }} />
              ) : (
                <h2 style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.35, letterSpacing: "-0.01em" }}>
                  {tender?.title ?? "—"}
                </h2>
              )}
              {tender && (
                <p style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 3, fontFamily: "monospace" }}>
                  {tender.name}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid var(--border-subtle)", background: "transparent", color: "var(--text-tertiary)", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 3l10 10M13 3L3 13" />
              </svg>
            </button>
          </div>

          {/* Статус */}
          {tender && (
            <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Статус:</span>
              <select
                value={tender.status}
                disabled={savingStatus}
                onChange={(e) => handleStatusChange(e.target.value as TenderStatus)}
                style={{
                  fontSize: 12, padding: "3px 8px", borderRadius: 7,
                  border: `1px solid ${STATUS_COLOR[tender.status] ?? "var(--border-subtle)"}`,
                  background: "transparent",
                  color: STATUS_COLOR[tender.status] ?? "var(--text-primary)",
                  cursor: "pointer", outline: "none",
                  opacity: savingStatus ? 0.5 : 1,
                }}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s} style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>{s}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Тело */}
        {loading && (
          <div style={{ padding: 24, color: "var(--text-tertiary)", fontSize: 13 }}>Загрузка...</div>
        )}

        {tender && !loading && (
          <div style={{ padding: "16px 24px 32px", flex: 1 }}>
            {/* Финансы */}
            <p style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "monospace", marginBottom: 8 }}>Финансы</p>
            <Row label="НМЦК" value={formatMln(tender.nmck)} />
            <Row label="Наша цена" value={formatMln(tender.our_price)} />
            <Row label="Маржа" value={tender.margin_pct !== undefined && tender.margin_pct !== null ? `${tender.margin_pct}%` : null} />

            {/* Параметры */}
            <p style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "monospace", marginBottom: 8, marginTop: 20 }}>Параметры</p>
            <Row label="Закон" value={tender.tender_law} />
            <Row label="Вид работ" value={tender.work_type} />
            <Row label="Регион" value={tender.region} />
            <Row label="Заказчик" value={tender.customer} />
            <Row label="№ закупки" value={tender.purchase_number} />

            {/* Сроки */}
            <p style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "monospace", marginBottom: 8, marginTop: 20 }}>Сроки</p>
            <Row label="Дедлайн" value={tender.deadline_date ? `${tender.deadline_date}${tender.deadline_time ? " " + String(tender.deadline_time).slice(0, 5) + " МСК" : ""}` : null} />
            <Row label="Дата подачи" value={tender.submission_date} />

            {/* Ссылки */}
            {tender.platform_url && (
              <div style={{ marginTop: 16 }}>
                <a
                  href={tender.platform_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 12.5, color: "var(--accent)", display: "inline-flex", alignItems: "center", gap: 5 }}
                >
                  Открыть на площадке
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M6 3H3v10h10v-3M9 3h4v4M13 3L7 9" />
                  </svg>
                </a>
              </div>
            )}

            {/* AI-оценка */}
            <AiBlock
              tender={tender}
              onScored={(score, rec, analysis) =>
                setTender((t) => t ? { ...t, ai_match_score: score, ai_recommendation: rec as Tender["ai_recommendation"], ai_analysis: analysis } : t)
              }
            />

            {/* Кнопка ERPNext */}
            <div style={{ marginTop: 24 }}>
              <a
                href={`http://erp.olimp-ural.ru/app/tender/${tender.name}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "block", textAlign: "center",
                  fontSize: 12.5, padding: "9px 0", borderRadius: 10,
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-secondary)", textDecoration: "none",
                }}
              >
                Открыть в ERPNext
              </a>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
