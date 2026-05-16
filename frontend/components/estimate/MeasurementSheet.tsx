"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/Toast";

interface MeasureRow {
  item_name: string;
  unit: string;
  length: number;
  width: number;
  height: number;
  count: number;
  formula_type: "L×W" | "L×W×H" | "L×W×n" | "L×W×H×n" | "L×n" | "manual";
  manual_total: number;
  notes: string;
}

interface Props {
  estimate: string;
  onApplied: () => void;
}

const STORAGE_KEY_PREFIX = "olimp-measurements-";

const UNITS = ["м²", "м³", "м", "пог.м", "т", "шт", "кг", "л"];

function makeEmptyRow(): MeasureRow {
  return {
    item_name: "", unit: "м²", length: 0, width: 0, height: 0, count: 1,
    formula_type: "L×W", manual_total: 0, notes: "",
  };
}

function computeTotal(r: MeasureRow): number {
  switch (r.formula_type) {
    case "L×W":    return (r.length || 0) * (r.width || 0);
    case "L×W×H":  return (r.length || 0) * (r.width || 0) * (r.height || 0);
    case "L×W×n":  return (r.length || 0) * (r.width || 0) * (r.count || 1);
    case "L×W×H×n":return (r.length || 0) * (r.width || 0) * (r.height || 0) * (r.count || 1);
    case "L×n":    return (r.length || 0) * (r.count || 1);
    case "manual": return r.manual_total || 0;
  }
}

function formatFormula(r: MeasureRow): string {
  const t = computeTotal(r);
  const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/\.?0+$/, ""));
  switch (r.formula_type) {
    case "L×W":    return `${fmt(r.length)} × ${fmt(r.width)} = ${fmt(t)}`;
    case "L×W×H":  return `${fmt(r.length)} × ${fmt(r.width)} × ${fmt(r.height)} = ${fmt(t)}`;
    case "L×W×n":  return `${fmt(r.length)} × ${fmt(r.width)} × ${fmt(r.count)} = ${fmt(t)}`;
    case "L×W×H×n":return `${fmt(r.length)} × ${fmt(r.width)} × ${fmt(r.height)} × ${fmt(r.count)} = ${fmt(t)}`;
    case "L×n":    return `${fmt(r.length)} × ${fmt(r.count)} = ${fmt(t)}`;
    case "manual": return `вручную: ${fmt(t)}`;
  }
}

