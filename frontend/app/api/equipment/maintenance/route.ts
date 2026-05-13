import { NextResponse } from "next/server";

const base = process.env.FRAPPE_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

export async function POST(request: Request) {
  const body = await request.json();
  const res = await fetch(
    `${base}/api/method/olimp_construction.api.equipment.log_maintenance`,
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
