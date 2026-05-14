"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import SubcontractBidDrawer from "@/components/subcontract/SubcontractBidDrawer";
import ProposalComparisonView from "@/components/subcontract/ProposalComparisonView";
import type {
  SubcontractBidRequest,
  BidRequestStatus,
  BidStats,
  SubWorkType,
} from "@/types/subcontract";

type QuickFilter = "all" | "active" | "comparing" | "awarded";

const STATUS_COLOR: Record<BidRequestStatus, { bg: string; color: string }> = {
  "Черновик":           { bg: "rgba(120,120,160,0.14)", color: "var(--text-tertiary)" },
  "Отправлено":         { bg: "rgba(96,165,250,0.14)",  color: "#60a5fa" },
  "Приём предложений":  { bg: "rgba(168,139,250,0.16)", color: "#a78bfa" },
  "Сравнение":          { bg: "rgba(251,191,36,0.14)",  color: "var(--warning)" },
  "Присуждён":          { bg: "rgba(34,197,94,0.18)",   color: "var(--success)" },
  "Отменён":            { bg: "rgba(248,113,113,0.12)", color: "var(--danger)" },
};

const WORK_TYPES: SubWorkType[] = ["АКЗ", "Кровля", "Промальп", "Монолит", "Усиление", "Комплексный"];

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
const fmtDate = (s?: string | null) => {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" });
};

function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const today = new Date(new Date().toISOString().slice(0, 10));
  const d = new Date(dateStr);
  return Math.ceil((d.getTime() - today.getTime()) / 86400000);
}

