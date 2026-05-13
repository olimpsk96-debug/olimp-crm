"use client";

import { useEffect, useState, useRef } from "react";
import type { CashflowDashboard, CashEvent, MonthForecast } from "@/types/cashflow";

function fmt(v: number, digits = 0) {
  return v.toLocaleString("ru-RU", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fmtMln(v: number) {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)} млн ₽`;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)} тыс. ₽`;
  return `${fmt(v)} ₽`;
}

function DueBadge({ days, overdue }: { days: number | null; overdue: boolean }) {
  if (days === null) return <span style={{ color: "var(--text-tertiary)", fontSize: 11 }}>дата не указана</span>;
  if (overdue) return <span style={{ fontSize: 11, color: "var(--danger)", fontWeight: 500 }}>просрочено {Math.abs(days)}д</span>;
  if (days === 0) return <span style={{ fontSize: 11, color: "var(--warning)", fontWeight: 500 }}>сегодня</span>;
  if (days <= 7) return <span style={{ fontSize: 11, color: "var(--warning)" }}>через {days}д</span>;
  return <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>через {days}д</span>;
}

function EventCard({ ev }: { ev: CashEvent }) {
  const isIncome = ev.type === "income";
  const accent = isIncome ? "var(--success)" : "var(--danger)";
  return (
    <div style={{ padding: "12px 16px", borderRadius: 12, background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = accent)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-subtle)")}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: accent, flexShrink: 0 }} />
          <p style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</p>
        </div>
        <p style={{ fontSize: 11.5, color: "var(--text-tertiary)", fontFamily: "monospace", marginBottom: 4 }}>
          {ev.name}{ev.customer ? ` · ${ev.customer}` : ev.project ? ` · ${ev.project}` : ""}
        </p>
        <DueBadge days={ev.days_left} overdue={ev.overdue} />
      </div>
      <p style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 600, color: accent, flexShrink: 0, textAlign: "right" }}>
        {isIncome ? "+" : "−"}{fmtMln(ev.amount)}
      </p>
    </div>
  );
}

function MonthBar({ m, maxVal }: { m: MonthForecast; maxVal: number }) {
  const incPct = maxVal > 0 ? (m.income / maxVal) * 100 : 0;
  const expPct = maxVal > 0 ? (m.expense / maxVal) * 100 : 0;
  const netPos = m.net >= 0;
  return (
    <div style={{ flex: 1 }}>
      <p style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "monospace", marginBottom: 8, textAlign: "center" }}>{m.month}</p>
      <div style={{ position: "relative", height: 90, display: "flex", alignItems: "flex-end", gap: 4, justifyContent: "center" }}>
        <div style={{ flex: 1, borderRadius: "4px 4px 0 0", background: "rgba(52,211,153,0.25)", height: `${incPct}%`, minHeight: incPct > 0 ? 4 : 0, border: incPct > 0 ? "1px solid rgba(52,211,153,0.5)" : "none" }} />
        <div style={{ flex: 1, borderRadius: "4px 4px 0 0", background: "rgba(248,113,113,0.25)", height: `${expPct}%`, minHeight: expPct > 0 ? 4 : 0, border: expPct > 0 ? "1px solid rgba(248,113,113,0.4)" : "none" }} />
      </div>
      <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 6, textAlign: "center" }}>
        <p style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 600, color: netPos ? "var(--success)" : "var(--danger)" }}>
          {netPos ? "+" : "−"}{fmtMln(Math.abs(m.net))}
        </p>
      </div>
    </div>
  );
}

