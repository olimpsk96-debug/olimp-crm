"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProjectRisk, RiskCategory, RiskStatus, RiskResponse } from "@/types/risk";

const CATEGORIES: RiskCategory[] = [
  "Финансовый", "Технический", "Срочный", "Качество", "Безопасность",
  "Регуляторный", "Поставщик", "Заказчик", "Погодный",
];

const STATUSES: RiskStatus[] = ["Открыт", "В работе", "Снижен", "Закрыт", "Реализовался"];
const RESPONSES: RiskResponse[] = ["Принять", "Снизить", "Передать", "Избежать"];

const PROB_OPTIONS = [
  "1 — Очень низкая", "2 — Низкая", "3 — Средняя", "4 — Высокая", "5 — Очень высокая",
];
const IMP_OPTIONS = [
  "1 — Минимальное", "2 — Низкое", "3 — Среднее", "4 — Высокое", "5 — Критическое",
];

const inputStyle: React.CSSProperties = {
  padding: "8px 10px", fontSize: 13, color: "var(--text-primary)",
  background: "var(--bg-base)", border: "1px solid var(--border-subtle)", borderRadius: 8,
  outline: "none", width: "100%",
};

function parseLvl(s: string): number {
  const part = (s || "").split("—")[0] ?? "";
  return parseInt(part.trim() || "0", 10);
}

function zoneColor(score: number): string {
  if (score >= 15) return "var(--danger)";
  if (score >= 8) return "var(--warning)";
  return "var(--success)";
}

function zoneLabel(score: number): string {
  if (score >= 15) return "КРАСНАЯ зона — требует немедленных мер";
  if (score >= 8) return "ЖЁЛТАЯ зона — необходим план снижения";
  if (score > 0) return "ЗЕЛЁНАЯ зона — приемлемый";
  return "—";
}

