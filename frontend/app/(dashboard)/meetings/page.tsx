"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  Meeting, MeetingAttendee, MeetingItem, MeetingItemStatus,
  MeetingStatus, MeetingType, MeetingStats, OpenMeetingItem,
} from "@/types/meeting";

const MEETING_TYPES: MeetingType[] = [
  "Утренняя планёрка", "Еженедельная", "С заказчиком", "С поставщиком",
  "По ОТ-ТБ", "Разбор инцидента", "Прочая",
];

const STATUS_COLOR: Record<MeetingStatus, { bg: string; color: string }> = {
  "Запланирована": { bg: "rgba(120,120,160,0.15)", color: "var(--text-tertiary)" },
  "Проведена":     { bg: "rgba(34,197,94,0.15)",   color: "var(--success)" },
  "Отменена":      { bg: "rgba(239,68,68,0.15)",   color: "var(--danger)" },
};

const ITEM_STATUSES: MeetingItemStatus[] = ["Открыто", "В работе", "Выполнено", "Отменено"];
const ITEM_COLOR: Record<MeetingItemStatus, string> = {
  "Открыто":   "var(--warning)",
  "В работе":  "var(--accent)",
  "Выполнено": "var(--success)",
  "Отменено":  "var(--text-tertiary)",
};

function fmtDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}

