import { NextRequest, NextResponse } from "next/server";
import { inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads } from "@/lib/schema";
import { bulkStatusUpdateSchema } from "@/lib/validation";
import { logActivity } from "@/lib/activity-log";
import { requireAuth } from "@/lib/auth-helpers";

export async function PATCH(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  try {
    const body = await request.json();
    const parsed = bulkStatusUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { code: 400, message: "유효하지 않은 요청입니다.", errors: parsed.error.issues },
        { status: 400 }
      );
    }

    const { leadIds, crmStatus } = parsed.data;

    // Get current statuses for activity logging
    const currentLeads = await db
      .select({ id: leads.id, crmStatus: leads.crmStatus })
      .from(leads)
      .where(inArray(leads.id, leadIds));

    const existingIds = new Set(currentLeads.map((l: { id: number; crmStatus: string | null }) => l.id));
    const now = new Date();

    // Bulk update — latest wins, no version check
    const updated = await db
      .update(leads)
      .set({
        crmStatus,
        lastCallAt: now,
        updatedAt: now,
        version: sql`${leads.version} + 1`,
      })
      .where(inArray(leads.id, leadIds))
      .returning({ id: leads.id });

    const updatedIds = new Set(updated.map((r: { id: number }) => r.id));

    // Log activities fire-and-forget
    for (const cl of currentLeads) {
      if (updatedIds.has(cl.id)) {
        logActivity({
          leadId: cl.id,
          action: "status_change",
          actorName: authResult.user.name,
          oldValue: cl.crmStatus || "신규인입",
          newValue: crmStatus,
          detail: `일괄 상태 변경: ${cl.crmStatus || "신규인입"} → ${crmStatus}`,
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
      message: `${success}건 상태 변경 완료${failed > 0 ? `, ${failed}건 실패` : ""}`,
      data: { success, failed, results },
    });
  } catch {
    return NextResponse.json(
      { code: 400, message: "잘못된 요청입니다." },
      { status: 400 }
    );
  }
}
