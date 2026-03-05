import { NextRequest, NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads, users } from "@/lib/schema";
import { crmAssignSchema } from "@/lib/validation";
import { logActivity } from "@/lib/activity-log";

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

    const { assigneeId, version, actorName } = parsed.data;

    // Get previous assignee for logging
    const [currentLead] = await db
      .select({ assigneeId: leads.assigneeId })
      .from(leads)
      .where(eq(leads.id, id))
      .limit(1);
    const prevAssigneeId = currentLead?.assigneeId ?? null;

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

    // Fire-and-forget: log activity
    const allUsers = await db.select({ id: users.id, name: users.name }).from(users);
    const userMap = new Map<number, string>(allUsers.map((u: typeof allUsers[number]) => [u.id, u.name]));
    const oldName: string = prevAssigneeId ? (userMap.get(prevAssigneeId) || "미배정") : "미배정";
    const newName: string = assigneeId ? (userMap.get(assigneeId) || "미배정") : "미배정";
    logActivity({
      leadId: id,
      action: "assign",
      actorName: actorName || "시스템",
      oldValue: oldName,
      newValue: newName,
      detail: `담당자 변경: ${oldName} → ${newName}`,
    }).catch(console.error);

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
