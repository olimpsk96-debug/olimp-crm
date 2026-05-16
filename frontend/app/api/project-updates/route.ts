import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

// GET /api/project-updates?project=PR-...&weeks=12 → лента апдейтов
// GET /api/project-updates?mode=portfolio&weeks=4   → здоровье портфеля
// GET /api/project-updates?mode=draft&project=...   → черновик апдейта
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") || "list";

  let method = "olimp_construction.api.project_updates.get_updates";
  const p = new URLSearchParams();
  if (mode === "portfolio") {
    method = "olimp_construction.api.project_updates.get_portfolio_health";
    if (searchParams.get("weeks")) p.set("weeks", searchParams.get("weeks")!);
  } else if (mode === "draft") {
    method = "olimp_construction.api.project_updates.get_draft_for";
    if (searchParams.get("project")) p.set("project", searchParams.get("project")!);
    if (searchParams.get("week_start")) p.set("week_start", searchParams.get("week_start")!);
  } else {
    if (searchParams.get("project")) p.set("project", searchParams.get("project")!);
    if (searchParams.get("weeks")) p.set("weeks", searchParams.get("weeks")!);
  }

  const r = await fetch(`${base}/api/method/${method}?${p}`, {
    headers: { Authorization: auth() },
    cache: "no-store",
  });
  if (!r.ok) return NextResponse.json({ error: `HTTP ${r.status}` }, { status: r.status });
  const d = await r.json();
  return NextResponse.json(d.message ?? d);
}

// POST /api/project-updates → save_update
export async function POST(request: Request) {
  const body = await request.json();
  const p = new URLSearchParams();
  for (const k of ["name", "project", "week_start", "health", "summary",
                   "blockers", "next_week_plan", "ai_drafted", "ai_model"]) {
    if (body[k] !== undefined && body[k] !== null) p.set(k, String(body[k]));
  }
  const r = await fetch(
    `${base}/api/method/olimp_construction.api.project_updates.save_update`,
    {
      method: "POST",
      headers: { Authorization: auth(), "Content-Type": "application/x-www-form-urlencoded" },
      body: p, cache: "no-store",
    },
  );
  const d = await r.json();
  if (!r.ok || d.exception) {
    return NextResponse.json({ error: d.exception || `HTTP ${r.status}` }, { status: r.status });
  }
  return NextResponse.json(d.message ?? d);
}

// DELETE /api/project-updates?name=CPU-...
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const p = new URLSearchParams({ name });
  const r = await fetch(
    `${base}/api/method/olimp_construction.api.project_updates.delete_update`,
    {
      method: "POST",
      headers: { Authorization: auth(), "Content-Type": "application/x-www-form-urlencoded" },
      body: p, cache: "no-store",
    },
  );
  const d = await r.json();
  if (!r.ok || d.exception) {
    return NextResponse.json({ error: d.exception || `HTTP ${r.status}` }, { status: r.status });
  }
  return NextResponse.json(d.message ?? d);
}
