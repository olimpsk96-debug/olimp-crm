import { NextRequest, NextResponse } from "next/server";

const base = process.env.FRAPPE_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

export async function POST(req: NextRequest) {
  const { email, enabled } = await req.json();
  const res = await fetch(
    `${base}/api/method/olimp_construction.api.users.toggle_employee`,
    {
      method: "POST",
      headers: { Authorization: auth(), "Content-Type": "application/json" },
      body: JSON.stringify({ email, enabled }),
    }
  );
  const data = await res.json();
  return NextResponse.json(data.message ?? {});
}
