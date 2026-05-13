import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

const FILE_MAP: Record<string, string> = {
  tenders: "Tenders", projects: "Projects", estimates: "Estimates",
  stock: "Stock", certifications: "Certifications", ks2: "KS2",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const spec = searchParams.get("spec");
  if (!spec || !FILE_MAP[spec]) {
    return NextResponse.json({ error: `spec required, one of: ${Object.keys(FILE_MAP)}` }, { status: 400 });
  }
  const res = await fetch(
    `${base}/api/method/olimp_construction.api.exports.export_list?spec=${encodeURIComponent(spec)}`,
    { headers: { Authorization: auth() }, cache: "no-store" }
  );
  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `Frappe: ${res.status}`, details: text }, { status: res.status });
  }
  const buf = await res.arrayBuffer();
  const today = new Date().toISOString().split("T")[0];
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${FILE_MAP[spec]}_${today}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
