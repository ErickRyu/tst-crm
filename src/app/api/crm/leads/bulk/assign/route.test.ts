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
  return new NextRequest("http://localhost/api/crm/leads/bulk/assign", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("PATCH /api/crm/leads/bulk/assign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryIndex = 0;
    queryResults.length = 0;
    mockLogActivity.mockReset().mockResolvedValue(undefined);
  });

  // ─── 유효성 검사 ───

  it("leadIds가 비어있으면 400을 반환해야 한다", async () => {
    const res = await PATCH(makeReq({ leadIds: [], assigneeId: 1 }));
    expect(res.status).toBe(400);
  });

  it("assigneeId가 누락되면 400을 반환해야 한다", async () => {
    const res = await PATCH(makeReq({ leadIds: [1] }));
    expect(res.status).toBe(400);
  });

  it("leadIds가 100건 초과이면 400을 반환해야 한다", async () => {
    const ids = Array.from({ length: 101 }, (_, i) => i + 1);
    const res = await PATCH(makeReq({ leadIds: ids, assigneeId: 1 }));
    expect(res.status).toBe(400);
  });

  // ─── 상담원 검증 ───

  it("존재하지 않는 상담원이면 404를 반환해야 한다", async () => {
    // 1st query: user check → empty
    queryResults.push([]);

    const res = await PATCH(makeReq({ leadIds: [1], assigneeId: 999 }));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.message).toContain("상담원");
  });

  // ─── assigneeId: null (미배정) ───

  it("assigneeId가 null이면 상담원 검증을 건너뛰고 성공해야 한다", async () => {
    // No user check needed
    // 1st: select current leads
    queryResults.push([{ id: 1, assigneeId: 5 }]);
    // 2nd: update returning
    queryResults.push([{ id: 1 }]);
    // 3rd: all users for name mapping
    queryResults.push([{ id: 5, name: "김상담" }]);

    const res = await PATCH(makeReq({ leadIds: [1], assigneeId: null }));
    const json = await res.json();

    expect(json.code).toBe(200);
    expect(json.data.success).toBe(1);
  });

  // ─── 전체 성공 ───

  it("전체 성공 시 올바른 결과를 반환해야 한다", async () => {
    // 1st: user exists check
    queryResults.push([{ id: 3 }]);
    // 2nd: current leads
    queryResults.push([
      { id: 1, assigneeId: null },
      { id: 2, assigneeId: 5 },
    ]);
    // 3rd: update returning
    queryResults.push([{ id: 1 }, { id: 2 }]);
    // 4th: all users for name mapping
    queryResults.push([
      { id: 3, name: "박상담" },
      { id: 5, name: "김상담" },
    ]);

    const res = await PATCH(makeReq({ leadIds: [1, 2], assigneeId: 3 }));
    const json = await res.json();

    expect(json.code).toBe(200);
    expect(json.data.success).toBe(2);
    expect(json.data.failed).toBe(0);
    expect(json.message).toBe("2건 담당자 변경 완료");
  });

  it("성공 시 각 리드에 대해 logActivity를 호출해야 한다", async () => {
    queryResults.push([{ id: 3 }]);
    queryResults.push([{ id: 1, assigneeId: null }]);
    queryResults.push([{ id: 1 }]);
    queryResults.push([{ id: 3, name: "박상담" }]);

    await PATCH(makeReq({ leadIds: [1], assigneeId: 3 }));

    await new Promise(r => setTimeout(r, 10));

    expect(mockLogActivity).toHaveBeenCalledTimes(1);
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: 1,
        action: "assign",
        oldValue: "미배정",
        newValue: "박상담",
      })
    );
  });

  // ─── 부분 실패 ───

  it("존재하지 않는 리드는 not_found로 표시해야 한다", async () => {
    queryResults.push([{ id: 3 }]);
    queryResults.push([{ id: 1, assigneeId: null }]);
    queryResults.push([{ id: 1 }]);
    queryResults.push([{ id: 3, name: "박상담" }]);

    const res = await PATCH(makeReq({ leadIds: [1, 999], assigneeId: 3 }));
    const json = await res.json();

    expect(json.data.success).toBe(1);
    expect(json.data.failed).toBe(1);
    const notFound = json.data.results.find((r: { leadId: number }) => r.leadId === 999);
    expect(notFound.status).toBe("not_found");
  });

  // ─── 메시지 포맷 ───

  it("부분 실패 시 실패 건수가 메시지에 포함되어야 한다", async () => {
    queryResults.push([{ id: 3 }]);
    queryResults.push([{ id: 1, assigneeId: null }]);
    queryResults.push([{ id: 1 }]);
    queryResults.push([{ id: 3, name: "박상담" }]);

    const res = await PATCH(makeReq({ leadIds: [1, 999], assigneeId: 3 }));
    const json = await res.json();

    expect(json.message).toContain("1건 실패");
  });
});
