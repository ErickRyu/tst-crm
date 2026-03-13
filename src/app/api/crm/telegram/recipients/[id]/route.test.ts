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

const { PATCH, DELETE } = await import("./route");

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

// ─────────────────────────────────────────
// PATCH
// ─────────────────────────────────────────

describe("PATCH /api/crm/telegram/recipients/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryIndex = 0;
    queryResults.length = 0;
  });

  it("유효하지 않은 ID이면 400을 반환해야 한다", async () => {
    const req = new NextRequest("http://localhost/api/crm/telegram/recipients/abc", {
      method: "PATCH",
      body: JSON.stringify({ label: "새 라벨" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, makeParams("abc"));
    expect(res.status).toBe(400);
  });

  it("수정할 항목이 없으면 400을 반환해야 한다", async () => {
    const req = new NextRequest("http://localhost/api/crm/telegram/recipients/1", {
      method: "PATCH",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, makeParams("1"));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.message).toContain("수정할 항목");
  });

  it("라벨을 수정하면 200을 반환해야 한다", async () => {
    const updated = { id: 1, chatId: "123", label: "변경된 라벨", chatType: "private", isEnabled: 1 };
    queryResults.push([updated]);

    const req = new NextRequest("http://localhost/api/crm/telegram/recipients/1", {
      method: "PATCH",
      body: JSON.stringify({ label: "변경된 라벨" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, makeParams("1"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.label).toBe("변경된 라벨");
    expect(chain.update).toHaveBeenCalled();
    expect(chain.set).toHaveBeenCalled();
  });

  it("isEnabled를 토글하면 200을 반환해야 한다", async () => {
    const updated = { id: 1, chatId: "123", label: "테스트", chatType: "private", isEnabled: 0 };
    queryResults.push([updated]);

    const req = new NextRequest("http://localhost/api/crm/telegram/recipients/1", {
      method: "PATCH",
      body: JSON.stringify({ isEnabled: false }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, makeParams("1"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.isEnabled).toBe(0);
  });

  it("존재하지 않는 수신자이면 404를 반환해야 한다", async () => {
    queryResults.push([]);

    const req = new NextRequest("http://localhost/api/crm/telegram/recipients/999", {
      method: "PATCH",
      body: JSON.stringify({ label: "없는 수신자" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, makeParams("999"));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.code).toBe(404);
  });
});

// ─────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────

describe("DELETE /api/crm/telegram/recipients/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryIndex = 0;
    queryResults.length = 0;
  });

  it("유효하지 않은 ID이면 400을 반환해야 한다", async () => {
    const req = new NextRequest("http://localhost/api/crm/telegram/recipients/abc", {
      method: "DELETE",
    });
    const res = await DELETE(req, makeParams("abc"));
    expect(res.status).toBe(400);
  });

  it("수신자를 삭제하면 200을 반환해야 한다", async () => {
    const deleted = { id: 1, chatId: "123", label: "삭제 대상", chatType: "private", isEnabled: 1 };
    queryResults.push([deleted]);

    const req = new NextRequest("http://localhost/api/crm/telegram/recipients/1", {
      method: "DELETE",
    });
    const res = await DELETE(req, makeParams("1"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.code).toBe(200);
    expect(chain.delete).toHaveBeenCalled();
  });

  it("존재하지 않는 수신자이면 404를 반환해야 한다", async () => {
    queryResults.push([]);

    const req = new NextRequest("http://localhost/api/crm/telegram/recipients/999", {
      method: "DELETE",
    });
    const res = await DELETE(req, makeParams("999"));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.code).toBe(404);
  });
});
