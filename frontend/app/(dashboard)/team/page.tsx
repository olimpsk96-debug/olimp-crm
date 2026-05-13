"use client";

import { useEffect, useState, useCallback } from "react";
import { inputStyle, btnPrimary, btnSecondary, labelStyle } from "@/lib/ui-styles";

interface Employee {
  name: string;
  email: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  enabled: number;
  last_login?: string;
  mobile_no?: string;
  olimp_roles: string[];
}

interface RoleStat {
  role: string;
  count: number;
}

const ROLE_INFO: Record<string, { color: string; modules: string }> = {
  "System Manager":          { color: "var(--accent)",  modules: "ВСЁ (директор)" },
  "Прораб":                  { color: "var(--warning)", modules: "Отчёты, ОТ-ТБ, Снабжение, Проекты (просмотр)" },
  "Инженер ОТ-ТБ":           { color: "var(--danger)",  modules: "ОТ-ТБ, Отчёты прорабов (отчёты)" },
  "Главный инженер":         { color: "#a78bfa",        modules: "Техника, ТО, ГСМ, Проекты" },
  "Сметчик":                 { color: "var(--success)", modules: "Сметы (полный), Тендеры (просмотр)" },
  "Тендерный менеджер":      { color: "var(--accent)",  modules: "Тендеры, Клиенты, Сметы (просмотр)" },
  "Снабженец":               { color: "#34d399",        modules: "Снабжение, Поставщики" },
  "Бухгалтер Олимп":         { color: "#60a5fa",        modules: "КС-2, КС-3, Cashflow, Проекты (отчёты)" },
  "Менеджер продаж Олимп":   { color: "#f472b6",        modules: "CRM, Сделки, Клиенты, Контакты" },
};

const fmtDate = (d?: string) => {
  if (!d) return "—";
  return new Date(d).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
};

// ── Edit Drawer ──────────────────────────────────────────────────────────────

