"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/Toast";

interface Assembly {
  name: string;
  assembly_code: string;
  assembly_name: string;
  category: string;
  unit: string;
  base_rate: number;
  market_rate: number;
  margin_percent: number;
  items_count: number;
}

interface Category { category: string; count: number; }

interface Props {
  estimate: string;
  onClose: () => void;
  onApplied: () => void;
}

function fmtMoney(v: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(v) + " ₽";
}

export function ApplyAssemblyModal({ estimate, onClose, onApplied }: Props) {
  const toast = useToast();
  const [items, setItems] = useState<Assembly[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [filter, setFilter] = useState({ category: "", search: "" });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Assembly | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [markup, setMarkup] = useState<number>(15);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/assemblies?active_only=1&limit=300").then((r) => r.json()),
      fetch("/api/assemblies?mode=categories").then((r) => r.json()),
    ])
      .then(([list, c]) => {
        setItems(Array.isArray(list) ? list : []);
        setCats(Array.isArray(c) ? c : []);
      })
      .finally(() => setLoading(false));
  }, []);

  // ESC
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const filtered = useMemo(() => {
    return items.filter((a) => {
      if (filter.category && a.category !== filter.category) return false;
      if (filter.search) {
        const q = filter.search.toLowerCase();
        return a.assembly_name.toLowerCase().includes(q)
            || a.assembly_code.toLowerCase().includes(q);
      }
      return true;
    });
  }, [items, filter]);

  async function apply() {
    if (!selected) return;
    if (!quantity || quantity <= 0) { toast.warn("Укажите количество > 0"); return; }
    setApplying(true);
    try {
      const r = await fetch("/api/assemblies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "apply", estimate, assembly: selected.name,
          quantity, markup_pct: markup,
        }),
      });
      const d = await r.json();
      if (d.error) { toast.error(d.error); return; }
      toast.success(`Добавлено: ${fmtMoney(d.added_amount)}`);
      onApplied();
    } finally { setApplying(false); }
  }

  const computedAmount = selected
    ? (selected.market_rate || selected.base_rate * (1 + markup / 100)) * quantity
    : 0;

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100,
      display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 20px",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 720, maxHeight: "90vh", overflow: "hidden",
        background: "var(--bg-base)", borderRadius: 12,
        border: "1px solid var(--border-subtle)",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border-subtle)",
                      display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>
              ⊞ Применить сборку в смету
            </h2>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2, fontFamily: "monospace" }}>
              {estimate}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-tertiary)", fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ padding: "12px 20px", display: "flex", gap: 6, flexWrap: "wrap",
                      borderBottom: "1px solid var(--border-subtle)" }}>
          <input value={filter.search} onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                 placeholder="🔍 Поиск..." autoFocus
                 style={{
                   flex: 1, minWidth: 200, padding: "7px 11px", fontSize: 12.5,
                   background: "var(--bg-elevated)", color: "var(--text-primary)",
                   border: "1px solid var(--border-subtle)", borderRadius: 6, outline: "none",
                 }} />
          <select value={filter.category} onChange={(e) => setFilter({ ...filter, category: e.target.value })}
                  style={{
                    padding: "7px 11px", fontSize: 12.5,
                    background: "var(--bg-elevated)", color: "var(--text-primary)",
                    border: "1px solid var(--border-subtle)", borderRadius: 6, outline: "none",
                  }}>
            <option value="">Все категории</option>
            {cats.map((c) => <option key={c.category} value={c.category}>{c.category} ({c.count})</option>)}
          </select>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "8px 20px" }}>
          {loading && <div style={{ padding: 30, textAlign: "center", color: "var(--text-tertiary)" }}>Загрузка...</div>}
          {!loading && filtered.length === 0 && (
            <div style={{ padding: 30, textAlign: "center", color: "var(--text-tertiary)" }}>
              Сборок нет.{" "}
              <a href="/assemblies" target="_blank" rel="noopener" style={{ color: "var(--accent)" }}>
                Создать или установить типовые →
              </a>
            </div>
          )}
          {!loading && filtered.map((a) => (
            <div key={a.name} onClick={() => setSelected(a)}
                 style={{
                   padding: "10px 12px", marginBottom: 6, borderRadius: 7,
                   background: selected?.name === a.name ? "rgba(124,58,237,0.08)" : "var(--bg-elevated)",
                   border: `1px solid ${selected?.name === a.name ? "#7c3aed" : "var(--border-subtle)"}`,
                   cursor: "pointer", display: "flex", gap: 10, alignItems: "center",
                 }}>
              <div style={{ width: 30, textAlign: "center", fontSize: 11, color: "var(--text-tertiary)", fontFamily: "monospace" }}>
                {selected?.name === a.name ? "✓" : "·"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>
                  {a.assembly_name}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "monospace" }}>
                  {a.assembly_code} · {a.category} · {a.items_count} ресурсов · ед. {a.unit}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "monospace", color: "var(--accent)" }}>
                  {fmtMoney(a.market_rate)}
                </div>
                <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", fontFamily: "monospace" }}>
                  база {fmtMoney(a.base_rate)} · {a.margin_percent.toFixed(0)}%
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer with quantity + apply */}
        <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border-subtle)",
                      background: "var(--bg-elevated)" }}>
          {selected ? (
            <>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace" }}>
                    Количество ({selected.unit}) *
                  </div>
                  <input type="number" min={0.01} step={0.01} value={quantity}
                         onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                         style={{
                           width: "100%", padding: "9px 11px", fontSize: 14, fontFamily: "monospace",
                           background: "var(--bg-base)", color: "var(--text-primary)",
                           border: "1px solid var(--accent)", borderRadius: 7, outline: "none",
                         }} autoFocus />
                </div>
                <div style={{ width: 100 }}>
                  <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace" }}>
                    Наценка %
                  </div>
                  <input type="number" min={0} max={300} value={markup}
                         onChange={(e) => setMarkup(parseFloat(e.target.value) || 0)}
                         style={{
                           width: "100%", padding: "9px 11px", fontSize: 13, fontFamily: "monospace",
                           background: "var(--bg-base)", color: "var(--text-primary)",
                           border: "1px solid var(--border-subtle)", borderRadius: 7, outline: "none",
                         }} />
                </div>
                <div style={{ width: 150, textAlign: "right" }}>
                  <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace" }}>
                    Итого ₽
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--success)", fontFamily: "monospace" }}>
                    {fmtMoney(computedAmount)}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button onClick={onClose} style={{
                  padding: "9px 16px", fontSize: 13,
                  background: "transparent", color: "var(--text-secondary)",
                  border: "1px solid var(--border-subtle)", borderRadius: 7, cursor: "pointer",
                }}>Отмена</button>
                <button onClick={apply} disabled={applying} style={{
                  padding: "9px 24px", fontSize: 13, fontWeight: 500,
                  background: "var(--accent)", color: "white",
                  border: "none", borderRadius: 7, cursor: "pointer",
                  opacity: applying ? 0.6 : 1,
                }}>{applying ? "Добавление..." : "✓ Применить в смету"}</button>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", textAlign: "center" }}>
              Выберите сборку из списка
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
