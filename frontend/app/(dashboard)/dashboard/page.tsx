"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ActivityFeed } from "@/components/activity/ActivityFeed";

// ── Types ────────────────────────────────────────────────────────────────────

interface Alert {
  type: string;
  severity: "critical" | "warning";
  title: string;
  body: string;
  link: string;
  meta?: string;
}

interface Dashboard {
  cashflow: { balance: number; incoming: number; outgoing: number; projected: number };
  tenders: { active: number; deadlines_3d: Array<{ name: string; title: string; deadline_date: string; nmck?: number }> };
  ks2: { unpaid_acts: Array<{ name: string; title: string; debt: number; customer?: string; overdue: boolean; payment_due_date?: string }>; unpaid_total: number };
  supply: { pending: Array<{ name: string; title: string; total_estimated?: number }>; planned_total: number };
  safety: { open_incidents: Array<{ name: string; title: string; severity: string }>; workers_today: number; reports_today: number };
  equipment: { maintenance_due: Array<{ name: string; equipment_name: string; days_left?: number; current_location?: string }>; fuel_month: number };
  crm: {
    total_clients: number;
    active_deals: number;
    pipeline_total: number;
    next_actions: Array<{ name: string; customer: string; customer_name?: string; next_action: string; next_action_date: string; overdue: number }>;
    deals_pipeline: Array<{ status: string; cnt: number; total: number }>;
  };
  projects: {
    active: number;
    list: Array<{
      name: string; title: string; status: string; customer: string;
      contract_amount?: number; planned_end_date?: string;
      ks2_signed: number; days_left: number | null; progress_pct: number;
    }>;
  };
  alerts: Alert[];
  updated_at: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtMln(v?: number | null): string {
  if (!v && v !== 0) return "—";
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)} млн ₽`;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)} тыс. ₽`;
  return `${v.toFixed(0)} ₽`;
}

