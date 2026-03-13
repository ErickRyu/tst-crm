import { describe, it, expect } from "vitest";
import { TIMEZONE, TZ_OFFSET, parseDateAsKST, formatDateKST } from "./date";

describe("TIMEZONE / TZ_OFFSET", () => {
  it("TIMEZONE은 Asia/Seoul이어야 한다", () => {
    expect(TIMEZONE).toBe("Asia/Seoul");
  });

  it("TZ_OFFSET은 +09:00이어야 한다", () => {
    expect(TZ_OFFSET).toBe("+09:00");
  });
});

describe("parseDateAsKST", () => {
  it("날짜 문자열을 KST 자정(= UTC 전날 15:00) 기준으로 파싱한다", () => {
    const date = parseDateAsKST("2025-03-05");
    // KST 2025-03-05 00:00:00 = UTC 2025-03-04 15:00:00
    expect(date.toISOString()).toBe("2025-03-04T15:00:00.000Z");
  });

  it("1월 1일도 KST 기준으로 올바르게 파싱한다", () => {
    const date = parseDateAsKST("2025-01-01");
    // KST 2025-01-01 00:00:00 = UTC 2024-12-31 15:00:00
    expect(date.toISOString()).toBe("2024-12-31T15:00:00.000Z");
  });

  it("UTC new Date()와 다른 결과를 반환한다 (핵심 버그 시나리오)", () => {
    const kstDate = parseDateAsKST("2025-03-05");
    const utcDate = new Date("2025-03-05");
    // UTC 파싱은 2025-03-05T00:00:00Z, KST 파싱은 2025-03-04T15:00:00Z
    // KST 파싱이 9시간 앞서야 한다
    expect(utcDate.getTime() - kstDate.getTime()).toBe(9 * 60 * 60 * 1000);
  });
});

describe("formatDateKST", () => {
  it("UTC 시각을 KST 기준 YYYY-MM-DD로 포맷한다", () => {
    // UTC 2025-03-04 15:00:00 = KST 2025-03-05 00:00:00
    const date = new Date("2025-03-04T15:00:00.000Z");
    expect(formatDateKST(date)).toBe("2025-03-05");
  });

  it("UTC 자정은 KST 다음날로 포맷된다", () => {
    // UTC 2025-03-05 00:00:00 = KST 2025-03-05 09:00:00
    const date = new Date("2025-03-05T00:00:00.000Z");
    expect(formatDateKST(date)).toBe("2025-03-05");
  });

  it("UTC 14:59는 아직 KST 전날 23:59이다", () => {
    // UTC 2025-03-04 14:59:00 = KST 2025-03-04 23:59:00
    const date = new Date("2025-03-04T14:59:00.000Z");
    expect(formatDateKST(date)).toBe("2025-03-04");
  });

  it("parseDateAsKST와 formatDateKST는 왕복(round-trip) 가능하다", () => {
    const original = "2025-07-15";
    const parsed = parseDateAsKST(original);
    const formatted = formatDateKST(parsed);
    expect(formatted).toBe(original);
  });
});
