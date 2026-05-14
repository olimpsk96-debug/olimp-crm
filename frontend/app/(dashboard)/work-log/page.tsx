"use client";

import { useCallback, useEffect, useState } from "react";
import { ExportButton } from "@/components/shared/ExportButton";

type WorkLogStatus = "Ведётся" | "Закрыт" | "Передан заказчику";

interface WorkLog {
  name: string;
  title: string;
  project: string;
  status: WorkLogStatus;
  started_date?: string;
  finished_date?: string;
  customer_name?: string;
  customer_representative?: string;
  contractor_responsible?: string;
  entries_count?: number;
  total_workers_days?: number;
  issues_count?: number;
  hidden_works_count?: number;
}

interface WorkLogEntry {
  name?: string;
  entry_date: string;
  weather?: string;
  temperature_c?: number;
  wind_ms?: number;
  shift?: string;
  workers_count?: number;
  responsible?: string;
  works_description: string;
  volume_done?: string;
  equipment_used?: string;
  materials_used?: string;
  hidden_works?: number;
  has_issues?: number;
  issues_description?: string;
  inspector_signed?: number;
}

interface WorkLogDetail extends WorkLog {
  entries: WorkLogEntry[];
}

const STATUS_COLOR: Record<WorkLogStatus, { bg: string; color: string }> = {
  "Ведётся":            { bg: "rgba(34,197,94,0.15)",  color: "var(--success)" },
  "Закрыт":             { bg: "rgba(120,120,160,0.15)", color: "var(--text-tertiary)" },
  "Передан заказчику":  { bg: "rgba(168,139,250,0.15)", color: "#a78bfa" },
};

const WEATHER_OPTIONS = ["Ясно", "Пасмурно", "Облачно", "Дождь", "Снег", "Туман", "Ветер сильный", "Грозы"];

function fmtDate(s?: string) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" });
}

export default function WorkLogPage() {
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await fetch(`/api/work-log`).then(r => r.json());
    setLogs(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ padding: 32, maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>Общий журнал работ (КС-6)</h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: "4px 0 0" }}>
            Исполнительная документация по 87-ПП РФ — записи по дням с погодой, объёмами, замечаниями
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <ExportButton spec="worklog" label="↓ Excel" />
          <button onClick={() => setShowCreate(true)} style={{
            padding: "9px 16px", borderRadius: 10, border: "none",
            background: "var(--accent)", color: "white",
            fontWeight: 500, fontSize: 13, cursor: "pointer",
          }}>+ Новый журнал</button>
        </div>
      </div>

      <div style={{ background: "var(--bg-elevated)", borderRadius: 12, border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "var(--bg-base)" }}>
            <tr>
              <th style={th}>Журнал</th>
              <th style={th}>Проект</th>
              <th style={th}>Период</th>
              <th style={th}>Записей</th>
              <th style={th}>Чел.-дней</th>
              <th style={th}>Замечаний</th>
              <th style={th}>Скрытых работ</th>
              <th style={th}>Статус</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>
                Журналов пока нет. Создайте первый — он будет вестись по дням пока проект активен.
              </td></tr>
            )}
            {logs.map(l => {
              const st = STATUS_COLOR[l.status];
              return (
                <tr key={l.name} onClick={() => setSelectedName(l.name)} style={{ borderTop: "1px solid var(--border-subtle)", cursor: "pointer" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                  <td style={td}>
                    <div style={{ fontWeight: 500 }}>{l.title}</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2, fontFamily: "monospace" }}>{l.name}</div>
                  </td>
                  <td style={{ ...td, fontSize: 12, color: "var(--text-secondary)" }}>{l.project}</td>
                  <td style={{ ...td, fontSize: 12, color: "var(--text-tertiary)" }}>
                    {fmtDate(l.started_date)}{l.finished_date ? ` — ${fmtDate(l.finished_date)}` : " — наст. время"}
                  </td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>{l.entries_count ?? 0}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{l.total_workers_days ?? 0}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: (l.issues_count ?? 0) > 0 ? "var(--warning)" : "var(--text-tertiary)" }}>{l.issues_count ?? 0}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: (l.hidden_works_count ?? 0) > 0 ? "var(--accent)" : "var(--text-tertiary)" }}>{l.hidden_works_count ?? 0}</td>
                  <td style={td}>
                    <span style={{ padding: "3px 10px", borderRadius: 8, background: st.bg, color: st.color, fontSize: 11, fontWeight: 600 }}>
                      {l.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateDrawer onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />}
      {selectedName && <LogDrawer name={selectedName} onClose={() => setSelectedName(null)} onChanged={load} />}
    </div>
  );
}

