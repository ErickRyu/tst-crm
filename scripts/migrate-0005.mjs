import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const sql = neon(process.env.DATABASE_URL);

// Execute each statement individually using tagged template
async function run() {
  // 1. users: add phone column
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text`;
  console.log("OK: users.phone added");

  // 2. sms_logs: add auto-send columns
  await sql`ALTER TABLE sms_logs ADD COLUMN IF NOT EXISTS is_auto_send integer DEFAULT 0`;
  console.log("OK: sms_logs.is_auto_send added");

  await sql`ALTER TABLE sms_logs ADD COLUMN IF NOT EXISTS auto_send_rule_id integer`;
  console.log("OK: sms_logs.auto_send_rule_id added");

  // 3. sms_templates table
  await sql`
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
    )
  `;
  console.log("OK: sms_templates created");

  // 4. auto_send_rules table
  await sql`
    CREATE TABLE IF NOT EXISTS auto_send_rules (
      id serial PRIMARY KEY,
      trigger_type text NOT NULL,
      trigger_value text,
      template_id integer NOT NULL REFERENCES sms_templates(id),
      is_enabled integer NOT NULL DEFAULT 1,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `;
  console.log("OK: auto_send_rules created");

  // 5. crm_settings table
  await sql`
    CREATE TABLE IF NOT EXISTS crm_settings (
      key text PRIMARY KEY,
      value text NOT NULL,
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `;
  console.log("OK: crm_settings created");

  // 6. indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_auto_send_rules_trigger ON auto_send_rules (trigger_type, trigger_value)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sms_templates_active ON sms_templates (is_active)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sms_logs_auto ON sms_logs (is_auto_send) WHERE is_auto_send = 1`;
  console.log("OK: indexes created");

  // 7. Seed clinic name
  await sql`INSERT INTO crm_settings (key, value) VALUES ('clinic_name', 'OO치과') ON CONFLICT (key) DO NOTHING`;
  console.log("OK: clinic_name seeded");

  // 8. Seed templates
  const templates = [
    { key: "new_lead", label: "신규 상담 안내", icon: "fiber_new", body: "[{치과명}] {고객명}님 안녕하세요. 상담 접수가 완료되었습니다. 곧 연락드리겠습니다. 감사합니다.", msgType: "SMS", category: "상태별", statuses: '["신규인입"]' },
    { key: "missed_call", label: "부재중 안내", icon: "phone_missed", body: "[{치과명}] 안녕하세요, {고객명}님. 전화 연결이 되지 않아 문자 드립니다. 상담 관련 문의사항이 있으시면 편한 시간에 연락 부탁드립니다. ☎ 대표번호", msgType: "LMS", category: "상태별", statuses: '["1차부재","2차부재","3차부재"]' },
    { key: "noshow", label: "노쇼 재안내", icon: "event_busy", body: "[{치과명}] {고객명}님, 예약하신 일정에 내원이 확인되지 않았습니다. 다시 예약을 원하시면 편한 시간에 연락 부탁드립니다.", msgType: "LMS", category: "상태별", statuses: '["노쇼"]' },
    { key: "consultation_done", label: "상담 완료 안내", icon: "check_circle", body: "[{치과명}] {고객명}님, 상담 감사합니다. 추가 궁금하신 점은 언제든 연락 주세요.", msgType: "SMS", category: "상태별", statuses: '["통화완료"]' },
    { key: "appointment_confirm", label: "예약 확정 안내", icon: "event_available", body: "[{치과명}] {고객명}님, 예약이 확정되었습니다.\n\n📅 예약일시: {예약확정일시}\n📍 주소: (병원 주소)\n\n변경/취소는 전화 주세요. 감사합니다.", msgType: "LMS", category: "상태별", statuses: '["예약완료"]' },
    { key: "appointment_reminder", label: "예약 리마인더", icon: "event", body: "[{치과명}] {고객명}님, 내원 예약 안내드립니다.\n\n📅 예약일시: {예약확정일시}\n\n변경/취소는 전화 주세요.\n감사합니다.", msgType: "LMS", category: "상태별", statuses: '["예약완료"]' },
    { key: "directions", label: "오시는 길", icon: "place", body: "[{치과명}] 오시는 길 안내\n\n📍 주소: (병원 주소)\n🚇 지하철: OO역 O번 출구 도보 5분\n🚗 주차: 건물 뒤편 전용 주차장 이용 가능\n\n방문 시 참고 부탁드립니다.", msgType: "LMS", category: "공통", statuses: null },
    { key: "parking", label: "주차 안내", icon: "local_parking", body: "[{치과명}] 주차 안내\n\n건물 뒤편 전용 주차장을 이용하실 수 있습니다.\n진료 시간 동안 무료 주차가 가능합니다.\n\n문의사항은 전화 주세요.", msgType: "SMS", category: "공통", statuses: null },
    { key: "hours", label: "진료 시간", icon: "access_time", body: "[{치과명}] 진료 시간 안내\n\n평일: 09:30 ~ 18:30\n토요일: 09:30 ~ 14:00\n일요일/공휴일: 휴진\n점심시간: 13:00 ~ 14:00\n\n예약 문의는 전화 주세요.", msgType: "LMS", category: "공통", statuses: null },
    { key: "auto_new_lead", label: "신규상담 인입즉시", icon: "notification_add", body: "[{치과명}] {고객명}님, {문의내용} 관련 상담 접수되었습니다.\n담당 상담사가 곧 연락드리겠습니다.\n\n문의: {상담사 전화번호}", msgType: "LMS", category: "자동발송", statuses: '["신규인입"]' },
    { key: "pre_first_call", label: "1차 전화 걸기전", icon: "phone_in_talk", body: "[{치과명}] {고객명}님 안녕하세요.\n{문의내용} 관련 상담을 도와드리고자 합니다.\n잠시 후 전화드리겠습니다.\n\n{치과명} 상담실", msgType: "LMS", category: "수동", statuses: '["신규인입","1차부재"]' },
    { key: "auto_absent", label: "부재중 자동 안내", icon: "phone_missed", body: "[{치과명}] {고객명}님, 전화 연결이 되지 않아 문자 드립니다.\n{문의내용} 관련 상담을 원하시면 편한 시간에 연락 부탁드립니다.\n\n📞 {상담사 전화번호}\n{치과명} 상담실", msgType: "LMS", category: "자동발송", statuses: '["1차부재","2차부재","3차부재"]' },
    { key: "auto_appointment", label: "예약 희망일 확정", icon: "event_available", body: "[{치과명}] {고객명}님, 예약이 확정되었습니다.\n\n📅 예약일시: {예약확정일시}\n📍 주소: (병원 주소)\n\n변경/취소 문의: {상담사 전화번호}\n감사합니다.", msgType: "LMS", category: "자동발송", statuses: '["예약완료"]' },
  ];

  for (const t of templates) {
    await sql`
      INSERT INTO sms_templates (key, label, icon, body, msg_type, category, statuses)
      VALUES (${t.key}, ${t.label}, ${t.icon}, ${t.body}, ${t.msgType}, ${t.category}, ${t.statuses})
      ON CONFLICT (key) DO NOTHING
    `;
  }
  console.log("OK: 13 templates seeded");

  // 9. Seed auto-send rules
  // new_lead -> auto_new_lead
  await sql`
    INSERT INTO auto_send_rules (trigger_type, trigger_value, template_id, is_enabled)
    SELECT 'new_lead', NULL, id, 0 FROM sms_templates WHERE key = 'auto_new_lead'
    AND NOT EXISTS (SELECT 1 FROM auto_send_rules WHERE trigger_type = 'new_lead' AND trigger_value IS NULL)
  `;

  // status_absent -> auto_absent (for each absent status)
  for (const val of ["1차부재", "2차부재", "3차부재"]) {
    await sql`
      INSERT INTO auto_send_rules (trigger_type, trigger_value, template_id, is_enabled)
      SELECT 'status_absent', ${val}, id, 0 FROM sms_templates WHERE key = 'auto_absent'
      AND NOT EXISTS (SELECT 1 FROM auto_send_rules WHERE trigger_type = 'status_absent' AND trigger_value = ${val})
    `;
  }

  // appointment_set -> auto_appointment
  await sql`
    INSERT INTO auto_send_rules (trigger_type, trigger_value, template_id, is_enabled)
    SELECT 'appointment_set', NULL, id, 0 FROM sms_templates WHERE key = 'auto_appointment'
    AND NOT EXISTS (SELECT 1 FROM auto_send_rules WHERE trigger_type = 'appointment_set' AND trigger_value IS NULL)
  `;

  console.log("OK: auto-send rules seeded");
  console.log("Migration complete!");
}

run().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
