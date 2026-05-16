"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";

interface CashEntry {
  name: string;
  project: string;
  project_title: string;
  entry_type: "Приход" | "Расход";
  operation_kind: string;
  amount: number;
  date: string;
  foreman: string;
  counterparty: string;
  purpose: string;
  comment: string;
  receipt_image_url: string;
  status: string;
  confirmed_by: string;
  confirmed_at: string | null;
  rejection_reason: string;
  creation: string;
  modified: string;
  owner: string;
}

interface Summary {
  by_project: {
    project: string;
    project_title: string;
    income: number;
    outcome: number;
    balance: number;
    pending_count: number;
    total_count: number;
  }[];
  totals: {
    income: number;
    outcome: number;
    balance: number;
    pending_amount: number;
    pending_count: number;
  };
  period_days: number;
}

const OPERATION_KINDS = [
  "Закупка материалов", "Оплата бригаде", "ГСМ / транспорт",
  "Аренда оборудования", "Питание / бытовое", "Возврат остатка",
  "Внесение от директора", "Прочее",
];

function fmtMoney(v: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(v) + " ₽";
}

function statusBg(s: string): string {
  if (s === "Подтверждён") return "rgba(74,222,128,0.10)";
  if (s === "Отклонён") return "rgba(248,113,113,0.10)";
  if (s === "Ждёт подтверждения") return "rgba(234,179,8,0.10)";
  return "var(--bg-elevated)";
}
function statusColor(s: string): string {
  if (s === "Подтверждён") return "var(--success)";
  if (s === "Отклонён") return "var(--danger)";
  if (s === "Ждёт подтверждения") return "#eab308";
  return "var(--text-tertiary)";
}