export default function CashflowPage() {
  const [data, setData] = useState<CashflowDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceInput, setBalanceInput] = useState("");
  const [savingBalance, setSavingBalance] = useState(false);
  const balanceRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (editingBalance && balanceRef.current) balanceRef.current.focus();
  }, [editingBalance]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const d = await fetch("/api/cashflow").then((r) => r.json());
      setData(d);
    } catch {
      setError("Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }

  function startEditBalance() {
    if (!data) return;
    setBalanceInput(String(data.current_balance));
    setEditingBalance(true);
  }

  async function saveBalance() {
    const v = parseFloat(balanceInput.replace(/\s/g, ""));
    if (isNaN(v)) { setEditingBalance(false); return; }
    setSavingBalance(true);
    try {
      await fetch("/api/cashflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ balance: v }),
      });
      setData((d) => d ? { ...d, current_balance: v, projected_balance: v + d.total_incoming - d.total_outgoing } : d);
    } finally {
      setSavingBalance(false);
      setEditingBalance(false);
    }
  }

  const maxMonthVal = data
    ? Math.max(...data.monthly_forecast.map((m) => Math.max(m.income, m.expense)), 1)
    : 1;

  const projPos = (data?.projected_balance ?? 0) >= 0;

  return (
    <div style={{ padding: "24px 32px", minHeight: "100vh", background: "var(--bg-base)" }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em" }}>Cashflow</h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>Движение денежных средств и прогноз</p>
        </div>
        <button onClick={load} disabled={loading}
          style={{ padding: "8px 16px", borderRadius: 10, fontSize: 12.5, border: "1px solid var(--border-subtle)", background: "transparent", color: "var(--text-secondary)", cursor: loading ? "wait" : "pointer", opacity: loading ? 0.5 : 1 }}>
          {loading ? "Загрузка..." : "Обновить"}
        </button>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "var(--danger)", fontSize: 13, marginBottom: 20 }}>{error}</div>
      )}

      {data && (
        <>
          {/* KPI Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
            {/* Баланс — editable */}
            <div style={{ padding: "16px 20px", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 14 }}>
              <p style={{ fontSize: 10.5, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace", marginBottom: 6 }}>Текущий баланс</p>
              {editingBalance ? (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    ref={balanceRef}
                    value={balanceInput}
                    onChange={(e) => setBalanceInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveBalance(); if (e.key === "Escape") setEditingBalance(false); }}
                    style={{ width: "100%", padding: "4px 8px", borderRadius: 6, border: "1px solid var(--accent)", background: "var(--bg-base)", color: "var(--text-primary)", fontSize: 14, fontFamily: "monospace", outline: "none" }}
                  />
                  <button onClick={saveBalance} disabled={savingBalance}
                    style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "var(--accent)", color: "white", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>
                    {savingBalance ? "..." : "OK"}
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <p style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{fmtMln(data.current_balance)}</p>
                  <button onClick={startEditBalance}
                    style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-tertiary)", padding: 0, lineHeight: 1 }}>
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M11.5 2.5l2 2L5 13H3v-2l8.5-8.5z" /></svg>
                  </button>
                </div>
              )}
            </div>

            <KpiCard label="Ожидается поступлений" value={fmtMln(data.total_incoming)} count={data.incoming.length} accent="var(--success)" />
            <KpiCard label="Плановые расходы" value={fmtMln(data.total_outgoing)} count={data.outgoing.length} accent="var(--danger)" />

            <div style={{ padding: "16px 20px", background: projPos ? "rgba(52,211,153,0.06)" : "rgba(248,113,113,0.06)", border: `1px solid ${projPos ? "rgba(52,211,153,0.25)" : "rgba(248,113,113,0.25)"}`, borderRadius: 14 }}>
              <p style={{ fontSize: 10.5, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace", marginBottom: 6 }}>Прогноз баланса</p>
              <p style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 700, color: projPos ? "var(--success)" : "var(--danger)" }}>
                {projPos ? "" : "−"}{fmtMln(Math.abs(data.projected_balance))}
              </p>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
                {projPos ? "профицит" : "⚠ кассовый разрыв"}
              </p>
            </div>
          </div>

          {/* Monthly chart */}
          {data.monthly_forecast.length > 0 && (
            <div style={{ padding: "20px 24px", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 14, marginBottom: 24 }}>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "monospace", marginBottom: 16 }}>Прогноз по месяцам</p>
              <div style={{ display: "flex", gap: 16, alignItems: "flex-end" }}>
                {data.monthly_forecast.map((m) => (
                  <MonthBar key={m.month} m={m} maxVal={maxMonthVal} />
                ))}
                <div style={{ width: 90, flexShrink: 0, fontSize: 11, color: "var(--text-tertiary)", lineHeight: 1.8, paddingBottom: 28 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(52,211,153,0.4)", display: "inline-block" }} />поступления
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(248,113,113,0.4)", display: "inline-block" }} />расходы
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Two-column: Incoming + Outgoing */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* Поступления */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <p style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "monospace" }}>Ожидаемые поступления</p>
                {data.incoming.length > 0 && (
                  <span style={{ fontSize: 10.5, padding: "1px 7px", borderRadius: 10, background: "rgba(52,211,153,0.12)", color: "var(--success)", fontFamily: "monospace" }}>{data.incoming.length}</span>
                )}
              </div>
              {data.incoming.length === 0 ? (
                <Empty text="Нет ожидаемых поступлений" sub="Подпишите КС-2 и отметьте задолженность" />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {data.incoming.map((ev) => <EventCard key={ev.name} ev={ev} />)}
                </div>
              )}
            </div>

            {/* Расходы */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <p style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "monospace" }}>Плановые расходы</p>
                {data.outgoing.length > 0 && (
                  <span style={{ fontSize: 10.5, padding: "1px 7px", borderRadius: 10, background: "rgba(248,113,113,0.1)", color: "var(--danger)", fontFamily: "monospace" }}>{data.outgoing.length}</span>
                )}
              </div>
              {data.outgoing.length === 0 ? (
                <Empty text="Нет плановых расходов" sub="Одобренные заявки на снабжение появятся здесь" />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {data.outgoing.map((ev) => <EventCard key={ev.name} ev={ev} />)}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {loading && !data && (
        <div style={{ textAlign: "center", padding: 80, color: "var(--text-tertiary)" }}>Загрузка...</div>
      )}
    </div>
  );
}

function KpiCard({ label, value, count, accent }: { label: string; value: string; count: number; accent: string }) {
  return (
    <div style={{ padding: "16px 20px", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 14 }}>
      <p style={{ fontSize: 10.5, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace", marginBottom: 6 }}>{label}</p>
      <p style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 700, color: accent }}>{value}</p>
      {count > 0 && <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>{count} {count === 1 ? "позиция" : count < 5 ? "позиции" : "позиций"}</p>}
    </div>
  );
}

function Empty({ text, sub }: { text: string; sub: string }) {
  return (
    <div style={{ padding: "32px 20px", textAlign: "center", borderRadius: 14, background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>{text}</p>
      <p style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>{sub}</p>
    </div>
  );
}
