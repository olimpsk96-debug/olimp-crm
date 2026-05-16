"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { useCallback, useEffect } from "react";
import { MergeTagNode } from "./extensions/MergeTag";
import { PaymentScheduleNode } from "./extensions/PaymentSchedule";
import { SpreadsheetNode } from "./extensions/Spreadsheet";

interface Props {
  initialContent?: object | null;
  onChange: (json: object) => void;
  placeholder?: string;
  readOnly?: boolean;
  mergeData?: Record<string, Record<string, unknown>>;
}

export function ProposalEditor({
  initialContent, onChange, placeholder = "Начните писать КП…",
  readOnly = false, mergeData = {},
}: Props) {
  const editor = useEditor({
    immediatelyRender: false, // критично для Next.js App Router (SSR)
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Image.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder }),
      MergeTagNode,
      PaymentScheduleNode,
      SpreadsheetNode,
    ],
    content: initialContent || { type: "doc", content: [{ type: "paragraph" }] },
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON());
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm sm:prose-base max-w-none focus:outline-none min-h-[400px] p-6",
        style: "font-family: system-ui, -apple-system, sans-serif;",
      },
    },
  });

  // Резолвим merge-теги при render (read-only режим для preview)
  useEffect(() => {
    if (editor && Object.keys(mergeData).length > 0) {
      (window as unknown as { __mergeData?: typeof mergeData }).__mergeData = mergeData;
    }
  }, [editor, mergeData]);

  const insertTable = useCallback(() => {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  const insertMergeTag = useCallback((path: string) => {
    editor?.chain().focus().insertContent({
      type: "mergeTag", attrs: { path },
    }).run();
  }, [editor]);

  const insertSpreadsheet = useCallback(() => {
    editor?.chain().focus().insertContent({
      type: "spreadsheet",
      attrs: { snapshot: null, title: "Калькуляция", height: 360 },
    }).run();
  }, [editor]);

  const insertPaymentSchedule = useCallback(() => {
    editor?.chain().focus().insertContent({
      type: "paymentSchedule",
      attrs: {
        rows: [
          { stage: "Аванс при подписании", percent: 30, days_after: 0 },
          { stage: "Этап 1 — материалы", percent: 40, days_after: 14 },
          { stage: "Этап 2 — основные работы", percent: 25, days_after: 45 },
          { stage: "Финальный платёж", percent: 5, days_after: 90 },
        ],
        currency: "RUB",
      },
    }).run();
  }, [editor]);

  if (!editor) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>
      Инициализация редактора…
    </div>;
  }

  return (
    <div style={{
      background: "var(--bg-elevated)", borderRadius: 10,
      border: "1px solid var(--border-subtle)", overflow: "hidden",
    }}>
      {!readOnly && (
        <Toolbar editor={editor}
                 onInsertTable={insertTable}
                 onInsertMerge={insertMergeTag}
                 onInsertPayments={insertPaymentSchedule}
                 onInsertSpreadsheet={insertSpreadsheet} />
      )}
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor, onInsertTable, onInsertMerge, onInsertPayments, onInsertSpreadsheet }: {
  editor: ReturnType<typeof useEditor>;
  onInsertTable: () => void;
  onInsertMerge: (path: string) => void;
  onInsertPayments: () => void;
  onInsertSpreadsheet: () => void;
}) {
  if (!editor) return null;
  const btn = (active: boolean): React.CSSProperties => ({
    padding: "5px 10px", fontSize: 12, fontWeight: 500,
    background: active ? "var(--accent)" : "transparent",
    color: active ? "white" : "var(--text-secondary)",
    border: "1px solid var(--border-subtle)", borderRadius: 5,
    cursor: "pointer", fontFamily: "monospace",
  });
  const divider: React.CSSProperties = {
    width: 1, height: 20, background: "var(--border-subtle)", margin: "0 3px",
  };

  return (
    <div style={{
      padding: "8px 10px", display: "flex", gap: 4, flexWrap: "wrap",
      borderBottom: "1px solid var(--border-subtle)",
      background: "var(--bg-base)",
      alignItems: "center", position: "sticky", top: 0, zIndex: 5,
    }}>
      <button onClick={() => editor.chain().focus().toggleBold().run()}
              style={btn(editor.isActive("bold"))}>B</button>
      <button onClick={() => editor.chain().focus().toggleItalic().run()}
              style={{ ...btn(editor.isActive("italic")), fontStyle: "italic" }}>I</button>
      <button onClick={() => editor.chain().focus().toggleStrike().run()}
              style={{ ...btn(editor.isActive("strike")), textDecoration: "line-through" }}>S</button>

      <div style={divider} />

      <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              style={btn(editor.isActive("heading", { level: 1 }))}>H1</button>
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              style={btn(editor.isActive("heading", { level: 2 }))}>H2</button>
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              style={btn(editor.isActive("heading", { level: 3 }))}>H3</button>

      <div style={divider} />

      <button onClick={() => editor.chain().focus().toggleBulletList().run()}
              style={btn(editor.isActive("bulletList"))}>• Список</button>
      <button onClick={() => editor.chain().focus().toggleOrderedList().run()}
              style={btn(editor.isActive("orderedList"))}>1. Нумер.</button>
      <button onClick={() => editor.chain().focus().toggleBlockquote().run()}
              style={btn(editor.isActive("blockquote"))}>❝ Цитата</button>

      <div style={divider} />

      <button onClick={onInsertTable} style={btn(false)} title="Вставить таблицу">⊞ Таблица</button>
      <button onClick={onInsertSpreadsheet} style={{ ...btn(false), color: "#7c3aed", borderColor: "#7c3aed" }} title="Калькуляция (Excel-like с формулами)">⊞ Калькуляция</button>
      <button onClick={onInsertPayments} style={btn(false)} title="График оплаты">₽ График оплаты</button>

      <div style={divider} />

      <MergeTagDropdown onInsert={onInsertMerge} btnStyle={btn(false)} />

      <div style={divider} />

      <button onClick={() => editor.chain().focus().undo().run()}
              style={btn(false)} title="Отменить (Ctrl+Z)">↶</button>
      <button onClick={() => editor.chain().focus().redo().run()}
              style={btn(false)} title="Повторить (Ctrl+Y)">↷</button>
    </div>
  );
}

function MergeTagDropdown({ onInsert, btnStyle }: {
  onInsert: (path: string) => void;
  btnStyle: React.CSSProperties;
}) {
  const tags = [
    { path: "customer.name", label: "Имя клиента" },
    { path: "customer.inn", label: "ИНН клиента" },
    { path: "project.title", label: "Название проекта" },
    { path: "project.location", label: "Адрес объекта" },
    { path: "estimate.total", label: "Сумма сметы" },
    { path: "estimate.margin_pct", label: "Маржа %" },
    { path: "proposal.total_amount", label: "Сумма КП" },
    { path: "proposal.valid_until", label: "Действует до" },
    { path: "proposal.today", label: "Сегодняшняя дата" },
    { path: "company.name", label: "Наша компания" },
  ];
  return (
    <div style={{ position: "relative" }}>
      <select
        onChange={(e) => {
          if (e.target.value) {
            onInsert(e.target.value);
            e.target.value = "";
          }
        }}
        defaultValue=""
        style={{ ...btnStyle, paddingRight: 20 }}
      >
        <option value="">⚡ Вставить тег…</option>
        {tags.map((t) => (
          <option key={t.path} value={t.path}>{t.label} {`{{${t.path}}}`}</option>
        ))}
      </select>
    </div>
  );
}
