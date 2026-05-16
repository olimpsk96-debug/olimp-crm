"use client";

import { useEffect, useRef, useState } from "react";

/** Photo Before/After viewer с двумя режимами:
 *  - "split"   — side-by-side (как сейчас в PhotoSlot)
 *  - "slider"  — overlay со слайдером (drag, как в BuilderTrend)
 *  - lightbox  — полноразмерный просмотр при клике
 *
 *  Используется в Punch List Item, Foreman Report, Inspection Run.
 */
export function BeforeAfterCompare({
  beforeUrl, afterUrl, beforeLabel = "До", afterLabel = "После",
  height = 260,
}: {
  beforeUrl?: string;
  afterUrl?: string;
  beforeLabel?: string;
  afterLabel?: string;
  height?: number;
}) {
  const [mode, setMode] = useState<"split" | "slider">("split");
  const [lightbox, setLightbox] = useState<"before" | "after" | null>(null);
  const [sliderPos, setSliderPos] = useState(50);
  const trackRef = useRef<HTMLDivElement>(null);

  const hasBoth = !!beforeUrl && !!afterUrl;

  function onSliderMove(e: React.MouseEvent | React.TouchEvent) {
    if (!trackRef.current) return;
    const r = trackRef.current.getBoundingClientRect();
    const x = "touches" in e ? (e.touches[0]?.clientX ?? 0) : e.clientX;
    const pct = Math.max(0, Math.min(100, ((x - r.left) / r.width) * 100));
    setSliderPos(pct);
  }

  return (
    <div>
      {hasBoth && (
        <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
          <button onClick={() => setMode("split")} style={tabBtn(mode === "split")}>↔ Split</button>
          <button onClick={() => setMode("slider")} style={tabBtn(mode === "slider")}>⇿ Slider</button>
        </div>
      )}

      {mode === "split" || !hasBoth ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <PhotoBox label={beforeLabel} url={beforeUrl} onZoom={() => beforeUrl && setLightbox("before")} height={height} />
          <PhotoBox label={afterLabel}  url={afterUrl}  onZoom={() => afterUrl && setLightbox("after")} height={height} />
        </div>
      ) : (
        <div
          ref={trackRef}
          onMouseMove={onSliderMove}
          onTouchMove={onSliderMove}
          style={{
            position: "relative", width: "100%", height,
            borderRadius: 10, overflow: "hidden",
            background: "var(--bg-elevated)",
            cursor: "ew-resize", userSelect: "none",
          }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={afterUrl} alt={afterLabel}
               style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }} />
          <div style={{
            position: "absolute", top: 0, left: 0, height: "100%",
            width: `${sliderPos}%`, overflow: "hidden",
            borderRight: "2px solid white",
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={beforeUrl} alt={beforeLabel}
                 style={{ width: trackRef.current?.clientWidth || "100%", height: "100%", objectFit: "cover" }} />
          </div>
          {/* Handle */}
          <div style={{
            position: "absolute", top: 0, height: "100%", left: `${sliderPos}%`,
            width: 2, background: "white", pointerEvents: "none",
            boxShadow: "0 0 8px rgba(0,0,0,0.5)",
          }}>
            <div style={{
              position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
              width: 30, height: 30, borderRadius: "50%",
              background: "white", color: "var(--bg-base)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 700, boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
            }}>⇿</div>
          </div>
          {/* Labels */}
          <div style={{
            position: "absolute", bottom: 8, left: 8,
            padding: "2px 8px", background: "rgba(0,0,0,0.65)", color: "white",
            fontSize: 11, fontWeight: 600, borderRadius: 4, pointerEvents: "none",
          }}>{beforeLabel}</div>
          <div style={{
            position: "absolute", bottom: 8, right: 8,
            padding: "2px 8px", background: "rgba(0,0,0,0.65)", color: "white",
            fontSize: 11, fontWeight: 600, borderRadius: 4, pointerEvents: "none",
          }}>{afterLabel}</div>
        </div>
      )}

      {lightbox && (
        <Lightbox
          url={lightbox === "before" ? beforeUrl! : afterUrl!}
          label={lightbox === "before" ? beforeLabel : afterLabel}
          onClose={() => setLightbox(null)}
          onSwitch={hasBoth ? () => setLightbox(lightbox === "before" ? "after" : "before") : undefined}
        />
      )}
    </div>
  );
}

function PhotoBox({ label, url, onZoom, height }: {
  label: string; url?: string; onZoom: () => void; height: number;
}) {
  return (
    <div style={{
      padding: 8, borderRadius: 10, background: "var(--bg-base)",
      border: "1px solid var(--border-subtle)",
    }}>
      <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", marginBottom: 6, textTransform: "uppercase", fontFamily: "monospace", letterSpacing: "0.05em" }}>
        {label}
      </div>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={label} onClick={onZoom}
             style={{ width: "100%", height, objectFit: "cover", borderRadius: 6, cursor: "zoom-in", display: "block" }} />
      ) : (
        <div style={{
          height, borderRadius: 6, background: "var(--bg-elevated)",
          border: "1px dashed var(--border-subtle)", display: "flex",
          alignItems: "center", justifyContent: "center",
          color: "var(--text-tertiary)", fontSize: 12,
        }}>Нет фото</div>
      )}
    </div>
  );
}

function Lightbox({ url, label, onClose, onSwitch }: {
  url: string; label: string; onClose: () => void; onSwitch?: () => void;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" || e.key === "ArrowLeft") onSwitch?.();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose, onSwitch]);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)",
      zIndex: 200, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: 30,
    }}>
      <div style={{ position: "absolute", top: 16, left: 24, color: "white", fontSize: 14, fontWeight: 500 }}>
        {label}
      </div>
      <button onClick={(e) => { e.stopPropagation(); onClose(); }}
              style={{ position: "absolute", top: 16, right: 24, background: "transparent", border: "none", color: "white", fontSize: 28, cursor: "pointer" }}>×</button>
      {onSwitch && (
        <button onClick={(e) => { e.stopPropagation(); onSwitch(); }}
                style={{
                  position: "absolute", top: "50%", right: 30, transform: "translateY(-50%)",
                  background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.3)",
                  color: "white", width: 50, height: 50, borderRadius: "50%",
                  fontSize: 20, cursor: "pointer",
                }}>›</button>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={label} onClick={(e) => e.stopPropagation()}
           style={{ maxWidth: "90vw", maxHeight: "85vh", objectFit: "contain", borderRadius: 8 }} />
    </div>
  );
}

function tabBtn(active: boolean): React.CSSProperties {
  return {
    padding: "5px 12px", fontSize: 11.5, fontWeight: 500,
    background: active ? "var(--accent)" : "transparent",
    color: active ? "white" : "var(--text-secondary)",
    border: "1px solid var(--border-subtle)", borderRadius: 6, cursor: "pointer",
  };
}