export default function SiteCashPage() {
  const toast = useToast();
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [projects, setProjects] = useState<{ name: string; title?: string }[]>([]);
  const [filter, setFilter] = useState({ project: "", status: "", entry_type: "" });
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<Partial<CashEntry> | null>(null);

  function reload() {
    setLoading(true);
    const p = new URLSearchParams({ days: "90" });
    if (filter.project) p.set("project", filter.project);
    if (filter.status) p.set("status", filter.status);
    if (filter.entry_type) p.set("entry_type", filter.entry_type);

    Promise.all([
      fetch(`/api/site-cash?${p}`).then((r) => r.json()),
      fetch("/api/site-cash?mode=summary&days=90").then((r) => r.json()),
    ])
      .then(([e, s]) => {
        setEntries(Array.isArray(e) ? e : []);
        setSummary(s && !s.error ? s : null);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) {
          setProjects(d.map((p: { name: string; title?: string }) => ({ name: p.name, title: p.title })));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter]);

  async function confirmEntry(name: string) {
    const r = await fetch("/api/site-cash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm", name }),
    });
    const d = await r.json();
    if (d.error) toast.error(d.error);
    else { toast.success("Подтверждено"); reload(); }
  }

  async function rejectEntry(name: string) {
    const reason = window.prompt("Причина отклонения?");
    if (!reason) return;
    const r = await fetch("/api/site-cash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", name, reason }),
    });
    const d = await r.json();
    if (d.error) toast.error(d.error);
    else { toast.success("Отклонено"); reload(); }
  }

  async function deleteEntry(name: string) {
    if (!window.confirm("Удалить запись?")) return;
    const r = await fetch(`/api/site-cash?name=${encodeURIComponent(name)}`, { method: "DELETE" });
    const d = await r.json();
    if (d.error) toast.error(d.error);
    else { toast.success("Удалено"); reload(); }
  }

  return (
    <div style={{ padding: "24px 32px", minHeight: "100vh", background: "var(--bg-base)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>Касса на объекте</h1>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4, fontFamily: "monospace" }}>
            Наличные расходы и приходы по проектам · подтверждение бухгалтером
          </div>
        </div>
        <button onClick={() => setEditor({ entry_type: "Расход", operation_kind: "Прочее", status: "Ждёт подтверждения" })}
                style={{
                  padding: "10px 18px", fontSize: 13, fontWeight: 500,
                  background: "var(--accent)", color: "white",
                  border: "none", borderRadius: 8, cursor: "pointer",
                }}>
          + Запись
        </button>
      </div>

      {/* Summary KPI */}
      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
          {[
            { label: "Приход (за 90 дн.)", value: fmtMoney(summary.totals.income), color: "var(--success)" },
            { label: "Расход (за 90 дн.)", value: fmtMoney(summary.totals.outcome), color: "var(--danger)" },
            { label: "Баланс", value: fmtMoney(summary.totals.balance),
              color: summary.totals.balance >= 0 ? "var(--success)" : "var(--danger)" },
            { label: `Ждут подтв. (${summary.totals.pending_count})`, value: fmtMoney(summary.totals.pending_amount), color: "#eab308" },
          ].map((k) => (
            <div key={k.label} style={{
              padding: 14, borderRadius: 10,
              background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
            }}>
              <div style={{ fontSize: 20, fontWeight: 600, color: k.color, fontFamily: "monospace" }}>{k.value}</div>
              <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", marginTop: 2, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {k.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <select value={filter.project} onChange={(e) => setFilter({ ...filter, project: e.target.value })}
                style={selStyle}>
          <option value="">Все проекты</option>
          {projects.map((p) => (
            <option key={p.name} value={p.name}>{p.title || p.name}</option>
          ))}
        </select>
        <select value={filter.entry_type} onChange={(e) => setFilter({ ...filter, entry_type: e.target.value })}
                style={selStyle}>
          <option value="">Все типы</option>
          <option value="Приход">Только приходы</option>
          <option value="Расход">Только расходы</option>
        </select>
        <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                style={selStyle}>
          <option value="">Все статусы</option>
          <option value="Ждёт подтверждения">Ждут подтверждения</option>
          <option value="Подтверждён">Подтверждённые</option>
          <option value="Отклонён">Отклонённые</option>
          <option value="Черновик">Черновики</option>
        </select>
      </div>

      {loading && <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Загрузка...</div>}

      {!loading && entries.length === 0 && (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)", border: "1px dashed var(--border-subtle)", borderRadius: 10 }}>
          Записей пока нет
        </div>
      )}

      {!loading && entries.length > 0 && (
        <div style={{
          background: "var(--bg-elevated)", borderRadius: 10,
          border: "1px solid var(--border-subtle)", overflow: "hidden",
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "var(--bg-base)", borderBottom: "1px solid var(--border-subtle)" }}>
                <th style={thStyle}>Дата</th>
                <th style={thStyle}>Проект</th>
                <th style={thStyle}>Тип</th>
                <th style={thStyle}>Вид</th>
                <th style={thStyle}>Назначение</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Сумма</th>
                <th style={thStyle}>Прораб</th>
                <th style={thStyle}>Статус</th>
                <th style={{ ...thStyle, width: 110 }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.name} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <td style={tdStyle}>{e.date}</td>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 11 }}>{e.project}</td>
                  <td style={tdStyle}>
                    <span style={{ color: e.entry_type === "Приход" ? "var(--success)" : "var(--danger)", fontWeight: 500 }}>
                      {e.entry_type === "Приход" ? "↗" : "↘"} {e.entry_type}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, color: "var(--text-secondary)" }}>{e.operation_kind}</td>
                  <td style={tdStyle}>
                    <div>{e.purpose}</div>
                    {e.comment && <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{e.comment}</div>}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right", fontFamily: "monospace", fontWeight: 500,
                              color: e.entry_type === "Приход" ? "var(--success)" : "var(--text-primary)" }}>
                    {fmtMoney(e.amount)}
                  </td>
                  <td style={{ ...tdStyle, color: "var(--text-secondary)" }}>{e.foreman || "—"}</td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 500,
                      background: statusBg(e.status), color: statusColor(e.status),
                      border: `1px solid ${statusColor(e.status)}`,
                    }}>
                      {e.status}
                    </span>
                    {e.rejection_reason && (
                      <div style={{ fontSize: 10.5, color: "var(--danger)", marginTop: 3 }} title={e.rejection_reason}>
                        {e.rejection_reason.substring(0, 30)}{e.rejection_reason.length > 30 ? "…" : ""}
                      </div>
                    )}
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                    {e.status === "Ждёт подтверждения" && (
                      <>
                        <button onClick={() => confirmEntry(e.name)} title="Подтвердить" style={btnIcon("var(--success)")}>✓</button>
                        <button onClick={() => rejectEntry(e.name)} title="Отклонить" style={btnIcon("var(--danger)")}>×</button>
                      </>
                    )}
                    <button onClick={() => setEditor(e)} title="Изменить" style={btnIcon("var(--text-tertiary)")}>✎</button>
                    <button onClick={() => deleteEntry(e.name)} title="Удалить" style={btnIcon("var(--danger)")}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Project balances */}
      {summary && summary.by_project.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 500, margin: "0 0 10px", color: "var(--text-secondary)" }}>
            Баланс по проектам
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 8 }}>
            {summary.by_project.map((p) => (
              <div key={p.project} style={{
                padding: 12, borderRadius: 8,
                background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
              }}>
                <div style={{ fontSize: 12.5, fontWeight: 500 }}>{p.project_title}</div>
                <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", fontFamily: "monospace", marginBottom: 6 }}>
                  {p.project}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 4 }}>
                  <span style={{ color: "var(--success)" }}>+ {fmtMoney(p.income)}</span>
                  <span style={{ color: "var(--danger)" }}>− {fmtMoney(p.outcome)}</span>
                </div>
                <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px dashed var(--border-subtle)",
                              fontSize: 13, fontWeight: 600, fontFamily: "monospace",
                              color: p.balance >= 0 ? "var(--success)" : "var(--danger)" }}>
                  Баланс: {fmtMoney(p.balance)}
                </div>
                {p.pending_count > 0 && (
                  <div style={{ marginTop: 4, fontSize: 11, color: "#a16207" }}>
                    ⌛ Ждут подтверждения: {p.pending_count}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {editor && (
        <CashEditor entry={editor} projects={projects}
                    onClose={() => setEditor(null)}
                    onSaved={() => { setEditor(null); reload(); }} />
      )}
    </div>
  );
}

