"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  ChangeOrder,
  ChangeOrderStats,
  ChangeOrderStatus,
  ChangeOrderItem,
  ReasonCategory,
  VariationType,
} from "@/types/changeorder";

const ALL_STATUSES: ChangeOrderStatus[] = [
  "Черновик", "На согласовании", "Одобрен", "Отклонён", "Закрыт",
];

const STATUS_COLOR: Record<ChangeOrderStatus, { bg: string; color: string }> = {
  "Черновик":       { bg: "rgba(120,120,120,0.15)", color: "var(--text-tertiary)" },
  "На согласовании":{ bg: "rgba(249,180,30,0.15)",  color: "var(--warning)" },
  "Одобрен":        { bg: "rgba(34,197,94,0.15)",   color: "var(--success)" },
  "Отклонён":       { bg: "rgba(239,68,68,0.15)",   color: "var(--danger)" },
  "Закрыт":         { bg: "rgba(120,120,160,0.15)", color: "var(--text-tertiary)" },
};

const REASONS: ReasonCategory[] = [
  "Запрос заказчика", "Изменение условий объекта", "Ошибка в проекте",
  "Нормативное требование", "Прочее",
];

const VARIATION_TYPES: VariationType[] = [
  "", "Дополнительные работы", "Исключение работ", "Замена материалов",
  "Продление сроков", "Комбинированное",
];

