"use client";

import { useEffect, useState } from "react";
import type { MaterialRequest, SupplyStatus } from "@/types/supply";
import { SupplyDrawer } from "@/components/supply/SupplyDrawer";
import { SupplyCreateDrawer } from "@/components/supply/SupplyCreateDrawer";

const STATUS_COLOR: Record<string, string> = {
  "Черновик":   "var(--text-tertiary)",
  "Отправлена": "var(--info)",
  "Одобрена":   "var(--warning)",
  "Закупается": "var(--accent)",
  "Получена":   "var(--success)",
  "Отменена":   "var(--danger)",
};

const PRIORITY_COLOR: Record<string, string> = {
  "Обычная":     "var(--text-tertiary)",
  "Срочная":     "var(--warning)",
  "Критическая": "var(--danger)",
};

function formatMln(v?: number | null) {
  if (!v) return "—";
  return `${(v / 1_000_000).toFixed(2)} млн ₽`;
}

function formatThousands(v?: number | null) {
  if (!v) return "—";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} млн`;
  return `${(v / 1000).toFixed(0)} тыс`;
}

export default function SupplyPage() {
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerName, setDrawerName] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    loadRequests();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setDrawerName(null); setCreateOpen(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  async function loadRequests() {
    setLoading(true);
    try {
      const data = await fetch("/api/supply").then((r) => r.json());
      setRequests(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreated(name: string) {
    setCreateOpen(false);
    await loadRequests();
    setDrawerName(name);
  }

  function handleStatusChange(name: string, status: SupplyStatus) {
    setRequests((prev) => prev.map((r) => r.name === name ? { ...r, status } : r));
  }

  const totalEstimated = requests.reduce((s, r) => s + (r.total_estimated ?? 0), 0);
  const urgentCount = requests.filter((r) => r.priority === "Критическая" && !["Получена", "Отменена"].includes(r.status)).length;
  const pendingCount = requests.filter((r) => r.status === "Одобрена").length;

  // Группировка по статусу для отображения
  const activeRequests = requests.filter((r) => !["Получена", "Отменена"].includes(r.status));
  const doneRequests = requests.filter((r) => ["Получена", "Отменена"].includes(r.status));

  return (
    <div style={{ padding: "24px 32px", minHeight: "100vh", background: "var(--bg-base)" }}>
      {/* Заголовок */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em" }}>Снабжение</h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>Заявки на материалы</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          style={{ padding: "8px 18px", borderRadius: 10, fontSize: 13, background: "var(--accent)", color: "white", border: "none", cursor: "pointer" }}
        >
          + Заявка
        </button>
      </div>

      {/* Статистика */}
      <div style={{ display: "flex", gap: 24, marginBottom: 24, padding: "14px 20px", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 14 }}>
        <Stat label="Всего" value={requests.length} unit="шт" />
        <Divider />
        <Stat label="Активных" value={activeRequests.length} unit="шт" />
        <Divider />
        <Stat label="Сумма оценка" value={(totalEstimated / 1_000_000).toFixed(1)} unit="млн ₽" />
        <Divider />
        <Stat label="К одобрению" value={pendingCount} unit="шт" accent={pendingCount > 0 ? "var(--warning)" : undefined} />
        <Divider />
        <Stat label="Критических" value={urgentCount} unit="шт" accent={urgentCount > 0 ? "var(--danger)" : undefined} />
      </div>

      {loading && <div style={{ textAlign: "center", padding: 64, color: "var(--text-tertiary)" }}>Загрузка...</div>}
      {error && (
        <div style={{ padding: 16, borderRadius: 12, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "var(--danger)", fontSize: 13 }}>{error}</div>
      )}

      {!loading && !error && (
        <>
          {/* Активные заявки */}
          <RequestTable
            title="Активные"
            requests={activeRequests}
            onRowClick={(r) => setDrawerName(r.name)}
          />

          {/* Завершённые */}
          {doneRequests.length > 0 && (
            <RequestTable
              title="Завершённые"
              requests={doneRequests}
              onRowClick={(r) => setDrawerName(r.name)}
              muted
            />
          )}

          {requests.length === 0 && (
            <div style={{ padding: "64px 20px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
              Заявок пока нет. Создайте первую.
            </div>
          )}
        </>
      )}

      <SupplyDrawer name={drawerName} onClose={() => setDrawerName(null)} onStatusChange={handleStatusChange} />
      <SupplyCreateDrawer open={createOpen} onClose={() => setCreateOpen(false)} onCreated={handleCreated} />
    </div>
  );
}

function RequestTable({ title, requests, onRowClick, muted }: {
  title: string;
  requests: MaterialRequest[];
  onRowClick: (r: MaterialRequest) => void;
  muted?: boolean;
}) {
  if (requests.length === 0) return null;
  return (
    <div style={{ marginBottom: 24 }}>
      <p style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "monospace", marginBottom: 8 }}>{title} · {requests.length}</p>
      <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 14, overflow: "hidden", opacity: muted ? 0.6 : 1 }}>
        {/* Шапка */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,3fr) 100px 120px 100px 120px 36px",
          padding: "10px 20px",
          background: "var(--bg-base)",
          borderBottom: "1px solid var(--border-subtle)",
          fontSize: 10.5, fontFamily: "monospace",
          textTransform: "uppercase", letterSpacing: "0.04em",
          color: "var(--text-tertiary)",
        }}>
          <span>Название</span>
          <span>Приоритет</span>
          <span>Статус</span>
          <span style={{ textAlign: "right" }}>Нужно к</span>
          <span style={{ textAlign: "right" }}>Сумма</span>
          <span />
        </div>

        {requests.map((req) => (
          <div
            key={req.name}
            onClick={() => onRowClick(req)}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0,3fr) 100px 120px 100px 120px 36px",
              padding: "13px 20px",
              borderBottom: "1px solid var(--border-subtle)",
              cursor: "pointer",
              alignItems: "center",
              transition: "background 0.12s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.025)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <div>
              <p style={{ fontSize: 13, fontWeight: 500 }}>{req.title}</p>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "monospace", marginTop: 2 }}>
                {req.name}{req.project ? ` · ${req.project}` : ""}
              </p>
            </div>
            <span style={{ fontSize: 11.5, color: PRIORITY_COLOR[req.priority] ?? "var(--text-tertiary)", fontWeight: req.priority !== "Обычная" ? 600 : 400 }}>
              {req.priority}
            </span>
            <span style={{
              fontSize: 11, padding: "2px 8px", borderRadius: 6,
              border: `1px solid ${STATUS_COLOR[req.status] ?? "var(--border-subtle)"}`,
              color: STATUS_COLOR[req.status] ?? "var(--text-secondary)",
              display: "inline-block",
            }}>
              {req.status}
            </span>
            <span style={{ textAlign: "right", fontSize: 12, color: "var(--text-tertiary)", fontFamily: "monospace" }}>
              {req.needed_by_date ? new Date(req.needed_by_date).toLocaleDateString("ru", { day: "2-digit", month: "2-digit" }) : "—"}
            </span>
            <span style={{ textAlign: "right", fontFamily: "monospace", fontSize: 13 }}>
              {req.total_estimated ? `${(req.total_estimated / 1000).toFixed(0)} тыс` : "—"}
            </span>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" style={{ marginLeft: "auto" }}>
              <path d="M6 3l5 5-5 5" />
            </svg>
          </div>
        ))}
      </div>
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
