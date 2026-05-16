import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const project = searchParams.get("project");
  const view = searchParams.get("view") ?? "today";
  const endpoint = view === "active" ? "get_active_now" : "get_today";
  let url = `${base}/api/method/olimp_construction.api.foreman_checkin.${endpoint}`;
  if (project && view === "today") url += `?project=${encodeURIComponent(project)}`;
  const r = await fetch(url, { headers: { Authorization: auth() }, cache: "no-store" });
  if (!r.ok) return NextResponse.json({ error: `HTTP ${r.status}` }, { status: r.status });
  const d = await r.json();
  return NextResponse.json(d.message ?? []);
}

export async function POST(request: Request) {
  const body = await request.json();
  const p = new URLSearchParams();
  for (const k of ["project", "foreman_name", "kind", "lat", "lng", "accuracy_m",
                    "photo_url", "photo_caption", "workers_count", "engineers_count",
                    "equipment_on_site", "notes"]) {
    if (body[k] !== undefined && body[k] !== null && body[k] !== "") p.set(k, String(body[k]));
  }
  const r = await fetch(
    `${base}/api/method/olimp_construction.api.foreman_checkin.create_check_in`,
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
