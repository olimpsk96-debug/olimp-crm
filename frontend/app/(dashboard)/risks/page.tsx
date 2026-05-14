"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import RiskMatrix from "@/components/risk/RiskMatrix";
import RiskDrawer from "@/components/risk/RiskDrawer";
import type { ProjectRisk, RiskSummary, MatrixCell, RiskStatus, RiskCategory } from "@/types/risk";

const STATUS_COLOR: Record<RiskStatus, { bg: string; color: string }> = {
  "Открыт":      { bg: "rgba(248,113,113,0.12)", color: "var(--danger)" },
  "В работе":    { bg: "rgba(251,191,36,0.14)",  color: "var(--warning)" },
  "Снижен":      { bg: "rgba(34,197,94,0.16)",   color: "var(--success)" },
  "Закрыт":      { bg: "rgba(120,120,160,0.14)", color: "var(--text-tertiary)" },
  "Реализовался":{ bg: "rgba(168,139,250,0.16)", color: "#a78bfa" },
};

const CATEGORIES: RiskCategory[] = [
  "Финансовый", "Технический", "Срочный", "Качество", "Безопасность",
  "Регуляторный", "Поставщик", "Заказчик", "Погодный",
];

const inputStyle: React.CSSProperties = {
  padding: "8px 10px", fontSize: 13, color: "var(--text-primary)",
  background: "var(--bg-base)", border: "1px solid var(--border-subtle)", borderRadius: 8,
  outline: "none",
};

