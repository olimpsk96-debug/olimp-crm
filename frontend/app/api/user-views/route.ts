import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const route = searchParams.get("route");
  const url = `${base}/api/method/olimp_construction.api.user_views.get_views${route ? `?route=${encodeURIComponent(route)}` : ""}`;
  const r = await fetch(url, { headers: { Authorization: auth() }, cache: "no-store" });
  if (!r.ok) return NextResponse.json({ error: `HTTP ${r.status}` }, { status: r.status });
  const d = await r.json();
  return NextResponse.json(d.message ?? []);
}

export async function POST(request: Request) {
  const body = await request.json();
  const p = new URLSearchParams();
  for (const k of ["view_name", "route", "sort_field", "sort_order", "is_shared", "is_pinned", "update_name"]) {
    if (body[k] !== undefined && body[k] !== null && body[k] !== "") p.set(k, String(body[k]));
  }
  if (body.filters) p.set("filters", JSON.stringify(body.filters));

  const r = await fetch(
    `${base}/api/method/olimp_construction.api.user_views.save_view`,
    {
      method: "POST",
      headers: { Authorization: auth(), "Content-Type": "application/x-www-form-urlencoded" },
      body: p, cache: "no-store",
    },
  );
  const d = await r.json();
  if (!r.ok || d.exception) return NextResponse.json({ error: d.exception }, { status: r.status });
  return NextResponse.json(d.message ?? {});
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const p = new URLSearchParams();
  p.set("name", name);
  const r = await fetch(
    `${base}/api/method/olimp_construction.api.user_views.delete_view`,
    {
      method: "POST",
      headers: { Authorization: auth(), "Content-Type": "application/x-www-form-urlencoded" },
      body: p, cache: "no-store",
    },
  );
  const d = await r.json();
  return NextResponse.json(d.message ?? d);
}
