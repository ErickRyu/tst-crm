import { NextRequest, NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads, users } from "@/lib/schema";
import { crmAssignSchema } from "@/lib/validation";

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
    const parsed = crmAssignSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { code: 400, message: "유효하지 않은 할당 데이터입니다." },
        { status: 400 }
      );
    }

    const { assigneeId, version } = parsed.data;

    if (assigneeId !== null) {
      const [assignee] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, assigneeId))
        .limit(1);

      if (!assignee) {
        return NextResponse.json(
          { code: 404, message: "상담원을 찾을 수 없습니다." },
          { status: 404 }
        );
      }
    }

    const where = version ? and(eq(leads.id, id), eq(leads.version, version)) : eq(leads.id, id);

    const now = new Date();

    const [updated] = await db
      .update(leads)
      .set({
        assigneeId,
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

    return NextResponse.json({
      code: 200,
      message: "상담원 할당이 변경되었습니다.",
      data: updated,
    });
  } catch {
    return NextResponse.json(
      { code: 400, message: "잘못된 요청입니다." },
      { status: 400 }
    );
  }
}
