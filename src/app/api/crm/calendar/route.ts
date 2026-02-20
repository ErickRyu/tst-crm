import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, lte, or, SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads } from "@/lib/schema";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const assigneeIdParam = searchParams.get("assigneeId");
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    if (!assigneeIdParam) {
      return NextResponse.json(
        { code: 400, message: "assigneeId가 필요합니다." },
        { status: 400 }
      );
    }

    const assigneeId = Number.parseInt(assigneeIdParam, 10);
    if (Number.isNaN(assigneeId)) {
      return NextResponse.json(
        { code: 400, message: "유효하지 않은 assigneeId입니다." },
        { status: 400 }
      );
    }

    const from = fromParam ? new Date(fromParam) : null;
    const to = toParam ? new Date(toParam) : null;
    if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
      return NextResponse.json(
        { code: 400, message: "from/to 날짜 형식이 유효하지 않습니다." },
        { status: 400 }
      );
    }

    const conditions: SQL[] = [eq(leads.assigneeId, assigneeId)];

    if (from && to) {
      conditions.push(
        or(
          and(gte(leads.followUpAt, from), lte(leads.followUpAt, to)),
          and(gte(leads.appointmentAt, from), lte(leads.appointmentAt, to))
        )!
      );
    }

    const where = and(...conditions);
    const rows = await db.select().from(leads).where(where);

    const events = rows.flatMap((lead) => {
      const list = [] as Array<{
        id: string;
        leadId: number;
        patientName: string;
        phone: string;
        type: "follow_up" | "appointment";
        at: Date;
      }>;

      if (lead.followUpAt) {
        list.push({
          id: `f-${lead.id}`,
          leadId: lead.id,
          patientName: lead.name,
          phone: lead.phone,
          type: "follow_up",
          at: lead.followUpAt,
        });
      }

      if (lead.appointmentAt) {
        list.push({
          id: `a-${lead.id}`,
          leadId: lead.id,
          patientName: lead.name,
          phone: lead.phone,
          type: "appointment",
          at: lead.appointmentAt,
        });
      }

      return list;
    });

    events.sort((a, b) => a.at.getTime() - b.at.getTime());

    return NextResponse.json({
      code: 200,
      message: "캘린더 이벤트 조회 성공",
      data: events,
    });
  } catch {
    return NextResponse.json(
      { code: 400, message: "잘못된 요청입니다." },
      { status: 400 }
    );
  }
}
