CREATE TABLE telegram_recipients (
  id SERIAL PRIMARY KEY,
  chat_id TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  chat_type TEXT,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 기존 단일 chat_id 이관
INSERT INTO telegram_recipients (chat_id, label, chat_type, is_enabled)
SELECT value, '기존 수신자', 'private', 1
FROM crm_settings
WHERE key = 'telegram_chat_id' AND value IS NOT NULL AND value != '';

-- 구 키 삭제
DELETE FROM crm_settings WHERE key = 'telegram_chat_id';
