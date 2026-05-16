import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const p = new URLSearchParams();
  for (const k of ["category", "active_only"]) {
    const v = searchParams.get(k);
    if (v !== null && v !== "") p.set(k, v);
  }
  const r = await fetch(
    `${base}/api/method/olimp_construction.api.inspections.get_templates?${p}`,
    { headers: { Authorization: auth() }, cache: "no-store" },
  );
  if (!r.ok) return NextResponse.json({ error: `HTTP ${r.status}` }, { status: r.status });
  const d = await r.json();
  return NextResponse.json(d.message ?? []);
}

export async function POST(request: Request) {
  const body = await request.json();
  // Start inspection
  const p = new URLSearchParams();
  for (const k of ["template", "project", "inspector_name", "title"]) {
    if (body[k]) p.set(k, body[k]);
  }
  const r = await fetch(
    `${base}/api/method/olimp_construction.api.inspections.start_inspection`,
    {
      method: "POST",
      headers: { Authorization: auth(), "Content-Type": "application/x-www-form-urlencoded" },
      body: p, cache: "no-store",
    },
  );
  const d = await r.json();
  if (!r.ok || d.exception) return NextResponse.json({ error: d.exception }, { status: r.status });
  return NextResponse.json(d.message ?? d);
}
