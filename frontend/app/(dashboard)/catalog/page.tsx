"use client";

import { useCallback, useEffect, useState } from "react";
import type { CatalogItem, CatalogStats } from "@/types/catalog";

const SECTIONS = [
  "01 — Земляные работы",
  "06 — Бетон/железобетон монолитный",
  "07 — Бетон/железобетон сборный",
  "08 — Кирпич и блоки",
  "09 — Металлоконструкции",
  "10 — Деревянные конструкции",
  "11 — Полы",
  "12 — Кровли",
  "13 — Защита от коррозии (АКЗ)",
  "15 — Отделочные работы",
  "16 — Трубопроводы внутренние",
  "17 — Водопровод и канализация",
  "18 — Отопление",
  "19 — Газоснабжение",
  "20 — Вентиляция и кондиционирование",
  "21 — Электротехнические устройства",
  "Прочее",
];

function fmt(n?: number | null) {
  if (n === undefined || n === null) return "—";
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 0 });
}

export default function CatalogPage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [stats, setStats] = useState<CatalogStats | null>(null);
  const [section, setSection] = useState<string>("");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    const p = new URLSearchParams();
    if (section) p.set("section", section);
    if (searchDebounced) p.set("search", searchDebounced);
    p.set("limit", "200");
    const [data, st] = await Promise.all([
      fetch(`/api/catalog?${p}`).then(r => r.json()),
      fetch(`/api/catalog/stats`).then(r => r.json()),
    ]);
    setItems(Array.isArray(data) ? data : []);
    setStats(st && typeof st === "object" && "total" in st ? st : null);
  }, [section, searchDebounced]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ padding: 32, maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>Справочник расценок</h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: "4px 0 0" }}>
            Базовые позиции ГЭСН/ФЕР/ТЕР для быстрого составления смет
          </p>
        </div>
        {stats && (
          <div style={{ display: "flex", gap: 20, fontSize: 12, color: "var(--text-tertiary)" }}>
            <div>Всего: <b style={{ color: "var(--text-primary)", fontFamily: "monospace" }}>{stats.total}</b></div>
            <div>Разделов: <b style={{ color: "var(--text-primary)", fontFamily: "monospace" }}>{stats.by_section.length}</b></div>
          </div>
        )}
      </div>

      {/* Search + filter */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <input
          type="search"
          placeholder="🔍 Поиск по наименованию или коду..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1, padding: "10px 14px", borderRadius: 10,
            background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
            color: "var(--text-primary)", fontSize: 14, outline: "none",
          }}
        />
        <select value={section} onChange={(e) => setSection(e.target.value)} style={{
          padding: "10px 14px", borderRadius: 10, background: "var(--bg-elevated)",
          border: "1px solid var(--border-subtle)", color: "var(--text-primary)",
          fontSize: 13, outline: "none", minWidth: 280,
        }}>
          <option value="">Все разделы</option>
          {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Section chips with counts */}
      {stats && !section && (
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          {stats.by_section.slice(0, 8).map(s => (
            <button key={s.section} onClick={() => setSection(s.section)} style={{
              padding: "4px 10px", borderRadius: 8, fontSize: 11,
              background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
              color: "var(--text-secondary)", cursor: "pointer",
            }}>
              {s.section} · <b style={{ fontFamily: "monospace", color: "var(--accent)" }}>{s.cnt}</b>
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div style={{ background: "var(--bg-elevated)", borderRadius: 12, border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "var(--bg-base)" }}>
            <tr>
              <th style={th}>Код</th>
              <th style={{ ...th, textAlign: "left" }}>Наименование</th>
              <th style={th}>Раздел</th>
              <th style={th}>Ед.</th>
              <th style={th}>Цена, ₽</th>
              <th style={th}>Использовано</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>
                {searchDebounced || section ? "По фильтрам ничего не найдено" : "Каталог пуст. Запустите seed: catalog.seed_catalog()"}
              </td></tr>
            )}
            {items.map((it) => (
              <tr key={it.name} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                <td style={{ ...td, fontFamily: "monospace", fontSize: 11, color: "var(--text-tertiary)" }}>{it.code || "—"}</td>
                <td style={{ ...td }}>
                  <div style={{ fontWeight: 500 }}>{it.item_name}</div>
                  {it.notes && <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{it.notes.slice(0, 120)}{it.notes.length > 120 ? "…" : ""}</div>}
                </td>
                <td style={{ ...td, fontSize: 11, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{it.section || "—"}</td>
                <td style={{ ...td, textAlign: "center", color: "var(--text-secondary)" }}>{it.unit}</td>
                <td style={{ ...td, fontFamily: "monospace", textAlign: "right", fontWeight: 600 }}>{fmt(it.base_price)}</td>
                <td style={{ ...td, textAlign: "right", color: it.usage_count ? "var(--accent)" : "var(--text-tertiary)", fontFamily: "monospace" }}>{it.usage_count || 0}×</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: 16, fontSize: 11, color: "var(--text-tertiary)" }}>
        Базовый набор расценок основан на ГЭСН-2024 (метод базисно-индексный с пересчётом по индексу Минстроя для Свердловской обл.).
        Расширяйте каталог через ERPNext: <code style={{ background: "var(--bg-base)", padding: "1px 6px", borderRadius: 4 }}>/app/cost-catalog-item</code>
      </p>
    </div>
  );
}

const th: React.CSSProperties = { padding: "12px 14px", textAlign: "left", fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "monospace", fontWeight: 500 };
const td: React.CSSProperties = { padding: "12px 14px" };
