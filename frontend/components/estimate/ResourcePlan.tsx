"use client";

import { useEffect, useState } from "react";

interface Resource {
  description: string;
  unit: string;
  qty: number;
  rate: number;
  amount: number;
  from_items: string[];
}

interface Unmapped {
  item_name: string;
  qty: number;
  unit: string;
  amount: number;
}

interface ResourceBreakdown {
  estimate: string;
  material: Resource[];
  labor: Resource[];
  equipment: Resource[];
  subcontract: Resource[];
  unmapped: Unmapped[];
  totals: {
    material: number; labor: number; equipment: number;
    subcontract: number; unmapped: number; all: number;
  };
  counts: {
    material: number; labor: number; equipment: number;
    subcontract: number; unmapped: number;
  };
}

interface Props { estimate: string; }

function fmtMoney(v: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(v) + " ₽";
}
function fmtQty(v: number, unit: string): string {
  const n = Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, "");
  return `${n} ${unit}`;
}

export function ResourcePlan({ estimate }: Props) {
  const [data, setData] = useState<ResourceBreakdown | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/estimates/${encodeURIComponent(estimate)}/resources`)
      .then((r) => r.json())
      .then((d) => { if (!d.error) setData(d); })
      .finally(() => setLoading(false));
  }, [estimate]);

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Загрузка ресурсов…</div>;
  }
  if (!data) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Нет данных</div>;
  }

  const groups = [
    { key: "material", label: "Материалы", color: "#16a34a", icon: "📦", items: data.material },
    { key: "labor", label: "Трудозатраты", color: "#3b82f6", icon: "👷", items: data.labor },
    { key: "equipment", label: "Оборудование", color: "#a855f7", icon: "🚜", items: data.equipment },
    { key: "subcontract", label: "Субподряд", color: "#eab308", icon: "🤝", items: data.subcontract },
  ];

  return (
    <div>
      <div style={{
        padding: "10px 14px", marginBottom: 12, borderRadius: 8,
        background: "rgba(96,165,250,0.05)", border: "1px solid rgba(96,165,250,0.3)",
        fontSize: 12, color: "var(--text-secondary)",
      }}>
        📊 <b>Ресурсный план</b> — агрегация ресурсов из Construction Assembly, привязанных к позициям сметы.
        Чтобы увидеть полную разбивку, применяй сборки через «⊞ + Сборка» в Tab «Работы».
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 14 }}>
        {groups.map((g) => (
          <div key={g.key} style={{
            padding: 12, borderRadius: 9,
            background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
          }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>{g.icon}</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: g.color, fontFamily: "monospace" }}>
              {fmtMoney(data.totals[g.key as keyof typeof data.totals])}
            </div>
            <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", marginTop: 2, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {g.label} · {data.counts[g.key as keyof typeof data.counts]}
            </div>
          </div>
        ))}
        <div style={{
          padding: 12, borderRadius: 9,
          background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.3)",
        }}>
          <div style={{ fontSize: 18, marginBottom: 4 }}>❓</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--danger)", fontFamily: "monospace" }}>
            {fmtMoney(data.totals.unmapped)}
          </div>
          <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", marginTop: 2, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Без разбивки · {data.counts.unmapped}
          </div>
        </div>
      </div>

      {/* Grand total */}
      <div style={{
        padding: 14, marginBottom: 16, borderRadius: 10,
        background: "var(--bg-elevated)",
        border: "1px solid var(--accent)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Итого по разбивке
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "var(--accent)", fontFamily: "monospace" }}>
          {fmtMoney(data.totals.all)}
        </div>
      </div>

      {/* Resource groups */}
      {groups.map((g) => g.items.length > 0 && (
        <div key={g.key} style={{ marginBottom: 14 }}>
          <h3 style={{ fontSize: 13, fontWeight: 500, margin: "0 0 6px",
                       color: g.color, fontFamily: "monospace",
                       textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {g.icon} {g.label} ({g.items.length} позиций · {fmtMoney(data.totals[g.key as keyof typeof data.totals])})
          </h3>
          <div style={{
            background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
            borderRadius: 8, overflow: "hidden",
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "var(--bg-base)", borderBottom: "1px solid var(--border-subtle)" }}>
                  <th style={th}>Описание</th>
                  <th style={{ ...th, textAlign: "right", width: 110 }}>Кол-во</th>
                  <th style={{ ...th, textAlign: "right", width: 90 }}>Цена</th>
                  <th style={{ ...th, textAlign: "right", width: 130 }}>Сумма</th>
                  <th style={{ ...th, width: 200 }}>Из позиций</th>
                </tr>
              </thead>
              <tbody>
                {g.items.map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <td style={{ ...td, fontWeight: 500 }}>{r.description}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>
                      {fmtQty(r.qty, r.unit)}
                    </td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "var(--text-tertiary)" }}>
                      {fmtMoney(r.rate)}
                    </td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 600,
                                  color: g.color }}>
                      {fmtMoney(r.amount)}
                    </td>
                    <td style={{ ...td, fontSize: 11, color: "var(--text-tertiary)" }}>
                      {r.from_items.slice(0, 2).join(", ")}
                      {r.from_items.length > 2 && ` + ${r.from_items.length - 2}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Unmapped */}
      {data.unmapped.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <h3 style={{ fontSize: 13, fontWeight: 500, margin: "0 0 6px",
                       color: "var(--danger)", fontFamily: "monospace",
                       textTransform: "uppercase", letterSpacing: "0.04em" }}>
            ❓ Позиции без сборки ({data.unmapped.length} · {fmtMoney(data.totals.unmapped)})
          </h3>
          <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginBottom: 6 }}>
            Эти позиции не привязаны к Construction Assembly — невозможно разложить на ресурсы.
            Применяй «⊞ + Сборка» в Tab «Работы» чтобы получить разбивку.
          </div>
          <div style={{
            background: "var(--bg-elevated)", border: "1px solid rgba(248,113,113,0.3)",
            borderRadius: 8, overflow: "hidden",
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "var(--bg-base)", borderBottom: "1px solid var(--border-subtle)" }}>
                  <th style={th}>Позиция</th>
                  <th style={{ ...th, textAlign: "right", width: 110 }}>Кол-во</th>
                  <th style={{ ...th, textAlign: "right", width: 130 }}>Сумма</th>
                </tr>
              </thead>
              <tbody>
                {data.unmapped.map((u, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <td style={td}>{u.item_name}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>
                      {fmtQty(u.qty, u.unit)}
                    </td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 500 }}>
                      {fmtMoney(u.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = {
  padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 500,
  color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em",
};
const td: React.CSSProperties = { padding: "9px 10px", color: "var(--text-primary)" };
