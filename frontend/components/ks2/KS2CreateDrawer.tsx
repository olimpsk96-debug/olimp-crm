"use client";

import { useState } from "react";
import type { KS2Item } from "@/types/ks2";

interface KS2ItemForm {
  work_name: string;
  unit: string;
  qty: string;
  unit_price: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (name: string) => void;
}

const EMPTY_ITEM: KS2ItemForm = { work_name: "", unit: "", qty: "", unit_price: "" };

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

export function KS2CreateDrawer({ open, onClose, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [actNumber, setActNumber] = useState("");
  const [customer, setCustomer] = useState("");
  const [contractNumber, setContractNumber] = useState("");
  const [project, setProject] = useState("");
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [actDate, setActDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentDue, setPaymentDue] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<KS2ItemForm[]>([{ ...EMPTY_ITEM }]);

  const [estimateName, setEstimateName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addItem() { setItems((p) => [...p, { ...EMPTY_ITEM }]); }
  function removeItem(idx: number) { setItems((p) => p.filter((_, i) => i !== idx)); }
  function updateItem(idx: number, key: keyof KS2ItemForm, value: string) {
    setItems((p) => p.map((item, i) => i === idx ? { ...item, [key]: value } : item));
  }

  async function handleImportEstimate() {
    if (!estimateName.trim()) { setImportError("Введите имя сметы (напр. EST-2026-00001)"); return; }
    setImporting(true);
    setImportError(null);
    try {
      const res = await fetch(
        `http://erp.olimp-ural.ru/api/method/olimp_construction.api.ks2.import_from_estimate?estimate_name=${encodeURIComponent(estimateName.trim())}`,
        { credentials: "include" }
      );
      const data = await res.json();
      const imported: KS2Item[] = data.message ?? [];
      if (imported.length === 0) { setImportError("Позиций не найдено. Проверьте имя сметы."); return; }
      setItems(imported.map((i) => ({
        work_name: i.work_name,
        unit: i.unit ?? "",
        qty: i.qty !== undefined ? String(i.qty) : "",
        unit_price: i.unit_price !== undefined ? String(i.unit_price) : "",
      })));
    } catch {
      setImportError("Ошибка соединения с бэкендом");
    } finally {
      setImporting(false);
    }
  }

  function handleClose() {
    setTitle(""); setActNumber(""); setCustomer(""); setContractNumber("");
    setProject(""); setPeriodFrom(""); setPeriodTo("");
    setActDate(new Date().toISOString().slice(0, 10));
    setPaymentDue(""); setNotes(""); setEstimateName("");
    setItems([{ ...EMPTY_ITEM }]); setError(null); setImportError(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Укажите название акта"); return; }
    const validItems = items.filter((i) => i.work_name.trim());
    if (validItems.length === 0) { setError("Добавьте хотя бы одну позицию"); return; }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/ks2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          status: "Черновик",
          act_number: actNumber.trim() || undefined,
          customer: customer.trim() || undefined,
          contract_number: contractNumber.trim() || undefined,
          project: project.trim() || undefined,
          period_from: periodFrom || undefined,
          period_to: periodTo || undefined,
          act_date: actDate,
          payment_due_date: paymentDue || undefined,
          notes: notes.trim() || undefined,
          items: validItems.map((i) => ({
            work_name: i.work_name.trim(),
            unit: i.unit.trim() || undefined,
            qty: i.qty ? parseFloat(i.qty) : undefined,
            unit_price: i.unit_price ? parseFloat(i.unit_price.replace(/\s/g, "")) : undefined,
          })),
        }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      if (data.created) { handleClose(); onCreated(data.created); }
    } catch {
      setError("Ошибка соединения");
    } finally {
      setSaving(false);
    }
  }

  const estimatedTotal = items.reduce((s, i) => {
    const qty = parseFloat(i.qty) || 0;
    const price = parseFloat(i.unit_price.replace(/\s/g, "")) || 0;
    return s + qty * price;
  }, 0);

  return (
    <>
      <div onClick={handleClose} style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.45)", opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity 0.25s ease", backdropFilter: "blur(2px)" }} />

      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 620, zIndex: 50, background: "var(--bg-elevated)", borderLeft: "1px solid var(--border-subtle)", transform: open ? "translateX(0)" : "translateX(100%)", transition: "transform 0.3s cubic-bezier(0.16,1,0.3,1)", display: "flex", flexDirection: "column", overflowY: "auto" }}>
        {/* Шапка */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 500, letterSpacing: "-0.01em" }}>Новый акт КС-2</h2>
              <p style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 2 }}>Акт приёмки выполненных работ</p>
            </div>
            <button onClick={handleClose} style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid var(--border-subtle)", background: "transparent", color: "var(--text-tertiary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3l10 10M13 3L3 13" /></svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 32px", flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Реквизиты */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 10 }}>
            <div><Label text="Название акта" required /><input style={inputStyle} placeholder="КС-2 этап 1 — АКЗ НПП Старт" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /></div>
            <div><Label text="№ акта" /><input style={inputStyle} placeholder="1" value={actNumber} onChange={(e) => setActNumber(e.target.value)} /></div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><Label text="Заказчик" /><input style={inputStyle} placeholder="НПП Старт" value={customer} onChange={(e) => setCustomer(e.target.value)} /></div>
            <div><Label text="Договор №" /><input style={inputStyle} placeholder="123/2026" value={contractNumber} onChange={(e) => setContractNumber(e.target.value)} /></div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div><Label text="Период с" /><input style={inputStyle} type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} /></div>
            <div><Label text="Период по" /><input style={inputStyle} type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} /></div>
            <div><Label text="Дата акта" /><input style={inputStyle} type="date" value={actDate} onChange={(e) => setActDate(e.target.value)} /></div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><Label text="Проект (ERP)" /><input style={inputStyle} placeholder="PR-2026-..." value={project} onChange={(e) => setProject(e.target.value)} /></div>
            <div><Label text="Оплата до" /><input style={inputStyle} type="date" value={paymentDue} onChange={(e) => setPaymentDue(e.target.value)} /></div>
          </div>

          {/* Импорт из сметы */}
          <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.2)" }}>
            <p style={{ fontSize: 11, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace", marginBottom: 8 }}>Быстрый импорт из сметы</p>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <input style={inputStyle} placeholder="EST-2026-00001" value={estimateName} onChange={(e) => setEstimateName(e.target.value)} />
              </div>
              <button type="button" onClick={handleImportEstimate} disabled={importing}
                style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid var(--accent)", background: "transparent", color: "var(--accent)", fontSize: 12.5, cursor: importing ? "wait" : "pointer", whiteSpace: "nowrap", opacity: importing ? 0.6 : 1 }}>
                {importing ? "Загрузка..." : "Импорт"}
              </button>
            </div>
            {importError && <p style={{ fontSize: 11.5, color: "var(--danger)", marginTop: 6 }}>{importError}</p>}
            {!importError && items.filter((i) => i.work_name).length > 1 && (
              <p style={{ fontSize: 11, color: "var(--success)", marginTop: 6 }}>Загружено {items.filter((i) => i.work_name).length} позиций</p>
            )}
          </div>

          {/* Позиции */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <Label text="Позиции" required />
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {estimatedTotal > 0 && (
                  <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>
                    {(estimatedTotal / 1_000_000).toFixed(2)} млн ₽
                  </span>
                )}
                <button type="button" onClick={addItem}
                  style={{ fontSize: 11.5, padding: "2px 10px", borderRadius: 6, border: "1px solid var(--border-subtle)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}>
                  + Добавить
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) 60px 70px 90px 24px", gap: 6, marginBottom: 4, fontSize: 10, color: "var(--text-tertiary)", fontFamily: "monospace", textTransform: "uppercase" }}>
              <span>Наименование работы</span><span>Ед.</span><span>Объём</span><span>Цена ₽</span><span />
            </div>

            {items.map((item, idx) => (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) 60px 70px 90px 24px", gap: 6, marginBottom: 6 }}>
                <input style={inputStyle} placeholder="Грунтование поверхности" value={item.work_name} onChange={(e) => updateItem(idx, "work_name", e.target.value)} />
                <input style={inputStyle} placeholder="м²" value={item.unit} onChange={(e) => updateItem(idx, "unit", e.target.value)} />
                <input style={inputStyle} placeholder="1200" value={item.qty} onChange={(e) => updateItem(idx, "qty", e.target.value)} inputMode="decimal" />
                <input style={inputStyle} placeholder="350" value={item.unit_price} onChange={(e) => updateItem(idx, "unit_price", e.target.value)} inputMode="decimal" />
                <button type="button" onClick={() => removeItem(idx)}
                  style={{ width: 24, height: 32, display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: "transparent", color: "var(--text-tertiary)", cursor: "pointer" }}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3l10 10M13 3L3 13" /></svg>
                </button>
              </div>
            ))}
          </div>

          <div><Label text="Примечания" /><textarea style={{ ...inputStyle, resize: "vertical", minHeight: 52 }} placeholder="Доп. условия, замечания..." value={notes} onChange={(e) => setNotes(e.target.value)} /></div>

          {error && <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "var(--danger)", fontSize: 12.5 }}>{error}</div>}

          <button type="submit" disabled={saving}
            style={{ marginTop: "auto", width: "100%", padding: "11px 0", borderRadius: 10, border: "none", background: saving ? "var(--border-subtle)" : "var(--accent)", color: saving ? "var(--text-tertiary)" : "white", fontSize: 13.5, fontWeight: 500, cursor: saving ? "wait" : "pointer" }}>
            {saving ? "Создание..." : "Создать КС-2"}
          </button>
        </form>
      </div>
    </>
  );
}
