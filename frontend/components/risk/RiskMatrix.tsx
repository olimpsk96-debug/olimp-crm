"use client";

import type { MatrixCell } from "@/types/risk";

const PROB_LABELS = ["Очень низкая", "Низкая", "Средняя", "Высокая", "Очень высокая"];
const IMP_LABELS = ["Минимальное", "Низкое", "Среднее", "Высокое", "Критическое"];

/**
 * Цвет ячейки по score (P × I, 1..25):
 *  - score ≥ 15 — красная зона
 *  - 8 ≤ score < 15 — жёлтая
 *  - score < 8 — зелёная
 * Прозрачность увеличивается с количеством рисков в ячейке.
 */
function cellStyle(score: number, count: number): React.CSSProperties {
  const zoneBg = score >= 15 ? "248,113,113" : score >= 8 ? "251,191,36" : "34,197,94";
  const baseAlpha = 0.07;
  const stepAlpha = 0.13;
  const alpha = count === 0 ? baseAlpha : Math.min(0.85, baseAlpha + stepAlpha * count);
  return {
    background: `rgba(${zoneBg}, ${alpha})`,
    border: `1px solid rgba(${zoneBg}, ${count > 0 ? 0.5 : 0.2})`,
  };
}

export default function RiskMatrix({
  cells,
  onCellClick,
}: {
  cells: MatrixCell[];
  onCellClick?: (cell: MatrixCell) => void;
}) {
  // cells приходят как 25 элементов (5×5), упорядочены: p=1..5 × i=1..5
  // Для отображения: ось Y = Probability (вверху ВЫСОКАЯ, чтобы критические были вверху-справа)
  //                   ось X = Impact (слева MIN → справа CRITICAL)
  // Так что рендерим строки от p=5 (top) до p=1 (bottom).

  const byKey = new Map<string, MatrixCell>();
  for (const c of cells) byKey.set(`${c.p}-${c.i}`, c);

  return (
    <div style={{
      background: "var(--bg-elevated)",
      border: "1px solid var(--border-subtle)",
      borderRadius: 12,
      padding: 20,
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "flex-end",
        marginBottom: 12, gap: 12,
      }}>
        <h3 style={{ fontSize: 13, fontWeight: 500, margin: 0, color: "var(--text-primary)" }}>
          Матрица рисков 5×5
        </h3>
        <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--text-tertiary)" }}>
          <LegendDot color="rgba(34,197,94,0.5)" label="Зелёная (< 8)" />
          <LegendDot color="rgba(251,191,36,0.55)" label="Жёлтая (8–14)" />
          <LegendDot color="rgba(248,113,113,0.55)" label="Красная (≥ 15)" />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "120px repeat(5, 1fr)", gap: 4 }}>
        {/* Header row: empty corner + impact labels */}
        <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center", display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 6, fontFamily: "monospace" }}>
          P × I
        </div>
        {IMP_LABELS.map((lbl, idx) => (
          <div key={idx} style={{
            fontSize: 10, color: "var(--text-tertiary)", textAlign: "center",
            padding: "4px 0", fontFamily: "monospace",
          }}>
            <div style={{ fontWeight: 600, color: "var(--text-secondary)" }}>{idx + 1}</div>
            <div style={{ fontSize: 9 }}>{lbl}</div>
          </div>
        ))}

        {/* Rows: probability from 5 (top) to 1 (bottom) */}
        {[5, 4, 3, 2, 1].map(p => (
          <div key={p} style={{ display: "contents" }}>
            {/* Probability label */}
            <div style={{
              fontSize: 10, color: "var(--text-tertiary)", textAlign: "right",
              padding: "0 8px", display: "flex", alignItems: "center", justifyContent: "flex-end",
              fontFamily: "monospace",
            }}>
              <span style={{ fontWeight: 600, color: "var(--text-secondary)", marginRight: 6 }}>{p}</span>
              <span style={{ fontSize: 10 }}>{PROB_LABELS[p - 1]}</span>
            </div>
            {/* 5 cells */}
            {[1, 2, 3, 4, 5].map(i => {
              const cell = byKey.get(`${p}-${i}`) || { p, i, score: p * i, count: 0, items: [] };
              const clickable = cell.count > 0 && !!onCellClick;
              return (
                <button
                  key={i}
                  onClick={() => clickable && onCellClick?.(cell)}
                  disabled={!clickable}
                  style={{
                    ...cellStyle(cell.score, cell.count),
                    height: 70, borderRadius: 8,
                    cursor: clickable ? "pointer" : "default",
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    fontSize: 12, color: "var(--text-primary)",
                    transition: "transform 0.1s ease",
                  }}
                  onMouseEnter={(e) => clickable && (e.currentTarget.style.transform = "scale(1.04)")}
                  onMouseLeave={(e) => clickable && (e.currentTarget.style.transform = "scale(1)")}
                >
                  <span style={{ fontSize: 22, fontWeight: 600, fontFamily: "monospace", lineHeight: 1 }}>
                    {cell.count > 0 ? cell.count : ""}
                  </span>
                  <span style={{ fontSize: 9, color: "var(--text-tertiary)", marginTop: 4, fontFamily: "monospace" }}>
                    балл {cell.score}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div style={{
        marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border-subtle)",
        fontSize: 11, color: "var(--text-tertiary)", lineHeight: 1.5,
      }}>
        <strong style={{ color: "var(--text-secondary)" }}>Ось Y — вероятность</strong> (вверху самая высокая) ·
        {" "}<strong style={{ color: "var(--text-secondary)" }}>Ось X — влияние</strong> (справа самое сильное).
        {" "}Кликни по ячейке с числом — увидишь список рисков.
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 10, height: 10, background: color, borderRadius: 2 }} />
      {label}
    </span>
  );
}
