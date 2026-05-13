import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mr = searchParams.get("mr");
  if (!mr) return NextResponse.json({ error: "mr required" }, { status: 400 });
  const res = await fetch(
    `${base}/api/method/olimp_construction.api.stock.preview_receipt_from_mr?mr_name=${encodeURIComponent(mr)}`,
    { headers: { Authorization: auth() }, cache: "no-store" }
  );
  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `Frappe: ${res.status}`, details: text }, { status: res.status });
  }
  const data = await res.json();
  return NextResponse.json(data.message ?? {});
}
