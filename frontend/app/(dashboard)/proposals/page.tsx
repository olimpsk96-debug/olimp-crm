"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";

interface Proposal {
  name: string;
  title: string;
  customer: string | null;
  customer_name?: string;
  project: string | null;
  project_title?: string;
  estimate_link: string | null;
  status: string;
  total_amount: number;
  valid_until: string | null;
  sent_at: string | null;
  first_viewed_at: string | null;
  view_count: number;
  signed_at: string | null;
  signed_by_name: string | null;
  modified: string;
}

interface Summary {
  total: number; draft: number; pending: number;
  approved: number; rejected: number;
  approved_amount: number; total_amount: number; conversion_pct: number;
}

interface Template { name: string; template_id: string; title: string; category: string; }
interface Customer { name: string; customer_name?: string; }
interface Project { name: string; title?: string; }

function fmtMoney(v: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(v) + " ₽";
}

function statusBg(s: string): string {
  if (s === "Согласовано") return "rgba(74,222,128,0.10)";
  if (s === "Отклонено") return "rgba(248,113,113,0.10)";
  if (s === "Просмотрено клиентом") return "rgba(96,165,250,0.10)";
  if (s === "Отправлено") return "rgba(167,139,250,0.10)";
  if (s === "Истекло") return "rgba(148,163,184,0.10)";
  return "rgba(234,179,8,0.10)";
}
function statusColor(s: string): string {
  if (s === "Согласовано") return "var(--success)";
  if (s === "Отклонено") return "var(--danger)";
  if (s === "Просмотрено клиентом") return "#3b82f6";
  if (s === "Отправлено") return "#7c3aed";
  if (s === "Истекло") return "var(--text-tertiary)";
  return "#eab308";
}

export default function ProposalsPage() {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<Proposal[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [filter, setFilter] = useState({ status: "" });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  function reload() {
    setLoading(true);
    const p = new URLSearchParams({ days: "365" });
    if (filter.status) p.set("status", filter.status);
    Promise.all([
      fetch(`/api/proposals?${p}`).then((r) => r.json()),
      fetch("/api/proposals?mode=summary").then((r) => r.json()),
    ])
      .then(([i, s]) => {
        setItems(Array.isArray(i) ? i : []);
        setSummary(s && !s.error ? s : null);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    Promise.all([
      fetch("/api/proposals/templates").then((r) => r.json()),
      fetch("/api/clients").then((r) => r.json()).catch(() => []),
      fetch("/api/projects").then((r) => r.json()).catch(() => []),
    ]).then(([t, c, p]) => {
      setTemplates(Array.isArray(t) ? t : []);
      setCustomers(Array.isArray(c) ? c : []);
      setProjects(Array.isArray(p) ? p.map((x: { name: string; title?: string }) => ({ name: x.name, title: x.title })) : []);
    });
  }, []);

  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter]);

  async function deleteItem(name: string) {
    if (!window.confirm("Удалить КП?")) return;
    const r = await fetch(`/api/proposals?name=${encodeURIComponent(name)}`, { method: "DELETE" });
    const d = await r.json();
    if (d.error) toast.error(d.error);
    else { toast.success("Удалено"); reload(); }
  }

  return (
    <div style={{ padding: "24px 32px", minHeight: "100vh", background: "var(--bg-base)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>Коммерческие предложения</h1>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4, fontFamily: "monospace" }}>
            КП-конструктор с шаблонами, таблицами, графиком оплаты · подпись клиента online
          </div>
        </div>
        <button onClick={() => setCreating(true)}
                style={{
                  padding: "10px 18px", fontSize: 13, fontWeight: 500,
                  background: "var(--accent)", color: "white",
                  border: "none", borderRadius: 8, cursor: "pointer",
                }}>
          + Новое КП
        </button>
      </div>

      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 16 }}>
          {[
            { label: "Всего КП (год)", value: String(summary.total), color: "var(--text-primary)" },
            { label: "В работе", value: String(summary.draft + summary.pending), color: "#eab308" },
            { label: "Согласовано", value: String(summary.approved), color: "var(--success)" },
            { label: "Конверсия", value: `${summary.conversion_pct.toFixed(0)}%`,
              color: summary.conversion_pct >= 30 ? "var(--success)" : "#eab308" },
            { label: "Сумма согласованных", value: fmtMoney(summary.approved_amount), color: "var(--success)" },
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
                style={selStyle}>
          <option value="">Все статусы</option>
          <option>Черновик</option>
          <option>Готово к отправке</option>
          <option>Отправлено</option>
          <option>Просмотрено клиентом</option>
          <option>Согласовано</option>
          <option>Отклонено</option>
          <option>Истекло</option>
        </select>
      </div>

      {loading && <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Загрузка...</div>}

      {!loading && items.length === 0 && (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)", border: "1px dashed var(--border-subtle)", borderRadius: 10 }}>
          КП пока нет. Создайте первое через «+ Новое КП».
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
                <th style={thStyle}>№</th>
                <th style={thStyle}>Название</th>
                <th style={thStyle}>Клиент</th>
                <th style={thStyle}>Проект</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Сумма</th>
                <th style={thStyle}>Статус</th>
                <th style={thStyle}>Действие</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.name} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 11.5 }}>{it.name}</td>
                  <td style={tdStyle}>
                    <Link href={`/proposals/${encodeURIComponent(it.name)}`}
                          style={{ color: "var(--text-primary)", textDecoration: "none", fontWeight: 500 }}>
                      {it.title}
                    </Link>
                    {it.view_count > 0 && (
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                        👁 {it.view_count} просмотров клиентом
                      </div>
                    )}
                  </td>
                  <td style={{ ...tdStyle, color: "var(--text-secondary)" }}>{it.customer_name || "—"}</td>
                  <td style={{ ...tdStyle, color: "var(--text-secondary)" }}>{it.project_title || "—"}</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontFamily: "monospace", fontWeight: 500 }}>
                    {fmtMoney(it.total_amount)}
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 500,
                      background: statusBg(it.status), color: statusColor(it.status),
                      border: `1px solid ${statusColor(it.status)}`,
                    }}>
                      {it.status}
                    </span>
                    {it.signed_by_name && (
                      <div style={{ fontSize: 11, color: "var(--success)", marginTop: 2 }}>
                        ✓ {it.signed_by_name}
                      </div>
                    )}
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                    <Link href={`/proposals/${encodeURIComponent(it.name)}`}
                          style={{ ...btnIcon("var(--accent)"), textDecoration: "none", display: "inline-block" }}>✎ Открыть</Link>
                    <button onClick={() => deleteItem(it.name)} title="Удалить" style={btnIcon("var(--danger)")}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <CreateProposalDialog
          templates={templates} customers={customers} projects={projects}
          onClose={() => setCreating(false)}
          onCreated={(name) => router.push(`/proposals/${encodeURIComponent(name)}`)}
        />
      )}
    </div>
  );
}