function CreateDrawer({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [projects, setProjects] = useState<{ name: string; title: string; customer?: string }[]>([]);
  const [form, setForm] = useState({
    title: "", project: "",
    started_date: new Date().toISOString().slice(0, 10),
    customer_name: "", customer_representative: "",
    contractor_name: "ООО «Олимп»", contractor_responsible: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/projects").then(r => r.json()).then(d => setProjects(Array.isArray(d) ? d : []));
  }, []);

  async function save() {
    if (!form.title.trim() || !form.project) return;
    setSaving(true);
    try {
      await fetch("/api/work-log", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      onSaved();
    } finally { setSaving(false); }
  }

  // Авто-подставить customer из проекта
  useEffect(() => {
    if (form.project && projects.length) {
      const p = projects.find(x => x.name === form.project);
      if (p?.customer && !form.customer_name) {
        setForm(f => ({ ...f, customer_name: p.customer || "", title: f.title || `Журнал работ — ${p.title}` }));
      }
    }
  }, [form.project, projects]);

  return (
    <>
      <div onClick={onClose} style={backdrop} />
      <aside style={{ ...drawer, width: 560 }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>Новый журнал работ (КС-6)</h2>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>
        <div style={{ padding: 24, flex: 1, overflowY: "auto" }}>
          <Field label="Проект *">
            <select value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} style={input}>
              <option value="">— выбрать —</option>
              {projects.map(p => <option key={p.name} value={p.name}>{p.title}</option>)}
            </select>
          </Field>
          <Field label="Название журнала *">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Общий журнал работ — Объект Х" style={input} />
          </Field>
          <Field label="Дата начала ведения *">
            <input type="date" value={form.started_date} onChange={(e) => setForm({ ...form, started_date: e.target.value })} style={input} />
          </Field>
          <p style={sectionLabel}>Стороны</p>
          <Field label="Заказчик">
            <input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} style={input} />
          </Field>
          <Field label="Представитель заказчика (тех.надзор)">
            <input value={form.customer_representative} onChange={(e) => setForm({ ...form, customer_representative: e.target.value })} placeholder="Иванов А.А., главный инженер" style={input} />
          </Field>
          <Field label="Ответственный производитель работ">
            <input value={form.contractor_responsible} onChange={(e) => setForm({ ...form, contractor_responsible: e.target.value })} placeholder="Сидоров С.С., прораб" style={input} />
          </Field>
        </div>
        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border-subtle)", display: "flex", gap: 8 }}>
          <button onClick={onClose} style={btnSecondary}>Отмена</button>
          <button onClick={save} disabled={saving || !form.title.trim() || !form.project} style={{ ...btnPrimary, opacity: (saving || !form.title.trim() || !form.project) ? 0.5 : 1 }}>
            {saving ? "Сохранение..." : "Создать журнал"}
          </button>
        </div>
      </aside>
    </>
  );
}

