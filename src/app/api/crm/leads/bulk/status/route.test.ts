import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Thenable chain mock ──
let queryIndex = 0;
const queryResults: unknown[][] = [];

const chain: Record<string, unknown> = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
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

const mockLogActivity = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/activity-log", () => ({
  logActivity: (...args: unknown[]) => mockLogActivity(...args),
}));

vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual<typeof import("drizzle-orm")>("drizzle-orm");
  return { ...actual };
});

const { PATCH } = await import("./route");

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/crm/leads/bulk/status", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("PATCH /api/crm/leads/bulk/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryIndex = 0;
    queryResults.length = 0;
    mockLogActivity.mockReset().mockResolvedValue(undefined);
  });

  // ─── 유효성 검사 ───

  it("leadIds가 비어있으면 400을 반환해야 한다", async () => {
    const res = await PATCH(makeReq({ leadIds: [], crmStatus: "예약완료" }));
    expect(res.status).toBe(400);
  });

  it("유효하지 않은 crmStatus이면 400을 반환해야 한다", async () => {
    const res = await PATCH(makeReq({ leadIds: [1], crmStatus: "없는상태" }));
    expect(res.status).toBe(400);
  });

  it("leadIds가 100건 초과이면 400을 반환해야 한다", async () => {
    const ids = Array.from({ length: 101 }, (_, i) => i + 1);
    const res = await PATCH(makeReq({ leadIds: ids, crmStatus: "예약완료" }));
    expect(res.status).toBe(400);
  });

  it("leadIds에 문자열이 포함되면 400을 반환해야 한다", async () => {
    const res = await PATCH(makeReq({ leadIds: ["abc"], crmStatus: "예약완료" }));
    expect(res.status).toBe(400);
  });

  // ─── 전체 성공 ───

  it("전체 성공 시 success 카운트를 반환해야 한다", async () => {
    // 1st query: select current leads
    queryResults.push([
      { id: 1, crmStatus: "신규인입" },
      { id: 2, crmStatus: "1차부재" },
    ]);
    // 2nd query: update returning
    queryResults.push([{ id: 1 }, { id: 2 }]);

    const res = await PATCH(makeReq({ leadIds: [1, 2], crmStatus: "예약완료" }));
    const json = await res.json();

    expect(json.code).toBe(200);
    expect(json.data.success).toBe(2);
    expect(json.data.failed).toBe(0);
    expect(json.data.results).toHaveLength(2);
    expect(json.data.results[0].status).toBe("success");
  });

  it("성공 시 각 리드에 대해 logActivity를 호출해야 한다", async () => {
    queryResults.push([
      { id: 1, crmStatus: "신규인입" },
      { id: 2, crmStatus: "1차부재" },
    ]);
    queryResults.push([{ id: 1 }, { id: 2 }]);

    await PATCH(makeReq({ leadIds: [1, 2], crmStatus: "통화완료" }));

    // Wait for fire-and-forget promises
    await new Promise(r => setTimeout(r, 10));

    expect(mockLogActivity).toHaveBeenCalledTimes(2);
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: 1,
        action: "status_change",
        oldValue: "신규인입",
        newValue: "통화완료",
      })
    );
  });

  // ─── 부분 실패 (일부 리드가 DB에 없는 경우) ───

  it("존재하지 않는 리드는 not_found로 표시해야 한다", async () => {
    // DB에 id=1만 존재
    queryResults.push([{ id: 1, crmStatus: "신규인입" }]);
    // update도 id=1만 성공
    queryResults.push([{ id: 1 }]);

    const res = await PATCH(makeReq({ leadIds: [1, 999], crmStatus: "예약완료" }));
    const json = await res.json();

    expect(json.data.success).toBe(1);
    expect(json.data.failed).toBe(1);
    const notFound = json.data.results.find((r: { leadId: number }) => r.leadId === 999);
    expect(notFound.status).toBe("not_found");
    expect(notFound.error).toBeDefined();
  });

  // ─── 메시지 포맷 ───

  it("전체 성공 시 실패 메시지가 포함되지 않아야 한다", async () => {
    queryResults.push([{ id: 1, crmStatus: "신규인입" }]);
    queryResults.push([{ id: 1 }]);

    const res = await PATCH(makeReq({ leadIds: [1], crmStatus: "예약완료" }));
    const json = await res.json();

    expect(json.message).toBe("1건 상태 변경 완료");
    expect(json.message).not.toContain("실패");
  });

  it("부분 실패 시 실패 건수가 메시지에 포함되어야 한다", async () => {
    queryResults.push([{ id: 1, crmStatus: "신규인입" }]);
    queryResults.push([{ id: 1 }]);

    const res = await PATCH(makeReq({ leadIds: [1, 999], crmStatus: "예약완료" }));
    const json = await res.json();

    expect(json.message).toContain("1건 실패");
  });
});
