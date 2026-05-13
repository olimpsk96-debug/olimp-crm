import { NextResponse } from "next/server";

const base = process.env.FRAPPE_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

export async function GET() {
  const res = await fetch(
    `${base}/api/method/olimp_construction.api.equipment.get_stats`,
    { headers: { Authorization: auth() }, cache: "no-store" }
  );
  const data = await res.json();
  return NextResponse.json(data.message ?? {});
}