export default function MeetingsPage() {
  const [list, setList] = useState<Meeting[]>([]);
  const [openItems, setOpenItems] = useState<OpenMeetingItem[]>([]);
  const [stats, setStats] = useState<MeetingStats | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [tab, setTab] = useState<"meetings" | "open">("meetings");

  const load = useCallback(async () => {
    const [meetings, openList, st] = await Promise.all([
      fetch(`/api/meetings`).then(r => r.json()),
      fetch(`/api/meetings/open-items?days=60`).then(r => r.json()),
      fetch(`/api/meetings/stats?days=30`).then(r => r.json()),
    ]);
    setList(Array.isArray(meetings) ? meetings : []);
    setOpenItems(Array.isArray(openList) ? openList : []);
    setStats(st && typeof st === "object" && "days" in st ? st : null);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function changeItemStatus(meeting: string, itemIdx: number, status: MeetingItemStatus) {
    await fetch("/api/meetings/item-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meeting, item_idx: itemIdx, status }),
    });
    load();
  }

  return (
    <div style={{ padding: 32, maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>Планёрки</h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: "4px 0 0" }}>
            Совещания с протоколом и поручениями — что обсудили, кто что обещал, к какому сроку
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} style={{
          padding: "9px 16px", borderRadius: 10, border: "none",
          background: "var(--accent)", color: "white",
          fontWeight: 500, fontSize: 13, cursor: "pointer",
        }}>+ Новая планёрка</button>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
          <Kpi label="За 30 дн." value={stats.total_meetings} hint={`${stats.held} проведено`} />
          <Kpi label="Открыто" value={stats.items_by_status["Открыто"] || 0} accent="var(--warning)" />
          <Kpi label="В работе" value={stats.items_by_status["В работе"] || 0} accent="var(--accent)" />
          <Kpi label="Просрочено" value={stats.overdue_items} accent={stats.overdue_items > 0 ? "var(--danger)" : undefined} />
        </div>
      )}

      {/* Tabs */}
      <div style={{ borderBottom: "1px solid var(--border-subtle)", marginBottom: 16, display: "flex", gap: 12 }}>
        {(["meetings", "open"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "10px 14px", background: "transparent", border: "none",
            borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
            color: tab === t ? "var(--accent)" : "var(--text-secondary)",
            fontSize: 13, fontWeight: tab === t ? 600 : 400, cursor: "pointer",
          }}>
            {t === "meetings" ? "Планёрки" : `Открытые поручения (${openItems.length})`}
          </button>
        ))}
      </div>

      {/* Meetings list */}
      {tab === "meetings" && (
        <div style={{ background: "var(--bg-elevated)", borderRadius: 12, border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
          {list.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>
              Планёрок пока нет
            </div>
          ) : list.map((mt, i) => {
            const st = STATUS_COLOR[mt.status];
            return (
              <div key={mt.name} onClick={() => setSelectedName(mt.name)} style={{
                padding: "14px 20px", cursor: "pointer",
                borderTop: i > 0 ? "1px solid var(--border-subtle)" : "none",
                display: "grid", gridTemplateColumns: "minmax(0,3fr) 130px 110px 100px", gap: 16, alignItems: "center",
              }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mt.title}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2, fontFamily: "monospace" }}>
                    {mt.name} · {mt.meeting_type}{mt.project ? ` · ${mt.project}` : ""}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {fmtDate(mt.meeting_date)}{mt.start_time ? ` ${mt.start_time.slice(0, 5)}` : ""}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                  {mt.location || "—"}
                </div>
                <span style={{ padding: "3px 10px", borderRadius: 8, background: st.bg, color: st.color, fontSize: 11, fontWeight: 600, justifySelf: "start" }}>
                  {mt.status}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Open items list */}
      {tab === "open" && (
        <div style={{ background: "var(--bg-elevated)", borderRadius: 12, border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
          {openItems.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>
              Открытых поручений нет
            </div>
          ) : openItems.map((o, i) => (
            <div key={`${o.meeting}-${o.item_idx}`} style={{
              padding: "14px 20px",
              borderTop: i > 0 ? "1px solid var(--border-subtle)" : "none",
              display: "grid", gridTemplateColumns: "minmax(0,3fr) 130px 110px 110px 120px", gap: 14, alignItems: "center",
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.topic}</div>
                {o.decision && <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>→ {o.decision}</div>}
                <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", marginTop: 2, fontFamily: "monospace" }}>
                  из {o.meeting_title} ({fmtDate(o.meeting_date)})
                </div>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{o.responsible || "—"}</div>
              <div style={{ fontSize: 12, color: o.overdue ? "var(--danger)" : "var(--text-secondary)", fontWeight: o.overdue ? 600 : 400 }}>
                {o.due_date ? fmtDate(o.due_date) : "—"}
                {o.overdue && <div style={{ fontSize: 10 }}>просрочено {Math.abs(o.days_to_due || 0)}д</div>}
                {!o.overdue && o.days_to_due !== null && o.days_to_due !== undefined && o.days_to_due >= 0 && (
                  <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>через {o.days_to_due}д</div>
                )}
              </div>
              <select
                value={o.status}
                onChange={(e) => changeItemStatus(o.meeting, o.item_idx, e.target.value as MeetingItemStatus)}
                style={{
                  padding: "4px 8px", borderRadius: 6,
                  background: "var(--bg-base)", border: `1px solid ${ITEM_COLOR[o.status]}`,
                  color: ITEM_COLOR[o.status], fontSize: 11, fontWeight: 600, outline: "none", cursor: "pointer",
                }}>
                {ITEM_STATUSES.map(s => <option key={s} value={s} style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>{s}</option>)}
              </select>
              <button onClick={() => setSelectedName(o.meeting)} style={{
                padding: "4px 10px", fontSize: 11, borderRadius: 6,
                background: "transparent", border: "1px solid var(--border-subtle)",
                color: "var(--text-secondary)", cursor: "pointer",
              }}>Открыть</button>
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateDrawer onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />}
      {selectedName && <Drawer name={selectedName} onClose={() => setSelectedName(null)} onChanged={load} />}
    </div>
  );
}

function Kpi({ label, value, hint, accent }: { label: string; value: number; hint?: string; accent?: string }) {
  return (
    <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: "14px 18px" }}>
      <p style={{ fontSize: 10.5, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0, fontFamily: "monospace" }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 600, color: accent ?? "var(--text-primary)", margin: "6px 0 0", fontFamily: "monospace" }}>{value}</p>
      {hint && <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: "2px 0 0" }}>{hint}</p>}
    </div>
  );
}

// ── Create Drawer ───────────────────────────────────────────────────────────

function CreateDrawer({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [projects, setProjects] = useState<{ name: string; title: string }[]>([]);
  const [form, setForm] = useState({
    title: "Утренняя планёрка",
    meeting_type: "Утренняя планёрка" as MeetingType,
    project: "",
    meeting_date: new Date().toISOString().split("T")[0],
    start_time: "08:00",
    duration_min: 30,
    location: "",
    status: "Запланирована" as MeetingStatus,
    agenda_notes: "",
  });
  const [attendees, setAttendees] = useState<MeetingAttendee[]>([{ full_name: "", role: "", company: "Олимп", presence: "Был" }]);
  const [items, setItems] = useState<MeetingItem[]>([{ topic: "", responsible: "", due_date: "", status: "Открыто" }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/projects").then(r => r.json()).then(d => setProjects(Array.isArray(d) ? d : []));
  }, []);

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          start_time: form.start_time ? `${form.start_time}:00` : null,
          attendees: attendees.filter(a => a.full_name.trim()),
          items: items.filter(it => it.topic.trim()).map(it => ({ ...it, due_date: it.due_date || null })),
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
      <aside style={{ ...drawerStyle, width: 760 }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>Новая планёрка</h2>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>

        <div style={{ padding: 24, flex: 1, overflowY: "auto" }}>
          <Field label="Название">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={inputStyle} />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Тип">
              <select value={form.meeting_type} onChange={(e) => setForm({ ...form, meeting_type: e.target.value as MeetingType })} style={inputStyle}>
                {MEETING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Проект">
              <select value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} style={inputStyle}>
                <option value="">— не привязан —</option>
                {projects.map(p => <option key={p.name} value={p.name}>{p.title}</option>)}
              </select>
            </Field>
            <Field label="Дата">
              <input type="date" value={form.meeting_date} onChange={(e) => setForm({ ...form, meeting_date: e.target.value })} style={inputStyle} />
            </Field>
            <Field label="Время">
              <input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} style={inputStyle} />
            </Field>
            <Field label="Длительность, мин">
              <input type="number" value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: Number(e.target.value) })} style={inputStyle} />
            </Field>
            <Field label="Место / ссылка">
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Кабинет, объект или Zoom-ссылка" style={inputStyle} />
            </Field>
          </div>

          {/* Attendees */}
          <p style={sectionLabel}>Участники ({attendees.length})</p>
          <div style={{ background: "var(--bg-base)", borderRadius: 8, border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
            {attendees.map((a, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) 1fr 1fr 90px 30px", gap: 8, padding: "8px 12px", borderTop: i > 0 ? "1px solid var(--border-subtle)" : "none", alignItems: "center" }}>
                <input value={a.full_name} onChange={(e) => setAttendees(attendees.map((x, idx) => idx === i ? { ...x, full_name: e.target.value } : x))} placeholder="ФИО" style={smallInput} />
                <input value={a.role || ""} onChange={(e) => setAttendees(attendees.map((x, idx) => idx === i ? { ...x, role: e.target.value } : x))} placeholder="Должность" style={smallInput} />
                <input value={a.company || ""} onChange={(e) => setAttendees(attendees.map((x, idx) => idx === i ? { ...x, company: e.target.value } : x))} placeholder="Орг." style={smallInput} />
                <select value={a.presence || "Был"} onChange={(e) => setAttendees(attendees.map((x, idx) => idx === i ? { ...x, presence: e.target.value as MeetingAttendee["presence"] } : x))} style={smallInput}>
                  <option>Был</option><option>Не был</option><option>Опоздал</option>
                </select>
                <button onClick={() => setAttendees(attendees.filter((_, idx) => idx !== i))} style={removeBtn}>✕</button>
              </div>
            ))}
            <button onClick={() => setAttendees([...attendees, { full_name: "", role: "", company: "Олимп", presence: "Был" }])} style={addBtn}>+ участник</button>
          </div>

          {/* Items */}
          <p style={sectionLabel}>Вопросы и поручения ({items.length})</p>
          <div style={{ background: "var(--bg-base)", borderRadius: 8, border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
            {items.map((it, i) => (
              <div key={i} style={{ padding: "10px 12px", borderTop: i > 0 ? "1px solid var(--border-subtle)" : "none", display: "grid", gap: 6 }}>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) 1fr 130px 30px", gap: 8 }}>
                  <input value={it.topic} onChange={(e) => setItems(items.map((x, idx) => idx === i ? { ...x, topic: e.target.value } : x))} placeholder="Вопрос / тема" style={smallInput} />
                  <input value={it.responsible || ""} onChange={(e) => setItems(items.map((x, idx) => idx === i ? { ...x, responsible: e.target.value } : x))} placeholder="Ответственный" style={smallInput} />
                  <input type="date" value={it.due_date || ""} onChange={(e) => setItems(items.map((x, idx) => idx === i ? { ...x, due_date: e.target.value } : x))} style={smallInput} />
                  <button onClick={() => setItems(items.filter((_, idx) => idx !== i))} style={removeBtn}>✕</button>
                </div>
                <input value={it.decision || ""} onChange={(e) => setItems(items.map((x, idx) => idx === i ? { ...x, decision: e.target.value } : x))} placeholder="Решение / что делать" style={smallInput} />
              </div>
            ))}
            <button onClick={() => setItems([...items, { topic: "", responsible: "", due_date: "", status: "Открыто" }])} style={addBtn}>+ поручение</button>
          </div>

          <Field label="Заметки / протокол">
            <textarea rows={3} value={form.agenda_notes} onChange={(e) => setForm({ ...form, agenda_notes: e.target.value })} style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical" }} />
          </Field>
        </div>

        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border-subtle)", display: "flex", gap: 8 }}>
          <button onClick={onClose} style={btnSecondary}>Отмена</button>
          <button onClick={handleSave} disabled={saving || !form.title.trim()} style={{ ...btnPrimary, opacity: (saving || !form.title.trim()) ? 0.5 : 1 }}>
            {saving ? "Сохранение..." : "Создать"}
          </button>
        </div>
      </aside>
    </>
  );
}

// ── View Drawer ─────────────────────────────────────────────────────────────

function Drawer({ name, onClose, onChanged }: { name: string; onClose: () => void; onChanged: () => void }) {
  const [mt, setMt] = useState<Meeting | null>(null);

  const load = useCallback(async () => {
    const data = await fetch(`/api/meetings/detail?name=${encodeURIComponent(name)}`).then(r => r.json());
    setMt(data);
  }, [name]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  async function changeStatus(status: MeetingStatus) {
    await fetch("/api/meetings/status", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, status }),
    });
    load(); onChanged();
  }

  async function changeItemStatus(itemIdx: number, status: MeetingItemStatus) {
    await fetch("/api/meetings/item-status", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meeting: name, item_idx: itemIdx, status }),
    });
    load(); onChanged();
  }

  if (!mt) return <><div onClick={onClose} style={backdropStyle} /><aside style={{ ...drawerStyle, width: 760 }}><div style={{ padding: 24, color: "var(--text-tertiary)" }}>Загрузка...</div></aside></>;

  const st = STATUS_COLOR[mt.status];

  return (
    <>
      <div onClick={onClose} style={backdropStyle} />
      <aside style={{ ...drawerStyle, width: 760 }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, fontSize: 17 }}>{mt.title}</h2>
                <select value={mt.status} onChange={(e) => changeStatus(e.target.value as MeetingStatus)}
                  style={{ padding: "3px 10px", borderRadius: 10, background: st.bg, color: st.color, fontWeight: 600, fontSize: 12, border: "none", cursor: "pointer", outline: "none" }}>
                  {(["Запланирована", "Проведена", "Отменена"] as MeetingStatus[]).map(s =>
                    <option key={s} value={s} style={{ background: "var(--bg-elevated)", color: "var(--text-primary)" }}>{s}</option>
                  )}
                </select>
              </div>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: 0 }}>
                {mt.name} · {mt.meeting_type}{mt.project ? ` · ${mt.project}` : ""} · {fmtDate(mt.meeting_date)}{mt.start_time ? ` ${mt.start_time.slice(0, 5)}` : ""}
                {mt.location ? ` · ${mt.location}` : ""}
              </p>
            </div>
            <button onClick={onClose} style={closeBtn}>✕</button>
          </div>
        </div>

        <div style={{ padding: 24, flex: 1, overflowY: "auto" }}>
          {/* Attendees */}
          {mt.attendees && mt.attendees.length > 0 && (
            <>
              <p style={sectionLabel}>Участники ({mt.attendees.length})</p>
              <div style={{ background: "var(--bg-base)", borderRadius: 8, border: "1px solid var(--border-subtle)", padding: 4, marginBottom: 16 }}>
                {mt.attendees.map((a, i) => (
                  <div key={i} style={{ padding: "6px 12px", display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span><b>{a.full_name}</b>{a.role ? ` — ${a.role}` : ""}{a.company ? ` (${a.company})` : ""}</span>
                    <span style={{ color: a.presence === "Был" ? "var(--success)" : a.presence === "Опоздал" ? "var(--warning)" : "var(--text-tertiary)" }}>{a.presence}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Items */}
          {mt.items && mt.items.length > 0 && (
            <>
              <p style={sectionLabel}>Поручения ({mt.items.length})</p>
              <div style={{ background: "var(--bg-base)", borderRadius: 8, border: "1px solid var(--border-subtle)", overflow: "hidden", marginBottom: 16 }}>
                {mt.items.map((it, i) => (
                  <div key={i} style={{ padding: "10px 14px", borderTop: i > 0 ? "1px solid var(--border-subtle)" : "none", display: "grid", gap: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{it.topic}</div>
                        {it.decision && <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>→ {it.decision}</div>}
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                          {it.responsible || "—"}{it.due_date ? ` · до ${fmtDate(it.due_date)}` : ""}
                        </div>
                      </div>
                      <select value={it.status} onChange={(e) => changeItemStatus(it.idx ?? (i + 1), e.target.value as MeetingItemStatus)} style={{
                        padding: "3px 8px", borderRadius: 6,
                        background: "var(--bg-elevated)", border: `1px solid ${ITEM_COLOR[it.status]}`,
                        color: ITEM_COLOR[it.status], fontSize: 11, fontWeight: 600, outline: "none", cursor: "pointer",
                      }}>
                        {ITEM_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {mt.agenda_notes && (
            <>
              <p style={sectionLabel}>Заметки</p>
              <div style={{ padding: 14, background: "rgba(255,255,255,0.03)", borderRadius: 8, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
                {mt.agenda_notes}
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 12 }}>
    <label style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4, fontFamily: "monospace" }}>{label}</label>
    {children}
  </div>;
}

const sectionLabel: React.CSSProperties = { fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "18px 0 8px", fontFamily: "monospace" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 10px", background: "var(--bg-base)", border: "1px solid var(--border-subtle)", borderRadius: 8, color: "var(--text-primary)", fontSize: 13, outline: "none" };
const smallInput: React.CSSProperties = { ...inputStyle, padding: "5px 8px", fontSize: 12 };
const addBtn: React.CSSProperties = { width: "100%", padding: "8px", background: "transparent", border: "none", borderTop: "1px solid var(--border-subtle)", color: "var(--text-secondary)", cursor: "pointer", fontSize: 12 };
const removeBtn: React.CSSProperties = { background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 14 };

const backdropStyle: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 40, backdropFilter: "blur(2px)" };
const drawerStyle: React.CSSProperties = { position: "fixed", top: 0, right: 0, bottom: 0, background: "var(--bg-elevated)", borderLeft: "1px solid var(--border-subtle)", zIndex: 50, display: "flex", flexDirection: "column", overflow: "hidden" };
const closeBtn: React.CSSProperties = { width: 28, height: 28, borderRadius: 8, border: "1px solid var(--border-subtle)", background: "transparent", color: "var(--text-tertiary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 };
const btnSecondary: React.CSSProperties = { padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer" };
const btnPrimary: React.CSSProperties = { padding: "8px 14px", borderRadius: 8, border: "none", background: "var(--accent)", color: "white", fontSize: 13, cursor: "pointer", fontWeight: 500, flex: 1 };
