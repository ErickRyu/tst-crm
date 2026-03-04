import { crmStatusValues } from "@/lib/validation";

export type CrmStatus = (typeof crmStatusValues)[number];

export const ACTIONABLE_STATUSES: CrmStatus[] = [
  "1차부재",
  "2차부재",
  "3차부재",
  "노쇼",
  "신규인입",
  "추후 통화희망",
];

export const DONE_STATUSES: CrmStatus[] = ["응대중", "통화완료", "예약완료"];

export const HIDDEN_STATUSES: CrmStatus[] = ["추가상담거부", "블랙리스트", "중복"];

export const CRM_PRIORITY: Record<CrmStatus, number> = {
  "1차부재": 1,
  "2차부재": 2,
  "3차부재": 3,
  노쇼: 4,
  신규인입: 5,
  "추후 통화희망": 6,
  응대중: 7,
  통화완료: 8,
  예약완료: 9,
  추가상담거부: 10,
  블랙리스트: 11,
  중복: 12,
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
  const targetYear = birth.getFullYear() + 65;
  const birthMonth = birth.getMonth();
  const birthDay = birth.getDate();

  // 윤년 2/29 보정: 해당 연도에 2/29가 없으면 2/28 24:00로 간주
  let seniorDate = new Date(targetYear, birthMonth, birthDay);
  if (Number.isNaN(seniorDate.getTime())) {
    if (birthMonth === 1 && birthDay === 29) {
      seniorDate = new Date(targetYear, 1, 28, 24, 0, 0);
    }
  }

  const isSenior65Plus = today >= seniorDate;
  const monthsUntil65 = isSenior65Plus ? 0 : diffInMonths(today, seniorDate);

  return { isSenior65Plus, monthsUntil65 };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function canTransition(_from: CrmStatus, _to: CrmStatus): boolean {
  // 모든 상태 간 전이를 허용 (향후 정책 복원 시 이 함수에서 차단)
  return true;
}
