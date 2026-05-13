"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ProjectListItem, ProjectStats, ProjectStatus } from "@/types/project";
import { ExportButton } from "@/components/shared/ExportButton";
import {
  inputStyle,
  btnPrimary,
  btnSecondary,
  labelStyle,
  backdropStyle,
  drawerStyle,
  drawerHeaderStyle,
  closeBtn,
  statCard,
  statLabel,
  statValue,
  statSub,
} from "@/lib/ui-styles";

const fmtM = (v?: number | null) => {
  if (!v && v !== 0) return "—";
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} млн ₽`;
  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)} тыс. ₽`;
  return `${v} ₽`;
};

const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" });
};

const STATUS_COLORS: Record<ProjectStatus, { color: string; bg: string }> = {
  "Подготовка":  { color: "var(--text-tertiary)", bg: "rgba(156,163,175,0.1)" },
  "В работе":    { color: "var(--success)",       bg: "rgba(52,211,153,0.1)" },
  "Сдача":       { color: "var(--accent)",        bg: "rgba(249,115,22,0.1)" },
  "Закрыт":      { color: "#a78bfa",              bg: "rgba(167,139,250,0.1)" },
  "На паузе":    { color: "var(--warning)",       bg: "rgba(251,191,36,0.1)" },
  "Отменён":     { color: "var(--danger)",        bg: "rgba(248,113,113,0.1)" },
};

const ALL_STATUSES: ProjectStatus[] = ["Подготовка", "В работе", "Сдача", "Закрыт", "На паузе", "Отменён"];

// ── Project Create Drawer ────────────────────────────────────────────────────

function ProjectCreateDrawer({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: "",
    customer: "",
    work_type: "",
    location: "",
    contract_number: "",
    contract_amount: "",
    planned_cost: "",
    start_date: new Date().toISOString().slice(0, 10),
    planned_end_date: "",
    foreman: "",
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
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        contract_amount: form.contract_amount ? Number(form.contract_amount) : null,
        planned_cost: form.planned_cost ? Number(form.planned_cost) : null,
      }),
    });
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <>
      <div onClick={onClose} style={backdropStyle} />
      <aside style={{ ...drawerStyle, width: 480 }}>
        <div style={drawerHeaderStyle}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>Новый проект</h2>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Название *">
            <input autoFocus value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="АКЗ резервуаров..." style={inputStyle} />
          </Field>
          <Field label="Заказчик *">
            <input value={form.customer} onChange={e => setForm(f => ({ ...f, customer: e.target.value }))} placeholder="НПП Старт" style={inputStyle} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Тип работ">
              <select value={form.work_type} onChange={e => setForm(f => ({ ...f, work_type: e.target.value }))} style={inputStyle}>
                <option value="">—</option>
                {["АКЗ (антикоррозийная защита)", "Промальп (промышленный альпинизм)", "Бетонные работы", "Сварочные работы", "Кровельные работы", "Строительно-монтажные", "Прочее"].map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Адрес / объект">
              <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="г. Снежинск..." style={inputStyle} />
            </Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="№ договора">
              <input value={form.contract_number} onChange={e => setForm(f => ({ ...f, contract_number: e.target.value }))} placeholder="НПП-2026/..." style={inputStyle} />
            </Field>
            <Field label="Прораб">
              <input value={form.foreman} onChange={e => setForm(f => ({ ...f, foreman: e.target.value }))} placeholder="Иванов С.А." style={inputStyle} />
            </Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Сумма контракта, ₽">
              <input type="number" value={form.contract_amount} onChange={e => setForm(f => ({ ...f, contract_amount: e.target.value }))} placeholder="2 090 000" style={inputStyle} />
            </Field>
            <Field label="План себестоимости, ₽">
              <input type="number" value={form.planned_cost} onChange={e => setForm(f => ({ ...f, planned_cost: e.target.value }))} placeholder="1 850 000" style={inputStyle} />
            </Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Начало">
              <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} style={inputStyle} />
            </Field>
            <Field label="Сдача (план)">
              <input type="date" value={form.planned_end_date} onChange={e => setForm(f => ({ ...f, planned_end_date: e.target.value }))} style={inputStyle} />
            </Field>
          </div>
          <Field label="Описание">
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
          </Field>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button onClick={save} disabled={saving || !form.title || !form.customer} style={{ ...btnPrimary, opacity: saving || !form.title || !form.customer ? 0.6 : 1 }}>
              {saving ? "Сохранение..." : "Создать"}
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
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    const [pRes, sRes] = await Promise.all([
      fetch(`/api/projects?status=${encodeURIComponent(statusFilter)}`),
      fetch("/api/projects/stats"),
    ]);
    setProjects(await pRes.json());
    setStats(await sRes.json());
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1300 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Проекты</h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>
            Всё о строящихся объектах: контракты, сметы, КС-2, техника, прорабы
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <ExportButton spec="projects" />
          <button onClick={() => setShowCreate(true)} style={btnPrimary}>+ Новый проект</button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Активных проектов", value: stats.active, sub: fmtM(stats.active_amount) },
            { label: "Закрытых", value: stats.closed, sub: fmtM(stats.closed_amount) },
            { label: "Сдача < 14д", value: stats.deadline_warn.length, sub: stats.deadline_warn.length > 0 ? "Внимание!" : "Спокойно", color: stats.deadline_warn.length > 0 ? "var(--warning)" : "var(--text-tertiary)" },
            { label: "Всего", value: stats.active + stats.closed, sub: fmtM(stats.active_amount + stats.closed_amount) },
          ].map(s => (
            <div key={s.label} style={statCard}>
              <p style={statLabel}>{s.label}</p>
              <p style={{ ...statValue, color: s.color ?? "var(--text-primary)" }}>{s.value}</p>
              <p style={statSub}>{s.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Status filter */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        <FilterChip active={!statusFilter} onClick={() => setStatusFilter("")}>Все</FilterChip>
        {ALL_STATUSES.map(s => {
          const cnt = stats?.by_status.find(b => b.status === s)?.cnt ?? 0;
          if (cnt === 0 && statusFilter !== s) return null;
          return (
            <FilterChip key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>
              {s} {cnt > 0 && <span style={{ opacity: 0.6 }}>· {cnt}</span>}
            </FilterChip>
          );
        })}
      </div>

      {/* Project cards */}
      {projects.length === 0 ? (
        <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: 48, textAlign: "center" }}>
          <p style={{ fontSize: 14, color: "var(--text-tertiary)" }}>Проектов нет</p>
          <button onClick={() => setShowCreate(true)} style={{ ...btnPrimary, marginTop: 16 }}>+ Создать первый проект</button>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {projects.map(p => (
            <ProjectCard key={p.name} p={p} />
          ))}
        </div>
      )}

      {showCreate && <ProjectCreateDrawer onClose={() => setShowCreate(false)} onSaved={load} />}
    </div>
  );
}

