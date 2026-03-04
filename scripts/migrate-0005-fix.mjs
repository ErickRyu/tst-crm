import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const sql = neon(process.env.DATABASE_URL);

async function run() {
  // 1. Add sort_order column
  await sql`ALTER TABLE sms_templates ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0`;
  console.log("OK: sms_templates.sort_order added");

  // 2. Soft-delete duplicate templates
  await sql`UPDATE sms_templates SET is_active = 0, updated_at = now() WHERE key = 'missed_call' AND is_active = 1`;
  console.log("OK: missed_call soft-deleted");

  await sql`UPDATE sms_templates SET is_active = 0, updated_at = now() WHERE key = 'appointment_confirm' AND is_active = 1`;
  console.log("OK: appointment_confirm soft-deleted");

  // 3. Rename auto_appointment label
  await sql`UPDATE sms_templates SET label = '예약 확정 안내', updated_at = now() WHERE key = 'auto_appointment'`;
  console.log("OK: auto_appointment label renamed");

  // 4. Set sort_order for each template (업무 흐름 순서)
  const sortOrders = [
    { key: "new_lead", order: 1 },
    { key: "auto_new_lead", order: 2 },
    { key: "pre_first_call", order: 3 },
    { key: "auto_absent", order: 4 },
    { key: "consultation_done", order: 5 },
    { key: "auto_appointment", order: 6 },
    { key: "appointment_reminder", order: 7 },
    { key: "noshow", order: 8 },
    { key: "directions", order: 9 },
    { key: "parking", order: 10 },
    { key: "hours", order: 11 },
  ];

  for (const { key, order } of sortOrders) {
    await sql`UPDATE sms_templates SET sort_order = ${order} WHERE key = ${key}`;
  }
  console.log("OK: sort_order set for all templates");

  console.log("Migration 0005-fix complete!");
}

run().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
