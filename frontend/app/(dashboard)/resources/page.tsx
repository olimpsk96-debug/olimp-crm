"use client";

import { useCallback, useEffect, useState } from "react";
import type { CatalogResource, ResourceStats, ResourceType } from "@/types/resource";
import AISearchModal from "@/components/search/AISearchModal";

interface IndexStatus {
  qdrant: { exists: boolean; points_count?: number; status?: string };
  total_in_db: number;
  collection_name: string;
  synced: boolean;
}

const TYPE_LABELS: Record<ResourceType, { label: string; color: string; emoji: string }> = {
  "Material":          { label: "Материалы",       color: "var(--accent)",     emoji: "🧱" },
  "Equipment":         { label: "Оборудование",    color: "var(--warning)",    emoji: "🛠" },
  "Labor":             { label: "Труд",            color: "var(--success)",    emoji: "👷" },
  "Abstract Material": { label: "Абстр. материал", color: "var(--text-tertiary)", emoji: "📦" },
};

function fmt(n?: number | null, digits = 0) {
  if (!n && n !== 0) return "—";
  return n.toLocaleString("ru-RU", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export default function ResourcesPage() {
  const [list, setList] = useState<CatalogResource[]>([]);
  const [stats, setStats] = useState<ResourceStats | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ResourceType | "">("");
  const [collectionFilter, setCollectionFilter] = useState<string>("");
  const [aiOpen, setAiOpen] = useState(false);
  const [indexStatus, setIndexStatus] = useState<IndexStatus | null>(null);
  const [reindexing, setReindexing] = useState(false);
  const [reindexResult, setReindexResult] = useState<string | null>(null);

  const loadIndexStatus = useCallback(() => {
    fetch("/api/semantic-search/status").then(r => r.json()).then(d => {
      if (d && !d.error) setIndexStatus(d);
    });
  }, []);

  useEffect(() => { loadIndexStatus(); }, [loadIndexStatus]);

  async function runReindex() {
    if (!confirm("Запустить переиндексацию каталога? Стоимость через OpenAI ~$0.002 (text-embedding-3-small).")) return;
    setReindexing(true); setReindexResult(null);
    try {
      const r = await fetch("/api/semantic-search/reindex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const d = await r.json();
      if (!r.ok || d.error) {
        setReindexResult(`Ошибка: ${d.error || r.status}`);
      } else {
        setReindexResult(`Готово: проиндексировано ${d.processed}/${d.total}`);
        loadIndexStatus();
      }
    } finally {
      setReindexing(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    const p = new URLSearchParams();
    if (debouncedSearch) p.set("search", debouncedSearch);
    if (typeFilter) p.set("resource_type", typeFilter);
    if (collectionFilter) p.set("collection", collectionFilter);
    p.set("limit", "200");
    const data = await fetch(`/api/resources?${p}`).then(r => r.json());
    setList(Array.isArray(data) ? data : []);
  }, [debouncedSearch, typeFilter, collectionFilter]);

  useEffect(() => {
    fetch(`/api/resources/stats`).then(r => r.json()).then(setStats);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ padding: 32, maxWidth: 1500, margin: "0 auto" }}>
      <div style={{ marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>База ресурсов CWICR</h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: "4px 0 0" }}>
            {stats?.total ?? 0} материалов / оборудования / труда из открытой базы DDC CWICR (С.-Пб, CC BY 4.0)
          </p>
        </div>
        <button
          onClick={() => setAiOpen(true)}
          style={{
            padding: "10px 18px", fontSize: 13, fontWeight: 500,
            background: "linear-gradient(135deg, #a78bfa, #60a5fa)", color: "white",
            border: "none", borderRadius: 10, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8,
          }}>
          <span>🤖</span> AI-поиск по смыслу
        </button>
      </div>

      {/* AI-индекс блок */}
      {indexStatus && (
        <div style={{
          padding: "10px 14px", marginBottom: 14, borderRadius: 10,
          background: indexStatus.synced ? "rgba(34,197,94,0.06)" : "rgba(168,139,250,0.06)",
          border: `1px solid ${indexStatus.synced ? "rgba(34,197,94,0.3)" : "rgba(168,139,250,0.3)"}`,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
        }}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            <span style={{ marginRight: 6 }}>{indexStatus.synced ? "✓" : "⚡"}</span>
            <span style={{ fontFamily: "monospace", fontWeight: 500 }}>
              AI-индекс: {indexStatus.qdrant.points_count ?? 0} / {indexStatus.total_in_db}
            </span>
            <span style={{ marginLeft: 8, color: "var(--text-tertiary)" }}>
              {indexStatus.synced
                ? "синхронизирован — можно использовать AI-поиск"
                : "не синхронизирован — индексация даст полноценный AI-поиск"}
            </span>
          </div>
          <button
            onClick={runReindex}
            disabled={reindexing}
            style={{
              padding: "6px 14px", fontSize: 12, fontWeight: 500,
              background: indexStatus.synced ? "var(--bg-elevated)" : "var(--accent)",
              color: indexStatus.synced ? "var(--text-secondary)" : "white",
              border: "1px solid " + (indexStatus.synced ? "var(--border-subtle)" : "var(--accent)"),
              borderRadius: 8, cursor: reindexing ? "wait" : "pointer", opacity: reindexing ? 0.6 : 1,
            }}>
            {reindexing ? "Индексация..." : indexStatus.synced ? "Переиндексировать" : "Запустить индексацию"}
          </button>
        </div>
      )}
      {reindexResult && (
        <div style={{ padding: "8px 14px", marginBottom: 14, borderRadius: 8, fontSize: 12,
                      background: reindexResult.startsWith("Ошибка") ? "rgba(248,113,113,0.1)" : "rgba(34,197,94,0.1)",
                      color: reindexResult.startsWith("Ошибка") ? "var(--danger)" : "var(--success)" }}>
          {reindexResult}
        </div>
      )}

      {/* Stats by type */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
          {(["Material", "Equipment", "Labor", "Abstract Material"] as ResourceType[]).map(t => {
            const cnt = stats.by_type[t] ?? 0;
            const lbl = TYPE_LABELS[t];
            const active = typeFilter === t;
            return (
              <button key={t} onClick={() => setTypeFilter(active ? "" : t)} style={{
                background: active ? `${lbl.color}20` : "var(--bg-elevated)",
                border: `1px solid ${active ? lbl.color : "var(--border-subtle)"}`,
                borderRadius: 12, padding: "14px 18px",
                textAlign: "left", cursor: "pointer", outline: "none",
              }}>
                <p style={{ fontSize: 10.5, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0, fontFamily: "monospace" }}>
                  {lbl.emoji} {lbl.label}
                </p>
                <p style={{ fontSize: 22, fontWeight: 600, color: lbl.color, margin: "6px 0 0", fontFamily: "monospace" }}>{fmt(cnt)}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Search + collection */}
      <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center" }}>
        <input
          type="search"
          placeholder="🔍 Поиск по наименованию или коду (рапид)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1, padding: "10px 14px", borderRadius: 10,
            background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
            color: "var(--text-primary)", fontSize: 14, outline: "none",
          }}
        />
        <select value={collectionFilter} onChange={(e) => setCollectionFilter(e.target.value)} style={{
          padding: "10px 14px", borderRadius: 10, minWidth: 280,
          background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
          color: "var(--text-primary)", fontSize: 13, outline: "none",
        }}>
          <option value="">Все сборники</option>
          {stats?.by_collection.map(c => (
            <option key={c.parent_collection} value={c.parent_collection}>
              {c.parent_collection} ({c.cnt})
            </option>
          ))}
        </select>
      </div>

      {/* Collection chips (top-10 with counts) */}
      {stats && !collectionFilter && (
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          {stats.by_collection.slice(0, 10).map(c => (
            <button key={c.parent_collection} onClick={() => setCollectionFilter(c.parent_collection)} style={{
              padding: "4px 10px", borderRadius: 8, fontSize: 11,
              background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
              color: "var(--text-secondary)", cursor: "pointer",
            }}>
              {c.parent_collection} · <b style={{ fontFamily: "monospace", color: "var(--accent)" }}>{c.cnt}</b>
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div style={{ background: "var(--bg-elevated)", borderRadius: 12, border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead style={{ background: "var(--bg-base)" }}>
            <tr>
              <th style={th}>Код</th>
              <th style={{ ...th, textAlign: "left" }}>Наименование</th>
              <th style={th}>Тип</th>
              <th style={th}>Ед.</th>
              <th style={th}>Цена ср., ₽</th>
              <th style={th}>Цена min</th>
              <th style={th}>Цена max</th>
              <th style={th}>Использ.</th>
              <th style={{ ...th, textAlign: "left" }}>Сборник</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>
                {debouncedSearch || typeFilter || collectionFilter ? "По фильтрам ничего не найдено" : "База пуста — запустите импорт"}
              </td></tr>
            )}
            {list.map((r) => {
              const tl = TYPE_LABELS[r.resource_type];
              return (
                <tr key={r.name} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                  <td style={{ ...td, fontFamily: "monospace", fontSize: 10.5, color: "var(--text-tertiary)" }}>{r.resource_code}</td>
                  <td style={{ ...td }}><span style={{ fontWeight: 500 }}>{r.resource_name}</span></td>
                  <td style={{ ...td, color: tl.color, textAlign: "center", fontSize: 11 }}>{tl.emoji}</td>
                  <td style={{ ...td, textAlign: "center", color: "var(--text-secondary)" }}>{r.unit || "—"}</td>
                  <td style={{ ...td, fontFamily: "monospace", textAlign: "right", fontWeight: 600 }}>{fmt(r.price_avg, 2)}</td>
                  <td style={{ ...td, fontFamily: "monospace", textAlign: "right", color: "var(--text-tertiary)", fontSize: 11 }}>{fmt(r.price_min, 2)}</td>
                  <td style={{ ...td, fontFamily: "monospace", textAlign: "right", color: "var(--text-tertiary)", fontSize: 11 }}>{fmt(r.price_max, 2)}</td>
                  <td style={{ ...td, textAlign: "right", color: "var(--text-secondary)", fontSize: 11, fontFamily: "monospace" }}>{r.usage_count ?? 0}×</td>
                  <td style={{ ...td, fontSize: 11, color: "var(--text-tertiary)" }}>{r.parent_collection || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: 14, fontSize: 10.5, color: "var(--text-tertiary)" }}>
        Источник: <a href="https://github.com/datadrivenconstruction/OpenConstructionEstimate-DDC-CWICR" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>DDC CWICR</a>.
        Boiko, A. (2022-2026). DDC CWICR — Construction Work Items, Costs & Resources. DataDrivenConstruction. Лицензия CC BY 4.0.
        Цены даны для С.-Пб; для Свердловской обл. использовать `regional_factor` в записи ресурса.
      </p>

      {aiOpen && (
        <AISearchModal
          initialQuery={search.length >= 2 ? search : ""}
          onClose={() => setAiOpen(false)}
        />
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: "11px 12px", textAlign: "right", fontSize: 10.5, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace", fontWeight: 500 };
const td: React.CSSProperties = { padding: "9px 12px" };
