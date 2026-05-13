"use client";

import { useEffect, useState } from "react";
import type { KS2Act, KS2Status, PaymentStatus } from "@/types/ks2";

interface Props {
  name: string | null;
  onClose: () => void;
  onStatusChange?: (name: string, status: KS2Status) => void;
}

const STATUS_OPTIONS: KS2Status[] = ["Черновик", "На подписании", "Подписан", "Отклонён"];
const STATUS_COLOR: Record<string, string> = {
  "Черновик":       "var(--text-tertiary)",
  "На подписании":  "var(--warning)",
  "Подписан":       "var(--success)",
  "Отклонён":       "var(--danger)",
};
const PAYMENT_COLOR: Record<string, string> = {
  "Ожидает":    "var(--text-tertiary)",
  "Частично":   "var(--warning)",
  "Оплачено":   "var(--success)",
};

function fmt(v?: number | null, digits = 0) {
  if (!v && v !== 0) return "—";
  return v.toLocaleString("ru-RU", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fmtMln(v?: number | null) {
  if (!v) return "—";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)} млн ₽`;
  return `${(v / 1000).toFixed(0)} тыс. ₽`;
}

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "7px 0", borderBottom: "1px solid var(--border-subtle)" }}>
      <span style={{ fontSize: 12, color: "var(--text-tertiary)", flexShrink: 0, marginRight: 16 }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--text-primary)", textAlign: "right" }}>{value}</span>
    </div>
  );
}

export function KS2Drawer({ name, onClose, onStatusChange }: Props) {
  const [act, setAct] = useState<KS2Act | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!name) { setAct(null); return; }
    setLoading(true);
    fetch(`/api/ks2/${encodeURIComponent(name)}`)
      .then((r) => r.json())
      .then(setAct)
      .finally(() => setLoading(false));
  }, [name]);

  async function handleStatusChange(newStatus: KS2Status) {
    if (!act) return;
    setSaving(true);
    try {
      await fetch(`/api/ks2/${encodeURIComponent(act.name)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      setAct((a) => a ? { ...a, status: newStatus } : a);
      onStatusChange?.(act.name, newStatus);
    } finally {
      setSaving(false);
    }
  }

  const isOpen = !!name;
  const items = act?.items ?? [];
  const paid = act?.payment_received ?? 0;
  const debt = (act?.amount ?? 0) - paid;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.45)", opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? "auto" : "none", transition: "opacity 0.25s ease", backdropFilter: "blur(2px)" }} />

      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 580, zIndex: 50, background: "var(--bg-elevated)", borderLeft: "1px solid var(--border-subtle)", transform: isOpen ? "translateX(0)" : "translateX(100%)", transition: "transform 0.3s cubic-bezier(0.16,1,0.3,1)", display: "flex", flexDirection: "column", overflowY: "auto" }}>
        {/* Шапка */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {loading ? <div style={{ height: 20, borderRadius: 6, background: "var(--border-subtle)", width: "65%" }} /> : (
                <h2 style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.35, letterSpacing: "-0.01em" }}>{act?.title ?? "—"}</h2>
              )}
              {act && (
                <p style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 3, fontFamily: "monospace" }}>
                  {act.name}{act.act_number ? ` · №${act.act_number}` : ""}
                </p>
              )}
            </div>
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid var(--border-subtle)", background: "transparent", color: "var(--text-tertiary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3l10 10M13 3L3 13" /></svg>
            </button>
          </div>

          {act && (
            <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Статус:</span>
              <select value={act.status} disabled={saving} onChange={(e) => handleStatusChange(e.target.value as KS2Status)}
                style={{ fontSize: 12, padding: "3px 8px", borderRadius: 7, border: `1px solid ${STATUS_COLOR[act.status] ?? "var(--border-subtle)"}`, background: "transparent", color: STATUS_COLOR[act.status] ?? "var(--text-primary)", cursor: "pointer", outline: "none", opacity: saving ? 0.5 : 1 }}>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s} style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>{s}</option>)}
              </select>
              {act.payment_status && (
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, border: `1px solid ${PAYMENT_COLOR[act.payment_status]}`, color: PAYMENT_COLOR[act.payment_status] }}>
                  {act.payment_status}
                </span>
              )}
            </div>
          )}
        </div>

        {loading && <div style={{ padding: 24, color: "var(--text-tertiary)", fontSize: 13 }}>Загрузка...</div>}

        {act && !loading && (
          <>
            {/* KPI */}
            <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border-subtle)", flexShrink: 0 }}>
              <KpiCell label="Сумма акта" value={fmtMln(act.amount)} accent="var(--accent)" />
              <KpiCell label="Получено" value={fmtMln(paid)} accent={paid > 0 ? "var(--success)" : undefined} />
              {debt > 0 && <KpiCell label="Долг" value={fmtMln(debt)} accent="var(--danger)" />}
            </div>

            {/* Детали */}
            <div style={{ padding: "16px 24px" }}>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "monospace", marginBottom: 8 }}>Реквизиты</p>
              <Row label="Заказчик" value={act.customer} />
              <Row label="Договор №" value={act.contract_number} />
              <Row label="Проект" value={act.project} />
              <Row label="Период" value={act.period_from && act.period_to ? `${act.period_from} — ${act.period_to}` : null} />
              <Row label="Дата акта" value={act.act_date} />
              <Row label="Дата подписания" value={act.signed_date} />
              <Row label="Оплата до" value={act.payment_due_date} />
            </div>

            {/* Таблица работ */}
            {items.length > 0 && (
              <div style={{ flex: 1 }}>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) 60px 70px 90px 90px", padding: "9px 24px", fontSize: 10, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-tertiary)", background: "var(--bg-base)", borderBottom: "1px solid var(--border-subtle)", position: "sticky", top: 0, zIndex: 5 }}>
                  <span>Работа</span><span>Ед.</span><span style={{ textAlign: "right" }}>Объём</span><span style={{ textAlign: "right" }}>Цена</span><span style={{ textAlign: "right" }}>Сумма</span>
                </div>

                {items.map((item, idx) => (
                  <div key={idx} style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) 60px 70px 90px 90px", padding: "9px 24px", borderBottom: "1px solid var(--border-subtle)", fontSize: 12.5, alignItems: "center" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 12 }}>{item.work_name}</span>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{item.unit ?? ""}</span>
                    <span style={{ textAlign: "right", fontFamily: "monospace", color: "var(--text-secondary)" }}>{item.qty !== undefined ? fmt(item.qty, 0) : "—"}</span>
                    <span style={{ textAlign: "right", fontFamily: "monospace", fontSize: 12 }}>{fmt(item.unit_price)}</span>
                    <span style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 500 }}>{fmt(item.amount)}</span>
                  </div>
                ))}

                {/* Итого */}
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) 60px 70px 90px 90px", padding: "11px 24px", background: "rgba(255,255,255,0.03)" }}>
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "monospace", textTransform: "uppercase" }}>ИТОГО</span>
                  <span /><span /><span />
                  <span style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "var(--accent)", fontSize: 14 }}>{fmt(act.amount)}</span>
                </div>
              </div>
            )}

            {items.length === 0 && (
              <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>Позиций пока нет</div>
            )}

            {act.notes && (
              <div style={{ margin: "0 24px 16px", padding: 12, borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-subtle)", fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>
                {act.notes}
              </div>
            )}

            <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border-subtle)", flexShrink: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <a href={`/api/ks2/export?name=${encodeURIComponent(act.name)}&format=pdf`}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, textAlign: "center", fontSize: 12.5, padding: "9px 0", borderRadius: 10, border: "1px solid var(--accent)", color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M8 1v9M4 7l4 4 4-4M2 14h12" /></svg>
                Скачать PDF
              </a>
              <a href={`/api/ks2/export?name=${encodeURIComponent(act.name)}&format=xlsx`}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, textAlign: "center", fontSize: 12.5, padding: "9px 0", borderRadius: 10, border: "1px solid var(--success)", color: "var(--success)", textDecoration: "none", fontWeight: 500 }}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M8 1v9M4 7l4 4 4-4M2 14h12" /></svg>
                Скачать Excel
              </a>
              <a href={`http://erp.olimp-ural.ru/app/ks2-act/${act.name}`} target="_blank" rel="noopener noreferrer"
                style={{ gridColumn: "1 / span 2", display: "block", textAlign: "center", fontSize: 12.5, padding: "9px 0", borderRadius: 10, border: "1px solid var(--border-subtle)", color: "var(--text-secondary)", textDecoration: "none" }}>
                Открыть в ERPNext
              </a>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function KpiCell({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ flex: 1, padding: "12px 20px", borderRight: "1px solid var(--border-subtle)" }}>
      <p style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace", marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 15, fontFamily: "monospace", fontWeight: 600, color: accent ?? "var(--text-primary)" }}>{value}</p>
    </div>
  );
}
