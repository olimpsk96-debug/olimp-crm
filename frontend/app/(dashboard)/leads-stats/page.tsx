"use client";

import { useEffect, useState } from "react";

interface SourceRow {
  source: string;
  total: number;
  new_count: number;
  open_count: number;
  won: number;
  lost: number;
  avg_amount: number;
  total_amount: number;
  conversion_pct: number;
}

interface FunnelRow { status: string; cnt: number; amount: number }
interface TimelineRow { day: string; cnt: number; won: number }
interface RecentRow {
  name: string; title: string; status: string; source: string;
  customer: string; contact_name: string;
  amount_estimated: number; creation: string;
}

interface Stats {
  period_days: number;
  kpi: {
    total: number;
    open: number;
    won: number;
    lost: number;
    conversion_pct: number;
    avg_amount: number;
    total_amount: number;
  };
  by_source: SourceRow[];
  funnel: FunnelRow[];
  timeline: TimelineRow[];
  recent: RecentRow[];
}

const STATUS_COLOR: Record<string, string> = {
  "Лид": "var(--accent)",
  "Переговоры": "#a78bfa",
  "КП отправлено": "#60a5fa",
  "Договор": "var(--success)",
  "В работе": "var(--success)",
  "Закрыт выигран": "var(--success)",
  "Закрыт проигран": "var(--danger)",
};

function fmtMln(n: number): string {
  if (!n) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} млн ₽`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}К ₽`;
  return `${n.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽`;
}

