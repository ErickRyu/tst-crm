import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── fetch mock ──
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ── env 설정 ──
const ORIG_ENV = { ...process.env };

function setEnv() {
  process.env.ALIGO_API_KEY = "test-key";
  process.env.ALIGO_USER_ID = "test-user";
  process.env.ALIGO_SENDER = "02-1234-5678";
  process.env.ALIGO_TESTMODE = "Y";
}

describe("sms module", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    setEnv();
  });

  afterEach(() => {
    process.env = { ...ORIG_ENV };
  });

  // 매번 fresh import (env가 constructor에서 읽히므로)
  async function importSms() {
    return import("./index");
  }

  // ─── calcMsgType ───

  describe("calcMsgType", () => {
    it("90바이트 이하 ASCII면 SMS", async () => {
      const { calcMsgType } = await importSms();
      const result = calcMsgType("hello");
      expect(result.msgType).toBe("SMS");
      expect(result.byteLength).toBe(5);
    });

    it("90바이트 이하 한글이면 SMS", async () => {
      const { calcMsgType } = await importSms();
      // 한글 45자 = 90바이트
      const msg = "가".repeat(45);
      const result = calcMsgType(msg);
      expect(result.msgType).toBe("SMS");
      expect(result.byteLength).toBe(90);
    });

    it("90바이트 초과하면 LMS", async () => {
      const { calcMsgType } = await importSms();
      // 한글 46자 = 92바이트
      const msg = "가".repeat(46);
      const result = calcMsgType(msg);
      expect(result.msgType).toBe("LMS");
      expect(result.byteLength).toBe(92);
    });

    it("한글+ASCII 혼합 바이트 계산", async () => {
      const { calcMsgType } = await importSms();
      // 한글 40자(80) + ASCII 10자(10) = 90바이트 → SMS
      const msg = "가".repeat(40) + "a".repeat(10);
      expect(calcMsgType(msg).msgType).toBe("SMS");

      // 한글 40자(80) + ASCII 11자(11) = 91바이트 → LMS
      const msg2 = "가".repeat(40) + "a".repeat(11);
      expect(calcMsgType(msg2).msgType).toBe("LMS");
    });
  });

  // ─── SMS_TEMPLATES ───

  describe("SMS_TEMPLATES", () => {
    it("9개 템플릿이 존재해야 한다", async () => {
      const { SMS_TEMPLATES } = await importSms();
      expect(SMS_TEMPLATES).toHaveLength(9);
    });

    it("모든 템플릿에 key, label, body, msgType이 있어야 한다", async () => {
      const { SMS_TEMPLATES } = await importSms();
      for (const t of SMS_TEMPLATES) {
        expect(t.key).toBeTruthy();
        expect(t.label).toBeTruthy();
        expect(t.body).toBeTruthy();
        expect(["SMS", "LMS"]).toContain(t.msgType);
      }
    });

    it("key는 중복이 없어야 한다", async () => {
      const { SMS_TEMPLATES } = await importSms();
      const keys = SMS_TEMPLATES.map((t) => t.key);
      expect(new Set(keys).size).toBe(keys.length);
    });
  });

  // ─── sendSms ───

  describe("sendSms", () => {
    function mockFetchOk(body: Record<string, unknown>) {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(body),
      });
    }

    it("기본 SMS 발송 — fetch가 올바른 URL/FormData로 호출된다", async () => {
      const { sendSms } = await importSms();

      mockFetchOk({
        result_code: "1",
        message: "success",
        msg_id: "mid-1",
        success_cnt: 1,
        error_cnt: 0,
        msg_type: "SMS",
      });

      const result = await sendSms({
        receiver: "010-1234-5678",
        msg: "테스트 메시지",
        senderName: "김상담",
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe("https://apis.aligo.in/send/");
      expect(opts.method).toBe("POST");

      // FormData 검증
      const fd = opts.body as FormData;
      expect(fd.get("key")).toBe("test-key");
      expect(fd.get("user_id")).toBe("test-user");
      expect(fd.get("sender")).toBe("02-1234-5678");
      expect(fd.get("receiver")).toBe("01012345678"); // 하이픈 제거됨
      expect(fd.get("msg")).toBe("테스트 메시지");
      expect(fd.get("msg_type")).toBe("SMS");

      expect(result.result_code).toBe("1");
      expect(result.msg_id).toBe("mid-1");
    });

    it("%고객명% 치환이 동작한다", async () => {
      const { sendSms } = await importSms();

      mockFetchOk({
        result_code: "1",
        message: "success",
        msg_id: "mid-2",
        success_cnt: 1,
        error_cnt: 0,
        msg_type: "SMS",
      });

      await sendSms({
        receiver: "01012345678",
        msg: "%고객명%님 안녕하세요",
        patientName: "홍길동",
      });

      const fd = mockFetch.mock.calls[0][1].body as FormData;
      expect(fd.get("msg")).toBe("홍길동님 안녕하세요");
    });

    it("{고객명} 및 {고객이름} 치환도 동작한다", async () => {
      const { sendSms } = await importSms();

      mockFetchOk({
        result_code: "1",
        message: "success",
        msg_id: "mid-2b",
        success_cnt: 1,
        error_cnt: 0,
        msg_type: "SMS",
      });

      await sendSms({
        receiver: "01012345678",
        msg: "{고객명}님, {고객이름}님 환영합니다",
        patientName: "김철수",
      });

      const fd = mockFetch.mock.calls[0][1].body as FormData;
      expect(fd.get("msg")).toBe("김철수님, 김철수님 환영합니다");
    });

    it("90바이트 초과 시 자동 LMS 전환", async () => {
      const { sendSms } = await importSms();

      mockFetchOk({
        result_code: "1",
        message: "success",
        msg_id: "mid-3",
        success_cnt: 1,
        error_cnt: 0,
        msg_type: "LMS",
      });

      await sendSms({
        receiver: "01012345678",
        msg: "가".repeat(46), // 92바이트
      });

      const fd = mockFetch.mock.calls[0][1].body as FormData;
      expect(fd.get("msg_type")).toBe("LMS");
    });

    it("명시적 msgType이 있으면 자동 전환하지 않는다", async () => {
      const { sendSms } = await importSms();

      mockFetchOk({
        result_code: "1",
        message: "success",
        msg_id: "mid-4",
        success_cnt: 1,
        error_cnt: 0,
        msg_type: "LMS",
      });

      await sendSms({
        receiver: "01012345678",
        msg: "짧은 문자",
        msgType: "LMS",
      });

      const fd = mockFetch.mock.calls[0][1].body as FormData;
      expect(fd.get("msg_type")).toBe("LMS");
    });

    it("API 인증 정보 없으면 에러를 throw한다", async () => {
      process.env.ALIGO_API_KEY = "";
      const { sendSms } = await importSms();

      await expect(
        sendSms({ receiver: "01012345678", msg: "테스트" })
      ).rejects.toThrow("인증 정보");
    });

    it("발신번호 없으면 에러를 throw한다", async () => {
      process.env.ALIGO_SENDER = "";
      const { sendSms } = await importSms();

      await expect(
        sendSms({ receiver: "01012345678", msg: "테스트" })
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
        sendSms({ receiver: "01012345678", msg: "테스트" })
      ).rejects.toThrow("Aligo API 오류");
    });
  });

  // ─── getRemaining ───

  describe("getRemaining", () => {
    it("잔여 건수를 반환한다", async () => {
      const { getRemaining } = await importSms();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            result_code: "1",
            message: "success",
            SMS_CNT: "100",
            LMS_CNT: "50",
            MMS_CNT: "10",
          }),
      });

      const result = await getRemaining();
      expect(result.SMS_CNT).toBe("100");
      expect(result.LMS_CNT).toBe("50");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe("https://apis.aligo.in/remain/");
    });
  });

  // ─── getSmsHistory ───

  describe("getSmsHistory", () => {
    it("발송 이력을 조회한다", async () => {
      const { getSmsHistory } = await importSms();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            result_code: "1",
            message: "success",
            list: [{ mid: "123", type: "SMS", sender: "02-1234-5678" }],
            next_yn: "N",
          }),
      });

      const result = await getSmsHistory({ page: 1, pageSize: 10 });
      expect(result.list).toHaveLength(1);
      expect(result.list[0].mid).toBe("123");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe("https://apis.aligo.in/list/");
    });
  });

  // ─── getSmsDetail ───

  describe("getSmsDetail", () => {
    it("발송 상세를 조회한다", async () => {
      const { getSmsDetail } = await importSms();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            result_code: "1",
            message: "success",
            list: [{ mdid: "d-1", receiver: "01012345678", sms_state: "발송완료" }],
            next_yn: "N",
          }),
      });

      const result = await getSmsDetail({ mid: "123" });
      expect(result.list[0].sms_state).toBe("발송완료");

      const fd = mockFetch.mock.calls[0][1].body as FormData;
      expect(fd.get("mid")).toBe("123");
    });
  });

  // ─── cancelScheduledSms ───

  describe("cancelScheduledSms", () => {
    it("예약 발송을 취소한다", async () => {
      const { cancelScheduledSms } = await importSms();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            result_code: "1",
            message: "success",
          }),
      });

      const result = await cancelScheduledSms({ mid: "456" });
      expect(result.result_code).toBe("1");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe("https://apis.aligo.in/cancel/");
    });
  });
});
