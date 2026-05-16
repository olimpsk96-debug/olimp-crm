import { NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";
const auth = () => `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`;

// GET /api/reconciliation?mode=partners&party_type=Customer
// GET /api/reconciliation?party_type=Customer&party=...&from_date=...&to_date=...
// GET /api/reconciliation?mode=export&party=...&from_date=...&to_date=...  (Excel)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") || "build";

  if (mode === "partners") {
    const p = new URLSearchParams();
    if (searchParams.get("party_type")) p.set("party_type", searchParams.get("party_type")!);
    if (searchParams.get("days")) p.set("days", searchParams.get("days")!);
    const r = await fetch(
      `${base}/api/method/olimp_construction.api.reconciliation.list_partners?${p}`,
      { headers: { Authorization: auth() }, cache: "no-store" },
    );
    if (!r.ok) return NextResponse.json({ error: `HTTP ${r.status}` }, { status: r.status });
    const d = await r.json();
    return NextResponse.json(d.message ?? []);
  }

  if (mode === "export") {
    const p = new URLSearchParams();
    for (const k of ["party_type", "party", "from_date", "to_date"]) {
      const v = searchParams.get(k);
      if (v) p.set(k, v);
    }
    const r = await fetch(
      `${base}/api/method/olimp_construction.api.reconciliation.export_xlsx?${p}`,
      { headers: { Authorization: auth() }, cache: "no-store" },
    );
    if (!r.ok) return NextResponse.json({ error: `HTTP ${r.status}` }, { status: r.status });
    const blob = await r.arrayBuffer();
    const filename = r.headers.get("content-disposition")?.match(/filename="?([^";]+)"?/i)?.[1] || "reconciliation.xlsx";
    return new NextResponse(blob, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  // build (default)
  const p = new URLSearchParams();
  for (const k of ["party_type", "party", "from_date", "to_date"]) {
    const v = searchParams.get(k);
    if (v) p.set(k, v);
  }
  const r = await fetch(
    `${base}/api/method/olimp_construction.api.reconciliation.build_reconciliation?${p}`,
    { headers: { Authorization: auth() }, cache: "no-store" },
  );
  if (!r.ok) return NextResponse.json({ error: `HTTP ${r.status}` }, { status: r.status });
  const d = await r.json();
  return NextResponse.json(d.message ?? d);
}
