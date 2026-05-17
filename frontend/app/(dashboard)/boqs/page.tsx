"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";

interface BOQ {
  name: string;
  title: string;
  project: string | null;
  project_title?: string;
  customer: string | null;
  customer_name?: string;
  version: number;
  status: string;
  boq_date: string;
  direct_cost: number;
  grand_total: number;
  positions_count: number;
  modified: string;
  oce_boq_id: string | null;
}

interface Summary {
  total: number; draft: number; submitted: number;
  won: number; lost: number;
  won_amount: number; total_amount: number; conversion_pct: number;
}

interface Estimate { name: string; title: string; }

function fmtMoney(v: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(v) + " ₽";
}

function statusBg(s: string): string {
  if (s === "Won") return "rgba(74,222,128,0.10)";
  if (s === "Lost") return "rgba(248,113,113,0.10)";
  if (s === "Submitted") return "rgba(96,165,250,0.10)";
  if (s === "Archived") return "rgba(148,163,184,0.10)";
  return "rgba(234,179,8,0.10)";
}
function statusColor(s: string): string {
  if (s === "Won") return "var(--success)";
  if (s === "Lost") return "var(--danger)";
  if (s === "Submitted") return "#3b82f6";
  if (s === "Archived") return "var(--text-tertiary)";
  return "#eab308";
}

const FRAPPE_URL = "http://erp.olimp-ural.ru";

