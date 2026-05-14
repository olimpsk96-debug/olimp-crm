import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("q") || "";
  const params = new URLSearchParams({
    doctype: "Supplier",
    fields: JSON.stringify(["name", "supplier_name", "supplier_group"]),
    limit_page_length: "100",
    order_by: "supplier_name asc",
  });
  if (search) {
    params.set("filters", JSON.stringify([["supplier_name", "like", `%${search}%`]]));
  }
  const res = await fetch(`${base}/api/method/frappe.client.get_list?${params}`, {
    headers: { Authorization: auth() },
    cache: "no-store",
  });
  if (!res.ok) return NextResponse.json({ error: `Frappe: ${res.status}` }, { status: res.status });
  const data = await res.json();
  return NextResponse.json(data.message ?? []);
}
