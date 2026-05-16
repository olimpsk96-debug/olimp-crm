import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") || "list";

  let method = "olimp_construction.api.capacity.list_allocations";
  if (mode === "heatmap") method = "olimp_construction.api.capacity.get_heatmap";
  else if (mode === "crews") method = "olimp_construction.api.capacity.get_crews";

  const p = new URLSearchParams();
  for (const k of ["crew_name", "project", "from_week", "weeks"]) {
    const v = searchParams.get(k);
    if (v) p.set(k, v);
  }
  const r = await fetch(`${base}/api/method/${method}?${p}`, {
    headers: { Authorization: auth() }, cache: "no-store",
  });
  if (!r.ok) return NextResponse.json({ error: `HTTP ${r.status}` }, { status: r.status });
  const d = await r.json();
  return NextResponse.json(d.message ?? d);
}

export async function POST(request: Request) {
  const body = await request.json();
  const p = new URLSearchParams();
  for (const k of ["name", "crew_name", "project", "week_start",
                    "allocated_pct", "planned_hours", "workers_count",
                    "task_description"]) {
    if (body[k] !== undefined && body[k] !== null) p.set(k, String(body[k]));
  }
  const r = await fetch(
    `${base}/api/method/olimp_construction.api.capacity.save_allocation`,
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

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const p = new URLSearchParams({ name });
  const r = await fetch(
    `${base}/api/method/olimp_construction.api.capacity.delete_allocation`,
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
