import { NextRequest, NextResponse } from "next/server";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads, users } from "@/lib/schema";
import { bulkAssignSchema } from "@/lib/validation";
import { logActivity } from "@/lib/activity-log";
import { requireAuth } from "@/lib/auth-helpers";

export async function PATCH(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  try {
    const body = await request.json();
    const parsed = bulkAssignSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { code: 400, message: "유효하지 않은 요청입니다.", errors: parsed.error.issues },
        { status: 400 }
      );
    }

    const { leadIds, assigneeId } = parsed.data;

    // Validate assignee exists
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

    // Get current assignees for activity logging
    const currentLeads = await db
      .select({ id: leads.id, assigneeId: leads.assigneeId })
      .from(leads)
      .where(inArray(leads.id, leadIds));

    const existingIds = new Set(currentLeads.map((l: { id: number; assigneeId: number | null }) => l.id));
    const now = new Date();

    const updated = await db
      .update(leads)
      .set({
        assigneeId,
        updatedAt: now,
        version: sql`${leads.version} + 1`,
      })
      .where(inArray(leads.id, leadIds))
      .returning({ id: leads.id });

    const updatedIds = new Set(updated.map((r: { id: number }) => r.id));

    // Get user names for logging
    const allUsers = await db.select({ id: users.id, name: users.name }).from(users);
    const userMap = new Map<number, string>(allUsers.map((u: { id: number; name: string }) => [u.id, u.name]));
    const newName: string = assigneeId ? (userMap.get(assigneeId) ?? "미배정") : "미배정";

    for (const cl of currentLeads as { id: number; assigneeId: number | null }[]) {
      if (updatedIds.has(cl.id)) {
        const oldName: string = cl.assigneeId ? (userMap.get(cl.assigneeId) ?? "미배정") : "미배정";
        logActivity({
          leadId: cl.id,
          action: "assign",
          actorName: authResult.user.name,
          oldValue: oldName,
          newValue: newName,
          detail: `일괄 담당자 변경: ${oldName} → ${newName}`,
        }).catch(console.error);
      }
    }

    const results = leadIds.map(id => ({
      leadId: id,
      status: updatedIds.has(id) ? "success" : existingIds.has(id) ? "failed" : "not_found",
      ...((!existingIds.has(id)) && { error: "리드를 찾을 수 없습니다." }),
    }));

    const success = results.filter(r => r.status === "success").length;
    const failed = results.filter(r => r.status !== "success").length;

    return NextResponse.json({
      code: 200,
      message: `${success}건 담당자 변경 완료${failed > 0 ? `, ${failed}건 실패` : ""}`,
      data: { success, failed, results },
    });
  } catch {
    return NextResponse.json(
      { code: 400, message: "잘못된 요청입니다." },
      { status: 400 }
    );
  }
}