function LogDrawer({ name, onClose, onChanged }: { name: string; onClose: () => void; onChanged: () => void }) {
  const [data, setData] = useState<WorkLogDetail | null>(null);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [entry, setEntry] = useState<WorkLogEntry>({
    entry_date: new Date().toISOString().slice(0, 10),
    weather: "Ясно", temperature_c: 18, wind_ms: 3, shift: "1 смена",
    workers_count: 0, responsible: "", works_description: "", volume_done: "",
    equipment_used: "", materials_used: "",
    hidden_works: 0, has_issues: 0, issues_description: "",
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const d = await fetch(`/api/work-log/detail?name=${encodeURIComponent(name)}`).then(r => r.json());
    setData(d);
  }, [name]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  async function addEntry() {
    if (!entry.works_description.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/work-log/add-entry", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ log_name: name, entry }),
      });
      setShowAddEntry(false);
      setEntry({ ...entry, works_description: "", volume_done: "", issues_description: "", has_issues: 0, hidden_works: 0 });
      load();
      onChanged();
    } finally { setSaving(false); }
  }

  if (!data) return <><div onClick={onClose} style={backdrop} /><aside style={{ ...drawer, width: 800 }}><div style={{ padding: 24, color: "var(--text-tertiary)" }}>Загрузка...</div></aside></>;

  const st = STATUS_COLOR[data.status];

  return (
    <>
      <div onClick={onClose} style={backdrop} />
      <aside style={{ ...drawer, width: 800 }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <h2 style={{ margin: 0, fontSize: 17 }}>{data.title}</h2>
                <span style={{ padding: "3px 10px", borderRadius: 8, background: st.bg, color: st.color, fontSize: 11, fontWeight: 600 }}>{data.status}</span>
              </div>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: 0, fontFamily: "monospace" }}>
                {data.name} · {data.project} · с {fmtDate(data.started_date)}
              </p>
            </div>
            <button onClick={onClose} style={closeBtn}>✕</button>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <a
              href={`/api/work-log/export?name=${encodeURIComponent(data.name)}&format=pdf`}
              style={{
                padding: "7px 12px", borderRadius: 8,
                border: "1px solid var(--accent)", color: "var(--accent)",
                background: "transparent", textDecoration: "none",
                fontSize: 12, fontWeight: 500,
              }}
            >↓ PDF (КС-6, гос.форма)</a>
            <a
              href={`/api/work-log/export?name=${encodeURIComponent(data.name)}&format=xlsx`}
              style={{
                padding: "7px 12px", borderRadius: 8,
                border: "1px solid var(--success)", color: "var(--success)",
                background: "transparent", textDecoration: "none",
                fontSize: 12, fontWeight: 500,
              }}
            >↓ Excel</a>
          </div>
        </div>

        <div style={{ padding: 24, flex: 1, overflowY: "auto" }}>
          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
            <StatBox label="Записей" value={data.entries_count ?? 0} />
            <StatBox label="Чел.-дней" value={data.total_workers_days ?? 0} />
            <StatBox label="Замечаний" value={data.issues_count ?? 0} accent={(data.issues_count ?? 0) > 0 ? "var(--warning)" : undefined} />
            <StatBox label="Скрытых работ" value={data.hidden_works_count ?? 0} accent={(data.hidden_works_count ?? 0) > 0 ? "var(--accent)" : undefined} />
          </div>

          {/* Parties */}
          {(data.customer_name || data.contractor_responsible) && (
            <div style={{ padding: "10px 14px", background: "var(--bg-base)", borderRadius: 8, marginBottom: 16, fontSize: 12 }}>
              {data.customer_name && <div><b style={{ color: "var(--text-tertiary)" }}>Заказчик:</b> {data.customer_name}{data.customer_representative ? ` · тех.надзор: ${data.customer_representative}` : ""}</div>}
              {data.contractor_responsible && <div style={{ marginTop: 4 }}><b style={{ color: "var(--text-tertiary)" }}>Прораб:</b> {data.contractor_responsible}</div>}
            </div>
          )}

          {/* Add entry button */}
          {data.status === "Ведётся" && !showAddEntry && (
            <button onClick={() => setShowAddEntry(true)} style={{
              width: "100%", padding: "10px", borderRadius: 10,
              background: "rgba(249,115,22,0.1)", border: "1px solid var(--accent)", color: "var(--accent)",
              fontSize: 13, fontWeight: 500, cursor: "pointer", marginBottom: 14,
            }}>+ Добавить запись за день</button>
          )}

          {/* Add entry form */}
          {showAddEntry && (
            <div style={{ padding: "14px 16px", background: "var(--bg-base)", border: "1px solid var(--accent)", borderRadius: 10, marginBottom: 14 }}>
              <p style={sectionLabel}>Новая запись</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
                <input type="date" value={entry.entry_date} onChange={(e) => setEntry({ ...entry, entry_date: e.target.value })} style={miniInput} />
                <select value={entry.weather} onChange={(e) => setEntry({ ...entry, weather: e.target.value })} style={miniInput}>
                  {WEATHER_OPTIONS.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
                <input type="number" placeholder="T °C" value={entry.temperature_c ?? ""} onChange={(e) => setEntry({ ...entry, temperature_c: e.target.value ? Number(e.target.value) : undefined })} style={miniInput} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
                <select value={entry.shift} onChange={(e) => setEntry({ ...entry, shift: e.target.value })} style={miniInput}>
                  <option>1 смена</option><option>2 смена</option><option>Ночная</option>
                </select>
                <input type="number" placeholder="Рабочих" value={entry.workers_count ?? 0} onChange={(e) => setEntry({ ...entry, workers_count: Number(e.target.value) })} style={miniInput} />
                <input placeholder="Бригадир/отв." value={entry.responsible} onChange={(e) => setEntry({ ...entry, responsible: e.target.value })} style={miniInput} />
              </div>
              <textarea rows={2} placeholder="Выполненные работы (что именно делали)" value={entry.works_description} onChange={(e) => setEntry({ ...entry, works_description: e.target.value })} style={{ ...miniInput, fontFamily: "inherit", resize: "vertical" }} />
              <input placeholder="Объём (с единицей: 120 м², 4 секции)" value={entry.volume_done} onChange={(e) => setEntry({ ...entry, volume_done: e.target.value })} style={miniInput} />
              <input placeholder="Применённая техника (кран КС-3577, компрессор...)" value={entry.equipment_used} onChange={(e) => setEntry({ ...entry, equipment_used: e.target.value })} style={miniInput} />
              <input placeholder="Израсходованные материалы (грунт 18 кг, эмаль 5 кг)" value={entry.materials_used} onChange={(e) => setEntry({ ...entry, materials_used: e.target.value })} style={miniInput} />
              <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
                <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                  <input type="checkbox" checked={!!entry.hidden_works} onChange={(e) => setEntry({ ...entry, hidden_works: e.target.checked ? 1 : 0 })} />
                  Скрытые работы (требуют акта)
                </label>
                <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                  <input type="checkbox" checked={!!entry.has_issues} onChange={(e) => setEntry({ ...entry, has_issues: e.target.checked ? 1 : 0 })} />
                  Есть замечания
                </label>
              </div>
              {!!entry.has_issues && (
                <textarea rows={2} placeholder="Описание замечаний / отклонений от проекта" value={entry.issues_description} onChange={(e) => setEntry({ ...entry, issues_description: e.target.value })} style={{ ...miniInput, fontFamily: "inherit", resize: "vertical", marginTop: 8 }} />
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button onClick={() => setShowAddEntry(false)} style={btnSecondary}>Отмена</button>
                <button onClick={addEntry} disabled={saving || !entry.works_description.trim()} style={{ ...btnPrimary, opacity: (saving || !entry.works_description.trim()) ? 0.5 : 1 }}>
                  {saving ? "Сохранение..." : "Добавить запись"}
                </button>
              </div>
            </div>
          )}

          {/* Entries */}
          <p style={sectionLabel}>Записи журнала ({data.entries.length})</p>
          <div style={{ background: "var(--bg-base)", border: "1px solid var(--border-subtle)", borderRadius: 8, overflow: "hidden" }}>
            {data.entries.length === 0 ? (
              <div style={{ padding: 24, color: "var(--text-tertiary)", textAlign: "center", fontSize: 13 }}>Записей ещё нет</div>
            ) : data.entries.map((e, i) => (
              <div key={i} style={{ padding: "12px 16px", borderTop: i > 0 ? "1px solid var(--border-subtle)" : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 10, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", gap: 10, fontSize: 12, color: "var(--text-tertiary)", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>📅 {fmtDate(e.entry_date)}</span>
                    <span>· {e.weather ?? "—"} · {e.temperature_c ?? "—"} °C</span>
                    <span>· {e.shift ?? "—"}</span>
                    <span>· 👷 {e.workers_count ?? 0} чел.</span>
                    {e.responsible && <span>· {e.responsible}</span>}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {!!e.hidden_works && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "rgba(249,115,22,0.15)", color: "var(--accent)" }}>скрытые работы</span>}
                    {!!e.has_issues && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "rgba(251,191,36,0.15)", color: "var(--warning)" }}>замечания</span>}
                    {!!e.inspector_signed && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "rgba(34,197,94,0.15)", color: "var(--success)" }}>✓ подписано</span>}
                  </div>
                </div>
                <div style={{ fontSize: 13, color: "var(--text-primary)", marginBottom: 4 }}>{e.works_description}</div>
                {e.volume_done && <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Объём: {e.volume_done}</div>}
                {e.equipment_used && <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Техника: {e.equipment_used}</div>}
                {e.materials_used && <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Материалы: {e.materials_used}</div>}
                {e.issues_description && <div style={{ marginTop: 6, padding: 8, background: "rgba(251,191,36,0.08)", borderLeft: "2px solid var(--warning)", fontSize: 12 }}>⚠️ {e.issues_description}</div>}
              </div>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}

function StatBox({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div style={{ padding: "10px 12px", background: "var(--bg-base)", border: "1px solid var(--border-subtle)", borderRadius: 8 }}>
      <p style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0, fontFamily: "monospace" }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 600, color: accent ?? "var(--text-primary)", margin: "4px 0 0", fontFamily: "monospace" }}>{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 12 }}>
    <label style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4, fontFamily: "monospace" }}>{label}</label>
    {children}
  </div>;
}

