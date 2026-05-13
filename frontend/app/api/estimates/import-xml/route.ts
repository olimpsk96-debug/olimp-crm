import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
const auth = () => {
  const key = process.env.FRAPPE_API_KEY;
  const secret = process.env.FRAPPE_API_SECRET;
  return `token ${key}:${secret}`;
};

export async function POST(request: Request) {
  const { xml_content, tender, project, estimate_name } = await request.json();

  const res = await fetch(`${base}/api/method/olimp_construction.api.estimate.import_from_gs_xml`, {
    method: "POST",
    headers: { Authorization: auth(), "Content-Type": "application/json" },
    body: JSON.stringify({ xml_content, tender, project, estimate_name }),
    cache: "no-store",
  });

  if (!res.ok) return NextResponse.json({ error: `Frappe: ${res.status}` }, { status: res.status });
  const data = await res.json();
  return NextResponse.json(data.message ?? {});
}
