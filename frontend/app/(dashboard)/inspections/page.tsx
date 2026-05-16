"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";

interface Template {
  name: string;
  template_id: string;
  title: string;
  category: string;
  is_active: number;
  usage_count: number;
  description: string;
  question_count: number;
}

interface Run {
  name: string;
  title: string;
  template: string;
  project: string | null;
  inspector_name: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  score_pct: number;
  critical_fails: number;
}

const CATEGORIES = [
  "", "Входной контроль", "Приёмка работ", "ОТ/ТБ обход",
  "Контроль оборудования", "Приёмка скрытых работ",
  "Ежедневный осмотр", "Прочее",
];

export default function InspectionsPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [category, setCategory] = useState("");
  const [tab, setTab] = useState<"templates" | "runs">("templates");
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();

  function reload() {
    setLoading(true);
    const p = new URLSearchParams();
    if (category) p.set("category", category);

    Promise.all([
      fetch(`/api/inspections?${p}`).then((r) => r.json()),
      fetch("/api/inspections/runs?days=30").then((r) => r.json()),
    ])
      .then(([t, r]) => {
        setTemplates(Array.isArray(t) ? t : []);
        setRuns(Array.isArray(r) ? r : []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(reload, [category]);

  async function startInspection(template: Template) {
    setStarting(template.name);
    const inspector = typeof window !== "undefined" ? localStorage.getItem("olimp-foreman-name") : null;
    try {
      const r = await fetch("/api/inspections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template: template.name,
          inspector_name: inspector || "Прораб",
        }),
      });
      const d = await r.json();
      if (d.error) {
        toast.error(d.error);
        return;
      }
      toast.success(`Запущена проверка ${d.run_id}`);
      router.push(`/inspections/${encodeURIComponent(d.run_id)}`);
    } finally {
      setStarting(null);
    }
  }

  const activeRuns = runs.filter((r) => r.status === "В работе");
  const failsCount = runs.filter((r) => r.status === "Завершён (Fail)" || r.critical_fails > 0).length;
  const passCount = runs.filter((r) => r.status === "Завершён (Pass)").length;

  return (
    <div style={{ padding: "24px 32px", minHeight: "100vh", background: "var(--bg-base)" }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>
          ✅ Инспекции и чек-листы
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>
          Входной контроль · приёмка скрытых работ · ежедневный ОТ/ТБ обход — со score, критическими пунктами и фото.
        </p>
      </div>

      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 }}>
        <Kpi label="Шаблонов" value={templates.length} />
        <Kpi label="В работе" value={activeRuns.length} accent="var(--accent)" />
        <Kpi label="Pass (30д)" value={passCount} accent="var(--success)" />
        <Kpi label="Fail (30д)" value={failsCount} accent="var(--danger)" />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border-subtle)", marginBottom: 16 }}>
        <TabBtn active={tab === "templates"} onClick={() => setTab("templates")} label="Шаблоны" count={templates.length} />
        <TabBtn active={tab === "runs"} onClick={() => setTab("runs")} label="Проверки" count={runs.length} />
      </div>

      {tab === "templates" && (
        <>
          {/* Category filter */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setCategory(c)}
                      style={{
                        padding: "5px 12px", fontSize: 11.5, borderRadius: 7,
                        border: `1px solid ${category === c ? "var(--accent)" : "var(--border-subtle)"}`,
                        background: category === c ? "rgba(234,88,12,0.12)" : "transparent",
                        color: category === c ? "var(--accent)" : "var(--text-secondary)",
                        cursor: "pointer",
                      }}>
                {c || "Все"}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Загрузка...</div>
          ) : templates.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)", background: "var(--bg-elevated)", borderRadius: 12 }}>
              Шаблонов нет. Запусти seed:<br />
              <code style={{ background: "var(--bg-base)", padding: "2px 8px", borderRadius: 4, marginTop: 8, display: "inline-block" }}>
                POST /api/method/olimp_construction.api.inspections.seed_templates
              </code>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
              {templates.map((t) => (
                <div key={t.name} style={{
                  padding: 16, borderRadius: 12,
                  background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
                }}>
                  <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", fontFamily: "monospace", marginBottom: 4 }}>
                    {t.category}
                  </div>
                  <h3 style={{ fontSize: 14, margin: "0 0 6px", fontWeight: 500 }}>{t.title}</h3>
                  {t.description && (
                    <p style={{ fontSize: 11.5, color: "var(--text-tertiary)", margin: "0 0 10px", lineHeight: 1.4 }}>
                      {t.description}
                    </p>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                      {t.question_count} пунктов · {t.usage_count} раз
                    </div>
                    <button onClick={() => startInspection(t)} disabled={starting === t.name}
                            style={{
                              padding: "7px 14px", fontSize: 12.5, fontWeight: 500,
                              background: "var(--accent)", color: "white",
                              border: "none", borderRadius: 8, cursor: "pointer",
                              opacity: starting === t.name ? 0.6 : 1,
                            }}>
                      {starting === t.name ? "..." : "▶ Запустить"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "runs" && (
        <div>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Загрузка...</div>
          ) : runs.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)", background: "var(--bg-elevated)", borderRadius: 12 }}>
              Проверок за 30 дней нет. Запусти шаблон во вкладке «Шаблоны».
            </div>
          ) : (
            <div style={{ background: "var(--bg-elevated)", borderRadius: 12, border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
              {runs.map((r) => (
                <div key={r.name}
                     onClick={() => router.push(`/inspections/${encodeURIComponent(r.name)}`)}
                     style={{
                       padding: "12px 16px",
                       borderBottom: "1px solid rgba(255,255,255,0.04)",
                       cursor: "pointer",
                       display: "grid", gridTemplateColumns: "1fr 140px 130px 90px",
                       gap: 12, alignItems: "center",
                     }}>
                  <div>
                    <div style={{ fontSize: 13 }}>{r.title}</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                      {r.inspector_name} · {new Date(r.started_at).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{r.project || "—"}</div>
                  <div>
                    <span style={{
                      padding: "3px 8px", borderRadius: 4, fontSize: 10.5,
                      background: r.status === "Завершён (Pass)" ? "rgba(34,197,94,0.15)" :
                                  r.status === "Завершён (Fail)" ? "rgba(248,113,113,0.15)" :
                                  r.status === "В работе" ? "rgba(96,165,250,0.15)" : "rgba(168,168,168,0.15)",
                      color: r.status === "Завершён (Pass)" ? "var(--success)" :
                             r.status === "Завершён (Fail)" ? "var(--danger)" :
                             r.status === "В работе" ? "#60a5fa" : "var(--text-tertiary)",
                    }}>{r.status}</span>
                  </div>
                  <div style={{ textAlign: "right", fontFamily: "monospace", fontSize: 13,
                                color: r.score_pct >= 80 ? "var(--success)" : r.score_pct >= 50 ? "var(--warning)" : "var(--danger)" }}>
                    {r.score_pct ? `${r.score_pct.toFixed(0)}%` : "—"}
                    {r.critical_fails > 0 && (
                      <div style={{ fontSize: 10, color: "var(--danger)", marginTop: 2 }}>⚠ {r.critical_fails}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div style={{
      padding: "14px 16px", borderRadius: 10,
      background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
    }}>
      <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 600, fontFamily: "monospace", color: accent ?? "var(--text-primary)" }}>
        {value}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button onClick={onClick} style={{
      padding: "10px 16px", fontSize: 13, fontWeight: active ? 500 : 400,
      background: "none", border: "none", cursor: "pointer",
      color: active ? "var(--accent)" : "var(--text-secondary)",
      borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
      marginBottom: -1,
    }}>
      {label} <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text-tertiary)" }}>{count}</span>
    </button>
  );
}
