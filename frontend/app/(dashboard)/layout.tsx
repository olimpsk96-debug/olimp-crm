"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { GlobalSearch } from "@/components/search/GlobalSearch";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { ToastProvider } from "@/components/ui/Toast";

interface NavItem { href: string; label: string; icon: string; }
interface NavSection { id: string; title: string; items: NavItem[]; }

// Иконки SVG-paths (выровнены 24×24, fluent стиль)
const I = {
  dashboard: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  activity: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
  ai: "M12 2a7 7 0 017 7c0 4-3 7-7 7s-7-3-7-7a7 7 0 017-7zm0 14v2m-4 2h8",
  clients: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  deals: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2",
  tenders: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  guarantees: "M9 12l2 2 4-4M12 3l8 4v6c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V7l8-4z",
  leadsStats: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
  projects: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  health: "M3 12l9-9 9 9M5 10v10a1 1 0 001 1h12a1 1 0 001-1V10",
  schedule: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  capacity: "M3 4a1 1 0 011-1h16a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zm11 0a1 1 0 011-1h5a1 1 0 011 1v6a1 1 0 01-1 1h-5a1 1 0 01-1-1v-6z",
  estimates: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  catalog: "M4 6h16M4 12h16M4 18h16",
  cwicr: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
  resources: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7l8 4m0 0v10",
  templates: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5",
  decompStats: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6m0 0V9a2 2 0 012-2h2",
  ks2: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  ks3: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
  changeOrders: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
  workLog: "M4 6h16M4 10h16M4 14h16M4 18h7",
  reconciliation: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2m-3 7l-3 3m0 0l-3-3m3 3V8",
  supply: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  subcontract: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  stock: "M19 14l-7 7m0 0l-7-7m7 7V3",
  materialConsumption: "M3 7l9 4 9-4m-9 4v10M3 7v10l9 4 9-4V7",
  checkin: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z",
  inspections: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  punchList: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
  risks: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  safety: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  siteCash: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
  pdf: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  cashflow: "M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z",
  team: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
  certifications: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622",
  meetings: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
  equipment: "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4",
};

const NAV_SECTIONS: NavSection[] = [
  {
    id: "main", title: "Главное", items: [
      { href: "/dashboard", label: "Дашборд", icon: I.dashboard },
      { href: "/activity", label: "Лента", icon: I.activity },
      { href: "/ai", label: "AI-ассистент", icon: I.ai },
    ],
  },
  {
    id: "crm", title: "CRM · Продажи", items: [
      { href: "/clients", label: "Клиенты", icon: I.clients },
      { href: "/deals", label: "Сделки", icon: I.deals },
      { href: "/tenders", label: "Тендеры", icon: I.tenders },
      { href: "/guarantees", label: "Обеспечения тендеров", icon: I.guarantees },
      { href: "/leads-stats", label: "Аналитика лидов", icon: I.leadsStats },
    ],
  },
  {
    id: "projects", title: "Проекты", items: [
      { href: "/projects", label: "Проекты", icon: I.projects },
      { href: "/project-updates", label: "Здоровье проектов", icon: I.health },
      { href: "/schedule", label: "Графики (Gantt)", icon: I.schedule },
      { href: "/capacity", label: "Загрузка бригад", icon: I.capacity },
      { href: "/risks", label: "Риски", icon: I.risks },
    ],
  },
  {
    id: "estimates", title: "Сметы · Каталоги", items: [
      { href: "/estimates", label: "Сметы", icon: I.estimates },
      { href: "/work-templates", label: "Шаблоны работ", icon: I.templates },
      { href: "/catalog-work-items", label: "Расценки CWICR", icon: I.cwicr },
      { href: "/resources", label: "Ресурсы", icon: I.resources },
      { href: "/catalog", label: "Каталог ГЭСН", icon: I.catalog },
      { href: "/decomposition-stats", label: "Аналитика AI-смет", icon: I.decompStats },
    ],
  },
  {
    id: "closing", title: "Закрытие работ", items: [
      { href: "/ks2", label: "КС-2", icon: I.ks2 },
      { href: "/ks3", label: "КС-3", icon: I.ks3 },
      { href: "/change-orders", label: "Изменения (Change Orders)", icon: I.changeOrders },
      { href: "/work-log", label: "Журнал КС-6", icon: I.workLog },
      { href: "/reconciliation", label: "Акт сверки", icon: I.reconciliation },
    ],
  },
  {
    id: "supply", title: "Снабжение · Склад", items: [
      { href: "/supply", label: "Снабжение", icon: I.supply },
      { href: "/subcontract-bids", label: "Субподряд", icon: I.subcontract },
      { href: "/stock", label: "Склад", icon: I.stock },
      { href: "/material-consumption", label: "Расход материалов", icon: I.materialConsumption },
    ],
  },
  {
    id: "field", title: "Поле · ОТ/ТБ", items: [
      { href: "/checkin", label: "Чек-ин на объекте", icon: I.checkin },
      { href: "/inspections", label: "Инспекции", icon: I.inspections },
      { href: "/punch-list", label: "Доделки", icon: I.punchList },
      { href: "/safety", label: "ОТ/ТБ", icon: I.safety },
      { href: "/site-cash", label: "Касса на объекте", icon: I.siteCash },
      { href: "/pdf-annotations", label: "Разметка PDF", icon: I.pdf },
    ],
  },
  {
    id: "finance", title: "Финансы", items: [
      { href: "/cashflow", label: "Cashflow", icon: I.cashflow },
    ],
  },
  {
    id: "team", title: "Команда · Техника", items: [
      { href: "/team", label: "Сотрудники", icon: I.team },
      { href: "/certifications", label: "Аттестации", icon: I.certifications },
      { href: "/meetings", label: "Планёрки", icon: I.meetings },
      { href: "/equipment", label: "Техника", icon: I.equipment },
    ],
  },
];

