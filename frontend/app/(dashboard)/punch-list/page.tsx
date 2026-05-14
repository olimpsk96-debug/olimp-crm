"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  PunchListItem,
  PunchListStats,
  PunchListStatus,
  PunchListUrgency,
  PunchListItemType,
} from "@/types/punchlist";

const STATUS_COLOR: Record<PunchListStatus, { bg: string; color: string }> = {
  "Открыто":            { bg: "rgba(248,113,113,0.12)", color: "var(--danger)" },
  "В работе":           { bg: "rgba(251,191,36,0.12)",  color: "var(--warning)" },
  "Выполнено":          { bg: "rgba(34,197,94,0.14)",   color: "var(--success)" },
  "Принято заказчиком": { bg: "rgba(168,139,250,0.15)", color: "#a78bfa" },
  "Отменено":           { bg: "rgba(120,120,160,0.12)", color: "var(--text-tertiary)" },
};

const URGENCY_COLOR: Record<PunchListUrgency, string> = {
  "Низкая":   "var(--text-tertiary)",
  "Средняя":  "var(--text-secondary)",
  "Высокая":  "var(--warning)",
  "Критично": "var(--danger)",
};

const URGENCY_OPTIONS: PunchListUrgency[] = ["Низкая", "Средняя", "Высокая", "Критично"];
const STATUS_OPTIONS: PunchListStatus[] = ["Открыто", "В работе", "Выполнено", "Принято заказчиком", "Отменено"];
const TYPE_OPTIONS: PunchListItemType[] = [
  "Дефект", "Доделка", "Замечание заказчика", "Корректировка проекта", "Подготовка к сдаче",
];

type QuickFilter = "all" | "open" | "in_progress" | "overdue" | "critical";

function fmtDate(s?: string): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" });
}

function isOverdue(item: PunchListItem): boolean {
  if (!item.due_date) return false;
  if (item.status === "Выполнено" || item.status === "Принято заказчиком" || item.status === "Отменено") return false;
  return new Date(item.due_date) < new Date(new Date().toISOString().slice(0, 10));
}

function daysOverdue(item: PunchListItem): number {
  if (!item.due_date) return 0;
  const today = new Date(new Date().toISOString().slice(0, 10));
  const due = new Date(item.due_date);
  return Math.floor((today.getTime() - due.getTime()) / 86400000);
}