function EmployeeDrawer({ emp, onClose, onSaved }: { emp: Employee | "new"; onClose: () => void; onSaved: () => void }) {
  const isNew = emp === "new";
  const [form, setForm] = useState({
    email: isNew ? "" : emp.email,
    first_name: isNew ? "" : (emp.first_name ?? ""),
    last_name: isNew ? "" : (emp.last_name ?? ""),
    mobile_no: isNew ? "" : (emp.mobile_no ?? ""),
    role: isNew ? "" : (emp.olimp_roles[0] ?? ""),
    enabled: isNew ? 1 : emp.enabled,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  async function save() {
    if (!form.email || !form.role) return;
    setSaving(true);
    await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    onSaved();
    onClose();
  }

  const roleInfo = ROLE_INFO[form.role];

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 40 }} />
      <aside style={{
        position: "fixed", top: 0, right: 0, width: 480, height: "100vh",
        background: "var(--bg-elevated)", borderLeft: "1px solid var(--border-subtle)",
        zIndex: 50, overflowY: "auto",
      }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{isNew ? "Новый сотрудник" : "Редактирование"}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", fontSize: 20 }}>✕</button>
        </div>
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Email (логин) *</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="ivanov@olimp-ural.ru"
              disabled={!isNew}
              style={{ ...inputStyle, opacity: !isNew ? 0.6 : 1 }}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Имя</label>
              <input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Фамилия</label>
              <input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Телефон</label>
            <input value={form.mobile_no} onChange={e => setForm(f => ({ ...f, mobile_no: e.target.value }))} placeholder="+7..." style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Роль *</label>
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={inputStyle}>
              <option value="">— выберите —</option>
              {Object.keys(ROLE_INFO).map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {roleInfo && (
              <div style={{ marginTop: 8, padding: 10, borderRadius: 8, background: "var(--bg-base)", borderLeft: `3px solid ${roleInfo.color}` }}>
                <p style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", margin: 0 }}>Доступ к модулям:</p>
                <p style={{ fontSize: 12.5, color: "var(--text-secondary)", margin: "4px 0 0" }}>{roleInfo.modules}</p>
              </div>
            )}
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
            <input type="checkbox" checked={!!form.enabled} onChange={e => setForm(f => ({ ...f, enabled: e.target.checked ? 1 : 0 }))} />
            <span>Активен (может входить в систему)</span>
          </label>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={save} disabled={saving || !form.email || !form.role} style={{ ...btnPrimary, opacity: saving || !form.email || !form.role ? 0.6 : 1 }}>
              {saving ? "Сохранение..." : isNew ? "Создать" : "Сохранить"}
            </button>
            <button onClick={onClose} style={btnSecondary}>Отмена</button>
          </div>
          {isNew && (
            <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
              Пароль можно установить в Frappe-админке — пользователю придёт письмо для входа.
            </p>
          )}
        </div>
      </aside>
    </>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stats, setStats] = useState<RoleStat[]>([]);
  const [editing, setEditing] = useState<Employee | "new" | null>(null);

  const load = useCallback(async () => {
    const [eRes, sRes] = await Promise.all([
      fetch("/api/team"),
      fetch("/api/team/stats"),
    ]);
    setEmployees(await eRes.json());
    setStats(await sRes.json());
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleEmployee(email: string, enabled: number) {
    await fetch("/api/team/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, enabled: enabled ? 0 : 1 }),
    });
    load();
  }

  const totalActive = employees.filter(e => e.enabled).length;

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Сотрудники</h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>
            Активных: {totalActive} · Каждой роли — свои модули в системе
          </p>
        </div>
        <button onClick={() => setEditing("new")} style={btnPrimary}>+ Добавить сотрудника</button>
      </div>

      {/* Role stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 24 }}>
        {stats.map(s => {
          const info = ROLE_INFO[s.role];
          if (!info) return null;
          return (
            <div key={s.role} style={{
              background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
              borderLeft: `3px solid ${info.color}`, borderRadius: 10, padding: "12px 14px",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>{s.role}</p>
                <span style={{ fontSize: 18, fontWeight: 700, color: info.color, fontFamily: "monospace" }}>{s.count}</span>
              </div>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: "4px 0 0", lineHeight: 1.4 }}>{info.modules}</p>
            </div>
          );
        })}
      </div>

      {/* Employees table */}
      <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              {["Сотрудник", "Email", "Телефон", "Роль", "Последний вход", "Статус"].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 48, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
                  Сотрудников пока нет. Добавьте первого, чтобы начать.
                </td>
              </tr>
            ) : employees.map((e, i) => {
              const role = e.olimp_roles[0];
              const info = role ? ROLE_INFO[role] : null;
              return (
                <tr
                  key={e.email}
                  style={{
                    borderBottom: i < employees.length - 1 ? "1px solid var(--border-subtle)" : "none",
                    cursor: "pointer",
                    opacity: e.enabled ? 1 : 0.5,
                  }}
                  onClick={() => setEditing(e)}
                  onMouseEnter={ev => (ev.currentTarget.style.background = "rgba(249,115,22,0.04)")}
                  onMouseLeave={ev => (ev.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "11px 14px" }}>
                    <p style={{ fontSize: 13.5, fontWeight: 600, margin: 0 }}>{e.full_name || e.email}</p>
                  </td>
                  <td style={{ padding: "11px 14px", fontSize: 12.5, color: "var(--text-secondary)", fontFamily: "monospace" }}>{e.email}</td>
                  <td style={{ padding: "11px 14px", fontSize: 12.5, color: "var(--text-secondary)" }}>{e.mobile_no || "—"}</td>
                  <td style={{ padding: "11px 14px" }}>
                    {role && info && (
                      <span style={{
                        fontSize: 11, padding: "3px 10px", borderRadius: 10,
                        background: `color-mix(in srgb, ${info.color} 15%, transparent)`,
                        color: info.color, fontWeight: 600,
                      }}>
                        {role}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "11px 14px", fontSize: 11.5, color: "var(--text-tertiary)" }}>{fmtDate(e.last_login)}</td>
                  <td style={{ padding: "11px 14px" }} onClick={ev => ev.stopPropagation()}>
                    <button onClick={() => toggleEmployee(e.email, e.enabled)} style={{
                      padding: "3px 10px", borderRadius: 10, fontSize: 11, cursor: "pointer",
                      border: "1px solid currentColor",
                      background: "none",
                      color: e.enabled ? "var(--success)" : "var(--text-tertiary)",
                      fontWeight: 600,
                    }}>
                      {e.enabled ? "Активен" : "Отключён"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Info block */}
      <div style={{ marginTop: 24, padding: "14px 18px", background: "rgba(249,115,22,0.05)", borderRadius: 10, border: "1px solid rgba(249,115,22,0.2)" }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", margin: 0 }}>💡 Как работают роли</p>
        <p style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 6, lineHeight: 1.55 }}>
          Каждая роль даёт сотруднику доступ только к нужным модулям. Прораб создаёт отчёты, но не видит цены поставщиков.
          Бухгалтер работает с КС-2, но не редактирует тендеры. Установка пароля — через Frappe Desk: <span style={{ fontFamily: "monospace" }}>erp.olimp-ural.ru</span> → Users.
        </p>
      </div>

      {editing && <EmployeeDrawer emp={editing} onClose={() => setEditing(null)} onSaved={load} />}
    </div>
  );
}
