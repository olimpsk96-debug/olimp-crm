"use client";

import { useState } from "react";
import type { TenderLaw, WorkType } from "@/types/tender";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (name: string) => void;
}

interface FormState {
  title: string;
  tender_law: TenderLaw;
  work_type: WorkType | "";
  nmck: string;
  deadline_date: string;
  region: string;
  purchase_number: string;
  platform_url: string;
}

const EMPTY: FormState = {
  title: "",
  tender_law: "44-ФЗ",
  work_type: "",
  nmck: "",
  deadline_date: "",
  region: "",
  purchase_number: "",
  platform_url: "",
};

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 11, color: "var(--text-tertiary)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace" }}>
        {label}{required && <span style={{ color: "var(--danger)", marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: 9,
  border: "1px solid var(--border-subtle)",
  background: "var(--bg-base)",
  color: "var(--text-primary)",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
};

export function TenderCreateDrawer({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError("Укажите название тендера"); return; }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/tenders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          tender_law: form.tender_law,
          work_type: form.work_type || undefined,
          nmck: form.nmck ? parseFloat(form.nmck.replace(/\s/g, "")) : undefined,
          deadline_date: form.deadline_date || undefined,
          region: form.region.trim() || undefined,
          purchase_number: form.purchase_number.trim() || undefined,
          platform_url: form.platform_url.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      if (data.created) {
        setForm(EMPTY);
        onCreated(data.created);
      }
    } catch {
      setError("Ошибка соединения");
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    setForm(EMPTY);
    setError(null);
    onClose();
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
        width: 440, zIndex: 50,
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
              <h2 style={{ fontSize: 16, fontWeight: 500, letterSpacing: "-0.01em" }}>Новый тендер</h2>
              <p style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 2 }}>Статус «Новый» присваивается автоматически</p>
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

        {/* Форма */}
        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 32px", flex: 1 }}>
          <Field label="Название" required>
            <input
              style={inputStyle}
              placeholder="АКЗ металлоконструкций резервуаров..."
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              autoFocus
            />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Закон">
              <select style={inputStyle} value={form.tender_law} onChange={(e) => set("tender_law", e.target.value as TenderLaw)}>
                <option>44-ФЗ</option>
                <option>223-ФЗ</option>
                <option>Коммерческий</option>
              </select>
            </Field>

            <Field label="Вид работ">
              <select style={inputStyle} value={form.work_type} onChange={(e) => set("work_type", e.target.value as WorkType | "")}>
                <option value="">—</option>
                <option>АКЗ</option>
                <option>Кровля</option>
                <option>Промальп</option>
                <option>Монолит</option>
                <option>Усиление</option>
              </select>
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="НМЦК, ₽">
              <input
                style={inputStyle}
                placeholder="4 800 000"
                value={form.nmck}
                onChange={(e) => set("nmck", e.target.value)}
                inputMode="numeric"
              />
            </Field>

            <Field label="Дедлайн">
              <input
                style={inputStyle}
                type="date"
                value={form.deadline_date}
                onChange={(e) => set("deadline_date", e.target.value)}
              />
            </Field>
          </div>

          <Field label="Регион">
            <input
              style={inputStyle}
              placeholder="Свердловская обл."
              value={form.region}
              onChange={(e) => set("region", e.target.value)}
            />
          </Field>

          <Field label="№ закупки">
            <input
              style={inputStyle}
              placeholder="0362300011026000001"
              value={form.purchase_number}
              onChange={(e) => set("purchase_number", e.target.value)}
            />
          </Field>

          <Field label="Ссылка на площадку">
            <input
              style={inputStyle}
              placeholder="https://zakupki.gov.ru/..."
              value={form.platform_url}
              onChange={(e) => set("platform_url", e.target.value)}
            />
          </Field>

          {error && (
            <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 10, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "var(--danger)", fontSize: 12.5 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            style={{
              width: "100%", padding: "11px 0", borderRadius: 10, border: "none",
              background: saving ? "var(--border-subtle)" : "var(--accent)",
              color: saving ? "var(--text-tertiary)" : "white",
              fontSize: 13.5, fontWeight: 500, cursor: saving ? "wait" : "pointer",
              transition: "background 0.15s ease",
            }}
          >
            {saving ? "Создание..." : "Создать тендер"}
          </button>
        </form>
      </div>
    </>
  );
}
