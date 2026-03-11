import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const ORIG_ENV = { ...process.env };

function setNhnEnv() {
  process.env.SMS_PROVIDER = "nhn";
  process.env.NHN_SMS_APP_KEY = "test-app-key";
  process.env.NHN_SMS_SECRET_KEY = "test-secret-key";
  process.env.NHN_SMS_SENDER = "02-1234-5678";
}

function mockNhnOk<T>(data: T, isSuccessful = true) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () =>
      Promise.resolve({
        header: {
          isSuccessful,
          resultCode: isSuccessful ? 0 : -1,
          resultMessage: isSuccessful ? "SUCCESS" : "FAIL",
        },
        body: { data },
      }),
  });
}

describe("NhnSmsProvider", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    setNhnEnv();
  });

  afterEach(() => {
    process.env = { ...ORIG_ENV };
  });

  async function importSms() {
    return import("./index");
  }

  // ─── Provider Selection ───

  describe("provider selection", () => {
    it("SMS_PROVIDER=nhn이면 NHN Cloud API를 호출한다", async () => {
      const { sendSms } = await importSms();

      mockNhnOk({ requestId: "nhn-req-1", statusCode: "0" });

      await sendSms({ receiver: "01012345678", msg: "테스트" });

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain("sms.api.nhncloudservice.com");
      expect(url).toContain("/appKeys/test-app-key/");
      expect(opts.headers["X-Secret-Key"]).toBe("test-secret-key");
    });

    it("SMS_PROVIDER 미설정 시 Aligo를 사용한다", async () => {
      delete process.env.SMS_PROVIDER;
      process.env.ALIGO_API_KEY = "aligo-key";
      process.env.ALIGO_USER_ID = "aligo-user";
      process.env.ALIGO_SENDER = "0212345678";

      const { sendSms } = await importSms();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            result_code: "1",
            message: "success",
            msg_id: "mid-1",
            success_cnt: 1,
            error_cnt: 0,
            msg_type: "SMS",
          }),
      });

      await sendSms({ receiver: "01012345678", msg: "테스트" });
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("apis.aligo.in");
    });
  });

  // ─── send ───

  describe("send", () => {
    it("SMS 발송 — JSON body에 올바른 필드가 포함된다", async () => {
      const { sendSms } = await importSms();

      mockNhnOk({ requestId: "nhn-req-2", statusCode: "0" });

      const result = await sendSms({
        receiver: "010-9999-8888",
        msg: "안녕하세요",
      });

      expect(result.result_code).toBe("1");
      expect(result.msg_id).toBe("nhn-req-2");
      expect(result.msg_type).toBe("SMS");

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain("/sender/sms");
      const body = JSON.parse(opts.body);
      expect(body.sendNo).toBe("02-1234-5678");
      expect(body.recipientList[0].recipientNo).toBe("01099998888");
      expect(body.body).toBe("안녕하세요");
    });

    it("LMS 발송 — /sender/mms 엔드포인트를 사용한다", async () => {
      const { sendSms } = await importSms();

      mockNhnOk({ requestId: "nhn-req-3", statusCode: "0" });

      await sendSms({
        receiver: "01012345678",
        msg: "가".repeat(46), // 92바이트 → LMS 자동 전환
      });

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain("/sender/mms");
      const body = JSON.parse(opts.body);
      expect(body.body).toBe("가".repeat(46));
    });

    it("LMS에 title이 포함된다", async () => {
      const { sendSms } = await importSms();

      mockNhnOk({ requestId: "nhn-req-4", statusCode: "0" });

      await sendSms({
        receiver: "01012345678",
        msg: "긴 메시지 본문",
        msgType: "LMS",
        title: "제목입니다",
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.title).toBe("제목입니다");
    });

    it("NHN API 실패 시 result_code=-1을 반환한다", async () => {
      const { sendSms } = await importSms();

      mockNhnOk({ requestId: "", statusCode: "-1" }, false);

      const result = await sendSms({
        receiver: "01012345678",
        msg: "테스트",
      });

      expect(result.result_code).toBe("-1");
      expect(result.error_cnt).toBe(1);
      expect(result.success_cnt).toBe(0);
    });

    it("인증 정보 없으면 에러를 throw한다", async () => {
      process.env.NHN_SMS_APP_KEY = "";
      const { sendSms } = await importSms();

      await expect(
        sendSms({ receiver: "01012345678", msg: "테스트" }),
      ).rejects.toThrow("인증 정보");
    });

    it("발신번호 없으면 에러를 throw한다", async () => {
      process.env.NHN_SMS_SENDER = "";
      const { sendSms } = await importSms();

      await expect(
        sendSms({ receiver: "01012345678", msg: "테스트" }),
      ).rejects.toThrow("발신번호");
    });

    it("fetch가 non-ok 응답이면 에러를 throw한다", async () => {
      const { sendSms } = await importSms();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      await expect(
        sendSms({ receiver: "01012345678", msg: "테스트" }),
      ).rejects.toThrow("NHN Cloud SMS API 오류");
    });
  });

  // ─── getRemaining ───

  describe("getRemaining", () => {
    it("후불 과금 미지원 메시지를 반환한다", async () => {
      const { getRemaining } = await importSms();
      const result = await getRemaining();

      expect(result.result_code).toBe("1");
      expect(result.SMS_CNT).toBe("-1");
      expect(result.message).toContain("후불 과금");
      // fetch 호출 없어야 함
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ─── getSmsHistory ───

  describe("getSmsHistory", () => {
    it("SMS+MMS 두 번 조회 후 결과를 병합하고 날짜 역순 정렬한다", async () => {
      const { getSmsHistory } = await importSms();

      // SMS 응답
      mockNhnOk({
        pageNum: 1,
        pageSize: 15,
        totalCount: 1,
        data: [
          {
            requestId: "nhn-hist-sms-1",
            requestDate: "2025-01-01 10:00:00",
            resultDate: "2025-01-01 10:00:01",
            sendNo: "02-1234-5678",
            recipientNo: "01012345678",
            body: "SMS 메시지",
            msgStatus: "3",
            msgStatusName: "발송완료",
            resultCode: "0",
            resultCodeName: "성공",
            recipientSeq: 1,
            sendType: "0",
            messageType: "SMS",
            templateId: "",
            title: "",
          },
        ],
      });

      // MMS 응답
      mockNhnOk({
        pageNum: 1,
        pageSize: 15,
        totalCount: 1,
        data: [
          {
            requestId: "nhn-hist-mms-1",
            requestDate: "2025-01-02 09:00:00",
            resultDate: "2025-01-02 09:00:01",
            sendNo: "02-1234-5678",
            recipientNo: "01099998888",
            body: "LMS 메시지",
            msgStatus: "3",
            msgStatusName: "발송완료",
            resultCode: "0",
            resultCodeName: "성공",
            recipientSeq: 1,
            sendType: "0",
            messageType: "LMS",
            templateId: "",
            title: "",
          },
        ],
      });

      const result = await getSmsHistory({ page: 1 });
      expect(result.result_code).toBe("1");
      expect(result.list).toHaveLength(2);

      // 날짜 역순: MMS(01-02)가 먼저, SMS(01-01)가 나중
      expect(result.list[0].mid).toBe("nhn-hist-mms-1");
      expect(result.list[0].type).toBe("LMS");
      expect(result.list[1].mid).toBe("nhn-hist-sms-1");
      expect(result.list[1].type).toBe("SMS");

      // fetch가 2번 호출됨 (SMS + MMS)
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const [smsUrl] = mockFetch.mock.calls[0];
      const [mmsUrl] = mockFetch.mock.calls[1];
      expect(smsUrl).toContain("/sender/sms");
      expect(mmsUrl).toContain("/sender/mms");
    });
  });

  // ─── getSmsDetail ───

  describe("getSmsDetail", () => {
    it("NHN 상세 조회를 공통 포맷으로 변환한다", async () => {
      const { getSmsDetail } = await importSms();

      mockNhnOk({
        pageNum: 1,
        pageSize: 15,
        totalCount: 1,
        data: [
          {
            requestId: "nhn-det-1",
            requestDate: "2025-01-01 10:00:00",
            resultDate: "2025-01-01 10:00:01",
            sendNo: "02-1234-5678",
            recipientNo: "01012345678",
            body: "상세 메시지",
            msgStatus: "3",
            msgStatusName: "발송완료",
            resultCode: "0",
            resultCodeName: "성공",
            recipientSeq: 1,
            sendType: "0",
            messageType: "SMS",
            templateId: "",
            title: "",
          },
        ],
      });

      const result = await getSmsDetail({ mid: "nhn-det-1" });
      expect(result.result_code).toBe("1");
      expect(result.list[0].receiver).toBe("01012345678");
      expect(result.list[0].sms_state).toBe("발송완료");
    });
  });

  // ─── cancelScheduledSms ───

  describe("cancelScheduledSms", () => {
    it("NHN 예약 취소 — /reservations/cancel 경로와 reservationList body를 사용한다", async () => {
      const { cancelScheduledSms } = await importSms();

      mockNhnOk({ requestedCount: 1, canceledCount: 1 });

      const result = await cancelScheduledSms({ mid: "nhn-rsv-1" });
      expect(result.result_code).toBe("1");

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain("/reservations/cancel");
      expect(opts.method).toBe("PUT");
      const body = JSON.parse(opts.body);
      expect(body.reservationList).toEqual([
        { requestId: "nhn-rsv-1", recipientSeq: 1 },
      ]);
    });
  });

  // ─── 예약 발송 ───

  describe("예약 발송", () => {
    it("rdate/rtime이 있으면 body 최상위에 requestDate를 추가한다", async () => {
      const { NhnSmsProvider } = await import("./nhn-provider");
      const provider = new NhnSmsProvider();

      mockNhnOk({ requestId: "nhn-rsv-2", statusCode: "0" });

      await provider.send({
        receiver: "01012345678",
        msg: "예약 메시지",
        rdate: "20250315",
        rtime: "1430",
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.requestDate).toBe("2025-03-15 14:30");
      // recipientList에는 requestDate가 없어야 함
      expect(body.recipientList[0].requestDate).toBeUndefined();
    });
  });
});
