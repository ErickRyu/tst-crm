CREATE TABLE IF NOT EXISTS "lead_activities" (
  "id" serial PRIMARY KEY NOT NULL,
  "lead_id" integer NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
  "action" text NOT NULL,
  "actor_name" text NOT NULL,
  "old_value" text,
  "new_value" text,
  "detail" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_lead_activities_lead_id" ON "lead_activities" ("lead_id");
