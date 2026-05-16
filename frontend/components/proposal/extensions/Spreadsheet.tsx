"use client";

import { Node } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import dynamic from "next/dynamic";
import { useState } from "react";

/** Spreadsheet-блок на Univer — встраиваемый Excel-like редактор внутри КП.
 *
 * Хранит snapshot в node.attrs.snapshot.
 * JSON-форма:
 *   { type: "spreadsheet", attrs: { snapshot: {...Univer workbook snapshot...}, title: "..." } }
 *
 * Univer требует Canvas + Web Workers — рендерим только client-side через dynamic.
 */
export const SpreadsheetNode = Node.create({
  name: "spreadsheet",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      snapshot: { default: null },
      title: { default: "Калькуляция" },
      height: { default: 360 },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-spreadsheet]" }];
  },

  renderHTML() {
    return ["div", { "data-spreadsheet": "true" }];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SpreadsheetView);
  },
});

// Univer лениво — отдельный компонент с ssr:false
const UniverSheet = dynamic(
  () => import("./UniverSheet").then((m) => m.UniverSheet),
  { ssr: false, loading: () => (
    <div style={{
      height: 360, display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg-elevated)", color: "var(--text-tertiary)", borderRadius: 8,
      border: "1px dashed var(--border-subtle)", fontSize: 12, fontFamily: "monospace",
    }}>
      Загрузка Univer Sheets…
    </div>
  )},
);

function SpreadsheetView({ node, updateAttributes, editor }: ReactNodeViewProps) {
  const snapshot = node.attrs.snapshot;
  const title: string = node.attrs.title || "Калькуляция";
  const height: number = node.attrs.height || 360;
  const isEditable = editor.isEditable;
  const [showSettings, setShowSettings] = useState(false);

  return (
    <NodeViewWrapper>
      <div style={{
        margin: "18px 0", padding: 10, borderRadius: 10,
        background: "rgba(167,139,250,0.04)",
        border: "1px solid rgba(167,139,250,0.3)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between",
                      alignItems: "center", marginBottom: 8 }}>
          {isEditable && !showSettings ? (
            <input value={title}
                   onChange={(e) => updateAttributes({ title: e.target.value })}
                   style={{
                     fontSize: 13, fontWeight: 600, color: "#7c3aed",
                     background: "transparent", border: "none",
                     padding: "2px 4px", outline: "none", flex: 1,
                     fontFamily: "monospace", letterSpacing: "0.04em",
                     textTransform: "uppercase",
                   }} />
          ) : (
            <div style={{ fontSize: 11, color: "#7c3aed", fontWeight: 600,
                          textTransform: "uppercase", letterSpacing: "0.04em",
                          fontFamily: "monospace" }}>
              ⊞ {title}
            </div>
          )}
          {isEditable && (
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setShowSettings(!showSettings)}
                      style={btnStyle()} title="Настройки">⚙</button>
            </div>
          )}
        </div>

        {showSettings && isEditable && (
          <div style={{
            padding: 10, marginBottom: 8, borderRadius: 6,
            background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
            fontSize: 12, display: "flex", gap: 12, alignItems: "center",
          }}>
            <label>Высота:</label>
            <input type="number" min={200} max={800} step={20} value={height}
                   onChange={(e) => updateAttributes({ height: parseInt(e.target.value) || 360 })}
                   style={{ width: 80, padding: "4px 8px", fontSize: 12 }} />
            <button onClick={() => setShowSettings(false)} style={btnStyle()}>Закрыть</button>
          </div>
        )}

        <div style={{ height, borderRadius: 8, overflow: "hidden",
                      background: "white", border: "1px solid var(--border-subtle)" }}>
          <UniverSheet
            initialSnapshot={snapshot}
            readOnly={!isEditable}
            onChange={(snap: unknown) => updateAttributes({ snapshot: snap })}
            height={height}
          />
        </div>

        {isEditable && (
          <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-tertiary)" }}>
            💡 Формулы как в Excel: =SUM(A1:A5), =B1*1.2, =IF(C2&gt;100; "много"; "ок")
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

function btnStyle(): React.CSSProperties {
  return {
    padding: "3px 8px", fontSize: 11, fontWeight: 500,
    background: "transparent", color: "var(--text-secondary)",
    border: "1px solid var(--border-subtle)", borderRadius: 5,
    cursor: "pointer", fontFamily: "monospace",
  };
}
