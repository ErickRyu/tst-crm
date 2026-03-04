import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { readFileSync } from "fs";

config({ path: ".env.local" });
config();

const sql = neon(process.env.DATABASE_URL);

async function run() {
  const migration = readFileSync("drizzle/0006_sms_templates_is_default.sql", "utf-8");
  // Strip comment lines first, then split on semicolons
  const cleaned = migration.replace(/--.*$/gm, "");
  const statements = cleaned
    .split(";")
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const stmt of statements) {
    console.log("Executing:", stmt.slice(0, 80) + "...");
    await sql(stmt);
    console.log("OK");
  }

  console.log("Migration 0006 complete!");
}

run().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
