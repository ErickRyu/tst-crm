import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name") || "연락처";
  const phone = req.nextUrl.searchParams.get("phone") || "";
  const org = req.nextUrl.searchParams.get("org") || "";

  if (!phone) {
    return NextResponse.json({ error: "phone is required" }, { status: 400 });
  }

  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${name}`,
    `N:${name};;;;`,
    `TEL;TYPE=CELL:${phone}`,
  ];
  if (org) lines.push(`ORG:${org}`);
  lines.push(`NOTE:${org ? org + " " : ""}문의 환자`);
  lines.push("END:VCARD");
  const vcard = lines.join("\r\n");

  return new NextResponse(vcard, {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `inline; filename="${encodeURIComponent(name)}.vcf"`,
    },
  });
}