export default function SubcontractBidsPage() {
  const [items, setItems] = useState<SubcontractBidRequest[]>([]);
  const [stats, setStats] = useState<BidStats | null>(null);
  const [projects, setProjects] = useState<{ name: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [workTypeFilter, setWorkTypeFilter] = useState("");

  const [editName, setEditName] = useState<string | null>(null); // null или "new" или name
  const [compareName, setCompareName] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (projectFilter) params.set("project", projectFilter);
    if (workTypeFilter) params.set("work_type", workTypeFilter);

    const [listRes, statsRes] = await Promise.all([
      fetch(`/api/subcontract-bids?${params}`).then(r => r.json()),
      fetch(`/api/subcontract-bids/stats${projectFilter ? `?project=${encodeURIComponent(projectFilter)}` : ""}`).then(r => r.json()),
    ]);
    setItems(Array.isArray(listRes) ? listRes : []);
    setStats(statsRes && !statsRes.error ? statsRes : null);
    setLoading(false);
  }, [projectFilter, workTypeFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch("/api/projects").then(r => r.json()).then(d => setProjects(Array.isArray(d) ? d : []));
  }, []);

  const filtered = useMemo(() => {
    return items.filter(it => {
      if (quickFilter === "active" && !(["Отправлено", "Приём предложений", "Сравнение"] as BidRequestStatus[]).includes(it.status)) return false;
      if (quickFilter === "comparing" && it.status !== "Сравнение" && it.status !== "Приём предложений") return false;
      if (quickFilter === "awarded" && it.status !== "Присуждён") return false;

      if (debouncedSearch) {
        const hay = [it.title, it.project, it.awarded_to, it.created_by_full_name].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(debouncedSearch)) return false;
      }
      return true;
    });
  }, [items, quickFilter, debouncedSearch]);

  return (
    <div style={{ padding: "24px 32px", minHeight: "100vh", background: "var(--bg-base)" }}>
      {/* Header */}
      <div style={{ marginBottom: 20, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>Субподряд · Тендеры</h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>
            Закупка работ у подрядчиков с side-by-side сравнением КП и выбором победителя
          </p>
        </div>
        <button onClick={() => setEditName("new")} style={btnPrimary}>+ Новый тендер</button>
      </div>

      {/* KPI / quick filters */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
        <KPIButton label="Всего"          value={stats?.total ?? "—"}
                   active={quickFilter === "all"}      onClick={() => setQuickFilter("all")}
                   color="var(--text-primary)" />
        <KPIButton label="Активные"       value={stats?.active ?? "—"}
                   active={quickFilter === "active"}   onClick={() => setQuickFilter("active")}
                   color="#a78bfa" highlight="rgba(168,139,250,0.08)" />
        <KPIButton label="Присуждено"     value={stats?.awarded ?? "—"}
                   active={quickFilter === "awarded"}  onClick={() => setQuickFilter("awarded")}
                   color="var(--success)" highlight="rgba(34,197,94,0.08)" />
        <KPIButton label="Экономия суммарно"
                   value={stats ? fmtMoney(stats.total_savings) : "—"}
                   active={false} onClick={() => {}}
                   color="var(--success)" />
      </div>

      {/* Filters bar */}
      <div style={{
        display: "flex", gap: 10, marginBottom: 16, padding: 12,
        background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 12, flexWrap: "wrap",
      }}>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
               placeholder="Поиск по названию, проекту, подрядчику..."
               style={{ ...inputStyle, flex: "1 1 240px", minWidth: 200 }} />
        <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} style={{ ...inputStyle, flex: "0 1 200px" }}>
          <option value="">Все проекты</option>
          {projects.map(p => <option key={p.name} value={p.name}>{p.title}</option>)}
        </select>
        <select value={workTypeFilter} onChange={(e) => setWorkTypeFilter(e.target.value)} style={{ ...inputStyle, flex: "0 1 160px" }}>
          <option value="">Все виды работ</option>
          {WORK_TYPES.map(w => <option key={w} value={w}>{w}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={{ background: "var(--bg-elevated)", borderRadius: 12, border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "var(--bg-base)" }}>
            <tr>
              <th style={th}>Тендер</th>
              <th style={th}>Проект</th>
              <th style={th}>Тип работ</th>
              <th style={{ ...th, textAlign: "right" }}>Наша оценка</th>
              <th style={{ ...th, textAlign: "right" }}>Лучшее КП</th>
              <th style={{ ...th, textAlign: "right" }}>Экономия</th>
              <th style={{ ...th, textAlign: "center" }}>КП</th>
              <th style={th}>Дедлайн</th>
              <th style={th}>Статус</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Загрузка...</td></tr>}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>
                Тендеров нет. {items.length > 0 && "Снимите фильтры или измените запрос."}
              </td></tr>
            )}
            {!loading && filtered.map((it) => {
              const stCol = STATUS_COLOR[it.status];
              const days = daysUntil(it.deadline_date);
              const overdue = days !== null && days < 0;
              const close = days !== null && days >= 0 && days <= 2;
              return (
                <tr key={it.name}
                    onClick={() => setCompareName(it.name)}
                    style={{ borderTop: "1px solid var(--border-subtle)", cursor: "pointer" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                  <td style={td}>
                    <div style={{ fontWeight: 500 }}>{it.title}</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2, fontFamily: "monospace" }}>{it.name}</div>
                  </td>
                  <td style={{ ...td, fontSize: 12, color: "var(--text-secondary)" }}>{it.project}</td>
                  <td style={{ ...td, fontSize: 12, color: "var(--text-secondary)" }}>{it.work_type || "—"}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 500 }}>{fmtMoney(it.total_target_amount)}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: it.best_proposal_amount > 0 ? "var(--accent)" : "var(--text-tertiary)" }}>
                    {fmtMoney(it.best_proposal_amount)}
                  </td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: it.savings_amount > 0 ? "var(--success)" : "var(--text-tertiary)" }}>
                    {it.savings_amount > 0
                      ? <span><span style={{ fontWeight: 500 }}>{fmtMoney(it.savings_amount)}</span><div style={{ fontSize: 11 }}>{it.savings_pct.toFixed(1)}%</div></span>
                      : "—"}
                  </td>
                  <td style={{ ...td, textAlign: "center", fontFamily: "monospace", color: it.proposals_count > 0 ? "var(--text-primary)" : "var(--text-tertiary)", fontWeight: it.proposals_count > 0 ? 600 : 400 }}>
                    {it.proposals_count}
                  </td>
                  <td style={{ ...td, fontSize: 12, fontFamily: "monospace", color: overdue ? "var(--danger)" : close ? "var(--warning)" : "var(--text-tertiary)", fontWeight: (overdue || close) ? 600 : 400 }}>
                    {fmtDate(it.deadline_date)}
                    {days !== null && (overdue || close) && (
                      <div style={{ fontSize: 10 }}>
                        {overdue ? `просрочено ${-days}д` : `через ${days}д`}
                      </div>
                    )}
                  </td>
                  <td style={td}>
                    <span style={{ padding: "3px 10px", borderRadius: 8, background: stCol.bg, color: stCol.color, fontSize: 11, fontWeight: 600 }}>
                      {it.status}
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); setEditName(it.name); }}
                            style={{ marginLeft: 8, background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 12 }}>
                      редакт.
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editName && (
        <SubcontractBidDrawer
          name={editName === "new" ? "new" : editName}
          projects={projects}
          onClose={() => setEditName(null)}
          onSaved={() => { setEditName(null); load(); }}
        />
      )}
      {compareName && (
        <ProposalComparisonView
          bidRequestName={compareName}
          onClose={() => setCompareName(null)}
          onUpdated={() => load()}
        />
      )}
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────
function KPIButton({
  label, value, active, onClick, color, highlight,
}: {
  label: string; value: number | string; active: boolean;
  onClick: () => void; color: string; highlight?: string;
}) {
  return (
    <button onClick={onClick} style={{
      padding: "12px 16px", borderRadius: 12,
      background: active ? (highlight ?? "rgba(255,255,255,0.06)") : "var(--bg-elevated)",
      border: `1px solid ${active ? color : "var(--border-subtle)"}`,
      cursor: "pointer", textAlign: "left", transition: "all 0.15s ease",
    }}>
      <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace" }}>{label}</p>
      <p style={{ fontSize: 20, fontWeight: 600, color, margin: "4px 0 0", fontFamily: "monospace" }}>{value}</p>
    </button>
  );
}

const th: React.CSSProperties = { padding: "10px 12px", textAlign: "left", color: "var(--text-tertiary)", fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" };
const td: React.CSSProperties = { padding: "10px 12px", color: "var(--text-primary)", verticalAlign: "middle" };
const btnPrimary: React.CSSProperties = { padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 500, background: "var(--accent)", color: "white", border: "none", cursor: "pointer" };
