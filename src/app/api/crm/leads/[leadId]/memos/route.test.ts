import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Thenable chain mock ──
let queryIndex = 0;
const queryResults: unknown[][] = [];
let capturedInsertValues: unknown = null;

const chain: Record<string, unknown> = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  offset: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  values: vi.fn((v: unknown) => {
    capturedInsertValues = v;
    return chain;
  }),
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
  return { ...actual };
});

const { GET, POST } = await import("./route");

function makeParams(leadId: string) {
  return { params: Promise.resolve({ leadId }) };
}

describe("GET /api/crm/leads/[leadId]/memos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryIndex = 0;
    queryResults.length = 0;
    capturedInsertValues = null;
  });

  it("잘못된 leadId이면 400을 반환해야 한다", async () => {
    const req = new NextRequest("http://localhost/api/crm/leads/abc/memos");
    const res = await GET(req, makeParams("abc"));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.code).toBe(400);
  });

  it("최신 메모 1개를 반환해야 한다", async () => {
    const memo = {
      id: 10,
      leadId: 1,
      authorName: "김상담",
      body: "상담 메모",
      version: 1,
      updatedAt: new Date("2025-03-01"),
      createdAt: new Date("2025-03-01"),
    };
    queryResults.push([memo]);

    const req = new NextRequest("http://localhost/api/crm/leads/1/memos");
    const res = await GET(req, makeParams("1"));
    const json = await res.json();

    expect(json.code).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(chain.limit).toHaveBeenCalledWith(1);
  });

  it("메모가 없으면 빈 배열을 반환해야 한다", async () => {
    queryResults.push([]);

    const req = new NextRequest("http://localhost/api/crm/leads/1/memos");
    const res = await GET(req, makeParams("1"));
    const json = await res.json();

    expect(json.code).toBe(200);
    expect(json.data).toHaveLength(0);
  });
});

describe("POST /api/crm/leads/[leadId]/memos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryIndex = 0;
    queryResults.length = 0;
    capturedInsertValues = null;
  });

  it("잘못된 leadId이면 400을 반환해야 한다", async () => {
    const req = new NextRequest("http://localhost/api/crm/leads/abc/memos", {
      method: "POST",
      body: JSON.stringify({ authorName: "김상담", body: "메모" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, makeParams("abc"));
    expect(res.status).toBe(400);
  });

  it("body가 2000자를 초과하면 400을 반환해야 한다", async () => {
    const req = new NextRequest("http://localhost/api/crm/leads/1/memos", {
      method: "POST",
      body: JSON.stringify({ authorName: "김상담", body: "a".repeat(2001) }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, makeParams("1"));
    expect(res.status).toBe(400);
  });

  it("리드가 없으면 404를 반환해야 한다", async () => {
    // lead check: 빈 배열 (리드 없음)
    queryResults.push([]);

    const req = new NextRequest("http://localhost/api/crm/leads/999/memos", {
      method: "POST",
      body: JSON.stringify({ authorName: "김상담", body: "메모" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, makeParams("999"));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.code).toBe(404);
  });

  it("기존 메모가 없으면 insert로 새로 생성해야 한다 (Upsert 생성)", async () => {
    // 1st: lead 존재 확인
    queryResults.push([{ id: 1 }]);
    // 2nd: 기존 메모 조회 (없음)
    queryResults.push([]);
    // 3rd: insert returning
    const created = {
      id: 1,
      leadId: 1,
      authorName: "김상담",
      body: "새 메모",
      version: 1,
      updatedAt: new Date(),
      createdAt: new Date(),
    };
    queryResults.push([created]);

    const req = new NextRequest("http://localhost/api/crm/leads/1/memos", {
      method: "POST",
      body: JSON.stringify({ authorName: "김상담", body: "새 메모" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, makeParams("1"));
    const json = await res.json();

    expect(json.code).toBe(200);
    expect(chain.insert).toHaveBeenCalled();
  });

  it("기존 메모가 있으면 update + version 증가해야 한다 (Upsert 업데이트)", async () => {
    // 1st: lead 존재 확인
    queryResults.push([{ id: 1 }]);
    // 2nd: 기존 메모 조회 (있음)
    const existing = {
      id: 10,
      leadId: 1,
      authorName: "김상담",
      body: "기존 메모",
      version: 2,
      updatedAt: new Date("2025-01-01"),
      createdAt: new Date("2025-01-01"),
    };
    queryResults.push([existing]);
    // 3rd: update returning
    queryResults.push([{ ...existing, body: "수정된 메모", version: 3 }]);

    const req = new NextRequest("http://localhost/api/crm/leads/1/memos", {
      method: "POST",
      body: JSON.stringify({ authorName: "김상담", body: "수정된 메모" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, makeParams("1"));
    const json = await res.json();

    expect(json.code).toBe(200);
    expect(chain.update).toHaveBeenCalled();
    expect(chain.set).toHaveBeenCalled();
  });
});
