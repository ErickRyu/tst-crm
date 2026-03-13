import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { autoSendRules } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { autoSendRuleUpdateSchema } from "@/lib/validation";
import { requireAuth } from "@/lib/auth-helpers";

type Params = { params: Promise<{ ruleId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const authResult = await requireAuth(["ADMIN"]);
  if (authResult.error) return authResult.error;

  const { ruleId } = await params;
  const id = Number.parseInt(ruleId, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ code: 400, message: "유효하지 않은 ID입니다." }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parsed = autoSendRuleUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { code: 400, message: "유효하지 않은 데이터입니다." },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.triggerType !== undefined) updates.triggerType = parsed.data.triggerType;
    if (parsed.data.triggerValue !== undefined) updates.triggerValue = parsed.data.triggerValue;
    if (parsed.data.templateId !== undefined) updates.templateId = parsed.data.templateId;
    if (parsed.data.isEnabled !== undefined) updates.isEnabled = parsed.data.isEnabled ? 1 : 0;

    const [updated] = await db
      .update(autoSendRules)
      .set(updates)
      .where(eq(autoSendRules.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ code: 404, message: "규칙을 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ code: 200, message: "규칙이 수정되었습니다.", data: updated });
  } catch {
    return NextResponse.json({ code: 400, message: "규칙 수정 실패" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const authResult = await requireAuth(["ADMIN"]);
  if (authResult.error) return authResult.error;

  const { ruleId } = await params;
  const id = Number.parseInt(ruleId, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ code: 400, message: "유효하지 않은 ID입니다." }, { status: 400 });
  }

  try {
    const [deleted] = await db
      .delete(autoSendRules)
      .where(eq(autoSendRules.id, id))
      .returning();

    if (!deleted) {
      return NextResponse.json({ code: 404, message: "규칙을 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ code: 200, message: "규칙이 삭제되었습니다." });
  } catch {
    return NextResponse.json({ code: 400, message: "규칙 삭제 실패" }, { status: 400 });
  }
}
