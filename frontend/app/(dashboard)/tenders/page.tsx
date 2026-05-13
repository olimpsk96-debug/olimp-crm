"use client";

import { useEffect, useState } from "react";
import type { Tender, TenderStatus } from "@/types/tender";
import { KanbanColumn } from "@/components/tenders/KanbanColumn";
import { TenderDrawer } from "@/components/tenders/TenderDrawer";
import { TenderCreateDrawer } from "@/components/tenders/TenderCreateDrawer";
import { ExportButton } from "@/components/shared/ExportButton";

const COLUMNS: { status: TenderStatus; label: string; color: string }[] = [
  { status: "Новый",             label: "Найдено",       color: "var(--info)" },
  { status: "Оценивается",       label: "Анализ",        color: "var(--warning)" },
  { status: "Готовится заявка",  label: "Подготовка КП", color: "var(--accent)" },
  { status: "Заявка подана",     label: "Подано",        color: "#C084FC" },
  { status: "Выиграли",          label: "Выиграно",      color: "var(--success)" },
  { status: "Проиграли",         label: "Проиграно",     color: "var(--danger)" },
];

async function fetchTenders(): Promise<Tender[]> {
  const res = await fetch("/api/tenders", { credentials: "include" });
  if (!res.ok) throw new Error("Ошибка загрузки тендеров");
  return res.json();
}

export default function TendersPage() {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerName, setDrawerName] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    fetchTenders()
      .then(setTenders)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setDrawerName(null); setCreateOpen(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  async function handleCreated(name: string) {
    setCreateOpen(false);
    const fresh = await fetchTenders();
    setTenders(fresh);
    setDrawerName(name);
  }

  function handleStatusChange(name: string, status: TenderStatus) {
    setTenders((prev) => prev.map((t) => t.name === name ? { ...t, status } : t));
  }

  const totalNmck = tenders.reduce((s, t) => s + (t.nmck ?? 0), 0);
  const wonCount  = tenders.filter((t) => t.status === "Выиграли").length;
  const urgentCount = tenders.filter((t) => {
    if (!t.deadline_date) return false;
    const days = Math.ceil((new Date(t.deadline_date).getTime() - Date.now()) / 86_400_000);
    return days >= 0 && days <= 3 && !["Выиграли","Проиграли","Отклонён"].includes(t.status);
  }).length;

  return (
    <div style={{ padding: "24px 32px", minHeight: "100vh", background: "var(--bg-base)" }}>
      {/* Заголовок */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em" }}>Тендеры</h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>Pipeline закупок</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <ExportButton spec="tenders" />
          <button
            onClick={() => setCreateOpen(true)}
            style={{
              padding: "8px 18px", borderRadius: 10, fontSize: 13,
              background: "var(--accent)", color: "white", border: "none",
              cursor: "pointer",
            }}
          >
            + Тендер
          </button>
        </div>
      </div>

      {/* Статистика */}
      <div style={{ display: "flex", gap: 24, marginBottom: 24, padding: "14px 20px", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 14 }}>
        <Stat label="Всего" value={tenders.length} unit="шт" />
        <Divider />
        <Stat label="Сумма" value={(totalNmck / 1_000_000).toFixed(1)} unit="млн ₽" />
        <Divider />
        <Stat label="Выиграно" value={wonCount} unit="шт" accent="var(--success)" />
        <Divider />
        <Stat
          label="Конверсия"
          value={tenders.length ? Math.round((wonCount / tenders.length) * 100) : 0}
          unit="%"
          accent={wonCount > 0 ? "var(--success)" : undefined}
        />
        <Divider />
        <Stat
          label="Дедлайны < 3д"
          value={urgentCount}
          unit="шт"
          accent={urgentCount > 0 ? "var(--danger)" : undefined}
        />
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: 64, color: "var(--text-tertiary)" }}>Загрузка...</div>
      )}
      {error && (
        <div style={{ padding: 16, borderRadius: 12, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "var(--danger)", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Kanban */}
      {!loading && !error && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(220px, 1fr))`, gap: 12, overflowX: "auto" }}>
          {COLUMNS.map((col) => {
            const colTenders = tenders.filter((t) => t.status === col.status);
            const colNmck = colTenders.reduce((s, t) => s + (t.nmck ?? 0), 0);
            return (
              <KanbanColumn
                key={col.status}
                status={col.status}
                label={col.label}
                color={col.color}
                tenders={colTenders}
                totalNmck={colNmck}
                onCardClick={(t) => setDrawerName(t.name)}
              />
            );
          })}
        </div>
      )}

      {/* Drawer детали */}
      <TenderDrawer
        name={drawerName}
        onClose={() => setDrawerName(null)}
        onStatusChange={handleStatusChange}
      />

      {/* Drawer создания */}
      <TenderCreateDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}

function Divider() {
  return <div style={{ width: 1, background: "var(--border-subtle)" }} />;
}

function Stat({ label, value, unit, accent }: { label: string; value: string | number; unit: string; accent?: string }) {
  return (
    <div>
      <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 2 }}>{label}</p>
      <p style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 600, color: accent ?? "var(--text-primary)" }}>
        {value}{" "}
        <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-tertiary)" }}>{unit}</span>
      </p>
    </div>
  );
}
