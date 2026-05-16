import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

export async function GET() {
  const r = await fetch(
    `${base}/api/method/olimp_construction.api.lead_routing.get_team_workload`,
    { headers: { Authorization: auth() }, cache: "no-store" },
  );
  if (!r.ok) return NextResponse.json({ error: `HTTP ${r.status}` }, { status: r.status });
  const d = await r.json();
  return NextResponse.json(d.message ?? []);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (body.action === "refresh_missed") {
    const r = await fetch(
      `${base}/api/method/olimp_construction.api.lead_routing.refresh_missed`,
      { method: "POST", headers: { Authorization: auth() }, cache: "no-store" },
    );
    const d = await r.json();
    return NextResponse.json(d.message ?? d);
  }
  // auto_assign
  const p = new URLSearchParams();
  if (body.deal_name) p.set("deal_name", body.deal_name);
  const r = await fetch(
    `${base}/api/method/olimp_construction.api.lead_routing.auto_assign`,
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
