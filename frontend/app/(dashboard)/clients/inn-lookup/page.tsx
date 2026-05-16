"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";

interface LookupResult {
  ok: boolean;
  source?: "dadata.ru" | "egrul.itsoft.ru";
  message?: string;
  inn?: string;
  kpp?: string;
  ogrn?: string;
  type?: "LEGAL" | "INDIVIDUAL";
  name_full?: string;
  name_short?: string;
  okved?: string;
  address_value?: string;
  manager_name?: string;
  manager_post?: string;
  state?: string;
  registration_date?: string;
}

export default function INNLookupPage() {
  const [inn, setInn] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [applying, setApplying] = useState(false);
  const toast = useToast();

  async function lookup(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!inn || !/^\d{10,12}$/.test(inn.trim())) {
      toast.error("ИНН должен быть 10 или 12 цифр");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const r = await fetch("/api/dadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inn: inn.trim() }),
      });
      const d = await r.json();
      if (d.error) {
        toast.error(d.error.slice(0, 200));
        return;
      }
      setResult(d);
      if (d.ok) {
        toast.success(`Найдено через ${d.source || "API"}: ${d.name_short || d.name_full || ""}`);
      } else {
        toast.warn(d.message || "Не найдено");
      }
    } catch (err) {
      toast.error(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function applyToCustomer() {
    if (!result || !result.ok) return;
    setApplying(true);
    try {
      const r = await fetch("/api/dadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inn: inn.trim(), apply_to_customer: true }),
      });
      const d = await r.json();
      if (d.error) {
        toast.error(d.error.slice(0, 200));
        return;
      }
      toast.success(`Customer ${d.action === "created" ? "создан" : "обновлён"}: ${d.customer}`);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div style={{ padding: "24px 32px", minHeight: "100vh", background: "var(--bg-base)" }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>
          🔍 Поиск компании по ИНН
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4, marginBottom: 22 }}>
          Подтягиваем название, ОГРН, адрес, директора, статус из ЕГРЮЛ.
          Источники: DaData (если активирован) → fallback на egrul.itsoft.ru (бесплатно, без регистрации).
        </p>

        <form onSubmit={lookup} style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <input
            value={inn}
            onChange={(e) => setInn(e.target.value.replace(/\D/g, "").slice(0, 12))}
            placeholder="Введи ИНН (10 цифр для юрлица, 12 для ИП)"
            inputMode="numeric"
            style={{
              flex: 1, padding: "12px 16px", fontSize: 14,
              background: "var(--bg-elevated)", color: "var(--text-primary)",
              border: "1px solid var(--border-subtle)", borderRadius: 10,
              outline: "none", fontFamily: "monospace",
            }}
          />
          <button type="submit" disabled={loading || !inn}
                  style={{
                    padding: "12px 24px", fontSize: 14, fontWeight: 500,
                    background: "var(--accent)", color: "white", border: "none",
                    borderRadius: 10, cursor: "pointer", opacity: loading || !inn ? 0.6 : 1,
                  }}>
            {loading ? "Ищу..." : "🔍 Найти"}
          </button>
        </form>

        {/* Примеры известных ИНН для быстрого теста */}
        {!result && (
          <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 20 }}>
            Попробуй: <button onClick={() => setInn("7707083893")} style={linkBtn}>7707083893 (Сбербанк)</button> · <button onClick={() => setInn("7736050003")} style={linkBtn}>7736050003 (Газпром)</button> · <button onClick={() => setInn("7728168971")} style={linkBtn}>7728168971 (РЖД)</button>
          </div>
        )}

        {result && result.ok && (
          <div style={{
            padding: 24, borderRadius: 12,
            background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: 17, fontWeight: 500, margin: 0 }}>
                  {result.name_short || result.name_full || "—"}
                </h2>
                {result.name_full && result.name_full !== result.name_short && (
                  <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4, margin: "4px 0 0 0" }}>
                    {result.name_full}
                  </p>
                )}
              </div>
              <span style={{
                padding: "4px 10px", borderRadius: 6, fontSize: 10.5, fontFamily: "monospace",
                background: result.source === "dadata.ru" ? "rgba(34,197,94,0.15)" : "rgba(96,165,250,0.15)",
                color: result.source === "dadata.ru" ? "var(--success)" : "#60a5fa",
              }}>
                {result.source}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              <Meta label="ИНН" value={result.inn || "—"} />
              <Meta label="КПП" value={result.kpp || "—"} />
              <Meta label="ОГРН" value={result.ogrn || "—"} />
              <Meta label="Тип" value={result.type === "LEGAL" ? "Юрлицо" : "ИП"} />
            </div>

            {result.address_value && (
              <Block label="Юридический адрес">{result.address_value}</Block>
            )}
            {result.manager_name && (
              <Block label="Руководитель">
                {result.manager_name}{result.manager_post && ` · ${result.manager_post}`}
              </Block>
            )}
            {result.okved && <Block label="Основной ОКВЭД">{result.okved}</Block>}
            {result.state && <Block label="Статус">{result.state}</Block>}
            {result.registration_date && <Block label="Дата регистрации">{result.registration_date}</Block>}

            <div style={{ marginTop: 20, display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => { setResult(null); setInn(""); }}
                      style={{ padding: "10px 18px", background: "var(--bg-base)", color: "var(--text-secondary)",
                               border: "1px solid var(--border-subtle)", borderRadius: 9, fontSize: 13, cursor: "pointer" }}>
                ↩ Новый поиск
              </button>
              <button onClick={applyToCustomer} disabled={applying}
                      style={{ padding: "10px 20px", background: "var(--accent)", color: "white",
                               border: "none", borderRadius: 9, fontSize: 13, fontWeight: 500,
                               cursor: "pointer", opacity: applying ? 0.6 : 1 }}>
                {applying ? "..." : "✓ Создать клиента"}
              </button>
            </div>
          </div>
        )}

        {result && !result.ok && (
          <div style={{
            padding: 24, borderRadius: 12, textAlign: "center",
            background: "rgba(251,191,36,0.08)", border: "1px solid var(--warning)",
            color: "var(--warning)",
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🤷</div>
            <div style={{ fontSize: 14 }}>{result.message || "Компания не найдена"}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: "10px 12px", borderRadius: 8, background: "var(--bg-base)", border: "1px solid var(--border-subtle)" }}>
      <div style={{ fontSize: 9.5, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace" }}>{label}</div>
      <div style={{ fontSize: 13, fontFamily: "monospace", marginTop: 3 }}>{value}</div>
    </div>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 9.5, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{children}</div>
    </div>
  );
}

const linkBtn: React.CSSProperties = {
  background: "none", border: "none", color: "var(--accent)",
  cursor: "pointer", fontFamily: "monospace", padding: 0,
  textDecoration: "underline", fontSize: 12,
};