function CashEditor({ entry, projects, onClose, onSaved }: {
  entry: Partial<CashEntry>;
  projects: { name: string; title?: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [f, setF] = useState<Partial<CashEntry>>(entry);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!f.project) { toast.warn("Выберите проект"); return; }
    if (!f.amount || f.amount <= 0) { toast.warn("Сумма должна быть > 0"); return; }
    if (!f.purpose || !f.purpose.trim()) { toast.warn("Назначение обязательно"); return; }

    setSaving(true);
    try {
      const r = await fetch("/api/site-cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", ...f }),
      });
      const d = await r.json();
      if (d.error) { toast.error(d.error); return; }
      toast.success(d.action === "created" ? "Создано" : "Обновлено");
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
        width: "100%", maxWidth: 560, maxHeight: "85vh", overflowY: "auto",
        background: "var(--bg-base)", borderRadius: 12,
        border: "1px solid var(--border-subtle)", padding: 24,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 17, fontWeight: 500, margin: 0 }}>
            {entry.name ? "Редактирование записи" : "Новая запись кассы"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-tertiary)", fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <Field label="Проект *">
            <select value={f.project || ""} onChange={(e) => setF({ ...f, project: e.target.value })} style={inpStyle}>
              <option value="">— не выбран —</option>
              {projects.map((p) => <option key={p.name} value={p.name}>{p.title || p.name}</option>)}
            </select>
          </Field>
          <Field label="Дата">
            <input type="date" value={(f.date as string) || new Date().toISOString().substring(0, 10)}
                   onChange={(e) => setF({ ...f, date: e.target.value })} style={inpStyle} />
          </Field>
          <Field label="Тип *">
            <div style={{ display: "flex", gap: 4 }}>
              {["Расход", "Приход"].map((t) => (
                <button key={t} onClick={() => setF({ ...f, entry_type: t as "Приход" | "Расход" })}
                        style={{
                          flex: 1, padding: "9px", fontSize: 12, fontWeight: 500,
                          background: f.entry_type === t ? "var(--accent)" : "transparent",
                          color: f.entry_type === t ? "white" : "var(--text-secondary)",
                          border: "1px solid var(--border-subtle)", borderRadius: 7, cursor: "pointer",
                        }}>
                  {t === "Приход" ? "↗ Приход" : "↘ Расход"}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Вид">
            <select value={f.operation_kind || "Прочее"} onChange={(e) => setF({ ...f, operation_kind: e.target.value })} style={inpStyle}>
              {OPERATION_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </Field>
          <Field label="Сумма ₽ *">
            <input type="number" min={0} value={f.amount ?? ""}
                   onChange={(e) => setF({ ...f, amount: parseFloat(e.target.value) || 0 })} style={inpStyle} />
          </Field>
          <Field label="Прораб / подотчётник">
            <input type="text" value={f.foreman || ""}
                   onChange={(e) => setF({ ...f, foreman: e.target.value })} style={inpStyle} />
          </Field>
        </div>

        <Field label="Назначение *">
          <input type="text" value={f.purpose || ""}
                 onChange={(e) => setF({ ...f, purpose: e.target.value })}
                 placeholder="Дизель ГАЗель / Бетон М300 / Бригада подсобников"
                 style={inpStyle} />
        </Field>
        <div style={{ height: 12 }} />
        <Field label="Получатель / поставщик">
          <input type="text" value={f.counterparty || ""}
                 onChange={(e) => setF({ ...f, counterparty: e.target.value })}
                 placeholder="АЗС Лукойл №12 / ИП Иванов"
                 style={inpStyle} />
        </Field>
        <div style={{ height: 12 }} />
        <Field label="URL фото чека">
          <input type="text" value={f.receipt_image_url || ""}
                 onChange={(e) => setF({ ...f, receipt_image_url: e.target.value })}
                 placeholder="/files/receipt-... или внешний URL"
                 style={{ ...inpStyle, fontFamily: "monospace" }} />
        </Field>
        <div style={{ height: 12 }} />
        <Field label="Комментарий">
          <textarea value={f.comment || ""}
                    onChange={(e) => setF({ ...f, comment: e.target.value })}
                    style={{ ...inpStyle, minHeight: 60, fontFamily: "inherit", resize: "vertical" }} />
        </Field>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
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
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{
        display: "block", fontSize: 10.5, color: "var(--text-tertiary)",
        textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace", marginBottom: 4,
      }}>{label}</label>
      {children}
    </div>
  );
}

const inpStyle: React.CSSProperties = {
  width: "100%", padding: "9px 11px", fontSize: 13,
  background: "var(--bg-elevated)", color: "var(--text-primary)",
  border: "1px solid var(--border-subtle)", borderRadius: 7,
  outline: "none",
};

const selStyle: React.CSSProperties = {
  padding: "7px 10px", fontSize: 12,
  background: "var(--bg-elevated)", color: "var(--text-primary)",
  border: "1px solid var(--border-subtle)", borderRadius: 6,
  outline: "none", cursor: "pointer",
};

const thStyle: React.CSSProperties = {
  padding: "9px 10px", textAlign: "left", fontSize: 11, fontWeight: 500,
  color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 10px", color: "var(--text-primary)",
};

function btnIcon(color: string): React.CSSProperties {
  return {
    padding: "3px 7px", fontSize: 13, marginRight: 3,
    background: "transparent", color,
    border: "1px solid var(--border-subtle)", borderRadius: 5, cursor: "pointer",
  };
}
