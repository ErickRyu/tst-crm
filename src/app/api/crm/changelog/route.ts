import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { parseChangelog } from "@/lib/changelog";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "UPDATES.md");
    const raw = fs.readFileSync(filePath, "utf-8");
    const entries = parseChangelog(raw);
    return NextResponse.json({ data: entries });
  } catch {
    return NextResponse.json({ data: [] });
  }
}