export default function RiskDrawer({
  name,
  projects,
  defaultProject,
  onClose,
  onSaved,
  onDeleted,
}: {
  name: string | "new";
  projects: { name: string; title: string }[];
  defaultProject?: string;
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
}) {
  const isNew = name === "new";
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<Partial<ProjectRisk>>({
    title: "",
    project: defaultProject || "",
    category: "Технический",
    status: "Открыт",
    probability: "3 — Средняя",
    impact: "3 — Среднее",
    impact_amount: 0,
    response_strategy: "Снизить",
    mitigation_plan: "",
    trigger_events: "",
    owner_full_name: "",
    detected_date: new Date().toISOString().slice(0, 10),
    target_resolution_date: "",
  });

  // Лайв-расчёт контингенции
  const p = parseLvl(form.probability || "");
  const i = parseLvl(form.impact || "");
  const score = p * i;
  const liveContingency = (form.impact_amount || 0) * p / 5;

  const load = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/risks?project=${encodeURIComponent(defaultProject || "")}`);
      const list = await r.json();
      const me = Array.isArray(list) ? list.find((x: ProjectRisk) => x.name === name) : null;
      if (me) setForm(me);
    } finally {
      setLoading(false);
    }
  }, [name, isNew, defaultProject]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  function up<K extends keyof ProjectRisk>(k: K, v: ProjectRisk[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function save() {
    if (!form.title?.trim()) { setError("Укажите название риска"); return; }
    if (!form.project) { setError("Укажите проект"); return; }
    setSaving(true); setError(null);
    try {
      const url = isNew ? "/api/risks" : `/api/risks/${encodeURIComponent(name)}`;
      const method = isNew ? "POST" : "PUT";
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
    if (!confirm("Удалить риск из реестра?")) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/risks/${encodeURIComponent(name)}`, { method: "DELETE" });
      if (r.ok) onDeleted?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 100, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 660, maxWidth: "100%", height: "100vh", background: "var(--bg-base)",
        borderLeft: "1px solid var(--border-subtle)", overflow: "auto", padding: "24px 28px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            <h2 style={{ fontSize: 19, fontWeight: 500, margin: 0 }}>
              {isNew ? "Новый риск" : (form.title || name)}
            </h2>
            {!isNew && <p style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-tertiary)", marginTop: 4 }}>{name}</p>}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-tertiary)", fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        {loading && <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Загрузка...</div>}

        {!loading && (
          <>
            <label style={lbl}>Название риска *</label>
            <input style={{ ...inputStyle, marginBottom: 12 }}
                   value={form.title || ""} onChange={(e) => up("title", e.target.value)}
                   placeholder="Срыв поставки металла / Дождливое лето / Травма на высоте" />

            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Проект *</label>
                <select style={inputStyle} value={form.project || ""} onChange={(e) => up("project", e.target.value)}>
                  <option value="">— выберите —</option>
                  {projects.map(p => <option key={p.name} value={p.name}>{p.title}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Категория</label>
                <select style={inputStyle} value={form.category || "Технический"} onChange={(e) => up("category", e.target.value as RiskCategory)}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Статус</label>
                <select style={inputStyle} value={form.status || "Открыт"} onChange={(e) => up("status", e.target.value as RiskStatus)}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <h3 style={sectionH}>Оценка</h3>
            <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Вероятность</label>
                <select style={inputStyle} value={form.probability || ""} onChange={(e) => up("probability", e.target.value)}>
                  {PROB_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Влияние</label>
                <select style={inputStyle} value={form.impact || ""} onChange={(e) => up("impact", e.target.value)}>
                  {IMP_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Финансовый импакт, ₽</label>
                <input type="number" style={inputStyle}
                       value={form.impact_amount ?? 0}
                       onChange={(e) => up("impact_amount", parseFloat(e.target.value) || 0)} />
              </div>
            </div>

            {/* Live-расчёт */}
            <div style={{
              padding: 12, borderRadius: 10, marginBottom: 14,
              background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12,
            }}>
              <div>
                <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "monospace" }}>Балл риска</div>
                <div style={{ fontSize: 22, fontWeight: 600, color: zoneColor(score), fontFamily: "monospace", marginTop: 2 }}>
                  {score || "—"} {score > 0 && <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-tertiary)" }}>/ 25</span>}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "monospace" }}>Контингенция (ожид.)</div>
                <div style={{ fontSize: 22, fontWeight: 600, color: "var(--accent)", fontFamily: "monospace", marginTop: 2 }}>
                  {liveContingency > 0 ? `${Math.round(liveContingency).toLocaleString("ru-RU")} ₽` : "—"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "monospace" }}>Зона</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: zoneColor(score), marginTop: 6 }}>
                  {zoneLabel(score)}
                </div>
              </div>
            </div>

            <h3 style={sectionH}>Реакция</h3>
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Стратегия</label>
                <select style={inputStyle} value={form.response_strategy || "Снизить"} onChange={(e) => up("response_strategy", e.target.value as RiskResponse)}>
                  {RESPONSES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Ответственный</label>
                <input style={inputStyle} value={form.owner_full_name || ""} onChange={(e) => up("owner_full_name", e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Целевая дата закрытия</label>
                <input type="date" style={inputStyle} value={form.target_resolution_date || ""} onChange={(e) => up("target_resolution_date", e.target.value)} />
              </div>
            </div>

            <label style={lbl}>План снижения</label>
            <textarea style={{ ...inputStyle, minHeight: 60, marginBottom: 12, fontFamily: "inherit" }}
                      value={form.mitigation_plan || ""} onChange={(e) => up("mitigation_plan", e.target.value)}
                      placeholder="Что делаем чтобы риск не реализовался" />

            <label style={lbl}>Индикаторы / триггеры</label>
            <textarea style={{ ...inputStyle, minHeight: 50, marginBottom: 12, fontFamily: "inherit" }}
                      value={form.trigger_events || ""} onChange={(e) => up("trigger_events", e.target.value)}
                      placeholder="Что покажет что риск разворачивается" />

            {(form.status === "Закрыт" || form.status === "Реализовался") && (
              <>
                <label style={lbl}>Фактический исход</label>
                <textarea style={{ ...inputStyle, minHeight: 50, marginBottom: 12, fontFamily: "inherit" }}
                          value={form.actual_outcome || ""} onChange={(e) => up("actual_outcome", e.target.value)}
                          placeholder="Что в итоге произошло" />
              </>
            )}

            {error && <div style={{ padding: 10, marginBottom: 12, background: "rgba(248,113,113,0.1)", border: "1px solid var(--danger)", borderRadius: 8, color: "var(--danger)", fontSize: 12 }}>{error}</div>}

            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                {!isNew && <button onClick={remove} disabled={saving} style={btnDanger}>Удалить</button>}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={onClose} style={btnCancel}>Отмена</button>
                <button onClick={save} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
                  {saving ? "Сохранение..." : (isNew ? "Создать риск" : "Сохранить")}
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
const sectionH: React.CSSProperties = { fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "8px 0 8px", fontFamily: "monospace" };
const btnPrimary: React.CSSProperties = { padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 500, background: "var(--accent)", color: "white", border: "none", cursor: "pointer" };
const btnCancel: React.CSSProperties = { padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 500, background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)", cursor: "pointer" };
const btnDanger: React.CSSProperties = { padding: "9px 14px", borderRadius: 10, fontSize: 12, fontWeight: 500, background: "transparent", color: "var(--danger)", border: "1px solid var(--danger)", cursor: "pointer" };
