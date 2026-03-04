import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  calculateSeniorBadge,
  CRM_PRIORITY,
  ACTIONABLE_STATUSES,
  DONE_STATUSES,
  CrmStatus,
} from "./crm";

// ─── CRM_PRIORITY ───

describe("CRM_PRIORITY", () => {
  it("12개 상태 모두 매핑되어야 한다", () => {
    expect(Object.keys(CRM_PRIORITY)).toHaveLength(12);
  });

  it("우선순위가 1~12 범위여야 한다", () => {
    const values = Object.values(CRM_PRIORITY);
    expect(Math.min(...values)).toBe(1);
    expect(Math.max(...values)).toBe(12);
  });

  it("1차부재가 가장 높은 우선순위(1)여야 한다", () => {
    expect(CRM_PRIORITY["1차부재"]).toBe(1);
  });

  it("중복이 가장 낮은 우선순위(12)여야 한다", () => {
    expect(CRM_PRIORITY["중복"]).toBe(12);
  });
});

// ─── ACTIONABLE_STATUSES / DONE_STATUSES ───

describe("ACTIONABLE_STATUSES / DONE_STATUSES", () => {
  it("ACTIONABLE_STATUSES는 5개여야 한다", () => {
    expect(ACTIONABLE_STATUSES).toHaveLength(5);
  });

  it("DONE_STATUSES는 3개여야 한다", () => {
    expect(DONE_STATUSES).toHaveLength(3);
  });

  it("ACTIONABLE과 DONE 사이에 겹치는 상태가 없어야 한다", () => {
    const overlap = ACTIONABLE_STATUSES.filter((s) =>
      (DONE_STATUSES as CrmStatus[]).includes(s)
    );
    expect(overlap).toHaveLength(0);
  });

  it("CRM_PRIORITY가 모든 CrmStatus를 포함해야 한다", () => {
    const priorityKeys = new Set(Object.keys(CRM_PRIORITY));
    const allStatuses = new Set([...ACTIONABLE_STATUSES, ...DONE_STATUSES]);
    // ACTIONABLE + DONE statuses must all exist in CRM_PRIORITY
    for (const s of allStatuses) {
      expect(priorityKeys.has(s)).toBe(true);
    }
    // CRM_PRIORITY should cover all 12 statuses
    expect(priorityKeys.size).toBe(12);
  });
});

// ─── calculateSeniorBadge ───

describe("calculateSeniorBadge", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 기준일: 2026-03-04
    vi.setSystemTime(new Date("2026-03-04T09:00:00+09:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("null 입력 시 isSenior65Plus=false, monthsUntil65=null", () => {
    const result = calculateSeniorBadge(null);
    expect(result.isSenior65Plus).toBe(false);
    expect(result.monthsUntil65).toBeNull();
  });

  it("유효하지 않은 날짜 문자열 시 isSenior65Plus=false, monthsUntil65=null", () => {
    const result = calculateSeniorBadge("invalid-date");
    expect(result.isSenior65Plus).toBe(false);
    expect(result.monthsUntil65).toBeNull();
  });

  it("65세 이상이면 isSenior65Plus=true, monthsUntil65=0", () => {
    // 1960-01-01 -> 65세 = 2025-01-01 (이미 지남)
    const result = calculateSeniorBadge("1960-01-01");
    expect(result.isSenior65Plus).toBe(true);
    expect(result.monthsUntil65).toBe(0);
  });

  it("정확히 오늘 65세가 되는 경우 isSenior65Plus=true", () => {
    // 1961-03-04 -> 65세 = 2026-03-04 (오늘)
    const result = calculateSeniorBadge("1961-03-04");
    expect(result.isSenior65Plus).toBe(true);
    expect(result.monthsUntil65).toBe(0);
  });

  it("65세 미만이면 isSenior65Plus=false, monthsUntil65 > 0", () => {
    // 1970-01-01 -> 65세 = 2035-01-01 (아직 안 됨)
    const result = calculateSeniorBadge("1970-01-01");
    expect(result.isSenior65Plus).toBe(false);
    expect(result.monthsUntil65).toBeGreaterThan(0);
  });

  it("monthsUntil65가 정확히 계산되어야 한다", () => {
    // 1962-03-04 -> 65세 = 2027-03-04, 현재 2026-03-04 → 12개월
    const result = calculateSeniorBadge("1962-03-04");
    expect(result.isSenior65Plus).toBe(false);
    expect(result.monthsUntil65).toBe(12);
  });

  it("윤년 2/29 생일 처리: 비윤년에도 정상 동작", () => {
    // 1960-02-29 -> 65세 = 2025-02-29 (2025는 비윤년)
    // 2/28 24:00 = 3/1 00:00으로 간주하므로 이미 지남 (현재 2026-03-04)
    const result = calculateSeniorBadge("1960-02-29");
    expect(result.isSenior65Plus).toBe(true);
    expect(result.monthsUntil65).toBe(0);
  });

  it("윤년 2/29 생일: 아직 65세 안 된 경우", () => {
    // 1964-02-29 -> 65세 = 2029-02-29 (2029는 비윤년 → 2029-03-01)
    const result = calculateSeniorBadge("1964-02-29");
    expect(result.isSenior65Plus).toBe(false);
    expect(result.monthsUntil65).toBeGreaterThan(0);
  });

  it("Date 객체도 받을 수 있다", () => {
    const result = calculateSeniorBadge(new Date("1960-06-15"));
    expect(result.isSenior65Plus).toBe(true);
  });
});
