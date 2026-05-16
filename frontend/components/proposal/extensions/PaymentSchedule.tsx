"use client";

import { Node } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";

/** Кастомный блок графика оплаты для КП.
 *
 * Хранит rows: [{stage, percent, days_after, amount?}], currency.
 * JSON-форма: { type: "paymentSchedule", attrs: { rows: [...], currency: "RUB" } }
 */
export const PaymentScheduleNode = Node.create({
  name: "paymentSchedule",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      rows: { default: [] },
      currency: { default: "RUB" },
      total_amount: { default: 0 },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-payment-schedule]" }];
  },

  renderHTML() {
    return ["div", { "data-payment-schedule": "true" }];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PaymentScheduleView);
  },
});

interface PaymentRow {
  stage: string;
  percent: number;
  days_after: number;
}

function PaymentScheduleView({ node, updateAttributes, editor }: ReactNodeViewProps) {
  const rows: PaymentRow[] = (node.attrs.rows || []) as PaymentRow[];
  const totalAmount = Number(node.attrs.total_amount || 0);
  const isEditable = editor.isEditable;

  // Auto-pickup amount from merge data
  let baseAmount = totalAmount;
  if (typeof window !== "undefined" && !baseAmount) {
    const md = (window as unknown as { __mergeData?: Record<string, Record<string, unknown>> }).__mergeData;
    const v = md?.proposal?.total_amount;
    if (typeof v === "number" && v > 0) baseAmount = v;
  }

  const sum = rows.reduce((s, r) => s + (r.percent || 0), 0);
  const isOk = Math.abs(sum - 100) < 0.01;

  function updateRow(idx: number, patch: Partial<PaymentRow>) {
    const next = rows.map((r, i) => i === idx ? { ...r, ...patch } : r);
    updateAttributes({ rows: next });
  }
  function addRow() {
    updateAttributes({
      rows: [...rows, { stage: "Новый этап", percent: 0, days_after: 0 }],
    });
  }
  function removeRow(idx: number) {
    updateAttributes({ rows: rows.filter((_, i) => i !== idx) });
  }

  function fmtMoney(v: number) {
    return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(v);
  }

  return (
    <NodeViewWrapper>
      <div style={{
        margin: "16px 0", padding: 12, borderRadius: 10,
        background: "rgba(96,165,250,0.05)",
        border: "1px solid rgba(96,165,250,0.3)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: "#3b82f6", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: "monospace" }}>
            ₽ График оплаты
          </div>
          {!isOk && (
            <div style={{ fontSize: 11, color: "var(--danger)" }}>
              Сумма процентов: {sum.toFixed(1)}% (должна быть 100%)
            </div>
          )}
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(96,165,250,0.3)" }}>
              <th style={th}>Этап</th>
              <th style={{ ...th, textAlign: "right", width: 80 }}>%</th>
              <th style={{ ...th, textAlign: "right", width: 120 }}>Срок (дни)</th>
              <th style={{ ...th, textAlign: "right", width: 130 }}>Сумма</th>
              {isEditable && <th style={{ ...th, width: 30 }}></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderBottom: "1px solid rgba(96,165,250,0.15)" }}>
                <td style={td}>
                  {isEditable ? (
                    <input value={r.stage} onChange={(e) => updateRow(i, { stage: e.target.value })}
                           style={inp} />
                  ) : r.stage}
                </td>
                <td style={{ ...td, textAlign: "right" }}>
                  {isEditable ? (
                    <input type="number" min={0} max={100} step={0.1} value={r.percent}
                           onChange={(e) => updateRow(i, { percent: parseFloat(e.target.value) || 0 })}
                           style={{ ...inp, textAlign: "right", width: 60 }} />
                  ) : `${r.percent}%`}
                </td>
                <td style={{ ...td, textAlign: "right" }}>
                  {isEditable ? (
                    <input type="number" min={0} value={r.days_after}
                           onChange={(e) => updateRow(i, { days_after: parseInt(e.target.value) || 0 })}
                           style={{ ...inp, textAlign: "right", width: 80 }} />
                  ) : (r.days_after === 0 ? "при подписании" : `+${r.days_after} дн.`)}
                </td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 500 }}>
                  {baseAmount > 0 ? `${fmtMoney(baseAmount * r.percent / 100)} ₽` : "—"}
                </td>
                {isEditable && (
                  <td style={td}>
                    <button onClick={() => removeRow(i)}
                            style={{ background: "transparent", border: "none", color: "var(--danger)",
                                     cursor: "pointer", fontSize: 14 }}>×</button>
                  </td>
                )}
              </tr>
            ))}
            <tr style={{ borderTop: "2px solid rgba(96,165,250,0.5)" }}>
              <td style={{ ...td, fontWeight: 600 }}>ИТОГО</td>
              <td style={{ ...td, textAlign: "right", fontWeight: 600,
                            color: isOk ? "var(--success)" : "var(--danger)" }}>
                {sum.toFixed(1)}%
              </td>
              <td></td>
              <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>
                {baseAmount > 0 ? `${fmtMoney(baseAmount)} ₽` : "—"}
              </td>
              {isEditable && <td></td>}
            </tr>
          </tbody>
        </table>

        {isEditable && (
          <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button onClick={addRow} style={{
              padding: "5px 12px", fontSize: 12,
              background: "transparent", color: "#3b82f6",
              border: "1px dashed #3b82f6", borderRadius: 6, cursor: "pointer",
            }}>+ Добавить этап</button>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
              Базовая сумма берётся из «Сумма КП» проекта
            </div>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

const th: React.CSSProperties = {
  padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 500,
  color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em",
};
const td: React.CSSProperties = { padding: "8px 10px", color: "var(--text-primary)" };
const inp: React.CSSProperties = {
  width: "100%", padding: "4px 8px", fontSize: 12.5,
  background: "var(--bg-base)", color: "var(--text-primary)",
  border: "1px solid var(--border-subtle)", borderRadius: 5, outline: "none",
};
