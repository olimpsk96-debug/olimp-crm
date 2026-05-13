"use client";

import { useCallback, useEffect, useState } from "react";
import { ExportButton } from "@/components/shared/ExportButton";

type CertStatus = "Действует" | "Истекает скоро" | "Просрочено" | "Архив";

interface Cert {
  name: string;
  title: string;
  employee_name: string;
  employee_role?: string;
  user?: string;
  cert_type: string;
  cert_number?: string;
  issuing_organization?: string;
  issue_date?: string;
  expiry_date?: string;
  status: CertStatus;
  days_to_expiry: number | null;
  notes?: string;
}

interface Stats {
  total: number;
  valid: number;
  expiring: number;
  expired: number;
  expiring_soon: { name: string; title: string; employee_name: string; cert_type: string; expiry_date: string; days_to_expiry: number | null }[];
}

const CERT_TYPES = [
  "Работы на высоте", "Электробезопасность (1 группа)", "Электробезопасность (2 группа)",
  "Электробезопасность (3 группа)", "Электробезопасность (4 группа)", "Электробезопасность (5 группа)",
  "Промальпинизм", "Сварочные работы", "Газоопасные работы", "Огневые работы",
  "Промбезопасность", "Охрана труда", "Первая помощь", "Пожарно-технический минимум",
  "Крановщик", "Стропальщик", "Допуск к управлению техникой", "Медосмотр", "Прочее",
];

const STATUS_COLOR: Record<CertStatus, { bg: string; color: string }> = {
  "Действует":      { bg: "rgba(34,197,94,0.15)", color: "var(--success)" },
  "Истекает скоро": { bg: "rgba(251,191,36,0.15)", color: "var(--warning)" },
  "Просрочено":     { bg: "rgba(239,68,68,0.15)", color: "var(--danger)" },
  "Архив":          { bg: "rgba(120,120,160,0.15)", color: "var(--text-tertiary)" },
};

function fmtDate(s?: string) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" });
}