export default function LeadsStatsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/leads-stats?days=${days}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Загрузка...</div>;
  }
  if (!data || !data.kpi) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Нет данных</div>;
  }

  const k = data.kpi;
  const maxFunnel = Math.max(...data.funnel.map((f) => f.cnt), 1);
  const maxSourceTotal = Math.max(...data.by_source.map((s) => s.total), 1);
  const maxTimelineCount = Math.max(...data.timeline.map((t) => t.cnt), 1);

  return (
    <div style={{ padding: "24px 32px", minHeight: "100vh", background: "var(--bg-base)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>
            Аналитика лидов
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>
            Откуда приходят клиенты, что конвертируется, где теряем
          </p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[7, 30, 90, 365].map((d) => (
            <button
              key={d} onClick={() => setDays(d)}
              style={{
                padding: "6px 14px", fontSize: 12, borderRadius: 7,
                border: "1px solid var(--border-subtle)",
                background: days === d ? "var(--accent)" : "transparent",
                color: days === d ? "white" : "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              {d === 365 ? "Год" : `${d}д`}
            </button>
          ))}
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 22 }}>
        <Kpi label="Всего лидов" value={k.total} />
        <Kpi label="В работе" value={k.open} accent="var(--accent)" />
        <Kpi label="Выиграно" value={k.won} accent="var(--success)" />
        <Kpi label="Проиграно" value={k.lost} accent="var(--danger)" />
        <Kpi
          label="Конверсия"
          value={`${k.conversion_pct}%`}
          accent={k.conversion_pct >= 30 ? "var(--success)" : k.conversion_pct >= 15 ? "var(--warning)" : "var(--danger)"}
          sub="из закрытых"
        />
        <Kpi label="Средний чек" value={fmtMln(k.avg_amount)} accent="var(--accent)" />
        <Kpi label="Сумма пайплайна" value={fmtMln(k.total_amount)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 22 }}>
        {/* Воронка */}
        <div style={card}>
          <h3 style={cardTitle}>Воронка</h3>
          {data.funnel.map((f) => (
            <div key={f.status} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                <span style={{ color: "var(--text-secondary)" }}>{f.status}</span>
                <span style={{ fontFamily: "monospace", color: STATUS_COLOR[f.status] || "var(--text-primary)" }}>
                  {f.cnt} · {fmtMln(f.amount)}
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: "var(--bg-base)", overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${(f.cnt / maxFunnel) * 100}%`,
                  background: STATUS_COLOR[f.status] || "var(--accent)",
                  transition: "width 0.3s ease",
                }} />
              </div>
            </div>
          ))}
        </div>

        {/* Источники */}
        <div style={card}>
          <h3 style={cardTitle}>По источникам</h3>
          {data.by_source.length === 0 ? (
            <Empty>Нет лидов за этот период</Empty>
          ) : (
            <table style={tbl}>
              <thead>
                <tr style={tblHead}>
                  <th style={th}>Источник</th>
                  <th style={{ ...th, textAlign: "right" }}>Всего</th>
                  <th style={{ ...th, textAlign: "right" }}>Конв.</th>
                  <th style={{ ...th, textAlign: "right" }}>Ср.чек</th>
                </tr>
              </thead>
              <tbody>
                {data.by_source.map((s) => (
                  <tr key={s.source || "none"} style={tblRow}>
                    <td style={td}>
                      <div style={{ fontSize: 12.5 }}>{s.source || "Не указан"}</div>
                      <div style={{ height: 3, marginTop: 4, borderRadius: 2, background: "var(--bg-base)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${(s.total / maxSourceTotal) * 100}%`, background: "var(--accent)" }} />
                      </div>
                    </td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{s.total}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace",
                                 color: s.conversion_pct >= 30 ? "var(--success)"
                                      : s.conversion_pct >= 15 ? "var(--warning)" : "var(--text-tertiary)" }}>
                      {s.conversion_pct ? `${s.conversion_pct}%` : "—"}
                    </td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontSize: 11 }}>
                      {fmtMln(s.avg_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div style={{ ...card, marginBottom: 22 }}>
        <h3 style={cardTitle}>Динамика по дням</h3>
        {data.timeline.length === 0 ? (
          <Empty>Нет данных за период</Empty>
        ) : (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 100, paddingTop: 8 }}>
            {data.timeline.map((t) => {
              const h = (t.cnt / maxTimelineCount) * 100;
              const wonH = t.cnt > 0 ? (t.won / t.cnt) * h : 0;
              return (
                <div key={t.day}
                     title={`${t.day}: ${t.cnt} (выиграно ${t.won})`}
                     style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", minWidth: 4 }}>
                  <div style={{
                    height: `${h}%`, background: "var(--accent)",
                    borderRadius: "3px 3px 0 0", position: "relative",
                  }}>
                    {wonH > 0 && (
                      <div style={{
                        position: "absolute", bottom: 0, left: 0, right: 0,
                        height: `${(wonH / h) * 100}%`,
                        background: "var(--success)", borderRadius: "0 0 3px 3px",
                      }} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 8, display: "flex", justifyContent: "space-between" }}>
          <span>{data.timeline[0]?.day || "—"}</span>
          <span>
            <span style={{ display: "inline-block", width: 8, height: 8, background: "var(--accent)", marginRight: 4 }}></span>Все лиды
            <span style={{ display: "inline-block", width: 8, height: 8, background: "var(--success)", marginLeft: 12, marginRight: 4 }}></span>Выиграны
          </span>
          <span>{data.timeline[data.timeline.length - 1]?.day || "—"}</span>
        </div>
      </div>

      {/* Последние лиды */}
      <div style={card}>
        <h3 style={cardTitle}>Последние лиды</h3>
        {data.recent.length === 0 ? (
          <Empty>Нет лидов</Empty>
        ) : (
          <table style={tbl}>
            <thead>
              <tr style={tblHead}>
                <th style={th}>Название</th>
                <th style={th}>Источник</th>
                <th style={th}>Статус</th>
                <th style={{ ...th, textAlign: "right" }}>Сумма</th>
                <th style={th}>Когда</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map((r) => (
                <tr key={r.name} style={tblRow}>
                  <td style={td}>
                    <div style={{ fontSize: 12.5, fontWeight: 500 }}>{r.title || r.name}</div>
                    <div style={{ fontSize: 10.5, color: "var(--text-tertiary)" }}>
                      {r.customer || r.contact_name || "—"}
                    </div>
                  </td>
                  <td style={{ ...td, fontSize: 11 }}>{r.source || "—"}</td>
                  <td style={td}>
                    <span style={{
                      padding: "2px 8px", borderRadius: 4, fontSize: 10.5,
                      background: `${STATUS_COLOR[r.status] || "var(--text-tertiary)"}22`,
                      color: STATUS_COLOR[r.status] || "var(--text-tertiary)",
                    }}>{r.status}</span>
                  </td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontSize: 11 }}>
                    {fmtMln(r.amount_estimated)}
                  </td>
                  <td style={{ ...td, fontSize: 10.5, color: "var(--text-tertiary)", fontFamily: "monospace" }}>
                    {new Date(r.creation).toLocaleDateString("ru-RU")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value: number | string; sub?: string; accent?: string }) {
  return (
    <div style={{
      padding: "14px 16px", borderRadius: 10,
      background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
    }}>
      <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 600, fontFamily: "monospace", color: accent ?? "var(--text-primary)" }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 18, textAlign: "center", color: "var(--text-tertiary)", fontSize: 12 }}>{children}</div>;
}

const card: React.CSSProperties = {
  padding: 16, borderRadius: 12,
  background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
};
const cardTitle: React.CSSProperties = {
  fontSize: 13, fontWeight: 500, margin: "0 0 14px 0", color: "var(--text-secondary)",
};
const tbl: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };
const tblHead: React.CSSProperties = { borderBottom: "1px solid var(--border-subtle)" };
const tblRow: React.CSSProperties = { borderBottom: "1px solid rgba(255,255,255,0.04)" };
const th: React.CSSProperties = {
  padding: "8px 10px", textAlign: "left", fontSize: 10,
  color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em",
  fontFamily: "monospace", fontWeight: 500,
};
const td: React.CSSProperties = { padding: "8px 10px", fontSize: 12, verticalAlign: "top" };
