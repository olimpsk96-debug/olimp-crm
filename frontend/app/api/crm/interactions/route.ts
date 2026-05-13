import { NextRequest, NextResponse } from "next/server";

const base = process.env.FRAPPE_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const res = await fetch(
    `${base}/api/method/olimp_construction.api.crm.save_interaction`,
    {
      method: "POST",
      headers: { Authorization: auth(), "Content-Type": "application/json" },
      body: JSON.stringify({ data: body }),
    }
  );
  const data = await res.json();
  return NextResponse.json(data.message ?? {});
}

export async function DELETE(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name") ?? "";
  const res = await fetch(
    `${base}/api/method/olimp_construction.api.crm.delete_interaction`,
    {
      method: "POST",
      headers: { Authorization: auth(), "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }
  );
  const data = await res.json();
  return NextResponse.json(data.message ?? {});
}
