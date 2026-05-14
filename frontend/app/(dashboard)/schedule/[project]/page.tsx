"use client";

import { useCallback, useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import GanttChart from "@/components/schedule/GanttChart";
import TaskDrawer from "@/components/schedule/TaskDrawer";
import type { ScheduleResponse, ScheduleSummary, ScheduleTask } from "@/types/schedule";

export default function SchedulePage({ params }: { params: Promise<{ project: string }> }) {
  const { project } = usePromise(params);
  const [data, setData] = useState<ScheduleResponse | null>(null);
  const [summary, setSummary] = useState<ScheduleSummary | null>(null);
  const [projects, setProjects] = useState<{ name: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState<string | null>(null); // null или "new" или name

  const load = useCallback(async () => {
    setLoading(true);
    const [tRes, sRes] = await Promise.all([
      fetch(`/api/schedule/${encodeURIComponent(project)}`).then(r => r.json()),
      fetch(`/api/schedule/${encodeURIComponent(project)}/summary`).then(r => r.json()),
    ]);
    setData(tRes);
    setSummary(sRes && !sRes.error ? sRes : null);
    setLoading(false);
  }, [project]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch("/api/projects").then(r => r.json()).then(d => setProjects(Array.isArray(d) ? d : []));
  }, []);

  const sections = (data?.tasks ?? []).filter(t => t.is_section === 1);
  const currentProject = projects.find(p => p.name === project);

  const fmtPct = (n: number) => `${n.toFixed(1)}%`;

  return (
    <div style={{ padding: "24px 32px", minHeight: "100vh", background: "var(--bg-base)" }}>
      {/* Header */}
      <div style={{ marginBottom: 20, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <Link href="/projects" style={{ color: "var(--text-tertiary)", fontSize: 12, textDecoration: "none" }}>← Проекты</Link>
            {currentProject && (
              <>
                <span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>/</span>
                <Link href={`/projects/${encodeURIComponent(project)}`} style={{ color: "var(--text-tertiary)", fontSize: 12, textDecoration: "none" }}>
                  {currentProject.title}
                </Link>
              </>
            )}
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>График работ</h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>
            Gantt-диаграмма проекта: разделы, задачи, критический путь
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <ProjectSelect projects={projects} current={project} />
          <button onClick={() => setEditName("new")} style={btnPrimary}>+ Задача / Раздел</button>
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 16 }}>
        <KPI label="Всего" value={summary?.total ?? "—"} color="var(--text-primary)" />
        <KPI label="Заплан." value={summary?.planned ?? "—"} color="var(--text-secondary)" />
        <KPI label="В работе" value={summary?.in_progress ?? "—"} color="#60a5fa" />
        <KPI label="Выполнено" value={summary?.done ?? "—"} color="var(--success)" />
        <KPI label="Просрочено" value={summary?.overdue ?? "—"} color={(summary?.overdue ?? 0) > 0 ? "var(--danger)" : "var(--text-tertiary)"} />
        <KPI label="КП" value={summary?.critical_count ?? "—"} color="var(--danger)" />
      </div>

      {/* Прогресс проекта */}
      {summary && data?.bounds && (
        <div style={{ marginBottom: 16, padding: 12, background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace" }}>
              Прогресс проекта (средневзвешенный)
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "monospace", color: "var(--accent)" }}>
              {fmtPct(summary.avg_progress)} · {data.bounds.total_days} дн ({data.bounds.start} → {data.bounds.end})
            </span>
          </div>
          <div style={{ width: "100%", height: 8, background: "var(--bg-base)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${summary.avg_progress}%`, height: "100%", background: "var(--accent)", transition: "width 0.3s ease" }} />
          </div>
        </div>
      )}

      {/* Gantt */}
      {loading && (
        <div style={{ padding: 60, textAlign: "center", color: "var(--text-tertiary)" }}>Загрузка...</div>
      )}
      {!loading && data && (
        <GanttChart
          tasks={data.tasks}
          bounds={data.bounds}
          onTaskClick={(n) => setEditName(n)}
        />
      )}

      {editName && (
        <TaskDrawer
          project={project}
          name={editName === "new" ? "new" : editName}
          parentOptions={sections.map(s => ({ name: s.name, title: s.title }))}
          onClose={() => setEditName(null)}
          onSaved={() => { setEditName(null); load(); }}
          onDeleted={() => { setEditName(null); load(); }}
        />
      )}
    </div>
  );
}

function ProjectSelect({ projects, current }: { projects: { name: string; title: string }[]; current: string }) {
  return (
    <select
      value={current}
      onChange={(e) => { window.location.href = `/schedule/${encodeURIComponent(e.target.value)}`; }}
      style={{
        padding: "9px 14px", fontSize: 13, fontWeight: 500, borderRadius: 10,
        background: "var(--bg-elevated)", color: "var(--text-primary)",
        border: "1px solid var(--border-subtle)", cursor: "pointer", minWidth: 200,
      }}>
      {projects.map(p => <option key={p.name} value={p.name}>{p.title}</option>)}
    </select>
  );
}

function KPI({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{ padding: "10px 14px", borderRadius: 10, background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
      <p style={{ fontSize: 10, color: "var(--text-tertiary)", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace" }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 600, color, margin: "4px 0 0", fontFamily: "monospace" }}>{value}</p>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 500,
  background: "var(--accent)", color: "white", border: "none", cursor: "pointer",
};
