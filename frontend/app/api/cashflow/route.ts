import { NextResponse } from "next/server";

const base = process.env.FRAPPE_URL ?? "http://erp.olimp-ural.ru";

function auth() {
  return `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;
}

export async function GET() {
  const res = await fetch(
    `${base}/api/method/olimp_construction.api.cashflow.get_dashboard`,
    { headers: { Authorization: auth() }, cache: "no-store" }
  );
  const data = await res.json();
  return NextResponse.json(data.message ?? {});
}

export async function POST(request: Request) {
  const { balance } = await request.json();
  const res = await fetch(
    `${base}/api/method/olimp_construction.api.cashflow.set_balance`,
    {
      method: "POST",
      headers: { Authorization: auth(), "Content-Type": "application/json" },
      body: JSON.stringify({ amount: balance }),
      cache: "no-store",
    }
  );
  const data = await res.json();
  return NextResponse.json(data.message ?? {});
}
