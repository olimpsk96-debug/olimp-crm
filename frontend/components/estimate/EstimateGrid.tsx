"use client";

import { RevoGrid } from "@revolist/react-datagrid";
import { useEffect, useMemo, useRef } from "react";

interface GridRow {
  name?: string;
  idx?: number;
  is_section: number;
  section_title: string;
  item_code: string;
  item_name: string;
  unit: string;
  qty: number;
  base_unit_price: number;
  base_amount: number;
  our_unit_price: number;
  our_amount: number;
  deviation_pct?: number;
  work_type: string;
  notes: string;
  [key: string]: unknown;
}

interface Props {
  rows: GridRow[];
  onChange: (next: GridRow[]) => void;
}

/** RevoGrid Excel-like editor для смет.
 *  Inline edit, copy-paste, drag-resize колонок.
 *
 *  base_amount = qty × base_unit_price (auto-recalc)
 *  our_amount = qty × our_unit_price (auto-recalc)
 *  Маржа и итоги пересчитываются на бэке при сохранении.
 */
export function EstimateGrid({ rows, onChange }: Props) {
  const gridRef = useRef<HTMLRevoGridElement | null>(null);

  // Локальная нормализация — гарантируем что amounts соответствуют qty×price
  const source = useMemo(() => rows.map((r) => ({
    ...r,
    base_amount: (Number(r.qty) || 0) * (Number(r.base_unit_price) || 0),
    our_amount: (Number(r.qty) || 0) * (Number(r.our_unit_price) || 0),
  })), [rows]);

  const columns = useMemo<unknown[]>(() => [
    {
      prop: "idx", name: "№", size: 45, readonly: true, pin: "colPinStart" as const,
      cellTemplate: (h: unknown, p: { rowIndex: number; model: GridRow }) => {
        const isSect = Number(p.model.is_section || 0) === 1;
        return (h as (tag: string, p: object, content: unknown) => unknown)(
          "span",
          { style: { color: isSect ? "#7c3aed" : "#888", fontFamily: "monospace", fontSize: "11px" } },
          isSect ? "§" : String(p.rowIndex + 1),
        );
      },
    },
    {
      prop: "section_title", name: "Раздел", size: 200,
      cellProperties: (p: { model: GridRow }) => {
        const isSect = Number(p.model.is_section || 0) === 1;
        return isSect
          ? { style: { fontWeight: 600, color: "#7c3aed", background: "rgba(167,139,250,0.05)" } }
          : { style: { color: "#999" } };
      },
    },
    { prop: "item_code", name: "Код", size: 110 },
    {
      prop: "item_name", name: "Наименование", size: 320,
      cellProperties: () => ({ style: { fontWeight: 500 } }),
    },
    { prop: "unit", name: "Ед.", size: 70 },
    {
      prop: "qty", name: "Кол-во", size: 90,
      cellProperties: () => ({ style: { textAlign: "right", fontFamily: "monospace" } }),
    },
    {
      prop: "base_unit_price", name: "Цена база", size: 110,
      cellProperties: () => ({ style: { textAlign: "right", fontFamily: "monospace", color: "#666" } }),
    },
    {
      prop: "base_amount", name: "Сумма база", size: 120, readonly: true,
      cellProperties: () => ({ style: { textAlign: "right", fontFamily: "monospace", color: "#666", background: "#fafafa" } }),
      cellTemplate: (h: unknown, p: { model: GridRow }) => {
        const v = (Number(p.model.qty) || 0) * (Number(p.model.base_unit_price) || 0);
        return (h as (tag: string, p: object, content: unknown) => unknown)(
          "span", {}, v ? new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(v) : "—",
        );
      },
    },
    {
      prop: "our_unit_price", name: "Наша цена", size: 110,
      cellProperties: () => ({ style: { textAlign: "right", fontFamily: "monospace", fontWeight: 500 } }),
    },
    {
      prop: "our_amount", name: "Наша сумма", size: 130, readonly: true,
      cellProperties: () => ({ style: { textAlign: "right", fontFamily: "monospace", fontWeight: 600, background: "rgba(74,222,128,0.05)" } }),
      cellTemplate: (h: unknown, p: { model: GridRow }) => {
        const v = (Number(p.model.qty) || 0) * (Number(p.model.our_unit_price) || 0);
        return (h as (tag: string, p: object, content: unknown) => unknown)(
          "span", {}, v ? new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(v) : "—",
        );
      },
    },
    { prop: "work_type", name: "Тип работ", size: 130 },
    { prop: "notes", name: "Заметки", size: 200 },
  ], []);

  // Обработчик правок ячеек
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const handler = (evt: Event) => {
      const ce = evt as CustomEvent<{ prop: string; rowIndex: number; val: unknown }>;
      const { prop, rowIndex, val } = ce.detail;
      const next = source.map((r, i) => {
        if (i !== rowIndex) return r;
        const updated: GridRow = { ...r, [prop]: val };
        // Числовые поля приводим к числу
        if (["qty", "base_unit_price", "our_unit_price"].includes(prop)) {
          updated[prop] = Number(val) || 0;
        }
        if (["is_section"].includes(prop)) {
          updated.is_section = Number(val) ? 1 : 0;
        }
        // Пересчёт amounts
        updated.base_amount = (Number(updated.qty) || 0) * (Number(updated.base_unit_price) || 0);
        updated.our_amount = (Number(updated.qty) || 0) * (Number(updated.our_unit_price) || 0);
        return updated;
      });
      onChange(next);
    };
    el.addEventListener("aftereditapply" as keyof HTMLElementEventMap, handler);
    return () => {
      el.removeEventListener("aftereditapply" as keyof HTMLElementEventMap, handler);
    };
  }, [source, onChange]);

  function addRow(isSection = false) {
    const newRow: GridRow = {
      is_section: isSection ? 1 : 0,
      section_title: isSection ? "Новый раздел" : "",
      item_code: "", item_name: isSection ? "" : "Новая позиция",
      unit: "", qty: 0,
      base_unit_price: 0, base_amount: 0,
      our_unit_price: 0, our_amount: 0,
      work_type: "", notes: "",
    };
    onChange([...source, newRow]);
  }

  function removeSelected() {
    // RevoGrid selection API — пока упрощённо удаляем последнюю строку
    if (source.length === 0) return;
    if (!window.confirm(`Удалить последнюю строку? (полное управление выделением — в v6.2.1)`)) return;
    onChange(source.slice(0, -1));
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <button onClick={() => addRow(false)} style={btnGrid}>+ Строка</button>
        <button onClick={() => addRow(true)} style={{ ...btnGrid, borderColor: "#7c3aed", color: "#7c3aed" }}>
          + Раздел
        </button>
        <button onClick={removeSelected} style={{ ...btnGrid, color: "var(--danger)" }}>− Удалить</button>
        <div style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-tertiary)", alignSelf: "center", fontFamily: "monospace" }}>
          {source.length} строк · Ctrl+S — сохранить
        </div>
      </div>

      <div style={{
        height: "calc(100vh - 320px)", minHeight: 400,
        background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 8,
        overflow: "hidden",
      }}>
        <RevoGrid
          ref={gridRef}
          source={source}
          columns={columns as Parameters<typeof RevoGrid>[0]["columns"]}
          rowSize={32}
          range
          canFocus
          resize
          theme="compact"
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    </div>
  );
}

const btnGrid: React.CSSProperties = {
  padding: "6px 12px", fontSize: 12, fontWeight: 500,
  background: "var(--bg-elevated)", color: "var(--text-secondary)",
  border: "1px solid var(--border-subtle)", borderRadius: 6, cursor: "pointer",
};
