import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, inArray, SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads, leadMemos, users } from "@/lib/schema";
import { ACTIONABLE_STATUSES } from "@/lib/crm";
import { TIMEZONE } from "@/lib/date";
import * as XLSX from "xlsx";

function parseBoolean(value: string | null, fallback: boolean) {
  if (value === null) return fallback;
  return value === "true";
}

function formatDate(d: Date | string | null): string {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleString("ko-KR", { timeZone: TIMEZONE });
}

function formatDateOnly(d: Date | string | null): string {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ko-KR", { timeZone: TIMEZONE });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const scope = searchParams.get("scope") === "mine" ? "mine" : "all";
    const assigneeIdParam = searchParams.get("assigneeId");
    const assigneeId = assigneeIdParam ? parseInt(assigneeIdParam, 10) : null;
    const includeDone = parseBoolean(searchParams.get("includeDone"), false);

    const conditions: SQL[] = [];

    if (scope === "mine") {
      if (!assigneeId || Number.isNaN(assigneeId)) {
        return NextResponse.json(
          { code: 400, message: "scope=mine에는 assigneeId가 필요합니다." },
          { status: 400 }
        );
      }
      conditions.push(eq(leads.assigneeId, assigneeId));
    }

    if (!includeDone) {
      conditions.push(inArray(leads.crmStatus, ACTIONABLE_STATUSES));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        lead: leads,
        memoBody: leadMemos.body,
        assigneeName: users.name,
      })
      .from(leads)
      .leftJoin(leadMemos, eq(leads.id, leadMemos.leadId))
      .leftJoin(users, eq(leads.assigneeId, users.id))
      .where(where)
      .orderBy(desc(leads.createdAt), desc(leads.id));

    // 중복 제거 (LEFT JOIN으로 메모가 여러 개인 리드)
    const seen = new Set<number>();
    const data = rows.reduce<
      { lead: typeof leads.$inferSelect; memoBody: string | null; assigneeName: string | null }[]
    >((acc, r) => {
      if (!seen.has(r.lead.id)) {
        seen.add(r.lead.id);
        acc.push(r);
      }
      return acc;
    }, []);

    const excelData = data.map((r) => ({
      이름: r.lead.name || "",
      전화번호: r.lead.phone || "",
      나이: r.lead.age ?? "",
      성별: r.lead.gender || "",
      생년월일: formatDateOnly(r.lead.birthDate),
      이메일: r.lead.email || "",
      주소: r.lead.address || "",
      치료종류: r.lead.category || "",
      지점: r.lead.branch || "",
      매체: r.lead.media || "",
      광고주: r.lead.advertiser || "",
      이벤트: r.lead.event || "",
      사이트: r.lead.site || "",
      "CRM 상태": r.lead.crmStatus || "",
      "담당 상담원": r.assigneeName || "",
      "부재 횟수": r.lead.contactFailCount ?? 0,
      유입일: formatDate(r.lead.createdAt),
      "마지막 통화": formatDate(r.lead.lastCallAt),
      "팔로업 예정": formatDate(r.lead.followUpAt),
      예약일: formatDate(r.lead.appointmentAt),
      메모: r.memoBody || r.lead.memo || "",
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);

    // 컬럼 너비 설정
    ws["!cols"] = [
      { wch: 10 }, // 이름
      { wch: 15 }, // 전화번호
      { wch: 6 },  // 나이
      { wch: 6 },  // 성별
      { wch: 12 }, // 생년월일
      { wch: 25 }, // 이메일
      { wch: 30 }, // 주소
      { wch: 15 }, // 치료종류
      { wch: 10 }, // 지점
      { wch: 10 }, // 매체
      { wch: 10 }, // 광고주
      { wch: 15 }, // 이벤트
      { wch: 15 }, // 사이트
      { wch: 10 }, // CRM 상태
      { wch: 10 }, // 담당 상담원
      { wch: 8 },  // 부재 횟수
      { wch: 20 }, // 유입일
      { wch: 20 }, // 마지막 통화
      { wch: 20 }, // 팔로업 예정
      { wch: 20 }, // 예약일
      { wch: 40 }, // 메모
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "리드 목록");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const today = new Date()
      .toLocaleDateString("ko-KR", { timeZone: TIMEZONE })
      .replace(/\. /g, "-")
      .replace(/\./g, "");
    const filename = `CRM_리드목록_${today}.xlsx`;

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (e) {
    console.error("[crm/leads/export] GET error", e);
    return NextResponse.json(
      { code: 500, message: "엑셀 파일 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
