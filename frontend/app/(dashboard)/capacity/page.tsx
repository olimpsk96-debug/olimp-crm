"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";

interface HeatmapData {
  weeks: string[];
  crews: string[];
  cells: Record<string, { pct: number; hours: number; projects_str: string }>;
  totals_by_week: Array<{
    week: string;
    avg_pct: number;
    max_pct: number;
    overloaded_crews: string[];
    idle_crews: string[];
    active_count: number;
  }>;
  from_week: string;
}

interface Allocation {
  name: string;
  crew_name: string;
  project: string;
  project_title?: string;
  week_start: string;
  allocated_pct: number;
  planned_hours: number;
  workers_count: number;
  task_description: string;
}

interface Project { name: string; title?: string; }

function pctColor(pct: number): string {
  if (pct === 0) return "transparent";
  if (pct < 50) return "rgba(148,163,184,0.25)";        // светло-серый — простой
  if (pct < 80) return "rgba(74,222,128,0.45)";          // зелёный — норма
  if (pct <= 100) return "rgba(74,222,128,0.75)";        // насыщ. зелёный
  if (pct <= 120) return "rgba(234,179,8,0.7)";          // жёлтый
  if (pct <= 150) return "rgba(234,88,12,0.7)";          // оранжевый
  return "rgba(248,113,113,0.8)";                         // красный — критический
}

function pctTextColor(pct: number): string {
  return pct === 0 ? "var(--text-tertiary)" : "var(--text-primary)";
}

