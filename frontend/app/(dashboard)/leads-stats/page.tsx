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

interface Forecast {
  pipeline_total: number;
  weighted_total: number;
  best_case: number;
  commit: number;
  deals_count: number;
  by_month: Array<{ month: string; pipeline: number; weighted: number; deals: number }>;
}

interface RottingDeal {
  name: string;
  title: string;
  status: string;
  source: string;
  customer: string;
  amount_estimated: number;
  rotting_days: number;
  last_activity_date: string;
}

interface LossAnalysis {
  period_days: number;
  won_count: number;
  won_amount: number;
  lost_count: number;
  lost_amount: number;
  total_closed: number;
  win_rate: number;
  reasons: Array<{ reason: string; cnt: number; amt: number }>;
  competitors: Array<{ loss_competitor: string; cnt: number; amt: number }>;
  by_source: Array<{ source: string; total: number; won: number; lost: number; win_rate: number }>;
}

export default function LeadsStatsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [rotting, setRotting] = useState<RottingDeal[]>([]);
  const [lossAnalysis, setLossAnalysis] = useState<LossAnalysis | null>(null);
  const [grades, setGrades] = useState<Array<{ grade: string; cnt: number; amt: number }>>([]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/leads-stats?days=${days}`).then((r) => r.json()),
      fetch("/api/pipeline-forecast").then((r) => r.json()),
      fetch("/api/pipeline-rotting").then((r) => r.json()),
      fetch(`/api/pipeline-loss-analysis?days=${days}`).then((r) => r.json()),
      fetch("/api/lead-scoring").then((r) => r.json()),
    ])
      .then(([s, f, r, l, g]) => {
        setData(s);
        setForecast(f);
        setRotting(Array.isArray(r) ? r : []);
        setLossAnalysis(l);
        setGrades(Array.isArray(g.by_grade) ? g.by_grade : []);
      })
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

      {/* Lead Scoring distribution */}
      {grades.length > 0 && (
        <div style={{ ...card, marginBottom: 22 }}>
          <h3 style={cardTitle}>🎓 Lead Grade распределение (открытые сделки)</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {["A", "B", "C", "D"].map((g) => {
              const row = grades.find((x) => x.grade === g);
              const cnt = row?.cnt || 0;
              const amt = row?.amt || 0;
              const color = g === "A" ? "var(--success)" : g === "B" ? "var(--accent)" : g === "C" ? "var(--warning)" : "var(--danger)";
              const desc = g === "A" ? "Горячий" : g === "B" ? "Тёплый" : g === "C" ? "Холодный" : "Бесперспективный";
              return (
                <div key={g} style={{
                  padding: 14, borderRadius: 10,
                  background: "var(--bg-base)", border: `1px solid ${color}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 28, fontWeight: 700, color }}>{g}</span>
                    <span style={{ fontSize: 22, fontWeight: 600, fontFamily: "monospace", color }}>{cnt}</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace", marginTop: 6 }}>
                    {desc}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
                    {fmtMln(amt)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Forecast */}
      {forecast && forecast.deals_count > 0 && (
        <div style={{ ...card, marginBottom: 22 }}>
          <h3 style={cardTitle}>📈 Weighted Forecast (по probability_pct)</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 14 }}>
            <Kpi label="Pipeline (best case)" value={fmtMln(forecast.best_case)} />
            <Kpi label="Weighted (50/50)" value={fmtMln(forecast.weighted_total)} accent="var(--accent)"
                 sub={`${forecast.deals_count} сделок`} />
            <Kpi label="Commit (≥80%)" value={fmtMln(forecast.commit)} accent="var(--success)" />
            <Kpi label="Conversion ratio" value={
              forecast.best_case > 0
                ? `${Math.round(forecast.weighted_total / forecast.best_case * 100)}%`
                : "—"
            } />
          </div>
          {forecast.by_month.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace", marginBottom: 8 }}>
                По месяцам:
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                {forecast.by_month.map((m) => (
                  <div key={m.month} style={{
                    flex: 1, padding: 10, borderRadius: 8,
                    background: "var(--bg-base)", border: "1px solid var(--border-subtle)",
                  }}>
                    <div style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "monospace" }}>{m.month}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--accent)", marginTop: 4 }}>{fmtMln(m.weighted)}</div>
                    <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{m.deals} сделок · {fmtMln(m.pipeline)} pipeline</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Rotting deals */}
      {rotting.length > 0 && (
        <div style={{ ...card, marginBottom: 22 }}>
          <h3 style={{ ...cardTitle, color: "var(--warning)" }}>
            🥀 Залежавшиеся сделки ({rotting.length})
          </h3>
          <p style={{ fontSize: 11.5, color: "var(--text-tertiary)", margin: "0 0 12px" }}>
            Сделки без активности больше N дней (порог зависит от стадии). Свяжись или закрой.
          </p>
          <table style={tbl}>
            <thead>
              <tr style={tblHead}>
                <th style={th}>Название</th>
                <th style={th}>Статус</th>
                <th style={{ ...th, textAlign: "right" }}>Дней молчания</th>
                <th style={{ ...th, textAlign: "right" }}>Сумма</th>
              </tr>
            </thead>
            <tbody>
              {rotting.slice(0, 10).map((d) => (
                <tr key={d.name} style={tblRow}>
                  <td style={td}>
                    <div style={{ fontSize: 12.5 }}>{d.title || d.name}</div>
                    <div style={{ fontSize: 10.5, color: "var(--text-tertiary)" }}>{d.source || "—"} · {d.customer || "—"}</div>
                  </td>
                  <td style={{ ...td, fontSize: 11 }}>
                    <span style={{
                      padding: "2px 8px", borderRadius: 4, fontSize: 10.5,
                      background: `${STATUS_COLOR[d.status] || "var(--text-tertiary)"}22`,
                      color: STATUS_COLOR[d.status] || "var(--text-tertiary)",
                    }}>{d.status}</span>
                  </td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "var(--danger)", fontWeight: 600 }}>
                    {d.rotting_days}д
                  </td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontSize: 11 }}>
                    {fmtMln(d.amount_estimated)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Loss Analysis */}
      {lossAnalysis && lossAnalysis.total_closed > 0 && (
        <div style={{ ...card, marginBottom: 22 }}>
          <h3 style={cardTitle}>🎯 Win/Loss Analysis (закрытые за период)</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 14 }}>
            <Kpi label="Выиграно" value={`${lossAnalysis.won_count}`} accent="var(--success)" sub={fmtMln(lossAnalysis.won_amount)} />
            <Kpi label="Проиграно" value={`${lossAnalysis.lost_count}`} accent="var(--danger)" sub={fmtMln(lossAnalysis.lost_amount)} />
            <Kpi label="Всего закрыто" value={`${lossAnalysis.total_closed}`} />
            <Kpi label="Win-rate" value={`${lossAnalysis.win_rate}%`}
                 accent={lossAnalysis.win_rate >= 30 ? "var(--success)" : lossAnalysis.win_rate >= 15 ? "var(--warning)" : "var(--danger)"} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace", marginBottom: 8 }}>
                Топ-причины проигрыша
              </div>
              {lossAnalysis.reasons.length === 0 ? (
                <Empty>Причины не указаны</Empty>
              ) : (
                lossAnalysis.reasons.slice(0, 6).map((r) => (
                  <div key={r.reason} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <span>{r.reason}</span>
                    <span style={{ fontFamily: "monospace", color: "var(--danger)" }}>{r.cnt} · {fmtMln(r.amt)}</span>
                  </div>
                ))
              )}
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace", marginBottom: 8 }}>
                Win-rate по источникам
              </div>
              <table style={{ width: "100%", fontSize: 11.5 }}>
                <tbody>
                  {lossAnalysis.by_source.map((s) => (
                    <tr key={s.source || "—"} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "5px 0" }}>{s.source || "—"}</td>
                      <td style={{ padding: "5px 0", textAlign: "right", fontFamily: "monospace" }}>
                        {s.won}/{s.total}
                      </td>
                      <td style={{ padding: "5px 0", textAlign: "right", fontFamily: "monospace", color: s.win_rate >= 30 ? "var(--success)" : s.win_rate >= 15 ? "var(--warning)" : "var(--text-tertiary)" }}>
                        {s.win_rate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

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