function today(): string {
  return new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

// ── Sub-components ───────────────────────────────────────────────────────────

function CashCard({ label, value, accent, sub }: { label: string; value: string; accent?: string; sub?: string }) {
  return (
    <div style={{ flex: 1, padding: "16px 20px", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 14 }}>
      <p style={{ fontSize: 10.5, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace", marginBottom: 6 }}>{label}</p>
      <p style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 700, color: accent ?? "var(--text-primary)", letterSpacing: "-0.02em" }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

function SectionHeader({ label, href, count }: { label: string; href: string; count?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <p style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "monospace" }}>{label}</p>
      {count != null && count > 0 && <span style={{ fontSize: 10.5, padding: "1px 7px", borderRadius: 10, background: "rgba(249,115,22,0.12)", color: "var(--accent)", fontFamily: "monospace" }}>{count}</span>}
      <Link href={href} style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--text-tertiary)", textDecoration: "none" }}>
        Все →
      </Link>
    </div>
  );
}

function AlertCard({ alert }: { alert: Alert }) {
  const isCrit = alert.severity === "critical";
  const color = isCrit ? "var(--danger)" : "var(--warning)";
  const bg = isCrit ? "rgba(248,113,113,0.06)" : "rgba(251,191,36,0.06)";
  const border = isCrit ? "rgba(248,113,113,0.25)" : "rgba(251,191,36,0.25)";
  return (
    <Link href={alert.link} style={{ textDecoration: "none" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px", borderRadius: 10, background: bg, border: `1px solid ${border}`, marginBottom: 6, cursor: "pointer" }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0, marginTop: 4 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color, marginBottom: 2 }}>{alert.title}</p>
          <p style={{ fontSize: 12.5, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{alert.body}</p>
          {alert.meta && <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2, fontFamily: "monospace" }}>{alert.meta}</p>}
        </div>
      </div>
    </Link>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p style={{ fontSize: 12.5, color: "var(--text-tertiary)", padding: "16px 0", textAlign: "center" }}>{text}</p>;
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState("");

  const load = useCallback(async () => {
    try {
      const d = await fetch("/api/dashboard").then((r) => r.json());
      setData(d);
      setLastUpdate(d.updated_at ?? "");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Автообновление каждые 60 секунд
  useEffect(() => {
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const cf = data?.cashflow;
  const projPos = (cf?.projected ?? 0) >= 0;
  const critAlerts = data?.alerts.filter((a) => a.severity === "critical") ?? [];
  const warnAlerts = data?.alerts.filter((a) => a.severity === "warning") ?? [];

  return (
    <div style={{ padding: "24px 32px", minHeight: "100vh", background: "var(--bg-base)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em" }}>Командный центр</h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4, textTransform: "capitalize" }}>{today()}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {lastUpdate && <p style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "monospace" }}>обновлено {lastUpdate}</p>}
          <button onClick={load} disabled={loading}
            style={{ padding: "7px 14px", borderRadius: 9, border: "1px solid var(--border-subtle)", background: "transparent", color: "var(--text-secondary)", fontSize: 12, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.5 : 1 }}>
            {loading ? "..." : "Обновить"}
          </button>
        </div>
      </div>

      {loading && !data && <div style={{ textAlign: "center", padding: 80, color: "var(--text-tertiary)" }}>Загрузка...</div>}

      {data && (
        <>
          {/* ── Кассовая строка ─────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
            <Link href="/cashflow" style={{ textDecoration: "none" }}>
              <CashCard label="Баланс кассы" value={fmtMln(cf?.balance)} sub="нажмите чтобы изменить" />
            </Link>
            <Link href="/ks2" style={{ textDecoration: "none" }}>
              <CashCard label="Ожидается (КС-2)" value={fmtMln(cf?.incoming)} accent="var(--success)" sub={`${data.ks2.unpaid_acts.length} акт${data.ks2.unpaid_acts.length !== 1 ? "а" : ""}`} />
            </Link>
            <Link href="/supply" style={{ textDecoration: "none" }}>
              <CashCard label="Плановые расходы" value={fmtMln(cf?.outgoing)} accent="var(--danger)" sub={`${data.supply.pending.length} заявок`} />
            </Link>
            <div style={{ flex: 1, padding: "16px 20px", background: projPos ? "rgba(52,211,153,0.06)" : "rgba(248,113,113,0.06)", border: `1px solid ${projPos ? "rgba(52,211,153,0.25)" : "rgba(248,113,113,0.25)"}`, borderRadius: 14 }}>
              <p style={{ fontSize: 10.5, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace", marginBottom: 6 }}>Прогноз</p>
              <p style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 700, color: projPos ? "var(--success)" : "var(--danger)", letterSpacing: "-0.02em" }}>{fmtMln(cf?.projected)}</p>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>{projPos ? "профицит" : "риск разрыва"}</p>
            </div>
          </div>

          {/* ── Alerts ──────────────────────────────────────────── */}
          {data.alerts.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "monospace", marginBottom: 10 }}>
                Требует внимания
                {critAlerts.length > 0 && <span style={{ marginLeft: 8, padding: "1px 7px", borderRadius: 10, background: "rgba(248,113,113,0.15)", color: "var(--danger)" }}>{critAlerts.length} критично</span>}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[...critAlerts, ...warnAlerts].map((a, i) => <AlertCard key={i} alert={a} />)}
              </div>
            </div>
          )}

          {/* ── Активные проекты ───────────────────────────────── */}
          {data.projects && data.projects.list.length > 0 && (
            <div style={{ marginBottom: 28, background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 14, padding: "18px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <p style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "monospace", margin: 0 }}>
                  Активные проекты
                  <span style={{ marginLeft: 8, padding: "1px 7px", borderRadius: 10, background: "rgba(249,115,22,0.12)", color: "var(--accent)", fontFamily: "monospace" }}>{data.projects.active}</span>
                </p>
                <Link href="/projects" style={{ fontSize: 11.5, color: "var(--text-tertiary)", textDecoration: "none" }}>Все →</Link>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {data.projects.list.map(p => {
                  const overdue = p.days_left !== null && p.days_left < 0;
                  const soon = p.days_left !== null && p.days_left >= 0 && p.days_left <= 14;
                  return (
                    <Link key={p.name} href={`/projects/${encodeURIComponent(p.name)}`} style={{ textDecoration: "none" }}>
                      <div style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border-subtle)", cursor: "pointer", background: "var(--bg-base)", transition: "border-color 0.15s" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-subtle)"; }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 6 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</p>
                            <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: "2px 0 0" }}>{p.customer} · {p.status}</p>
                          </div>
                          <div style={{ display: "flex", gap: 14, flexShrink: 0, alignItems: "center" }}>
                            {p.days_left !== null && (
                              <span style={{ fontSize: 11, fontFamily: "monospace", color: overdue ? "var(--danger)" : soon ? "var(--warning)" : "var(--text-secondary)", fontWeight: 600 }}>
                                {overdue ? `просроч. ${Math.abs(p.days_left)}д` : `${p.days_left}д до сдачи`}
                              </span>
                            )}
                            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: "var(--text-primary)", minWidth: 80, textAlign: "right" }}>{fmtMln(p.contract_amount)}</span>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ flex: 1, height: 4, background: "var(--border-subtle)", borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${p.progress_pct}%`, background: p.progress_pct >= 100 ? "var(--success)" : "var(--accent)", transition: "width 0.3s" }} />
                          </div>
                          <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "monospace", minWidth: 36, textAlign: "right" }}>{p.progress_pct}%</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Основная сетка 3 колонки ────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>

            {/* Тендеры */}
            <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 14, padding: "16px 18px" }}>
              <SectionHeader label="Тендеры" href="/tenders" count={data.tenders.active} />
              <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                <div>
                  <p style={{ fontSize: 24, fontWeight: 700, fontFamily: "monospace", color: "var(--accent)" }}>{data.tenders.active}</p>
                  <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>активных</p>
                </div>
                {data.tenders.deadlines_3d.length > 0 && (
                  <div>
                    <p style={{ fontSize: 24, fontWeight: 700, fontFamily: "monospace", color: "var(--danger)" }}>{data.tenders.deadlines_3d.length}</p>
                    <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>срок ≤ 3д</p>
                  </div>
                )}
              </div>
              {data.tenders.deadlines_3d.length > 0 ? (
                data.tenders.deadlines_3d.map((t) => (
                  <Link key={t.name} href="/tenders" style={{ textDecoration: "none" }}>
                    <div style={{ padding: "8px 0", borderTop: "1px solid var(--border-subtle)" }}>
                      <p style={{ fontSize: 12.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</p>
                      <p style={{ fontSize: 11, color: "var(--danger)", fontFamily: "monospace", marginTop: 2 }}>{t.deadline_date}{t.nmck ? ` · ${fmtMln(t.nmck)}` : ""}</p>
                    </div>
                  </Link>
                ))
              ) : (
                <EmptyState text="Горящих дедлайнов нет" />
              )}
            </div>

            {/* КС-2 */}
            <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 14, padding: "16px 18px" }}>
              <SectionHeader label="КС-2 — Ожидает оплаты" href="/ks2" count={data.ks2.unpaid_acts.length} />
              {data.ks2.unpaid_total > 0 && (
                <p style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 700, color: "var(--success)", marginBottom: 10 }}>{fmtMln(data.ks2.unpaid_total)}</p>
              )}
              {data.ks2.unpaid_acts.length === 0 ? (
                <EmptyState text="Все акты оплачены" />
              ) : (
                data.ks2.unpaid_acts.map((a) => (
                  <Link key={a.name} href="/ks2" style={{ textDecoration: "none" }}>
                    <div style={{ padding: "8px 0", borderTop: "1px solid var(--border-subtle)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <p style={{ fontSize: 12.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{a.title}</p>
                        <p style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 600, color: a.overdue ? "var(--danger)" : "var(--success)", flexShrink: 0, marginLeft: 8 }}>{fmtMln(a.debt)}</p>
                      </div>
                      <p style={{ fontSize: 11, color: a.overdue ? "var(--danger)" : "var(--text-tertiary)", fontFamily: "monospace", marginTop: 2 }}>
                        {a.customer}{a.payment_due_date ? ` · до ${a.payment_due_date}` : ""}{a.overdue ? " — ПРОСРОЧЕНО" : ""}
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </div>

            {/* Прорабы + ОТ/ТБ */}
            <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 14, padding: "16px 18px" }}>
              <SectionHeader label="Прорабы · ОТ/ТБ" href="/safety" count={data.safety.open_incidents.length} />
              <div style={{ display: "flex", gap: 20, marginBottom: 12 }}>
                <div>
                  <p style={{ fontSize: 24, fontWeight: 700, fontFamily: "monospace" }}>{data.safety.workers_today}</p>
                  <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>рабочих сегодня</p>
                </div>
                <div>
                  <p style={{ fontSize: 24, fontWeight: 700, fontFamily: "monospace", color: data.safety.reports_today > 0 ? "var(--success)" : "var(--text-tertiary)" }}>{data.safety.reports_today}</p>
                  <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>отчётов</p>
                </div>
                {data.safety.open_incidents.length > 0 && (
                  <div>
                    <p style={{ fontSize: 24, fontWeight: 700, fontFamily: "monospace", color: "var(--danger)" }}>{data.safety.open_incidents.length}</p>
                    <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>инцидентов</p>
                  </div>
                )}
              </div>
              {data.safety.open_incidents.length === 0 ? (
                <div style={{ padding: "8px 0", borderTop: "1px solid var(--border-subtle)" }}>
                  <p style={{ fontSize: 12.5, color: "var(--success)" }}>Инцидентов нет — хорошо</p>
                </div>
              ) : (
                data.safety.open_incidents.map((inc) => (
                  <Link key={inc.name} href="/safety" style={{ textDecoration: "none" }}>
                    <div style={{ padding: "8px 0", borderTop: "1px solid var(--border-subtle)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 10.5, padding: "1px 6px", borderRadius: 4, border: `1px solid ${inc.severity === "Тяжёлый" || inc.severity === "Критический" ? "var(--danger)" : "var(--warning)"}`, color: inc.severity === "Тяжёлый" || inc.severity === "Критический" ? "var(--danger)" : "var(--warning)", flexShrink: 0 }}>{inc.severity}</span>
                        <p style={{ fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inc.title}</p>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>

            {/* Техника */}
            <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 14, padding: "16px 18px" }}>
              <SectionHeader label="Техника — ТО" href="/equipment" count={data.equipment.maintenance_due.length} />
              {data.equipment.fuel_month > 0 && (
                <p style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "monospace", marginBottom: 10 }}>ГСМ за месяц: {fmtMln(data.equipment.fuel_month)}</p>
              )}
              {data.equipment.maintenance_due.length === 0 ? (
                <EmptyState text="Просроченных ТО нет" />
              ) : (
                data.equipment.maintenance_due.map((eq) => {
                  const overdue = (eq.days_left ?? 0) < 0;
                  return (
                    <Link key={eq.name} href="/equipment" style={{ textDecoration: "none" }}>
                      <div style={{ padding: "8px 0", borderTop: "1px solid var(--border-subtle)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                          <p style={{ fontSize: 12.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{eq.equipment_name}</p>
                          <p style={{ fontSize: 11, fontFamily: "monospace", color: overdue ? "var(--danger)" : "var(--warning)", fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>
                            {overdue ? `просроч. ${Math.abs(eq.days_left ?? 0)}д` : `через ${eq.days_left}д`}
                          </p>
                        </div>
                        {eq.current_location && <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{eq.current_location}</p>}
                      </div>
                    </Link>
                  );
                })
              )}
            </div>

            {/* Снабжение */}
            <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 14, padding: "16px 18px" }}>
              <SectionHeader label="Снабжение" href="/supply" count={data.supply.pending.length} />
              {data.supply.planned_total > 0 && (
                <p style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 700, color: "var(--danger)", marginBottom: 10 }}>{fmtMln(data.supply.planned_total)}</p>
              )}
              {data.supply.pending.length === 0 ? (
                <EmptyState text="Ожидающих заявок нет" />
              ) : (
                data.supply.pending.map((s) => (
                  <Link key={s.name} href="/supply" style={{ textDecoration: "none" }}>
                    <div style={{ padding: "8px 0", borderTop: "1px solid var(--border-subtle)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <p style={{ fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{s.title}</p>
                        {s.total_estimated ? <p style={{ fontFamily: "monospace", fontSize: 12, color: "var(--text-secondary)", flexShrink: 0, marginLeft: 8 }}>{fmtMln(s.total_estimated)}</p> : null}
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>

            {/* CRM — Следующие шаги */}
            <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 14, padding: "16px 18px" }}>
              <SectionHeader label="CRM — Следующие шаги" href="/clients" count={data.crm.next_actions.length} />
              <div style={{ display: "flex", gap: 20, marginBottom: 12 }}>
                <div>
                  <p style={{ fontSize: 24, fontWeight: 700, fontFamily: "monospace" }}>{data.crm.total_clients}</p>
                  <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>клиентов</p>
                </div>
                <div>
                  <p style={{ fontSize: 24, fontWeight: 700, fontFamily: "monospace", color: data.crm.active_deals > 0 ? "var(--accent)" : "var(--text-tertiary)" }}>{data.crm.active_deals}</p>
                  <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>сделок</p>
                </div>
                {data.crm.pipeline_total > 0 && (
                  <div>
                    <p style={{ fontSize: 16, fontWeight: 700, fontFamily: "monospace", color: "var(--success)", marginTop: 6 }}>{fmtMln(data.crm.pipeline_total)}</p>
                    <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>в воронке</p>
                  </div>
                )}
              </div>
              {data.crm.next_actions.length === 0 ? (
                <EmptyState text="Задач на сегодня нет" />
              ) : (
                data.crm.next_actions.map((na) => (
                  <Link key={na.name} href="/clients" style={{ textDecoration: "none" }}>
                    <div style={{ padding: "8px 0", borderTop: "1px solid var(--border-subtle)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{na.next_action}</p>
                          <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{na.customer_name || na.customer}</p>
                        </div>
                        <p style={{ fontSize: 11, fontFamily: "monospace", color: na.overdue ? "var(--danger)" : "var(--warning)", fontWeight: 600, flexShrink: 0 }}>
                          {na.overdue ? "просроч." : na.next_action_date.slice(5)}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>

            {/* Лента активности */}
            <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 14, marginBottom: 16, overflow: "hidden" }}>
              <div style={{ padding: "14px 18px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "monospace", margin: 0 }}>За 7 дней</p>
                <Link href="/activity" style={{ fontSize: 11, color: "var(--accent)", textDecoration: "none" }}>Вся лента →</Link>
              </div>
              <ActivityFeed days={7} limit={10} compact />
            </div>

            {/* Быстрые ссылки */}
            <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 14, padding: "16px 18px" }}>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "monospace", marginBottom: 12 }}>Быстрые действия</p>
              {[
                { label: "Новый проект", href: "/projects", color: "var(--accent)" },
                { label: "Новый тендер", href: "/tenders", color: "var(--accent)" },
                { label: "Новая сделка", href: "/deals", color: "var(--success)" },
                { label: "Новый акт КС-2", href: "/ks2", color: "var(--success)" },
                { label: "Отчёт прораба", href: "/safety", color: "var(--warning)" },
                { label: "Спросить AI", href: "/ai", color: "var(--accent)" },
              ].map((item) => (
                <Link key={item.href} href={item.href} style={{ textDecoration: "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: "1px solid var(--border-subtle)", cursor: "pointer" }}
                    onMouseEnter={(e) => (e.currentTarget.style.paddingLeft = "4px")}
                    onMouseLeave={(e) => (e.currentTarget.style.paddingLeft = "0px")}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                    <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{item.label}</p>
                    <svg style={{ marginLeft: "auto" }} width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5"><path d="M6 3l5 5-5 5" /></svg>
                  </div>
                </Link>
              ))}
            </div>

          </div>
        </>
      )}
    </div>
  );
}
