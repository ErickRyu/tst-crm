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

const BASE_URL = "https://sms.api.nhncloudservice.com";

interface NhnResponse<T = unknown> {
  header: {
    isSuccessful: boolean;
    resultCode: number;
    resultMessage: string;
  };
  body: {
    data: T;
  };
}

interface NhnSendData {
  requestId: string;
  statusCode: string;
}

interface NhnSearchData {
  pageNum: number;
  pageSize: number;
  totalCount: number;
  data: NhnMessageItem[];
}

interface NhnMessageItem {
  requestId: string;
  requestDate: string;
  resultDate: string;
  templateId: string;
  sendNo: string;
  recipientNo: string;
  title: string;
  body: string;
  msgStatus: string;
  msgStatusName: string;
  resultCode: string;
  resultCodeName: string;
  recipientSeq: number;
  sendType: string;
  messageType: string;
}

export class NhnSmsProvider implements SmsProvider {
  private appKey: string;
  private secretKey: string;
  private sender: string;

  constructor() {
    this.appKey = process.env.NHN_SMS_APP_KEY || "";
    this.secretKey = process.env.NHN_SMS_SECRET_KEY || "";
    this.sender = process.env.NHN_SMS_SENDER || "";
  }

  private get basePath(): string {
    return `/sms/v3.0/appKeys/${this.appKey}`;
  }

  private assertConfigured(): void {
    if (!this.appKey || !this.secretKey) {
      throw new Error("NHN Cloud SMS API 인증 정보가 설정되지 않았습니다.");
    }
    if (!this.sender) {
      throw new Error("발신번호(NHN_SMS_SENDER)가 설정되지 않았습니다.");
    }
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<NhnResponse<T>> {
    const url = `${BASE_URL}${this.basePath}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json;charset=UTF-8",
      "X-Secret-Key": this.secretKey,
    };

    const res = await fetch(url, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (!res.ok) {
      throw new Error(`NHN Cloud SMS API 오류: ${res.status} ${res.statusText}`);
    }

    return res.json() as Promise<NhnResponse<T>>;
  }

  async send(params: SmsSendRequest): Promise<SmsSendResult> {
    this.assertConfigured();

    const isLms = params.msgType === "LMS";
    const endpoint = isLms ? "/sender/mms" : "/sender/sms";

    const recipientList: { recipientNo: string; templateParameter?: Record<string, string> }[] = [
      { recipientNo: params.receiver },
    ];

    const reqBody: Record<string, unknown> = {
      body: params.msg,
      sendNo: this.sender,
      recipientList,
    };

    // 예약 발송 — body 최상위에 requestDate 추가
    if (params.rdate && params.rtime) {
      const y = params.rdate.slice(0, 4);
      const m = params.rdate.slice(4, 6);
      const d = params.rdate.slice(6, 8);
      const hh = params.rtime.slice(0, 2);
      const mm = params.rtime.slice(2, 4);
      reqBody.requestDate = `${y}-${m}-${d} ${hh}:${mm}`;
    }

    if (isLms && params.title) {
      reqBody.title = params.title;
    }

    const nhn = await this.request<NhnSendData>("POST", endpoint, reqBody);

    return {
      result_code: nhn.header.isSuccessful ? "1" : "-1",
      message: nhn.header.resultMessage,
      msg_id: nhn.body.data?.requestId || "",
      success_cnt: nhn.header.isSuccessful ? 1 : 0,
      error_cnt: nhn.header.isSuccessful ? 0 : 1,
      msg_type: isLms ? "LMS" : "SMS",
    };
  }

  async getRemaining(): Promise<SmsRemainingResult> {
    // NHN Cloud에는 잔여량 API가 없음 (후불 과금)
    return {
      result_code: "1",
      message: "NHN Cloud는 후불 과금으로 잔여량 조회를 지원하지 않습니다.",
      SMS_CNT: "-1",
      LMS_CNT: "-1",
      MMS_CNT: "-1",
    };
  }

  async getHistory(params: SmsHistoryRequest = {}): Promise<SmsHistoryResult> {
    this.assertConfigured();

    const query = new URLSearchParams();
    if (params.page) query.set("pageNum", String(params.page));
    if (params.pageSize) query.set("pageSize", String(params.pageSize));
    if (params.startDate) {
      const s = params.startDate;
      query.set("startRequestDate", `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)} 00:00:00`);
    }
    if (params.endDate) {
      const e = params.endDate;
      query.set("endRequestDate", `${e.slice(0, 4)}-${e.slice(4, 6)}-${e.slice(6, 8)} 23:59:59`);
    }

    const qs = query.toString();
    const queryStr = qs ? `?${qs}` : "";

    // SMS, MMS 병렬 조회
    const [smsRes, mmsRes] = await Promise.all([
      this.request<NhnSearchData>("GET", `/sender/sms${queryStr}`),
      this.request<NhnSearchData>("GET", `/sender/mms${queryStr}`),
    ]);

    const mapItems = (res: NhnResponse<NhnSearchData>) =>
      (res.body.data?.data || []).map((item) => ({
        mid: item.requestId,
        type: item.messageType || "SMS",
        sender: item.sendNo,
        sms_count: "1",
        reserve_state: item.msgStatusName || "",
        msg: item.body,
        fail_count: item.resultCode === "0" ? "0" : "1",
        reg_date: item.requestDate,
        reserve: "",
      }));

    // 결과 병합 후 날짜 역순 정렬
    const allItems = [
      ...mapItems(smsRes),
      ...mapItems(mmsRes),
    ].sort((a, b) => b.reg_date.localeCompare(a.reg_date));

    const totalCount = (smsRes.body.data?.totalCount || 0) + (mmsRes.body.data?.totalCount || 0);
    const isSuccessful = smsRes.header.isSuccessful && mmsRes.header.isSuccessful;

    return {
      result_code: isSuccessful ? "1" : "-1",
      message: smsRes.header.resultMessage,
      list: allItems,
      next_yn: totalCount > ((params.page || 1) * (params.pageSize || 15)) ? "Y" : "N",
    };
  }

  async getDetail(params: SmsDetailRequest): Promise<SmsDetailResult> {
    this.assertConfigured();

    const query = new URLSearchParams();
    query.set("requestId", params.mid);
    if (params.page) query.set("pageNum", String(params.page));
    if (params.pageSize) query.set("pageSize", String(params.pageSize));

    const nhn = await this.request<NhnSearchData>(
      "GET",
      `/sender/sms?${query.toString()}`,
    );

    const data = nhn.body.data;
    const items = data?.data || [];

    return {
      result_code: nhn.header.isSuccessful ? "1" : "-1",
      message: nhn.header.resultMessage,
      list: items.map((item) => ({
        mdid: `${item.requestId}-${item.recipientSeq}`,
        receiver: item.recipientNo,
        sms_state: item.msgStatusName || item.resultCodeName || "",
        reg_date: item.requestDate,
        send_date: item.resultDate || "",
      })),
      next_yn: (data?.totalCount || 0) > ((params.page || 1) * (params.pageSize || 15)) ? "Y" : "N",
    };
  }

  async cancel(params: SmsCancelRequest): Promise<SmsCancelResult> {
    this.assertConfigured();

    const nhn = await this.request<{ requestedCount: number; canceledCount: number }>(
      "PUT",
      "/reservations/cancel",
      {
        reservationList: [{ requestId: params.mid, recipientSeq: 1 }],
      },
    );

    return {
      result_code: nhn.header.isSuccessful ? "1" : "-1",
      message: nhn.header.resultMessage,
    };
  }
}
