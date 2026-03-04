// ---------- Provider Interface ----------
export interface SmsProvider {
  send(params: SmsSendRequest): Promise<SmsSendResult>;
  getRemaining(): Promise<SmsRemainingResult>;
  getHistory(params: SmsHistoryRequest): Promise<SmsHistoryResult>;
  getDetail(params: SmsDetailRequest): Promise<SmsDetailResult>;
  cancel(params: SmsCancelRequest): Promise<SmsCancelResult>;
}

// ---------- Request Types ----------
export interface SmsSendRequest {
  receiver: string;
  msg: string;
  msgType?: "SMS" | "LMS";
  title?: string;
  /** rdate + rtime 예약 발송 (선택) */
  rdate?: string; // YYYYMMDD
  rtime?: string; // HHmm
}

export interface SmsHistoryRequest {
  page?: number;
  pageSize?: number;
  startDate?: string; // YYYYMMDD
  endDate?: string; // YYYYMMDD
}

export interface SmsDetailRequest {
  mid: string; // msg_id
  page?: number;
  pageSize?: number;
}

export interface SmsCancelRequest {
  mid: string; // msg_id
}

// ---------- Result Types ----------
export interface SmsSendResult {
  result_code: string; // "1" = success
  message: string;
  msg_id: string;
  success_cnt: number;
  error_cnt: number;
  msg_type: string;
}

export interface SmsRemainingResult {
  result_code: string;
  message: string;
  SMS_CNT: string;
  LMS_CNT: string;
  MMS_CNT: string;
}

export interface SmsHistoryResult {
  result_code: string;
  message: string;
  list: SmsHistoryItem[];
  next_yn: string;
}

export interface SmsHistoryItem {
  mid: string;
  type: string;
  sender: string;
  sms_count: string;
  reserve_state: string;
  msg: string;
  fail_count: string;
  reg_date: string;
  reserve: string;
}

export interface SmsDetailResult {
  result_code: string;
  message: string;
  list: SmsDetailItem[];
  next_yn: string;
}

export interface SmsDetailItem {
  mdid: string;
  receiver: string;
  sms_state: string;
  reg_date: string;
  send_date: string;
}

export interface SmsCancelResult {
  result_code: string;
  message: string;
}

// ---------- Legacy Compat ----------
export interface SmsTemplate {
  key: string;
  label: string;
  icon: string;
  body: string;
  msgType: "SMS" | "LMS";
  statuses?: string[];
}
