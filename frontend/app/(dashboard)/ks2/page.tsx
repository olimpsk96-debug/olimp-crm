"use client";

import { useEffect, useState } from "react";
import type { KS2Act, KS2Status } from "@/types/ks2";
import { KS2Drawer } from "@/components/ks2/KS2Drawer";
import { KS2CreateDrawer } from "@/components/ks2/KS2CreateDrawer";

const STATUS_COLOR: Record<string, string> = {
  "Черновик":      "var(--text-tertiary)",
  "На подписании": "var(--warning)",
  "Подписан":      "var(--success)",
  "Отклонён":      "var(--danger)",
};

const PAYMENT_COLOR: Record<string, string> = {
  "Ожидает":  "var(--text-tertiary)",
  "Частично": "var(--warning)",
  "Оплачено": "var(--success)",
};

export default function KS2Page() {
  const [acts, setActs] = useState<KS2Act[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerName, setDrawerName] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") { setDrawerName(null); setCreateOpen(false); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await fetch("/api/ks2").then((r) => r.json());
      setActs(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreated(name: string) {
    setCreateOpen(false);
    await load();
    setDrawerName(name);
  }

  function handleStatusChange(name: string, status: KS2Status) {
    setActs((prev) => prev.map((a) => a.name === name ? { ...a, status } : a));
  }

  const totalSigned = acts.filter((a) => a.status === "Подписан").reduce((s, a) => s + (a.amount ?? 0), 0);
  const pendingSign = acts.filter((a) => a.status === "На подписании").length;
  const pendingPay  = acts.filter((a) => a.status === "Подписан" && a.payment_status !== "Оплачено").reduce((s, a) => s + ((a.amount ?? 0) - (a.payment_received ?? 0)), 0);

  return (
    <div style={{ padding: "24px 32px", minHeight: "100vh", background: "var(--bg-base)" }}>
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em" }}>КС-2</h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>Акты приёмки выполненных работ</p>
        </div>
        <button onClick={() => setCreateOpen(true)}
          style={{ padding: "8px 18px", borderRadius: 10, fontSize: 13, background: "var(--accent)", color: "white", border: "none", cursor: "pointer" }}>
          + Акт КС-2
        </button>
      </div>

      {/* Статистика */}
      <div style={{ display: "flex", gap: 24, marginBottom: 24, padding: "14px 20px", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 14 }}>
        <Stat label="Всего актов" value={acts.length} unit="шт" />
        <Divider />
        <Stat label="Подписано" value={(totalSigned / 1_000_000).toFixed(1)} unit="млн ₽" accent="var(--success)" />
        <Divider />
        <Stat label="На подписании" value={pendingSign} unit="шт" accent={pendingSign > 0 ? "var(--warning)" : undefined} />
        <Divider />
        <Stat label="Ожидает оплаты" value={(pendingPay / 1_000_000).toFixed(1)} unit="млн ₽" accent={pendingPay > 0 ? "var(--danger)" : undefined} />
      </div>

      {loading && <div style={{ textAlign: "center", padding: 64, color: "var(--text-tertiary)" }}>Загрузка...</div>}
      {error && <div style={{ padding: 16, borderRadius: 12, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "var(--danger)", fontSize: 13 }}>{error}</div>}

      {!loading && !error && acts.length > 0 && (
        <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 14, overflow: "hidden" }}>
          {/* Шапка */}
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,3fr) 70px 130px 120px 110px 110px 36px", padding: "10px 20px", background: "var(--bg-base)", borderBottom: "1px solid var(--border-subtle)", fontSize: 10.5, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-tertiary)" }}>
            <span>Акт</span><span>№</span><span>Статус</span><span style={{ textAlign: "right" }}>Дата</span><span style={{ textAlign: "right" }}>Сумма</span><span style={{ textAlign: "right" }}>Оплата</span><span />
          </div>

          {acts.map((act) => (
            <div key={act.name} onClick={() => setDrawerName(act.name)}
              style={{ display: "grid", gridTemplateColumns: "minmax(0,3fr) 70px 130px 120px 110px 110px 36px", padding: "13px 20px", borderBottom: "1px solid var(--border-subtle)", cursor: "pointer", alignItems: "center", transition: "background 0.12s ease" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.025)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 500 }}>{act.title}</p>
                <p style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "monospace", marginTop: 2 }}>
                  {act.name}{act.customer ? ` · ${act.customer}` : ""}
                </p>
              </div>
              <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text-tertiary)" }}>
                {act.act_number ? `№${act.act_number}` : "—"}
              </span>
              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, border: `1px solid ${STATUS_COLOR[act.status] ?? "var(--border-subtle)"}`, color: STATUS_COLOR[act.status] ?? "var(--text-secondary)", display: "inline-block" }}>
                {act.status}
              </span>
              <span style={{ textAlign: "right", fontSize: 12, fontFamily: "monospace", color: "var(--text-tertiary)" }}>
                {act.act_date ? new Date(act.act_date).toLocaleDateString("ru", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—"}
              </span>
              <span style={{ textAlign: "right", fontFamily: "monospace", fontSize: 13, fontWeight: 500 }}>
                {act.amount ? `${(act.amount / 1_000_000).toFixed(2)}M` : "—"}
              </span>
              <span style={{ textAlign: "right" }}>
                {act.payment_status ? (
                  <span style={{ fontSize: 10.5, padding: "1px 6px", borderRadius: 4, background: act.payment_status === "Оплачено" ? "rgba(52,211,153,0.12)" : act.payment_status === "Частично" ? "rgba(251,191,36,0.12)" : "transparent", color: PAYMENT_COLOR[act.payment_status] }}>
                    {act.payment_status}
                  </span>
                ) : "—"}
              </span>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5"><path d="M6 3l5 5-5 5" /></svg>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && acts.length === 0 && (
        <div style={{ padding: "64px 20px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
          Актов пока нет. Создайте первый или импортируйте позиции из сметы.
        </div>
      )}

      <KS2Drawer name={drawerName} onClose={() => setDrawerName(null)} onStatusChange={handleStatusChange} />
      <KS2CreateDrawer open={createOpen} onClose={() => setCreateOpen(false)} onCreated={handleCreated} />
    </div>
  );
}

function Divider() { return <div style={{ width: 1, background: "var(--border-subtle)" }} />; }
function Stat({ label, value, unit, accent }: { label: string; value: string | number; unit: string; accent?: string }) {
  return (
    <div>
      <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 2 }}>{label}</p>
      <p style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 600, color: accent ?? "var(--text-primary)" }}>
        {value} <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-tertiary)" }}>{unit}</span>
      </p>
    </div>
  );
}
