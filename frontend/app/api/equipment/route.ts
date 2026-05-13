import { NextResponse } from "next/server";

const base = process.env.FRAPPE_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const params = new URLSearchParams();
  if (searchParams.get("status")) params.set("status", searchParams.get("status")!);
  if (searchParams.get("category")) params.set("category", searchParams.get("category")!);
  const res = await fetch(
    `${base}/api/method/olimp_construction.api.equipment.get_list?${params}`,
    { headers: { Authorization: auth() }, cache: "no-store" }
  );
  const data = await res.json();
  return NextResponse.json(data.message ?? []);
}

export async function POST(request: Request) {
  const body = await request.json();
  const res = await fetch(
    `${base}/api/method/olimp_construction.api.equipment.save_equipment`,
    {
      method: "POST",
      headers: { Authorization: auth(), "Content-Type": "application/json" },
      body: JSON.stringify({ data: JSON.stringify(body) }),
      cache: "no-store",
    }
  );
  const data = await res.json();
  return NextResponse.json(data.message ?? {});
}
