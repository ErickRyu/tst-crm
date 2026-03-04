-- users: add phone column
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text;

-- sms_logs: add auto-send columns
ALTER TABLE sms_logs ADD COLUMN IF NOT EXISTS is_auto_send integer DEFAULT 0;
ALTER TABLE sms_logs ADD COLUMN IF NOT EXISTS auto_send_rule_id integer;

-- sms_templates table
CREATE TABLE IF NOT EXISTS sms_templates (
  id serial PRIMARY KEY,
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  icon text NOT NULL,
  body text NOT NULL,
  msg_type text NOT NULL,
  category text,
  statuses text,
  is_active integer NOT NULL DEFAULT 1,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

-- auto_send_rules table
CREATE TABLE IF NOT EXISTS auto_send_rules (
  id serial PRIMARY KEY,
  trigger_type text NOT NULL,
  trigger_value text,
  template_id integer NOT NULL REFERENCES sms_templates(id),
  is_enabled integer NOT NULL DEFAULT 1,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

-- crm_settings table
CREATE TABLE IF NOT EXISTS crm_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamp NOT NULL DEFAULT now()
);

-- indexes
CREATE INDEX IF NOT EXISTS idx_auto_send_rules_trigger ON auto_send_rules (trigger_type, trigger_value);
CREATE INDEX IF NOT EXISTS idx_sms_templates_active ON sms_templates (is_active);
CREATE INDEX IF NOT EXISTS idx_sms_logs_auto ON sms_logs (is_auto_send) WHERE is_auto_send = 1;

-- Seed: default clinic name
INSERT INTO crm_settings (key, value) VALUES ('clinic_name', 'OO치과')
ON CONFLICT (key) DO NOTHING;

-- Seed: existing 9 templates + 4 new ones
INSERT INTO sms_templates (key, label, icon, body, msg_type, category, statuses) VALUES
  ('new_lead', '신규 상담 안내', 'fiber_new', '[{치과명}] {고객명}님 안녕하세요. 상담 접수가 완료되었습니다. 곧 연락드리겠습니다. 감사합니다.', 'SMS', '상태별', '["신규인입"]'),
  ('missed_call', '부재중 안내', 'phone_missed', '[{치과명}] 안녕하세요, {고객명}님. 전화 연결이 되지 않아 문자 드립니다. 상담 관련 문의사항이 있으시면 편한 시간에 연락 부탁드립니다. ☎ 대표번호', 'LMS', '상태별', '["1차부재","2차부재","3차부재"]'),
  ('noshow', '노쇼 재안내', 'event_busy', '[{치과명}] {고객명}님, 예약하신 일정에 내원이 확인되지 않았습니다. 다시 예약을 원하시면 편한 시간에 연락 부탁드립니다.', 'LMS', '상태별', '["노쇼"]'),
  ('consultation_done', '상담 완료 안내', 'check_circle', '[{치과명}] {고객명}님, 상담 감사합니다. 추가 궁금하신 점은 언제든 연락 주세요.', 'SMS', '상태별', '["통화완료"]'),
  ('appointment_confirm', '예약 확정 안내', 'event_available', E'[{치과명}] {고객명}님, 예약이 확정되었습니다.\n\n📅 예약일시: {예약확정일시}\n📍 주소: (병원 주소)\n\n변경/취소는 전화 주세요. 감사합니다.', 'LMS', '상태별', '["예약완료"]'),
  ('appointment_reminder', '예약 리마인더', 'event', E'[{치과명}] {고객명}님, 내원 예약 안내드립니다.\n\n📅 예약일시: {예약확정일시}\n\n변경/취소는 전화 주세요.\n감사합니다.', 'LMS', '상태별', '["예약완료"]'),
  ('directions', '오시는 길', 'place', E'[{치과명}] 오시는 길 안내\n\n📍 주소: (병원 주소)\n🚇 지하철: OO역 O번 출구 도보 5분\n🚗 주차: 건물 뒤편 전용 주차장 이용 가능\n\n방문 시 참고 부탁드립니다.', 'LMS', '공통', NULL),
  ('parking', '주차 안내', 'local_parking', E'[{치과명}] 주차 안내\n\n건물 뒤편 전용 주차장을 이용하실 수 있습니다.\n진료 시간 동안 무료 주차가 가능합니다.\n\n문의사항은 전화 주세요.', 'SMS', '공통', NULL),
  ('hours', '진료 시간', 'access_time', E'[{치과명}] 진료 시간 안내\n\n평일: 09:30 ~ 18:30\n토요일: 09:30 ~ 14:00\n일요일/공휴일: 휴진\n점심시간: 13:00 ~ 14:00\n\n예약 문의는 전화 주세요.', 'LMS', '공통', NULL),
  ('auto_new_lead', '신규상담 인입즉시', 'notification_add', E'[{치과명}] {고객명}님, {문의내용} 관련 상담 접수되었습니다.\n담당 상담사가 곧 연락드리겠습니다.\n\n문의: {상담사 전화번호}', 'LMS', '자동발송', '["신규인입"]'),
  ('pre_first_call', '1차 전화 걸기전', 'phone_in_talk', E'[{치과명}] {고객명}님 안녕하세요.\n{문의내용} 관련 상담을 도와드리고자 합니다.\n잠시 후 전화드리겠습니다.\n\n{치과명} 상담실', 'LMS', '수동', '["신규인입","1차부재"]'),
  ('auto_absent', '부재중 자동 안내', 'phone_missed', E'[{치과명}] {고객명}님, 전화 연결이 되지 않아 문자 드립니다.\n{문의내용} 관련 상담을 원하시면 편한 시간에 연락 부탁드립니다.\n\n📞 {상담사 전화번호}\n{치과명} 상담실', 'LMS', '자동발송', '["1차부재","2차부재","3차부재"]'),
  ('auto_appointment', '예약 희망일 확정', 'event_available', E'[{치과명}] {고객명}님, 예약이 확정되었습니다.\n\n📅 예약일시: {예약확정일시}\n📍 주소: (병원 주소)\n\n변경/취소 문의: {상담사 전화번호}\n감사합니다.', 'LMS', '자동발송', '["예약완료"]')
ON CONFLICT (key) DO NOTHING;

-- Seed: auto-send rules (initially disabled)
INSERT INTO auto_send_rules (trigger_type, trigger_value, template_id, is_enabled)
SELECT 'new_lead', NULL, id, 0 FROM sms_templates WHERE key = 'auto_new_lead'
ON CONFLICT DO NOTHING;

INSERT INTO auto_send_rules (trigger_type, trigger_value, template_id, is_enabled)
SELECT 'status_absent', '1차부재', id, 0 FROM sms_templates WHERE key = 'auto_absent'
ON CONFLICT DO NOTHING;

INSERT INTO auto_send_rules (trigger_type, trigger_value, template_id, is_enabled)
SELECT 'status_absent', '2차부재', id, 0 FROM sms_templates WHERE key = 'auto_absent'
ON CONFLICT DO NOTHING;

INSERT INTO auto_send_rules (trigger_type, trigger_value, template_id, is_enabled)
SELECT 'status_absent', '3차부재', id, 0 FROM sms_templates WHERE key = 'auto_absent'
ON CONFLICT DO NOTHING;

INSERT INTO auto_send_rules (trigger_type, trigger_value, template_id, is_enabled)
SELECT 'appointment_set', NULL, id, 0 FROM sms_templates WHERE key = 'auto_appointment'
ON CONFLICT DO NOTHING;
