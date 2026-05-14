import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

export async function PUT(request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const body = await request.json();
  const res = await fetch(`${base}/api/method/olimp_construction.api.risks.save_risk`, {
    method: "POST",
    headers: { Authorization: auth(), "Content-Type": "application/json" },
    body: JSON.stringify({ data: { ...body, name } }),
    cache: "no-store",
  });
  if (!res.ok) return NextResponse.json({ error: `Frappe: ${res.status}` }, { status: res.status });
  const data = await res.json();
  return NextResponse.json(data.message ?? {});
}

export async function DELETE(_: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const res = await fetch(
    `${base}/api/method/olimp_construction.api.risks.delete_risk?name=${encodeURIComponent(name)}`,
    { method: "POST", headers: { Authorization: auth() }, cache: "no-store" }
  );
  if (!res.ok) return NextResponse.json({ error: `Frappe: ${res.status}` }, { status: res.status });
  const data = await res.json();
  return NextResponse.json(data.message ?? {});
}

export async function POST(request: Request, { params }: { params: Promise<{ name: string }> }) {
  // apply_to_estimate
  const { name } = await params;
  const body = await request.json();
  if (!body.estimate) return NextResponse.json({ error: "estimate is required" }, { status: 400 });
  const res = await fetch(
    `${base}/api/method/olimp_construction.api.risks.apply_to_estimate`,
    {
      method: "POST",
      headers: { Authorization: auth(), "Content-Type": "application/json" },
      body: JSON.stringify({ risk: name, estimate: body.estimate }),
      cache: "no-store",
    }
  );
  if (!res.ok) return NextResponse.json({ error: `Frappe: ${res.status}` }, { status: res.status });
  const data = await res.json();
  return NextResponse.json(data.message ?? {});
}
