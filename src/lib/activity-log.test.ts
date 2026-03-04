import { describe, it, expect, vi, beforeEach } from "vitest";

// ── DB mock ──
let capturedInsertValues: unknown = null;
let shouldThrow = false;

const chain: Record<string, unknown> = {
  insert: vi.fn().mockReturnThis(),
  values: vi.fn((v: unknown) => {
    capturedInsertValues = v;
    return chain;
  }),
  then: vi.fn((resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
    if (shouldThrow) {
      if (reject) return reject(new Error("DB insert failed"));
      throw new Error("DB insert failed");
    }
    return resolve(undefined);
  }),
};

vi.mock("@/lib/db", () => ({ db: chain }));

vi.mock("drizzle-orm", async () => {
  const actual =
    await vi.importActual<typeof import("drizzle-orm")>("drizzle-orm");
  return { ...actual };
});

const { logActivity } = await import("./activity-log");

describe("logActivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedInsertValues = null;
    shouldThrow = false;
  });

  it("필수 파라미터만 전달 시 oldValue/newValue/detail이 null로 삽입되어야 한다", async () => {
    await logActivity({
      leadId: 1,
      action: "status_change",
      actorName: "김상담",
    });

    expect(chain.insert).toHaveBeenCalled();
    expect(capturedInsertValues).toEqual({
      leadId: 1,
      action: "status_change",
      actorName: "김상담",
      oldValue: null,
      newValue: null,
      detail: null,
    });
  });

  it("모든 파라미터 전달 시 정확히 values에 반영되어야 한다", async () => {
    await logActivity({
      leadId: 2,
      action: "assign",
      actorName: "박상담",
      oldValue: "김상담",
      newValue: "이상담",
      detail: "담당자 변경",
    });

    expect(capturedInsertValues).toEqual({
      leadId: 2,
      action: "assign",
      actorName: "박상담",
      oldValue: "김상담",
      newValue: "이상담",
      detail: "담당자 변경",
    });
  });

  it("DB 에러 시 예외가 throw되어야 한다", async () => {
    shouldThrow = true;

    await expect(
      logActivity({
        leadId: 1,
        action: "status_change",
        actorName: "김상담",
      })
    ).rejects.toThrow("DB insert failed");
  });
});
