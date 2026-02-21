import { NextRequest, NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads } from "@/lib/schema";
import { canTransition, CrmStatus } from "@/lib/crm";
import { crmStatusUpdateSchema } from "@/lib/validation";

type Params = { params: Promise<{ leadId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { leadId } = await params;
  const id = Number.parseInt(leadId, 10);

  if (Number.isNaN(id)) {
    return NextResponse.json(
      { code: 400, message: "유효하지 않은 ID입니다." },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const parsed = crmStatusUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { code: 400, message: "유효하지 않은 상태값입니다." },
        { status: 400 }
      );
    }

    const [current] = await db
      .select({
        id: leads.id,
        crmStatus: leads.crmStatus,
        version: leads.version,
      })
      .from(leads)
      .where(eq(leads.id, id))
      .limit(1);

    if (!current) {
      return NextResponse.json(
        { code: 404, message: "리드를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const from = (current.crmStatus || "신규인입") as CrmStatus;
    const to = parsed.data.crmStatus;

    if (!canTransition(from, to)) {
      return NextResponse.json(
        {
          code: 400,
          message: `허용되지 않은 상태 전이입니다. (${from} -> ${to})`,
        },
        { status: 400 }
      );
    }

    const now = new Date();

    const where = parsed.data.version
      ? and(eq(leads.id, id), eq(leads.version, parsed.data.version))
      : eq(leads.id, id);

    const [updated] = await db
      .update(leads)
      .set({
        crmStatus: to,
        lastCallAt: now,
        updatedAt: now,
        version: sql`${leads.version} + 1`,
      })
      .where(where)
      .returning();

    if (!updated) {
      return NextResponse.json(
        { code: 409, message: "다른 상담원이 먼저 변경했습니다. 새로고침 후 다시 시도하세요." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        code: 200,
        message: "상태가 변경되었습니다.",
        data: updated,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { code: 400, message: "잘못된 요청입니다." },
      { status: 400 }
    );
  }
}
