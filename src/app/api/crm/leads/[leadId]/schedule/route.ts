import { NextRequest, NextResponse } from "next/server";
import { eq, and, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads } from "@/lib/schema";
import { crmScheduleUpdateSchema } from "@/lib/validation";
import { executeAutoSend } from "@/lib/auto-send";
import { logActivity } from "@/lib/activity-log";

type Params = { params: Promise<{ leadId: string }> };

function parseDateTime(value: string | null | undefined) {
  if (value == null) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

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
    const parsed = crmScheduleUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { code: 400, message: "유효하지 않은 일정 데이터입니다." },
        { status: 400 }
      );
    }

    const updates: {
      followUpAt?: Date | null;
      appointmentAt?: Date | null;
      updatedAt?: Date;
      version?: SQL | number;
    } = {};

    if (Object.prototype.hasOwnProperty.call(parsed.data, "followUpAt")) {
      updates.followUpAt = parseDateTime(parsed.data.followUpAt ?? null);
    }

    const settingAppointment = Object.prototype.hasOwnProperty.call(parsed.data, "appointmentAt");
    if (settingAppointment) {
      updates.appointmentAt = parseDateTime(parsed.data.appointmentAt ?? null);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { code: 400, message: "변경할 일정 필드가 없습니다." },
        { status: 400 }
      );
    }

    // Check previous state for appointment trigger
    let prevAppointmentAt: Date | null = null;
    if (settingAppointment && updates.appointmentAt) {
      const [prev] = await db
        .select({ appointmentAt: leads.appointmentAt })
        .from(leads)
        .where(eq(leads.id, id))
        .limit(1);
      prevAppointmentAt = prev?.appointmentAt ?? null;
    }

    const where = parsed.data.version
      ? and(eq(leads.id, id), eq(leads.version, parsed.data.version))
      : eq(leads.id, id);

    updates.updatedAt = new Date();
    updates.version = sql`${leads.version} + 1`;

    const [updated] = await db
      .update(leads)
      .set(updates)
      .where(where)
      .returning();

    if (!updated) {
      return NextResponse.json(
        { code: 409, message: "다른 상담원이 먼저 변경했습니다. 새로고침 후 다시 시도하세요." },
        { status: 409 }
      );
    }

    // Fire-and-forget: log activity for schedule changes
    const fmtDt = (d: Date | null | undefined) => d ? d.toISOString() : "없음";
    if (Object.prototype.hasOwnProperty.call(parsed.data, "followUpAt")) {
      logActivity({
        leadId: id,
        action: "schedule_follow_up",
        actorName: parsed.data.actorName || "시스템",
        oldValue: null,
        newValue: fmtDt(updates.followUpAt),
        detail: updates.followUpAt ? `추후통화 설정: ${fmtDt(updates.followUpAt)}` : "추후통화 취소",
      }).catch(console.error);
    }
    if (settingAppointment) {
      logActivity({
        leadId: id,
        action: "schedule_appointment",
        actorName: parsed.data.actorName || "시스템",
        oldValue: fmtDt(prevAppointmentAt),
        newValue: fmtDt(updates.appointmentAt),
        detail: updates.appointmentAt ? `예약 설정: ${fmtDt(updates.appointmentAt)}` : "예약 취소",
      }).catch(console.error);
    }

    // Fire-and-forget: auto-send for appointment_set (null → non-null)
    if (settingAppointment && updates.appointmentAt && !prevAppointmentAt) {
      executeAutoSend("appointment_set", null, {
        leadId: updated.id,
        name: updated.name,
        phone: updated.phone,
        category: updated.category,
        assigneeId: updated.assigneeId,
        appointmentAt: updated.appointmentAt,
      }).catch(console.error);
    }

    return NextResponse.json({
      code: 200,
      message: "일정이 변경되었습니다.",
      data: updated,
    });
  } catch {
    return NextResponse.json(
      { code: 400, message: "잘못된 요청입니다." },
      { status: 400 }
    );
  }
}
