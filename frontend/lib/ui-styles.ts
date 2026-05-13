import type { CSSProperties } from "react";

// ── Inputs / Buttons ────────────────────────────────────────────────────────

export const inputStyle: CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  borderRadius: 7,
  border: "1px solid var(--border-subtle)",
  background: "var(--bg-base)",
  color: "var(--text-primary)",
  fontSize: 13,
  boxSizing: "border-box",
};

export const btnPrimary: CSSProperties = {
  padding: "8px 16px",
  borderRadius: 8,
  border: "none",
  background: "var(--accent)",
  color: "#fff",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
};

export const btnSecondary: CSSProperties = {
  padding: "8px 16px",
  borderRadius: 8,
  border: "1px solid var(--border-subtle)",
  background: "none",
  color: "var(--text-secondary)",
  fontSize: 13,
  cursor: "pointer",
};

export const addBtn: CSSProperties = {
  width: "100%",
  marginBottom: 14,
  padding: "8px",
  borderRadius: 8,
  border: "1px dashed var(--border-subtle)",
  background: "none",
  color: "var(--accent)",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 500,
};

export const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 11,
  color: "var(--text-tertiary)",
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

// ── Drawer / Overlay ────────────────────────────────────────────────────────

export const backdropStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.5)",
  zIndex: 40,
};

export const drawerStyle: CSSProperties = {
  position: "fixed",
  top: 0,
  right: 0,
  height: "100vh",
  background: "var(--bg-elevated)",
  borderLeft: "1px solid var(--border-subtle)",
  zIndex: 50,
  display: "flex",
  flexDirection: "column",
  overflowY: "auto",
};

export const drawerHeaderStyle: CSSProperties = {
  padding: "20px 24px",
  borderBottom: "1px solid var(--border-subtle)",
  display: "flex",
  justifyContent: "space-between",
};

export const closeBtn: CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "var(--text-secondary)",
  fontSize: 20,
  lineHeight: 1,
};

// ── Panels / Lists / Cards ──────────────────────────────────────────────────

export const panelStyle: CSSProperties = {
  background: "var(--bg-elevated)",
  border: "1px solid var(--border-subtle)",
  borderRadius: 12,
  padding: "16px 20px",
};

export const panelHead: CSSProperties = {
  fontSize: 11,
  color: "var(--text-tertiary)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  margin: "0 0 14px",
  fontWeight: 500,
};

export const listItemStyle: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid var(--border-subtle)",
  marginBottom: 8,
  background: "var(--bg-base)",
};

export const emptyStyle: CSSProperties = {
  color: "var(--text-tertiary)",
  fontSize: 13,
  textAlign: "center",
  marginTop: 24,
};

export const formCard: CSSProperties = {
  background: "var(--bg-base)",
  borderRadius: 10,
  padding: 16,
  marginBottom: 16,
  border: "1px solid var(--border-subtle)",
};

// ── Stat cards ──────────────────────────────────────────────────────────────

export const statCard: CSSProperties = {
  background: "var(--bg-elevated)",
  border: "1px solid var(--border-subtle)",
  borderRadius: 10,
  padding: "14px 16px",
};

export const statLabel: CSSProperties = {
  fontSize: 10,
  color: "var(--text-tertiary)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  margin: 0,
};

export const statValue: CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  margin: "4px 0 2px",
  fontFamily: "monospace",
};

export const statSub: CSSProperties = {
  fontSize: 11,
  color: "var(--text-tertiary)",
  margin: 0,
};
