"use client";

import { useMemo } from "react";
import type { ScheduleTask, ScheduleBounds } from "@/types/schedule";

const DAY_PX = 28;          // ширина одного дня в timeline
const ROW_HEIGHT = 36;      // высота строки
const HEADER_HEIGHT = 56;   // высота шапки (месяцы + дни)
const TASKS_COL_WIDTH = 340;

// Цвета задач по состоянию
const BAR_BG = {
  done:     "rgba(34,197,94,0.45)",
  inWork:   "rgba(96,165,250,0.45)",
  planned:  "rgba(168,168,180,0.30)",
  critical: "rgba(248,113,113,0.45)",
  criticalFill: "rgba(248,113,113,0.85)",
};
const BAR_FILL = {
  done: "rgba(34,197,94,0.85)",
  inWork: "rgba(96,165,250,0.85)",
  planned: "rgba(168,168,180,0.6)",
};

function parseDate(s: string): Date {
  return new Date(`${s}T00:00:00`);
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function formatDay(d: Date): string {
  return d.toLocaleDateString("ru-RU", { day: "2-digit" });
}
function formatMonth(d: Date): string {
  return d.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
}

export default function GanttChart({
  tasks,
  bounds,
  onTaskClick,
  onProgressChange,
}: {
  tasks: ScheduleTask[];
  bounds: ScheduleBounds | null;
  onTaskClick?: (taskName: string) => void;
  onProgressChange?: (taskName: string, progress: number) => void;
}) {
  // Расширим bounds на 2 дня по краям для отступов
  const ext = useMemo(() => {
    if (!bounds) return null;
    const start = parseDate(bounds.start);
    const end = parseDate(bounds.end);
    start.setDate(start.getDate() - 2);
    end.setDate(end.getDate() + 2);
    return {
      start,
      end,
      totalDays: daysBetween(start, end) + 1,
    };
  }, [bounds]);

  const todayLeftPx = useMemo(() => {
    if (!ext) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = daysBetween(ext.start, today);
    if (diff < 0 || diff > ext.totalDays) return null;
    return diff * DAY_PX;
  }, [ext]);

  // Подсчёт месяцев для верхнего ряда заголовка
  const monthBands = useMemo(() => {
    if (!ext) return [];
    const bands: { label: string; width: number; left: number }[] = [];
    const cur = new Date(ext.start);
    cur.setHours(0, 0, 0, 0);
    let left = 0;
    while (cur <= ext.end) {
      const monthEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
      const actualEnd = monthEnd > ext.end ? ext.end : monthEnd;
      const days = daysBetween(cur, actualEnd) + 1;
      bands.push({ label: formatMonth(cur), width: days * DAY_PX, left });
      left += days * DAY_PX;
      cur.setDate(actualEnd.getDate() + 1);
      // переход к следующему месяцу
      if (cur.getDate() !== 1) {
        cur.setMonth(cur.getMonth() + 1, 1);
      }
    }
    return bands;
  }, [ext]);

  const dayCells = useMemo(() => {
    if (!ext) return [];
    const cells: { label: string; isWeekend: boolean; isToday: boolean }[] = [];
    const cur = new Date(ext.start);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = 0; i < ext.totalDays; i++) {
      cells.push({
        label: formatDay(cur),
        isWeekend: cur.getDay() === 0 || cur.getDay() === 6,
        isToday: cur.getTime() === today.getTime(),
      });
      cur.setDate(cur.getDate() + 1);
    }
    return cells;
  }, [ext]);

  if (!ext) {
    return (
      <div style={{ padding: 60, textAlign: "center", color: "var(--text-tertiary)", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 12 }}>
        Нет задач со сроками. Добавьте первую задачу — она появится на графике.
      </div>
    );
  }

  const timelineWidth = ext.totalDays * DAY_PX;

  return (
    <div style={{
      background: "var(--bg-elevated)",
      border: "1px solid var(--border-subtle)",
      borderRadius: 12,
      overflow: "hidden",
      display: "flex",
    }}>
      {/* ═══ LEFT: Tasks list ═══ */}
      <div style={{ width: TASKS_COL_WIDTH, flexShrink: 0, borderRight: "1px solid var(--border-subtle)" }}>
        <div style={{
          height: HEADER_HEIGHT, padding: "0 14px", borderBottom: "1px solid var(--border-subtle)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "var(--bg-base)",
          fontSize: 11, fontWeight: 500, color: "var(--text-tertiary)",
          textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace",
        }}>
          <span>Задача / исполнитель</span>
          <span>Длит.</span>
        </div>
        {tasks.map((t) => {
          const isSection = t.is_section === 1;
          const isCritical = t.is_critical === 1;
          const isDone = t.status === "Выполнена";
          const inWork = t.status === "В работе";
          return (
            <div key={t.name}
                 onClick={() => onTaskClick?.(t.name)}
                 style={{
                   height: ROW_HEIGHT,
                   padding: isSection ? "0 14px" : "0 14px 0 28px",
                   display: "flex", alignItems: "center", gap: 8,
                   borderBottom: "1px solid var(--border-subtle)",
                   background: isSection ? "var(--bg-base)" : "transparent",
                   cursor: "pointer",
                   transition: "background 0.1s",
                 }}
                 onMouseEnter={(e) => { if (!isSection) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                 onMouseLeave={(e) => { if (!isSection) e.currentTarget.style.background = "transparent"; }}>
              {/* Progress icon */}
              {!isSection && (
                <div style={{
                  width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                  background: isDone ? "rgba(34,197,94,0.18)" : inWork ? "rgba(96,165,250,0.18)" : "transparent",
                  border: isDone || inWork ? "none" : "1px dashed var(--border-subtle)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: isDone ? "var(--success)" : inWork ? "#60a5fa" : "var(--text-tertiary)",
                  fontSize: 10, fontWeight: 600,
                }}>
                  {isDone ? "✓" : inWork ? `${Math.round(t.progress)}` : ""}
                </div>
              )}
              {isSection && (
                <span style={{ fontSize: 11, color: "var(--text-tertiary)", flexShrink: 0 }}>▾</span>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: isSection ? 13 : 12,
                  fontWeight: isSection ? 500 : 400,
                  color: isCritical && !isSection ? "var(--text-primary)" : (inWork ? "#60a5fa" : "var(--text-primary)"),
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  {t.title}
                  {isCritical && !isSection && (
                    <span style={{ padding: "1px 5px", borderRadius: 3, background: "rgba(248,113,113,0.16)", color: "var(--danger)", fontSize: 9, fontWeight: 600, letterSpacing: "0.04em" }}>КП</span>
                  )}
                </div>
                {!isSection && t.assignee && (
                  <div style={{ fontSize: 10, color: "var(--text-tertiary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {t.assignee}{t.start_date && ` · ${parseDate(t.start_date).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })}–${t.end_date ? parseDate(t.end_date).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }) : "?"}`}
                  </div>
                )}
              </div>
              <span style={{ fontSize: 11, color: isCritical && !isSection ? "var(--danger)" : "var(--text-tertiary)", fontFamily: "monospace", flexShrink: 0 }}>
                {t.duration_days ? `${t.duration_days} дн` : "—"}
              </span>
            </div>
          );
        })}
      </div>

      {/* ═══ RIGHT: Timeline ═══ */}
      <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
        <div style={{ width: timelineWidth, position: "relative" }}>
          {/* Header — месяцы */}
          <div style={{
            height: HEADER_HEIGHT / 2, borderBottom: "1px solid var(--border-subtle)",
            background: "var(--bg-base)", position: "relative",
          }}>
            {monthBands.map((b, i) => (
              <div key={i} style={{
                position: "absolute", left: b.left, width: b.width,
                height: "100%", display: "flex", alignItems: "center",
                paddingLeft: 8, fontSize: 11, fontWeight: 500,
                color: "var(--text-secondary)", textTransform: "capitalize",
                borderRight: "1px solid var(--border-subtle)",
              }}>
                {b.label}
              </div>
            ))}
          </div>
          {/* Header — дни */}
          <div style={{
            height: HEADER_HEIGHT / 2, borderBottom: "1px solid var(--border-subtle)",
            display: "flex", background: "var(--bg-base)",
          }}>
            {dayCells.map((c, i) => (
              <div key={i} style={{
                width: DAY_PX, flexShrink: 0, textAlign: "center",
                fontSize: 10, lineHeight: `${HEADER_HEIGHT / 2}px`, fontFamily: "monospace",
                color: c.isToday ? "var(--accent)" : c.isWeekend ? "var(--text-tertiary)" : "var(--text-secondary)",
                fontWeight: c.isToday ? 600 : 400,
                background: c.isToday ? "rgba(96,165,250,0.08)" : c.isWeekend ? "rgba(0,0,0,0.04)" : "transparent",
                borderRight: i % 7 === 6 ? "1px solid var(--border-subtle)" : "none",
              }}>
                {c.label}
              </div>
            ))}
          </div>

          {/* Today line */}
          {todayLeftPx !== null && (
            <div style={{
              position: "absolute", top: HEADER_HEIGHT, left: todayLeftPx,
              width: 1, height: tasks.length * ROW_HEIGHT,
              background: "var(--accent)", zIndex: 5, pointerEvents: "none",
            }} />
          )}

          {/* Task rows + bars */}
          {tasks.map((t, idx) => {
            const isSection = t.is_section === 1;
            const isCritical = t.is_critical === 1;
            const isDone = t.status === "Выполнена";
            const inWork = t.status === "В работе";

            const top = HEADER_HEIGHT + idx * ROW_HEIGHT;
            // Координаты бара
            let barLeft = 0;
            let barWidth = 0;
            if (t.start_date && t.end_date) {
              const s = parseDate(t.start_date);
              const e = parseDate(t.end_date);
              barLeft = daysBetween(ext.start, s) * DAY_PX;
              barWidth = (daysBetween(s, e) + 1) * DAY_PX;
            }

            const bgColor = isCritical ? BAR_BG.critical : isDone ? BAR_BG.done : inWork ? BAR_BG.inWork : BAR_BG.planned;
            const fillColor = isCritical ? BAR_BG.criticalFill : isDone ? BAR_FILL.done : inWork ? BAR_FILL.inWork : BAR_FILL.planned;
            const progressW = (t.progress / 100) * barWidth;

            return (
              <div key={t.name}
                   style={{
                     position: "absolute", left: 0, top, width: "100%", height: ROW_HEIGHT,
                     borderBottom: "1px solid var(--border-subtle)",
                     background: isSection ? "var(--bg-base)" : "transparent",
                   }}>
                {/* Сетка по дням (фон) */}
                {dayCells.map((c, i) => (
                  <div key={i} style={{
                    position: "absolute", left: i * DAY_PX, top: 0, width: DAY_PX, height: "100%",
                    background: c.isWeekend ? "rgba(0,0,0,0.04)" : "transparent",
                    borderRight: i % 7 === 6 ? "1px dashed var(--border-subtle)" : "none",
                    pointerEvents: "none",
                  }} />
                ))}

                {/* Бар задачи */}
                {barWidth > 0 && (
                  <div
                    onClick={() => onTaskClick?.(t.name)}
                    style={{
                      position: "absolute",
                      left: barLeft,
                      top: isSection ? 8 : 6,
                      width: barWidth,
                      height: isSection ? ROW_HEIGHT - 16 : ROW_HEIGHT - 12,
                      background: bgColor,
                      borderRadius: isSection ? 3 : 6,
                      cursor: "pointer",
                      boxShadow: isCritical ? "0 0 0 1px rgba(248,113,113,0.4)" : "none",
                      overflow: "hidden",
                    }}>
                    {/* Заливка прогресса */}
                    <div style={{
                      width: progressW,
                      height: "100%",
                      background: fillColor,
                      transition: "width 0.3s ease",
                    }} />
                    {!isSection && (
                      <div style={{
                        position: "absolute", left: 8, top: 0,
                        height: "100%", display: "flex", alignItems: "center",
                        fontSize: 10, color: "var(--text-primary)", fontWeight: 500,
                        textShadow: "0 1px 2px rgba(0,0,0,0.3)",
                        pointerEvents: "none",
                      }}>
                        {t.progress > 0 && `${Math.round(t.progress)}%`}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {/* Заглушка-высота для контейнера */}
          <div style={{ height: HEADER_HEIGHT + tasks.length * ROW_HEIGHT }} />
        </div>
      </div>
    </div>
  );
}
