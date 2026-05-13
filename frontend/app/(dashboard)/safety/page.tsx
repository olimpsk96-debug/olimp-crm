"use client";

import { useEffect, useState } from "react";
import type { ForemanReport, SafetyIncident, ForemanStats, ReportStatus, IncidentStatus, IncidentSeverity } from "@/types/foreman";

const REPORT_STATUS_COLOR: Record<ReportStatus, string> = {
  "Черновик":  "var(--text-tertiary)",
  "Отправлен": "var(--warning)",
  "Принят":    "var(--success)",
};

const SEVERITY_COLOR: Record<IncidentSeverity, string> = {
  "Незначительный": "var(--text-tertiary)",
  "Средний":        "var(--warning)",
  "Тяжёлый":        "var(--danger)",
  "Критический":    "#ef4444",
};

const INCIDENT_STATUS_COLOR: Record<IncidentStatus, string> = {
  "Открыт":   "var(--danger)",
  "В работе": "var(--warning)",
  "Закрыт":   "var(--success)",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "7px 10px", borderRadius: 8,
  border: "1px solid var(--border-subtle)", background: "var(--bg-base)",
  color: "var(--text-primary)", fontSize: 12.5, outline: "none", boxSizing: "border-box",
};

function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <label style={{ display: "block", fontSize: 10.5, color: "var(--text-tertiary)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace" }}>
      {text}{required && <span style={{ color: "var(--danger)", marginLeft: 3 }}>*</span>}
    </label>
  );
}

// ─── Report Create Drawer ─────────────────────────────────────────────────────
function ReportCreateDrawer({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (name: string) => void }) {
  const [title, setTitle] = useState("");
  const [foreman, setForeman] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [project, setProject] = useState("");
  const [workers, setWorkers] = useState("");
  const [brigades, setBrigades] = useState("");
  const [workDone, setWorkDone] = useState("");
  const [issues, setIssues] = useState("");
  const [hasSafety, setHasSafety] = useState(false);
  const [materials, setMaterials] = useState("");
  const [equipment, setEquipment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle(""); setForeman(""); setDate(new Date().toISOString().slice(0, 10));
    setProject(""); setWorkers(""); setBrigades(""); setWorkDone("");
    setIssues(""); setHasSafety(false); setMaterials(""); setEquipment("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!foreman.trim()) { setError("Укажите прораба"); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/foreman/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || `Отчёт ${foreman.trim()} — ${date}`,
          foreman_name: foreman.trim(),
          report_date: date,
          project: project.trim() || undefined,
          workers_count: workers ? parseInt(workers) : undefined,
          brigades_info: brigades.trim() || undefined,
          work_done: workDone.trim() || undefined,
          issues: issues.trim() || undefined,
          has_safety_incident: hasSafety ? 1 : 0,
          materials_used: materials.trim() || undefined,
          equipment_used: equipment.trim() || undefined,
          status: "Отправлен",
        }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      reset(); onClose(); onCreated(data.name);
    } catch { setError("Ошибка соединения"); }
    finally { setSaving(false); }
  }

  return (
    <>
      <div onClick={() => { reset(); onClose(); }} style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.45)", opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity 0.25s ease", backdropFilter: "blur(2px)" }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 560, zIndex: 50, background: "var(--bg-elevated)", borderLeft: "1px solid var(--border-subtle)", transform: open ? "translateX(0)" : "translateX(100%)", transition: "transform 0.3s cubic-bezier(0.16,1,0.3,1)", display: "flex", flexDirection: "column", overflowY: "auto" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 500 }}>Новый отчёт прораба</h2>
              <p style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 2 }}>Ежедневный рапорт о ходе работ</p>
            </div>
            <button onClick={() => { reset(); onClose(); }} style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid var(--border-subtle)", background: "transparent", color: "var(--text-tertiary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3l10 10M13 3L3 13" /></svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 32px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><Label text="Прораб" required /><input style={inputStyle} placeholder="Иванов А.П." value={foreman} onChange={(e) => setForeman(e.target.value)} autoFocus /></div>
            <div><Label text="Дата" /><input style={inputStyle} type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><Label text="Проект (ERP)" /><input style={inputStyle} placeholder="PR-2026-..." value={project} onChange={(e) => setProject(e.target.value)} /></div>
            <div><Label text="Рабочих сегодня" /><input style={inputStyle} placeholder="12" value={workers} onChange={(e) => setWorkers(e.target.value)} inputMode="numeric" /></div>
          </div>

          <div><Label text="Бригады / субподрядчики" /><input style={inputStyle} placeholder="Бригада Петрова — 6 чел., ООО Отделка — 3 чел." value={brigades} onChange={(e) => setBrigades(e.target.value)} /></div>

          <div><Label text="Выполненные работы" /><textarea style={{ ...inputStyle, resize: "vertical", minHeight: 72 }} placeholder="Что сделано за день: объёмы, участки..." value={workDone} onChange={(e) => setWorkDone(e.target.value)} /></div>

          <div><Label text="Проблемы и замечания" /><textarea style={{ ...inputStyle, resize: "vertical", minHeight: 52 }} placeholder="Задержка материалов, погода, технические проблемы..." value={issues} onChange={(e) => setIssues(e.target.value)} /></div>

          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={hasSafety} onChange={(e) => setHasSafety(e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--danger)" }} />
            <span style={{ fontSize: 13, color: hasSafety ? "var(--danger)" : "var(--text-secondary)" }}>Был инцидент по ОТ/ТБ — создать карточку отдельно</span>
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><Label text="Использованные материалы" /><textarea style={{ ...inputStyle, resize: "vertical", minHeight: 48 }} placeholder="Грунт ГФ-021 — 50 кг..." value={materials} onChange={(e) => setMaterials(e.target.value)} /></div>
            <div><Label text="Техника" /><textarea style={{ ...inputStyle, resize: "vertical", minHeight: 48 }} placeholder="Подъёмник HAULICK — в работе..." value={equipment} onChange={(e) => setEquipment(e.target.value)} /></div>
          </div>

          {error && <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "var(--danger)", fontSize: 12.5 }}>{error}</div>}

          <button type="submit" disabled={saving}
            style={{ width: "100%", padding: "11px 0", borderRadius: 10, border: "none", background: saving ? "var(--border-subtle)" : "var(--accent)", color: saving ? "var(--text-tertiary)" : "white", fontSize: 13.5, fontWeight: 500, cursor: saving ? "wait" : "pointer" }}>
            {saving ? "Отправка..." : "Отправить отчёт"}
          </button>
        </form>
      </div>
    </>
  );
}

