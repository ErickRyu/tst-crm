export const TIMEZONE = "Asia/Seoul";
export const TZ_OFFSET = "+09:00";

/** "YYYY-MM-DD" 날짜 문자열을 KST 자정 기준 Date 객체로 파싱 */
export function parseDateAsKST(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00" + TZ_OFFSET);
}

/** Date를 KST 기준 "YYYY-MM-DD" 문자열로 포맷 */
export function formatDateKST(date: Date): string {
  return date
    .toLocaleDateString("ko-KR", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .replace(/\. /g, "-")
    .replace(/\./g, "");
}
