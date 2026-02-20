import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads } from "@/lib/schema";
import { crmScheduleUpdateSchema } from "@/lib/validation";

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
    } = {};

    if (Object.prototype.hasOwnProperty.call(parsed.data, "followUpAt")) {
      updates.followUpAt = parseDateTime(parsed.data.followUpAt ?? null);
    }

    if (Object.prototype.hasOwnProperty.call(parsed.data, "appointmentAt")) {
      updates.appointmentAt = parseDateTime(parsed.data.appointmentAt ?? null);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { code: 400, message: "변경할 일정 필드가 없습니다." },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(leads)
      .set(updates)
      .where(eq(leads.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { code: 404, message: "리드를 찾을 수 없습니다." },
        { status: 404 }
      );
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
