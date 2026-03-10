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
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
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

const { POST } = await import("./route");

describe("POST /api/crm/telegram/recipients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryIndex = 0;
    queryResults.length = 0;
  });

  // ─── 유효성 검사 ───

  it("chatId가 없으면 400을 반환해야 한다", async () => {
    const req = new NextRequest("http://localhost/api/crm/telegram/recipients", {
      method: "POST",
      body: JSON.stringify({ label: "테스트" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.code).toBe(400);
  });

  it("label이 없으면 400을 반환해야 한다", async () => {
    const req = new NextRequest("http://localhost/api/crm/telegram/recipients", {
      method: "POST",
      body: JSON.stringify({ chatId: "123456" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.code).toBe(400);
  });

  it("chatId와 label 모두 없으면 400을 반환해야 한다", async () => {
    const req = new NextRequest("http://localhost/api/crm/telegram/recipients", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  // ─── 수신자 추가 성공 ───

  it("정상 요청 시 수신자를 추가하고 200을 반환해야 한다", async () => {
    const inserted = {
      id: 1,
      chatId: "123456",
      label: "원장님",
      chatType: "private",
      isEnabled: 1,
      createdAt: new Date(),
    };
    queryResults.push([inserted]);

    const req = new NextRequest("http://localhost/api/crm/telegram/recipients", {
      method: "POST",
      body: JSON.stringify({ chatId: "123456", label: "원장님", chatType: "private" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.code).toBe(200);
    expect(json.data.chatId).toBe("123456");
    expect(json.data.label).toBe("원장님");
    expect(chain.insert).toHaveBeenCalled();
    expect(chain.values).toHaveBeenCalled();
    expect(chain.returning).toHaveBeenCalled();
  });

  it("chatType 없이도 추가할 수 있어야 한다", async () => {
    const inserted = {
      id: 2,
      chatId: "-100999",
      label: "상담실",
      chatType: null,
      isEnabled: 1,
      createdAt: new Date(),
    };
    queryResults.push([inserted]);

    const req = new NextRequest("http://localhost/api/crm/telegram/recipients", {
      method: "POST",
      body: JSON.stringify({ chatId: "-100999", label: "상담실" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.chatType).toBeNull();
  });

  // ─── 중복 처리 ───

  it("중복된 chatId이면 409를 반환해야 한다", async () => {
    // insert에서 unique constraint 에러 발생
    chain.then = vi.fn(() => {
      throw new Error("duplicate key value violates unique constraint");
    });

    const req = new NextRequest("http://localhost/api/crm/telegram/recipients", {
      method: "POST",
      body: JSON.stringify({ chatId: "123456", label: "중복" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.code).toBe(409);

    // restore then
    chain.then = vi.fn((resolve: (v: unknown) => unknown) =>
      resolve(queryResults[queryIndex++] ?? [])
    );
  });
});
