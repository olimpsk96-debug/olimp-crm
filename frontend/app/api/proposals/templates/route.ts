import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");

  if (name) {
    const p = new URLSearchParams({ name });
    const r = await fetch(
      `${base}/api/method/olimp_construction.api.proposals.get_template?${p}`,
      { headers: { Authorization: auth() }, cache: "no-store" },
    );
    if (!r.ok) return NextResponse.json({ error: `HTTP ${r.status}` }, { status: r.status });
    const d = await r.json();
    return NextResponse.json(d.message ?? d);
  }

  const p = new URLSearchParams();
  if (searchParams.get("active_only")) p.set("active_only", searchParams.get("active_only")!);
  const r = await fetch(
    `${base}/api/method/olimp_construction.api.proposals.list_templates?${p}`,
    { headers: { Authorization: auth() }, cache: "no-store" },
  );
  if (!r.ok) return NextResponse.json({ error: `HTTP ${r.status}` }, { status: r.status });
  const d = await r.json();
  return NextResponse.json(d.message ?? d);
}

export async function POST(request: Request) {
  const body = await request.json();
  const p = new URLSearchParams();
  for (const k of ["name", "template_id", "title", "category", "description",
                    "is_active", "default_content_json"]) {
    if (body[k] !== undefined && body[k] !== null) p.set(k, String(body[k]));
  }
  const r = await fetch(
    `${base}/api/method/olimp_construction.api.proposals.save_template`,
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
