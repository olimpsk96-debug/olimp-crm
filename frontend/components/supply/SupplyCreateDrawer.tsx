"use client";

import { useState } from "react";
import type { SupplyPriority } from "@/types/supply";

interface SupplyItemForm {
  item_name: string;
  specification: string;
  unit: string;
  qty: string;
  unit_price_estimated: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (name: string) => void;
}

const EMPTY_ITEM: SupplyItemForm = { item_name: "", specification: "", unit: "шт", qty: "", unit_price_estimated: "" };

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  borderRadius: 8,
  border: "1px solid var(--border-subtle)",
  background: "var(--bg-base)",
  color: "var(--text-primary)",
  fontSize: 12.5,
  outline: "none",
  boxSizing: "border-box",
};

export function SupplyCreateDrawer({ open, onClose, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<SupplyPriority>("Обычная");
  const [project, setProject] = useState("");
  const [requestedBy, setRequestedBy] = useState("");
  const [neededBy, setNeededBy] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<SupplyItemForm[]>([{ ...EMPTY_ITEM }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addItem() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, key: keyof SupplyItemForm, value: string) {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [key]: value } : item));
  }

  function handleClose() {
    setTitle(""); setPriority("Обычная"); setProject(""); setRequestedBy("");
    setNeededBy(""); setNotes(""); setItems([{ ...EMPTY_ITEM }]); setError(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Укажите название заявки"); return; }
    const validItems = items.filter((i) => i.item_name.trim());
    if (validItems.length === 0) { setError("Добавьте хотя бы одну позицию"); return; }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/supply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          status: "Черновик",
          priority,
          project: project.trim() || undefined,
          requested_by: requestedBy.trim() || undefined,
          needed_by_date: neededBy || undefined,
          notes: notes.trim() || undefined,
          items: validItems.map((i) => ({
            item_name: i.item_name.trim(),
            specification: i.specification.trim() || undefined,
            unit: i.unit.trim() || undefined,
            qty: i.qty ? parseFloat(i.qty) : undefined,
            unit_price_estimated: i.unit_price_estimated ? parseFloat(i.unit_price_estimated.replace(/\s/g, "")) : undefined,
          })),
        }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      if (data.created) {
        handleClose();
        onCreated(data.created);
      }
    } catch {
      setError("Ошибка соединения");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div
        onClick={handleClose}
        style={{
          position: "fixed", inset: 0, zIndex: 40,
          background: "rgba(0,0,0,0.45)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.25s ease",
          backdropFilter: "blur(2px)",
        }}
      />

      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: 560, zIndex: 50,
        background: "var(--bg-elevated)",
        borderLeft: "1px solid var(--border-subtle)",
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.3s cubic-bezier(0.16,1,0.3,1)",
        display: "flex", flexDirection: "column",
        overflowY: "auto",
      }}>
        {/* Шапка */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 500, letterSpacing: "-0.01em" }}>Новая заявка</h2>
              <p style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 2 }}>Статус «Черновик», отправьте после заполнения</p>
            </div>
            <button
              onClick={handleClose}
              style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid var(--border-subtle)", background: "transparent", color: "var(--text-tertiary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 3l10 10M13 3L3 13" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 32px", flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Название + приоритет */}
          <div>
            <Label text="Название" required />
            <input style={inputStyle} placeholder="Материалы для АКЗ объекта НПП Старт" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div>
              <Label text="Приоритет" />
              <select style={inputStyle} value={priority} onChange={(e) => setPriority(e.target.value as SupplyPriority)}>
                <option>Обычная</option>
                <option>Срочная</option>
                <option>Критическая</option>
              </select>
            </div>
            <div>
              <Label text="Нужно к" />
              <input style={inputStyle} type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} />
            </div>
            <div>
              <Label text="Запросил" />
              <input style={inputStyle} placeholder="Иванов И.И." value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} />
            </div>
          </div>

          <div>
            <Label text="Проект (имя в ERP)" />
            <input style={inputStyle} placeholder="PR-2026-..." value={project} onChange={(e) => setProject(e.target.value)} />
          </div>

          {/* Позиции */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <Label text="Позиции" required />
              <button
                type="button"
                onClick={addItem}
                style={{ fontSize: 11.5, padding: "2px 10px", borderRadius: 6, border: "1px solid var(--border-subtle)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}
              >
                + Добавить
              </button>
            </div>

            {/* Шапка таблицы */}
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) 80px 60px 80px 24px", gap: 6, marginBottom: 4, fontSize: 10, color: "var(--text-tertiary)", fontFamily: "monospace", textTransform: "uppercase" }}>
              <span>Наименование</span><span>Ед.</span><span>Кол-во</span><span>Цена ₽</span><span />
            </div>

            {items.map((item, idx) => (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) 80px 60px 80px 24px", gap: 6, marginBottom: 6 }}>
                <input
                  style={inputStyle}
                  placeholder="Грунт ВЛ-02"
                  value={item.item_name}
                  onChange={(e) => updateItem(idx, "item_name", e.target.value)}
                />
                <input style={inputStyle} placeholder="кг" value={item.unit} onChange={(e) => updateItem(idx, "unit", e.target.value)} />
                <input style={inputStyle} placeholder="500" value={item.qty} onChange={(e) => updateItem(idx, "qty", e.target.value)} inputMode="decimal" />
                <input style={inputStyle} placeholder="450" value={item.unit_price_estimated} onChange={(e) => updateItem(idx, "unit_price_estimated", e.target.value)} inputMode="decimal" />
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  style={{ width: 24, height: 32, display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: "transparent", color: "var(--text-tertiary)", cursor: "pointer" }}
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3l10 10M13 3L3 13" /></svg>
                </button>
              </div>
            ))}
          </div>

          <div>
            <Label text="Примечания" />
            <textarea
              style={{ ...inputStyle, resize: "vertical", minHeight: 60 }}
              placeholder="Дополнительные требования к материалам..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && (
            <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "var(--danger)", fontSize: 12.5 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            style={{
              marginTop: "auto",
              width: "100%", padding: "11px 0", borderRadius: 10, border: "none",
              background: saving ? "var(--border-subtle)" : "var(--accent)",
              color: saving ? "var(--text-tertiary)" : "white",
              fontSize: 13.5, fontWeight: 500, cursor: saving ? "wait" : "pointer",
            }}
          >
            {saving ? "Создание..." : "Создать заявку"}
          </button>
        </form>
      </div>
    </>
  );
}

function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <label style={{ display: "block", fontSize: 10.5, color: "var(--text-tertiary)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace" }}>
      {text}{required && <span style={{ color: "var(--danger)", marginLeft: 3 }}>*</span>}
    </label>
  );
}
