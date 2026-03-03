import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── mock rows returned by DB ──
const mockRows: Array<{ lead: Record<string, unknown>; memoBody: string | null }> = [];

// capture orderBy arguments
let capturedOrderBy: unknown[] = [];

// ── mock drizzle query chain ──
const chain = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn((...args: unknown[]) => {
    capturedOrderBy = args;
    return chain;
  }),
  limit: vi.fn(() => Promise.resolve(mockRows)),
};

vi.mock("@/lib/db", () => ({ db: chain }));

vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual<typeof import("drizzle-orm")>("drizzle-orm");
  return {
    ...actual,
    desc: vi.fn((col: unknown) => ({ direction: "desc", column: col })),
  };
});

function makeLead(overrides: Record<string, unknown>) {
  return {
    id: 1,
    event: "test",
    site: "web",
    advertiser: "ad",
    media: "media",
    category: "임플란트",
    name: "홍길동",
    phone: "010-1234-5678",
    age: null,
    gender: null,
    branch: null,
    address: null,
    email: null,
    survey1: null,
    survey2: null,
    survey3: null,
    survey4: null,
    survey5: null,
    survey6: null,
    status: "대기",
    memo: null,
    ip: null,
    crmStatus: "신규인입",
    assigneeId: null,
    birthDate: null,
    lastCallAt: null,
    followUpAt: null,
    appointmentAt: null,
    updatedAt: new Date("2025-01-01"),
    version: 1,
    contactFailCount: 0,
    createdAt: new Date("2025-01-01"),
    ...overrides,
  };
}

// ── import GET after mocks are set up ──
const { GET } = await import("./route");

describe("GET /api/crm/leads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRows.length = 0;
    capturedOrderBy = [];
  });

  // ─── 정렬 테스트 ───

  it("createdAt DESC를 1차 정렬 기준으로 사용해야 한다", async () => {
    mockRows.push(
      { lead: makeLead({ id: 1, createdAt: new Date("2025-03-01") }), memoBody: null },
    );

    const req = new NextRequest("http://localhost/api/crm/leads");
    await GET(req);

    expect(chain.orderBy).toHaveBeenCalledTimes(1);
    expect(capturedOrderBy).toHaveLength(2);
    expect(capturedOrderBy[0]).toEqual({ direction: "desc", column: expect.anything() });
    expect(capturedOrderBy[1]).toEqual({ direction: "desc", column: expect.anything() });
  });

  it("결과가 유입일(createdAt) 내림차순으로 반환되어야 한다", async () => {
    const oldest = makeLead({ id: 1, createdAt: new Date("2025-01-01"), crmStatus: "신규인입" });
    const middle = makeLead({ id: 2, createdAt: new Date("2025-02-01"), crmStatus: "1차부재" });
    const newest = makeLead({ id: 3, createdAt: new Date("2025-03-01"), crmStatus: "신규인입" });

    // DB returns in desc order (as the query specifies)
    mockRows.push(
      { lead: newest, memoBody: null },
      { lead: middle, memoBody: null },
      { lead: oldest, memoBody: null },
    );

    const req = new NextRequest("http://localhost/api/crm/leads");
    const res = await GET(req);
    const json = await res.json();

    expect(json.code).toBe(200);
    expect(json.data).toHaveLength(3);
    expect(json.data[0].id).toBe(3); // newest first
    expect(json.data[1].id).toBe(2);
    expect(json.data[2].id).toBe(1); // oldest last
  });

  it("상태(crmStatus)와 관계없이 유입일 순으로 정렬되어야 한다", async () => {
    // 다양한 상태의 리드를 유입일 역순으로 배치
    const leads = [
      makeLead({ id: 1, createdAt: new Date("2025-03-01"), crmStatus: "예약완료" }),
      makeLead({ id: 2, createdAt: new Date("2025-02-01"), crmStatus: "1차부재" }),
      makeLead({ id: 3, createdAt: new Date("2025-01-01"), crmStatus: "신규인입" }),
    ];

    mockRows.push(
      { lead: leads[0], memoBody: null },
      { lead: leads[1], memoBody: null },
      { lead: leads[2], memoBody: null },
    );

    const req = new NextRequest("http://localhost/api/crm/leads");
    const res = await GET(req);
    const json = await res.json();

    // 예약완료(3/1) > 1차부재(2/1) > 신규인입(1/1) — 상태 무관, 유입일 순
    expect(json.data[0].crmStatus).toBe("예약완료");
    expect(json.data[1].crmStatus).toBe("1차부재");
    expect(json.data[2].crmStatus).toBe("신규인입");
  });

  // ─── 중복 제거 테스트 ───

  it("LEFT JOIN으로 인한 중복 행을 제거해야 한다", async () => {
    const lead = makeLead({ id: 1, createdAt: new Date("2025-01-01") });

    mockRows.push(
      { lead, memoBody: "메모 1" },
      { lead, memoBody: "메모 2" }, // same lead, different memo
    );

    const req = new NextRequest("http://localhost/api/crm/leads");
    const res = await GET(req);
    const json = await res.json();

    expect(json.data).toHaveLength(1);
    expect(json.data[0].memoBody).toBe("메모 1"); // 첫 행 사용
  });

  // ─── 파라미터 테스트 ───

  it("scope=mine에 assigneeId가 없으면 400을 반환해야 한다", async () => {
    const req = new NextRequest("http://localhost/api/crm/leads?scope=mine");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.code).toBe(400);
  });

  it("scope=mine에 assigneeId가 있으면 정상 응답해야 한다", async () => {
    mockRows.push(
      { lead: makeLead({ id: 1, assigneeId: 5 }), memoBody: null },
    );

    const req = new NextRequest("http://localhost/api/crm/leads?scope=mine&assigneeId=5");
    const res = await GET(req);
    const json = await res.json();

    expect(json.code).toBe(200);
    expect(json.meta.scope).toBe("mine");
    expect(json.meta.assigneeId).toBe(5);
  });

  it("limit 파라미터가 최대 300으로 제한되어야 한다", async () => {
    const req = new NextRequest("http://localhost/api/crm/leads?limit=500");
    await GET(req);

    expect(chain.limit).toHaveBeenCalledWith(300);
  });

  it("limit 파라미터가 최소 1이어야 한다", async () => {
    const req = new NextRequest("http://localhost/api/crm/leads?limit=0");
    await GET(req);

    expect(chain.limit).toHaveBeenCalledWith(1);
  });

  it("limit 기본값은 100이어야 한다", async () => {
    const req = new NextRequest("http://localhost/api/crm/leads");
    await GET(req);

    expect(chain.limit).toHaveBeenCalledWith(100);
  });

  // ─── 응답 포맷 테스트 ───

  it("응답에 meta 정보가 포함되어야 한다", async () => {
    const req = new NextRequest("http://localhost/api/crm/leads");
    const res = await GET(req);
    const json = await res.json();

    expect(json.meta).toEqual(
      expect.objectContaining({
        scope: "all",
        assigneeId: null,
        includeDone: false,
      })
    );
    expect(json.meta.actionableStatuses).toBeDefined();
    expect(json.meta.doneStatuses).toBeDefined();
  });

  it("각 리드에 priorityRank가 포함되어야 한다", async () => {
    mockRows.push(
      { lead: makeLead({ id: 1, crmStatus: "1차부재" }), memoBody: null },
    );

    const req = new NextRequest("http://localhost/api/crm/leads");
    const res = await GET(req);
    const json = await res.json();

    expect(json.data[0].priorityRank).toBe(1); // CRM_PRIORITY["1차부재"] = 1
  });
});