export default function BOQsPage() {
  const toast = useToast();
  const [items, setItems] = useState<BOQ[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [filter, setFilter] = useState({ status: "" });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  function reload() {
    setLoading(true);
    const p = new URLSearchParams({ days: "365" });
    if (filter.status) p.set("status", filter.status);
    Promise.all([
      fetch(`/api/boqs?${p}`).then((r) => r.json()),
      fetch("/api/boqs?mode=summary").then((r) => r.json()),
    ])
      .then(([i, s]) => {
        setItems(Array.isArray(i) ? i : []);
        setSummary(s && !s.error ? s : null);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetch("/api/estimates")
      .then((r) => r.json())
      .then((d) => setEstimates(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter]);

  async function changeStatus(name: string, status: string) {
    const r = await fetch("/api/boqs", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "change_status", name, status }),
    });
    const d = await r.json();
    if (d.error) toast.error(d.error);
    else { toast.success(`Статус: ${status}`); reload(); }
  }

  async function createProject(boq: BOQ) {
    if (boq.status !== "Won") {
      if (!window.confirm("BOQ ещё не в статусе Won. Сменить и создать проект?")) return;
      await changeStatus(boq.name, "Won");
    }
    if (!window.confirm(
      `Создать Construction Project из BOQ ${boq.name}?\n\n` +
      `Будет создан проект с suммой ${fmtMoney(boq.grand_total)} ` +
      `и Schedule Tasks из секций сметы.`
    )) return;
    const r = await fetch("/api/boqs", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_project", name: boq.name }),
    });
    const d = await r.json();
    if (d.error) toast.error(d.error);
    else if (d.skipped === "already_exists") {
      toast.warn(`Проект ${d.name} уже создан из этой BOQ`);
    } else {
      toast.success(
        `🏗 Проект ${d.name} создан · маржа ${d.margin_pct?.toFixed(1)}% · задач: ${d.tasks_created}`,
        9000
      );
      reload();
    }
  }

  async function deleteItem(name: string) {
    if (!window.confirm(`Удалить BOQ ${name}?`)) return;
    const r = await fetch(`/api/boqs?name=${encodeURIComponent(name)}`, { method: "DELETE" });
    const d = await r.json();
    if (d.error) toast.error(d.error);
    else { toast.success("Удалено"); reload(); }
  }

  return (
    <div style={{ padding: "24px 32px", minHeight: "100vh", background: "var(--bg-base)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>BOQ — Сметы (Bill of Quantities)</h1>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4, fontFamily: "monospace" }}>
            Структурированные сметы с разделами/позициями + накладные/прибыль/НДС
          </div>
        </div>
        <button onClick={() => setCreating(true)} style={{
          padding: "10px 18px", fontSize: 13, fontWeight: 500,
          background: "var(--accent)", color: "white",
          border: "none", borderRadius: 8, cursor: "pointer",
        }}>+ Новая BOQ из сметы</button>
      </div>

      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 16 }}>
          {[
            { label: "Всего BOQ (год)", value: String(summary.total), color: "var(--text-primary)" },
            { label: "В работе", value: String(summary.draft + summary.submitted), color: "#eab308" },
            { label: "Выиграно", value: String(summary.won), color: "var(--success)" },
            { label: "Конверсия", value: `${summary.conversion_pct.toFixed(0)}%`,
              color: summary.conversion_pct >= 30 ? "var(--success)" : "#eab308" },
            { label: "Сумма выигранных", value: fmtMoney(summary.won_amount), color: "var(--success)" },
          ].map((k) => (
            <div key={k.label} style={{
              padding: 14, borderRadius: 10,
              background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
            }}>
              <div style={{ fontSize: 19, fontWeight: 600, color: k.color, fontFamily: "monospace" }}>{k.value}</div>
              <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", marginTop: 2, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {k.label}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                style={{
                  padding: "7px 10px", fontSize: 12,
                  background: "var(--bg-elevated)", color: "var(--text-primary)",
                  border: "1px solid var(--border-subtle)", borderRadius: 6, outline: "none", cursor: "pointer",
                }}>
          <option value="">Все статусы</option>
          <option>Draft</option>
          <option>Submitted</option>
          <option>Won</option>
          <option>Lost</option>
          <option>Archived</option>
        </select>
      </div>

      {loading && <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Загрузка...</div>}

      {!loading && items.length === 0 && (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)", border: "1px dashed var(--border-subtle)", borderRadius: 10 }}>
          BOQ пока нет.<br/>
          <div style={{ marginTop: 8, fontSize: 12 }}>
            Создайте первую из существующей Estimate через кнопку выше.
          </div>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div style={{
          background: "var(--bg-elevated)", borderRadius: 10,
          border: "1px solid var(--border-subtle)", overflow: "hidden",
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "var(--bg-base)", borderBottom: "1px solid var(--border-subtle)" }}>
                <th style={th}>№</th>
                <th style={th}>Название</th>
                <th style={th}>Заказчик</th>
                <th style={th}>Проект</th>
                <th style={{ ...th, textAlign: "right" }}>Прямые ₽</th>
                <th style={{ ...th, textAlign: "right" }}>С НДС ₽</th>
                <th style={th}>v</th>
                <th style={th}>Статус</th>
                <th style={th}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.name} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <td style={{ ...td, fontFamily: "monospace", fontSize: 11.5 }}>{it.name}</td>
                  <td style={td}>
                    <a href={`${FRAPPE_URL}/app/boq/${encodeURIComponent(it.name)}`}
                       target="_blank" rel="noopener"
                       style={{ color: "var(--text-primary)", textDecoration: "none", fontWeight: 500 }}>
                      {it.title} ↗
                    </a>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2, fontFamily: "monospace" }}>
                      {it.positions_count} позиций
                    </div>
                  </td>
                  <td style={{ ...td, color: "var(--text-secondary)" }}>{it.customer_name || "—"}</td>
                  <td style={{ ...td, color: "var(--text-secondary)" }}>{it.project_title || "—"}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "var(--text-secondary)" }}>
                    {fmtMoney(it.direct_cost)}
                  </td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>
                    {fmtMoney(it.grand_total)}
                  </td>
                  <td style={{ ...td, fontFamily: "monospace", color: "var(--text-tertiary)" }}>v{it.version}</td>
                  <td style={td}>
                    <select value={it.status}
                            onChange={(e) => changeStatus(it.name, e.target.value)}
                            style={{
                              padding: "2px 8px", fontSize: 11, fontWeight: 500,
                              background: statusBg(it.status), color: statusColor(it.status),
                              border: `1px solid ${statusColor(it.status)}`,
                              borderRadius: 5, cursor: "pointer", outline: "none",
                            }}>
                      <option value="Draft">Draft</option>
                      <option value="Submitted">Submitted</option>
                      <option value="Won">Won</option>
                      <option value="Lost">Lost</option>
                      <option value="Archived">Archived</option>
                    </select>
                  </td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>
                    <a href={`${FRAPPE_URL}/app/boq/${encodeURIComponent(it.name)}`}
                       target="_blank" rel="noopener"
                       style={{ ...btnIcon("var(--accent)"), textDecoration: "none", display: "inline-block" }}>
                      ✎
                    </a>
                    {(it.status === "Won" || it.status === "Submitted") && (
                      <button onClick={() => createProject(it)} title="Создать проект"
                              style={btnIcon("#7c3aed")}>🏗</button>
                    )}
                    <button onClick={() => deleteItem(it.name)} title="Удалить" style={btnIcon("var(--danger)")}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <CreateFromEstimateDialog
          estimates={estimates}
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); reload(); }}
        />
      )}

      <div style={{ marginTop: 18, padding: 12, borderRadius: 8,
                    background: "rgba(96,165,250,0.05)", border: "1px solid rgba(96,165,250,0.3)",
                    fontSize: 12, color: "var(--text-secondary)" }}>
        💡 Полное редактирование BOQ (разделы, позиции, формулы накладных) — в{" "}
        <a href={`${FRAPPE_URL}/app/boq`} target="_blank" rel="noopener" style={{ color: "#3b82f6" }}>
          Frappe-админке ↗
        </a>. Здесь — список, статусы, удаление.
      </div>
    </div>
  );
}

