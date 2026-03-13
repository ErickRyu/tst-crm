import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Thenable chain mock ──
let queryIndex = 0;
const queryResults: unknown[][] = [];
let insertCallCount = 0;

const chain: Record<string, unknown> = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  offset: vi.fn().mockReturnThis(),
  insert: vi.fn(() => {
    insertCallCount++;
    return chain;
  }),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn().mockReturnThis(),
  then: vi.fn((resolve: (v: unknown) => unknown) =>
    resolve(queryResults[queryIndex++] ?? [])
  ),
};

vi.mock("@/lib/db", () => ({ db: chain }));

vi.mock("@/lib/auth-helpers", () => ({
  requireAuth: vi.fn().mockResolvedValue({
    error: null,
    user: { id: 1, name: "테스트", email: "test@test.com", role: "ADMIN" },
  }),
}));

// Mock sendSms
const mockSendSms = vi.fn();
vi.mock("@/lib/sms", () => ({
  sendSms: (...args: unknown[]) => mockSendSms(...args),
}));

vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual<typeof import("drizzle-orm")>("drizzle-orm");
  return { ...actual };
});

const { GET, POST } = await import("./route");

function makeParams(leadId: string) {
  return { params: Promise.resolve({ leadId }) };
}

describe("POST /api/crm/leads/[leadId]/sms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryIndex = 0;
    queryResults.length = 0;
    insertCallCount = 0;
    mockSendSms.mockReset();
  });

  // ─── 유효성 검사 ───

  it("잘못된 leadId이면 400을 반환해야 한다", async () => {
    const req = new NextRequest("http://localhost/api/crm/leads/abc/sms", {
      method: "POST",
      body: JSON.stringify({ msg: "테스트", senderName: "김상담" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, makeParams("abc"));
    expect(res.status).toBe(400);
  });

  it("빈 msg이면 400을 반환해야 한다", async () => {
    const req = new NextRequest("http://localhost/api/crm/leads/1/sms", {
      method: "POST",
      body: JSON.stringify({ msg: "", senderName: "김상담" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, makeParams("1"));
    expect(res.status).toBe(400);
  });

  it("senderName이 없으면 400을 반환해야 한다", async () => {
    const req = new NextRequest("http://localhost/api/crm/leads/1/sms", {
      method: "POST",
      body: JSON.stringify({ msg: "테스트" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, makeParams("1"));
    expect(res.status).toBe(400);
  });

  // ─── 리드 확인 ───

  it("리드가 없으면 404를 반환해야 한다", async () => {
    // lead check: 빈 배열
    queryResults.push([]);

    const req = new NextRequest("http://localhost/api/crm/leads/999/sms", {
      method: "POST",
      body: JSON.stringify({ msg: "테스트", senderName: "김상담" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, makeParams("999"));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.code).toBe(404);
  });

  // ─── 발송 성공 ───

  it("발송 성공 시 sendSms 호출 및 smsLogs 저장", async () => {
    // 1st: lead 조회
    queryResults.push([{ id: 1, name: "홍길동", phone: "010-1234-5678" }]);
    // 2nd: smsLogs insert returning
    queryResults.push([{
      id: 1,
      leadId: 1,
      phone: "010-1234-5678",
      body: "테스트",
      msgType: "SMS",
      status: "test",
      senderName: "김상담",
    }]);

    mockSendSms.mockResolvedValue({
      result_code: "1",
      message: "success",
      msg_id: "msg-123",
      success_cnt: 1,
      error_cnt: 0,
      msg_type: "SMS",
    });

    const req = new NextRequest("http://localhost/api/crm/leads/1/sms", {
      method: "POST",
      body: JSON.stringify({ msg: "테스트", senderName: "김상담" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, makeParams("1"));
    const json = await res.json();

    expect(mockSendSms).toHaveBeenCalledTimes(1);
    expect(mockSendSms).toHaveBeenCalledWith(
      expect.objectContaining({
        receiver: "010-1234-5678",
        msg: "테스트",
        patientName: "홍길동",
      })
    );
    expect(json.code).toBe(200);
    expect(json.data.status).toBe("test");
  });

  // ─── 발송 실패 ───

  it("result_code가 실패이면 status=failed로 기록해야 한다", async () => {
    // 테스트모드가 아닐 때 실패 확인을 위해 환경변수 설정
    const origTestmode = process.env.ALIGO_TESTMODE;
    process.env.ALIGO_TESTMODE = "N";

    // 1st: lead 조회
    queryResults.push([{ id: 1, name: "홍길동", phone: "010-1234-5678" }]);
    // 2nd: smsLogs insert returning
    queryResults.push([{
      id: 1,
      leadId: 1,
      phone: "010-1234-5678",
      body: "테스트",
      msgType: "SMS",
      status: "failed",
      senderName: "김상담",
    }]);

    mockSendSms.mockResolvedValue({
      result_code: "-100",
      message: "인증 실패",
      msg_id: "",
      success_cnt: 0,
      error_cnt: 1,
      msg_type: "SMS",
    });

    const req = new NextRequest("http://localhost/api/crm/leads/1/sms", {
      method: "POST",
      body: JSON.stringify({ msg: "테스트", senderName: "김상담" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, makeParams("1"));
    const json = await res.json();

    expect(json.code).toBe(500);
    expect(chain.insert).toHaveBeenCalled();

    process.env.ALIGO_TESTMODE = origTestmode;
  });

  it("sendSms가 예외를 throw하면 500을 반환해야 한다", async () => {
    // 1st: lead 조회
    queryResults.push([{ id: 1, name: "홍길동", phone: "010-1234-5678" }]);

    mockSendSms.mockRejectedValue(new Error("네트워크 오류"));

    const req = new NextRequest("http://localhost/api/crm/leads/1/sms", {
      method: "POST",
      body: JSON.stringify({ msg: "테스트", senderName: "김상담" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, makeParams("1"));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.message).toContain("네트워크 오류");
  });

  // ─── 회귀 테스트: SMS 발송 후 insert 1회만 (smsLogs만, leadMemos 없음) ───

  it("SMS 발송 후 insert가 1회만 호출되어야 한다 (smsLogs만)", async () => {
    // 1st: lead 조회
    queryResults.push([{ id: 1, name: "홍길동", phone: "010-1234-5678" }]);
    // 2nd: smsLogs insert returning
    queryResults.push([{
      id: 1,
      leadId: 1,
      phone: "010-1234-5678",
      body: "테스트",
      msgType: "SMS",
      status: "test",
      senderName: "김상담",
    }]);

    mockSendSms.mockResolvedValue({
      result_code: "1",
      message: "success",
      msg_id: "msg-456",
      success_cnt: 1,
      error_cnt: 0,
      msg_type: "SMS",
    });

    const req = new NextRequest("http://localhost/api/crm/leads/1/sms", {
      method: "POST",
      body: JSON.stringify({ msg: "테스트", senderName: "김상담" }),
      headers: { "Content-Type": "application/json" },
    });
    await POST(req, makeParams("1"));

    // insert는 smsLogs 저장 1회만 호출되어야 함 (leadMemos insert 없음)
    expect(insertCallCount).toBe(1);
  });
});

describe("GET /api/crm/leads/[leadId]/sms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryIndex = 0;
    queryResults.length = 0;
    insertCallCount = 0;
  });

  it("잘못된 leadId이면 400을 반환해야 한다", async () => {
    const req = new NextRequest("http://localhost/api/crm/leads/abc/sms");
    const res = await GET(req, makeParams("abc"));
    expect(res.status).toBe(400);
  });

  it("SMS 이력을 정상적으로 반환해야 한다", async () => {
    const logs = [
      {
        id: 1,
        leadId: 1,
        phone: "010-1234-5678",
        body: "메시지1",
        msgType: "SMS",
        status: "sent",
        senderName: "김상담",
        createdAt: new Date(),
      },
    ];
    queryResults.push(logs);

    const req = new NextRequest("http://localhost/api/crm/leads/1/sms");
    const res = await GET(req, makeParams("1"));
    const json = await res.json();

    expect(json.code).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(chain.limit).toHaveBeenCalledWith(50);
  });
});
