"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";

interface ActiveCheckIn {
  name: string;
  foreman_name: string;
  project: string;
  check_in_time: string;
  weather: string | null;
  temperature_c: number | null;
  workers_count: number;
  distance_from_project_m: number | null;
}

interface Project {
  name: string;
  title?: string;
}

const KINDS = ["Начало смены", "Конец смены", "Приёмка", "Промежуточная проверка"];

export default function CheckinPage() {
  const [project, setProject] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [foreman, setForeman] = useState("");
  const [kind, setKind] = useState("Начало смены");
  const [workers, setWorkers] = useState<number>(0);
  const [engineers, setEngineers] = useState<number>(0);
  const [equipment, setEquipment] = useState("");
  const [notes, setNotes] = useState("");

  const [gps, setGps] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [activeNow, setActiveNow] = useState<ActiveCheckIn[]>([]);
  const toast = useToast();

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => {
        const arr = Array.isArray(d) ? d : [];
        setProjects(arr);
        if (arr.length > 0) setProject(arr[0].name);
      });
    reloadActive();
    // Сохранённый foreman_name из localStorage
    const saved = typeof window !== "undefined" ? localStorage.getItem("olimp-foreman-name") : null;
    if (saved) setForeman(saved);
  }, []);

  function reloadActive() {
    fetch("/api/foreman-checkin?view=active")
      .then((r) => r.json())
      .then((d) => setActiveNow(Array.isArray(d) ? d : []))
      .catch(() => {});
  }

  function captureGps() {
    if (!navigator.geolocation) {
      setGpsError("Геолокация недоступна на этом устройстве");
      return;
    }
    setGpsLoading(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setGpsLoading(false);
        toast.success(`📍 GPS захвачен · точность ${Math.round(pos.coords.accuracy)} м`);
      },
      (err) => {
        setGpsError(err.message || "Не удалось получить GPS");
        setGpsLoading(false);
        toast.error("Не удалось получить GPS — проверь разрешение");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  async function notifyArrival(etaMinutes: number) {
    if (!project) { toast.error("Выбери проект"); return; }
    if (!foreman.trim()) { toast.error("Укажи ФИО"); return; }
    localStorage.setItem("olimp-foreman-name", foreman);

    const r = await fetch("/api/foreman-checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "notify_arrival",
        project, foreman_name: foreman,
        eta_minutes: etaMinutes,
      }),
    });
    const d = await r.json();
    if (d.error) {
      toast.error(d.error);
      return;
    }
    if (d.sent) {
      toast.success(etaMinutes > 0
        ? `🚐 Заказчик уведомлён: выезд, ETA ${etaMinutes} мин`
        : `📍 Заказчик уведомлён: прибыли на объект`, 6000);
    } else {
      toast.warn("Сообщение сформировано, но Telegram не сконфигурирован (TELEGRAM_BOT_TOKEN)");
    }
  }

  async function submit() {
    if (!project) { toast.error("Выбери проект"); return; }
    if (!foreman.trim()) { toast.error("Укажи ФИО"); return; }

    // Запомним имя локально
    localStorage.setItem("olimp-foreman-name", foreman);

    setSubmitting(true);
    try {
      const r = await fetch("/api/foreman-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project, foreman_name: foreman, kind,
          lat: gps?.lat, lng: gps?.lng, accuracy_m: gps?.accuracy,
          workers_count: workers, engineers_count: engineers,
          equipment_on_site: equipment, notes,
        }),
      });
      const d = await r.json();
      if (d.error) {
        toast.error(d.error);
        return;
      }
      const weather = d.weather ? ` · ${d.weather}` : "";
      const distance = d.distance_from_project_m !== null
        ? ` · ${d.distance_from_project_m < 500 ? "✓ на объекте" : `⚠️ ${d.distance_from_project_m}м от проекта`}`
        : "";
      toast.success(`✓ Чек-ин ${d.name}${weather}${distance}`, 7000);
      // Сброс полей
      setEquipment("");
      setNotes("");
      reloadActive();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ padding: "20px 18px", minHeight: "100vh", background: "var(--bg-base)", maxWidth: 560, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>
        📍 Чек-ин на объекте
      </h1>
      <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4, marginBottom: 18 }}>
        Прораб открывает смену с GPS, погодой и фото. Mobile-friendly.
      </p>

      {/* GPS захват */}
      <div style={{
        padding: 14, marginBottom: 14,
        borderRadius: 12, border: `1px solid ${gps ? "var(--success)" : "var(--border-subtle)"}`,
        background: gps ? "rgba(34,197,94,0.06)" : "var(--bg-elevated)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace" }}>
              GPS-координаты
            </div>
            {gps ? (
              <div style={{ fontSize: 13, marginTop: 4, color: "var(--success)" }}>
                📍 {gps.lat.toFixed(6)}, {gps.lng.toFixed(6)} · ±{Math.round(gps.accuracy)}м
              </div>
            ) : gpsError ? (
              <div style={{ fontSize: 12, marginTop: 4, color: "var(--danger)" }}>{gpsError}</div>
            ) : (
              <div style={{ fontSize: 12, marginTop: 4, color: "var(--text-tertiary)" }}>
                Не захвачен — нажми кнопку
              </div>
            )}
          </div>
          <button onClick={captureGps} disabled={gpsLoading}
                  style={{
                    padding: "10px 16px", fontSize: 13, fontWeight: 500,
                    background: gps ? "var(--success)" : "var(--accent)",
                    color: "white", border: "none", borderRadius: 10, cursor: "pointer",
                    opacity: gpsLoading ? 0.6 : 1,
                  }}>
            {gpsLoading ? "..." : gps ? "↻ Обновить" : "📍 Захватить GPS"}
          </button>
        </div>
      </div>

      {/* One-tap уведомление заказчику (Housecall Pro / Jobber-style) */}
      <div style={{
        display: "flex", gap: 8, marginBottom: 14,
      }}>
        <button onClick={() => notifyArrival(25)} disabled={!project || !foreman.trim()}
                style={{
                  flex: 1, padding: "12px", fontSize: 13, fontWeight: 500,
                  background: "var(--bg-elevated)", color: "var(--text-primary)",
                  border: "1px solid var(--accent)", borderRadius: 10, cursor: "pointer",
                  opacity: (!project || !foreman.trim()) ? 0.5 : 1,
                }}>
          🚐 Я выехал (≈25 мин)
        </button>
        <button onClick={() => notifyArrival(0)} disabled={!project || !foreman.trim()}
                style={{
                  flex: 1, padding: "12px", fontSize: 13, fontWeight: 500,
                  background: "var(--bg-elevated)", color: "var(--text-primary)",
                  border: "1px solid var(--success)", borderRadius: 10, cursor: "pointer",
                  opacity: (!project || !foreman.trim()) ? 0.5 : 1,
                }}>
          📍 Я на объекте
        </button>
      </div>

      {/* Form */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="ФИО прораба *">
          <input value={foreman} onChange={(e) => setForeman(e.target.value)}
                 placeholder="Иванов И.И."
                 style={inpStyle} />
        </Field>

        <Field label="Проект *">
          <select value={project} onChange={(e) => setProject(e.target.value)} style={inpStyle}>
            <option value="">— выбери —</option>
            {projects.map((p) => (
              <option key={p.name} value={p.name}>{p.name}{p.title ? ` — ${p.title}` : ""}</option>
            ))}
          </select>
        </Field>

        <Field label="Тип события *">
          <select value={kind} onChange={(e) => setKind(e.target.value)} style={inpStyle}>
            {KINDS.map((k) => <option key={k}>{k}</option>)}
          </select>
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Рабочих">
            <input type="number" min={0} value={workers}
                   onChange={(e) => setWorkers(parseInt(e.target.value) || 0)}
                   style={inpStyle} />
          </Field>
          <Field label="ИТР">
            <input type="number" min={0} value={engineers}
                   onChange={(e) => setEngineers(parseInt(e.target.value) || 0)}
                   style={inpStyle} />
          </Field>
        </div>

        <Field label="Техника на объекте">
          <input value={equipment} onChange={(e) => setEquipment(e.target.value)}
                 placeholder="КАМАЗ 65115, экскаватор ЭКГ-5А..." style={inpStyle} />
        </Field>

        <Field label="Комментарий">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                    placeholder="Что началось / закончилось / замечания..."
                    style={{ ...inpStyle, minHeight: 64, fontFamily: "inherit", resize: "vertical" }} />
        </Field>

        <button onClick={submit} disabled={submitting}
                style={{
                  padding: "14px 20px", fontSize: 15, fontWeight: 600,
                  background: "var(--accent)", color: "white",
                  border: "none", borderRadius: 12, cursor: "pointer",
                  opacity: submitting ? 0.6 : 1, marginTop: 4,
                }}>
          {submitting ? "Отправляю..." : "✓ Зафиксировать чек-ин"}
        </button>
      </div>

      {/* Кто сейчас на объекте */}
      {activeNow.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 500, margin: "0 0 10px" }}>
            🟢 Сейчас на объекте ({activeNow.length})
          </h3>
          {activeNow.map((c) => (
            <div key={c.name} style={{
              padding: 12, marginBottom: 8, borderRadius: 9,
              background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
              display: "flex", justifyContent: "space-between", gap: 10,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{c.foreman_name}</div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                  {c.project} · {c.workers_count} рабочих
                </div>
                {c.weather && (
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                    🌤 {c.weather}{c.temperature_c !== null && `, ${c.temperature_c}°C`}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", textAlign: "right", fontFamily: "monospace" }}>
                {new Date(c.check_in_time).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                {c.distance_from_project_m !== null && (
                  <div style={{ marginTop: 3, color: c.distance_from_project_m < 500 ? "var(--success)" : "var(--warning)" }}>
                    📍 {c.distance_from_project_m}м
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{
        display: "block", fontSize: 10.5, color: "var(--text-tertiary)",
        textTransform: "uppercase", letterSpacing: "0.05em",
        fontFamily: "monospace", marginBottom: 4,
      }}>{label}</label>
      {children}
    </div>
  );
}

const inpStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px", fontSize: 14,
  background: "var(--bg-elevated)", color: "var(--text-primary)",
  border: "1px solid var(--border-subtle)", borderRadius: 9, outline: "none",
};
