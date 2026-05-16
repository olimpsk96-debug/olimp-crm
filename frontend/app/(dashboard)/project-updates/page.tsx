"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/Toast";

interface ProjectHealth {
  project: string;
  project_title: string;
  status: string;
  latest_health: string | null;
  latest_week: string | null;
  latest_summary: string;
  updates_count: number;
  history: { week: string; health: string }[];
  is_stale: boolean;
}

interface PortfolioResp {
  projects: ProjectHealth[];
  summary: { total: number; red: number; yellow: number; green: number; no_update: number; stale: number };
  current_week: string;
}

interface UpdateRow {
  name: string;
  project: string;
  project_title: string;
  week_start: string;
  health: string;
  author: string;
  summary: string;
  blockers: string;
  next_week_plan: string;
  cpi_snapshot: number;
  spi_snapshot: number;
  ai_drafted: number;
  modified: string;
  owner: string;
}

interface Draft {
  week_start: string;
  week_end: string;
  project: string;
  suggested_health: string;
  summary_draft: string;
  blockers_draft: string;
  cpi: number | null;
  spi: number | null;
  facts_count: number;
}

const HEALTH = ["🟢 Зелёный", "🟡 Жёлтый", "🔴 Красный"];

function healthColor(h: string | null): string {
  if (!h) return "var(--text-tertiary)";
  if (h.includes("🔴")) return "var(--danger)";
  if (h.includes("🟡")) return "#eab308";
  return "var(--success)";
}

function healthBg(h: string | null): string {
  if (!h) return "var(--bg-elevated)";
  if (h.includes("🔴")) return "rgba(248,113,113,0.12)";
  if (h.includes("🟡")) return "rgba(234,179,8,0.12)";
  return "rgba(74,222,128,0.10)";
}

function fmtWeek(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  const e = new Date(d.getTime() + 6 * 86400_000);
  return `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")} – ${e.getDate().toString().padStart(2, "0")}.${(e.getMonth() + 1).toString().padStart(2, "0")}`;
}

