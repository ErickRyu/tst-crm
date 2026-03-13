-- Move bot_token from user_telegram_settings to user_telegram_recipients
-- Each recipient can have its own bot token
ALTER TABLE "user_telegram_recipients" ADD COLUMN "bot_token" text;

-- Migrate existing data: copy bot_token from settings to all recipients of that user
UPDATE "user_telegram_recipients" r
SET "bot_token" = s."bot_token"
FROM "user_telegram_settings" s
WHERE r."user_id" = s."user_id" AND s."bot_token" IS NOT NULL;
