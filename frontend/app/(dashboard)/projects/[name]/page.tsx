"use client";

import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import { ProjectDetail, ProjectStatus } from "@/types/project";
import { ProjectDocuments } from "@/components/projects/ProjectDocuments";

const fmtM = (v?: number | null) => {
  if (!v && v !== 0) return "—";
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)} млн ₽`;
  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)} тыс. ₽`;
  return `${v.toFixed(0)} ₽`;
};

const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const STATUS_COLORS: Record<ProjectStatus, { color: string; bg: string }> = {
  "Подготовка":  { color: "var(--text-tertiary)", bg: "rgba(156,163,175,0.1)" },
  "В работе":    { color: "var(--success)",       bg: "rgba(52,211,153,0.1)" },
  "Сдача":       { color: "var(--accent)",        bg: "rgba(249,115,22,0.1)" },
  "Закрыт":      { color: "#a78bfa",              bg: "rgba(167,139,250,0.1)" },
  "На паузе":    { color: "var(--warning)",       bg: "rgba(251,191,36,0.1)" },
  "Отменён":     { color: "var(--danger)",        bg: "rgba(248,113,113,0.1)" },
};

const ALL_STATUSES: ProjectStatus[] = ["Подготовка", "В работе", "Сдача", "Закрыт", "На паузе", "Отменён"];

type Tab = "overview" | "estimate" | "ks2" | "supply" | "equipment" | "reports" | "incidents" | "documents";

