import { NextRequest, NextResponse } from "next/server";

const base = process.env.FRAPPE_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name") ?? "";
  const url = `${base}/api/method/olimp_construction.api.ks3.get_detail?name=${encodeURIComponent(name)}`;
  const res = await fetch(url, { headers: { Authorization: auth() }, cache: "no-store" });
  const data = await res.json();
  return NextResponse.json(data.message ?? {});
}