const STORAGE_KEY = "olimp-sidebar-collapsed";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setCollapsed(new Set(JSON.parse(raw)));
    } catch {}
  }, []);

  function toggleSection(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  // Авто-раскрытие секции с активным пунктом (если она свёрнута)
  const activeSection = NAV_SECTIONS.find((s) =>
    s.items.some((it) => pathname.startsWith(it.href))
  )?.id;

  return (
    <ToastProvider>
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg-base)" }}>
      <aside style={{
        width: 220, flexShrink: 0,
        background: "var(--bg-elevated)",
        borderRight: "1px solid var(--border-subtle)",
        display: "flex", flexDirection: "column",
        position: "sticky", top: 0, height: "100vh",
        overflowY: "auto",
      }}>
        {/* Логотип */}
        <div style={{ padding: "20px 20px 12px" }}>
          <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--accent)", fontFamily: "monospace" }}>ОЛИМП</p>
          <p style={{ fontSize: 10.5, color: "var(--text-tertiary)", marginTop: 1 }}>Строительство · ERP</p>
        </div>

        {/* Поиск ⌘K */}
        <div style={{ padding: "0 10px 8px" }}>
          <button
            onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }))}
            style={{
              width: "100%", padding: "7px 12px", borderRadius: 8,
              background: "var(--bg-base)", border: "1px solid var(--border-subtle)",
              color: "var(--text-tertiary)", fontSize: 12,
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
              cursor: "pointer", outline: "none",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="7" cy="7" r="5" /><path d="M11 11l3 3" />
              </svg>
              Поиск...
            </span>
            <kbd style={{
              padding: "1px 5px", borderRadius: 4, fontSize: 10,
              background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
              fontFamily: "monospace",
            }}>⌘K</kbd>
          </button>
        </div>

        <div style={{ height: 1, background: "var(--border-subtle)", marginBottom: 4 }} />

        {/* Навигация со скомпонованными разделами */}
        <nav style={{ flex: 1, padding: "4px 8px 8px" }}>
          {NAV_SECTIONS.map((section) => {
            const isCollapsed = collapsed.has(section.id) && section.id !== activeSection;
            return (
              <div key={section.id} style={{ marginBottom: 4 }}>
                <button
                  onClick={() => toggleSection(section.id)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "8px 10px 4px", background: "transparent", border: "none",
                    color: "var(--text-tertiary)", fontSize: 10, fontWeight: 600,
                    textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "monospace",
                    cursor: "pointer", outline: "none",
                  }}
                >
                  <span>{section.title}</span>
                  <span style={{ fontSize: 9, opacity: 0.5, transition: "transform 0.15s",
                                  display: "inline-block",
                                  transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}>▼</span>
                </button>
                {!isCollapsed && section.items.map((item) => {
                  const active = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href} href={item.href}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "6px 12px", borderRadius: 7, marginBottom: 1,
                        textDecoration: "none",
                        background: active ? "rgba(249,115,22,0.12)" : "transparent",
                        color: active ? "var(--accent)" : "var(--text-secondary)",
                        fontSize: 12.5, fontWeight: active ? 500 : 400,
                        transition: "all 0.12s ease",
                      }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        <path d={item.icon} />
                      </svg>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Тоггл темы */}
        <div style={{ padding: "8px 10px", borderTop: "1px solid var(--border-subtle)" }}>
          <ThemeToggle />
        </div>

        {/* Версия */}
        <div style={{ padding: "8px 20px 16px", fontSize: 10.5, color: "var(--text-tertiary)", fontFamily: "monospace" }}>
          v5.6 · 9 разделов
        </div>
      </aside>

      {/* Контент */}
      <main style={{ flex: 1, minWidth: 0 }}>
        {children}
      </main>

      {/* ⌘K */}
      <GlobalSearch />
    </div>
    </ToastProvider>
  );
}
