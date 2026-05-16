import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

export async function GET() {
  const r = await fetch(
    `${base}/api/method/olimp_construction.api.pipeline.get_ball_overdue_list`,
    { headers: { Authorization: auth() }, cache: "no-store" },
  );
  if (!r.ok) return NextResponse.json({ error: `HTTP ${r.status}` }, { status: r.status });
  const d = await r.json();
  return NextResponse.json(d.message ?? []);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (body.action === "refresh") {
    const r = await fetch(
      `${base}/api/method/olimp_construction.api.pipeline.refresh_ball_overdue`,
      { method: "POST", headers: { Authorization: auth() }, cache: "no-store" },
    );
    const d = await r.json();
    return NextResponse.json(d.message ?? {});
  }
  // shift_ball
  const p = new URLSearchParams();
  if (body.change_order_name) p.set("change_order_name", body.change_order_name);
  if (body.new_responsible) p.set("new_responsible", body.new_responsible);
  if (body.responsible_name) p.set("responsible_name", body.responsible_name);
  const r = await fetch(
    `${base}/api/method/olimp_construction.api.pipeline.shift_ball`,
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
