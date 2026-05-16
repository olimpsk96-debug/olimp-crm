"use client";

import { useCallback, useEffect, useState } from "react";

interface WorkItem {
  name: string;
  rate_code: string;
  rate_name: string | null;
  rate_unit: string | null;
  category_type: string | null;
  department_name: string | null;
  section_name: string | null;
  subsection_name: string | null;
  row_type: string | null;
  is_scope: number;
  is_abstract: number;
  usage_count: number;
  work_composition_text?: string | null;
}

interface FacetRow { [key: string]: string | number }

interface Facets {
  total: number;
  categories: FacetRow[];
  departments: FacetRow[];
  row_types: FacetRow[];
}

const LIMIT = 50;

export default function CatalogWorkItemsPage() {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [department, setDepartment] = useState("");
  const [hideAbstract, setHideAbstract] = useState(false);
  const [openDetail, setOpenDetail] = useState<WorkItem | null>(null);

  useEffect(() => {
    fetch("/api/catalog-work-items/facets")
      .then((r) => r.json())
      .then((d) => setFacets(d));
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (search) p.set("search", search);
      if (category) p.set("category_type", category);
      if (department) p.set("department_name", department);
      if (hideAbstract) p.set("is_abstract", "0");
      p.set("limit", String(LIMIT));
      const r = await fetch(`/api/catalog-work-items?${p}`);
      const d = await r.json();
      setItems(d.items || []);
      setTotal(d.total || 0);
    } finally {
      setLoading(false);
    }
  }, [search, category, department, hideAbstract]);

  useEffect(() => {
    const t = setTimeout(() => reload(), 250);
    return () => clearTimeout(t);
  }, [reload]);

  async function openItem(name: string) {
    const r = await fetch(`/api/catalog-work-items/${encodeURIComponent(name)}`);
    const d = await r.json();
    if (d && d.name) setOpenDetail(d);
  }

  return (
    <div style={{ padding: "24px 32px", minHeight: "100vh", background: "var(--bg-base)" }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>
          Каталог расценок CWICR
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>
          {facets ? `${facets.total.toLocaleString("ru-RU")} типовых работ` : "..."} · импорт из DDC CWICR Санкт-Петербург
        </p>
      </div>

      {/* Категории-чипы */}
      {facets && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <CatChip label="Все" count={facets.total} active={!category} onClick={() => { setCategory(""); setDepartment(""); }} />
          {facets.categories.map((c) => (
            <CatChip
              key={String(c.category_type)}
              label={String(c.category_type)}
              count={Number(c.cnt)}
              active={category === c.category_type}
              onClick={() => { setCategory(String(c.category_type)); setDepartment(""); }}
            />
          ))}
        </div>
      )}

      {/* Поиск + фильтры */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <input
          placeholder="Поиск по названию, коду, составу работ..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1, padding: "10px 14px", fontSize: 13,
            background: "var(--bg-elevated)", color: "var(--text-primary)",
            border: "1px solid var(--border-subtle)", borderRadius: 10, outline: "none",
          }}
        />
        {facets && (
          <select style={selectStyle} value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="">Все отделы</option>
            {facets.departments.filter((d) => !category || true).slice(0, 50).map((d) => (
              <option key={String(d.department_name)} value={String(d.department_name)}>
                {String(d.department_name).substring(0, 80)} ({d.cnt})
              </option>
            ))}
          </select>
        )}
        <label style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 12px", fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}>
          <input type="checkbox" checked={hideAbstract} onChange={(e) => setHideAbstract(e.target.checked)} />
          Без абстрактных
        </label>
      </div>

      {/* Заголовок */}
      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 8, fontFamily: "monospace" }}>
        Показано {items.length} из {total.toLocaleString("ru-RU")}{total > LIMIT && " · уточни поиск для большего"}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Загрузка...</div>
      ) : items.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>
          Ничего не найдено. Попробуй другой запрос.
        </div>
      ) : (
        <div style={{ background: "var(--bg-elevated)", borderRadius: 12, border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "160px 1fr 60px 130px 90px 80px",
            gap: 0, padding: "10px 14px",
            background: "var(--bg-base)", borderBottom: "1px solid var(--border-subtle)",
            fontSize: 10, color: "var(--text-tertiary)",
            textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace",
          }}>
            <div>Код</div>
            <div>Название</div>
            <div>Ед.</div>
            <div>Раздел</div>
            <div>Тип</div>
            <div style={{ textAlign: "right" }}>Раз</div>
          </div>

          {items.map((it) => (
            <div
              key={it.name}
              onClick={() => openItem(it.name)}
              style={{
                display: "grid",
                gridTemplateColumns: "160px 1fr 60px 130px 90px 80px",
                gap: 0, padding: "10px 14px",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                cursor: "pointer", fontSize: 12,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text-tertiary)" }}>
                {it.rate_code.substring(0, 28)}
              </div>
              <div>
                <div style={{ fontSize: 12.5 }}>{it.rate_name || "—"}</div>
                {it.section_name && (
                  <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>
                    {it.section_name}
                    {it.subsection_name && ` / ${it.subsection_name}`}
                  </div>
                )}
              </div>
              <div style={{ fontFamily: "monospace", fontSize: 11 }}>{it.rate_unit || "—"}</div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                   title={it.department_name || ""}>
                {(it.department_name || "—").substring(0, 24)}
              </div>
              <div style={{ fontSize: 10.5 }}>
                {it.is_abstract === 1 ? (
                  <span style={{ padding: "2px 6px", borderRadius: 4, background: "rgba(168,139,250,0.15)", color: "#a78bfa" }}>Абстр.</span>
                ) : it.is_scope === 1 ? (
                  <span style={{ padding: "2px 6px", borderRadius: 4, background: "rgba(96,165,250,0.15)", color: "#60a5fa" }}>Группа</span>
                ) : (
                  <span style={{ padding: "2px 6px", borderRadius: 4, background: "rgba(34,197,94,0.10)", color: "var(--success)" }}>Расценка</span>
                )}
              </div>
              <div style={{ textAlign: "right", fontFamily: "monospace", color: it.usage_count > 0 ? "var(--accent)" : "var(--text-tertiary)" }}>
                {it.usage_count}
              </div>
            </div>
          ))}
        </div>
      )}

      {openDetail && (
        <DetailDrawer item={openDetail} onClose={() => setOpenDetail(null)} />
      )}
    </div>
  );
}

function CatChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "5px 12px", fontSize: 11.5, borderRadius: 7,
      border: `1px solid ${active ? "var(--accent)" : "var(--border-subtle)"}`,
      background: active ? "rgba(234,88,12,0.12)" : "transparent",
      color: active ? "var(--accent)" : "var(--text-secondary)",
      cursor: "pointer", display: "flex", gap: 6, alignItems: "center",
    }}>
      <span>{label.length > 26 ? label.substring(0, 24) + "…" : label}</span>
      <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--text-tertiary)" }}>
        {count.toLocaleString("ru-RU")}
      </span>
    </button>
  );
}

function DetailDrawer({ item, onClose }: { item: WorkItem; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 100, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 620, maxWidth: "100%", height: "100vh", background: "var(--bg-base)",
        borderLeft: "1px solid var(--border-subtle)", overflow: "auto", padding: "22px 26px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-tertiary)" }}>{item.rate_code}</div>
            <h2 style={{ fontSize: 18, fontWeight: 500, margin: "4px 0 0" }}>
              {item.rate_name || "Без названия"}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-tertiary)", fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
          <Meta label="Единица" value={item.rate_unit || "—"} />
          <Meta label="Тип" value={item.row_type || "—"} />
          <Meta label="Категория" value={item.category_type || "—"} />
          <Meta label="Использовано" value={`${item.usage_count} раз`} />
        </div>

        <Block label="Отдел / Сборник">{item.department_name || "—"}</Block>
        <Block label="Раздел">{item.section_name || "—"}</Block>
        {item.subsection_name && <Block label="Подраздел">{item.subsection_name}</Block>}

        {item.work_composition_text && (
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace", marginBottom: 6 }}>
              Состав работ
            </div>
            <div style={{
              padding: 12, borderRadius: 9,
              background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
              fontSize: 12.5, lineHeight: 1.55, whiteSpace: "pre-wrap",
            }}>
              {item.work_composition_text}
            </div>
          </div>
        )}

        <div style={{ marginTop: 20, padding: 12, borderRadius: 9, background: "rgba(234,88,12,0.06)", border: "1px solid rgba(234,88,12,0.3)", fontSize: 11.5, color: "var(--text-secondary)" }}>
          💡 Используй эту расценку как референс при составлении сметы — описание состава работ можно скопировать.
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: "10px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 8 }}>
      <div style={{ fontSize: 9.5, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace" }}>{label}</div>
      <div style={{ fontSize: 13, marginTop: 3 }}>{value}</div>
    </div>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 9.5, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 12.5, color: "var(--text-primary)" }}>{children}</div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: "10px 12px", fontSize: 12, borderRadius: 10,
  background: "var(--bg-elevated)", color: "var(--text-primary)",
  border: "1px solid var(--border-subtle)", outline: "none", cursor: "pointer",
  maxWidth: 320,
};
