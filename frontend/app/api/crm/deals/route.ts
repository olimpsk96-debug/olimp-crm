import { NextRequest, NextResponse } from "next/server";

const base = process.env.FRAPPE_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status") ?? "";
  const url = `${base}/api/method/olimp_construction.api.crm.get_deals?status=${encodeURIComponent(status)}`;
  const res = await fetch(url, { headers: { Authorization: auth() }, cache: "no-store" });
  const data = await res.json();
  return NextResponse.json(data.message ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const method = body._method === "status" ? "set_deal_status" : "save_deal";
  const payload = method === "set_deal_status"
    ? { name: body.name, status: body.status }
    : { data: body };

  const res = await fetch(
    `${base}/api/method/olimp_construction.api.crm.${method}`,
    {
      method: "POST",
      headers: { Authorization: auth(), "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  const data = await res.json();
  return NextResponse.json(data.message ?? {});
}
