import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

export async function GET() {
  const res = await fetch(
    `${base}/api/method/olimp_construction.api.tender.get_pipeline`,
    { headers: { Authorization: auth() }, cache: "no-store" }
  );

  if (!res.ok) {
    return NextResponse.json({ error: `Frappe error: ${res.status}` }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data.message ?? []);
}

export async function POST(request: Request) {
  const body = await request.json();
  const res = await fetch(
    `${base}/api/method/olimp_construction.api.tender.create_tender`,
    {
      method: "POST",
      headers: { Authorization: auth(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    return NextResponse.json({ error: `Frappe error: ${res.status}` }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data.message ?? {});
}
