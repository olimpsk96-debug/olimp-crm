"use client";

import { useEffect, useState } from "react";
import { Deal, DealStatus, DealSource } from "@/types/crm";
import { inputStyle, btnPrimary, btnSecondary } from "@/lib/ui-styles";

const fmtM = (v?: number) => {
  if (!v) return "—";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} млн`;
  if (v >= 1000) return `${Math.round(v / 1000)} тыс.`;
  return `${v}`;
};

const fmtDate = (d?: string | null) => {
  if (!d) return null;
  return new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
};

const COLUMNS: { status: DealStatus; color: string; bg: string }[] = [
  { status: "Лид",            color: "var(--text-tertiary)",  bg: "rgba(156,163,175,0.06)" },
  { status: "Переговоры",     color: "var(--warning)",        bg: "rgba(251,191,36,0.06)" },
  { status: "КП отправлено",  color: "var(--accent)",         bg: "rgba(249,115,22,0.06)" },
  { status: "Договор",        color: "#a78bfa",               bg: "rgba(167,139,250,0.06)" },
  { status: "В работе",       color: "var(--success)",        bg: "rgba(52,211,153,0.06)" },
  { status: "Закрыт выигран", color: "var(--success)",        bg: "rgba(52,211,153,0.08)" },
  { status: "Закрыт проигран",color: "var(--danger)",         bg: "rgba(248,113,113,0.06)" },
];

// ── Deal Create Drawer ───────────────────────────────────────────────────────

function DealCreateDrawer({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: "",
    customer: "",
    contact_name: "",
    status: "Лид" as DealStatus,
    amount_estimated: "",
    probability_pct: "50",
    source: "" as DealSource | "",
    expected_close_date: "",
    description: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  async function save() {
    if (!form.title || !form.customer) return;
    setSaving(true);
    await fetch("/api/crm/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        amount_estimated: form.amount_estimated ? Number(form.amount_estimated) : null,
        probability_pct: Number(form.probability_pct),
      }),
    });
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 40 }} />
      <aside style={{
        position: "fixed", top: 0, right: 0, width: 480, height: "100vh",
        background: "var(--bg-elevated)", borderLeft: "1px solid var(--border-subtle)",
        zIndex: 50, display: "flex", flexDirection: "column", overflowY: "auto",
      }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>Новая сделка</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", fontSize: 20 }}>✕</button>
        </div>
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Название *">
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="АКЗ резервуаров РВС-1000..." style={inputStyle} />
          </Field>
          <Field label="Клиент *">
            <input value={form.customer} onChange={e => setForm(f => ({ ...f, customer: e.target.value }))} placeholder="НПП Старт" style={inputStyle} />
          </Field>
          <Field label="Контактное лицо">
            <input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} placeholder="Иванов А.В." style={inputStyle} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Статус">
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as DealStatus }))} style={inputStyle}>
                {COLUMNS.map(c => <option key={c.status}>{c.status}</option>)}
              </select>
            </Field>
            <Field label="Вероятность, %">
              <input type="number" min={0} max={100} value={form.probability_pct} onChange={e => setForm(f => ({ ...f, probability_pct: e.target.value }))} style={inputStyle} />
            </Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Сумма (оценка), ₽">
              <input type="number" value={form.amount_estimated} onChange={e => setForm(f => ({ ...f, amount_estimated: e.target.value }))} placeholder="4 200 000" style={inputStyle} />
            </Field>
            <Field label="Закрытие">
              <input type="date" value={form.expected_close_date} onChange={e => setForm(f => ({ ...f, expected_close_date: e.target.value }))} style={inputStyle} />
            </Field>
          </div>
          <Field label="Источник">
            <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value as DealSource | "" }))} style={inputStyle}>
              <option value="">—</option>
              {["Сайт", "Рекомендация", "Тендер", "Холодный звонок", "Знакомство", "Прочее"].map(o => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Описание">
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
          </Field>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button onClick={save} disabled={saving || !form.title || !form.customer} style={{ ...btnPrimary, opacity: saving || !form.title || !form.customer ? 0.6 : 1 }}>
              {saving ? "Сохранение..." : "Создать сделку"}
            </button>
            <button onClick={onClose} style={btnSecondary}>Отмена</button>
          </div>
        </div>
      </aside>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</label>
      {children}
    </div>
  );
}

// ── Deal Card ────────────────────────────────────────────────────────────────

function DealCard({ deal, col, onStatusChange }: {
  deal: Deal;
  col: typeof COLUMNS[0];
  onStatusChange: (name: string, status: DealStatus) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div style={{
      background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
      borderLeft: `3px solid ${col.color}`, borderRadius: 8, padding: "10px 12px",
      marginBottom: 8, position: "relative",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0, lineHeight: 1.35 }}>{deal.title}</p>
        <button onClick={() => setMenuOpen(v => !v)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 16, lineHeight: 1, padding: "0 2px", flexShrink: 0 }}>⋮</button>
      </div>

      {menuOpen && (
        <div style={{
          position: "absolute", top: 28, right: 4, background: "var(--bg-elevated)",
          border: "1px solid var(--border-subtle)", borderRadius: 8, zIndex: 10,
          minWidth: 160, boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        }}>
          {COLUMNS.filter(c => c.status !== deal.status).map(c => (
            <button key={c.status} onClick={() => { onStatusChange(deal.name, c.status); setMenuOpen(false); }} style={{
              display: "block", width: "100%", padding: "8px 14px", background: "none",
              border: "none", cursor: "pointer", textAlign: "left", fontSize: 12,
              color: "var(--text-secondary)", borderBottom: "1px solid var(--border-subtle)",
            }}>
              → {c.status}
            </button>
          ))}
        </div>
      )}

      <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "4px 0 6px" }}>
        {deal.customer}{deal.contact_name ? ` · ${deal.contact_name}` : ""}
      </p>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
          {fmtM(deal.amount_estimated)} ₽
        </span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {deal.expected_close_date && (
            <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{fmtDate(deal.expected_close_date)}</span>
          )}
          <span style={{
            fontSize: 10, padding: "2px 6px", borderRadius: 10,
            background: `color-mix(in srgb, ${col.color} 15%, transparent)`,
            color: col.color, fontWeight: 600,
          }}>
            {deal.probability_pct}%
          </span>
        </div>
      </div>

      {deal.source && (
        <p style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4 }}>{deal.source}</p>
      )}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    const res = await fetch("/api/crm/deals");
    setDeals(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function changeStatus(name: string, status: DealStatus) {
    setDeals(prev => prev.map(d => d.name === name ? { ...d, status } : d));
    await fetch("/api/crm/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _method: "status", name, status }),
    });
  }

  const pipelineCols = COLUMNS.filter(c => !["Закрыт выигран", "Закрыт проигран"].includes(c.status));
  const closedCols = COLUMNS.filter(c => ["Закрыт выигран", "Закрыт проигран"].includes(c.status));

  const totalPipeline = deals
    .filter(d => !["Закрыт выигран", "Закрыт проигран"].includes(d.status))
    .reduce((s, d) => s + (d.amount_estimated ?? 0), 0);

  const wonTotal = deals
    .filter(d => d.status === "Закрыт выигран")
    .reduce((s, d) => s + (d.amount_estimated ?? 0), 0);

  return (
    <div style={{ padding: "28px 32px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Воронка сделок</h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>
            Воронка: {fmtM(totalPipeline)} ₽ · Выиграно: {fmtM(wonTotal)} ₽
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} style={btnPrimary}>+ Новая сделка</button>
      </div>

      {/* Pipeline Kanban */}
      <div style={{ overflowX: "auto", paddingBottom: 24 }}>
        <div style={{ display: "flex", gap: 12, minWidth: "max-content" }}>
          {pipelineCols.map(col => {
            const colDeals = deals.filter(d => d.status === col.status);
            const colTotal = colDeals.reduce((s, d) => s + (d.amount_estimated ?? 0), 0);
            return (
              <div key={col.status} style={{
                width: 220, background: col.bg, borderRadius: 12,
                border: `1px solid color-mix(in srgb, ${col.color} 20%, transparent)`,
                padding: "12px 10px",
              }}>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: col.color, margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>{col.status}</p>
                    <span style={{ fontSize: 11, background: `color-mix(in srgb, ${col.color} 15%, transparent)`, color: col.color, borderRadius: 10, padding: "1px 7px", fontWeight: 700 }}>
                      {colDeals.length}
                    </span>
                  </div>
                  {colTotal > 0 && (
                    <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: "2px 0 0" }}>{fmtM(colTotal)} ₽</p>
                  )}
                </div>
                {colDeals.map(d => (
                  <DealCard key={d.name} deal={d} col={col} onStatusChange={changeStatus} />
                ))}
                {colDeals.length === 0 && (
                  <p style={{ fontSize: 12, color: "var(--text-tertiary)", textAlign: "center", padding: "12px 0", fontStyle: "italic" }}>Нет сделок</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Closed deals */}
      {closedCols.some(c => deals.some(d => d.status === c.status)) && (
        <div>
          <p style={{ fontSize: 12, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Закрытые</p>
          <div style={{ display: "flex", gap: 12 }}>
            {closedCols.map(col => {
              const colDeals = deals.filter(d => d.status === col.status);
              if (colDeals.length === 0) return null;
              return (
                <div key={col.status} style={{ flex: 1, background: col.bg, borderRadius: 10, border: `1px solid color-mix(in srgb, ${col.color} 20%, transparent)`, padding: "10px 12px" }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: col.color, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>{col.status} ({colDeals.length})</p>
                  {colDeals.map(d => (
                    <DealCard key={d.name} deal={d} col={col} onStatusChange={changeStatus} />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showCreate && <DealCreateDrawer onClose={() => setShowCreate(false)} onSaved={load} />}
    </div>
  );
}

