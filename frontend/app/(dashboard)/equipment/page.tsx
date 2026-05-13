"use client";

import { useEffect, useState } from "react";
import type {
  Equipment, EquipmentDetail, EquipmentStats,
  EquipmentStatus, EquipmentCategory, MaintenanceType,
} from "@/types/equipment";

const STATUS_COLOR: Record<EquipmentStatus, string> = {
  "Доступна":   "var(--success)",
  "На объекте": "var(--accent)",
  "На ТО":      "var(--warning)",
  "В ремонте":  "var(--danger)",
  "Списана":    "var(--text-tertiary)",
};

const CATEGORIES: EquipmentCategory[] = [
  "Подъёмники", "АКЗ оборудование", "Бетонные работы",
  "Сварочное", "Промальп", "Грузовая техника", "Прочее",
];

const STATUSES: EquipmentStatus[] = ["Доступна", "На объекте", "На ТО", "В ремонте", "Списана"];

function fmt(v?: number | null) {
  if (v == null) return "—";
  return v.toLocaleString("ru-RU", { maximumFractionDigits: 0 });
}
function fmtMln(v?: number | null) {
  if (!v) return "—";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)} млн ₽`;
  return `${(v / 1000).toFixed(0)} тыс. ₽`;
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "7px 10px", borderRadius: 8,
  border: "1px solid var(--border-subtle)", background: "var(--bg-base)",
  color: "var(--text-primary)", fontSize: 12.5, outline: "none", boxSizing: "border-box",
};
function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <label style={{ display: "block", fontSize: 10.5, color: "var(--text-tertiary)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace" }}>
      {text}{required && <span style={{ color: "var(--danger)", marginLeft: 3 }}>*</span>}
    </label>
  );
}

// ─── Detail Drawer ────────────────────────────────────────────────────────────
function EquipmentDrawer({
  name, onClose, onStatusChange,
}: {
  name: string | null;
  onClose: () => void;
  onStatusChange: (name: string, s: EquipmentStatus) => void;
}) {
  const [eq, setEq] = useState<EquipmentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"info" | "maintenance" | "fuel">("info");
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [showFuelForm, setShowFuelForm] = useState(false);
  const [mType, setMType] = useState<MaintenanceType>("Плановое ТО");
  const [mDate, setMDate] = useState(new Date().toISOString().slice(0, 10));
  const [mBy, setMBy] = useState("");
  const [mDesc, setMDesc] = useState("");
  const [mLabor, setMLabor] = useState("");
  const [mParts, setMParts] = useState("");
  const [mNext, setMNext] = useState("");
  const [fLiters, setFLiters] = useState("");
  const [fPrice, setFPrice] = useState("");
  const [fBy, setFBy] = useState("");
  const [fDate, setFDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!name) { setEq(null); return; }
    setLoading(true); setTab("info");
    fetch(`/api/equipment/${encodeURIComponent(name)}`).then((r) => r.json()).then(setEq).finally(() => setLoading(false));
  }, [name]);

  async function handleStatus(s: EquipmentStatus) {
    if (!eq) return;
    await fetch(`/api/equipment/${encodeURIComponent(eq.name)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: s }) });
    setEq((e) => e ? { ...e, status: s } : e);
    onStatusChange(eq.name, s);
  }

  async function submitMaintenance(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      await fetch("/api/equipment/maintenance", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equipment: eq!.name, maintenance_type: mType, maintenance_date: mDate, performed_by: mBy || undefined, description: mDesc || undefined, cost_labor: mLabor ? parseFloat(mLabor) : undefined, cost_parts: mParts ? parseFloat(mParts) : undefined, next_maintenance_date: mNext || undefined }),
      });
      const updated = await fetch(`/api/equipment/${encodeURIComponent(eq!.name)}`).then((r) => r.json());
      setEq(updated); setShowMaintenanceForm(false);
      setMDesc(""); setMLabor(""); setMParts(""); setMNext(""); setMBy("");
    } finally { setSaving(false); }
  }

  async function submitFuel(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      await fetch("/api/equipment/fuel", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equipment: eq!.name, fuel_date: fDate, liters: parseFloat(fLiters), price_per_liter: fPrice ? parseFloat(fPrice) : undefined, filled_by: fBy || undefined }),
      });
      const updated = await fetch(`/api/equipment/${encodeURIComponent(eq!.name)}`).then((r) => r.json());
      setEq(updated); setShowFuelForm(false);
      setFLiters(""); setFPrice(""); setFBy("");
    } finally { setSaving(false); }
  }

  const isOpen = !!name;
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.45)", opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? "auto" : "none", transition: "opacity 0.25s ease", backdropFilter: "blur(2px)" }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 600, zIndex: 50, background: "var(--bg-elevated)", borderLeft: "1px solid var(--border-subtle)", transform: isOpen ? "translateX(0)" : "translateX(100%)", transition: "transform 0.3s cubic-bezier(0.16,1,0.3,1)", display: "flex", flexDirection: "column", overflowY: "auto" }}>
        {/* Header */}
        <div style={{ padding: "20px 24px 14px", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              {loading ? <div style={{ height: 20, width: "60%", borderRadius: 6, background: "var(--border-subtle)" }} /> : (
                <h2 style={{ fontSize: 16, fontWeight: 500 }}>{eq?.equipment_name ?? "—"}</h2>
              )}
              {eq && <p style={{ fontSize: 11.5, color: "var(--text-tertiary)", fontFamily: "monospace", marginTop: 2 }}>{eq.name} · {eq.category}</p>}
            </div>
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid var(--border-subtle)", background: "transparent", color: "var(--text-tertiary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3l10 10M13 3L3 13" /></svg>
            </button>
          </div>
          {eq && (
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Статус:</span>
              <select value={eq.status} onChange={(e) => handleStatus(e.target.value as EquipmentStatus)}
                style={{ fontSize: 12, padding: "3px 8px", borderRadius: 7, border: `1px solid ${STATUS_COLOR[eq.status]}`, background: "transparent", color: STATUS_COLOR[eq.status], cursor: "pointer", outline: "none" }}>
                {STATUSES.map((s) => <option key={s} value={s} style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>{s}</option>)}
              </select>
              {eq.maintenance_days_left != null && eq.maintenance_days_left <= 7 && (
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "rgba(251,191,36,0.12)", color: "var(--warning)", border: "1px solid rgba(251,191,36,0.3)" }}>
                  ТО {eq.maintenance_days_left < 0 ? `просрочено ${Math.abs(eq.maintenance_days_left)}д` : eq.maintenance_days_left === 0 ? "сегодня!" : `через ${eq.maintenance_days_left}д`}
                </span>
              )}
            </div>
          )}
          {eq && (
            <div style={{ display: "flex", gap: 0, marginTop: 14, borderTop: "1px solid var(--border-subtle)", paddingTop: 0 }}>
              {(["info", "maintenance", "fuel"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  style={{ flex: 1, padding: "10px 0", background: "none", border: "none", borderBottom: `2px solid ${tab === t ? "var(--accent)" : "transparent"}`, color: tab === t ? "var(--accent)" : "var(--text-tertiary)", fontSize: 12.5, cursor: "pointer", transition: "all 0.15s" }}>
                  {t === "info" ? "Сведения" : t === "maintenance" ? `ТО (${eq.maintenance_logs.length})` : "ГСМ"}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading && <div style={{ padding: 24, color: "var(--text-tertiary)", fontSize: 13 }}>Загрузка...</div>}

        {eq && !loading && tab === "info" && (
          <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 0 }}>
            <InfoRow label="Местонахождение" value={eq.current_location} />
            <InfoRow label="Ответственный" value={eq.responsible_person} />
            <InfoRow label="Проект" value={eq.project} />
            <InfoRow label="Год выпуска" value={eq.year_of_manufacture} />
            <InfoRow label="VIN / Гос. номер" value={eq.vin_number} />
            <InfoRow label="Инв. код" value={eq.inventory_code} />
            <InfoRow label="Стоимость покупки" value={eq.purchase_price ? fmtMln(eq.purchase_price) : undefined} />
            <InfoRow label="Ставка аренды" value={eq.rental_rate_per_day ? `${fmt(eq.rental_rate_per_day)} ₽/день` : undefined} />
            <InfoRow label="Ремонт всего" value={eq.total_maintenance_cost ? fmtMln(eq.total_maintenance_cost) : undefined} />
            <InfoRow label="Следующее ТО" value={eq.next_maintenance_date} />
            <InfoRow label="Страховка до" value={eq.insurance_expiry} />
            <InfoRow label="Поверка до" value={eq.certification_expiry} />
            <InfoRow label="СРО до" value={eq.sro_expiry} />
            <InfoRow label="Моточасы" value={eq.engine_hours ? `${fmt(eq.engine_hours)} ч` : undefined} />
            <InfoRow label="Пробег" value={eq.odometer ? `${fmt(eq.odometer)} км` : undefined} />
            {eq.notes && <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-subtle)", fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>{eq.notes}</div>}
          </div>
        )}

        {eq && !loading && tab === "maintenance" && (
          <div style={{ padding: "16px 24px" }}>
            <button onClick={() => setShowMaintenanceForm((x) => !x)}
              style={{ width: "100%", padding: "9px", borderRadius: 10, border: "1px dashed var(--border-subtle)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer", marginBottom: 14 }}>
              {showMaintenanceForm ? "Скрыть форму" : "+ Добавить запись ТО"}
            </button>
            {showMaintenanceForm && (
              <form onSubmit={submitMaintenance} style={{ display: "flex", flexDirection: "column", gap: 10, padding: "14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-subtle)", marginBottom: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div><Label text="Тип" />
                    <select value={mType} onChange={(e) => setMType(e.target.value as MaintenanceType)} style={inputStyle}>
                      {(["Плановое ТО", "Внеплановое ТО", "Ремонт", "Поверка", "СРО", "Страховка"] as MaintenanceType[]).map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div><Label text="Дата" /><input style={inputStyle} type="date" value={mDate} onChange={(e) => setMDate(e.target.value)} /></div>
                </div>
                <div><Label text="Исполнитель" /><input style={inputStyle} placeholder="ИП Петров, сервис-центр" value={mBy} onChange={(e) => setMBy(e.target.value)} /></div>
                <div><Label text="Описание" /><textarea style={{ ...inputStyle, resize: "vertical", minHeight: 48 }} placeholder="Что сделано..." value={mDesc} onChange={(e) => setMDesc(e.target.value)} /></div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <div><Label text="Работы ₽" /><input style={inputStyle} placeholder="5000" value={mLabor} onChange={(e) => setMLabor(e.target.value)} inputMode="decimal" /></div>
                  <div><Label text="Запчасти ₽" /><input style={inputStyle} placeholder="3000" value={mParts} onChange={(e) => setMParts(e.target.value)} inputMode="decimal" /></div>
                  <div><Label text="Следующее ТО" /><input style={inputStyle} type="date" value={mNext} onChange={(e) => setMNext(e.target.value)} /></div>
                </div>
                <button type="submit" disabled={saving} style={{ padding: "9px", borderRadius: 9, border: "none", background: saving ? "var(--border-subtle)" : "var(--accent)", color: "white", fontSize: 13, cursor: saving ? "wait" : "pointer" }}>
                  {saving ? "Сохранение..." : "Сохранить"}
                </button>
              </form>
            )}
            {eq.maintenance_logs.length === 0 ? (
              <p style={{ color: "var(--text-tertiary)", fontSize: 13, textAlign: "center", padding: "32px 0" }}>Записей ТО нет</p>
            ) : eq.maintenance_logs.map((m) => (
              <div key={m.name} style={{ padding: "10px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <p style={{ fontSize: 12.5, fontWeight: 500 }}>{m.maintenance_type}</p>
                    <p style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "monospace", marginTop: 2 }}>{m.maintenance_date}{m.performed_by ? ` · ${m.performed_by}` : ""}</p>
                    {m.description && <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{m.description}</p>}
                  </div>
                  {m.total_cost ? <p style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 600, color: "var(--danger)", flexShrink: 0 }}>{fmt(m.total_cost)} ₽</p> : null}
                </div>
              </div>
            ))}
          </div>
        )}

        {eq && !loading && tab === "fuel" && (
          <div style={{ padding: "16px 24px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-subtle)" }}>
                <p style={{ fontSize: 10.5, color: "var(--text-tertiary)", marginBottom: 4 }}>ГСМ за 30 дней</p>
                <p style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 600 }}>{fmt(eq.fuel_30d.liters)} л</p>
              </div>
              <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-subtle)" }}>
                <p style={{ fontSize: 10.5, color: "var(--text-tertiary)", marginBottom: 4 }}>Сумма за 30 дней</p>
                <p style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 600 }}>{fmt(eq.fuel_30d.amount)} ₽</p>
              </div>
            </div>
            <button onClick={() => setShowFuelForm((x) => !x)}
              style={{ width: "100%", padding: "9px", borderRadius: 10, border: "1px dashed var(--border-subtle)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer", marginBottom: 14 }}>
              {showFuelForm ? "Скрыть" : "+ Заправка"}
            </button>
            {showFuelForm && (
              <form onSubmit={submitFuel} style={{ display: "flex", flexDirection: "column", gap: 10, padding: "14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-subtle)", marginBottom: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <div><Label text="Дата" /><input style={inputStyle} type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} /></div>
                  <div><Label text="Литры" required /><input style={inputStyle} placeholder="45" value={fLiters} onChange={(e) => setFLiters(e.target.value)} inputMode="decimal" /></div>
                  <div><Label text="Цена / л ₽" /><input style={inputStyle} placeholder="58" value={fPrice} onChange={(e) => setFPrice(e.target.value)} inputMode="decimal" /></div>
                </div>
                <div><Label text="Заправил" /><input style={inputStyle} placeholder="Иванов А.П." value={fBy} onChange={(e) => setFBy(e.target.value)} /></div>
                <button type="submit" disabled={saving || !fLiters} style={{ padding: "9px", borderRadius: 9, border: "none", background: saving || !fLiters ? "var(--border-subtle)" : "var(--accent)", color: saving || !fLiters ? "var(--text-tertiary)" : "white", fontSize: 13, cursor: saving || !fLiters ? "default" : "pointer" }}>
                  {saving ? "Сохранение..." : `Записать${fLiters && fPrice ? ` · ${fmt(parseFloat(fLiters) * parseFloat(fPrice))} ₽` : ""}`}
                </button>
              </form>
            )}
            {eq.fuel_logs.map((f) => (
              <div key={f.name} style={{ padding: "9px 0", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontSize: 12.5 }}>{fmt(f.liters)} л{f.filled_by ? ` · ${f.filled_by}` : ""}</p>
                  <p style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "monospace", marginTop: 2 }}>{f.fuel_date}</p>
                </div>
                {f.total_amount ? <p style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>{fmt(f.total_amount)} ₽</p> : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "7px 0", borderBottom: "1px solid var(--border-subtle)" }}>
      <span style={{ fontSize: 12, color: "var(--text-tertiary)", flexShrink: 0, marginRight: 16 }}>{label}</span>
      <span style={{ fontSize: 13, textAlign: "right" }}>{value}</span>
    </div>
  );
}