function fmt(n?: number | null) {
  if (n === undefined || n === null) return "—";
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 0 });
}
function fmtMln(n?: number | null) {
  if (!n) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} млн ₽`;
  return `${(n / 1000).toFixed(0)} тыс. ₽`;
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function ChangeOrdersPage() {
  const [list, setList] = useState<ChangeOrder[]>([]);
  const [stats, setStats] = useState<ChangeOrderStats | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    const [listRes, statsRes] = await Promise.all([
      fetch(`/api/change-orders?${params}`).then(r => r.json()),
      fetch(`/api/change-orders/stats`).then(r => r.json()),
    ]);
    setList(Array.isArray(listRes) ? listRes : []);
    setStats(statsRes && typeof statsRes === "object" ? statsRes : null);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ padding: 32, maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>Изменения проектов</h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: "4px 0 0" }}>
            Change Orders — дополнения и исключения работ по согласованию с заказчиком
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} style={{
          padding: "9px 16px", borderRadius: 10, border: "none",
          background: "var(--accent)", color: "white",
          fontWeight: 500, fontSize: 13, cursor: "pointer",
        }}>+ Новое изменение</button>
      </div>

      {/* KPI bar */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
          <KpiCard label="Всего" value={fmt(stats.total)} hint={`${stats.draft} черновик · ${stats.submitted} в работе`} />
          <KpiCard label="Одобрено" value={fmt(stats.approved)} hint={fmtMln(stats.approved_total)} accent="var(--success)" />
          <KpiCard label="На согласовании" value={fmt(stats.submitted)} hint={fmtMln(stats.pending_total)} accent="var(--warning)" />
          <KpiCard
            label="Влияние на срок"
            value={`${stats.schedule_impact_days > 0 ? "+" : ""}${stats.schedule_impact_days} дн.`}
            hint={stats.schedule_impact_days > 0 ? "продлений" : stats.schedule_impact_days < 0 ? "сокращений" : "без изменений"}
            accent={stats.schedule_impact_days > 0 ? "var(--warning)" : undefined}
          />
        </div>
      )}

      {/* Status filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <FilterChip label="Все" active={!statusFilter} onClick={() => setStatusFilter("")} />
        {ALL_STATUSES.map(s => (
          <FilterChip key={s} label={s} active={statusFilter === s} onClick={() => setStatusFilter(s)} color={STATUS_COLOR[s]?.color} />
        ))}
      </div>

      {/* Table */}
      <div style={{ background: "var(--bg-elevated)", borderRadius: 12, border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "var(--bg-base)" }}>
            <tr>
              <th style={th}>№ / Название</th>
              <th style={th}>Проект</th>
              <th style={th}>Тип</th>
              <th style={th}>Сумма подрядчика</th>
              <th style={th}>Согласовано</th>
              <th style={th}>Срок</th>
              <th style={th}>Статус</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>
                {statusFilter ? `Изменений со статусом «${statusFilter}» нет` : "Изменений пока нет. Создайте первое."}
              </td></tr>
            )}
            {list.map((co) => {
              const st = STATUS_COLOR[co.status] ?? STATUS_COLOR["Черновик"];
              return (
                <tr key={co.name} onClick={() => setSelectedName(co.name)} style={{
                  borderTop: "1px solid var(--border-subtle)", cursor: "pointer",
                }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                  <td style={td}>
                    <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text-tertiary)" }}>{co.name}</div>
                    <div style={{ fontWeight: 500 }}>{co.title}</div>
                  </td>
                  <td style={{ ...td, color: "var(--text-secondary)", fontSize: 12 }}>{co.project}</td>
                  <td style={{ ...td, fontSize: 12, color: "var(--text-tertiary)" }}>{co.variation_type || "—"}</td>
                  <td style={{ ...td, fontFamily: "monospace", textAlign: "right" }}>{fmt(co.contractor_amount)}</td>
                  <td style={{ ...td, fontFamily: "monospace", textAlign: "right", color: co.approved_amount ? "var(--success)" : "var(--text-tertiary)" }}>
                    {co.approved_amount ? fmt(co.approved_amount) : "—"}
                  </td>
                  <td style={{ ...td, textAlign: "right", color: (co.schedule_impact_days ?? 0) > 0 ? "var(--warning)" : "var(--text-tertiary)" }}>
                    {co.schedule_impact_days ? `${co.schedule_impact_days > 0 ? "+" : ""}${co.schedule_impact_days} д` : "—"}
                  </td>
                  <td style={td}>
                    <span style={{ padding: "3px 10px", borderRadius: 8, background: st.bg, color: st.color, fontSize: 11, fontWeight: 600 }}>
                      {co.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateDrawer onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />}
      {selectedName && <Drawer name={selectedName} onClose={() => setSelectedName(null)} onChanged={load} />}
    </div>
  );
}

// ── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: string }) {
  return (
    <div style={{
      background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
      borderRadius: 12, padding: "14px 18px",
    }}>
      <p style={{ fontSize: 10.5, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0, fontFamily: "monospace" }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 600, color: accent ?? "var(--text-primary)", margin: "6px 0 0", fontFamily: "monospace" }}>{value}</p>
      {hint && <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: "2px 0 0" }}>{hint}</p>}
    </div>
  );
}

function FilterChip({ label, active, onClick, color }: { label: string; active: boolean; onClick: () => void; color?: string }) {
  return (
    <button onClick={onClick} style={{
      padding: "5px 12px", borderRadius: 8, fontSize: 12,
      border: `1px solid ${active ? (color ?? "var(--accent)") : "var(--border-subtle)"}`,
      background: active ? `${color ?? "var(--accent)"}15` : "transparent",
      color: active ? (color ?? "var(--accent)") : "var(--text-secondary)",
      cursor: "pointer", fontWeight: active ? 500 : 400,
    }}>{label}</button>
  );
}

// ── Create Drawer ───────────────────────────────────────────────────────────

function CreateDrawer({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [projects, setProjects] = useState<{ name: string; title: string }[]>([]);
  const [form, setForm] = useState({
    title: "",
    project: "",
    reason_category: "Запрос заказчика" as ReasonCategory,
    variation_type: "Дополнительные работы" as VariationType,
    description: "",
    schedule_impact_days: 0,
  });
  const [items, setItems] = useState<ChangeOrderItem[]>([
    { work_name: "", unit: "", qty: 0, unit_price: 0 },
  ]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/projects").then(r => r.json()).then(d => setProjects(Array.isArray(d) ? d : []));
  }, []);

  const total = items.reduce((s, it) => s + (Number(it.qty || 0) * Number(it.unit_price || 0)), 0);

  function updateItem(i: number, patch: Partial<ChangeOrderItem>) {
    setItems(items.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  }
  function addItem() {
    setItems([...items, { work_name: "", unit: "", qty: 0, unit_price: 0 }]);
  }
  function removeItem(i: number) {
    setItems(items.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    if (!form.title.trim() || !form.project) return;
    setSaving(true);
    try {
      await fetch("/api/change-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          items: items.filter(it => it.work_name.trim()),
        }),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div onClick={onClose} style={backdropStyle} />
      <aside style={{ ...drawerStyle, width: 720 }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>Новое изменение</h2>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>

        <div style={{ padding: 24, flex: 1, overflowY: "auto" }}>
          <Field label="Краткое описание">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Доп. АКЗ на отметке +6.000" style={inputStyle} />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Проект">
              <select value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} style={inputStyle}>
                <option value="">— выбрать —</option>
                {projects.map(p => <option key={p.name} value={p.name}>{p.title}</option>)}
              </select>
            </Field>
            <Field label="Тип изменения">
              <select value={form.variation_type} onChange={(e) => setForm({ ...form, variation_type: e.target.value as VariationType })} style={inputStyle}>
                {VARIATION_TYPES.map(t => <option key={t} value={t}>{t || "— не выбрано —"}</option>)}
              </select>
            </Field>
            <Field label="Причина">
              <select value={form.reason_category} onChange={(e) => setForm({ ...form, reason_category: e.target.value as ReasonCategory })} style={inputStyle}>
                {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Влияние на срок, дней">
              <input type="number" value={form.schedule_impact_days} onChange={(e) => setForm({ ...form, schedule_impact_days: Number(e.target.value) })}
                style={inputStyle} placeholder="±дней" />
            </Field>
          </div>

          <Field label="Описание (что и почему)">
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3} style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical" }} />
          </Field>

          <p style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "20px 0 8px", fontFamily: "monospace" }}>
            Позиции ({items.length})
          </p>
          <div style={{ background: "var(--bg-base)", borderRadius: 8, border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
            {items.map((it, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) 60px 70px 90px 90px 30px", gap: 8, padding: "8px 12px", borderTop: i > 0 ? "1px solid var(--border-subtle)" : "none", alignItems: "center" }}>
                <input value={it.work_name} onChange={(e) => updateItem(i, { work_name: e.target.value })}
                  placeholder="Наименование" style={{ ...inputStyle, padding: "5px 8px", fontSize: 12, margin: 0 }} />
                <input value={it.unit ?? ""} onChange={(e) => updateItem(i, { unit: e.target.value })}
                  placeholder="ед." style={{ ...inputStyle, padding: "5px 8px", fontSize: 12, margin: 0 }} />
                <input type="number" value={it.qty ?? 0} onChange={(e) => updateItem(i, { qty: Number(e.target.value) })}
                  style={{ ...inputStyle, padding: "5px 8px", fontSize: 12, margin: 0, textAlign: "right", fontFamily: "monospace" }} />
                <input type="number" value={it.unit_price ?? 0} onChange={(e) => updateItem(i, { unit_price: Number(e.target.value) })}
                  style={{ ...inputStyle, padding: "5px 8px", fontSize: 12, margin: 0, textAlign: "right", fontFamily: "monospace" }} />
                <span style={{ fontFamily: "monospace", fontSize: 12, textAlign: "right", fontWeight: 600 }}>
                  {((it.qty ?? 0) * (it.unit_price ?? 0)).toLocaleString("ru-RU", { maximumFractionDigits: 0 })}
                </span>
                <button onClick={() => removeItem(i)} title="Удалить" style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 14 }}>✕</button>
              </div>
            ))}
            <button onClick={addItem} style={{ width: "100%", padding: "8px", background: "transparent", border: "none", borderTop: "1px solid var(--border-subtle)", color: "var(--text-secondary)", cursor: "pointer", fontSize: 12 }}>
              + добавить позицию
            </button>
          </div>

          <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: "monospace" }}>СУММА ПОДРЯДЧИКА</span>
            <span style={{ fontSize: 18, fontFamily: "monospace", fontWeight: 700, color: "var(--accent)" }}>
              {total.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽
            </span>
          </div>
        </div>

        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border-subtle)", display: "flex", gap: 8 }}>
          <button onClick={onClose} style={btnSecondary}>Отмена</button>
          <button onClick={handleSave} disabled={saving || !form.title.trim() || !form.project} style={{ ...btnPrimary, opacity: (saving || !form.title.trim() || !form.project) ? 0.5 : 1 }}>
            {saving ? "Сохранение..." : "Создать"}
          </button>
        </div>
      </aside>
    </>
  );
}

// ── View Drawer ─────────────────────────────────────────────────────────────

function Drawer({ name, onClose, onChanged }: { name: string; onClose: () => void; onChanged: () => void }) {
  const [co, setCo] = useState<ChangeOrder | null>(null);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [approvedBy, setApprovedBy] = useState("");

  const load = useCallback(async () => {
    const data = await fetch(`/api/change-orders/detail?name=${encodeURIComponent(name)}`).then(r => r.json());
    setCo(data);
  }, [name]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  async function changeStatus(status: ChangeOrderStatus) {
    const body: { name: string; status: ChangeOrderStatus; approved_by?: string } = { name, status };
    if (status === "Одобрен" && approvedBy.trim()) body.approved_by = approvedBy.trim();
    await fetch("/api/change-orders/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setStatusMenuOpen(false);
    load();
    onChanged();
  }

  if (!co) return <><div onClick={onClose} style={backdropStyle} /><aside style={{ ...drawerStyle, width: 720 }}><div style={{ padding: 24, color: "var(--text-tertiary)" }}>Загрузка...</div></aside></>;

  const st = STATUS_COLOR[co.status];

  return (
    <>
      <div onClick={onClose} style={backdropStyle} />
      <aside style={{ ...drawerStyle, width: 720 }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, fontSize: 17 }}>{co.title}</h2>
                <div style={{ position: "relative" }}>
                  <button onClick={() => setStatusMenuOpen(v => !v)} style={{
                    padding: "3px 10px", borderRadius: 10, background: st.bg, color: st.color,
                    fontWeight: 600, fontSize: 12, border: "none", cursor: "pointer",
                  }}>
                    {co.status} ▾
                  </button>
                  {statusMenuOpen && (
                    <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 8, zIndex: 10, minWidth: 200, boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
                      {co.status === "Одобрен" || co.status === "Отклонён" ? null : (
                        <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)" }}>
                          <input value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)}
                            placeholder="ФИО согласующего" style={{ ...inputStyle, padding: "4px 8px", fontSize: 11, margin: 0 }} />
                        </div>
                      )}
                      {ALL_STATUSES.filter(s => s !== co.status).map(s => (
                        <button key={s} onClick={() => changeStatus(s)} style={{
                          display: "block", width: "100%", padding: "8px 14px", background: "none",
                          border: "none", cursor: "pointer", textAlign: "left", fontSize: 12,
                          color: "var(--text-secondary)", borderBottom: "1px solid var(--border-subtle)",
                        }}>→ {s}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: 0 }}>
                {co.name} · {co.project} · {co.reason_category}
                {co.variation_type ? ` · ${co.variation_type}` : ""}
              </p>
            </div>
            <button onClick={onClose} style={closeBtn}>✕</button>
          </div>
        </div>

        <div style={{ padding: 24, flex: 1, overflowY: "auto" }}>
          {co.description && (
            <div style={{ marginBottom: 20, padding: 14, background: "rgba(255,255,255,0.03)", borderRadius: 10, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.55 }}>
              {co.description}
            </div>
          )}

          {/* Items */}
          {co.items && co.items.length > 0 && (
            <>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px", fontFamily: "monospace" }}>
                Позиции ({co.items.length})
              </p>
              <div style={{ background: "var(--bg-base)", borderRadius: 8, border: "1px solid var(--border-subtle)", overflow: "hidden", marginBottom: 20 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead style={{ background: "var(--bg-elevated)" }}>
                    <tr>
                      <th style={tdHead}>Работа</th>
                      <th style={tdHead}>Ед.</th>
                      <th style={tdHead}>Объём</th>
                      <th style={tdHead}>Цена</th>
                      <th style={tdHead}>Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {co.items.map((it, i) => (
                      <tr key={i} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                        <td style={{ ...tdCell, textAlign: "left" }}>{it.work_name}</td>
                        <td style={tdCell}>{it.unit || "—"}</td>
                        <td style={{ ...tdCell, fontFamily: "monospace" }}>{fmt(it.qty)}</td>
                        <td style={{ ...tdCell, fontFamily: "monospace" }}>{fmt(it.unit_price)}</td>
                        <td style={{ ...tdCell, fontFamily: "monospace", fontWeight: 600 }}>{fmt(it.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Amounts block */}
          <div style={{ background: "var(--bg-base)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: 14, marginBottom: 14 }}>
            <p style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px", fontFamily: "monospace" }}>Согласование</p>
            <Row label="Сумма подрядчика (наша заявка)" value={fmt(co.contractor_amount)} />
            <Row label="Сумма инженера заказчика" value={co.engineer_amount ? fmt(co.engineer_amount) : "—"} />
            <Row label="Согласованная сумма" value={co.approved_amount ? fmt(co.approved_amount) : "—"} bold color={co.approved_amount ? "var(--success)" : undefined} />
            <Row label="Влияние на срок" value={co.schedule_impact_days ? `${co.schedule_impact_days > 0 ? "+" : ""}${co.schedule_impact_days} дней` : "—"} />
          </div>

          {/* Audit trail */}
          {(co.submitted_at || co.approved_at || co.rejected_at) && (
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", lineHeight: 1.8 }}>
              {co.submitted_at && <div>📤 Подано: {co.submitted_at} {co.submitted_by ? `(${co.submitted_by})` : ""}</div>}
              {co.approved_at && <div>✓ Одобрено: {co.approved_at} {co.approved_by ? `(${co.approved_by})` : ""}</div>}
              {co.rejected_at && <div>✗ Отклонено: {co.rejected_at} {co.rejected_by ? `(${co.rejected_by})` : ""}</div>}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 14 }}>
    <label style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4, fontFamily: "monospace" }}>{label}</label>
    {children}
  </div>;
}

function Row({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderTop: "1px dashed var(--border-subtle)" }}>
    <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{label}</span>
    <span style={{ fontSize: 13, fontFamily: "monospace", color: color ?? "var(--text-primary)", fontWeight: bold ? 700 : 500 }}>{value}</span>
  </div>;
}

const th: React.CSSProperties = { padding: "12px 14px", textAlign: "left", fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "monospace", fontWeight: 500 };
const td: React.CSSProperties = { padding: "12px 14px" };
const tdHead: React.CSSProperties = { padding: "8px 10px", textAlign: "right", fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 };
const tdCell: React.CSSProperties = { padding: "8px 10px", textAlign: "right", color: "var(--text-primary)" };

const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 10px", background: "var(--bg-base)", border: "1px solid var(--border-subtle)", borderRadius: 8, color: "var(--text-primary)", fontSize: 13, outline: "none" };

const backdropStyle: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 40, backdropFilter: "blur(2px)" };
const drawerStyle: React.CSSProperties = { position: "fixed", top: 0, right: 0, bottom: 0, background: "var(--bg-elevated)", borderLeft: "1px solid var(--border-subtle)", zIndex: 50, display: "flex", flexDirection: "column", overflow: "hidden" };
const closeBtn: React.CSSProperties = { width: 28, height: 28, borderRadius: 8, border: "1px solid var(--border-subtle)", background: "transparent", color: "var(--text-tertiary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 };

const btnSecondary: React.CSSProperties = { padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer" };
const btnPrimary: React.CSSProperties = { padding: "8px 14px", borderRadius: 8, border: "none", background: "var(--accent)", color: "white", fontSize: 13, cursor: "pointer", fontWeight: 500, flex: 1 };
