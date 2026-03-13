import { describe, it, expect, vi, beforeEach } from "vitest";
import { rateLimit } from "./rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    // Use unique keys per test to avoid cross-test pollution
  });

  it("allows requests within limit", () => {
    const key = `test-allow-${Date.now()}`;
    const result = rateLimit(key, 3, 60_000);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("tracks remaining count correctly", () => {
    const key = `test-count-${Date.now()}`;
    rateLimit(key, 3, 60_000);
    const r2 = rateLimit(key, 3, 60_000);
    expect(r2.remaining).toBe(1);
    const r3 = rateLimit(key, 3, 60_000);
    expect(r3.remaining).toBe(0);
    expect(r3.success).toBe(true);
  });

  it("blocks requests exceeding limit", () => {
    const key = `test-block-${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      rateLimit(key, 3, 60_000);
    }
    const blocked = rateLimit(key, 3, 60_000);
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("resets after window expires", () => {
    vi.useFakeTimers();
    const key = `test-reset-${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      rateLimit(key, 3, 1000);
    }
    expect(rateLimit(key, 3, 1000).success).toBe(false);

    vi.advanceTimersByTime(1001);
    const after = rateLimit(key, 3, 1000);
    expect(after.success).toBe(true);
    expect(after.remaining).toBe(2);
    vi.useRealTimers();
  });
});