export default function ProjectDetailPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = use(params);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/detail?name=${encodeURIComponent(name)}`);
    setProject(await res.json());
  }, [name]);

  useEffect(() => { load(); }, [load]);

  async function changeStatus(status: ProjectStatus) {
    await fetch("/api/projects/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, status }),
    });
    setStatusMenuOpen(false);
    load();
  }

  if (!project) {
    return <div style={{ padding: 32, color: "var(--text-tertiary)" }}>Загрузка...</div>;
  }

  const statusStyle = STATUS_COLORS[project.status];
  const overdue = project.days_left !== null && project.days_left < 0 && !["Закрыт", "Отменён"].includes(project.status);

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "overview",  label: "Обзор" },
    { id: "estimate",  label: "Смета" },
    { id: "ks2",       label: "КС-2", count: project.ks2_acts.length },
    { id: "supply",    label: "Снабжение", count: project.supply.length },
    { id: "equipment", label: "Техника", count: project.equipment.length },
    { id: "reports",   label: "Отчёты прорабов", count: project.reports.length },
    { id: "incidents", label: "ОТ/ТБ", count: project.incidents.length },
    { id: "documents", label: "Документы" },
  ];

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1200 }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 12 }}>
        <Link href="/projects" style={{ fontSize: 12, color: "var(--text-tertiary)", textDecoration: "none" }}>
          ← Все проекты
        </Link>
      </div>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{project.title}</h1>
            <div style={{ position: "relative" }}>
              <button onClick={() => setStatusMenuOpen(v => !v)} style={{
                padding: "4px 12px", borderRadius: 10, background: statusStyle.bg, color: statusStyle.color,
                fontWeight: 600, fontSize: 12, border: "none", cursor: "pointer",
              }}>
                {project.status} ▾
              </button>
              {statusMenuOpen && (
                <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 8, zIndex: 10, minWidth: 160, boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
                  {ALL_STATUSES.filter(s => s !== project.status).map(s => (
                    <button key={s} onClick={() => changeStatus(s)} style={{
                      display: "block", width: "100%", padding: "8px 14px", background: "none",
                      border: "none", cursor: "pointer", textAlign: "left", fontSize: 12,
                      color: "var(--text-secondary)", borderBottom: "1px solid var(--border-subtle)",
                    }}>
                      → {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0 }}>
            {project.name} · {project.customer}
            {project.location ? ` · ${project.location}` : ""}
            {project.contract_number ? ` · Договор ${project.contract_number}` : ""}
          </p>
        </div>
      </div>

      {/* Метрики */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, margin: "20px 0" }}>
        <MetricCard
          label="Сумма контракта"
          value={fmtM(project.contract_amount)}
          sub={project.work_type ? project.work_type.split(" (")[0] : ""}
        />
        <MetricCard
          label="Прогресс"
          value={`${project.progress_pct}%`}
          sub={`Закрыто ${fmtM(project.margin.fact_revenue)}`}
          color={project.progress_pct >= 100 ? "var(--success)" : "var(--accent)"}
        />
        <MetricCard
          label={overdue ? "Просрочено" : "До сдачи"}
          value={project.days_left !== null ? `${overdue ? Math.abs(project.days_left) : project.days_left}д` : "—"}
          sub={project.planned_end_date ? `план: ${fmtDate(project.planned_end_date)}` : ""}
          color={overdue ? "var(--danger)" : project.days_left !== null && project.days_left <= 14 ? "var(--warning)" : undefined}
        />
        <MetricCard
          label="Маржа план / факт"
          value={`${project.margin.plan_margin_pct.toFixed(1)}% / ${project.margin.fact_margin_pct.toFixed(1)}%`}
          sub={`${fmtM(project.margin.plan_margin)} → ${fmtM(project.margin.fact_margin)}`}
          color={project.margin.fact_margin_pct >= project.margin.plan_margin_pct ? "var(--success)" : project.margin.fact_revenue > 0 ? "var(--warning)" : undefined}
        />
      </div>

      {/* Progress bar */}
      {project.contract_amount > 0 && (
        <div style={{ marginBottom: 24, padding: "12px 20px", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: 0 }}>
              Подписано КС-2: <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{fmtM(project.margin.fact_revenue)}</span>
              {project.margin.ks2_debt > 0 && <span style={{ marginLeft: 12, color: "var(--warning)" }}>дебиторка {fmtM(project.margin.ks2_debt)}</span>}
            </p>
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: 0 }}>из {fmtM(project.contract_amount)}</p>
          </div>
          <div style={{ height: 8, background: "var(--border-subtle)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${project.progress_pct}%`, background: project.progress_pct >= 100 ? "var(--success)" : "var(--accent)", transition: "width 0.3s" }} />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border-subtle)", marginBottom: 20, overflowX: "auto" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: "none", border: "none", cursor: "pointer",
            padding: "10px 16px 10px", fontSize: 13,
            borderBottom: tab === t.id ? "2px solid var(--accent)" : "2px solid transparent",
            color: tab === t.id ? "var(--accent)" : "var(--text-secondary)",
            fontWeight: tab === t.id ? 600 : 400,
            whiteSpace: "nowrap", marginBottom: -1,
          }}>
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span style={{ marginLeft: 6, background: tab === t.id ? "rgba(249,115,22,0.18)" : "var(--border-subtle)", color: tab === t.id ? "var(--accent)" : "var(--text-tertiary)", borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 600 }}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && <OverviewTab project={project} />}
      {tab === "estimate" && <EstimateTab project={project} />}
      {tab === "ks2" && <KS2Tab project={project} />}
      {tab === "supply" && <SupplyTab project={project} />}
      {tab === "equipment" && <EquipmentTab project={project} />}
      {tab === "reports" && <ReportsTab project={project} />}
      {tab === "incidents" && <IncidentsTab project={project} />}
      {tab === "documents" && <ProjectDocuments project={project.name} />}
    </div>
  );
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

