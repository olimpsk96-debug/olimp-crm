"use client";

import { useEffect, useRef } from "react";
import { createUniver, defaultTheme, LocaleType, merge, UniverInstanceType } from "@univerjs/presets";
import { UniverSheetsCorePreset } from "@univerjs/preset-sheets-core";
import sheetsCoreRu from "@univerjs/preset-sheets-core/locales/ru-RU";

import "@univerjs/preset-sheets-core/lib/index.css";

interface Props {
  initialSnapshot: object | null;
  readOnly?: boolean;
  onChange?: (snapshot: object) => void;
  height?: number;
}

/** Тонкая обёртка над Univer Sheets. Используется через NodeView в TipTap.
 *
 * Подводные камни:
 * - Требует window + canvas, поэтому импортируется через dynamic ssr:false
 * - При каждом mount создаём новый Univer instance — disposed в cleanup
 * - Snapshot сохраняем дебаунсированно при изменениях
 */
export function UniverSheet({ initialSnapshot, readOnly, onChange, height = 360 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const univerRef = useRef<{ univer: { dispose: () => void } } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const instance = createUniver({
      locale: LocaleType.RU_RU,
      locales: {
        [LocaleType.RU_RU]: merge({}, sheetsCoreRu),
      },
      theme: defaultTheme,
      presets: [
        UniverSheetsCorePreset({
          container: containerRef.current,
          header: true,
          toolbar: true,
          formulaBar: true,
          footer: false,
        }),
      ],
    });

    univerRef.current = instance as { univer: { dispose: () => void } };

    // Создаём workbook из snapshot или пустой
    const api = (instance as unknown as { univerAPI: {
      createWorkbook: (snap: object | null) => unknown;
      getActiveWorkbook: () => unknown;
    } }).univerAPI;

    const snapshot = initialSnapshot || {
      id: `wb_${Date.now()}`,
      sheetOrder: ["sheet1"],
      name: "Калькуляция",
      appVersion: "3.0.0",
      locale: LocaleType.RU_RU,
      styles: {},
      sheets: {
        sheet1: {
          id: "sheet1",
          name: "Лист 1",
          tabColor: "",
          hidden: 0,
          rowCount: 50,
          columnCount: 12,
          zoomRatio: 1,
          freeze: { startRow: -1, startColumn: -1, ySplit: 0, xSplit: 0 },
          scrollTop: 0,
          scrollLeft: 0,
          defaultColumnWidth: 88,
          defaultRowHeight: 24,
          mergeData: [],
          cellData: {
            "0": {
              "0": { v: "Наименование" },
              "1": { v: "Ед." },
              "2": { v: "Кол-во" },
              "3": { v: "Цена" },
              "4": { v: "Сумма", f: "=C2*D2" },
            },
            "1": {
              "0": { v: "Пример работы" },
              "1": { v: "м²" },
              "2": { v: 100 },
              "3": { v: 1500 },
              "4": { f: "=C2*D2" },
            },
          },
          rowData: {},
          columnData: {},
          showGridlines: 1,
          rowHeader: { width: 46, hidden: 0 },
          columnHeader: { height: 20, hidden: 0 },
          selections: ["A1"],
          rightToLeft: 0,
        },
      },
      resources: [],
    };

    try {
      api.createWorkbook(snapshot);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("Univer createWorkbook failed:", e);
    }

    // Сохранение snapshot при изменениях (debounced)
    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleSave = () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        if (!onChange) return;
        try {
          const wb = api.getActiveWorkbook() as {
            save: () => object;
          } | null;
          if (wb && typeof wb.save === "function") {
            const snap = wb.save();
            onChange(snap);
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn("Univer save snapshot failed:", e);
        }
      }, 800);
    };

    // Подписка на изменения (workbook command commit)
    try {
      const apiAny = api as unknown as {
        addEvent: (event: string, fn: () => void) => unknown;
        Event?: Record<string, string>;
      };
      if (apiAny.addEvent && apiAny.Event?.CommandExecuted) {
        apiAny.addEvent(apiAny.Event.CommandExecuted, scheduleSave);
      }
    } catch {
      // event API недоступен — пропускаем
    }

    return () => {
      if (saveTimer) clearTimeout(saveTimer);
      try {
        univerRef.current?.univer.dispose();
      } catch {
        // ignore
      }
      univerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height, position: "relative" }}
    />
  );
}
