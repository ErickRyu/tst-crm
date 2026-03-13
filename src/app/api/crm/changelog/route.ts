import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { parseChangelog } from "@/lib/changelog";
import { requireAuth } from "@/lib/auth-helpers";

export async function GET() {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  try {
    const filePath = path.join(process.cwd(), "UPDATES.md");
    const raw = fs.readFileSync(filePath, "utf-8");
    const entries = parseChangelog(raw);
    return NextResponse.json({ data: entries });
  } catch {
    return NextResponse.json({ data: [] });
  }
}
