"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";

interface SavedView {
  name: string;
  view_name: string;
  route: string;
  user_email: string;
  is_shared: number;
  is_pinned: number;
  filters: Record<string, unknown>;
  sort_field?: string;
  sort_order?: "ASC" | "DESC";
  is_own?: boolean;
}

/**
 * Бар сохранённых View — фильтры с возможностью save/apply/delete.
 * Backend: api/user_views.py (DocType User View).
 *
 * Использование:
 *   <SavedViewsBar
 *     route="/tenders"
 *     currentFilters={{ status: "Новый", region: "Свердловская" }}
 *     onApply={(filters) => setFilters(filters)}
 *   />
 */
export function SavedViewsBar({
  route,
  currentFilters,
  onApply,
}: {
  route: string;
  currentFilters: Record<string, unknown>;
  onApply: (filters: Record<string, unknown>) => void;
}) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [activeView, setActiveView] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [isShared, setIsShared] = useState(false);
  const toast = useToast();

  const reload = useCallback(async () => {
    const r = await fetch(`/api/user-views?route=${encodeURIComponent(route)}`);
    const d = await r.json();
    setViews(Array.isArray(d) ? d : []);
  }, [route]);

  useEffect(() => { reload(); }, [reload]);

  function applyView(v: SavedView) {
    setActiveView(v.name);
    onApply(v.filters || {});
    toast.info(`Применён view «${v.view_name}»`);
  }

  function clearFilters() {
    setActiveView(null);
    onApply({});
  }

  async function saveView() {
    if (!newName.trim()) { toast.error("Укажи название view"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/user-views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          view_name: newName.trim(),
          route,
          filters: currentFilters,
          is_shared: isShared ? 1 : 0,
        }),
      });
      const d = await r.json();
      if (d.created || d.updated) {
        toast.success(`View «${newName}» сохранён`);
        setShowSaveForm(false);
        setNewName("");
        setIsShared(false);
        reload();
      } else {
        toast.error(d.error || "Ошибка сохранения");
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteView(v: SavedView) {
    if (!confirm(`Удалить view «${v.view_name}»?`)) return;
    const r = await fetch(`/api/user-views?name=${encodeURIComponent(v.name)}`, { method: "DELETE" });
    const d = await r.json();
    if (d.ok) {
      toast.success("View удалён");
      if (activeView === v.name) clearFilters();
      reload();
    } else {
      toast.error(d.error || "Ошибка удаления");
    }
  }

  const hasFilters = Object.values(currentFilters || {}).some((v) => v !== "" && v !== undefined && v !== null);

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
      {/* Список view */}
      {views.map((v) => (
        <div key={v.name} style={{ display: "flex", alignItems: "stretch" }}>
          <button
            onClick={() => applyView(v)}
            style={{
              padding: "5px 10px", fontSize: 11.5, borderRadius: 7,
              border: activeView === v.name ? "1px solid var(--accent)" : "1px solid var(--border-subtle)",
              background: activeView === v.name ? "rgba(234,88,12,0.12)" : "transparent",
              color: activeView === v.name ? "var(--accent)" : "var(--text-secondary)",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
            }}
            title={`Владелец: ${v.user_email}${v.is_shared ? " · общедоступный" : ""}`}
          >
            {v.is_pinned ? "📌 " : ""}
            <span>{v.view_name}</span>
            {!v.is_own && v.is_shared && <span style={{ fontSize: 10, opacity: 0.6 }}>👥</span>}
          </button>
          {v.is_own && (
            <button
              onClick={(e) => { e.stopPropagation(); deleteView(v); }}
              style={{
                padding: "0 6px", fontSize: 10,
                background: "transparent",
                border: activeView === v.name ? "1px solid var(--accent)" : "1px solid var(--border-subtle)",
                borderLeft: "none",
                borderTopRightRadius: 7, borderBottomRightRadius: 7,
                color: "var(--text-tertiary)", cursor: "pointer",
              }}
              title="Удалить view"
            >
              ×
            </button>
          )}
        </div>
      ))}

      {/* Save current filters */}
      {hasFilters && !showSaveForm && (
        <button onClick={() => setShowSaveForm(true)}
                style={{
                  padding: "5px 10px", fontSize: 11.5, borderRadius: 7,
                  border: "1px dashed var(--accent)", background: "transparent",
                  color: "var(--accent)", cursor: "pointer",
                }}>
          + Сохранить view
        </button>
      )}

      {/* Save form */}
      {showSaveForm && (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") saveView(); if (e.key === "Escape") setShowSaveForm(false); }}
            placeholder="Название view"
            autoFocus
            style={{
              padding: "5px 10px", fontSize: 11.5, borderRadius: 7,
              border: "1px solid var(--accent)",
              background: "var(--bg-base)", color: "var(--text-primary)",
              outline: "none", width: 180,
            }}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-tertiary)", cursor: "pointer" }}>
            <input type="checkbox" checked={isShared} onChange={(e) => setIsShared(e.target.checked)} />
            общий
          </label>
          <button onClick={saveView} disabled={saving} style={{
            padding: "5px 10px", fontSize: 11.5, borderRadius: 7,
            background: "var(--accent)", color: "white", border: "none", cursor: "pointer",
            opacity: saving ? 0.5 : 1,
          }}>
            {saving ? "..." : "Save"}
          </button>
          <button onClick={() => { setShowSaveForm(false); setNewName(""); }} style={{
            padding: "5px 8px", fontSize: 11, background: "transparent",
            border: "1px solid var(--border-subtle)", borderRadius: 7,
            color: "var(--text-tertiary)", cursor: "pointer",
          }}>
            ×
          </button>
        </div>
      )}

      {/* Clear */}
      {activeView && (
        <button onClick={clearFilters} style={{
          padding: "5px 10px", fontSize: 11.5, borderRadius: 7,
          background: "transparent", border: "1px solid var(--border-subtle)",
          color: "var(--text-tertiary)", cursor: "pointer",
        }}>
          Сбросить
        </button>
      )}
    </div>
  );
}
