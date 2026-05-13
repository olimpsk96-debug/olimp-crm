import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

export async function POST(request: Request) {
  const { name } = await request.json();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const res = await fetch(
    `${base}/api/method/olimp_construction.api.catalog.use_item?name=${encodeURIComponent(name)}`,
    { method: "POST", headers: { Authorization: auth() }, cache: "no-store" }
  );
  if (!res.ok) return NextResponse.json({ error: `Frappe: ${res.status}` }, { status: res.status });
  const data = await res.json();
  return NextResponse.json(data.message ?? {});
}
