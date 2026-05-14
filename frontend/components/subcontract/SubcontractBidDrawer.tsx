"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  SubcontractBidRequest,
  SubcontractBidItem,
  BidRequestStatus,
  SubWorkType,
} from "@/types/subcontract";

const STATUS_OPTIONS: BidRequestStatus[] = [
  "Черновик", "Отправлено", "Приём предложений", "Сравнение", "Присуждён", "Отменён",
];
const WORK_TYPES: SubWorkType[] = ["АКЗ", "Кровля", "Промальп", "Монолит", "Усиление", "Комплексный"];

const inputStyle: React.CSSProperties = {
  padding: "8px 10px", fontSize: 13, color: "var(--text-primary)",
  background: "var(--bg-base)", border: "1px solid var(--border-subtle)", borderRadius: 8,
  outline: "none", width: "100%",
};

export default function SubcontractBidDrawer({
  name,
  projects,
  onClose,
  onSaved,
}: {
  name: string | "new";
  projects: { name: string; title: string }[];
  onClose: () => void;
  onSaved: (savedName: string) => void;
}) {
  const isNew = name === "new";
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const plus = (d: number) => {
    const dt = new Date(); dt.setDate(dt.getDate() + d);
    return dt.toISOString().slice(0, 10);
  };

  const [form, setForm] = useState<Partial<SubcontractBidRequest>>({
    title: "",
    project: "",
    status: "Черновик",
    work_type: "",
    sent_date: today,
    deadline_date: plus(7),
    description: "",
    items: [],
  });

  const load = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/subcontract-bids/${encodeURIComponent(name)}`);
      const d = await r.json();
      if (d?.name) setForm(d);
    } finally {
      setLoading(false);
    }
  }, [name, isNew]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  function update<K extends keyof SubcontractBidRequest>(k: K, v: SubcontractBidRequest[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  function updateItem(i: number, patch: Partial<SubcontractBidItem>) {
    setForm(f => {
      const items = [...(f.items ?? [])];
      items[i] = { ...items[i], ...patch } as SubcontractBidItem;
      return { ...f, items };
    });
  }

  function addItem() {
    setForm(f => ({
      ...f,
      items: [...(f.items ?? []), { item_name: "", unit: "м²", qty: 0, our_unit_price: 0, work_type: f.work_type ?? "" }],
    }));
  }

  function removeItem(i: number) {
    setForm(f => ({ ...f, items: (f.items ?? []).filter((_, idx) => idx !== i) }));
  }

  const targetTotal = (form.items ?? []).reduce((s, it) => s + (it.qty || 0) * (it.our_unit_price || 0), 0);

  async function save() {
    if (!form.title?.trim()) { setError("Укажите название работ"); return; }
    if (!form.project) { setError("Укажите проект"); return; }
    if (!(form.items ?? []).length) { setError("Добавьте хотя бы одну позицию"); return; }
    setSaving(true); setError(null);
    try {
      const payload: Record<string, unknown> = { ...form };
      const url = isNew ? "/api/subcontract-bids" : `/api/subcontract-bids/${encodeURIComponent(name)}`;
      const method = isNew ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data.error) { setError(data.error || "Ошибка сохранения"); return; }
      onSaved(data.name || (isNew ? data.name : name));
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 720, maxWidth: "100%", height: "100vh", background: "var(--bg-base)",
        borderLeft: "1px solid var(--border-subtle)", overflow: "auto", padding: "24px 28px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            <h2 style={{ fontSize: 19, fontWeight: 500, margin: 0 }}>
              {isNew ? "Новый субподрядный тендер" : (form.title || name)}
            </h2>
            {!isNew && (
              <p style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-tertiary)", marginTop: 4 }}>{name}</p>
            )}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-tertiary)", fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        {loading && <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Загрузка...</div>}

        {!loading && (
          <>
            {/* Основное */}
            <Section title="Основное">
              <Field label="Что отдаём субподряду *">
                <input style={inputStyle} value={form.title || ""} onChange={(e) => update("title", e.target.value)}
                       placeholder="АКЗ резервуара РВС-2000" />
              </Field>
              <Row>
                <Field label="Проект *">
                  <select style={inputStyle} value={form.project || ""} onChange={(e) => update("project", e.target.value)}>
                    <option value="">— выберите —</option>
                    {projects.map(p => <option key={p.name} value={p.name}>{p.title}</option>)}
                  </select>
                </Field>
                <Field label="Вид работ">
                  <select style={inputStyle} value={form.work_type || ""} onChange={(e) => update("work_type", e.target.value as SubWorkType)}>
                    <option value="">—</option>
                    {WORK_TYPES.map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                </Field>
                <Field label="Статус">
                  <select style={inputStyle} value={form.status || "Черновик"} onChange={(e) => update("status", e.target.value as BidRequestStatus)}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
              </Row>
              <Row>
                <Field label="Отправлено">
                  <input type="date" style={inputStyle} value={form.sent_date || ""} onChange={(e) => update("sent_date", e.target.value)} />
                </Field>
                <Field label="Дедлайн приёма КП">
                  <input type="date" style={inputStyle} value={form.deadline_date || ""} onChange={(e) => update("deadline_date", e.target.value)} />
                </Field>
                <Field label="Начало работ">
                  <input type="date" style={inputStyle} value={form.work_start_date || ""} onChange={(e) => update("work_start_date", e.target.value)} />
                </Field>
                <Field label="Окончание">
                  <input type="date" style={inputStyle} value={form.work_end_date || ""} onChange={(e) => update("work_end_date", e.target.value)} />
                </Field>
              </Row>
            </Section>

            {/* Позиции */}
            <Section title={`Позиции (${(form.items ?? []).length})`}>
              <div style={{
                background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
                borderRadius: 10, overflow: "hidden",
              }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead style={{ background: "var(--bg-base)" }}>
                    <tr>
                      <th style={tdH}>Код</th>
                      <th style={{ ...tdH, width: "40%" }}>Наименование</th>
                      <th style={tdH}>Ед.</th>
                      <th style={tdH}>Кол-во</th>
                      <th style={tdH}>Цена ₽</th>
                      <th style={tdH}>Сумма ₽</th>
                      <th style={tdH}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(form.items ?? []).map((it, i) => (
                      <tr key={i} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                        <td style={tdC}>
                          <input style={{ ...inputStyle, padding: "4px 6px", fontSize: 12 }}
                                 value={it.item_code || ""} onChange={(e) => updateItem(i, { item_code: e.target.value })} />
                        </td>
                        <td style={tdC}>
                          <input style={{ ...inputStyle, padding: "4px 6px", fontSize: 12 }}
                                 value={it.item_name} onChange={(e) => updateItem(i, { item_name: e.target.value })} />
                        </td>
                        <td style={tdC}>
                          <input style={{ ...inputStyle, padding: "4px 6px", fontSize: 12, width: 50 }}
                                 value={it.unit || ""} onChange={(e) => updateItem(i, { unit: e.target.value })} />
                        </td>
                        <td style={tdC}>
                          <input type="number" style={{ ...inputStyle, padding: "4px 6px", fontSize: 12, width: 80, textAlign: "right" }}
                                 value={it.qty || ""} onChange={(e) => updateItem(i, { qty: parseFloat(e.target.value) || 0 })} />
                        </td>
                        <td style={tdC}>
                          <input type="number" style={{ ...inputStyle, padding: "4px 6px", fontSize: 12, width: 90, textAlign: "right" }}
                                 value={it.our_unit_price || ""} onChange={(e) => updateItem(i, { our_unit_price: parseFloat(e.target.value) || 0 })} />
                        </td>
                        <td style={{ ...tdC, fontFamily: "monospace", textAlign: "right", fontWeight: 500 }}>
                          {((it.qty || 0) * (it.our_unit_price || 0)).toLocaleString("ru-RU")}
                        </td>
                        <td style={tdC}>
                          <button onClick={() => removeItem(i)}
                                  style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 14 }}>×</button>
                        </td>
                      </tr>
                    ))}
                    {!(form.items ?? []).length && (
                      <tr><td colSpan={7} style={{ padding: 20, textAlign: "center", color: "var(--text-tertiary)", fontSize: 12 }}>Позиций нет</td></tr>
                    )}
                  </tbody>
                  {(form.items ?? []).length > 0 && (
                    <tfoot>
                      <tr style={{ background: "var(--bg-base)", borderTop: "1px solid var(--border-subtle)" }}>
                        <td colSpan={5} style={{ ...tdC, textAlign: "right", color: "var(--text-tertiary)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          Целевой бюджет
                        </td>
                        <td style={{ ...tdC, fontFamily: "monospace", textAlign: "right", fontWeight: 600, fontSize: 14, color: "var(--accent)" }}>
                          {targetTotal.toLocaleString("ru-RU")} ₽
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
                <button onClick={addItem} style={{
                  width: "100%", padding: "8px 0", background: "transparent", color: "var(--accent)",
                  border: "none", borderTop: "1px solid var(--border-subtle)", cursor: "pointer",
                  fontSize: 12, fontWeight: 500,
                }}>+ Позиция</button>
              </div>
            </Section>

            <Section title="Описание / условия">
              <textarea style={{ ...inputStyle, minHeight: 80, fontFamily: "inherit" }}
                        value={form.description || ""} onChange={(e) => update("description", e.target.value)}
                        placeholder="Условия для подрядчиков, требования к материалам, сертификаты..." />
            </Section>

            {error && <div style={{ padding: 10, marginTop: 10, background: "rgba(248,113,113,0.1)", border: "1px solid var(--danger)", borderRadius: 8, color: "var(--danger)", fontSize: 12 }}>{error}</div>}

            <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={onClose} style={btnCancel}>Отмена</button>
              <button onClick={save} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
                {saving ? "Сохранение..." : (isNew ? "Создать тендер" : "Сохранить")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 22 }}>
    <h3 style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10, fontFamily: "monospace" }}>{title}</h3>
    {children}
  </div>
);
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ flex: 1, marginBottom: 12 }}>
    <label style={{ display: "block", fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4 }}>{label}</label>
    {children}
  </div>
);
const Row = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{children}</div>
);

const tdH: React.CSSProperties = { padding: "7px 10px", textAlign: "left", color: "var(--text-tertiary)", fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" };
const tdC: React.CSSProperties = { padding: "5px 8px", color: "var(--text-primary)", verticalAlign: "middle" };
const btnPrimary: React.CSSProperties = { padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 500, background: "var(--accent)", color: "white", border: "none", cursor: "pointer" };
const btnCancel: React.CSSProperties = { padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 500, background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)", cursor: "pointer" };
