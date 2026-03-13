import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock("@/lib/schema", () => ({
  users: { id: "id", status: "status", role: "role" },
}));

import { requireAuth, hashPassword, verifyPassword } from "./auth-helpers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const mockAuth = vi.mocked(auth);

function mockDbSelect(result: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  };
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  return chain;
}

describe("requireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns mock admin when AUTH_ENABLED=false", async () => {
    const original = process.env.AUTH_ENABLED;
    process.env.AUTH_ENABLED = "false";

    // Re-import to pick up env change
    vi.resetModules();
    vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
    vi.mock("@/lib/db", () => ({ db: { select: vi.fn() } }));
    vi.mock("@/lib/schema", () => ({
      users: { id: "id", status: "status", role: "role" },
    }));

    const mod = await import("./auth-helpers");
    const result = await mod.requireAuth();
    expect(result.error).toBeNull();
    expect(result.user?.role).toBe("ADMIN");

    process.env.AUTH_ENABLED = original;
  });

  it("returns 401 when no session", async () => {
    mockAuth.mockResolvedValue(null as never);
    const result = await requireAuth();
    expect(result.error).not.toBeNull();
    expect(result.user).toBeNull();
  });

  it("returns 401 when user is inactive", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "1", name: "Test", email: "test@test.com" },
      expires: "",
    } as never);
    mockDbSelect([{ id: 1, status: "INACTIVE", role: "ADMIN" }]);

    const result = await requireAuth();
    expect(result.error).not.toBeNull();
    expect(result.user).toBeNull();
  });

  it("returns 403 when role does not match", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "1", name: "Test", email: "test@test.com" },
      expires: "",
    } as never);
    mockDbSelect([{ id: 1, status: "ACTIVE", role: "COUNSELOR" }]);

    const result = await requireAuth(["ADMIN"]);
    expect(result.error).not.toBeNull();
    expect(result.user).toBeNull();
  });

  it("returns user on successful auth", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "1", name: "Test", email: "test@test.com" },
      expires: "",
    } as never);
    mockDbSelect([{ id: 1, status: "ACTIVE", role: "ADMIN" }]);

    const result = await requireAuth();
    expect(result.error).toBeNull();
    expect(result.user).toEqual({
      id: 1,
      name: "Test",
      email: "test@test.com",
      role: "ADMIN",
    });
  });
});

describe("hashPassword / verifyPassword", () => {
  it("hashes and verifies password correctly", async () => {
    const password = "testPassword123";
    const hash = await hashPassword(password);
    expect(hash).not.toBe(password);
    expect(await verifyPassword(password, hash)).toBe(true);
  });

  it("rejects wrong password", async () => {
    const hash = await hashPassword("correct");
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});
