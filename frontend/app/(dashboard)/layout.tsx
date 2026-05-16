"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GlobalSearch } from "@/components/search/GlobalSearch";
import { ThemeToggle } from "@/components/shared/ThemeToggle";

const NAV_ITEMS = [
  { href: "/dashboard",  label: "Дашборд",   icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { href: "/activity",   label: "Лента",     icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" },
  { href: "/projects",   label: "Проекты",   icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
  { href: "/clients",    label: "Клиенты",   icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
  { href: "/deals",      label: "Сделки",    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { href: "/tenders",   label: "Тендеры",   icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
  { href: "/estimates", label: "Сметы",     icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  { href: "/catalog",   label: "Каталог",   icon: "M4 6h16M4 12h16M4 18h16" },
  { href: "/resources", label: "Ресурсы",   icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7l8 4m0 0v10" },
  { href: "/supply",    label: "Снабжение", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
  { href: "/subcontract-bids", label: "Субподряд", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" },
  { href: "/stock",     label: "Склад",     icon: "M19 14l-7 7m0 0l-7-7m7 7V3" },
  { href: "/ks2",       label: "КС-2",      icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  { href: "/ks3",       label: "КС-3",      icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
  { href: "/change-orders", label: "Изменения", icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" },
  { href: "/cashflow",  label: "Cashflow",  icon: "M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" },
  { href: "/safety",    label: "ОТ/ТБ",     icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" },
  { href: "/risks",     label: "Риски",     icon: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { href: "/work-log",  label: "Журнал КС-6", icon: "M4 6h16M4 10h16M4 14h16M4 18h7" },
  { href: "/schedule",  label: "Графики",    icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { href: "/punch-list", label: "Доделки",    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
  { href: "/certifications", label: "Аттестации", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
  { href: "/equipment",  label: "Техника",    icon: "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" },
  { href: "/ai",        label: "AI",         icon: "M12 2a7 7 0 017 7c0 4-3 7-7 7s-7-3-7-7a7 7 0 017-7zm0 14v2m-4 2h8" },
  { href: "/work-templates", label: "Шаблоны работ", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
  { href: "/decomposition-stats", label: "Аналитика AI", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { href: "/team",      label: "Сотрудники", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
  { href: "/meetings",  label: "Планёрки",   icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg-base)" }}>
      {/* Сайдбар */}
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

        {/* Кнопка поиска ⌘K */}
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

        <div style={{ height: 1, background: "var(--border-subtle)", marginBottom: 8 }} />

        {/* Навигация */}
        <nav style={{ flex: 1, padding: "4px 10px" }}>
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 12px", borderRadius: 9, marginBottom: 2,
                  textDecoration: "none",
                  background: active ? "rgba(249,115,22,0.1)" : "transparent",
                  color: active ? "var(--accent)" : "var(--text-secondary)",
                  fontSize: 13, fontWeight: active ? 500 : 400,
                  transition: "all 0.15s ease",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d={item.icon} />
                </svg>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Тоггл темы */}
        <div style={{ padding: "8px 10px" }}>
          <ThemeToggle />
        </div>

        {/* Версия */}
        <div style={{ padding: "8px 20px 16px", fontSize: 10.5, color: "var(--text-tertiary)", fontFamily: "monospace" }}>
          v1.9 · КС-6
        </div>
      </aside>

      {/* Контент */}
      <main style={{ flex: 1, minWidth: 0 }}>
        {children}
      </main>

      {/* Глобальный поиск ⌘K */}
      <GlobalSearch />
    </div>
  );
}
