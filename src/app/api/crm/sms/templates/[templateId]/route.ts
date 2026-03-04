import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { smsTemplates } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { smsTemplateUpdateSchema } from "@/lib/validation";
import { calcMsgType } from "@/lib/sms";

type Params = { params: Promise<{ templateId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { templateId } = await params;
  const id = Number.parseInt(templateId, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ code: 400, message: "유효하지 않은 ID입니다." }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parsed = smsTemplateUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { code: 400, message: "유효하지 않은 데이터입니다." },
        { status: 400 }
      );
    }

    const { statuses, ...rest } = parsed.data;
    const updates: Record<string, unknown> = { ...rest, updatedAt: new Date() };
    if (statuses !== undefined) {
      updates.statuses = statuses ? JSON.stringify(statuses) : null;
    }
    if (rest.body) {
      updates.msgType = calcMsgType(rest.body).msgType;
    }

    const [updated] = await db
      .update(smsTemplates)
      .set(updates)
      .where(eq(smsTemplates.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ code: 404, message: "템플릿을 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ code: 200, message: "템플릿이 수정되었습니다.", data: updated });
  } catch {
    return NextResponse.json({ code: 400, message: "템플릿 수정 실패" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { templateId } = await params;
  const id = Number.parseInt(templateId, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ code: 400, message: "유효하지 않은 ID입니다." }, { status: 400 });
  }

  try {
    const [updated] = await db
      .update(smsTemplates)
      .set({ isActive: 0, updatedAt: new Date() })
      .where(eq(smsTemplates.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ code: 404, message: "템플릿을 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ code: 200, message: "템플릿이 삭제되었습니다." });
  } catch {
    return NextResponse.json({ code: 400, message: "템플릿 삭제 실패" }, { status: 400 });
  }
}