function OverviewTab({ project }: { project: ProjectDetail }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
      {/* Сведения */}
      <div style={panelStyle}>
        <h3 style={panelHead}>Сведения о проекте</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px" }}>
          <InfoRow label="Заказчик" value={project.customer} />
          <InfoRow label="Прораб" value={project.foreman || "—"} />
          <InfoRow label="Тип работ" value={project.work_type || "—"} />
          <InfoRow label="Объект" value={project.location || "—"} />
          <InfoRow label="№ договора" value={project.contract_number || "—"} />
          <InfoRow label="Сумма" value={fmtM(project.contract_amount)} />
          <InfoRow label="Начало" value={fmtDate(project.start_date)} />
          <InfoRow label="Сдача план" value={fmtDate(project.planned_end_date)} />
          {project.actual_end_date && <InfoRow label="Сдача факт" value={fmtDate(project.actual_end_date)} />}
        </div>
        {project.description && (
          <>
            <p style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 16, marginBottom: 6 }}>Описание</p>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", whiteSpace: "pre-wrap", margin: 0 }}>{project.description}</p>
          </>
        )}
      </div>

      {/* План/факт */}
      <div style={panelStyle}>
        <h3 style={panelHead}>План / Факт</h3>
        <PlanFactRow label="Выручка" plan={project.margin.plan_revenue} fact={project.margin.fact_revenue} />
        <PlanFactRow label="Себестоимость" plan={project.margin.plan_cost} fact={project.margin.fact_cost} inverse />
        <PlanFactRow label="Маржа ₽" plan={project.margin.plan_margin} fact={project.margin.fact_margin} bold />
        <PlanFactRow label="Маржа %" plan={project.margin.plan_margin_pct} fact={project.margin.fact_margin_pct} suffix="%" bold />
        {project.margin.ks2_debt > 0 && (
          <div style={{ marginTop: 14, padding: 10, background: "rgba(251,191,36,0.08)", borderRadius: 8, border: "1px solid rgba(251,191,36,0.25)" }}>
            <p style={{ fontSize: 11, color: "var(--warning)", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>Дебиторка</p>
            <p style={{ fontSize: 17, fontWeight: 700, color: "var(--warning)", margin: "4px 0 0", fontFamily: "monospace" }}>{fmtM(project.margin.ks2_debt)}</p>
          </div>
        )}
      </div>

      {/* EVM Forecast */}
      <div style={{ gridColumn: "1 / -1" }}>
        <EVMBlock projectName={project.name} />
      </div>

      {/* График работ */}
      <div style={{ ...panelStyle, gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ ...panelHead, marginBottom: 4 }}>График работ</h3>
          <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: 0 }}>
            Gantt-диаграмма проекта · разделы, задачи, критический путь
          </p>
        </div>
        <Link href={`/schedule/${encodeURIComponent(project.name)}`} style={{ ...btnPrimary, textDecoration: "none", display: "inline-block" }}>
          Открыть график →
        </Link>
      </div>

      {/* Реестр рисков */}
      <div style={{ ...panelStyle, gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ ...panelHead, marginBottom: 4 }}>Реестр рисков</h3>
          <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: 0 }}>
            Идентифицированные риски проекта с матрицей P×I и расчётом контингенции
          </p>
        </div>
        <Link href={`/risks?project=${encodeURIComponent(project.name)}`} style={{ ...btnPrimary, textDecoration: "none", display: "inline-block" }}>
          Открыть риски →
        </Link>
      </div>

      {/* Тендер */}
      {project.tender && (
        <div style={{ ...panelStyle, gridColumn: "1 / -1" }}>
          <h3 style={panelHead}>Тендер</h3>
          <Link href={`/tenders`} style={{ textDecoration: "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", cursor: "pointer" }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{project.tender.title}</p>
                <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>{project.tender.name} · {project.tender.status}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0, fontFamily: "monospace" }}>{fmtM(project.tender.our_price)}</p>
                <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>наша цена</p>
              </div>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}