export default function CertificationsPage() {
  const [list, setList] = useState<Cert[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    const p = new URLSearchParams();
    if (statusFilter) p.set("status", statusFilter);
    const [data, st] = await Promise.all([
      fetch(`/api/certifications?${p}`).then(r => r.json()),
      fetch(`/api/certifications/stats`).then(r => r.json()),
    ]);
    setList(Array.isArray(data) ? data : []);
    setStats(st && "total" in st ? st : null);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ padding: 32, maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>Аттестации сотрудников</h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: "4px 0 0" }}>
            Удостоверения работников: работы на высоте, электробезопасность, медосмотр и т.п.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <ExportButton spec="certifications" />
          <button onClick={() => setShowCreate(true)} style={{
            padding: "9px 16px", borderRadius: 10, border: "none",
            background: "var(--accent)", color: "white",
            fontWeight: 500, fontSize: 13, cursor: "pointer",
          }}>+ Новая аттестация</button>
        </div>
      </div>

      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
          <KpiButton label="Всего активных" value={stats.total} onClick={() => setStatusFilter("")} active={!statusFilter} />
          <KpiButton label="Действуют" value={stats.valid} accent="var(--success)" onClick={() => setStatusFilter("Действует")} active={statusFilter === "Действует"} />
          <KpiButton label="Истекают скоро" value={stats.expiring} accent="var(--warning)" onClick={() => setStatusFilter("Истекает скоро")} active={statusFilter === "Истекает скоро"} />
          <KpiButton label="Просрочено" value={stats.expired} accent="var(--danger)" onClick={() => setStatusFilter("Просрочено")} active={statusFilter === "Просрочено"} />
        </div>
      )}

      {stats?.expiring_soon && stats.expiring_soon.length > 0 && !statusFilter && (
        <div style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 12, padding: "12px 18px", marginBottom: 16 }}>
          <p style={{ fontSize: 11, color: "var(--warning)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px", fontFamily: "monospace" }}>⚠️ Ближайшие истечения</p>
          {stats.expiring_soon.map(e => (
            <div key={e.name} style={{ fontSize: 13, padding: "3px 0", display: "flex", justifyContent: "space-between" }}>
              <span><b>{e.employee_name}</b> — {e.cert_type}</span>
              <span style={{ color: (e.days_to_expiry ?? 100) <= 7 ? "var(--danger)" : "var(--warning)", fontFamily: "monospace" }}>
                {e.days_to_expiry !== null ? `через ${e.days_to_expiry}д (${fmtDate(e.expiry_date)})` : fmtDate(e.expiry_date)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div style={{ background: "var(--bg-elevated)", borderRadius: 12, border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "var(--bg-base)" }}>
            <tr>
              <th style={th}>ФИО</th>
              <th style={th}>Должность</th>
              <th style={th}>Тип аттестации</th>
              <th style={th}>№</th>
              <th style={th}>Выдано</th>
              <th style={th}>Действует до</th>
              <th style={th}>Статус</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>
                Аттестаций {statusFilter ? `со статусом «${statusFilter}»` : ""} нет
              </td></tr>
            )}
            {list.map(c => {
              const st = STATUS_COLOR[c.status];
              return (
                <tr key={c.name} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                  <td style={{ ...td, fontWeight: 500 }}>{c.employee_name}</td>
                  <td style={{ ...td, fontSize: 12, color: "var(--text-secondary)" }}>{c.employee_role || "—"}</td>
                  <td style={td}>{c.cert_type}</td>
                  <td style={{ ...td, fontFamily: "monospace", fontSize: 11, color: "var(--text-tertiary)" }}>{c.cert_number || "—"}</td>
                  <td style={{ ...td, fontSize: 12, color: "var(--text-tertiary)" }}>{fmtDate(c.issue_date)}</td>
                  <td style={{ ...td, fontSize: 12, fontFamily: "monospace", color: c.days_to_expiry !== null && c.days_to_expiry < 0 ? "var(--danger)" : c.days_to_expiry !== null && c.days_to_expiry <= 30 ? "var(--warning)" : "var(--text-primary)" }}>
                    {fmtDate(c.expiry_date)}
                    {c.days_to_expiry !== null && c.days_to_expiry >= 0 && <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>через {c.days_to_expiry}д</div>}
                    {c.days_to_expiry !== null && c.days_to_expiry < 0 && <div style={{ fontSize: 10, color: "var(--danger)" }}>просроч. {Math.abs(c.days_to_expiry)}д</div>}
                  </td>
                  <td style={td}>
                    <span style={{ padding: "3px 10px", borderRadius: 8, background: st.bg, color: st.color, fontSize: 11, fontWeight: 600 }}>
                      {c.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateDrawer onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}

function KpiButton({ label, value, accent, onClick, active }: { label: string; value: number; accent?: string; onClick: () => void; active: boolean }) {
  return (
    <button onClick={onClick} style={{
      background: active ? `${accent ?? "var(--accent)"}20` : "var(--bg-elevated)",
      border: `1px solid ${active ? (accent ?? "var(--accent)") : "var(--border-subtle)"}`,
      borderRadius: 12, padding: "14px 18px", textAlign: "left", cursor: "pointer", outline: "none",
    }}>
      <p style={{ fontSize: 10.5, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0, fontFamily: "monospace" }}>{label}</p>
      <p style={{ fontSize: 24, fontWeight: 600, color: accent ?? "var(--text-primary)", margin: "6px 0 0", fontFamily: "monospace" }}>{value}</p>
    </button>
  );
}

function CreateDrawer({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    employee_name: "",
    employee_role: "",
    cert_type: "Работы на высоте",
    cert_number: "",
    issuing_organization: "",
    issue_date: "",
    expiry_date: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.employee_name.trim() || !form.cert_type || !form.expiry_date) return;
    setSaving(true);
    try {
      const title = `${form.employee_name} — ${form.cert_type}`;
      await fetch("/api/certifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, title }),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div onClick={onClose} style={backdropStyle} />
      <aside style={{ ...drawerStyle, width: 540 }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>Новая аттестация</h2>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>
        <div style={{ padding: 24, flex: 1, overflowY: "auto" }}>
          <Field label="ФИО сотрудника *">
            <input value={form.employee_name} onChange={(e) => setForm({ ...form, employee_name: e.target.value })} placeholder="Иванов И.И." style={inputStyle} />
          </Field>
          <Field label="Должность">
            <input value={form.employee_role} onChange={(e) => setForm({ ...form, employee_role: e.target.value })} placeholder="Прораб" style={inputStyle} />
          </Field>
          <Field label="Тип аттестации *">
            <select value={form.cert_type} onChange={(e) => setForm({ ...form, cert_type: e.target.value })} style={inputStyle}>
              {CERT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="№ удостоверения">
            <input value={form.cert_number} onChange={(e) => setForm({ ...form, cert_number: e.target.value })} placeholder="№ 12345-2024" style={inputStyle} />
          </Field>
          <Field label="Кем выдано">
            <input value={form.issuing_organization} onChange={(e) => setForm({ ...form, issuing_organization: e.target.value })} placeholder="УЦ «Профстандарт»" style={inputStyle} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Дата выдачи">
              <input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} style={inputStyle} />
            </Field>
            <Field label="Действует до *">
              <input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} style={inputStyle} />
            </Field>
          </div>
          <Field label="Примечание">
            <textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical" }} />
          </Field>
        </div>
        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border-subtle)", display: "flex", gap: 8 }}>
          <button onClick={onClose} style={btnSecondary}>Отмена</button>
          <button onClick={handleSave} disabled={saving || !form.employee_name.trim() || !form.expiry_date} style={{
            ...btnPrimary, opacity: (saving || !form.employee_name.trim() || !form.expiry_date) ? 0.5 : 1,
          }}>{saving ? "Сохранение..." : "Создать"}</button>
        </div>
      </aside>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 12 }}>
    <label style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4, fontFamily: "monospace" }}>{label}</label>
    {children}
  </div>;
}

const th: React.CSSProperties = { padding: "11px 12px", textAlign: "left", fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "monospace", fontWeight: 500 };
const td: React.CSSProperties = { padding: "10px 12px" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 10px", background: "var(--bg-base)", border: "1px solid var(--border-subtle)", borderRadius: 8, color: "var(--text-primary)", fontSize: 13, outline: "none" };
const backdropStyle: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 40, backdropFilter: "blur(2px)" };
const drawerStyle: React.CSSProperties = { position: "fixed", top: 0, right: 0, bottom: 0, background: "var(--bg-elevated)", borderLeft: "1px solid var(--border-subtle)", zIndex: 50, display: "flex", flexDirection: "column", overflow: "hidden" };
const closeBtn: React.CSSProperties = { width: 28, height: 28, borderRadius: 8, border: "1px solid var(--border-subtle)", background: "transparent", color: "var(--text-tertiary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 };
const btnSecondary: React.CSSProperties = { padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer" };
const btnPrimary: React.CSSProperties = { padding: "8px 14px", borderRadius: 8, border: "none", background: "var(--accent)", color: "white", fontSize: 13, cursor: "pointer", fontWeight: 500, flex: 1 };
