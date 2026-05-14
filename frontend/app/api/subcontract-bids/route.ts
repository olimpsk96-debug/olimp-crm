import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const params = new URLSearchParams();
  for (const k of ["project", "status", "work_type"]) {
    const v = searchParams.get(k);
    if (v) params.set(k, v);
  }
  const res = await fetch(
    `${base}/api/method/olimp_construction.api.subcontract.get_list?${params}`,
    { headers: { Authorization: auth() }, cache: "no-store" }
  );
  if (!res.ok) return NextResponse.json({ error: `Frappe: ${res.status}` }, { status: res.status });
  const data = await res.json();
  return NextResponse.json(data.message ?? []);
}

export async function POST(request: Request) {
  const body = await request.json();
  const res = await fetch(`${base}/api/method/olimp_construction.api.subcontract.save_bid_request`, {
    method: "POST",
    headers: { Authorization: auth(), "Content-Type": "application/json" },
    body: JSON.stringify({ data: body }),
    cache: "no-store",
  });
  if (!res.ok) return NextResponse.json({ error: `Frappe: ${res.status}` }, { status: res.status });
  const data = await res.json();
  return NextResponse.json(data.message ?? {});
}
