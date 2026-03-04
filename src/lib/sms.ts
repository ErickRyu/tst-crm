import aligoapi from "aligoapi";

// ---------- Auth ----------
function getAuthData() {
  return {
    key: process.env.ALIGO_API_KEY || "",
    user_id: process.env.ALIGO_USER_ID || "",
    testmode_yn: process.env.ALIGO_TESTMODE === "N" ? "N" : "Y", // default testmode ON
  };
}

const SENDER = process.env.ALIGO_SENDER || "";

// ---------- Types ----------
export interface SmsSendResult {
  result_code: string; // "1" = success, "-" = failure
  message: string;
  msg_id: string;
  success_cnt: number;
  error_cnt: number;
  msg_type: string;
}

export interface SmsTemplate {
  key: string;
  label: string;
  icon: string;
  body: string;
  msgType: "SMS" | "LMS";
  statuses?: string[]; // 추천되는 crmStatus 목록 (비어있으면 공통)
}

// ---------- Templates ----------
export const SMS_TEMPLATES: SmsTemplate[] = [
  // --- 상태별 추천 템플릿 ---
  {
    key: "new_lead",
    label: "신규 상담 안내",
    icon: "fiber_new",
    body: "[OO치과] %고객명%님 안녕하세요. 상담 접수가 완료되었습니다. 곧 연락드리겠습니다. 감사합니다.",
    msgType: "SMS",
    statuses: ["신규인입"],
  },
  {
    key: "missed_call",
    label: "부재중 안내",
    icon: "phone_missed",
    body: "[OO치과] 안녕하세요, %고객명%님. 전화 연결이 되지 않아 문자 드립니다. 상담 관련 문의사항이 있으시면 편한 시간에 연락 부탁드립니다. ☎ 대표번호",
    msgType: "LMS",
    statuses: ["1차부재", "2차부재", "3차부재"],
  },
  {
    key: "noshow",
    label: "노쇼 재안내",
    icon: "event_busy",
    body: "[OO치과] %고객명%님, 예약하신 일정에 내원이 확인되지 않았습니다. 다시 예약을 원하시면 편한 시간에 연락 부탁드립니다.",
    msgType: "LMS",
    statuses: ["노쇼"],
  },
  {
    key: "consultation_done",
    label: "상담 완료 안내",
    icon: "check_circle",
    body: "[OO치과] %고객명%님, 상담 감사합니다. 추가 궁금하신 점은 언제든 연락 주세요.",
    msgType: "SMS",
    statuses: ["통화완료"],
  },
  {
    key: "appointment_confirm",
    label: "예약 확정 안내",
    icon: "event_available",
    body: "[OO치과] %고객명%님, 예약이 확정되었습니다.\n\n📅 예약일시: (예약 일시)\n📍 주소: (병원 주소)\n\n변경/취소는 전화 주세요. 감사합니다.",
    msgType: "LMS",
    statuses: ["예약완료"],
  },
  {
    key: "appointment_reminder",
    label: "예약 리마인더",
    icon: "event",
    body: "[OO치과] %고객명%님, 내원 예약 안내드립니다.\n\n📅 예약일시: (예약 일시)\n\n변경/취소는 전화 주세요.\n감사합니다.",
    msgType: "LMS",
    statuses: ["예약완료"],
  },
  // --- 공통 템플릿 ---
  {
    key: "directions",
    label: "오시는 길",
    icon: "place",
    body: "[OO치과] 오시는 길 안내\n\n📍 주소: (병원 주소)\n🚇 지하철: OO역 O번 출구 도보 5분\n🚗 주차: 건물 뒤편 전용 주차장 이용 가능\n\n방문 시 참고 부탁드립니다.",
    msgType: "LMS",
  },
  {
    key: "parking",
    label: "주차 안내",
    icon: "local_parking",
    body: "[OO치과] 주차 안내\n\n건물 뒤편 전용 주차장을 이용하실 수 있습니다.\n진료 시간 동안 무료 주차가 가능합니다.\n\n문의사항은 전화 주세요.",
    msgType: "SMS",
  },
  {
    key: "hours",
    label: "진료 시간",
    icon: "access_time",
    body: "[OO치과] 진료 시간 안내\n\n평일: 09:30 ~ 18:30\n토요일: 09:30 ~ 14:00\n일요일/공휴일: 휴진\n점심시간: 13:00 ~ 14:00\n\n예약 문의는 전화 주세요.",
    msgType: "LMS",
  },
];

// ---------- Send SMS ----------
export async function sendSms(params: {
  receiver: string;
  msg: string;
  msgType?: "SMS" | "LMS";
  title?: string;
  patientName?: string;
}): Promise<SmsSendResult> {
  const auth = getAuthData();

  if (!auth.key || !auth.user_id) {
    throw new Error("Aligo API 인증 정보가 설정되지 않았습니다.");
  }
  if (!SENDER) {
    throw new Error("발신번호(ALIGO_SENDER)가 설정되지 않았습니다.");
  }

  // {고객명} and %고객명% 치환
  let msg = params.msg;
  if (params.patientName) {
    msg = msg.replace(/%고객명%/g, params.patientName);
    msg = msg.replace(/\{고객명\}/g, params.patientName);
    msg = msg.replace(/\{고객이름\}/g, params.patientName);
  }

  // 90바이트(한글 45자) 초과시 자동 LMS 전환
  // EUC-KR: 한글/한자 2byte, ASCII 1byte
  let byteLength = 0;
  for (const ch of msg) {
    byteLength += ch.charCodeAt(0) > 127 ? 2 : 1;
  }
  const msgType = params.msgType || (byteLength > 90 ? "LMS" : "SMS");

  // aligoapi expects Express-like req object
  const req = {
    headers: {} as Record<string, string>,
    body: {
      sender: SENDER,
      receiver: params.receiver.replace(/-/g, ""), // 하이픈 제거
      msg,
      msg_type: msgType,
      ...(msgType !== "SMS" && params.title ? { title: params.title } : {}),
    },
  };

  const result = (await aligoapi.send(req, auth)) as unknown as SmsSendResult;
  return result;
}

// ---------- Remaining balance ----------
export async function getRemaining(): Promise<{
  result_code: string;
  message: string;
  SMS_CNT: string;
  LMS_CNT: string;
  MMS_CNT: string;
}> {
  const auth = getAuthData();
  const req = { headers: {} as Record<string, string>, body: {} };
  return aligoapi.remain(req, auth) as unknown as {
    result_code: string;
    message: string;
    SMS_CNT: string;
    LMS_CNT: string;
    MMS_CNT: string;
  };
}
