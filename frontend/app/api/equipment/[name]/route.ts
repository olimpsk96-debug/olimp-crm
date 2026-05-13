import { NextResponse } from "next/server";

const base = process.env.FRAPPE_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const res = await fetch(
    `${base}/api/method/olimp_construction.api.equipment.get_detail?name=${encodeURIComponent(name)}`,
    { headers: { Authorization: auth() }, cache: "no-store" }
  );
  const data = await res.json();
  return NextResponse.json(data.message ?? null);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const body = await request.json();
  const res = await fetch(
    `${base}/api/method/olimp_construction.api.equipment.set_status`,
    {
      method: "POST",
      headers: { Authorization: auth(), "Content-Type": "application/json" },
      body: JSON.stringify({ name, status: body.status }),
      cache: "no-store",
    }
  );
  const data = await res.json();
  return NextResponse.json(data.message ?? {});
}