function fmtWeekShort(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}`;
}

function today(): string { return new Date().toISOString().substring(0, 10); }
function mondayOf(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const offset = d.getDay() === 0 ? -6 : 1 - d.getDay();
  d.setDate(d.getDate() + offset);
  return d.toISOString().substring(0, 10);
}

export default function CapacityPage() {
  const toast = useToast();
  const [data, setData] = useState<HeatmapData | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [fromWeek, setFromWeek] = useState<string>(mondayOf(today()));
  const [weeks, setWeeks] = useState<number>(8);
  const [editor, setEditor] = useState<Partial<Allocation> | null>(null);
  const [allocsForCell, setAllocsForCell] = useState<Allocation[] | null>(null);
  const [loading, setLoading] = useState(true);

  function reload() {
    setLoading(true);
    const p = new URLSearchParams({ mode: "heatmap", from_week: fromWeek, weeks: String(weeks) });
    fetch(`/api/capacity?${p}`)
      .then((r) => r.json())
      .then((d) => setData(d && !d.error ? d : null))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetch("/api/projects").then((r) => r.json()).then((d) => {
      if (Array.isArray(d)) setProjects(d.map((p: { name: string; title?: string }) => ({ name: p.name, title: p.title })));
    }).catch(() => {});
  }, []);

  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [fromWeek, weeks]);

  function openCell(crew: string, week: string) {
    // Подгружаем все allocations для этой ячейки
    const p = new URLSearchParams({ crew_name: crew, from_week: week, weeks: "1" });
    fetch(`/api/capacity?${p}`)
      .then((r) => r.json())
      .then((arr) => setAllocsForCell(Array.isArray(arr) ? arr : []));
  }

  return (
    <div style={{ padding: "24px 32px", minHeight: "100vh", background: "var(--bg-base)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>Загрузка бригад</h1>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4, fontFamily: "monospace" }}>
            Capacity Planning (Asana-style) · heatmap бригада × неделя · &gt;100% = перегруз
          </div>
        </div>
        <button onClick={() => setEditor({ allocated_pct: 100, week_start: mondayOf(today()) })}
                style={{
                  padding: "10px 18px", fontSize: 13, fontWeight: 500,
                  background: "var(--accent)", color: "white",
                  border: "none", borderRadius: 8, cursor: "pointer",
                }}>
          + Назначить
        </button>
      </div>

      {/* Controls */}
      <div style={{
        display: "flex", gap: 10, marginBottom: 14,
        padding: 12, background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)", borderRadius: 10,
      }}>
        <div>
          <label style={lblStyle}>С недели</label>
          <input type="date" value={fromWeek} onChange={(e) => setFromWeek(mondayOf(e.target.value))} style={inpStyle} />
        </div>
        <div>
          <label style={lblStyle}>Кол-во недель</label>
          <select value={weeks} onChange={(e) => setWeeks(parseInt(e.target.value))} style={inpStyle}>
            <option value={4}>4 недели</option>
            <option value={8}>8 недель</option>
            <option value={12}>12 недель (квартал)</option>
            <option value={26}>26 недель (полгода)</option>
          </select>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "flex-end", gap: 12, fontSize: 11, color: "var(--text-tertiary)" }}>
          <LegendDot pct={40} label="Простой" />
          <LegendDot pct={90} label="Норма" />
          <LegendDot pct={110} label="Уплотнённо" />
          <LegendDot pct={140} label="Перегруз" />
        </div>
      </div>

      {loading && <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Загрузка...</div>}

      {!loading && (!data || data.crews.length === 0) && (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)", border: "1px dashed var(--border-subtle)", borderRadius: 10 }}>
          Нет назначений. Создайте первое через «+ Назначить».
        </div>
      )}

      {!loading && data && data.crews.length > 0 && (
        <div style={{
          background: "var(--bg-elevated)", borderRadius: 10,
          border: "1px solid var(--border-subtle)", overflow: "auto",
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "var(--bg-base)", borderBottom: "1px solid var(--border-subtle)" }}>
                <th style={{ ...thStyle, position: "sticky", left: 0, background: "var(--bg-base)", zIndex: 1, minWidth: 200 }}>
                  Бригада
                </th>
                {data.weeks.map((w) => (
                  <th key={w} style={{ ...thStyle, textAlign: "center", minWidth: 80 }}>
                    {fmtWeekShort(w)}
                  </th>
                ))}
              </tr>
              <tr style={{ background: "var(--bg-base)", fontSize: 10, color: "var(--text-tertiary)" }}>
                <td style={{ ...tdStyle, padding: "3px 10px", position: "sticky", left: 0, background: "var(--bg-base)", fontFamily: "monospace" }}>
                  средняя загрузка →
                </td>
                {data.totals_by_week.map((t) => (
                  <td key={t.week} style={{ ...tdStyle, padding: "3px 5px", textAlign: "center", fontFamily: "monospace" }}>
                    {t.avg_pct > 0 ? `${Math.round(t.avg_pct)}%` : "—"}
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.crews.map((crew) => (
                <tr key={crew} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <td style={{ ...tdStyle, position: "sticky", left: 0, background: "var(--bg-elevated)", fontWeight: 500, zIndex: 1, fontSize: 13 }}>
                    {crew}
                  </td>
                  {data.weeks.map((w) => {
                    const cell = data.cells[`${crew}::${w}`];
                    const pct = cell?.pct || 0;
                    return (
                      <td key={w}
                          onClick={() => pct > 0 && openCell(crew, w)}
                          title={cell?.projects_str || ""}
                          style={{
                            padding: 0, borderLeft: "1px solid var(--border-subtle)",
                            cursor: pct > 0 ? "pointer" : "default",
                          }}>
                        <div style={{
                          padding: "10px 4px", textAlign: "center",
                          background: pctColor(pct),
                          color: pctTextColor(pct),
                          fontFamily: "monospace", fontSize: 12, fontWeight: pct > 100 ? 700 : 500,
                          minHeight: 40,
                        }}>
                          {pct > 0 ? `${Math.round(pct)}%` : ""}
                          {pct > 0 && cell?.hours ? (
                            <div style={{ fontSize: 9.5, opacity: 0.7, marginTop: 2 }}>
                              {Math.round(cell.hours)}ч
                            </div>
                          ) : null}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Warnings */}
      {!loading && data && (
        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {(() => {
            const overload: { crew: string; week: string }[] = [];
            const idle: { crew: string; week: string }[] = [];
            data.totals_by_week.forEach((t) => {
              t.overloaded_crews.forEach((c) => overload.push({ crew: c, week: t.week }));
              t.idle_crews.forEach((c) => idle.push({ crew: c, week: t.week }));
            });
            return (
              <>
                {overload.length > 0 && (
                  <div style={{ padding: 12, borderRadius: 10, background: "rgba(248,113,113,0.06)",
                                border: "1px solid rgba(248,113,113,0.3)" }}>
                    <div style={{ fontSize: 11.5, color: "var(--danger)", fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: "monospace" }}>
                      ⚠ Перегрузка ({overload.length})
                    </div>
                    {overload.slice(0, 5).map((o, i) => (
                      <div key={i} style={{ fontSize: 12, marginBottom: 2 }}>
                        🔴 <b>{o.crew}</b> — неделя {fmtWeekShort(o.week)}
                      </div>
                    ))}
                  </div>
                )}
                {idle.length > 0 && (
                  <div style={{ padding: 12, borderRadius: 10, background: "rgba(148,163,184,0.08)",
                                border: "1px solid rgba(148,163,184,0.3)" }}>
                    <div style={{ fontSize: 11.5, color: "var(--text-secondary)", fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: "monospace" }}>
                      💤 Простой / недогруз ({idle.length})
                    </div>
                    {idle.slice(0, 5).map((o, i) => (
                      <div key={i} style={{ fontSize: 12, marginBottom: 2 }}>
                        ⚪ <b>{o.crew}</b> — неделя {fmtWeekShort(o.week)}
                      </div>
                    ))}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Cell details */}
      {allocsForCell && (
        <CellDetail allocations={allocsForCell} onClose={() => setAllocsForCell(null)}
                    onEdit={(a) => { setAllocsForCell(null); setEditor(a); }}
                    onDelete={async (name) => {
                      if (!window.confirm("Удалить назначение?")) return;
                      await fetch(`/api/capacity?name=${encodeURIComponent(name)}`, { method: "DELETE" });
                      toast.success("Удалено");
                      setAllocsForCell(null);
                      reload();
                    }} />
      )}

      {editor && (
        <Editor item={editor} projects={projects}
                onClose={() => setEditor(null)}
                onSaved={() => { setEditor(null); reload(); }} />
      )}
    </div>
  );
}

function LegendDot({ pct, label }: { pct: number; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 14, height: 14, background: pctColor(pct), borderRadius: 3, border: "1px solid var(--border-subtle)" }} />
      <span>{label}</span>
    </span>
  );
}

function CellDetail({ allocations, onClose, onEdit, onDelete }: {
  allocations: Allocation[];
  onClose: () => void;
  onEdit: (a: Allocation) => void;
  onDelete: (name: string) => void;
}) {
  const total = allocations.reduce((s, a) => s + (a.allocated_pct || 0), 0);
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100,
      display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "60px 20px",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 540, background: "var(--bg-base)",
        borderRadius: 12, border: "1px solid var(--border-subtle)", padding: 20,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>
            {allocations[0]?.crew_name} — неделя {allocations[0]?.week_start}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-tertiary)", fontSize: 22, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ marginBottom: 10, fontSize: 12, color: "var(--text-tertiary)" }}>
          Суммарная загрузка: <b style={{ color: total > 100 ? "var(--danger)" : "var(--text-primary)" }}>{total}%</b>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {allocations.map((a) => (
            <div key={a.name} style={{
              padding: 10, borderRadius: 8, border: "1px solid var(--border-subtle)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>
                    {a.project_title || a.project}
                    <span style={{ marginLeft: 8, padding: "1px 7px", borderRadius: 4,
                                   background: a.allocated_pct > 100 ? "rgba(248,113,113,0.15)" : "rgba(74,222,128,0.15)",
                                   color: a.allocated_pct > 100 ? "var(--danger)" : "var(--success)",
                                   fontSize: 11, fontFamily: "monospace", fontWeight: 600 }}>
                      {a.allocated_pct}%
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2, fontFamily: "monospace" }}>
                    {a.planned_hours}ч · {a.workers_count} чел.
                  </div>
                  {a.task_description && (
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                      {a.task_description}
                    </div>
                  )}
                </div>
                <div>
                  <button onClick={() => onEdit(a)} style={{ background: "transparent", border: "1px solid var(--border-subtle)", color: "var(--text-tertiary)", padding: "3px 7px", borderRadius: 5, cursor: "pointer", marginRight: 4 }}>✎</button>
                  <button onClick={() => onDelete(a.name)} style={{ background: "transparent", border: "1px solid var(--border-subtle)", color: "var(--danger)", padding: "3px 7px", borderRadius: 5, cursor: "pointer" }}>🗑</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Editor({ item, projects, onClose, onSaved }: {
  item: Partial<Allocation>; projects: Project[]; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const [f, setF] = useState<Partial<Allocation>>(item);
  const [crewSuggestions, setCrewSuggestions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/capacity?mode=crews")
      .then((r) => r.json())
      .then((d) => setCrewSuggestions(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  async function save() {
    if (!f.crew_name?.trim()) { toast.warn("Укажите бригаду"); return; }
    if (!f.project) { toast.warn("Выберите проект"); return; }
    if (!f.week_start) { toast.warn("Укажите начало недели"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/capacity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      const d = await r.json();
      if (d.error) { toast.error(d.error); return; }
      toast.success(d.action === "created" ? "Назначено" : "Обновлено");
      onSaved();
    } finally { setSaving(false); }
  }

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100,
      display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "60px 20px",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 540, background: "var(--bg-base)",
        borderRadius: 12, border: "1px solid var(--border-subtle)", padding: 20,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 17, fontWeight: 500, margin: 0 }}>
            {item.name ? "Изменить назначение" : "Назначить бригаду"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-tertiary)", fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <Field label="Бригада / звено *">
            <input type="text" list="crews" value={f.crew_name || ""}
                   onChange={(e) => setF({ ...f, crew_name: e.target.value })}
                   placeholder="Бригада №1 / АКЗ / Промальп"
                   style={inpStyle} />
            <datalist id="crews">
              {crewSuggestions.map((c) => <option key={c} value={c} />)}
            </datalist>
          </Field>
          <Field label="Проект *">
            <select value={f.project || ""} onChange={(e) => setF({ ...f, project: e.target.value })} style={inpStyle}>
              <option value="">— не выбран —</option>
              {projects.map((p) => <option key={p.name} value={p.name}>{p.title || p.name}</option>)}
            </select>
          </Field>
          <Field label="Начало недели (Пн) *">
            <input type="date" value={(f.week_start as string) || ""}
                   onChange={(e) => setF({ ...f, week_start: e.target.value })} style={inpStyle} />
          </Field>
          <Field label="Загрузка %">
            <input type="number" min={0} max={300} value={f.allocated_pct ?? 100}
                   onChange={(e) => setF({ ...f, allocated_pct: parseFloat(e.target.value) || 0 })} style={inpStyle} />
          </Field>
          <Field label="Часы план">
            <input type="number" min={0} value={f.planned_hours ?? ""}
                   onChange={(e) => setF({ ...f, planned_hours: parseFloat(e.target.value) || 0 })} style={inpStyle} />
          </Field>
          <Field label="Кол-во рабочих">
            <input type="number" min={0} value={f.workers_count ?? ""}
                   onChange={(e) => setF({ ...f, workers_count: parseInt(e.target.value) || 0 })} style={inpStyle} />
          </Field>
        </div>

        <Field label="Какие работы">
          <input type="text" value={f.task_description || ""}
                 onChange={(e) => setF({ ...f, task_description: e.target.value })}
                 placeholder="Окраска РВС / огнезащита R90 / монтаж м/к"
                 style={inpStyle} />
        </Field>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
          <button onClick={onClose} style={{
            padding: "10px 18px", fontSize: 13,
            background: "transparent", color: "var(--text-secondary)",
            border: "1px solid var(--border-subtle)", borderRadius: 8, cursor: "pointer",
          }}>Отмена</button>
          <button onClick={save} disabled={saving} style={{
            padding: "10px 22px", fontSize: 13, fontWeight: 500,
            background: "var(--accent)", color: "white",
            border: "none", borderRadius: 8, cursor: "pointer",
            opacity: saving ? 0.6 : 1,
          }}>{saving ? "..." : "Сохранить"}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{
        display: "block", fontSize: 10.5, color: "var(--text-tertiary)",
        textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace", marginBottom: 4,
      }}>{label}</label>
      {children}
    </div>
  );
}

const inpStyle: React.CSSProperties = {
  width: "100%", padding: "9px 11px", fontSize: 13,
  background: "var(--bg-elevated)", color: "var(--text-primary)",
  border: "1px solid var(--border-subtle)", borderRadius: 7,
  outline: "none",
};
const lblStyle: React.CSSProperties = {
  display: "block", fontSize: 10.5, color: "var(--text-tertiary)",
  textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace", marginBottom: 4,
};
const thStyle: React.CSSProperties = {
  padding: "9px 10px", textAlign: "left", fontSize: 11, fontWeight: 500,
  color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em",
};
const tdStyle: React.CSSProperties = {
  padding: "10px 10px", color: "var(--text-primary)",
};