const th: React.CSSProperties = { padding: "11px 12px", textAlign: "left", fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "monospace", fontWeight: 500 };
const td: React.CSSProperties = { padding: "11px 12px" };
const sectionLabel: React.CSSProperties = { fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "16px 0 8px", fontFamily: "monospace" };
const input: React.CSSProperties = { width: "100%", padding: "8px 10px", background: "var(--bg-base)", border: "1px solid var(--border-subtle)", borderRadius: 8, color: "var(--text-primary)", fontSize: 13, outline: "none" };
const miniInput: React.CSSProperties = { width: "100%", padding: "6px 10px", marginBottom: 6, background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 6, color: "var(--text-primary)", fontSize: 12, outline: "none" };
const backdrop: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 40, backdropFilter: "blur(2px)" };
const drawer: React.CSSProperties = { position: "fixed", top: 0, right: 0, bottom: 0, background: "var(--bg-elevated)", borderLeft: "1px solid var(--border-subtle)", zIndex: 50, display: "flex", flexDirection: "column", overflow: "hidden" };
const closeBtn: React.CSSProperties = { width: 28, height: 28, borderRadius: 8, border: "1px solid var(--border-subtle)", background: "transparent", color: "var(--text-tertiary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 };
const btnSecondary: React.CSSProperties = { padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer" };
const btnPrimary: React.CSSProperties = { padding: "8px 14px", borderRadius: 8, border: "none", background: "var(--accent)", color: "white", fontSize: 13, cursor: "pointer", fontWeight: 500, flex: 1 };