export function MeasurementSheet({ estimate, onApplied }: Props) {
  const toast = useToast();
  const [rows, setRows] = useState<MeasureRow[]>([]);
  const [applying, setApplying] = useState(false);

  // Load from localStorage (per-estimate)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PREFIX + estimate);
      if (raw) setRows(JSON.parse(raw));
      else setRows([makeEmptyRow()]);
    } catch {
      setRows([makeEmptyRow()]);
    }
  }, [estimate]);

  // Auto-save to localStorage
  useEffect(() => {
    if (rows.length === 0) return;
    try {
      localStorage.setItem(STORAGE_KEY_PREFIX + estimate, JSON.stringify(rows));
    } catch {}
  }, [rows, estimate]);

  const totals = useMemo(() => {
    const byUnit: Record<string, number> = {};
    let count = 0;
    for (const r of rows) {
      if (!r.item_name.trim()) continue;
      const t = computeTotal(r);
      if (t <= 0) continue;
      byUnit[r.unit] = (byUnit[r.unit] || 0) + t;
      count++;
    }
    return { byUnit, count };
  }, [rows]);

  function updateRow(idx: number, patch: Partial<MeasureRow>) {
    setRows(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows([...rows, makeEmptyRow()]);
  }
  function removeRow(idx: number) {
    if (rows.length === 1) {
      setRows([makeEmptyRow()]);
      return;
    }
    setRows(rows.filter((_, i) => i !== idx));
  }
  function clearAll() {
    if (!window.confirm(`Очистить все ${rows.length} обмерных позиций?`)) return;
    setRows([makeEmptyRow()]);
    localStorage.removeItem(STORAGE_KEY_PREFIX + estimate);
  }

  async function applyToEstimate() {
    const valid = rows.filter((r) => r.item_name.trim() && computeTotal(r) > 0);
    if (valid.length === 0) { toast.warn("Нет валидных строк (item_name + total > 0)"); return; }
    if (!window.confirm(`Добавить ${valid.length} позиций в смету ${estimate}?`)) return;

    setApplying(true);
    try {
      const payloadRows = valid.map((r) => ({
        item_name: r.item_name,
        unit: r.unit,
        length: r.length, width: r.width, height: r.height,
        count: r.count,
        formula: formatFormula(r),
        total: computeTotal(r),
        notes: r.notes,
      }));
      const res = await fetch(`/api/estimates/${encodeURIComponent(estimate)}/grid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apply_measurements", rows: payloadRows }),
      });
      const d = await res.json();
      if (d.error) { toast.error(d.error); return; }
      toast.success(`Добавлено ${d.added} позиций в смету`);
      onApplied();
    } finally { setApplying(false); }
  }

  return (
    <div>
      <div style={{
        padding: "10px 14px", marginBottom: 10, borderRadius: 8,
        background: "rgba(96,165,250,0.05)", border: "1px solid rgba(96,165,250,0.3)",
        fontSize: 12, color: "var(--text-secondary)",
      }}>
        📐 <b>Обмерный лист.</b> Заполни длину/ширину/высоту/количество — формула посчитает объём.
        Сохраняется локально в браузере. Кнопка «✓ Применить» создаёт позиции в смете (без цены — добавишь
        потом через «⊞ + Сборка» или вручную).
      </div>

      {/* Totals summary */}
      {totals.count > 0 && (
        <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
          {Object.entries(totals.byUnit).map(([unit, sum]) => (
            <div key={unit} style={{
              padding: "8px 12px", borderRadius: 7,
              background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
              fontFamily: "monospace", fontSize: 12,
            }}>
              <span style={{ color: "var(--text-tertiary)" }}>Σ {unit}: </span>
              <b style={{ color: "var(--success)" }}>
                {Number.isInteger(sum) ? sum : sum.toFixed(2)}
              </b>
            </div>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <button onClick={clearAll} style={{
              padding: "6px 12px", fontSize: 12,
              background: "transparent", color: "var(--danger)",
              border: "1px solid var(--border-subtle)", borderRadius: 6, cursor: "pointer",
            }}>🗑 Очистить</button>
            <button onClick={applyToEstimate} disabled={applying} style={{
              padding: "6px 14px", fontSize: 12, fontWeight: 500,
              background: "var(--accent)", color: "white",
              border: "none", borderRadius: 6, cursor: "pointer",
              opacity: applying ? 0.6 : 1,
            }}>{applying ? "..." : `✓ Применить в смету (${totals.count})`}</button>
          </div>
        </div>
      )}

      {/* Rows table */}
      <div style={{
        background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
        borderRadius: 8, overflow: "auto",
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: "var(--bg-base)", borderBottom: "1px solid var(--border-subtle)" }}>
              <th style={{ ...th, width: 35 }}>№</th>
              <th style={{ ...th, minWidth: 200 }}>Что обмеряем</th>
              <th style={{ ...th, width: 70 }}>Ед.</th>
              <th style={{ ...th, width: 110 }}>Формула</th>
              <th style={{ ...th, width: 75, textAlign: "right" }}>Длина</th>
              <th style={{ ...th, width: 75, textAlign: "right" }}>Ширина</th>
              <th style={{ ...th, width: 75, textAlign: "right" }}>Высота</th>
              <th style={{ ...th, width: 60, textAlign: "right" }}>n</th>
              <th style={{ ...th, width: 130, textAlign: "right" }}>Итого</th>
              <th style={{ ...th, width: 35 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const total = computeTotal(r);
              const isManual = r.formula_type === "manual";
              return (
                <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <td style={{ ...td, color: "var(--text-tertiary)", fontFamily: "monospace", fontSize: 11 }}>{i + 1}</td>
                  <td style={td}>
                    <input value={r.item_name} onChange={(e) => updateRow(i, { item_name: e.target.value })}
                           placeholder="Фундаментная плита / Стена / Перекрытие..."
                           style={inpCell} />
                  </td>
                  <td style={td}>
                    <select value={r.unit} onChange={(e) => updateRow(i, { unit: e.target.value })}
                            style={{ ...inpCell, textAlign: "center" }}>
                      {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </td>
                  <td style={td}>
                    <select value={r.formula_type}
                            onChange={(e) => updateRow(i, { formula_type: e.target.value as MeasureRow["formula_type"] })}
                            style={{ ...inpCell, fontSize: 11, fontFamily: "monospace" }}>
                      <option value="L×W">L × W</option>
                      <option value="L×W×H">L × W × H</option>
                      <option value="L×W×n">L × W × n</option>
                      <option value="L×W×H×n">L × W × H × n</option>
                      <option value="L×n">L × n</option>
                      <option value="manual">Вручную</option>
                    </select>
                  </td>
                  <td style={td}>
                    <input type="number" min={0} step={0.01} value={r.length || ""}
                           onChange={(e) => updateRow(i, { length: parseFloat(e.target.value) || 0 })}
                           disabled={isManual}
                           style={{ ...inpCell, textAlign: "right", fontFamily: "monospace",
                                    opacity: isManual ? 0.4 : 1 }} />
                  </td>
                  <td style={td}>
                    <input type="number" min={0} step={0.01} value={r.width || ""}
                           onChange={(e) => updateRow(i, { width: parseFloat(e.target.value) || 0 })}
                           disabled={isManual || r.formula_type === "L×n"}
                           style={{ ...inpCell, textAlign: "right", fontFamily: "monospace",
                                    opacity: isManual || r.formula_type === "L×n" ? 0.4 : 1 }} />
                  </td>
                  <td style={td}>
                    <input type="number" min={0} step={0.01} value={r.height || ""}
                           onChange={(e) => updateRow(i, { height: parseFloat(e.target.value) || 0 })}
                           disabled={isManual || !r.formula_type.includes("H")}
                           style={{ ...inpCell, textAlign: "right", fontFamily: "monospace",
                                    opacity: isManual || !r.formula_type.includes("H") ? 0.4 : 1 }} />
                  </td>
                  <td style={td}>
                    <input type="number" min={1} step={1} value={r.count || ""}
                           onChange={(e) => updateRow(i, { count: parseInt(e.target.value) || 0 })}
                           disabled={isManual || !r.formula_type.includes("n")}
                           style={{ ...inpCell, textAlign: "right", fontFamily: "monospace",
                                    opacity: isManual || !r.formula_type.includes("n") ? 0.4 : 1 }} />
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>
                    {isManual ? (
                      <input type="number" min={0} step={0.01} value={r.manual_total || ""}
                             onChange={(e) => updateRow(i, { manual_total: parseFloat(e.target.value) || 0 })}
                             style={{ ...inpCell, textAlign: "right", fontFamily: "monospace",
                                      fontWeight: 600, color: "var(--success)" }} />
                    ) : (
                      <div style={{ padding: "5px 7px", fontFamily: "monospace", fontWeight: 600,
                                    color: total > 0 ? "var(--success)" : "var(--text-tertiary)" }}>
                        {total > 0
                          ? `${Number.isInteger(total) ? total : total.toFixed(3).replace(/\.?0+$/, "")} ${r.unit}`
                          : "—"}
                      </div>
                    )}
                  </td>
                  <td style={td}>
                    <button onClick={() => removeRow(i)} title="Удалить" style={{
                      background: "transparent", border: "none", color: "var(--danger)",
                      cursor: "pointer", fontSize: 14, padding: "2px 4px",
                    }}>×</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
        <button onClick={addRow} style={{
          padding: "6px 14px", fontSize: 12, fontWeight: 500,
          background: "transparent", color: "var(--accent)",
          border: "1px dashed var(--accent)", borderRadius: 6, cursor: "pointer",
        }}>+ Строка обмера</button>

        <div style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-tertiary)", alignSelf: "center", fontFamily: "monospace" }}>
          💾 Авто-сохранение в браузере · Очистка не трогает смету
        </div>
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: "8px 8px", textAlign: "left", fontSize: 11, fontWeight: 500,
  color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em",
};
const td: React.CSSProperties = { padding: "4px 6px", color: "var(--text-primary)" };
const inpCell: React.CSSProperties = {
  width: "100%", padding: "5px 7px", fontSize: 12,
  background: "transparent", color: "var(--text-primary)",
  border: "1px solid transparent", borderRadius: 4, outline: "none",
};