function CreateFromEstimateDialog({ estimates, onClose, onCreated }: {
  estimates: Estimate[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [estimateName, setEstimateName] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  async function create() {
    if (!estimateName) { toast.warn("Выберите смету"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/boqs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_from_estimate",
          estimate: estimateName, title,
        }),
      });
      const d = await r.json();
      if (d.error) { toast.error(d.error); return; }
      toast.success(`Создана ${d.name}: ${d.positions} позиций, итог ${fmtMoney(d.grand_total)}`, 8000);
      onCreated();
    } finally { setSaving(false); }
  }

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100,
      display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "60px 20px",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 540, background: "var(--bg-base)",
        borderRadius: 12, border: "1px solid var(--border-subtle)", padding: 24,
      }}>
        <h2 style={{ fontSize: 17, fontWeight: 500, margin: "0 0 16px" }}>
          Создать BOQ из существующей сметы
        </h2>

        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>Исходная Estimate *</label>
          <select value={estimateName} onChange={(e) => setEstimateName(e.target.value)} style={inp}>
            <option value="">— выберите смету —</option>
            {estimates.map((e) => <option key={e.name} value={e.name}>{e.title || e.name}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>Название BOQ (если пусто — авто)</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)}
                 placeholder="BOQ: АКЗ резервуаров — НТМК"
                 style={inp} />
        </div>

        <div style={{ padding: 10, marginBottom: 16, borderRadius: 7,
                      background: "rgba(96,165,250,0.05)", border: "1px solid rgba(96,165,250,0.3)",
                      fontSize: 12, color: "var(--text-secondary)" }}>
          📋 Все позиции и разделы сметы перенесутся в BOQ. Накладные 8%, прибыль 15%,
          резерв 5%, НДС 20% применятся по умолчанию (можно изменить в Frappe-админке).
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={{
            padding: "10px 18px", fontSize: 13,
            background: "transparent", color: "var(--text-secondary)",
            border: "1px solid var(--border-subtle)", borderRadius: 8, cursor: "pointer",
          }}>Отмена</button>
          <button onClick={create} disabled={saving || !estimateName} style={{
            padding: "10px 22px", fontSize: 13, fontWeight: 500,
            background: "var(--accent)", color: "white",
            border: "none", borderRadius: 8, cursor: "pointer",
            opacity: saving || !estimateName ? 0.6 : 1,
          }}>{saving ? "Создание..." : "✓ Создать BOQ"}</button>
        </div>
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = {
  display: "block", fontSize: 10.5, color: "var(--text-tertiary)",
  textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace", marginBottom: 4,
};
const inp: React.CSSProperties = {
  width: "100%", padding: "9px 11px", fontSize: 13,
  background: "var(--bg-elevated)", color: "var(--text-primary)",
  border: "1px solid var(--border-subtle)", borderRadius: 7, outline: "none",
};
const th: React.CSSProperties = {
  padding: "9px 10px", textAlign: "left", fontSize: 11, fontWeight: 500,
  color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em",
};
const td: React.CSSProperties = { padding: "10px 10px", color: "var(--text-primary)" };
function btnIcon(color: string): React.CSSProperties {
  return {
    padding: "4px 9px", fontSize: 12, marginRight: 4,
    background: "transparent", color,
    border: "1px solid var(--border-subtle)", borderRadius: 5, cursor: "pointer",
  };
}
