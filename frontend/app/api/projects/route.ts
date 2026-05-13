import { NextRequest, NextResponse } from "next/server";

const base = process.env.FRAPPE_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status") ?? "";
  const customer = req.nextUrl.searchParams.get("customer") ?? "";
  const url = `${base}/api/method/olimp_construction.api.project.get_list?status=${encodeURIComponent(status)}&customer=${encodeURIComponent(customer)}`;
  const res = await fetch(url, { headers: { Authorization: auth() }, cache: "no-store" });
  const data = await res.json();
  return NextResponse.json(data.message ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const res = await fetch(
    `${base}/api/method/olimp_construction.api.project.save_project`,
    {
      method: "POST",
      headers: { Authorization: auth(), "Content-Type": "application/json" },
      body: JSON.stringify({ data: body }),
    }
  );
  const data = await res.json();
  return NextResponse.json(data.message ?? {});
}
