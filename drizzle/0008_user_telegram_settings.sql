CREATE TABLE IF NOT EXISTS "user_telegram_settings" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") UNIQUE,
  "bot_token" text,
  "enabled" integer DEFAULT 0 NOT NULL,
  "notify_new_lead" integer DEFAULT 1 NOT NULL,
  "notify_status_change" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "user_telegram_recipients" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id"),
  "chat_id" text NOT NULL,
  "label" text NOT NULL,
  "chat_type" text,
  "is_enabled" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_user_telegram_settings_user_id" ON "user_telegram_settings" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_user_telegram_recipients_user_id" ON "user_telegram_recipients" ("user_id");
