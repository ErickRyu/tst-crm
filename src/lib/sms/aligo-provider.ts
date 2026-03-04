import type {
  SmsProvider,
  SmsSendRequest,
  SmsSendResult,
  SmsRemainingResult,
  SmsHistoryRequest,
  SmsHistoryResult,
  SmsDetailRequest,
  SmsDetailResult,
  SmsCancelRequest,
  SmsCancelResult,
} from "./types";

const BASE_URL = "https://apis.aligo.in";

export class AligoSmsProvider implements SmsProvider {
  private key: string;
  private userId: string;
  private sender: string;
  private testmodeYn: string;

  constructor() {
    this.key = process.env.ALIGO_API_KEY || "";
    this.userId = process.env.ALIGO_USER_ID || "";
    this.sender = process.env.ALIGO_SENDER || "";
    this.testmodeYn = process.env.ALIGO_TESTMODE === "N" ? "N" : "Y";
  }

  private buildFormData(extra: Record<string, string> = {}): FormData {
    const fd = new FormData();
    fd.append("key", this.key);
    fd.append("user_id", this.userId);
    fd.append("testmode_yn", this.testmodeYn);
    for (const [k, v] of Object.entries(extra)) {
      fd.append(k, v);
    }
    return fd;
  }

  private async post<T>(path: string, fd: FormData): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      throw new Error(`Aligo API 오류: ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<T>;
  }

  assertConfigured(): void {
    if (!this.key || !this.userId) {
      throw new Error("Aligo API 인증 정보가 설정되지 않았습니다.");
    }
    if (!this.sender) {
      throw new Error("발신번호(ALIGO_SENDER)가 설정되지 않았습니다.");
    }
  }

  async send(params: SmsSendRequest): Promise<SmsSendResult> {
    this.assertConfigured();

    const fields: Record<string, string> = {
      sender: this.sender,
      receiver: params.receiver,
      msg: params.msg,
      msg_type: params.msgType || "SMS",
    };
    if (params.msgType !== "SMS" && params.title) {
      fields.title = params.title;
    }
    if (params.rdate) fields.rdate = params.rdate;
    if (params.rtime) fields.rtime = params.rtime;

    return this.post<SmsSendResult>("/send/", this.buildFormData(fields));
  }

  async getRemaining(): Promise<SmsRemainingResult> {
    this.assertConfigured();
    return this.post<SmsRemainingResult>("/remain/", this.buildFormData());
  }

  async getHistory(params: SmsHistoryRequest = {}): Promise<SmsHistoryResult> {
    this.assertConfigured();
    const fields: Record<string, string> = {};
    if (params.page) fields.page = String(params.page);
    if (params.pageSize) fields.page_size = String(params.pageSize);
    if (params.startDate) fields.start_date = params.startDate;
    if (params.endDate) fields.limit_day = params.endDate;
    return this.post<SmsHistoryResult>("/list/", this.buildFormData(fields));
  }

  async getDetail(params: SmsDetailRequest): Promise<SmsDetailResult> {
    this.assertConfigured();
    const fields: Record<string, string> = { mid: params.mid };
    if (params.page) fields.page = String(params.page);
    if (params.pageSize) fields.page_size = String(params.pageSize);
    return this.post<SmsDetailResult>("/sms_list/", this.buildFormData(fields));
  }

  async cancel(params: SmsCancelRequest): Promise<SmsCancelResult> {
    this.assertConfigured();
    return this.post<SmsCancelResult>("/cancel/", this.buildFormData({ mid: params.mid }));
  }
}