function EstimateTab({ project }: { project: ProjectDetail }) {
  if (!project.estimate) {
    return (
      <div style={{ ...panelStyle, textAlign: "center", padding: 48 }}>
        <p style={{ color: "var(--text-tertiary)", marginBottom: 12 }}>Смета не привязана к проекту</p>
        <Link href="/estimates" style={{ ...btnPrimary, textDecoration: "none", display: "inline-block" }}>Открыть сметы</Link>
      </div>
    );
  }
  return (
    <div style={panelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <h3 style={panelHead}>{project.estimate.title}</h3>
        <Link href={`/estimates`} style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none" }}>Открыть →</Link>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <MetricMini label="Себестоимость" value={fmtM(project.estimate.total_cost)} />
        <MetricMini label="Цена" value={fmtM(project.estimate.total_price)} />
        <MetricMini label="Маржа" value={`${project.estimate.margin_pct.toFixed(1)}%`} color="var(--success)" />
      </div>
    </div>
  );
}

function KS2Tab({ project }: { project: ProjectDetail }) {
  if (project.ks2_acts.length === 0) return <EmptyState text="Актов КС-2 ещё нет" />;
  return (
    <div style={panelStyle}>
      {project.ks2_acts.map(a => {
        const debt = a.amount - (a.payment_received || 0);
        return (
          <Link key={a.name} href={`/ks2?name=${encodeURIComponent(a.name)}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
            <div style={{ padding: "12px 0", borderBottom: "1px solid var(--border-subtle)", cursor: "pointer", transition: "padding-left 0.12s" }}
              onMouseEnter={e => (e.currentTarget.style.paddingLeft = "4px")}
              onMouseLeave={e => (e.currentTarget.style.paddingLeft = "0px")}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>{a.title || a.name}</p>
                <p style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace", margin: 0 }}>{fmtM(a.amount)}</p>
              </div>
              <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--text-tertiary)" }}>
                <span>{a.name}</span>
                {a.act_date && <span>· {fmtDate(a.act_date)}</span>}
                <span style={{ color: a.status === "Подписан" ? "var(--success)" : "var(--text-tertiary)" }}>· {a.status}</span>
                <span style={{ color: a.payment_status === "Оплачено" ? "var(--success)" : "var(--warning)" }}>· {a.payment_status}</span>
                {debt > 0 && <span style={{ color: "var(--warning)", marginLeft: "auto" }}>долг {fmtM(debt)}</span>}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function SupplyTab({ project }: { project: ProjectDetail }) {
  if (project.supply.length === 0) return <EmptyState text="Заявок на снабжение ещё нет" />;
  return (
    <div style={panelStyle}>
      {project.supply.map(s => (
        <div key={s.name} style={{ padding: "12px 0", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>{s.title}</p>
            {s.total_estimated && <p style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace", margin: 0 }}>{fmtM(s.total_estimated)}</p>}
          </div>
          <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--text-tertiary)" }}>
            <span>{s.name}</span>
            <span>· {s.status}</span>
            {s.needed_by_date && <span>· нужно к {fmtDate(s.needed_by_date)}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function EquipmentTab({ project }: { project: ProjectDetail }) {
  if (project.equipment.length === 0) return <EmptyState text="Техника на объекте не закреплена" />;
  return (
    <div style={panelStyle}>
      {project.equipment.map(e => (
        <div key={e.name} style={{ padding: "12px 0", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>{e.equipment_name}</p>
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: e.status === "На объекте" ? "rgba(52,211,153,0.12)" : "var(--border-subtle)", color: e.status === "На объекте" ? "var(--success)" : "var(--text-secondary)" }}>{e.status}</span>
          </div>
          <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--text-tertiary)" }}>
            <span>{e.name}</span>
            <span>· {e.category}</span>
            {e.next_maintenance_date && <span>· ТО до {fmtDate(e.next_maintenance_date)}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function ReportsTab({ project }: { project: ProjectDetail }) {
  if (project.reports.length === 0) return <EmptyState text="Отчётов прорабов нет" />;
  return (
    <div style={panelStyle}>
      {project.reports.map(r => (
        <div key={r.name} style={{ padding: "12px 0", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>{r.title || `Отчёт ${fmtDate(r.report_date)}`}</p>
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: "monospace", margin: 0 }}>{r.workers_count} раб.</p>
          </div>
          <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--text-tertiary)" }}>
            <span>{r.name}</span>
            <span>· {fmtDate(r.report_date)}</span>
            <span>· {r.status}</span>
            {r.has_safety_incident ? <span style={{ color: "var(--warning)" }}>⚠ инцидент</span> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function IncidentsTab({ project }: { project: ProjectDetail }) {
  if (project.incidents.length === 0) return <EmptyState text="Инцидентов нет — хорошо" />;
  return (
    <div style={panelStyle}>
      {project.incidents.map(i => {
        const isCrit = ["Тяжёлый", "Критический"].includes(i.severity);
        return (
          <div key={i.name} style={{ padding: "12px 0", borderBottom: "1px solid var(--border-subtle)", borderLeft: `3px solid ${isCrit ? "var(--danger)" : "var(--warning)"}`, paddingLeft: 14, marginLeft: -4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>{i.title}</p>
              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, color: isCrit ? "var(--danger)" : "var(--warning)", border: `1px solid ${isCrit ? "var(--danger)" : "var(--warning)"}` }}>{i.severity}</span>
            </div>
            <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--text-tertiary)" }}>
              <span>{i.name}</span>
              <span>· {fmtDate(i.incident_date)}</span>
              <span>· {i.status}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>{label}</p>
      <p style={{ fontSize: 13, color: "var(--text-primary)", margin: "3px 0 0" }}>{value}</p>
    </div>
  );
}

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "14px 18px" }}>
      <p style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>{label}</p>
      <p style={{ fontSize: 20, fontWeight: 700, color: color ?? "var(--text-primary)", margin: "4px 0 2px", fontFamily: "monospace", letterSpacing: "-0.02em" }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: 0 }}>{sub}</p>}
    </div>
  );
}

function MetricMini({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>{label}</p>
      <p style={{ fontSize: 16, fontWeight: 700, color: color ?? "var(--text-primary)", margin: "3px 0 0", fontFamily: "monospace" }}>{value}</p>
    </div>
  );
}

function PlanFactRow({ label, plan, fact, suffix = "", bold = false, inverse = false }: { label: string; plan: number; fact: number; suffix?: string; bold?: boolean; inverse?: boolean }) {
  const better = inverse ? fact <= plan : fact >= plan;
  const factColor = fact === 0 ? "var(--text-tertiary)" : better ? "var(--success)" : "var(--warning)";
  const fmt = suffix === "%" ? (v: number) => `${v.toFixed(1)}%` : (v: number) => fmtM(v);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 12, padding: "8px 0", borderBottom: "1px dashed var(--border-subtle)" }}>
      <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: 0 }}>{label}</p>
      <p style={{ fontSize: bold ? 14 : 12, fontWeight: bold ? 700 : 400, color: "var(--text-secondary)", margin: 0, fontFamily: "monospace" }}>{fmt(plan)}</p>
      <p style={{ fontSize: bold ? 14 : 12, fontWeight: bold ? 700 : 400, color: factColor, margin: 0, fontFamily: "monospace", minWidth: 80, textAlign: "right" }}>{fmt(fact)}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ ...panelStyle, textAlign: "center", padding: 48 }}>
      <p style={{ color: "var(--text-tertiary)", margin: 0, fontSize: 13 }}>{text}</p>
    </div>
  );
}

// ── EVM Forecast block ───────────────────────────────────────────────────────

interface EVMData {
  bac: number; ac: number; ev: number; pv: number;
  co_approved: number;
  contract_amount: number; completion_pct: number;
  cpi: number; spi: number; eac: number; etc: number; vac: number; tcpi: number;
  health: { level: string; label: string; color: string };
  warnings: string[];
  as_of: string;
}

function EVMBlock({ projectName }: { projectName: string }) {
  const [data, setData] = useState<EVMData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/evm?project=${encodeURIComponent(projectName)}`)
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false));
  }, [projectName]);

  if (loading) return <div style={panelStyle}><p style={{ color: "var(--text-tertiary)", margin: 0 }}>Загрузка EVM…</p></div>;
  if (!data) return null;

  const cpiColor = data.cpi >= 1 ? "var(--success)" : data.cpi >= 0.9 ? "var(--warning)" : "var(--danger)";
  const spiColor = data.spi >= 1 ? "var(--success)" : data.spi >= 0.9 ? "var(--warning)" : "var(--danger)";
  const vacColor = data.vac >= 0 ? "var(--success)" : "var(--danger)";

  return (
    <div style={{ ...panelStyle, padding: "18px 22px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <h3 style={{ ...panelHead, margin: 0, fontSize: 11 }}>EVM-прогноз — куда придём по этим темпам</h3>
          <p style={{ fontSize: 10.5, color: "var(--text-tertiary)", margin: "2px 0 0", fontFamily: "monospace" }}>
            на {data.as_of} · выполнено {data.completion_pct.toFixed(1)}%
          </p>
        </div>
        <span style={{
          padding: "5px 14px", borderRadius: 10,
          background: `${data.health.color}20`, color: data.health.color,
          fontSize: 12, fontWeight: 600,
        }}>
          {data.health.label}
        </span>
      </div>

      {/* 4 KPI: BAC, AC, EAC, VAC */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
        <EvmMetric label="Бюджет (BAC)" value={data.bac} hint="планировали потратить" />
        <EvmMetric label="Потрачено (AC)" value={data.ac} hint="фактический расход" />
        <EvmMetric label="Прогноз (EAC)" value={data.eac} hint="итоговая стоимость" accent={data.eac > data.bac ? "var(--danger)" : "var(--text-primary)"} />
        <EvmMetric label="Отклонение (VAC)" value={data.vac} hint={data.vac >= 0 ? "экономия от плана" : "перерасход"} accent={vacColor} sign />
      </div>

      {/* CPI / SPI / TCPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 14 }}>
        <IndexBar label="CPI · стоимость" value={data.cpi} color={cpiColor}
          hint={data.cpi >= 1 ? "укладываемся в бюджет" : "тратим быстрее плана"} />
        <IndexBar label="SPI · сроки" value={data.spi} color={spiColor}
          hint={data.spi >= 1 ? "идём по графику" : "отстаём от графика"} />
        <IndexBar label="TCPI · нужный темп" value={data.tcpi}
          color={data.tcpi <= 1.05 ? "var(--success)" : data.tcpi <= 1.15 ? "var(--warning)" : "var(--danger)"}
          hint={data.tcpi <= 1.05 ? "темп достижим" : `+${((data.tcpi - 1) * 100).toFixed(0)}% к производительности`} />
      </div>

      {/* Warnings */}
      {data.warnings && data.warnings.length > 0 && (
        <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(251,191,36,0.08)", borderRadius: 8, border: "1px solid rgba(251,191,36,0.25)" }}>
          {data.warnings.map((w, i) => (
            <p key={i} style={{ fontSize: 12, color: "var(--warning)", margin: i === 0 ? "0" : "6px 0 0", lineHeight: 1.5 }}>⚠ {w}</p>
          ))}
        </div>
      )}

      <p style={{ marginTop: 14, fontSize: 10.5, color: "var(--text-tertiary)", margin: "14px 0 0" }}>
        EV = {fmtM(data.ev)} (выполнено по плановой стоимости) · PV = {fmtM(data.pv)} (должно было быть к этой дате)
        {data.co_approved > 0 && ` · CO одобрено: ${fmtM(data.co_approved)}`}
      </p>

      {/* S-curve тренд CPI/SPI за 90 дней */}
      <EVMTrendChart projectName={projectName} />
    </div>
  );
}

interface EVMTrendPoint {
  date: string;
  bac: number; ac: number; ev: number; pv: number; eac: number;
  cpi: number; spi: number; tcpi: number;
  completion_pct: number;
  health_level: string;
}

function EVMTrendChart({ projectName }: { projectName: string }) {
  const [series, setSeries] = useState<EVMTrendPoint[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`/api/evm/trend?project=${encodeURIComponent(projectName)}&days=90`)
      .then(r => r.json())
      .then(d => setSeries(Array.isArray(d.series) ? d.series : []))
      .finally(() => setLoaded(true));
  }, [projectName]);

  if (!loaded) return null;
  if (series.length < 2) {
    return (
      <p style={{ marginTop: 12, fontSize: 10.5, color: "var(--text-tertiary)", fontStyle: "italic" }}>
        Тренд CPI/SPI: накапливаем историю — будет виден через несколько дней.
      </p>
    );
  }

  const W = 600, H = 90, P = 6;
  const n = series.length;
  const xs = (i: number) => P + (i / (n - 1 || 1)) * (W - 2 * P);
  // y=H для значения 0.7, y=0 для значения 1.3 — 1.0 в центре
  const y = (v: number) => {
    const clamped = Math.max(0.7, Math.min(1.3, v || 1));
    return (1.3 - clamped) / 0.6 * (H - 2 * P) + P;
  };
  const cpiPath = series.map((p, i) => `${i === 0 ? "M" : "L"}${xs(i).toFixed(1)} ${y(p.cpi).toFixed(1)}`).join(" ");
  const spiPath = series.map((p, i) => `${i === 0 ? "M" : "L"}${xs(i).toFixed(1)} ${y(p.spi).toFixed(1)}`).join(" ");
  const last = series[series.length - 1]!;
  const first = series[0]!;
  const cpiDelta = (last.cpi - first.cpi).toFixed(3);
  const spiDelta = (last.spi - first.spi).toFixed(3);

  return (
    <div style={{ marginTop: 14, padding: "12px 14px", background: "var(--bg-base)", border: "1px solid var(--border-subtle)", borderRadius: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace" }}>
          Тренд CPI / SPI за {n} {n === 1 ? "день" : n < 5 ? "дня" : "дней"}
        </span>
        <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "monospace" }}>
          ΔCPI {Number(cpiDelta) >= 0 ? "+" : ""}{cpiDelta} · ΔSPI {Number(spiDelta) >= 0 ? "+" : ""}{spiDelta}
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
        {/* Линия "1.0" (норма) */}
        <line x1={P} x2={W - P} y1={y(1.0)} y2={y(1.0)} stroke="var(--border-subtle)" strokeWidth="1" strokeDasharray="3,3" />
        <text x={W - P - 2} y={y(1.0) - 2} fontSize="8" fill="var(--text-tertiary)" textAnchor="end" fontFamily="monospace">1.0</text>
        {/* CPI */}
        <path d={cpiPath} fill="none" stroke="#3b82f6" strokeWidth="1.6" />
        {/* SPI */}
        <path d={spiPath} fill="none" stroke="#a855f7" strokeWidth="1.6" />
        {/* Точки на конце */}
        <circle cx={xs(n - 1)} cy={y(last.cpi)} r="2.5" fill="#3b82f6" />
        <circle cx={xs(n - 1)} cy={y(last.spi)} r="2.5" fill="#a855f7" />
      </svg>
      <div style={{ display: "flex", gap: 14, marginTop: 4 }}>
        <span style={{ fontSize: 10, fontFamily: "monospace", color: "#3b82f6" }}>— CPI {last.cpi.toFixed(2)}</span>
        <span style={{ fontSize: 10, fontFamily: "monospace", color: "#a855f7" }}>— SPI {last.spi.toFixed(2)}</span>
        <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "monospace", marginLeft: "auto" }}>
          {first.date} → {last.date}
        </span>
      </div>
    </div>
  );
}

function EvmMetric({ label, value, hint, accent, sign }: { label: string; value: number; hint?: string; accent?: string; sign?: boolean }) {
  const display = sign && value !== 0
    ? `${value > 0 ? "+" : ""}${value.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽`
    : value === 0 ? "—" : `${value.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽`;
  return (
    <div style={{ background: "var(--bg-base)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "10px 14px" }}>
      <p style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0, fontFamily: "monospace" }}>{label}</p>
      <p style={{ fontSize: 16, fontWeight: 600, color: accent ?? "var(--text-primary)", margin: "4px 0 0", fontFamily: "monospace" }}>{display}</p>
      {hint && <p style={{ fontSize: 10, color: "var(--text-tertiary)", margin: "1px 0 0" }}>{hint}</p>}
    </div>
  );
}

function IndexBar({ label, value, color, hint }: { label: string; value: number; color: string; hint?: string }) {
  const pct = Math.min(100, Math.max(0, (value || 0) * 50));  // 1.0 = 50% (центр)
  return (
    <div style={{ background: "var(--bg-base)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "10px 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace" }}>{label}</span>
        <span style={{ fontSize: 17, fontWeight: 700, color, fontFamily: "monospace" }}>{value ? value.toFixed(2) : "—"}</span>
      </div>
      <div style={{ marginTop: 6, height: 4, background: "var(--border-subtle)", borderRadius: 2, position: "relative" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`, background: color, borderRadius: 2 }} />
        <div style={{ position: "absolute", left: "50%", top: -2, bottom: -2, width: 1, background: "var(--text-tertiary)" }} />
      </div>
      {hint && <p style={{ fontSize: 10, color: "var(--text-tertiary)", margin: "4px 0 0" }}>{hint}</p>}
    </div>
  );
}

const panelStyle: React.CSSProperties = { background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: "16px 20px" };
const panelHead: React.CSSProperties = { fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 14px", fontWeight: 500 };
const btnPrimary: React.CSSProperties = { padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" };
