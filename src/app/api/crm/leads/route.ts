import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, inArray, sql, SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads, leadMemos } from "@/lib/schema";
import {
  ACTIONABLE_STATUSES,
  CRM_PRIORITY,
  DONE_STATUSES,
  calculateSeniorBadge,
  CrmStatus,
} from "@/lib/crm";

function parseBoolean(value: string | null, fallback: boolean) {
  if (value === null) return fallback;
  return value === "true";
}

function serializeLead(row: typeof leads.$inferSelect, memoBody: string | null) {
  const crmStatus = (row.crmStatus || "신규인입") as CrmStatus;
  const senior = calculateSeniorBadge(row.birthDate);

  return {
    ...row,
    crmStatus,
    priorityRank: CRM_PRIORITY[crmStatus],
    isSenior65Plus: senior.isSenior65Plus,
    monthsUntil65: senior.monthsUntil65,
    careTag: row.category,
    version: row.version,
    updatedAt: row.updatedAt,
    contactFailCount: row.contactFailCount,
    memoBody,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const scope = searchParams.get("scope") === "mine" ? "mine" : "all";
    const assigneeIdParam = searchParams.get("assigneeId");
    const assigneeId = assigneeIdParam ? parseInt(assigneeIdParam, 10) : null;
    const includeDone = parseBoolean(searchParams.get("includeDone"), false);
    const limit = Math.min(
      300,
      Math.max(1, parseInt(searchParams.get("limit") || "100", 10))
    );

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

    const priorityCase = sql<number>`case
      when ${leads.crmStatus} = '1차부재' then 1
      when ${leads.crmStatus} = '2차부재' then 2
      when ${leads.crmStatus} = '3차부재' then 3
      when ${leads.crmStatus} = '노쇼' then 4
      when ${leads.crmStatus} = '신규인입' then 5
      when ${leads.crmStatus} = '응대중' then 6
      when ${leads.crmStatus} = '통화완료' then 7
      when ${leads.crmStatus} = '예약완료' then 8
      else 99
    end`;

    const rows = await db
      .select({
        lead: leads,
        memoBody: leadMemos.body,
      })
      .from(leads)
      .leftJoin(leadMemos, eq(leads.id, leadMemos.leadId))
      .where(where)
      .orderBy(
        priorityCase,
        sql`coalesce(${leads.lastCallAt}, ${leads.createdAt}) asc`,
        asc(leads.createdAt),
        asc(leads.id)
      )
      .limit(limit);

    // LEFT JOIN으로 메모가 여러 개인 리드가 중복될 수 있으므로 첫 행만 사용
    const seen = new Set<number>();
    const data = rows.reduce<ReturnType<typeof serializeLead>[]>((acc, r) => {
      if (!seen.has(r.lead.id)) {
        seen.add(r.lead.id);
        acc.push(serializeLead(r.lead, r.memoBody));
      }
      return acc;
    }, []);

    return NextResponse.json({
      code: 200,
      message: "CRM 리드 목록 조회 성공",
      data,
      meta: {
        scope,
        assigneeId,
        includeDone,
        actionableStatuses: ACTIONABLE_STATUSES,
        doneStatuses: DONE_STATUSES,
      },
    });
  } catch (e) {
    console.error("[crm/leads] GET error", e);
    return NextResponse.json(
      { code: 400, message: "잘못된 요청입니다." },
      { status: 400 }
    );
  }
}
