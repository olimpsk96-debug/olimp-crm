"use client";

import { useEffect, useState } from "react";
import type { Estimate, EstimateStatus } from "@/types/estimate";
import { EstimateDrawer } from "@/components/estimates/EstimateDrawer";

const STATUS_COLOR: Record<string, string> = {
  "Базовая":          "var(--info)",
  "Скорректированная":"var(--warning)",
  "Утверждена":       "var(--success)",
  "Архив":            "var(--text-tertiary)",
};

function formatMln(v?: number | null) {
  if (!v) return "—";
  return `${(v / 1_000_000).toFixed(2)} млн ₽`;
}

function MarginBadge({ pct }: { pct?: number | null }) {
  if (pct === undefined || pct === null) return <span style={{ color: "var(--text-tertiary)" }}>—</span>;
  const color = pct >= 20 ? "var(--success)" : pct >= 10 ? "var(--warning)" : "var(--danger)";
  return <span style={{ fontFamily: "monospace", color, fontWeight: 600 }}>{pct.toFixed(1)}%</span>;
}

export default function EstimatesPage() {
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerName, setDrawerName] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/estimates", { credentials: "include" })
      .then((r) => r.json())
      .then(setEstimates)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setDrawerName(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  async function handleCreate() {
    setCreating(true);
    try {
      const res = await fetch("/api/estimates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Новая смета", status: "Базовая" }),
      });
      const data = await res.json();
      if (data.created) {
        const refetch = await fetch("/api/estimates").then((r) => r.json());
        setEstimates(refetch);
        setDrawerName(data.created);
      }
    } finally {
      setCreating(false);
    }
  }

  function handleUpdated(updated: Estimate) {
    setEstimates((prev) => prev.map((e) => e.name === updated.name ? { ...e, ...updated } : e));
  }

  const totalBase = estimates.reduce((s, e) => s + (e.base_total ?? 0), 0);
  const totalOur = estimates.reduce((s, e) => s + (e.our_total ?? 0), 0);
  const approvedCount = estimates.filter((e) => e.status === "Утверждена").length;

  return (
    <div style={{ padding: "24px 32px", minHeight: "100vh", background: "var(--bg-base)" }}>
      {/* Заголовок */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em" }}>Сметы</h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>Ресурсная часть + маржинальность</p>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          style={{
            padding: "8px 18px", borderRadius: 10, fontSize: 13,
            background: "var(--accent)", color: "white", border: "none",
            cursor: creating ? "wait" : "pointer", opacity: creating ? 0.6 : 1,
          }}
        >
          {creating ? "Создание..." : "+ Новая смета"}
        </button>
      </div>

      {/* Статистика */}
      <div style={{ display: "flex", gap: 24, marginBottom: 24, padding: "14px 20px", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 14 }}>
        <Stat label="Всего" value={estimates.length} unit="шт" />
        <Divider />
        <Stat label="Сумма (норм)" value={(totalBase / 1_000_000).toFixed(1)} unit="млн ₽" />
        <Divider />
        <Stat label="Наша цена" value={(totalOur / 1_000_000).toFixed(1)} unit="млн ₽" accent="var(--accent)" />
        <Divider />
        <Stat label="Утверждено" value={approvedCount} unit="шт" accent={approvedCount > 0 ? "var(--success)" : undefined} />
      </div>

      {loading && <div style={{ textAlign: "center", padding: 64, color: "var(--text-tertiary)" }}>Загрузка...</div>}
      {error && (
        <div style={{ padding: 16, borderRadius: 12, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "var(--danger)", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Таблица */}
      {!loading && !error && (
        <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 14, overflow: "hidden" }}>
          {/* Шапка */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,3fr) 110px 120px 120px 90px 90px 60px",
            gap: 0, padding: "10px 20px",
            background: "var(--bg-base)",
            borderBottom: "1px solid var(--border-subtle)",
            fontSize: 10.5, fontFamily: "monospace",
            textTransform: "uppercase", letterSpacing: "0.04em",
            color: "var(--text-tertiary)",
          }}>
            <span>Название</span>
            <span>Статус</span>
            <span style={{ textAlign: "right" }}>Сумма норм.</span>
            <span style={{ textAlign: "right" }}>Наша цена</span>
            <span style={{ textAlign: "right" }}>Маржа</span>
            <span style={{ textAlign: "right" }}>Проект</span>
            <span></span>
          </div>

          {estimates.length === 0 && (
            <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
              Смет ещё нет. Создайте первую или импортируйте из Гранд-Сметы.
            </div>
          )}

          {estimates.map((est) => (
            <div
              key={est.name}
              onClick={() => setDrawerName(est.name)}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0,3fr) 110px 120px 120px 90px 90px 60px",
                gap: 0, padding: "14px 20px",
                borderBottom: "1px solid var(--border-subtle)",
                cursor: "pointer",
                transition: "background 0.12s ease",
                alignItems: "center",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.025)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div>
                <p style={{ fontSize: 13, fontWeight: 500 }}>{est.title}</p>
                <p style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "monospace", marginTop: 2 }}>{est.name}</p>
              </div>
              <div>
                <span style={{
                  fontSize: 11, padding: "2px 8px", borderRadius: 6,
                  border: `1px solid ${STATUS_COLOR[est.status] ?? "var(--border-subtle)"}`,
                  color: STATUS_COLOR[est.status] ?? "var(--text-secondary)",
                }}>
                  {est.status}
                </span>
              </div>
              <div style={{ textAlign: "right", fontFamily: "monospace", fontSize: 13, color: "var(--text-secondary)" }}>
                {formatMln(est.base_total)}
              </div>
              <div style={{ textAlign: "right", fontFamily: "monospace", fontSize: 13 }}>
                {formatMln(est.our_total)}
              </div>
              <div style={{ textAlign: "right" }}>
                <MarginBadge pct={est.margin_pct} />
              </div>
              <div style={{ textAlign: "right", fontSize: 12, color: "var(--text-tertiary)" }}>
                {est.project ?? "—"}
              </div>
              <div style={{ textAlign: "right" }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5">
                  <path d="M6 3l5 5-5 5" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      )}

      <EstimateDrawer
        name={drawerName}
        onClose={() => setDrawerName(null)}
        onUpdated={handleUpdated}
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