// ── Project Card ─────────────────────────────────────────────────────────────

function ProjectCard({ p }: { p: ProjectListItem }) {
  const statusStyle = STATUS_COLORS[p.status];
  const overdue = p.days_left !== null && p.days_left < 0 && !["Закрыт", "Отменён"].includes(p.status);
  const soonClose = p.days_left !== null && p.days_left >= 0 && p.days_left <= 14;

  return (
    <Link href={`/projects/${encodeURIComponent(p.name)}`} style={{ textDecoration: "none" }}>
      <div style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 12,
        padding: "16px 20px",
        cursor: "pointer",
        transition: "all 0.15s",
      }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-subtle)"; e.currentTarget.style.transform = "translateY(0)"; }}
      >
        {/* Top row: title + status + amount */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
              <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{p.title}</p>
              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: statusStyle.bg, color: statusStyle.color, fontWeight: 600 }}>
                {p.status}
              </span>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: 0 }}>
              {p.customer}{p.location ? ` · ${p.location}` : ""}{p.foreman ? ` · Прораб: ${p.foreman}` : ""}
            </p>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
            <p style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0, fontFamily: "monospace" }}>{fmtM(p.contract_amount)}</p>
            <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: "2px 0 0" }}>контракт</p>
          </div>
        </div>

        {/* Progress bar */}
        {p.contract_amount && p.contract_amount > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                Закрыто КС-2: <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{fmtM(p.ks2_signed)}</span>
                {p.ks2_paid > 0 && <span style={{ marginLeft: 8, color: "var(--success)" }}>оплачено {fmtM(p.ks2_paid)}</span>}
              </p>
              <p style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600 }}>{p.progress_pct}%</p>
            </div>
            <div style={{ height: 4, background: "var(--border-subtle)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${p.progress_pct}%`, background: p.progress_pct >= 100 ? "var(--success)" : "var(--accent)", transition: "width 0.3s" }} />
            </div>
          </div>
        )}

        {/* Bottom row: metrics */}
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          {p.days_left !== null && (
            <Metric
              label="до сдачи"
              value={overdue ? `просроч. ${Math.abs(p.days_left)}д` : `${p.days_left}д`}
              color={overdue ? "var(--danger)" : soonClose ? "var(--warning)" : "var(--text-secondary)"}
            />
          )}
          {p.supply_total > 0 && <Metric label="снабжение" value={fmtM(p.supply_total)} />}
          {p.open_incidents > 0 && (
            <Metric label="инцидентов" value={String(p.open_incidents)} color="var(--danger)" />
          )}
          {p.work_type && <Metric label="тип" value={p.work_type.split(" (")[0] ?? ""} />}
        </div>
      </div>
    </Link>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <span style={{ fontSize: 11, color: "var(--text-tertiary)", marginRight: 4 }}>{label}:</span>
      <span style={{ fontSize: 12, color: color ?? "var(--text-secondary)", fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function FilterChip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "5px 12px", borderRadius: 8, cursor: "pointer",
      background: active ? "rgba(249,115,22,0.12)" : "var(--bg-elevated)",
      border: `1px solid ${active ? "var(--accent)" : "var(--border-subtle)"}`,
      color: active ? "var(--accent)" : "var(--text-secondary)",
      fontSize: 12, fontWeight: active ? 600 : 400,
    }}>{children}</button>
  );
}