// ─── Incident Create Drawer ───────────────────────────────────────────────────
function IncidentCreateDrawer({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (name: string) => void }) {
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState<IncidentSeverity>("Незначительный");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [project, setProject] = useState("");
  const [description, setDescription] = useState("");
  const [affected, setAffected] = useState("");
  const [location, setLocation] = useState("");
  const [measures, setMeasures] = useState("");
  const [preventive, setPreventive] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle(""); setSeverity("Незначительный"); setDate(new Date().toISOString().slice(0, 10));
    setProject(""); setDescription(""); setAffected(""); setLocation("");
    setMeasures(""); setPreventive(""); setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Укажите описание инцидента"); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/foreman/incident", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          severity,
          incident_date: date,
          project: project.trim() || undefined,
          description: description.trim() || undefined,
          affected_person: affected.trim() || undefined,
          location: location.trim() || undefined,
          measures_taken: measures.trim() || undefined,
          preventive_actions: preventive.trim() || undefined,
          status: "Открыт",
        }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      reset(); onClose(); onCreated(data.name);
    } catch { setError("Ошибка соединения"); }
    finally { setSaving(false); }
  }

  const sevColor = SEVERITY_COLOR[severity];

  return (
    <>
      <div onClick={() => { reset(); onClose(); }} style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.45)", opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity 0.25s ease", backdropFilter: "blur(2px)" }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 520, zIndex: 50, background: "var(--bg-elevated)", borderLeft: `2px solid ${sevColor}`, transform: open ? "translateX(0)" : "translateX(100%)", transition: "transform 0.3s cubic-bezier(0.16,1,0.3,1)", display: "flex", flexDirection: "column", overflowY: "auto" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 500 }}>Инцидент ОТ/ТБ</h2>
              <p style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 2 }}>Фиксация нарушения или происшествия</p>
            </div>
            <button onClick={() => { reset(); onClose(); }} style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid var(--border-subtle)", background: "transparent", color: "var(--text-tertiary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3l10 10M13 3L3 13" /></svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 32px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div><Label text="Описание инцидента" required /><input style={inputStyle} placeholder="Падение с высоты, порез, нарушение СИЗ..." value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /></div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div>
              <Label text="Серьёзность" />
              <select value={severity} onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
                style={{ ...inputStyle, border: `1px solid ${sevColor}`, color: sevColor }}>
                {(["Незначительный", "Средний", "Тяжёлый", "Критический"] as IncidentSeverity[]).map((s) => (
                  <option key={s} value={s} style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>{s}</option>
                ))}
              </select>
            </div>
            <div><Label text="Дата" /><input style={inputStyle} type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div><Label text="Проект" /><input style={inputStyle} placeholder="PR-..." value={project} onChange={(e) => setProject(e.target.value)} /></div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><Label text="Пострадавший" /><input style={inputStyle} placeholder="Иванов А.П., монтажник" value={affected} onChange={(e) => setAffected(e.target.value)} /></div>
            <div><Label text="Место" /><input style={inputStyle} placeholder="Ось 3-4, отм. +9.000" value={location} onChange={(e) => setLocation(e.target.value)} /></div>
          </div>

          <div><Label text="Подробное описание" /><textarea style={{ ...inputStyle, resize: "vertical", minHeight: 72 }} placeholder="Что произошло, при каких обстоятельствах..." value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div><Label text="Принятые меры" /><textarea style={{ ...inputStyle, resize: "vertical", minHeight: 52 }} placeholder="Оказана первая помощь, остановлены работы..." value={measures} onChange={(e) => setMeasures(e.target.value)} /></div>
          <div><Label text="Превентивные мероприятия" /><textarea style={{ ...inputStyle, resize: "vertical", minHeight: 48 }} placeholder="Проведён инструктаж, установлено ограждение..." value={preventive} onChange={(e) => setPreventive(e.target.value)} /></div>

          {error && <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "var(--danger)", fontSize: 12.5 }}>{error}</div>}

          <button type="submit" disabled={saving}
            style={{ width: "100%", padding: "11px 0", borderRadius: 10, border: "none", background: saving ? "var(--border-subtle)" : "var(--danger)", color: saving ? "var(--text-tertiary)" : "white", fontSize: 13.5, fontWeight: 500, cursor: saving ? "wait" : "pointer" }}>
            {saving ? "Сохранение..." : "Зафиксировать инцидент"}
          </button>
        </form>
      </div>
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function SafetyPage() {
  const [stats, setStats] = useState<ForemanStats | null>(null);
  const [reports, setReports] = useState<ForemanReport[]>([]);
  const [incidents, setIncidents] = useState<SafetyIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const [incidentOpen, setIncidentOpen] = useState(false);

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") { setReportOpen(false); setIncidentOpen(false); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  async function load() {
    setLoading(true);
    const [s, r, i] = await Promise.all([
      fetch("/api/foreman/stats").then((x) => x.json()),
      fetch("/api/foreman/report").then((x) => x.json()),
      fetch("/api/foreman/incident").then((x) => x.json()),
    ]);
    setStats(s);
    setReports(Array.isArray(r) ? r : []);
    setIncidents(Array.isArray(i) ? i : []);
    setLoading(false);
  }

  async function handleReportStatus(name: string, status: ReportStatus) {
    await fetch(`/api/foreman/report/${name}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    setReports((prev) => prev.map((r) => r.name === name ? { ...r, status } : r));
    if (stats) {
      const rep = reports.find((r) => r.name === name);
      if (rep?.has_safety_incident) {
        setStats((s) => s ? { ...s } : s);
      }
    }
  }

  async function handleIncidentStatus(name: string, status: IncidentStatus) {
    await fetch(`/api/foreman/incident/${name}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    setIncidents((prev) => prev.map((i) => i.name === name ? { ...i, status } : i));
  }

  const openIncidents = incidents.filter((i) => i.status !== "Закрыт");
  const closedIncidents = incidents.filter((i) => i.status === "Закрыт");

  return (
    <div style={{ padding: "24px 32px", minHeight: "100vh", background: "var(--bg-base)" }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em" }}>Прорабы · ОТ/ТБ</h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>Ежедневные отчёты и инциденты по безопасности</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setIncidentOpen(true)}
            style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, background: "rgba(248,113,113,0.1)", color: "var(--danger)", border: "1px solid rgba(248,113,113,0.3)", cursor: "pointer" }}>
            + Инцидент
          </button>
          <button onClick={() => setReportOpen(true)}
            style={{ padding: "8px 18px", borderRadius: 10, fontSize: 13, background: "var(--accent)", color: "white", border: "none", cursor: "pointer" }}>
            + Отчёт
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 20, marginBottom: 24, padding: "14px 20px", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 14 }}>
        <Stat label="Отчётов за месяц" value={stats?.reports_this_month ?? "—"} />
        <Div />
        <Stat label="Рабочих сегодня" value={stats?.workers_today ?? "—"} unit="чел" />
        <Div />
        <Stat label="Открытых инцидентов" value={stats?.open_incidents ?? "—"}
          accent={stats && stats.open_incidents > 0 ? "var(--danger)" : undefined} />
        <Div />
        <Stat label="Тяжёлых / критических" value={stats?.critical_incidents ?? "—"}
          accent={stats && stats.critical_incidents > 0 ? "#ef4444" : undefined} />
      </div>

      {loading && <div style={{ textAlign: "center", padding: 64, color: "var(--text-tertiary)" }}>Загрузка...</div>}

      {!loading && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {/* Reports */}
          <div>
            <p style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "monospace", marginBottom: 12 }}>
              Отчёты прорабов
              {reports.length > 0 && <span style={{ marginLeft: 8, padding: "1px 7px", borderRadius: 10, background: "rgba(249,115,22,0.12)", color: "var(--accent)" }}>{reports.length}</span>}
            </p>

            {reports.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center", borderRadius: 14, background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", color: "var(--text-tertiary)", fontSize: 13 }}>
                Нет отчётов. Создайте первый.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 1, background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 14, overflow: "hidden" }}>
                {reports.map((r) => (
                  <div key={r.name} style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "flex-start", gap: 12 }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.foreman_name || r.title}
                        </p>
                        {r.has_safety_incident ? (
                          <span style={{ fontSize: 9.5, padding: "1px 5px", borderRadius: 4, background: "rgba(248,113,113,0.15)", color: "var(--danger)", fontFamily: "monospace", flexShrink: 0 }}>ОТ/ТБ</span>
                        ) : null}
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <p style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "monospace" }}>
                          {r.report_date}{r.workers_count ? ` · ${r.workers_count} чел` : ""}
                        </p>
                      </div>
                    </div>
                    <select value={r.status} onChange={(e) => handleReportStatus(r.name, e.target.value as ReportStatus)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ fontSize: 11, padding: "2px 7px", borderRadius: 6, border: `1px solid ${REPORT_STATUS_COLOR[r.status]}`, background: "transparent", color: REPORT_STATUS_COLOR[r.status], cursor: "pointer", outline: "none" }}>
                      {(["Черновик", "Отправлен", "Принят"] as ReportStatus[]).map((s) => (
                        <option key={s} value={s} style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>{s}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Incidents */}
          <div>
            <p style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "monospace", marginBottom: 12 }}>
              Инциденты ОТ/ТБ
              {openIncidents.length > 0 && (
                <span style={{ marginLeft: 8, padding: "1px 7px", borderRadius: 10, background: "rgba(248,113,113,0.1)", color: "var(--danger)" }}>{openIncidents.length} открыт{openIncidents.length === 1 ? "" : "о"}</span>
              )}
            </p>

            {incidents.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center", borderRadius: 14, background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", color: "var(--text-tertiary)", fontSize: 13 }}>
                Инцидентов нет. Это хорошо.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[...openIncidents, ...closedIncidents].map((inc) => (
                  <div key={inc.name} style={{ padding: "12px 16px", borderRadius: 12, background: "var(--bg-elevated)", border: `1px solid ${inc.status === "Закрыт" ? "var(--border-subtle)" : SEVERITY_COLOR[inc.severity]}`, opacity: inc.status === "Закрыт" ? 0.65 : 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: SEVERITY_COLOR[inc.severity], flexShrink: 0 }} />
                          <p style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inc.title}</p>
                        </div>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <span style={{ fontSize: 10.5, padding: "1px 6px", borderRadius: 4, border: `1px solid ${SEVERITY_COLOR[inc.severity]}`, color: SEVERITY_COLOR[inc.severity] }}>{inc.severity}</span>
                          <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "monospace" }}>{inc.incident_date}</span>
                          {inc.affected_person && <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{inc.affected_person}</span>}
                        </div>
                      </div>
                      <select value={inc.status} onChange={(e) => handleIncidentStatus(inc.name, e.target.value as IncidentStatus)}
                        style={{ fontSize: 11, padding: "2px 7px", borderRadius: 6, border: `1px solid ${INCIDENT_STATUS_COLOR[inc.status]}`, background: "transparent", color: INCIDENT_STATUS_COLOR[inc.status], cursor: "pointer", outline: "none", flexShrink: 0 }}>
                        {(["Открыт", "В работе", "Закрыт"] as IncidentStatus[]).map((s) => (
                          <option key={s} value={s} style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <ReportCreateDrawer open={reportOpen} onClose={() => setReportOpen(false)} onCreated={async () => { await load(); }} />
      <IncidentCreateDrawer open={incidentOpen} onClose={() => setIncidentOpen(false)} onCreated={async () => { await load(); }} />
    </div>
  );
}

function Div() { return <div style={{ width: 1, background: "var(--border-subtle)" }} />; }
function Stat({ label, value, unit, accent }: { label: string; value: string | number; unit?: string; accent?: string }) {
  return (
    <div>
      <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 2 }}>{label}</p>
      <p style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 600, color: accent ?? "var(--text-primary)" }}>
        {value}{unit && <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-tertiary)", marginLeft: 4 }}>{unit}</span>}
      </p>
    </div>
  );
}