function CreateProposalDialog({ templates, customers, projects, onClose, onCreated }: {
  templates: Template[]; customers: Customer[]; projects: Project[];
  onClose: () => void;
  onCreated: (name: string) => void;
}) {
  const toast = useToast();
  const [f, setF] = useState({
    title: "", customer: "", project: "", template_used: "",
    total_amount: 0, valid_until: "",
  });
  const [saving, setSaving] = useState(false);

  async function create() {
    if (!f.title.trim()) { toast.warn("Укажите название"); return; }
    setSaving(true);
    try {
      // 1. Если выбран шаблон — подгрузим его content_json
      let content = '{"type":"doc","content":[{"type":"paragraph"}]}';
      if (f.template_used) {
        const tpl = await fetch(`/api/proposals/templates?name=${encodeURIComponent(f.template_used)}`).then(r => r.json());
        if (tpl?.default_content_json) content = tpl.default_content_json;
      }

      const r = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", ...f, content_json: content, status: "Черновик" }),
      });
      const d = await r.json();
      if (d.error) { toast.error(d.error); return; }
      toast.success("Создано");
      onCreated(d.name);
    } finally { setSaving(false); }
  }

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100,
      display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "60px 20px",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 560, background: "var(--bg-base)",
        borderRadius: 12, border: "1px solid var(--border-subtle)", padding: 24,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 17, fontWeight: 500, margin: 0 }}>Новое КП</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-tertiary)", fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        <Field label="Название КП *">
          <input type="text" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })}
                 placeholder="КП на АКЗ резервуаров — НПП Старт"
                 style={inpStyle} autoFocus />
        </Field>
        <div style={{ height: 12 }} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Клиент">
            <select value={f.customer} onChange={(e) => setF({ ...f, customer: e.target.value })} style={inpStyle}>
              <option value="">— не выбран —</option>
              {customers.map((c) => <option key={c.name} value={c.name}>{c.customer_name || c.name}</option>)}
            </select>
          </Field>
          <Field label="Проект">
            <select value={f.project} onChange={(e) => setF({ ...f, project: e.target.value })} style={inpStyle}>
              <option value="">— не выбран —</option>
              {projects.map((p) => <option key={p.name} value={p.name}>{p.title || p.name}</option>)}
            </select>
          </Field>
        </div>
        <div style={{ height: 12 }} />

        <Field label="Шаблон (опционально)">
          <select value={f.template_used} onChange={(e) => setF({ ...f, template_used: e.target.value })} style={inpStyle}>
            <option value="">Пустое КП</option>
            {templates.map((t) => <option key={t.name} value={t.name}>{t.title}</option>)}
          </select>
        </Field>
        <div style={{ height: 12 }} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Сумма ₽">
            <input type="number" min={0} value={f.total_amount}
                   onChange={(e) => setF({ ...f, total_amount: parseFloat(e.target.value) || 0 })}
                   style={inpStyle} />
          </Field>
          <Field label="Действует до">
            <input type="date" value={f.valid_until}
                   onChange={(e) => setF({ ...f, valid_until: e.target.value })}
                   style={inpStyle} />
          </Field>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
          <button onClick={onClose} style={{
            padding: "10px 18px", fontSize: 13,
            background: "transparent", color: "var(--text-secondary)",
            border: "1px solid var(--border-subtle)", borderRadius: 8, cursor: "pointer",
          }}>Отмена</button>
          <button onClick={create} disabled={saving} style={{
            padding: "10px 22px", fontSize: 13, fontWeight: 500,
            background: "var(--accent)", color: "white",
            border: "none", borderRadius: 8, cursor: "pointer",
            opacity: saving ? 0.6 : 1,
          }}>{saving ? "Создание..." : "Создать и открыть"}</button>
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
    padding: "4px 9px", fontSize: 12, marginRight: 4,
    background: "transparent", color,
    border: "1px solid var(--border-subtle)", borderRadius: 5, cursor: "pointer",
  };
}
