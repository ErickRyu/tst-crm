import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import yaml from "js-yaml";

export async function GET() {
  const filePath = join(process.cwd(), "openapi-ad-db.yaml");
  const file = readFileSync(filePath, "utf-8");
  const spec = yaml.load(file);
  return NextResponse.json(spec);
}
