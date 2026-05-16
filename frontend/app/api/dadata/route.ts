import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (!body.inn) return NextResponse.json({ error: "inn required" }, { status: 400 });

  const url = body.apply_to_customer
    ? `${base}/api/method/olimp_construction.api.dadata.lookup_and_apply_to_customer`
    : `${base}/api/method/olimp_construction.api.dadata.lookup_by_inn`;

  const p = new URLSearchParams();
  p.set("inn", body.inn);
  if (body.customer_name) p.set("customer_name", body.customer_name);

  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: auth(), "Content-Type": "application/x-www-form-urlencoded" },
    body: p, cache: "no-store",
  });
  const d = await r.json();
  if (!r.ok || d.exception) return NextResponse.json({ error: d.exception }, { status: r.status });
  return NextResponse.json(d.message ?? d);
}