const fmtMoney = (n: number) => {
  if (!n) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} млн ₽`;
  return `${Math.round(n).toLocaleString("ru-RU")} ₽`;
};

function scoreColor(score: number): string {
  if (score >= 15) return "var(--danger)";
  if (score >= 8) return "var(--warning)";
  return "var(--success)";
}

export default function RisksPage() {
  const searchParams = useSearchParams();
  const [list, setList] = useState<ProjectRisk[]>([]);
  const [summary, setSummary] = useState<RiskSummary | null>(null);
  const [matrix, setMatrix] = useState<MatrixCell[]>([]);
  const [projects, setProjects] = useState<{ name: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const [projectFilter, setProjectFilter] = useState(searchParams.get("project") || "");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [editName, setEditName] = useState<string | null>(null); // null | "new" | name
  const [highlightCell, setHighlightCell] = useState<MatrixCell | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (projectFilter) params.set("project", projectFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (categoryFilter) params.set("category", categoryFilter);

    const [lRes, sRes, mRes] = await Promise.all([
      fetch(`/api/risks?${params}`).then(r => r.json()),
      fetch(`/api/risks/summary${projectFilter ? `?project=${encodeURIComponent(projectFilter)}` : ""}`).then(r => r.json()),
      fetch(`/api/risks/matrix${projectFilter ? `?project=${encodeURIComponent(projectFilter)}` : ""}`).then(r => r.json()),
    ]);
    setList(Array.isArray(lRes) ? lRes : []);
    setSummary(sRes && !sRes.error ? sRes : null);
    setMatrix(Array.isArray(mRes) ? mRes : []);
    setLoading(false);
  }, [projectFilter, statusFilter, categoryFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch("/api/projects").then(r => r.json()).then(d => setProjects(Array.isArray(d) ? d : []));
  }, []);

  const filtered = useMemo(() => {
    let arr = list;
    if (debouncedSearch) {
      arr = arr.filter(r => {
        const hay = [r.title, r.owner_full_name, r.mitigation_plan].filter(Boolean).join(" ").toLowerCase();
        return hay.includes(debouncedSearch);
      });
    }
    if (highlightCell) {
      const names = new Set(highlightCell.items.map(it => it.name));
      arr = arr.filter(r => names.has(r.name));
    }
    return arr;
  }, [list, debouncedSearch, highlightCell]);

  return (
    <div style={{ padding: "24px 32px", minHeight: "100vh", background: "var(--bg-base)" }}>
      {/* Header */}
      <div style={{ marginBottom: 18, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>Реестр рисков</h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>
            Идентификация, оценка и реакция на проектные риски. Контингенция считается как ожидаемая стоимость (impact × probability / 5)
          </p>
        </div>
        <button onClick={() => setEditName("new")} style={btnPrimary}>+ Новый риск</button>
      </div>

      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 16 }}>
        <KPI label="Всего"        value={summary?.total ?? "—"}          color="var(--text-primary)" />
        <KPI label="Открытых"     value={summary?.open_count ?? "—"}     color="var(--accent)" />
        <KPI label="Красная зона" value={summary?.red_zone ?? "—"}       color="var(--danger)" />
        <KPI label="Жёлтая"       value={summary?.yellow_zone ?? "—"}    color="var(--warning)" />
        <KPI label="Зелёная"      value={summary?.green_zone ?? "—"}     color="var(--success)" />
        <KPI label="Резерв всего" value={summary ? fmtMoney(summary.contingency_total) : "—"} color="var(--accent)" />
      </div>

      {/* Контингенция / max exposure summary */}
      {summary && summary.total > 0 && (
        <div style={{
          padding: "10px 14px", marginBottom: 14, borderRadius: 10,
          background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
          display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap", fontSize: 12,
        }}>
          <span style={{ color: "var(--text-tertiary)" }}>
            Ожидаемая контингенция:{" "}
            <strong style={{ color: "var(--accent)", fontFamily: "monospace", fontSize: 13 }}>
              {fmtMoney(summary.contingency_total)}
            </strong>
          </span>
          <span style={{ color: "var(--text-tertiary)" }}>
            Максимальный финансовый импакт (если ВСЕ риски):{" "}
            <strong style={{ color: "var(--warning)", fontFamily: "monospace", fontSize: 13 }}>
              {fmtMoney(summary.max_exposure)}
            </strong>
          </span>
        </div>
      )}

      {/* Filters */}
      <div style={{
        display: "flex", gap: 10, marginBottom: 16, padding: 12,
        background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 12, flexWrap: "wrap",
      }}>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
               placeholder="Поиск по названию, ответственному, плану..."
               style={{ ...inputStyle, flex: "1 1 240px", minWidth: 200 }} />
        <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} style={{ ...inputStyle, flex: "0 1 200px" }}>
          <option value="">Все проекты</option>
          {projects.map(p => <option key={p.name} value={p.name}>{p.title}</option>)}
        </select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ ...inputStyle, flex: "0 1 160px" }}>
          <option value="">Все категории</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...inputStyle, flex: "0 1 140px" }}>
          <option value="">Все статусы</option>
          {["Открыт", "В работе", "Снижен", "Закрыт", "Реализовался"].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Matrix */}
      <div style={{ marginBottom: 16 }}>
        <RiskMatrix
          cells={matrix}
          onCellClick={(cell) => setHighlightCell(highlightCell?.p === cell.p && highlightCell?.i === cell.i ? null : cell)}
        />
        {highlightCell && (
          <div style={{
            marginTop: 8, padding: "6px 12px", borderRadius: 8,
            background: "rgba(96,165,250,0.08)", color: "#60a5fa", fontSize: 12,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span>Показаны риски ячейки P{highlightCell.p}×I{highlightCell.i} (score {highlightCell.score}): {highlightCell.count} шт.</span>
            <button onClick={() => setHighlightCell(null)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 11, textDecoration: "underline" }}>
              сбросить
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div style={{ background: "var(--bg-elevated)", borderRadius: 12, border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "var(--bg-base)" }}>
            <tr>
              <th style={th}>Риск</th>
              <th style={th}>Проект</th>
              <th style={th}>Категория</th>
              <th style={{ ...th, textAlign: "center" }}>P × I</th>
              <th style={{ ...th, textAlign: "right" }}>Импакт</th>
              <th style={{ ...th, textAlign: "right" }}>Резерв</th>
              <th style={th}>Стратегия</th>
              <th style={th}>Ответств.</th>
              <th style={th}>Статус</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Загрузка...</td></tr>}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>
                Рисков нет. {list.length > 0 ? "Сбросьте фильтры." : 'Нажмите "+ Новый риск" для добавления.'}
              </td></tr>
            )}
            {!loading && filtered.map(r => {
              const stCol = STATUS_COLOR[r.status];
              return (
                <tr key={r.name}
                    onClick={() => setEditName(r.name)}
                    style={{ borderTop: "1px solid var(--border-subtle)", cursor: "pointer" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                  <td style={td}>
                    <div style={{ fontWeight: 500 }}>{r.title}</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2, fontFamily: "monospace" }}>{r.name}</div>
                  </td>
                  <td style={{ ...td, fontSize: 12, color: "var(--text-secondary)" }}>{r.project}</td>
                  <td style={{ ...td, fontSize: 12, color: "var(--text-secondary)" }}>{r.category}</td>
                  <td style={{ ...td, textAlign: "center" }}>
                    <span style={{
                      padding: "2px 8px", borderRadius: 6, fontSize: 12, fontFamily: "monospace", fontWeight: 600,
                      background: `${scoreColor(r.risk_score)}22`, color: scoreColor(r.risk_score),
                    }}>
                      {r.risk_score}
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "var(--text-secondary)" }}>
                    {r.impact_amount ? fmtMoney(r.impact_amount) : "—"}
                  </td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 500, color: "var(--accent)" }}>
                    {r.contingency_amount ? fmtMoney(r.contingency_amount) : "—"}
                  </td>
                  <td style={{ ...td, fontSize: 11, color: "var(--text-tertiary)" }}>{r.response_strategy || "—"}</td>
                  <td style={{ ...td, fontSize: 12, color: "var(--text-secondary)" }}>{r.owner_full_name || "—"}</td>
                  <td style={td}>
                    <span style={{ padding: "3px 10px", borderRadius: 8, background: stCol.bg, color: stCol.color, fontSize: 11, fontWeight: 600 }}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editName && (
        <RiskDrawer
          name={editName === "new" ? "new" : editName}
          projects={projects}
          defaultProject={projectFilter}
          onClose={() => setEditName(null)}
          onSaved={() => { setEditName(null); load(); }}
          onDeleted={() => { setEditName(null); load(); }}
        />
      )}
    </div>
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

const th: React.CSSProperties = { padding: "10px 12px", textAlign: "left", color: "var(--text-tertiary)", fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" };
const td: React.CSSProperties = { padding: "10px 12px", color: "var(--text-primary)", verticalAlign: "middle" };
const btnPrimary: React.CSSProperties = { padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 500, background: "var(--accent)", color: "white", border: "none", cursor: "pointer" };
