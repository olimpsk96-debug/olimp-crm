"use client";

import { useCallback, useEffect, useState } from "react";
import type { WorkTemplate } from "@/types/work-template";
import { CATEGORIES, SOURCES } from "@/types/work-template";
import WorkTemplateDrawer from "@/components/work-templates/WorkTemplateDrawer";

interface CategoryStat { category: string; cnt: number; verified: number }

export default function WorkTemplatesPage() {
  const [items, setItems] = useState<WorkTemplate[]>([]);
  const [cats, setCats] = useState<CategoryStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [source, setSource] = useState("");
  const [verified, setVerified] = useState("");
  const [openName, setOpenName] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (category) params.set("category", category);
      if (source) params.set("source", source);
      if (verified) params.set("is_verified", verified);

      const [r1, r2] = await Promise.all([
        fetch(`/api/work-templates?${params}`),
        fetch("/api/work-templates/categories"),
      ]);
      const d1 = await r1.json();
      const d2 = await r2.json();
      setItems(Array.isArray(d1) ? d1 : []);
      setCats(Array.isArray(d2) ? d2 : []);
    } finally {
      setLoading(false);
    }
  }, [search, category, source, verified]);

  // debounce поиска
  useEffect(() => {
    const t = setTimeout(() => reload(), 250);
    return () => clearTimeout(t);
  }, [reload]);

  const totalCount = items.length;
  const verifiedCount = items.filter((i) => i.is_verified === 1).length;
  const draftsCount = totalCount - verifiedCount;
  const totalUses = items.reduce((acc, i) => acc + (i.usage_count || 0), 0);

  return (
    <div style={{ padding: "24px 32px", minHeight: "100vh", background: "var(--bg-base)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>
            Шаблоны работ
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>
            База типовых работ для AI-декомпозиции — пишешь работу, система раскладывает на этапы
          </p>
        </div>
        <button onClick={() => setOpenName("new")} style={{
          padding: "9px 18px", fontSize: 13, borderRadius: 10,
          background: "var(--accent)", color: "white", border: "none", cursor: "pointer",
        }}>
          + Новый шаблон
        </button>
      </div>

      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <Kpi label="Всего шаблонов" value={totalCount} />
        <Kpi label="Проверенных" value={verifiedCount} accent="var(--success)" />
        <Kpi label="Черновиков" value={draftsCount} accent={draftsCount > 0 ? "var(--warning)" : undefined} />
        <Kpi label="Использовано раз" value={totalUses} accent="var(--accent)" />
      </div>

      {/* Категории */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <CatChip label="Все" count={cats.reduce((a, c) => a + c.cnt, 0)} active={!category} onClick={() => setCategory("")} />
        {cats.map((c) => (
          <CatChip key={c.category} label={c.category} count={c.cnt}
                   active={category === c.category} onClick={() => setCategory(c.category)} />
        ))}
      </div>

      {/* Поиск / фильтры */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <input
          placeholder="Поиск по названию, ID, ключевым словам..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1, padding: "10px 14px", fontSize: 13,
            background: "var(--bg-elevated)", color: "var(--text-primary)",
            border: "1px solid var(--border-subtle)", borderRadius: 10, outline: "none",
          }}
        />
        <select style={selectStyle} value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">Все источники</option>
          {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select style={selectStyle} value={verified} onChange={(e) => setVerified(e.target.value)}>
          <option value="">Все</option>
          <option value="1">Только проверенные</option>
          <option value="0">Только черновики</option>
        </select>
      </div>

      {/* Таблица */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Загрузка...</div>
      ) : items.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>
          Шаблонов не найдено. Попробуй сбросить фильтры или создать новый.
        </div>
      ) : (
        <div style={{ background: "var(--bg-elevated)", borderRadius: 12, border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 130px 90px 90px 90px 110px",
            gap: 0, padding: "12px 16px",
            background: "var(--bg-base)", borderBottom: "1px solid var(--border-subtle)",
            fontSize: 10.5, color: "var(--text-tertiary)",
            textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace",
          }}>
            <div>Название</div>
            <div>Ключевые слова</div>
            <div>Категория</div>
            <div style={{ textAlign: "right" }}>Этапов</div>
            <div style={{ textAlign: "right" }}>Объём</div>
            <div style={{ textAlign: "right" }}>Раз</div>
            <div style={{ textAlign: "right" }}>Статус</div>
          </div>

          {items.map((t) => (
            <div
              key={t.name}
              onClick={() => setOpenName(t.name!)}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 130px 90px 90px 90px 110px",
                gap: 0, padding: "12px 16px",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                cursor: "pointer", transition: "background 0.1s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{t.title}</div>
                <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", fontFamily: "monospace", marginTop: 2 }}>
                  {t.template_id}
                </div>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                   title={(t as { keywords?: string }).keywords || ""}>
                {(t as { keywords?: string }).keywords || "—"}
              </div>
              <div style={{ fontSize: 11.5 }}>
                <span style={{
                  padding: "3px 8px", borderRadius: 5,
                  background: "var(--bg-base)", color: "var(--text-secondary)",
                }}>{t.category}</span>
              </div>
              <div style={{ textAlign: "right", fontFamily: "monospace", fontSize: 12 }}>{t.stages_count ?? "—"}</div>
              <div style={{ textAlign: "right", fontFamily: "monospace", fontSize: 11, color: "var(--text-tertiary)" }}>
                {t.typical_volume_min}–{t.typical_volume_max} {t.base_unit}
              </div>
              <div style={{ textAlign: "right", fontFamily: "monospace", fontSize: 12,
                            color: (t.usage_count || 0) > 0 ? "var(--accent)" : "var(--text-tertiary)" }}>
                {t.usage_count || 0}
              </div>
              <div style={{ textAlign: "right" }}>
                {t.is_verified === 1 ? (
                  <span style={{ padding: "3px 8px", borderRadius: 5, background: "rgba(34,197,94,0.15)", color: "var(--success)", fontSize: 10.5 }}>
                    ✓ Проверен
                  </span>
                ) : (
                  <span style={{ padding: "3px 8px", borderRadius: 5, background: "rgba(245,158,11,0.15)", color: "var(--warning)", fontSize: 10.5 }}>
                    Черновик
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {openName !== null && (
        <WorkTemplateDrawer
          name={openName}
          onClose={() => setOpenName(null)}
          onSaved={() => { setOpenName(null); reload(); }}
        />
      )}
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div style={{
      padding: "14px 18px", borderRadius: 10,
      background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
    }}>
      <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 600, fontFamily: "monospace", color: accent ?? "var(--text-primary)" }}>
        {value}
      </div>
    </div>
  );
}

function CatChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "5px 12px", fontSize: 12, borderRadius: 7,
      border: `1px solid ${active ? "var(--accent)" : "var(--border-subtle)"}`,
      background: active ? "rgba(234,88,12,0.12)" : "transparent",
      color: active ? "var(--accent)" : "var(--text-secondary)",
      cursor: "pointer", display: "flex", gap: 6, alignItems: "center",
    }}>
      <span>{label}</span>
      <span style={{ fontSize: 10.5, fontFamily: "monospace", color: "var(--text-tertiary)" }}>{count}</span>
    </button>
  );
}

const selectStyle: React.CSSProperties = {
  padding: "10px 12px", fontSize: 12.5, borderRadius: 10,
  background: "var(--bg-elevated)", color: "var(--text-primary)",
  border: "1px solid var(--border-subtle)", outline: "none", cursor: "pointer",
};
