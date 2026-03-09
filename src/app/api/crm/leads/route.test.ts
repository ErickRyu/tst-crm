import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Thenable chain mock ──
let queryIndex = 0;
const queryResults: unknown[][] = [];
let capturedOrderBy: unknown[] = [];
let capturedInsertCalls = 0;

const chain: Record<string, unknown> = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn((...args: unknown[]) => {
    capturedOrderBy = args;
    return chain;
  }),
  limit: vi.fn().mockReturnThis(),
  offset: vi.fn().mockReturnThis(),
  insert: vi.fn(() => {
    capturedInsertCalls++;
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

vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual<typeof import("drizzle-orm")>("drizzle-orm");
  return {
    ...actual,
    desc: vi.fn((col: unknown) => ({ direction: "desc", column: col })),
    asc: vi.fn((col: unknown) => ({ direction: "asc", column: col })),
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

const { GET } = await import("./route");

describe("GET /api/crm/leads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryIndex = 0;
    queryResults.length = 0;
    capturedOrderBy = [];
    capturedInsertCalls = 0;
  });

  // ─── 정렬 테스트 ───

  it("createdAt DESC를 1차 정렬 기준으로 사용해야 한다", async () => {
    queryResults.push([
      { lead: makeLead({ id: 1, createdAt: new Date("2025-03-01") }), memoBody: null },
    ]);

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

    queryResults.push([
      { lead: newest, memoBody: null },
      { lead: middle, memoBody: null },
      { lead: oldest, memoBody: null },
    ]);

    const req = new NextRequest("http://localhost/api/crm/leads");
    const res = await GET(req);
    const json = await res.json();

    expect(json.code).toBe(200);
    expect(json.data).toHaveLength(3);
    expect(json.data[0].id).toBe(3);
    expect(json.data[1].id).toBe(2);
    expect(json.data[2].id).toBe(1);
  });

  it("sortOrder=asc이면 ASC 정렬을 사용해야 한다", async () => {
    queryResults.push([]);

    const req = new NextRequest("http://localhost/api/crm/leads?sortOrder=asc");
    await GET(req);

    expect(capturedOrderBy[0]).toEqual({ direction: "asc", column: expect.anything() });
  });

  // ─── 중복 제거 테스트 ───

  it("LEFT JOIN으로 인한 중복 행을 제거해야 한다", async () => {
    const lead = makeLead({ id: 1, createdAt: new Date("2025-01-01") });

    queryResults.push([
      { lead, memoBody: "메모 1" },
      { lead, memoBody: "메모 2" },
    ]);

    const req = new NextRequest("http://localhost/api/crm/leads");
    const res = await GET(req);
    const json = await res.json();

    expect(json.data).toHaveLength(1);
    expect(json.data[0].memoBody).toBe("메모 1");
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
    queryResults.push([
      { lead: makeLead({ id: 1, assigneeId: 5 }), memoBody: null },
    ]);

    const req = new NextRequest("http://localhost/api/crm/leads?scope=mine&assigneeId=5");
    const res = await GET(req);
    const json = await res.json();

    expect(json.code).toBe(200);
    expect(json.meta.scope).toBe("mine");
    expect(json.meta.assigneeId).toBe(5);
  });

  it("limit 파라미터가 최대 300으로 제한되어야 한다", async () => {
    queryResults.push([]);

    const req = new NextRequest("http://localhost/api/crm/leads?limit=500");
    await GET(req);

    expect(chain.limit).toHaveBeenCalledWith(300);
  });

  it("limit 파라미터가 최소 1이어야 한다", async () => {
    queryResults.push([]);

    const req = new NextRequest("http://localhost/api/crm/leads?limit=0");
    await GET(req);

    expect(chain.limit).toHaveBeenCalledWith(1);
  });

  // ─── 응답 포맷 테스트 ───

  it("응답에 meta 정보가 포함되어야 한다", async () => {
    queryResults.push([]);

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
    queryResults.push([
      { lead: makeLead({ id: 1, crmStatus: "1차부재" }), memoBody: null },
    ]);

    const req = new NextRequest("http://localhost/api/crm/leads");
    const res = await GET(req);
    const json = await res.json();

    expect(json.data[0].priorityRank).toBe(1);
  });

  // ─── 페이지네이션 테스트 ───

  it("page 파라미터가 있으면 페이지네이션 모드로 동작해야 한다", async () => {
    // 1st query: count
    queryResults.push([{ count: 50 }]);
    // 2nd query: data
    queryResults.push([
      { lead: makeLead({ id: 1 }), memoBody: null },
    ]);

    const req = new NextRequest("http://localhost/api/crm/leads?page=0&pageSize=10");
    const res = await GET(req);
    const json = await res.json();

    expect(json.code).toBe(200);
    expect(json.meta.page).toBe(0);
    expect(json.meta.pageSize).toBe(10);
    expect(json.meta.totalCount).toBe(50);
    expect(json.meta.totalPages).toBe(5);
  });

  it("page=2, pageSize=10이면 offset이 20이어야 한다", async () => {
    queryResults.push([{ count: 100 }]);
    queryResults.push([]);

    const req = new NextRequest("http://localhost/api/crm/leads?page=2&pageSize=10");
    await GET(req);

    expect(chain.offset).toHaveBeenCalledWith(20);
  });

  it("pageSize는 최대 100으로 제한되어야 한다", async () => {
    queryResults.push([{ count: 0 }]);
    queryResults.push([]);

    const req = new NextRequest("http://localhost/api/crm/leads?page=0&pageSize=200");
    await GET(req);

    expect(chain.limit).toHaveBeenCalledWith(100);
  });

  it("pageSize는 최소 1이어야 한다", async () => {
    queryResults.push([{ count: 0 }]);
    queryResults.push([]);

    const req = new NextRequest("http://localhost/api/crm/leads?page=0&pageSize=0");
    await GET(req);

    expect(chain.limit).toHaveBeenCalledWith(1);
  });

  it("page가 없으면 페이지네이션 메타가 없어야 한다", async () => {
    queryResults.push([]);

    const req = new NextRequest("http://localhost/api/crm/leads");
    const res = await GET(req);
    const json = await res.json();

    expect(json.meta.page).toBeUndefined();
    expect(json.meta.totalCount).toBeUndefined();
  });

  // ─── 검색 테스트 ───

  it("search 파라미터가 있으면 where 절이 호출되어야 한다", async () => {
    queryResults.push([]);

    const req = new NextRequest("http://localhost/api/crm/leads?search=홍길동");
    await GET(req);

    expect(chain.where).toHaveBeenCalled();
  });

  it("search 결과가 정상적으로 반환되어야 한다", async () => {
    queryResults.push([
      { lead: makeLead({ id: 1, name: "홍길동" }), memoBody: null },
    ]);

    const req = new NextRequest("http://localhost/api/crm/leads?search=홍길동");
    const res = await GET(req);
    const json = await res.json();

    expect(json.code).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].name).toBe("홍길동");
  });

  // ─── 날짜 필터 테스트 ───

  it("from/to 파라미터가 있으면 where 절이 호출되어야 한다", async () => {
    queryResults.push([]);

    const req = new NextRequest("http://localhost/api/crm/leads?from=2025-01-01&to=2025-12-31");
    await GET(req);

    expect(chain.where).toHaveBeenCalled();
  });

  it("유효하지 않은 날짜는 무시되어야 한다", async () => {
    queryResults.push([]);

    const req = new NextRequest("http://localhost/api/crm/leads?from=invalid&to=also-invalid");
    const res = await GET(req);
    const json = await res.json();

    expect(json.code).toBe(200);
  });

  it("from/to가 meta에 포함되어야 한다", async () => {
    queryResults.push([]);

    const req = new NextRequest("http://localhost/api/crm/leads?from=2025-01-01&to=2025-12-31");
    const res = await GET(req);
    const json = await res.json();

    expect(json.meta.from).toBe("2025-01-01");
    expect(json.meta.to).toBe("2025-12-31");
  });
});