export default function ProjectUpdatesPage() {
  const [portfolio, setPortfolio] = useState<PortfolioResp | null>(null);
  const [feed, setFeed] = useState<UpdateRow[]>([]);
  const [tab, setTab] = useState<"portfolio" | "feed">("portfolio");
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<{ project: string; existing?: UpdateRow; draft?: Draft } | null>(null);
  const toast = useToast();

  function reload() {
    setLoading(true);
    Promise.all([
      fetch("/api/project-updates?mode=portfolio&weeks=8").then((r) => r.json()),
      fetch("/api/project-updates?weeks=8").then((r) => r.json()),
    ])
      .then(([p, f]) => {
        setPortfolio(p && !p.error ? p : null);
        setFeed(Array.isArray(f) ? f : []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { reload(); }, []);

  async function openEditor(project: string, existing?: UpdateRow) {
    const r = await fetch(`/api/project-updates?mode=draft&project=${encodeURIComponent(project)}`);
    const d: Draft = await r.json();
    setEditor({ project, existing, draft: d });
  }

  async function deleteUpdate(name: string) {
    if (!confirm("Удалить апдейт?")) return;
    const r = await fetch(`/api/project-updates?name=${encodeURIComponent(name)}`, { method: "DELETE" });
    const d = await r.json();
    if (d.error) toast.error(d.error);
    else { toast.success("Удалён"); reload(); }
  }

  return (
    <div style={{ padding: "24px 32px", minHeight: "100vh", background: "var(--bg-base)" }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>Здоровье проектов</h1>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4, fontFamily: "monospace" }}>
          Еженедельные апдейты со светофором (Linear-style){portfolio && ` · Текущая неделя ${fmtWeek(portfolio.current_week)}`}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 14, borderBottom: "1px solid var(--border-subtle)" }}>
        {(["portfolio", "feed"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
                  style={{
                    padding: "9px 14px", fontSize: 13, fontWeight: 500,
                    background: "transparent",
                    color: tab === t ? "var(--text-primary)" : "var(--text-tertiary)",
                    border: "none", borderBottom: `2px solid ${tab === t ? "var(--accent)" : "transparent"}`,
                    cursor: "pointer",
                  }}>
            {t === "portfolio" ? "Портфель" : "Лента апдейтов"}
          </button>
        ))}
      </div>

      {/* Summary KPIs */}
      {portfolio && tab === "portfolio" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 18 }}>
          {[
            { label: "Всего проектов", value: portfolio.summary.total, color: "var(--text-primary)" },
            { label: "🔴 Красные", value: portfolio.summary.red, color: "var(--danger)" },
            { label: "🟡 Жёлтые", value: portfolio.summary.yellow, color: "#eab308" },
            { label: "🟢 Зелёные", value: portfolio.summary.green, color: "var(--success)" },
            { label: "⌛ Без апдейта", value: portfolio.summary.stale + portfolio.summary.no_update, color: "var(--text-tertiary)" },
          ].map((k) => (
            <div key={k.label} style={{
              padding: 14, borderRadius: 10,
              background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
            }}>
              <div style={{ fontSize: 22, fontWeight: 600, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", marginTop: 2, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {k.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {loading && <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Загрузка...</div>}

      {/* Portfolio: проектная сетка */}
      {!loading && tab === "portfolio" && portfolio && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {portfolio.projects.length === 0 && (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)", border: "1px dashed var(--border-subtle)", borderRadius: 10 }}>
              Активных проектов нет
            </div>
          )}
          {portfolio.projects.map((p) => (
            <div key={p.project} style={{
              padding: "14px 16px", borderRadius: 10,
              background: healthBg(p.latest_health),
              border: `1px solid ${p.latest_health ? healthColor(p.latest_health) : "var(--border-subtle)"}`,
              display: "flex", gap: 14, alignItems: "center",
            }}>
              <div style={{ flexShrink: 0, fontSize: 22, width: 30, textAlign: "center" }}>
                {p.latest_health?.split(" ")[0] || "⚪"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", marginBottom: 2 }}>
                  {p.project_title}
                  {p.is_stale && (
                    <span style={{ marginLeft: 8, padding: "1px 6px", borderRadius: 4, background: "rgba(234,179,8,0.18)", color: "#a16207", fontSize: 10, fontWeight: 600 }}>
                      Просрочен апдейт
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "monospace" }}>
                  {p.project} · {p.latest_week ? `последний ${fmtWeek(p.latest_week)}` : "нет апдейтов"} · апдейтов за 8 нед.: {p.updates_count}
                </div>
                {p.latest_summary && (
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                    {p.latest_summary}
                  </div>
                )}
              </div>
              {/* История 8 нед — точки */}
              <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                {Array.from({ length: 8 }).map((_, i) => {
                  const h = p.history[p.history.length - 8 + i];
                  return (
                    <div key={i} title={h ? `${h.week} ${h.health}` : "—"}
                         style={{
                           width: 10, height: 16, borderRadius: 2,
                           background: h ? healthColor(h.health) : "var(--bg-elevated)",
                           border: "1px solid var(--border-subtle)",
                           opacity: h ? 1 : 0.4,
                         }} />
                  );
                })}
              </div>
              <button onClick={() => openEditor(p.project)} style={{
                padding: "7px 14px", fontSize: 12, fontWeight: 500,
                background: "var(--accent)", color: "white",
                border: "none", borderRadius: 7, cursor: "pointer",
                flexShrink: 0,
              }}>
                Добавить
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Feed: лента всех апдейтов */}
      {!loading && tab === "feed" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {feed.length === 0 && (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)", border: "1px dashed var(--border-subtle)", borderRadius: 10 }}>
              Апдейтов нет. Создайте первый из вкладки «Портфель».
            </div>
          )}
          {feed.map((u) => (
            <div key={u.name} style={{
              padding: 14, borderRadius: 10,
              background: "var(--bg-elevated)",
              borderLeft: `3px solid ${healthColor(u.health)}`,
              border: "1px solid var(--border-subtle)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{u.health}</span>
                  <span style={{ marginLeft: 10, fontSize: 12, color: "var(--text-secondary)" }}>
                    {u.project_title}
                  </span>
                  <span style={{ marginLeft: 8, fontSize: 11, color: "var(--text-tertiary)", fontFamily: "monospace" }}>
                    {fmtWeek(u.week_start)} · {u.author || u.owner}
                  </span>
                  {u.ai_drafted ? <span style={{ marginLeft: 8, padding: "1px 6px", borderRadius: 4, background: "rgba(96,165,250,0.18)", color: "#3b82f6", fontSize: 9.5, fontWeight: 600 }}>🤖 AI</span> : null}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => openEditor(u.project, u)} style={{
                    padding: "4px 10px", fontSize: 11,
                    background: "transparent", color: "var(--text-tertiary)",
                    border: "1px solid var(--border-subtle)", borderRadius: 5, cursor: "pointer",
                  }}>
                    ✎
                  </button>
                  <button onClick={() => deleteUpdate(u.name)} style={{
                    padding: "4px 10px", fontSize: 11,
                    background: "transparent", color: "var(--danger)",
                    border: "1px solid var(--border-subtle)", borderRadius: 5, cursor: "pointer",
                  }}>
                    ×
                  </button>
                </div>
              </div>
              <div style={{ fontSize: 13, color: "var(--text-primary)", marginTop: 8, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                {u.summary}
              </div>
              {u.blockers && (
                <div style={{ marginTop: 8, padding: 8, background: "rgba(248,113,113,0.06)", borderRadius: 6, fontSize: 12, color: "var(--text-secondary)" }}>
                  <span style={{ color: "var(--danger)", fontWeight: 600 }}>Блокеры: </span>
                  <span style={{ whiteSpace: "pre-wrap" }}>{u.blockers}</span>
                </div>
              )}
              {u.next_week_plan && (
                <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-tertiary)" }}>
                  <b>След. неделя: </b><span style={{ whiteSpace: "pre-wrap" }}>{u.next_week_plan}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editor && (
        <UpdateEditor
          project={editor.project}
          existing={editor.existing}
          draft={editor.draft}
          onClose={() => setEditor(null)}
          onSaved={() => { setEditor(null); reload(); }}
        />
      )}
    </div>
  );
}

function UpdateEditor({ project, existing, draft, onClose, onSaved }: {
  project: string;
  existing?: UpdateRow;
  draft?: Draft;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [health, setHealth] = useState(existing?.health || draft?.suggested_health || "🟢 Зелёный");
  const [summary, setSummary] = useState(existing?.summary || draft?.summary_draft || "");
  const [blockers, setBlockers] = useState(existing?.blockers || draft?.blockers_draft || "");
  const [nextPlan, setNextPlan] = useState(existing?.next_week_plan || "");
  const [saving, setSaving] = useState(false);
  const aiDrafted = !existing && !!draft && (summary === draft.summary_draft);

  async function save() {
    if (!summary.trim()) { toast.warn("Опишите, что сделано за неделю"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/project-updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: existing?.name,
          project,
          week_start: draft?.week_start || existing?.week_start,
          health, summary, blockers, next_week_plan: nextPlan,
          ai_drafted: aiDrafted ? 1 : 0,
        }),
      });
      const d = await r.json();
      if (d.error) { toast.error(d.error); return; }
      toast.success(d.action === "created" ? "Создан апдейт" : "Обновлён");
      onSaved();
    } finally { setSaving(false); }
  }

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 100,
      padding: "60px 20px",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 640, maxHeight: "85vh", overflowY: "auto",
        background: "var(--bg-base)", borderRadius: 12,
        border: "1px solid var(--border-subtle)", padding: 24,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 500, margin: 0 }}>
              {existing ? "Редактирование апдейта" : "Новый апдейт"}
            </h2>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4, fontFamily: "monospace" }}>
              {project} · неделя {fmtWeek(draft?.week_start || existing?.week_start || null)}
              {draft && draft.cpi !== null && ` · CPI ${draft.cpi.toFixed(2)} / SPI ${(draft.spi || 0).toFixed(2)}`}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-tertiary)", fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        {/* Health */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 10.5, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace", marginBottom: 6 }}>
            Светофор здоровья
          </label>
          <div style={{ display: "flex", gap: 6 }}>
            {HEALTH.map((h) => (
              <button key={h} onClick={() => setHealth(h)}
                      style={{
                        flex: 1, padding: "10px 12px", fontSize: 13, fontWeight: 500,
                        background: health === h ? healthBg(h) : "transparent",
                        color: health === h ? healthColor(h) : "var(--text-secondary)",
                        border: `1px solid ${health === h ? healthColor(h) : "var(--border-subtle)"}`,
                        borderRadius: 8, cursor: "pointer",
                      }}>
                {h}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 10.5, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace", marginBottom: 4 }}>
            Что сделано за неделю
            {draft && summary === draft.summary_draft && draft.facts_count > 0 && (
              <span style={{ marginLeft: 8, color: "#3b82f6" }}>🤖 черновик из активности</span>
            )}
          </label>
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)}
                    placeholder="Подписаны КС-2, завершены работы, ключевые встречи..."
                    style={textareaStyle(120)} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 10.5, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace", marginBottom: 4 }}>
            Блокеры / риски
          </label>
          <textarea value={blockers} onChange={(e) => setBlockers(e.target.value)}
                    placeholder="Что мешает идти по плану..."
                    style={textareaStyle(70)} />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: "block", fontSize: 10.5, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace", marginBottom: 4 }}>
            План на следующую неделю
          </label>
          <textarea value={nextPlan} onChange={(e) => setNextPlan(e.target.value)}
                    placeholder="Какие задачи в фокусе на следующую неделю..."
                    style={textareaStyle(70)} />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onClose} style={{
            padding: "10px 18px", fontSize: 13,
            background: "transparent", color: "var(--text-secondary)",
            border: "1px solid var(--border-subtle)", borderRadius: 8, cursor: "pointer",
          }}>
            Отмена
          </button>
          <button onClick={save} disabled={saving} style={{
            padding: "10px 22px", fontSize: 13, fontWeight: 500,
            background: "var(--accent)", color: "white",
            border: "none", borderRadius: 8, cursor: "pointer",
            opacity: saving ? 0.6 : 1,
          }}>
            {saving ? "Сохраняем..." : existing ? "Сохранить" : "Создать апдейт"}
          </button>
        </div>
      </div>
    </div>
  );
}

function textareaStyle(minHeight: number): React.CSSProperties {
  return {
    width: "100%", padding: "10px 12px", fontSize: 13,
    background: "var(--bg-elevated)", color: "var(--text-primary)",
    border: "1px solid var(--border-subtle)", borderRadius: 8,
    outline: "none", minHeight, fontFamily: "inherit", lineHeight: 1.5, resize: "vertical",
  };
}