// ─── Create Drawer ────────────────────────────────────────────────────────────
function EquipmentCreateDrawer({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<EquipmentCategory>("Прочее");
  const [status, setStatus] = useState<EquipmentStatus>("Доступна");
  const [location, setLocation] = useState("");
  const [responsible, setResponsible] = useState("");
  const [year, setYear] = useState("");
  const [vin, setVin] = useState("");
  const [price, setPrice] = useState("");
  const [nextMaint, setNextMaint] = useState("");
  const [insurance, setInsurance] = useState("");
  const [sro, setSro] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() { setName(""); setCategory("Прочее"); setStatus("Доступна"); setLocation(""); setResponsible(""); setYear(""); setVin(""); setPrice(""); setNextMaint(""); setInsurance(""); setSro(""); setError(null); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Укажите наименование"); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/equipment", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equipment_name: name.trim(), category, status,
          current_location: location.trim() || undefined,
          responsible_person: responsible.trim() || undefined,
          year_of_manufacture: year ? parseInt(year) : undefined,
          vin_number: vin.trim() || undefined,
          purchase_price: price ? parseFloat(price.replace(/\s/g, "")) : undefined,
          next_maintenance_date: nextMaint || undefined,
          insurance_expiry: insurance || undefined,
          sro_expiry: sro || undefined,
        }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      reset(); onClose(); onCreated();
    } catch { setError("Ошибка соединения"); }
    finally { setSaving(false); }
  }

  return (
    <>
      <div onClick={() => { reset(); onClose(); }} style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.45)", opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity 0.25s ease", backdropFilter: "blur(2px)" }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 520, zIndex: 50, background: "var(--bg-elevated)", borderLeft: "1px solid var(--border-subtle)", transform: open ? "translateX(0)" : "translateX(100%)", transition: "transform 0.3s cubic-bezier(0.16,1,0.3,1)", display: "flex", flexDirection: "column", overflowY: "auto" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div><h2 style={{ fontSize: 16, fontWeight: 500 }}>Новая техника</h2><p style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 2 }}>Добавить единицу в реестр</p></div>
            <button onClick={() => { reset(); onClose(); }} style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid var(--border-subtle)", background: "transparent", color: "var(--text-tertiary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3l10 10M13 3L3 13" /></svg>
            </button>
          </div>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 32px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div><Label text="Наименование" required /><input style={inputStyle} placeholder="Подъёмник Genie Z-45" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><Label text="Категория" />
              <select value={category} onChange={(e) => setCategory(e.target.value as EquipmentCategory)} style={inputStyle}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><Label text="Статус" />
              <select value={status} onChange={(e) => setStatus(e.target.value as EquipmentStatus)} style={{ ...inputStyle, color: STATUS_COLOR[status], borderColor: STATUS_COLOR[status] }}>
                {STATUSES.filter((s) => s !== "Списана").map((s) => <option key={s} value={s} style={{ color: "var(--text-primary)" }}>{s}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><Label text="Местонахождение" /><input style={inputStyle} placeholder="Склад / НПП Старт" value={location} onChange={(e) => setLocation(e.target.value)} /></div>
            <div><Label text="Ответственный" /><input style={inputStyle} placeholder="Иванов А.С." value={responsible} onChange={(e) => setResponsible(e.target.value)} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><Label text="Год выпуска" /><input style={inputStyle} placeholder="2019" value={year} onChange={(e) => setYear(e.target.value)} inputMode="numeric" /></div>
            <div><Label text="VIN / Гос. номер" /><input style={inputStyle} placeholder="А123ВГ / WBABC..." value={vin} onChange={(e) => setVin(e.target.value)} /></div>
          </div>
          <div><Label text="Стоимость покупки ₽" /><input style={inputStyle} placeholder="1 200 000" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div><Label text="Следующее ТО" /><input style={inputStyle} type="date" value={nextMaint} onChange={(e) => setNextMaint(e.target.value)} /></div>
            <div><Label text="Страховка до" /><input style={inputStyle} type="date" value={insurance} onChange={(e) => setInsurance(e.target.value)} /></div>
            <div><Label text="СРО до" /><input style={inputStyle} type="date" value={sro} onChange={(e) => setSro(e.target.value)} /></div>
          </div>
          {error && <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "var(--danger)", fontSize: 12.5 }}>{error}</div>}
          <button type="submit" disabled={saving} style={{ width: "100%", padding: "11px", borderRadius: 10, border: "none", background: saving ? "var(--border-subtle)" : "var(--accent)", color: saving ? "var(--text-tertiary)" : "white", fontSize: 13.5, fontWeight: 500, cursor: saving ? "wait" : "pointer" }}>
            {saving ? "Добавление..." : "Добавить технику"}
          </button>
        </form>
      </div>
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function EquipmentPage() {
  const [stats, setStats] = useState<EquipmentStats | null>(null);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerName, setDrawerName] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("");

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") { setDrawerName(null); setCreateOpen(false); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  async function load() {
    setLoading(true);
    const [s, eq] = await Promise.all([
      fetch("/api/equipment/stats").then((r) => r.json()),
      fetch("/api/equipment").then((r) => r.json()),
    ]);
    setStats(s);
    setEquipment(Array.isArray(eq) ? eq : []);
    setLoading(false);
  }

  const filtered = filterStatus ? equipment.filter((e) => e.status === filterStatus) : equipment;

  return (
    <div style={{ padding: "24px 32px", minHeight: "100vh", background: "var(--bg-base)" }}>
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em" }}>Техника</h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>Реестр оборудования, ТО и расход ГСМ</p>
        </div>
        <button onClick={() => setCreateOpen(true)}
          style={{ padding: "8px 18px", borderRadius: 10, fontSize: 13, background: "var(--accent)", color: "white", border: "none", cursor: "pointer" }}>
          + Техника
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        {[
          { label: "Всего", value: stats?.total ?? "—", filter: "" },
          { label: "Доступна", value: stats?.available ?? "—", filter: "Доступна", accent: "var(--success)" },
          { label: "На объекте", value: stats?.in_use ?? "—", filter: "На объекте", accent: "var(--accent)" },
          { label: "ТО / ремонт", value: stats?.on_maintenance ?? "—", filter: "На ТО", accent: stats?.on_maintenance ? "var(--warning)" : undefined },
          { label: "ТО ≤ 7 дней", value: stats?.maintenance_due_7d ?? "—", filter: "", accent: stats?.maintenance_due_7d ? "var(--danger)" : undefined },
          { label: "ГСМ за месяц", value: stats?.fuel_month ? `${(stats.fuel_month / 1000).toFixed(0)} тыс. ₽` : "0", filter: "" },
        ].map((s) => (
          <div key={s.label} onClick={() => setFilterStatus(s.filter && filterStatus !== s.filter ? s.filter : "")}
            style={{ padding: "12px 18px", background: "var(--bg-elevated)", border: `1px solid ${filterStatus === s.filter && s.filter ? "var(--accent)" : "var(--border-subtle)"}`, borderRadius: 12, cursor: s.filter ? "pointer" : "default", minWidth: 100 }}>
            <p style={{ fontSize: 10.5, color: "var(--text-tertiary)", marginBottom: 4 }}>{s.label}</p>
            <p style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 700, color: s.accent ?? "var(--text-primary)" }}>{s.value}</p>
          </div>
        ))}
      </div>

      {loading && <div style={{ textAlign: "center", padding: 64, color: "var(--text-tertiary)" }}>Загрузка...</div>}

      {!loading && filtered.length === 0 && (
        <div style={{ padding: "64px 20px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
          {filterStatus ? `Нет техники со статусом «${filterStatus}»` : "Реестр пуст — добавьте первую единицу."}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,3fr) 130px 140px 120px 110px 28px", padding: "10px 20px", background: "var(--bg-base)", borderBottom: "1px solid var(--border-subtle)", fontSize: 10.5, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-tertiary)" }}>
            <span>Техника</span><span>Категория</span><span>Статус</span><span>Местонахождение</span><span style={{ textAlign: "right" }}>Следующее ТО</span><span />
          </div>
          {filtered.map((eq) => {
            const daysLeft = eq.maintenance_days_left;
            const urgentTO = daysLeft != null && daysLeft <= 7;
            return (
              <div key={eq.name} onClick={() => setDrawerName(eq.name)}
                style={{ display: "grid", gridTemplateColumns: "minmax(0,3fr) 130px 140px 120px 110px 28px", padding: "13px 20px", borderBottom: "1px solid var(--border-subtle)", cursor: "pointer", alignItems: "center" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.025)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500 }}>{eq.equipment_name}</p>
                  <p style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "monospace", marginTop: 2 }}>
                    {eq.name}{eq.responsible_person ? ` · ${eq.responsible_person}` : ""}
                  </p>
                </div>
                <span style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>{eq.category}</span>
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, border: `1px solid ${STATUS_COLOR[eq.status as EquipmentStatus]}`, color: STATUS_COLOR[eq.status as EquipmentStatus], display: "inline-block" }}>
                  {eq.status}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {eq.current_location || "—"}
                </span>
                <span style={{ textAlign: "right", fontSize: 12, fontFamily: "monospace", color: urgentTO ? "var(--danger)" : "var(--text-tertiary)", fontWeight: urgentTO ? 600 : 400 }}>
                  {eq.next_maintenance_date
                    ? urgentTO
                      ? daysLeft! < 0 ? `просрочено` : `через ${daysLeft}д`
                      : eq.next_maintenance_date
                    : "—"}
                </span>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5"><path d="M6 3l5 5-5 5" /></svg>
              </div>
            );
          })}
        </div>
      )}

      <EquipmentDrawer name={drawerName} onClose={() => setDrawerName(null)} onStatusChange={(n, s) => setEquipment((prev) => prev.map((e) => e.name === n ? { ...e, status: s } : e))} />
      <EquipmentCreateDrawer open={createOpen} onClose={() => setCreateOpen(false)} onCreated={load} />
    </div>
  );
}
