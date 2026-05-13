"use client";

import { useEffect, useState, useCallback } from "react";
import { KS3Act, KS3Stats, KS3Status, KS2ForKS3 } from "@/types/ks3";
import {
  inputStyle, btnPrimary, btnSecondary, labelStyle,
  backdropStyle, drawerStyle, drawerHeaderStyle, closeBtn,
  statCard, statLabel, statValue, statSub,
} from "@/lib/ui-styles";

const fmtM = (v?: number | null) => {
  if (!v && v !== 0) return "—";
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)} млн ₽`;
  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)} тыс. ₽`;
  return `${v.toFixed(0)} ₽`;
};

const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" });
};

const STATUS_COLORS: Record<KS3Status, { color: string; bg: string }> = {
  "Черновик":      { color: "var(--text-tertiary)", bg: "rgba(156,163,175,0.1)" },
  "На подписании": { color: "var(--warning)",        bg: "rgba(251,191,36,0.1)" },
  "Подписан":      { color: "var(--success)",        bg: "rgba(52,211,153,0.1)" },
  "Отклонён":      { color: "var(--danger)",         bg: "rgba(248,113,113,0.1)" },
};

const ALL_STATUSES: KS3Status[] = ["Черновик", "На подписании", "Подписан", "Отклонён"];

// ── Create Drawer ────────────────────────────────────────────────────────────

