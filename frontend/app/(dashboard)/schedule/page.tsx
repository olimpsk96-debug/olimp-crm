"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Project {
  name: string;
  title: string;
  status?: string;
}

export default function SchedulesListPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then(r => r.json())
      .then(d => { setProjects(Array.isArray(d) ? d : []); setLoading(false); });
  }, []);

  const active = projects.filter(p => p.status !== "Завершён" && p.status !== "Отменён");
  const others = projects.filter(p => p.status === "Завершён" || p.status === "Отменён");

  return (
    <div style={{ padding: "24px 32px", minHeight: "100vh", background: "var(--bg-base)" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>Графики работ</h1>
        <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>
          Выберите проект, чтобы открыть его Gantt-диаграмму
        </p>
      </div>

      {loading && <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Загрузка...</div>}

      {!loading && (
        <>
          <h3 style={sectionH}>Активные проекты ({active.length})</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12, marginBottom: 24 }}>
            {active.map(p => (
              <Link key={p.name} href={`/schedule/${encodeURIComponent(p.name)}`} style={card}>
                <div style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-tertiary)", marginBottom: 4 }}>{p.name}</div>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>{p.title}</div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{p.status || "—"} · открыть график →</div>
              </Link>
            ))}
            {active.length === 0 && (
              <div style={{ padding: 30, textAlign: "center", color: "var(--text-tertiary)", gridColumn: "1 / -1" }}>
                Активных проектов нет
              </div>
            )}
          </div>

          {others.length > 0 && (
            <>
              <h3 style={sectionH}>Завершённые ({others.length})</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                {others.map(p => (
                  <Link key={p.name} href={`/schedule/${encodeURIComponent(p.name)}`} style={{ ...card, opacity: 0.6 }}>
                    <div style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-tertiary)", marginBottom: 4 }}>{p.name}</div>
                    <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>{p.title}</div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{p.status}</div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

const sectionH: React.CSSProperties = {
  fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase",
  letterSpacing: "0.06em", marginBottom: 10, fontFamily: "monospace", fontWeight: 500,
};
const card: React.CSSProperties = {
  display: "block", padding: 14, borderRadius: 10,
  background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
  color: "var(--text-primary)", textDecoration: "none", transition: "transform 0.1s, border-color 0.1s",
};
