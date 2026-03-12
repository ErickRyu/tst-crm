import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Thenable chain mock ──
let queryIndex = 0;
const queryResults: unknown[][] = [];
let insertCallCount = 0;

const chain: Record<string, unknown> = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  insert: vi.fn(() => {
    insertCallCount++;
    return chain;
  }),
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

const mockSendSms = vi.fn();
vi.mock("@/lib/sms", () => ({
  sendSms: (...args: unknown[]) => mockSendSms(...args),
}));

vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual<typeof import("drizzle-orm")>("drizzle-orm");
  return { ...actual };
});

const { POST } = await import("./route");

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/crm/leads/bulk/sms", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/crm/leads/bulk/sms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryIndex = 0;
    queryResults.length = 0;
    insertCallCount = 0;
    mockSendSms.mockReset();
  });

  // ─── 유효성 검사 ───

  it("leadIds가 비어있으면 400을 반환해야 한다", async () => {
    const res = await POST(makeReq({ leadIds: [], msg: "테스트", senderName: "김상담" }));
    expect(res.status).toBe(400);
  });

  it("msg가 비어있으면 400을 반환해야 한다", async () => {
    const res = await POST(makeReq({ leadIds: [1], msg: "", senderName: "김상담" }));
    expect(res.status).toBe(400);
  });

  it("senderName이 누락되면 400을 반환해야 한다", async () => {
    const res = await POST(makeReq({ leadIds: [1], msg: "테스트" }));
    expect(res.status).toBe(400);
  });

  it("leadIds가 50건 초과이면 400을 반환해야 한다", async () => {
    const ids = Array.from({ length: 51 }, (_, i) => i + 1);
    const res = await POST(makeReq({ leadIds: ids, msg: "테스트", senderName: "김상담" }));
    expect(res.status).toBe(400);
  });

  // ─── 전체 성공 ───

  it("발송 성공 시 올바른 결과를 반환해야 한다", async () => {
    // 1st: target leads
    queryResults.push([
      { id: 1, name: "홍길동", phone: "010-1234-5678" },
      { id: 2, name: "김철수", phone: "010-2345-6789" },
    ]);
    // 2nd, 3rd: smsLogs insert (2 leads)
    queryResults.push([]);
    queryResults.push([]);

    mockSendSms.mockResolvedValue({
      result_code: "1",
      message: "success",
      msg_id: "msg-123",
      success_cnt: 1,
      error_cnt: 0,
    });

    const res = await POST(makeReq({ leadIds: [1, 2], msg: "안녕하세요", senderName: "김상담" }));
    const json = await res.json();

    expect(json.code).toBe(200);
    expect(json.data.success).toBe(2);
    expect(json.data.failed).toBe(0);
    expect(mockSendSms).toHaveBeenCalledTimes(2);
    expect(json.message).toBe("2건 SMS 발송 완료");
  });

  it("각 리드에 대해 sendSms를 올바른 인자로 호출해야 한다", async () => {
    queryResults.push([
      { id: 1, name: "홍길동", phone: "010-1234-5678" },
    ]);
    queryResults.push([]);

    mockSendSms.mockResolvedValue({
      result_code: "1",
      message: "success",
      msg_id: "msg-1",
      success_cnt: 1,
      error_cnt: 0,
    });

    await POST(makeReq({ leadIds: [1], msg: "테스트 메시지", senderName: "김상담" }));

    expect(mockSendSms).toHaveBeenCalledWith(
      expect.objectContaining({
        receiver: "010-1234-5678",
        msg: "테스트 메시지",
        patientName: "홍길동",
      })
    );
  });

  // ─── 존재하지 않는 리드 ───

  it("존재하지 않는 리드는 not_found로 표시해야 한다", async () => {
    // 1st: only lead 1 exists
    queryResults.push([
      { id: 1, name: "홍길동", phone: "010-1234-5678" },
    ]);
    queryResults.push([]);

    mockSendSms.mockResolvedValue({
      result_code: "1",
      message: "success",
      msg_id: "msg-1",
      success_cnt: 1,
      error_cnt: 0,
    });

    const res = await POST(makeReq({ leadIds: [1, 999], msg: "테스트", senderName: "김상담" }));
    const json = await res.json();

    expect(json.data.success).toBe(1);
    expect(json.data.failed).toBe(1);
    const notFound = json.data.results.find((r: { leadId: number }) => r.leadId === 999);
    expect(notFound.status).toBe("not_found");
    expect(notFound.error).toBeDefined();
  });

  // ─── 발송 실패 ───

  it("sendSms 실패 시 해당 리드를 failed로 표시해야 한다", async () => {
    const origTestmode = process.env.ALIGO_TESTMODE;
    process.env.ALIGO_TESTMODE = "N";

    queryResults.push([
      { id: 1, name: "홍길동", phone: "010-1234-5678" },
    ]);
    queryResults.push([]);

    mockSendSms.mockResolvedValue({
      result_code: "-100",
      message: "인증 실패",
      msg_id: "",
      success_cnt: 0,
      error_cnt: 1,
    });

    const res = await POST(makeReq({ leadIds: [1], msg: "테스트", senderName: "김상담" }));
    const json = await res.json();

    expect(json.data.success).toBe(0);
    expect(json.data.failed).toBe(1);
    expect(json.data.results[0].status).toBe("failed");
    expect(json.data.results[0].error).toContain("인증 실패");

    process.env.ALIGO_TESTMODE = origTestmode;
  });

  it("sendSms가 예외를 throw하면 해당 리드를 failed로 표시해야 한다", async () => {
    queryResults.push([
      { id: 1, name: "홍길동", phone: "010-1234-5678" },
    ]);

    mockSendSms.mockRejectedValue(new Error("네트워크 오류"));

    const res = await POST(makeReq({ leadIds: [1], msg: "테스트", senderName: "김상담" }));
    const json = await res.json();

    expect(json.data.success).toBe(0);
    expect(json.data.failed).toBe(1);
    expect(json.data.results[0].error).toContain("네트워크 오류");
  });

  // ─── 혼합 결과 ───

  it("성공과 실패가 혼합될 때 올바른 카운트를 반환해야 한다", async () => {
    queryResults.push([
      { id: 1, name: "홍길동", phone: "010-1234-5678" },
      { id: 2, name: "김철수", phone: "010-2345-6789" },
    ]);
    queryResults.push([]);
    queryResults.push([]);

    mockSendSms
      .mockResolvedValueOnce({
        result_code: "1",
        message: "success",
        msg_id: "msg-1",
        success_cnt: 1,
        error_cnt: 0,
      })
      .mockRejectedValueOnce(new Error("발송 오류"));

    const res = await POST(makeReq({ leadIds: [1, 2], msg: "테스트", senderName: "김상담" }));
    const json = await res.json();

    expect(json.data.success).toBe(1);
    expect(json.data.failed).toBe(1);
    expect(json.message).toContain("1건 SMS 발송 완료");
    expect(json.message).toContain("1건 실패");
  });

  // ─── smsLogs insert 횟수 ───

  it("성공한 리드마다 smsLogs insert가 호출되어야 한다", async () => {
    queryResults.push([
      { id: 1, name: "홍길동", phone: "010-1234-5678" },
      { id: 2, name: "김철수", phone: "010-2345-6789" },
    ]);
    queryResults.push([]);
    queryResults.push([]);

    mockSendSms.mockResolvedValue({
      result_code: "1",
      message: "success",
      msg_id: "msg-1",
      success_cnt: 1,
      error_cnt: 0,
    });

    await POST(makeReq({ leadIds: [1, 2], msg: "테스트", senderName: "김상담" }));

    expect(insertCallCount).toBe(2);
  });

  // ─── templateKey 전달 ───

  it("templateKey가 전달되면 smsLogs에 저장되어야 한다", async () => {
    queryResults.push([
      { id: 1, name: "홍길동", phone: "010-1234-5678" },
    ]);
    queryResults.push([]);

    mockSendSms.mockResolvedValue({
      result_code: "1",
      message: "success",
      msg_id: "msg-1",
      success_cnt: 1,
      error_cnt: 0,
    });

    await POST(makeReq({ leadIds: [1], msg: "테스트", templateKey: "welcome", senderName: "김상담" }));

    expect(chain.values).toHaveBeenCalledWith(
      expect.objectContaining({ templateKey: "welcome" })
    );
  });
});
