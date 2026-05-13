"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { CrmClient, ClientDetail, Interaction, InteractionType, CrmContact } from "@/types/crm";
import {
  inputStyle,
  btnPrimary,
  btnSecondary,
  labelStyle,
  backdropStyle,
  drawerStyle,
  drawerHeaderStyle,
  closeBtn,
  listItemStyle,
  emptyStyle,
  addBtn,
  formCard,
} from "@/lib/ui-styles";

const fmtM = (v?: number) => {
  if (!v) return "—";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} млн ₽`;
  if (v >= 1000) return `${Math.round(v / 1000)} тыс. ₽`;
  return `${v} ₽`;
};

const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" });
};

const INTERACTION_ICONS: Record<InteractionType, string> = {
  "Звонок": "📞",
  "Встреча": "🤝",
  "Письмо": "✉️",
  "Тендер": "📋",
  "Прочее": "💬",
};

// ── Client Create/Edit Drawer ────────────────────────────────────────────────

function ClientCreateDrawer({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    customer_name: "",
    customer_group: "",
    territory: "",
    website: "",
    mobile_no: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  async function save() {
    if (!form.customer_name) return;
    setSaving(true);
    await fetch("/api/crm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <>
      <div onClick={onClose} style={backdropStyle} />
      <aside style={{ ...drawerStyle, width: 440 }}>
        <div style={drawerHeaderStyle}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>Новый клиент</h2>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Название организации *">
            <input autoFocus value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="ООО Альфа-Строй" style={inputStyle} />
          </Field>
          <Field label="Сайт">
            <input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="alfastroy.ru" style={inputStyle} />
          </Field>
          <Field label="Телефон">
            <input value={form.mobile_no} onChange={e => setForm(f => ({ ...f, mobile_no: e.target.value }))} placeholder="+7 (343) ..." style={inputStyle} />
          </Field>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={save} disabled={saving || !form.customer_name} style={{ ...btnPrimary, opacity: saving || !form.customer_name ? 0.6 : 1 }}>
              {saving ? "Сохранение..." : "Создать"}
            </button>
            <button onClick={onClose} style={btnSecondary}>Отмена</button>
          </div>
        </div>
      </aside>
    </>
  );
}

// ── Client Drawer ────────────────────────────────────────────────────────────

function ClientDrawer({ client, onClose, onReload }: { client: CrmClient; onClose: () => void; onReload: () => void }) {
  const [detail, setDetail] = useState<ClientDetail | null>(null);
  const [tab, setTab] = useState<"interactions" | "contacts" | "tenders" | "ks2" | "deals">("interactions");
  const [showAddInt, setShowAddInt] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [saving, setSaving] = useState(false);

  const [intForm, setIntForm] = useState({
    interaction_type: "Звонок" as InteractionType,
    date: new Date().toISOString().slice(0, 10),
    contact_name: "",
    summary: "",
    result: "",
    next_action: "",
    next_action_date: "",
  });

  const [contactForm, setContactForm] = useState({
    first_name: "",
    last_name: "",
    designation: "",
    mobile_no: "",
    email_id: "",
  });

  const load = useCallback(async () => {
    const res = await fetch(`/api/crm/client?name=${encodeURIComponent(client.name)}`);
    setDetail(await res.json());
  }, [client.name]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function saveInteraction() {
    setSaving(true);
    await fetch("/api/crm/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...intForm, customer: client.name }),
    });
    setSaving(false);
    setShowAddInt(false);
    setIntForm({ interaction_type: "Звонок", date: new Date().toISOString().slice(0, 10), contact_name: "", summary: "", result: "", next_action: "", next_action_date: "" });
    load();
    onReload();
  }

  async function saveContact() {
    if (!contactForm.first_name) return;
    setSaving(true);
    await fetch("/api/crm/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...contactForm, customer: client.name }),
    });
    setSaving(false);
    setShowAddContact(false);
    setContactForm({ first_name: "", last_name: "", designation: "", mobile_no: "", email_id: "" });
    load();
  }

  async function deleteContact(name: string) {
    if (!confirm("Удалить контакт?")) return;
    await fetch(`/api/crm/contacts?name=${encodeURIComponent(name)}`, { method: "DELETE" });
    load();
  }

  const tabs = [
    { id: "interactions" as const, label: "История", count: detail?.interactions.length },
    { id: "contacts" as const, label: "Контакты", count: detail?.contacts.length },
    { id: "tenders" as const, label: "Тендеры", count: detail?.tenders.length },
    { id: "ks2" as const, label: "КС-2", count: detail?.ks2_acts.length },
    { id: "deals" as const, label: "Сделки", count: detail?.deals.length },
  ];

  return (
    <>
      <div onClick={onClose} style={backdropStyle} />
      <aside style={{ ...drawerStyle, width: 580 }}>
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{client.customer_name}</p>
              <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>{client.name}</p>
            </div>
            <button onClick={onClose} style={closeBtn}>✕</button>
          </div>

          {/* Quick stats */}
          <div style={{ display: "flex", gap: 20, marginTop: 14 }}>
            {[
              { label: "КС-2 подписано", value: fmtM(client.ks2_total) },
              { label: "Тендеров активных", value: String(client.tenders_active) },
              { label: "Активных сделок", value: String(client.deals_active) },
            ].map(s => (
              <div key={s.label}>
                <p style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>{s.label}</p>
                <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginTop: 2 }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border-subtle)", padding: "0 24px", overflowX: "auto" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "10px 14px 8px", fontSize: 13,
              borderBottom: tab === t.id ? "2px solid var(--accent)" : "2px solid transparent",
              color: tab === t.id ? "var(--accent)" : "var(--text-secondary)",
              fontWeight: tab === t.id ? 600 : 400,
              whiteSpace: "nowrap",
            }}>
              {t.label} {t.count !== undefined && t.count > 0 && (
                <span style={{ marginLeft: 4, background: "var(--border-subtle)", borderRadius: 10, padding: "1px 6px", fontSize: 11 }}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: "16px 24px", overflowY: "auto" }}>

          {/* INTERACTIONS */}
          {tab === "interactions" && (
            <div>
              <button onClick={() => setShowAddInt(v => !v)} style={addBtn}>
                + Добавить взаимодействие
              </button>

              {showAddInt && (
                <div style={formCard}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={labelStyle}>Тип</label>
                      <select value={intForm.interaction_type} onChange={e => setIntForm(f => ({ ...f, interaction_type: e.target.value as InteractionType }))} style={inputStyle}>
                        {["Звонок", "Встреча", "Письмо", "Тендер", "Прочее"].map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Дата</label>
                      <input type="date" value={intForm.date} onChange={e => setIntForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={labelStyle}>Контактное лицо</label>
                    <input value={intForm.contact_name} onChange={e => setIntForm(f => ({ ...f, contact_name: e.target.value }))} placeholder="Иванов А.В." style={inputStyle} />
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={labelStyle}>Содержание *</label>
                    <textarea value={intForm.summary} onChange={e => setIntForm(f => ({ ...f, summary: e.target.value }))} rows={3} placeholder="О чём говорили..." style={{ ...inputStyle, resize: "vertical" }} />
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={labelStyle}>Результат / договорённости</label>
                    <textarea value={intForm.result} onChange={e => setIntForm(f => ({ ...f, result: e.target.value }))} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                    <div>
                      <label style={labelStyle}>Следующий шаг</label>
                      <input value={intForm.next_action} onChange={e => setIntForm(f => ({ ...f, next_action: e.target.value }))} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Дата шага</label>
                      <input type="date" value={intForm.next_action_date} onChange={e => setIntForm(f => ({ ...f, next_action_date: e.target.value }))} style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={saveInteraction} disabled={saving || !intForm.summary} style={{ ...btnPrimary, opacity: saving || !intForm.summary ? 0.6 : 1 }}>
                      {saving ? "Сохранение..." : "Сохранить"}
                    </button>
                    <button onClick={() => setShowAddInt(false)} style={btnSecondary}>Отмена</button>
                  </div>
                </div>
              )}

              {!detail ? (
                <p style={emptyStyle}>Загрузка...</p>
              ) : detail.interactions.length === 0 ? (
                <p style={emptyStyle}>Нет взаимодействий</p>
              ) : (
                detail.interactions.map(int => (
                  <div key={int.name} style={{ borderLeft: "3px solid var(--border-subtle)", paddingLeft: 14, marginBottom: 16 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 13 }}>{INTERACTION_ICONS[int.interaction_type] ?? "💬"}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{int.interaction_type}</span>
                      <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{fmtDate(int.date)}</span>
                      {int.contact_name && <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>· {int.contact_name}</span>}
                    </div>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: int.result ? 4 : 0 }}>{int.summary}</p>
                    {int.result && <p style={{ fontSize: 12, color: "var(--success)", fontStyle: "italic" }}>✓ {int.result}</p>}
                    {int.next_action && (
                      <p style={{ fontSize: 12, color: "var(--warning)", marginTop: 4 }}>
                        → {int.next_action}{int.next_action_date ? ` (до ${fmtDate(int.next_action_date)})` : ""}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* CONTACTS */}
          {tab === "contacts" && (
            <div>
              <button onClick={() => setShowAddContact(v => !v)} style={addBtn}>+ Добавить контакт</button>

              {showAddContact && (
                <div style={formCard}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={labelStyle}>Имя *</label>
                      <input value={contactForm.first_name} onChange={e => setContactForm(f => ({ ...f, first_name: e.target.value }))} placeholder="Алексей" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Фамилия</label>
                      <input value={contactForm.last_name} onChange={e => setContactForm(f => ({ ...f, last_name: e.target.value }))} placeholder="Петров" style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={labelStyle}>Должность</label>
                    <input value={contactForm.designation} onChange={e => setContactForm(f => ({ ...f, designation: e.target.value }))} placeholder="Главный инженер" style={inputStyle} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                    <div>
                      <label style={labelStyle}>Телефон</label>
                      <input value={contactForm.mobile_no} onChange={e => setContactForm(f => ({ ...f, mobile_no: e.target.value }))} placeholder="+7..." style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Email</label>
                      <input value={contactForm.email_id} onChange={e => setContactForm(f => ({ ...f, email_id: e.target.value }))} placeholder="@" style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={saveContact} disabled={saving || !contactForm.first_name} style={{ ...btnPrimary, opacity: saving || !contactForm.first_name ? 0.6 : 1 }}>
                      {saving ? "Сохранение..." : "Сохранить"}
                    </button>
                    <button onClick={() => setShowAddContact(false)} style={btnSecondary}>Отмена</button>
                  </div>
                </div>
              )}

              {!detail ? <p style={emptyStyle}>Загрузка...</p>
                : detail.contacts.length === 0 ? <p style={emptyStyle}>Нет контактов</p>
                : detail.contacts.map((c: CrmContact) => (
                  <div key={c.name} style={listItemStyle}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{c.full_name || "—"}</p>
                        {c.designation && <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: "2px 0 0" }}>{c.designation}</p>}
                        <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
                          {c.mobile_no && (
                            <a href={`tel:${c.mobile_no}`} style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none" }}>📞 {c.mobile_no}</a>
                          )}
                          {c.email_id && (
                            <a href={`mailto:${c.email_id}`} style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none" }}>✉ {c.email_id}</a>
                          )}
                        </div>
                      </div>
                      <button onClick={() => deleteContact(c.name)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 14 }}>✕</button>
                    </div>
                  </div>
                ))
              }
            </div>
          )}

          {/* TENDERS */}
          {tab === "tenders" && (
            <div>
              {!detail ? <p style={emptyStyle}>Загрузка...</p>
                : detail.tenders.length === 0 ? <p style={emptyStyle}>Нет тендеров</p>
                : detail.tenders.map(t => (
                  <div key={t.name} style={listItemStyle}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>{t.title || t.name}</p>
                        <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                          {t.status}{t.deadline_date ? ` · до ${fmtDate(t.deadline_date)}` : ""}
                        </p>
                      </div>
                      {t.nmck && <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{fmtM(t.nmck)}</p>}
                    </div>
                  </div>
                ))
              }
            </div>
          )}

          {/* KS2 */}
          {tab === "ks2" && (
            <div>
              {!detail ? <p style={emptyStyle}>Загрузка...</p>
                : detail.ks2_acts.length === 0 ? <p style={emptyStyle}>Нет актов КС-2</p>
                : detail.ks2_acts.map(a => (
                  <div key={a.name} style={listItemStyle}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>{a.title || a.name}</p>
                        <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                          {a.status} · Оплата: {a.payment_status}
                        </p>
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{fmtM(a.amount)}</p>
                    </div>
                  </div>
                ))
              }
            </div>
          )}

          {/* DEALS */}
          {tab === "deals" && (
            <div>
              {!detail ? <p style={emptyStyle}>Загрузка...</p>
                : detail.deals.length === 0 ? <p style={emptyStyle}>Нет сделок</p>
                : detail.deals.map(d => (
                  <div key={d.name} style={listItemStyle}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>{d.title}</p>
                        <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                          {d.status} · {d.probability_pct}%{d.expected_close_date ? ` · до ${fmtDate(d.expected_close_date)}` : ""}
                        </p>
                      </div>
                      {d.amount_estimated && <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{fmtM(d.amount_estimated)}</p>}
                    </div>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

// ── Helper components ────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const [clients, setClients] = useState<CrmClient[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CrmClient | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [stats, setStats] = useState<{ total_clients: number; active_deals: number; pipeline_amount: number; interactions_week: number } | null>(null);

  const load = useCallback(async () => {
    const [cRes, sRes] = await Promise.all([
      fetch(`/api/crm?search=${encodeURIComponent(search)}`),
      fetch("/api/crm/stats"),
    ]);
    setClients(await cRes.json());
    setStats(await sRes.json());
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const filtered = clients.filter(c =>
    !search || c.customer_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Клиенты</h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>База заказчиков и история взаимодействий</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/deals" style={{ ...btnSecondary, textDecoration: "none", display: "inline-block" }}>Воронка сделок →</Link>
          <button onClick={() => setShowCreate(true)} style={btnPrimary}>+ Новый клиент</button>
        </div>
      </div>

      {/* Stats bar */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Клиентов всего", value: stats.total_clients },
            { label: "Активных сделок", value: stats.active_deals },
            { label: "Воронка", value: fmtM(stats.pipeline_amount) },
            { label: "Контактов за 7д", value: stats.interactions_week },
          ].map(s => (
            <div key={s.label} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "14px 16px" }}>
              <p style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>{s.label}</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: "4px 0 0" }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по клиенту..."
          style={{ ...inputStyle, maxWidth: 360 }}
        />
      </div>

      {/* Table */}
      <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              {["Клиент", "Тендеры (актив)", "КС-2 подписано", "Сделки", "Последний контакт"].map(h => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
                  Клиентов не найдено
                </td>
              </tr>
            ) : filtered.map((c, i) => (
              <tr
                key={c.name}
                onClick={() => setSelected(c)}
                style={{
                  borderBottom: i < filtered.length - 1 ? "1px solid var(--border-subtle)" : "none",
                  cursor: "pointer",
                  transition: "background 0.12s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(249,115,22,0.04)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <td style={{ padding: "12px 16px" }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{c.customer_name}</p>
                  <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: "2px 0 0" }}>{c.name}</p>
                </td>
                <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--text-secondary)" }}>
                  {c.tenders_count} <span style={{ color: c.tenders_active > 0 ? "var(--accent)" : "var(--text-tertiary)" }}>({c.tenders_active} акт.)</span>
                </td>
                <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: c.ks2_total > 0 ? "var(--success)" : "var(--text-tertiary)" }}>
                  {fmtM(c.ks2_total)}
                </td>
                <td style={{ padding: "12px 16px", fontSize: 13, color: c.deals_active > 0 ? "var(--text-primary)" : "var(--text-tertiary)" }}>
                  {c.deals_active > 0 ? `${c.deals_active} акт.` : "—"}
                </td>
                <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--text-tertiary)" }}>
                  {fmtDate(c.last_interaction)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && <ClientDrawer client={selected} onClose={() => setSelected(null)} onReload={load} />}
      {showCreate && <ClientCreateDrawer onClose={() => setShowCreate(false)} onSaved={load} />}
    </div>
  );
}
