import { crmStatusValues } from "@/lib/validation";

export type CrmStatus = (typeof crmStatusValues)[number];

export const ACTIONABLE_STATUSES: CrmStatus[] = [
  "1차부재",
  "2차부재",
  "3차부재",
  "노쇼",
  "신규인입",
];

export const DONE_STATUSES: CrmStatus[] = ["응대중", "통화완료", "예약완료"];

export const CRM_PRIORITY: Record<CrmStatus, number> = {
  "1차부재": 1,
  "2차부재": 2,
  "3차부재": 3,
  노쇼: 4,
  신규인입: 5,
  응대중: 6,
  통화완료: 7,
  예약완료: 8,
};

const TRANSITIONS: Record<CrmStatus, CrmStatus[]> = {
  신규인입: ["신규인입", "1차부재", "응대중", "통화완료", "예약완료"],
  "1차부재": ["1차부재", "2차부재", "응대중", "통화완료", "예약완료"],
  "2차부재": ["2차부재", "3차부재", "응대중", "통화완료", "예약완료"],
  "3차부재": ["3차부재", "노쇼", "응대중", "통화완료", "예약완료"],
  노쇼: ["노쇼", "응대중", "통화완료", "예약완료"],
  응대중: ["응대중", "1차부재", "2차부재", "3차부재", "노쇼", "통화완료", "예약완료"],
  통화완료: ["통화완료", "예약완료", "응대중"],
  예약완료: ["예약완료", "응대중"],
};

function normalizeDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function diffInMonths(from: Date, to: Date): number {
  const years = to.getFullYear() - from.getFullYear();
  const months = to.getMonth() - from.getMonth();
  let diff = years * 12 + months;
  if (to.getDate() < from.getDate()) diff -= 1;
  return Math.max(0, diff);
}

export function calculateSeniorBadge(birthDate: Date | string | null) {
  if (!birthDate) {
    return { isSenior65Plus: false, monthsUntil65: null as number | null };
  }

  const birth = normalizeDate(birthDate);
  if (Number.isNaN(birth.getTime())) {
    return { isSenior65Plus: false, monthsUntil65: null as number | null };
  }

  const today = new Date();
  const seniorDate = new Date(
    birth.getFullYear() + 65,
    birth.getMonth(),
    birth.getDate()
  );

  const isSenior65Plus = today >= seniorDate;
  const monthsUntil65 = isSenior65Plus ? 0 : diffInMonths(today, seniorDate);

  return { isSenior65Plus, monthsUntil65 };
}

export function canTransition(from: CrmStatus, to: CrmStatus) {
  return TRANSITIONS[from]?.includes(to) ?? false;
}