export default function PunchListPage() {
  const [items, setItems] = useState<PunchListItem[]>([]);
  const [stats, setStats] = useState<PunchListStats | null>(null);
  const [projects, setProjects] = useState<{ name: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Фильтры
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  // Drawers
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(null);

  // Debounce поиска
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (projectFilter) params.set("project", projectFilter);
    if (urgencyFilter) params.set("urgency", urgencyFilter);
    if (typeFilter) params.set("item_type", typeFilter);

    const [listRes, statsRes] = await Promise.all([
      fetch(`/api/punch-list?${params}`).then(r => r.json()),
      fetch(`/api/punch-list/stats${projectFilter ? `?project=${encodeURIComponent(projectFilter)}` : ""}`).then(r => r.json()),
    ]);
    setItems(Array.isArray(listRes) ? listRes : []);
    setStats(statsRes && !statsRes.error ? statsRes : null);
    setLoading(false);
  }, [projectFilter, urgencyFilter, typeFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch("/api/projects").then(r => r.json()).then(d => setProjects(Array.isArray(d) ? d : []));
  }, []);

  // Применяем quick-filter и search клиентски
  const filtered = useMemo(() => {
    return items.filter(it => {
      // quick filter
      if (quickFilter === "open" && it.status !== "Открыто") return false;
      if (quickFilter === "in_progress" && it.status !== "В работе") return false;
      if (quickFilter === "overdue" && !isOverdue(it)) return false;
      if (quickFilter === "critical" && !(it.urgency === "Критично" && it.status !== "Выполнено" && it.status !== "Принято заказчиком" && it.status !== "Отменено")) return false;

      // search
      if (debouncedSearch) {
        const haystack = [it.title, it.location, it.assignee].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(debouncedSearch)) return false;
      }
      return true;
    });
  }, [items, quickFilter, debouncedSearch]);

  async function changeStatus(name: string, status: PunchListStatus) {
    await fetch(`/api/punch-list/${name}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  return (
    <div style={{ padding: "24px 32px", minHeight: "100vh", background: "var(--bg-base)" }}>
      {/* Header */}
      <div style={{ marginBottom: 20, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>Доделки · Punch List</h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>
            Список замечаний и недоделок по объектам — то, что нужно устранить перед сдачей
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          style={{
            padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 500,
            background: "var(--accent)", color: "white", border: "none", cursor: "pointer",
          }}
        >
          + Новая доделка
        </button>
      </div>

      {/* KPI / quick filters */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 16 }}>
        <KPIButton
          label="Всего"
          value={stats?.total ?? "—"}
          active={quickFilter === "all"}
          onClick={() => setQuickFilter("all")}
          color="var(--text-primary)"
        />
        <KPIButton
          label="Открыто"
          value={stats?.open ?? "—"}
          active={quickFilter === "open"}
          onClick={() => setQuickFilter("open")}
          color="var(--danger)"
        />
        <KPIButton
          label="В работе"
          value={stats?.in_progress ?? "—"}
          active={quickFilter === "in_progress"}
          onClick={() => setQuickFilter("in_progress")}
          color="var(--warning)"
        />
        <KPIButton
          label="Просрочено"
          value={stats?.overdue ?? "—"}
          active={quickFilter === "overdue"}
          onClick={() => setQuickFilter("overdue")}
          color="var(--danger)"
          highlight="rgba(248,113,113,0.08)"
        />
        <KPIButton
          label="Критично"
          value={stats?.critical ?? "—"}
          active={quickFilter === "critical"}
          onClick={() => setQuickFilter("critical")}
          color="#f97316"
          highlight="rgba(249,115,22,0.08)"
        />
      </div>

      {/* Filters bar */}
      <div style={{
        display: "flex", gap: 10, marginBottom: 16, padding: 12,
        background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 12,
        flexWrap: "wrap",
      }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по описанию, локации, исполнителю..."
          style={{ ...inputStyle, flex: "1 1 240px", minWidth: 200 }}
        />
        <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} style={{ ...inputStyle, flex: "0 1 180px" }}>
          <option value="">Все проекты</option>
          {projects.map(p => <option key={p.name} value={p.name}>{p.title}</option>)}
        </select>
        <select value={urgencyFilter} onChange={(e) => setUrgencyFilter(e.target.value)} style={{ ...inputStyle, flex: "0 1 140px" }}>
          <option value="">Все срочности</option>
          {URGENCY_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ ...inputStyle, flex: "0 1 180px" }}>
          <option value="">Все типы</option>
          {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={{
        background: "var(--bg-elevated)", borderRadius: 12,
        border: "1px solid var(--border-subtle)", overflow: "hidden",
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "var(--bg-base)" }}>
            <tr>
              <th style={th}>Что нужно сделать</th>
              <th style={th}>Проект</th>
              <th style={th}>Срочность</th>
              <th style={th}>Ответственный</th>
              <th style={th}>Срок</th>
              <th style={th}>Статус</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Загрузка...</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>
                Доделок не найдено. {items.length > 0 && "Снимите фильтры или измените запрос."}
              </td></tr>
            )}
            {!loading && filtered.map((it) => {
              const stColor = STATUS_COLOR[it.status];
              const overdue = isOverdue(it);
              return (
                <tr key={it.name}
                  onClick={() => setSelectedName(it.name)}
                  style={{ borderTop: "1px solid var(--border-subtle)", cursor: "pointer" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                  <td style={td}>
                    <div style={{ fontWeight: 500, color: "var(--text-primary)" }}>{it.title}</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2, fontFamily: "monospace" }}>
                      {it.name}{it.location ? ` · ${it.location}` : ""}
                    </div>
                  </td>
                  <td style={{ ...td, fontSize: 12, color: "var(--text-secondary)" }}>{it.project}</td>
                  <td style={td}>
                    <span style={{
                      padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 500,
                      border: `1px solid ${URGENCY_COLOR[it.urgency]}`,
                      color: URGENCY_COLOR[it.urgency],
                    }}>
                      {it.urgency}
                    </span>
                  </td>
                  <td style={{ ...td, fontSize: 12, color: "var(--text-secondary)" }}>{it.assignee || "—"}</td>
                  <td style={{ ...td, fontSize: 12, fontFamily: "monospace", color: overdue ? "var(--danger)" : "var(--text-tertiary)", fontWeight: overdue ? 600 : 400 }}>
                    {fmtDate(it.due_date)}
                    {overdue && <div style={{ fontSize: 10 }}>просрочено {daysOverdue(it)}д</div>}
                  </td>
                  <td style={td}>
                    <span style={{ padding: "3px 10px", borderRadius: 8, background: stColor.bg, color: stColor.color, fontSize: 11, fontWeight: 600 }}>
                      {it.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {createOpen && (
        <CreateDrawer
          projects={projects}
          onClose={() => setCreateOpen(false)}
          onSaved={() => { setCreateOpen(false); load(); }}
        />
      )}
      {selectedName && (
        <DetailDrawer
          name={selectedName}
          onClose={() => setSelectedName(null)}
          onChange={() => load()}
          onChangeStatus={(s) => changeStatus(selectedName, s)}
        />
      )}
    </div>
  );
}

// ── KPI button ───────────────────────────────────────────────────────────────
function KPIButton({
  label, value, active, onClick, color, highlight,
}: {
  label: string; value: number | string; active: boolean;
  onClick: () => void; color: string; highlight?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "12px 16px", borderRadius: 12,
        background: active ? (highlight ?? "rgba(255,255,255,0.06)") : "var(--bg-elevated)",
        border: `1px solid ${active ? color : "var(--border-subtle)"}`,
        cursor: "pointer", textAlign: "left",
        transition: "all 0.15s ease",
      }}
    >
      <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace" }}>{label}</p>
      <p style={{ fontSize: 20, fontWeight: 600, color, margin: "4px 0 0", fontFamily: "monospace" }}>{value}</p>
    </button>
  );
}

// ── Create Drawer ────────────────────────────────────────────────────────────
function CreateDrawer({
  projects, onClose, onSaved,
}: {
  projects: { name: string; title: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    title: "",
    project: "",
    item_type: "Доделка" as PunchListItemType,
    urgency: "Средняя" as PunchListUrgency,
    status: "Открыто" as PunchListStatus,
    location: "",
    assignee: "",
    reported_by: "",
    reported_date: new Date().toISOString().slice(0, 10),
    due_date: "",
    description: "",
    cost_estimate: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  async function save() {
    if (!form.title.trim()) { setError("Укажите что нужно сделать"); return; }
    if (!form.project) { setError("Укажите проект"); return; }
    setSaving(true); setError(null);
    try {
      const payload: Record<string, unknown> = { ...form };
      if (form.cost_estimate) payload.cost_estimate = parseFloat(form.cost_estimate);
      else delete payload.cost_estimate;
      if (!form.due_date) delete payload.due_date;

      const res = await fetch("/api/punch-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      onSaved();
    } catch { setError("Ошибка соединения"); }
    finally { setSaving(false); }
  }

  return (
    <>
      <div onClick={onClose} style={backdrop} />
      <aside style={{ ...drawer, width: 560 }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17 }}>Новая доделка</h2>
            <p style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 2 }}>
              Замечание, дефект или подготовка к сдаче
            </p>
          </div>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>

        <div style={{ padding: 24, flex: 1, overflowY: "auto" }}>
          <Field label="Что нужно сделать *">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Подкрасить трещину у входа..." style={inputStyle} autoFocus />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Проект *">
              <select value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} style={inputStyle}>
                <option value="">— выбрать —</option>
                {projects.map(p => <option key={p.name} value={p.name}>{p.title}</option>)}
              </select>
            </Field>
            <Field label="Тип">
              <select value={form.item_type} onChange={(e) => setForm({ ...form, item_type: e.target.value as PunchListItemType })} style={inputStyle}>
                {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Срочность">
              <select value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value as PunchListUrgency })}
                style={{ ...inputStyle, color: URGENCY_COLOR[form.urgency], borderColor: URGENCY_COLOR[form.urgency] }}>
                {URGENCY_OPTIONS.map(u => <option key={u} value={u} style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>{u}</option>)}
              </select>
            </Field>
            <Field label="Срок устранения">
              <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} style={inputStyle} />
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Локация на объекте">
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="корпус 3, фасад восток" style={inputStyle} />
            </Field>
            <Field label="Ответственный (ФИО)">
              <input value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })}
                placeholder="Петров А.П." style={inputStyle} />
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Кем выявлено">
              <input value={form.reported_by} onChange={(e) => setForm({ ...form, reported_by: e.target.value })}
                placeholder="Заказчик / Прораб / Инженер" style={inputStyle} />
            </Field>
            <Field label="Стоимость работ, ₽">
              <input type="number" inputMode="decimal" value={form.cost_estimate}
                onChange={(e) => setForm({ ...form, cost_estimate: e.target.value })}
                placeholder="0" style={inputStyle} />
            </Field>
          </div>

          <Field label="Описание">
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Что и почему нужно сделать..."
              style={{ ...inputStyle, resize: "vertical", minHeight: 80 }} />
          </Field>

          {error && (
            <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "var(--danger)", fontSize: 12.5 }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border-subtle)", display: "flex", gap: 8 }}>
          <button onClick={onClose} style={btnSecondary}>Отмена</button>
          <button onClick={save} disabled={saving || !form.title.trim() || !form.project}
            style={{ ...btnPrimary, opacity: (saving || !form.title.trim() || !form.project) ? 0.5 : 1 }}>
            {saving ? "Сохранение..." : "Создать"}
          </button>
        </div>
      </aside>
    </>
  );
}

// ── Detail Drawer ────────────────────────────────────────────────────────────
function DetailDrawer({
  name, onClose, onChange, onChangeStatus,
}: {
  name: string;
  onClose: () => void;
  onChange: () => void;
  onChangeStatus: (s: PunchListStatus) => void;
}) {
  const [data, setData] = useState<PunchListItem | null>(null);
  const [uploading, setUploading] = useState<"before" | "after" | null>(null);
  const [solutionNotes, setSolutionNotes] = useState("");

  const load = useCallback(async () => {
    const d = await fetch(`/api/punch-list/${name}`).then(r => r.json());
    setData(d);
    setSolutionNotes(d?.solution_notes || "");
  }, [name]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  async function uploadPhoto(kind: "before" | "after", file: File) {
    setUploading(kind);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("is_private", "0");
      fd.append("doctype", "Punch List Item");
      fd.append("docname", name);
      fd.append("fieldname", kind === "before" ? "photo_before" : "photo_after");
      // Прямой upload в Frappe через прокси /api/method/upload_file требует csrf;
      // используем серверный upload через /api/punch-list/[name] PUT с уже-загруженным URL.
      // Простейший вариант — base64 как Attach.
      const reader = new FileReader();
      const base64: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const fieldName = kind === "before" ? "photo_before" : "photo_after";
      await fetch(`/api/punch-list/${name}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [fieldName]: base64 }),
      });
      await load();
      onChange();
    } finally {
      setUploading(null);
    }
  }

  async function saveSolutionNotes() {
    await fetch(`/api/punch-list/${name}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ solution_notes: solutionNotes }),
    });
    await load();
    onChange();
  }

  if (!data) {
    return (
      <>
        <div onClick={onClose} style={backdrop} />
        <aside style={{ ...drawer, width: 640 }}>
          <div style={{ padding: 24, color: "var(--text-tertiary)" }}>Загрузка...</div>
        </aside>
      </>
    );
  }

  const stColor = STATUS_COLOR[data.status];
  const overdue = isOverdue(data);

  return (
    <>
      <div onClick={onClose} style={backdrop} />
      <aside style={{ ...drawer, width: 640 }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, fontSize: 17 }}>{data.title}</h2>
                <span style={{
                  padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 500,
                  border: `1px solid ${URGENCY_COLOR[data.urgency]}`,
                  color: URGENCY_COLOR[data.urgency],
                }}>{data.urgency}</span>
              </div>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: 0, fontFamily: "monospace" }}>
                {data.name} · {data.project} · {data.item_type}
              </p>
            </div>
            <button onClick={onClose} style={closeBtn}>✕</button>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Статус:</span>
            <select
              value={data.status}
              onChange={(e) => onChangeStatus(e.target.value as PunchListStatus)}
              style={{
                padding: "5px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: stColor.bg, color: stColor.color, border: `1px solid ${stColor.color}`,
                cursor: "pointer", outline: "none",
              }}
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s} style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>{s}</option>
              ))}
            </select>
            {data.completed_date && (
              <span style={{ fontSize: 11, color: "var(--success)", fontFamily: "monospace" }}>
                Выполнено {fmtDate(data.completed_date)}
              </span>
            )}
          </div>
        </div>

        <div style={{ padding: 24, flex: 1, overflowY: "auto" }}>
          {/* Сводка */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <InfoRow label="Срок устранения"
              value={fmtDate(data.due_date)}
              accent={overdue ? "var(--danger)" : undefined}
              hint={overdue ? `просрочено ${daysOverdue(data)}д` : undefined} />
            <InfoRow label="Дата выявления" value={fmtDate(data.reported_date)} />
            <InfoRow label="Локация" value={data.location || "—"} />
            <InfoRow label="Ответственный" value={data.assignee || "—"} />
            <InfoRow label="Кем выявлено" value={data.reported_by || "—"} />
            <InfoRow label="Стоимость, ₽" value={data.cost_estimate ? data.cost_estimate.toLocaleString("ru-RU") : "—"} />
          </div>

          {data.description && (
            <div style={{ marginBottom: 16 }}>
              <p style={sectionLabel}>Описание</p>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", whiteSpace: "pre-wrap", margin: 0 }}>{data.description}</p>
            </div>
          )}

          {/* Solution notes */}
          <div style={{ marginBottom: 16 }}>
            <p style={sectionLabel}>Что сделано</p>
            <textarea
              value={solutionNotes}
              onChange={(e) => setSolutionNotes(e.target.value)}
              onBlur={saveSolutionNotes}
              placeholder="Заполняет исполнитель — что именно сделали, как..."
              style={{ ...inputStyle, resize: "vertical", minHeight: 60 }}
            />
          </div>

          {/* Photos */}
          <p style={sectionLabel}>Фото</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <PhotoSlot
              label="До"
              url={data.photo_before}
              loading={uploading === "before"}
              onUpload={(f) => uploadPhoto("before", f)}
            />
            <PhotoSlot
              label="После"
              url={data.photo_after}
              loading={uploading === "after"}
              onUpload={(f) => uploadPhoto("after", f)}
            />
          </div>
        </div>
      </aside>
    </>
  );
}

function PhotoSlot({
  label, url, loading, onUpload,
}: {
  label: string; url?: string; loading: boolean; onUpload: (f: File) => void;
}) {
  return (
    <div style={{
      padding: 12, borderRadius: 10, background: "var(--bg-base)",
      border: "1px solid var(--border-subtle)",
    }}>
      <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: "0 0 8px", textTransform: "uppercase", fontFamily: "monospace", letterSpacing: "0.06em" }}>Фото {label}</p>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={`Фото ${label}`} style={{ width: "100%", borderRadius: 8, marginBottom: 8, maxHeight: 220, objectFit: "cover" }} />
      ) : (
        <div style={{
          height: 120, borderRadius: 8, background: "var(--bg-elevated)",
          border: "1px dashed var(--border-subtle)", display: "flex",
          alignItems: "center", justifyContent: "center",
          color: "var(--text-tertiary)", fontSize: 12, marginBottom: 8,
        }}>
          Нет фото
        </div>
      )}
      <label style={{
        display: "inline-block", padding: "6px 12px", borderRadius: 8,
        border: "1px solid var(--accent)", color: "var(--accent)",
        fontSize: 12, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.5 : 1,
      }}>
        {loading ? "Загрузка..." : (url ? "Заменить" : "Загрузить")}
        <input type="file" accept="image/*" style={{ display: "none" }}
          disabled={loading}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />
      </label>
    </div>
  );
}

function InfoRow({ label, value, accent, hint }: { label: string; value: string; accent?: string; hint?: string }) {
  return (
    <div>
      <p style={{ fontSize: 10.5, color: "var(--text-tertiary)", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace" }}>{label}</p>
      <p style={{ fontSize: 13, color: accent ?? "var(--text-primary)", margin: "3px 0 0", fontFamily: "monospace", fontWeight: accent ? 600 : 400 }}>
        {value}
        {hint && <span style={{ marginLeft: 6, fontSize: 11, color: accent ?? "var(--text-tertiary)" }}>· {hint}</span>}
      </p>
    </div>
  );
}

// ── Field wrapper ────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4, fontFamily: "monospace" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 10px", background: "var(--bg-base)",
  border: "1px solid var(--border-subtle)", borderRadius: 8,
  color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box",
};
const th: React.CSSProperties = {
  padding: "11px 12px", textAlign: "left", fontSize: 11,
  color: "var(--text-tertiary)", textTransform: "uppercase",
  letterSpacing: "0.06em", fontFamily: "monospace", fontWeight: 500,
};
const td: React.CSSProperties = { padding: "11px 12px" };
const sectionLabel: React.CSSProperties = {
  fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase",
  letterSpacing: "0.06em", margin: "0 0 8px", fontFamily: "monospace",
};
const backdrop: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
  zIndex: 40, backdropFilter: "blur(2px)",
};
const drawer: React.CSSProperties = {
  position: "fixed", top: 0, right: 0, bottom: 0,
  background: "var(--bg-elevated)", borderLeft: "1px solid var(--border-subtle)",
  zIndex: 50, display: "flex", flexDirection: "column", overflow: "hidden",
};
const closeBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 8, border: "1px solid var(--border-subtle)",
  background: "transparent", color: "var(--text-tertiary)", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
};
const btnSecondary: React.CSSProperties = {
  padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border-subtle)",
  background: "transparent", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer",
};
const btnPrimary: React.CSSProperties = {
  padding: "8px 14px", borderRadius: 8, border: "none", background: "var(--accent)",
  color: "white", fontSize: 13, cursor: "pointer", fontWeight: 500, flex: 1,
};
