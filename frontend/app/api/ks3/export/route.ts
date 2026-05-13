import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

const METHODS: Record<string, { method: string; mime: string; ext: string }> = {
  pdf: {
    method: "olimp_construction.api.exports.ks3_pdf",
    mime: "application/pdf",
    ext: "pdf",
  },
  xlsx: {
    method: "olimp_construction.api.exports.ks3_excel",
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ext: "xlsx",
  },
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");
  const format = (searchParams.get("format") ?? "pdf").toLowerCase();

  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const spec = METHODS[format];
  if (!spec) return NextResponse.json({ error: "format must be pdf or xlsx" }, { status: 400 });

  const url = `${base}/api/method/${spec.method}?name=${encodeURIComponent(name)}`;
  const res = await fetch(url, { headers: { Authorization: auth() }, cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `Frappe: ${res.status}`, details: text }, { status: res.status });
  }

  const buf = await res.arrayBuffer();
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": spec.mime,
      "Content-Disposition": `attachment; filename="KS-3_${name}.${spec.ext}"`,
      "Cache-Control": "no-store",
    },
  });
}
