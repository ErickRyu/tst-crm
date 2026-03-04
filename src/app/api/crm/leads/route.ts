import { NextRequest, NextResponse } from "next/server";
import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql, SQL } from "drizzle-orm";
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
    const isPaginated = searchParams.has("page");
    const page = Math.max(0, parseInt(searchParams.get("page") || "0", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));
    const limit = isPaginated
      ? pageSize
      : Math.min(300, Math.max(1, parseInt(searchParams.get("limit") || "300", 10)));
    const search = searchParams.get("search")?.trim() || "";

    const orderFn = searchParams.get("sortOrder") === "asc" ? asc : desc;

    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    const conditions: SQL[] = [];

    if (fromParam) {
      const fromDate = new Date(fromParam);
      if (!Number.isNaN(fromDate.getTime())) {
        conditions.push(gte(leads.createdAt, fromDate));
      }
    }
    if (toParam) {
      const toDate = new Date(toParam);
      if (!Number.isNaN(toDate.getTime())) {
        // to 날짜의 끝(다음날 자정)까지 포함
        toDate.setDate(toDate.getDate() + 1);
        conditions.push(lte(leads.createdAt, toDate));
      }
    }

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

    if (search) {
      conditions.push(
        or(
          ilike(leads.name, `%${search}%`),
          sql`${leads.phone} LIKE ${"%" + search + "%"}`
        )!
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // 페이지네이션 모드: count 쿼리 실행
    let totalCount = 0;
    let totalPages = 1;
    if (isPaginated) {
      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(leads)
        .where(where);
      totalCount = Number(countResult.count);
      totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    }

    const offset = isPaginated ? page * pageSize : 0;

    const rows = await db
      .select({
        lead: leads,
        memoBody: leadMemos.body,
      })
      .from(leads)
      .leftJoin(leadMemos, eq(leads.id, leadMemos.leadId))
      .where(where)
      .orderBy(
        orderFn(leads.createdAt),
        orderFn(leads.id)
      )
      .limit(limit)
      .offset(offset);

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
        from: fromParam || undefined,
        to: toParam || undefined,
        actionableStatuses: ACTIONABLE_STATUSES,
        doneStatuses: DONE_STATUSES,
        ...(isPaginated && {
          page,
          pageSize,
          totalCount,
          totalPages,
        }),
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