function KS3CreateDrawer({ onClose, onSaved }: { onClose: () => void; onSaved: (name: string) => void }) {
  const [project, setProject] = useState("");
  const [projects, setProjects] = useState<Array<{ name: string; title: string; customer: string }>>([]);
  const [ks2List, setKs2List] = useState<KS2ForKS3[]>([]);
  const [selectedKs2, setSelectedKs2] = useState<Set<string>>(new Set());
  const [periodFrom, setPeriodFrom] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [periodTo, setPeriodTo] = useState(new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/projects").then(r => r.json()).then(setProjects);
  }, []);

  useEffect(() => {
    if (!project) {
      setKs2List([]);
      setSelectedKs2(new Set());
      return;
    }
    fetch(`/api/ks3/ks2-for-project?project=${encodeURIComponent(project)}`).then(r => r.json()).then(setKs2List);
  }, [project]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  function toggleKs2(name: string) {
    const next = new Set(selectedKs2);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setSelectedKs2(next);
  }

  async function save() {
    if (!project || selectedKs2.size === 0) return;
    setSaving(true);
    const res = await fetch("/api/ks3/create-from-ks2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project,
        ks2_names: Array.from(selectedKs2),
        period_from: periodFrom,
        period_to: periodTo,
        title,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.name) {
      onSaved(data.name);
      onClose();
    }
  }

  const selectedSum = ks2List
    .filter(k => selectedKs2.has(k.name))
    .reduce((s, k) => s + (k.amount || 0), 0);

  return (
    <>
      <div onClick={onClose} style={backdropStyle} />
      <aside style={{ ...drawerStyle, width: 540 }}>
        <div style={drawerHeaderStyle}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>Новая справка КС-3</h2>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Проект *">
            <select value={project} onChange={e => setProject(e.target.value)} style={inputStyle}>
              <option value="">— выберите —</option>
              {projects.map(p => (
                <option key={p.name} value={p.name}>{p.title} · {p.customer}</option>
              ))}
            </select>
          </Field>

          <Field label="Название справки">
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Справка КС-3 за май 2026" style={inputStyle} />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Период с">
              <input type="date" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Период по">
              <input type="date" value={periodTo} onChange={e => setPeriodTo(e.target.value)} style={inputStyle} />
            </Field>
          </div>

          {project && (
            <div>
              <label style={labelStyle}>Включить акты КС-2 *</label>
              {ks2List.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--text-tertiary)", padding: "12px 0" }}>
                  Нет подписанных КС-2 по этому проекту
                </p>
              ) : (
                <div style={{ background: "var(--bg-base)", borderRadius: 8, border: "1px solid var(--border-subtle)", maxHeight: 240, overflowY: "auto" }}>
                  {ks2List.map(k => (
                    <label key={k.name} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 12px", borderBottom: "1px solid var(--border-subtle)",
                      cursor: "pointer",
                    }}>
                      <input type="checkbox" checked={selectedKs2.has(k.name)} onChange={() => toggleKs2(k.name)} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {k.title || k.name}
                        </p>
                        <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: "2px 0 0" }}>
                          {k.name} · {fmtDate(k.act_date)}
                        </p>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: "var(--text-primary)" }}>
                        {fmtM(k.amount)}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              {selectedKs2.size > 0 && (
                <p style={{ fontSize: 12, marginTop: 8, color: "var(--accent)" }}>
                  Выбрано: <strong>{selectedKs2.size}</strong> акт{selectedKs2.size === 1 ? "" : "ов"} на <strong>{fmtM(selectedSum)}</strong>
                </p>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button onClick={save} disabled={saving || !project || selectedKs2.size === 0} style={{ ...btnPrimary, opacity: saving || !project || selectedKs2.size === 0 ? 0.6 : 1 }}>
              {saving ? "Создание..." : "Создать справку"}
            </button>
            <button onClick={onClose} style={btnSecondary}>Отмена</button>
          </div>
        </div>
      </aside>
    </>
  );
}

// ── Detail Drawer ────────────────────────────────────────────────────────────

function KS3Drawer({ name, onClose, onChanged }: { name: string; onClose: () => void; onChanged: () => void }) {
  const [act, setAct] = useState<KS3Act | null>(null);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/ks3/detail?name=${encodeURIComponent(name)}`);
    setAct(await res.json());
  }, [name]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  async function changeStatus(status: KS3Status) {
    await fetch("/api/ks3/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, status }),
    });
    setStatusMenuOpen(false);
    load();
    onChanged();
  }

  if (!act) {
    return (
      <>
        <div onClick={onClose} style={backdropStyle} />
        <aside style={{ ...drawerStyle, width: 720 }}>
          <div style={{ padding: 24, color: "var(--text-tertiary)" }}>Загрузка...</div>
        </aside>
      </>
    );
  }

  const statusStyle = STATUS_COLORS[act.status];

  return (
    <>
      <div onClick={onClose} style={backdropStyle} />
      <aside style={{ ...drawerStyle, width: 720 }}>
        {/* Header */}
        <div style={{ padding: "20px 24px 14px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{act.title}</h2>
                <div style={{ position: "relative" }}>
                  <button onClick={() => setStatusMenuOpen(v => !v)} style={{
                    padding: "3px 10px", borderRadius: 10, background: statusStyle.bg, color: statusStyle.color,
                    fontWeight: 600, fontSize: 12, border: "none", cursor: "pointer",
                  }}>
                    {act.status} ▾
                  </button>
                  {statusMenuOpen && (
                    <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 8, zIndex: 10, minWidth: 160, boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
                      {ALL_STATUSES.filter(s => s !== act.status).map(s => (
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
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: 0 }}>
                {act.name} · ОКУД {act.okud_code || "0322001"} · {act.customer || "—"}
                {act.contract_number ? ` · Договор ${act.contract_number}` : ""}
              </p>
            </div>
            <button onClick={onClose} style={closeBtn}>✕</button>
          </div>
        </div>

        <div style={{ padding: 24, flex: 1, overflowY: "auto" }}>
          {/* Период */}
          <div style={{ marginBottom: 16, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <Info label="Период с" value={fmtDate(act.period_from)} />
            <Info label="по" value={fmtDate(act.period_to)} />
            <Info label="Дата справки" value={fmtDate(act.report_date)} />
          </div>

          {/* Связанные КС-2 */}
          {act.ks2_acts && act.ks2_acts.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>
                Включает акты КС-2 ({act.ks2_acts.length})
              </p>
              <div style={{ background: "var(--bg-base)", borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
                {act.ks2_acts.map(k => (
                  <div key={k.name || k.ks2_act} style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, color: "var(--text-primary)" }}>{k.ks2_act} {k.act_number ? `· ${k.act_number}` : ""}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "monospace" }}>{fmtM(k.act_amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Позиции */}
          <p style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>
            Стоимость работ ({act.items.length})
          </p>
          <div style={{ background: "var(--bg-base)", borderRadius: 8, border: "1px solid var(--border-subtle)", overflow: "hidden", marginBottom: 20 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead style={{ background: "var(--bg-elevated)" }}>
                <tr>
                  <th style={tdHead}>№</th>
                  <th style={{ ...tdHead, textAlign: "left" }}>Наименование</th>
                  <th style={tdHead}>С начала строительства</th>
                  <th style={tdHead}>С начала года</th>
                  <th style={tdHead}>За период</th>
                </tr>
              </thead>
              <tbody>
                {act.items.map((it, i) => (
                  <tr key={it.name || i} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                    <td style={tdCell}>{it.position_number || i + 1}</td>
                    <td style={{ ...tdCell, textAlign: "left" }}>{it.work_name}</td>
                    <td style={{ ...tdCell, fontFamily: "monospace" }}>{fmtM(it.cost_since_start)}</td>
                    <td style={{ ...tdCell, fontFamily: "monospace" }}>{fmtM(it.cost_since_year)}</td>
                    <td style={{ ...tdCell, fontFamily: "monospace", fontWeight: 600 }}>{fmtM(it.cost_period)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Итоги */}
          <div style={{ background: "var(--bg-base)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "14px 18px", marginBottom: 16 }}>
            <p style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>
              Итоги
            </p>
            <TotalRow label="Стоимость за период" value={fmtM(act.total_period)} />
            <TotalRow label={`НДС ${act.vat_rate}%`} value={fmtM(act.vat_amount)} />
            <TotalRow label="Всего с НДС" value={fmtM(act.total_with_vat)} bold />
            {act.retention_pct > 0 && (
              <TotalRow label={`Гарантийное удержание ${act.retention_pct}%`} value={`− ${fmtM(act.retention_amount)}`} color="var(--warning)" />
            )}
            <TotalRow label="Итого к оплате" value={fmtM(act.total_to_pay)} bold big color="var(--accent)" />
          </div>

          {/* PDF / Excel экспорт в гос.форме (ОКУД 0322001) */}
          <div style={{ display: "flex", gap: 8 }}>
            <a href={`/api/ks3/export?name=${encodeURIComponent(act.name)}&format=pdf`}
              style={{ ...btnSecondary, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, borderColor: "var(--accent)", color: "var(--accent)" }}>
              Скачать PDF
            </a>
            <a href={`/api/ks3/export?name=${encodeURIComponent(act.name)}&format=xlsx`}
              style={{ ...btnSecondary, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, borderColor: "var(--success)", color: "var(--success)" }}>
              Скачать Excel
            </a>
          </div>
        </div>
      </aside>
    </>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={labelStyle}>{label}</label>{children}</div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>{label}</p>
      <p style={{ fontSize: 13, color: "var(--text-primary)", margin: "3px 0 0" }}>{value}</p>
    </div>
  );
}

function TotalRow({ label, value, bold, big, color }: { label: string; value: string; bold?: boolean; big?: boolean; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: "1px dashed var(--border-subtle)" }}>
      <span style={{ fontSize: big ? 14 : 12, color: "var(--text-tertiary)", fontWeight: bold ? 600 : 400 }}>{label}</span>
      <span style={{ fontSize: big ? 16 : 13, color: color ?? "var(--text-primary)", fontWeight: bold ? 700 : 500, fontFamily: "monospace" }}>{value}</span>
    </div>
  );
}

const tdHead: React.CSSProperties = { padding: "8px 10px", textAlign: "right", fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 };
const tdCell: React.CSSProperties = { padding: "8px 10px", textAlign: "right", color: "var(--text-primary)" };

// ── Main page ────────────────────────────────────────────────────────────────

export default function KS3Page() {
  const [list, setList] = useState<KS3Act[]>([]);
  const [stats, setStats] = useState<KS3Stats | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const load = useCallback(async () => {
    const [lRes, sRes] = await Promise.all([
      fetch(`/api/ks3?status=${encodeURIComponent(statusFilter)}`),
      fetch("/api/ks3/stats"),
    ]);
    setList(await lRes.json());
    setStats(await sRes.json());
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1200 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>КС-3 — Справки о стоимости</h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>
            ОКУД 0322001. Создавайте справки на основе подписанных КС-2 за отчётный период.
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} style={btnPrimary}>+ Создать справку КС-3</button>
      </div>

      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Всего справок", value: stats.total, sub: "за весь период" },
            { label: "Подписано", value: stats.signed, sub: fmtM(stats.total_to_pay), color: "var(--success)" },
            { label: "Черновиков", value: stats.draft, sub: "в работе", color: "var(--warning)" },
            { label: "Удержано", value: fmtM(stats.total_retention), sub: "гарантийных", color: "var(--accent)" },
          ].map(s => (
            <div key={s.label} style={statCard}>
              <p style={statLabel}>{s.label}</p>
              <p style={{ ...statValue, color: s.color ?? "var(--text-primary)" }}>{s.value}</p>
              <p style={statSub}>{s.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        <FilterChip active={!statusFilter} onClick={() => setStatusFilter("")}>Все</FilterChip>
        {ALL_STATUSES.map(s => (
          <FilterChip key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>{s}</FilterChip>
        ))}
      </div>

      {/* List */}
      {list.length === 0 ? (
        <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: 48, textAlign: "center" }}>
          <p style={{ fontSize: 14, color: "var(--text-tertiary)", margin: 0 }}>Справок КС-3 ещё нет</p>
          <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 8 }}>
            Подпишите акты КС-2, затем создайте справку КС-3 за нужный период
          </p>
          <button onClick={() => setShowCreate(true)} style={{ ...btnPrimary, marginTop: 16 }}>+ Создать первую справку</button>
        </div>
      ) : (
        <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                {["Справка", "Проект / Заказчик", "Период", "Статус", "Сумма к оплате"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((act, i) => {
                const statusStyle = STATUS_COLORS[act.status];
                return (
                  <tr
                    key={act.name}
                    onClick={() => setSelectedName(act.name)}
                    style={{
                      borderBottom: i < list.length - 1 ? "1px solid var(--border-subtle)" : "none",
                      cursor: "pointer", transition: "background 0.12s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(249,115,22,0.04)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "11px 14px" }}>
                      <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{act.title}</p>
                      <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: "2px 0 0" }}>{act.name}</p>
                    </td>
                    <td style={{ padding: "11px 14px", fontSize: 12, color: "var(--text-secondary)" }}>
                      {act.customer || act.project}
                    </td>
                    <td style={{ padding: "11px 14px", fontSize: 12, color: "var(--text-tertiary)" }}>
                      {fmtDate(act.period_from)} — {fmtDate(act.period_to)}
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 10, background: statusStyle.bg, color: statusStyle.color, fontWeight: 600 }}>
                        {act.status}
                      </span>
                    </td>
                    <td style={{ padding: "11px 14px", fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: "var(--text-primary)" }}>
                      {fmtM(act.total_to_pay)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <KS3CreateDrawer
          onClose={() => setShowCreate(false)}
          onSaved={(name) => { setSelectedName(name); load(); }}
        />
      )}
      {selectedName && (
        <KS3Drawer name={selectedName} onClose={() => setSelectedName(null)} onChanged={load} />
      )}
    </div>
  );
}

function FilterChip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "5px 12px", borderRadius: 8, cursor: "pointer",
      background: active ? "rgba(249,115,22,0.12)" : "var(--bg-elevated)",
      border: `1px solid ${active ? "var(--accent)" : "var(--border-subtle)"}`,
      color: active ? "var(--accent)" : "var(--text-secondary)",
      fontSize: 12, fontWeight: active ? 600 : 400,
    }}>{children}</button>
  );
}
