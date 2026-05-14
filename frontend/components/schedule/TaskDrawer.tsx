"use client";

import { useCallback, useEffect, useState } from "react";
import type { ScheduleTask, TaskStatus } from "@/types/schedule";

const STATUS_OPTIONS: TaskStatus[] = ["Запланирована", "В работе", "Выполнена", "Отменена"];

const inputStyle: React.CSSProperties = {
  padding: "8px 10px", fontSize: 13, color: "var(--text-primary)",
  background: "var(--bg-base)", border: "1px solid var(--border-subtle)", borderRadius: 8,
  outline: "none", width: "100%",
};

export default function TaskDrawer({
  project,
  name,           // имя задачи для редактирования или "new"
  parentOptions,  // список разделов проекта (is_section=1) для select "Раздел"
  onClose,
  onSaved,
  onDeleted,
}: {
  project: string;
  name: string | "new";
  parentOptions: { name: string; title: string }[];
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
}) {
  const isNew = name === "new";
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<ScheduleTask>>({
    title: "",
    project,
    is_section: 0,
    is_critical: 0,
    status: "Запланирована",
    progress: 0,
    start_date: "",
    end_date: "",
    assignee: "",
    parent_task: "",
    order_idx: 0,
  });

  const load = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    try {
      // Грузим только эту задачу через get_tasks (фильтр на фронте)
      const r = await fetch(`/api/schedule/${encodeURIComponent(project)}`);
      const d = await r.json();
      const t = (d.tasks ?? []).find((x: ScheduleTask) => x.name === name);
      if (t) setForm(t);
    } finally {
      setLoading(false);
    }
  }, [name, project, isNew]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  function update<K extends keyof ScheduleTask>(k: K, v: ScheduleTask[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function save() {
    if (!form.title?.trim()) { setError("Укажите название задачи"); return; }
    if (!form.is_section && (!form.start_date || !form.end_date)) {
      setError("Для задачи нужно указать даты начала и окончания");
      return;
    }
    setSaving(true); setError(null);
    try {
      const payload: Record<string, unknown> = { ...form };
      // Очищаем пустые строки/нули, которые мешают на бэке
      if (!payload.parent_task) delete payload.parent_task;
      if (!payload.start_date) delete payload.start_date;
      if (!payload.end_date) delete payload.end_date;
      if (!payload.subcontractor) delete payload.subcontractor;
      if (!payload.predecessor) delete payload.predecessor;

      const url = isNew ? `/api/schedule/${encodeURIComponent(project)}` : `/api/schedule/tasks/${encodeURIComponent(name)}`;
      const method = isNew ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data.error) { setError(data.error || "Ошибка сохранения"); return; }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (isNew) return;
    if (!confirm("Удалить задачу? Дети будут отвязаны от раздела.")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/schedule/tasks/${encodeURIComponent(name)}`, { method: "DELETE" });
      if (res.ok) { onDeleted?.(); }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 560, maxWidth: "100%", height: "100vh", background: "var(--bg-base)",
        borderLeft: "1px solid var(--border-subtle)", overflow: "auto", padding: "24px 28px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            <h2 style={{ fontSize: 19, fontWeight: 500, margin: 0 }}>
              {isNew ? "Новая задача" : (form.title || name)}
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
            <label style={lbl}>Тип</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button onClick={() => update("is_section", 0)}
                      style={{ ...chip, ...(form.is_section ? chipOff : chipOn) }}>Задача</button>
              <button onClick={() => update("is_section", 1)}
                      style={{ ...chip, ...(form.is_section ? chipOn : chipOff) }}>Раздел (группа)</button>
            </div>

            <label style={lbl}>Название *</label>
            <input style={{ ...inputStyle, marginBottom: 12 }}
                   value={form.title || ""} onChange={(e) => update("title", e.target.value)}
                   placeholder={form.is_section ? "Раздел 1 · Подготовка" : "1.1 · Демонтаж покрытия"} />

            {!form.is_section && (
              <>
                <label style={lbl}>Раздел (родитель)</label>
                <select style={{ ...inputStyle, marginBottom: 12 }}
                        value={form.parent_task || ""} onChange={(e) => update("parent_task", e.target.value)}>
                  <option value="">— без раздела —</option>
                  {parentOptions.filter(p => p.name !== name).map(p => (
                    <option key={p.name} value={p.name}>{p.title}</option>
                  ))}
                </select>

                <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={lbl}>Начало *</label>
                    <input type="date" style={inputStyle}
                           value={form.start_date || ""} onChange={(e) => update("start_date", e.target.value)} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={lbl}>Окончание *</label>
                    <input type="date" style={inputStyle}
                           value={form.end_date || ""} onChange={(e) => update("end_date", e.target.value)} />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={lbl}>Прогресс, %</label>
                    <input type="number" min={0} max={100} style={inputStyle}
                           value={form.progress ?? 0}
                           onChange={(e) => update("progress", Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={lbl}>Статус</label>
                    <select style={inputStyle} value={form.status || "Запланирована"} onChange={(e) => update("status", e.target.value as TaskStatus)}>
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <label style={lbl}>Исполнитель</label>
                <input style={{ ...inputStyle, marginBottom: 12 }}
                       value={form.assignee || ""} onChange={(e) => update("assignee", e.target.value)}
                       placeholder="ФИО / бригада / подрядчик" />

                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                    <input type="checkbox" checked={!!form.is_critical}
                           onChange={(e) => update("is_critical", e.target.checked ? 1 : 0)} />
                    <span>Задача на критическом пути <span style={{ color: "var(--danger)", fontWeight: 500 }}>(КП)</span></span>
                  </label>
                </div>
              </>
            )}

            <label style={lbl}>Порядковый № (для сортировки)</label>
            <input type="number" style={{ ...inputStyle, marginBottom: 12 }}
                   value={form.order_idx ?? 0} onChange={(e) => update("order_idx", parseInt(e.target.value) || 0)} />

            <label style={lbl}>Заметки</label>
            <textarea style={{ ...inputStyle, minHeight: 60, fontFamily: "inherit" }}
                      value={form.notes || ""} onChange={(e) => update("notes", e.target.value)} />

            {error && <div style={{ padding: 10, marginTop: 12, background: "rgba(248,113,113,0.1)", border: "1px solid var(--danger)", borderRadius: 8, color: "var(--danger)", fontSize: 12 }}>{error}</div>}

            <div style={{ marginTop: 22, display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                {!isNew && (
                  <button onClick={remove} disabled={saving} style={btnDanger}>Удалить</button>
                )}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={onClose} style={btnCancel}>Отмена</button>
                <button onClick={save} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
                  {saving ? "Сохранение..." : (isNew ? "Создать" : "Сохранить")}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = { display: "block", fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: "monospace" };
const chip: React.CSSProperties = { padding: "7px 14px", fontSize: 12, fontWeight: 500, borderRadius: 8, border: "1px solid", cursor: "pointer", flex: 1 };
const chipOn: React.CSSProperties = { background: "var(--accent)", color: "white", borderColor: "var(--accent)" };
const chipOff: React.CSSProperties = { background: "var(--bg-elevated)", color: "var(--text-secondary)", borderColor: "var(--border-subtle)" };
const btnPrimary: React.CSSProperties = { padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 500, background: "var(--accent)", color: "white", border: "none", cursor: "pointer" };
const btnCancel: React.CSSProperties = { padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 500, background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)", cursor: "pointer" };
const btnDanger: React.CSSProperties = { padding: "9px 14px", borderRadius: 10, fontSize: 12, fontWeight: 500, background: "transparent", color: "var(--danger)", border: "1px solid var(--danger)", cursor: "pointer" };
