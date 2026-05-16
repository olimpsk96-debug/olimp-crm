"use client";

import { useEffect, useState } from "react";

interface Stats {
  period_days: number;
  kpi: {
    total: number;
    from_template: number;
    from_ai: number;
    applied: number;
    edited: number;
    rated_good: number;
    rated_ok: number;
    rated_bad: number;
    unrated: number;
  };
  top_templates: Array<{
    template: string;
    title: string;
    category: string;
    uses: number;
    good: number;
    bad: number;
  }>;
  no_template_queries: Array<{ description: string; uses: number; good: number }>;
  by_user: Array<{ user_email: string; cnt: number }>;
  recent: Array<{
    name: string;
    description: string;
    template_used: string;
    source: string;
    rating: string;
    was_applied: number;
    was_edited_after: number;
    user_email: string;
    feedback_date: string;
  }>;
}

export default function DecompositionStatsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/decomposition-stats?days=${days}`)
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
  const ratedTotal = k.rated_good + k.rated_ok + k.rated_bad;
  const csat = ratedTotal > 0 ? Math.round((k.rated_good + k.rated_ok * 0.5) / ratedTotal * 100) : 0;

  return (
    <div style={{ padding: "24px 32px", minHeight: "100vh", background: "var(--bg-base)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>
            Аналитика AI-декомпозиции
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>
            Как используется AI-генерация смет — что работает, что переделывается
          </p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[7, 30, 90, 365].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              style={{
                padding: "6px 14px",
                fontSize: 12,
                borderRadius: 7,
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
        <Kpi label="Всего запросов" value={k.total} />
        <Kpi label="Из шаблонов" value={k.from_template}
             sub={k.total > 0 ? `${Math.round(k.from_template / k.total * 100)}%` : ""} />
        <Kpi label="Через AI" value={k.from_ai}
             sub={k.total > 0 ? `${Math.round(k.from_ai / k.total * 100)}%` : ""} />
        <Kpi label="Применено в сметы" value={k.applied}
             sub={k.total > 0 ? `${Math.round(k.applied / k.total * 100)}%` : ""} accent="var(--accent)" />
        <Kpi label="CSAT" value={`${csat}%`}
             accent={csat >= 70 ? "var(--success)" : csat >= 40 ? "var(--warning)" : "var(--danger)"}
             sub={ratedTotal > 0 ? `по ${ratedTotal} оценкам` : "нет оценок"} />
        <Kpi label="👍 Полезно" value={k.rated_good} accent="var(--success)" />
        <Kpi label="👎 Бесполезно" value={k.rated_bad} accent="var(--danger)" />
        <Kpi label="Без оценки" value={k.unrated} accent="var(--text-tertiary)" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 24 }}>
        {/* Top templates */}
        <div style={card}>
          <h3 style={cardTitle}>Топ шаблонов</h3>
          {data.top_templates.length === 0 ? (
            <Empty>Шаблоны ещё не использовались за этот период</Empty>
          ) : (
            <table style={tbl}>
              <thead>
                <tr style={tblHead}>
                  <th style={th}>Шаблон</th>
                  <th style={{ ...th, textAlign: "right" }}>Раз</th>
                  <th style={{ ...th, textAlign: "right" }}>👍 / 👎</th>
                </tr>
              </thead>
              <tbody>
                {data.top_templates.map((t) => (
                  <tr key={t.template} style={tblRow}>
                    <td style={td}>
                      <div style={{ fontSize: 12.5, fontWeight: 500 }}>{t.title || t.template}</div>
                      <div style={{ fontSize: 10.5, color: "var(--text-tertiary)" }}>{t.category}</div>
                    </td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{t.uses}</td>
                    <td style={{ ...td, textAlign: "right", fontSize: 11 }}>
                      <span style={{ color: "var(--success)" }}>{t.good}</span>
                      {" / "}
                      <span style={{ color: "var(--danger)" }}>{t.bad}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* No-template queries */}
        <div style={card}>
          <h3 style={cardTitle}>Запросы без шаблона (нужны новые)</h3>
          {data.no_template_queries.length === 0 ? (
            <Empty>Все запросы нашли шаблон 🎉</Empty>
          ) : (
            <table style={tbl}>
              <thead>
                <tr style={tblHead}>
                  <th style={th}>Запрос</th>
                  <th style={{ ...th, textAlign: "right" }}>Раз</th>
                </tr>
              </thead>
              <tbody>
                {data.no_template_queries.map((q, i) => (
                  <tr key={i} style={tblRow}>
                    <td style={{ ...td, fontSize: 12, color: "var(--text-secondary)" }}>{q.description}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "var(--warning)" }}>{q.uses}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 18 }}>
        {/* By user */}
        <div style={card}>
          <h3 style={cardTitle}>Активность пользователей</h3>
          {data.by_user.length === 0 ? (
            <Empty>Нет активности</Empty>
          ) : (
            <table style={tbl}>
              <tbody>
                {data.by_user.map((u) => (
                  <tr key={u.user_email} style={tblRow}>
                    <td style={td}>{u.user_email}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{u.cnt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent */}
        <div style={card}>
          <h3 style={cardTitle}>Последние декомпозиции</h3>
          {data.recent.length === 0 ? (
            <Empty>Нет записей</Empty>
          ) : (
            <table style={tbl}>
              <thead>
                <tr style={tblHead}>
                  <th style={th}>Описание</th>
                  <th style={th}>Источник</th>
                  <th style={th}>Оценка</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((r) => (
                  <tr key={r.name} style={tblRow}>
                    <td style={{ ...td, fontSize: 11.5 }}>
                      <div>{r.description}</div>
                      <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                        {r.template_used || "—"}
                      </div>
                    </td>
                    <td style={{ ...td, fontSize: 10.5 }}>
                      <span style={{
                        padding: "2px 7px", borderRadius: 4,
                        background: r.source?.startsWith("Шаблон") ? "rgba(34,197,94,0.15)" : "rgba(168,139,250,0.15)",
                        color: r.source?.startsWith("Шаблон") ? "var(--success)" : "#a78bfa",
                      }}>{r.source}</span>
                    </td>
                    <td style={{ ...td, fontSize: 13, textAlign: "center" }}>
                      {r.rating ? r.rating.split(" ")[0] : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
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
      {sub && (
        <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", marginTop: 4 }}>
          {sub}
        </div>
      )}
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
