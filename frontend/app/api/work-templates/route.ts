import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const params = new URLSearchParams();
  ["category", "source", "is_verified", "search"].forEach((k) => {
    const v = searchParams.get(k);
    if (v !== null && v !== "") params.set(k, v);
  });

  const r = await fetch(
    `${base}/api/method/olimp_construction.api.ai.work_templates.get_list?${params}`,
    { headers: { Authorization: auth() }, cache: "no-store" },
  );
  if (!r.ok) return NextResponse.json({ error: `HTTP ${r.status}` }, { status: r.status });
  const d = await r.json();
  return NextResponse.json(d.message ?? []);
}

export async function POST(request: Request) {
  const body = await request.json();
  const params = new URLSearchParams();
  params.set("data", JSON.stringify(body));

  const r = await fetch(
    `${base}/api/method/olimp_construction.api.ai.work_templates.save_template`,
    {
      method: "POST",
      headers: { Authorization: auth(), "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
      cache: "no-store",
    },
  );
  const d = await r.json();
  if (!r.ok || d.exception) {
    return NextResponse.json({ error: d.exception || `HTTP ${r.status}` }, { status: r.status });
  }
  return NextResponse.json(d.message ?? d);
}
