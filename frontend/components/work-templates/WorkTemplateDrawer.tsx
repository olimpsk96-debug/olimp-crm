"use client";

import { useCallback, useEffect, useState } from "react";
import type { WorkTemplate, WorkStageTemplate } from "@/types/work-template";
import { CATEGORIES, SOURCES } from "@/types/work-template";
import { EntityTimeline } from "@/components/ui/EntityTimeline";

const inputStyle: React.CSSProperties = {
  padding: "8px 10px", fontSize: 13, color: "var(--text-primary)",
  background: "var(--bg-base)", border: "1px solid var(--border-subtle)", borderRadius: 8,
  outline: "none", width: "100%",
};

function newStage(): WorkStageTemplate {
  return { title: "", unit: "м²", norm_per_base_unit: 1, labor_hours_per_unit: 0, materials_json: "{}", gesn_ref: "", notes: "" };
}

export default function WorkTemplateDrawer({
  name,
  onClose,
  onSaved,
}: {
  name: string | "new";
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = name === "new";
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<WorkTemplate>({
    template_id: "",
    title: "",
    category: "Прочее",
    base_unit: "м²",
    typical_volume_min: 50,
    typical_volume_max: 500,
    keywords: "",
    description: "",
    source: "Ручной ввод",
    is_verified: 1,
    stages: [newStage()],
  });

  const load = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/work-templates/${encodeURIComponent(name)}`);
      const d = await r.json();
      if (d && d.template_id) setForm(d);
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

  function up<K extends keyof WorkTemplate>(k: K, v: WorkTemplate[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function updateStage(idx: number, patch: Partial<WorkStageTemplate>) {
    setForm((f) => ({
      ...f,
      stages: (f.stages || []).map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    }));
  }

  function addStage() {
    setForm((f) => ({ ...f, stages: [...(f.stages || []), newStage()] }));
  }

  function removeStage(idx: number) {
    setForm((f) => ({ ...f, stages: (f.stages || []).filter((_, i) => i !== idx) }));
  }

  function moveStage(idx: number, dir: -1 | 1) {
    setForm((f) => {
      const arr = [...(f.stages || [])];
      const tgt = idx + dir;
      if (tgt < 0 || tgt >= arr.length) return f;
      const tmp = arr[idx]!;
      arr[idx] = arr[tgt]!;
      arr[tgt] = tmp;
      return { ...f, stages: arr };
    });
  }

  async function save() {
    if (!form.template_id.trim() && isNew) { setError("Укажи template_id (например: my_work_v1)"); return; }
    if (!form.title.trim()) { setError("Укажи название"); return; }
    if (!form.keywords.trim()) { setError("Укажи ключевые слова через запятую"); return; }
    if (!(form.stages || []).length) { setError("Хотя бы один этап"); return; }
    if ((form.stages || []).some((s) => !s.title.trim())) { setError("У всех этапов должно быть название"); return; }

    setSaving(true);
    setError(null);
    try {
      const url = isNew ? "/api/work-templates" : `/api/work-templates/${encodeURIComponent(name)}`;
      const method = isNew ? "POST" : "PUT";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok || d.error) {
        setError(d.error || `Ошибка ${r.status}`);
        return;
      }
      onSaved();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (isNew) return;
    if (!confirm(`Удалить шаблон «${form.title}»? Это действие нельзя отменить.`)) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/work-templates/${encodeURIComponent(name)}`, { method: "DELETE" });
      if (r.ok) onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 100, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 900, maxWidth: "100%", height: "100vh", background: "var(--bg-base)",
        borderLeft: "1px solid var(--border-subtle)", overflow: "auto", padding: "22px 28px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 19, fontWeight: 500, margin: 0 }}>
              {isNew ? "Новый шаблон работы" : form.title || form.template_id}
            </h2>
            {!isNew && (
              <p style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-tertiary)", marginTop: 4 }}>
                {form.template_id} · {form.usage_count ?? 0} применений
              </p>
            )}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-tertiary)", fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        {loading && <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Загрузка...</div>}

        {!loading && (
          <>
            {/* Шапка */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label style={lbl}>ID шаблона (snake_case) *</label>
                <input
                  disabled={!isNew}
                  style={{ ...inputStyle, opacity: isNew ? 1 : 0.6 }}
                  value={form.template_id}
                  onChange={(e) => up("template_id", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                  placeholder="akz_my_work"
                />
              </div>
              <div>
                <label style={lbl}>Источник</label>
                <select style={inputStyle} value={form.source || "Ручной ввод"} onChange={(e) => up("source", e.target.value)}>
                  {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <label style={lbl}>Название работы *</label>
            <input
              style={{ ...inputStyle, marginBottom: 10 }}
              value={form.title}
              onChange={(e) => up("title", e.target.value)}
              placeholder="АКЗ резервуара / Усиление балки углеволокном"
            />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 100px 100px 110px", gap: 10, marginBottom: 10 }}>
              <div>
                <label style={lbl}>Категория *</label>
                <select style={inputStyle} value={form.category} onChange={(e) => up("category", e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Базовая ед.</label>
                <input style={inputStyle} value={form.base_unit} onChange={(e) => up("base_unit", e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Объём от</label>
                <input type="number" style={inputStyle} value={form.typical_volume_min ?? 0} onChange={(e) => up("typical_volume_min", parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                <label style={lbl}>Объём до</label>
                <input type="number" style={inputStyle} value={form.typical_volume_max ?? 0} onChange={(e) => up("typical_volume_max", parseFloat(e.target.value) || 0)} />
              </div>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <label style={{ display: "flex", gap: 6, fontSize: 12, alignItems: "center", cursor: "pointer", padding: "8px 0" }}>
                  <input type="checkbox" checked={form.is_verified === 1}
                         onChange={(e) => up("is_verified", e.target.checked ? 1 : 0)} />
                  <span>Проверен</span>
                </label>
              </div>
            </div>

            <label style={lbl}>Ключевые слова * (через запятую — по ним AI-поиск)</label>
            <textarea
              style={{ ...inputStyle, minHeight: 40, marginBottom: 10, fontFamily: "inherit" }}
              value={form.keywords}
              onChange={(e) => up("keywords", e.target.value)}
              placeholder="акз, антикоррозия, резервуар, рвс, окраска"
            />

            <label style={lbl}>Описание / условия применения</label>
            <textarea
              style={{ ...inputStyle, minHeight: 50, marginBottom: 16, fontFamily: "inherit" }}
              value={form.description || ""}
              onChange={(e) => up("description", e.target.value)}
              placeholder="Когда применять, что нужно от заказчика, особые условия"
            />

            {/* Этапы */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h3 style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>
                Этапы ({(form.stages || []).length})
              </h3>
              <button onClick={addStage} style={btnAdd}>+ этап</button>
            </div>

            <div style={{ border: "1px solid var(--border-subtle)", borderRadius: 10, overflow: "hidden", marginBottom: 14 }}>
              <div style={{
                display: "grid",
                gridTemplateColumns: "26px 1fr 60px 65px 65px 1fr 110px 80px",
                gap: 0, padding: "8px 12px",
                background: "var(--bg-elevated)",
                fontSize: 9.5, color: "var(--text-tertiary)",
                textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace",
              }}>
                <div>№</div>
                <div>Название этапа</div>
                <div>Ед.</div>
                <div>×ед.</div>
                <div>чел.ч</div>
                <div>Материалы (JSON)</div>
                <div>ГЭСН</div>
                <div></div>
              </div>

              {(form.stages || []).map((s, idx) => (
                <div key={idx} style={{
                  display: "grid",
                  gridTemplateColumns: "26px 1fr 60px 65px 65px 1fr 110px 80px",
                  gap: 0, padding: "6px 12px",
                  borderTop: "1px solid var(--border-subtle)",
                  fontSize: 12,
                }}>
                  <div style={{ display: "flex", alignItems: "center", color: "var(--text-tertiary)", fontFamily: "monospace" }}>{idx + 1}</div>
                  <input style={smallInput} value={s.title} onChange={(e) => updateStage(idx, { title: e.target.value })} placeholder="название" />
                  <input style={smallInput} value={s.unit} onChange={(e) => updateStage(idx, { unit: e.target.value })} />
                  <input type="number" step="0.01" style={smallInput} value={s.norm_per_base_unit ?? 1}
                         onChange={(e) => updateStage(idx, { norm_per_base_unit: parseFloat(e.target.value) || 0 })} />
                  <input type="number" step="0.01" style={smallInput} value={s.labor_hours_per_unit ?? 0}
                         onChange={(e) => updateStage(idx, { labor_hours_per_unit: parseFloat(e.target.value) || 0 })} />
                  <input style={{ ...smallInput, fontFamily: "monospace", fontSize: 10.5 }}
                         value={s.materials_json || "{}"}
                         onChange={(e) => updateStage(idx, { materials_json: e.target.value })}
                         placeholder='{"primer_kg": 0.3}' />
                  <input style={{ ...smallInput, fontFamily: "monospace", fontSize: 10.5 }}
                         value={s.gesn_ref || ""}
                         onChange={(e) => updateStage(idx, { gesn_ref: e.target.value })}
                         placeholder="ГЭСН ..." />
                  <div style={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
                    <button onClick={() => moveStage(idx, -1)} disabled={idx === 0} style={miniBtn}>↑</button>
                    <button onClick={() => moveStage(idx, 1)} disabled={idx === (form.stages || []).length - 1} style={miniBtn}>↓</button>
                    <button onClick={() => removeStage(idx)} style={{ ...miniBtn, color: "var(--danger)" }}>×</button>
                  </div>
                </div>
              ))}

              {(form.stages || []).length === 0 && (
                <div style={{ padding: 24, textAlign: "center", color: "var(--text-tertiary)", fontSize: 12 }}>
                  Этапов пока нет. Нажми «+ этап» чтобы добавить.
                </div>
              )}
            </div>

            {error && (
              <div style={{ padding: 10, marginBottom: 12, background: "rgba(248,113,113,0.1)", border: "1px solid var(--danger)", borderRadius: 8, color: "var(--danger)", fontSize: 12 }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                {!isNew && <button onClick={remove} disabled={saving} style={btnDanger}>Удалить</button>}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={onClose} style={btnCancel}>Отмена</button>
                <button onClick={save} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
                  {saving ? "Сохранение..." : (isNew ? "Создать шаблон" : "Сохранить")}
                </button>
              </div>
            </div>

            {/* Activity Timeline — только для существующих шаблонов */}
            {!isNew && (
              <div style={{ marginTop: 24, paddingTop: 18, borderTop: "1px solid var(--border-subtle)" }}>
                <EntityTimeline doctype="Work Template" name={name} limit={15} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = { display: "block", fontSize: 10.5, color: "var(--text-tertiary)", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: "monospace" };
const smallInput: React.CSSProperties = {
  padding: "4px 6px", fontSize: 11.5, border: "1px solid transparent",
  background: "transparent", color: "var(--text-primary)", outline: "none", width: "100%",
};
const btnPrimary: React.CSSProperties = { padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 500, background: "var(--accent)", color: "white", border: "none", cursor: "pointer" };
const btnCancel: React.CSSProperties = { padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 500, background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)", cursor: "pointer" };
const btnDanger: React.CSSProperties = { padding: "9px 14px", borderRadius: 10, fontSize: 12, fontWeight: 500, background: "transparent", color: "var(--danger)", border: "1px solid var(--danger)", cursor: "pointer" };
const btnAdd: React.CSSProperties = { padding: "5px 12px", fontSize: 11.5, borderRadius: 7, border: "1px solid var(--accent)", background: "rgba(234,88,12,0.08)", color: "var(--accent)", cursor: "pointer" };
const miniBtn: React.CSSProperties = { width: 22, height: 22, borderRadius: 5, border: "1px solid var(--border-subtle)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 11 };
