import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { autoSendRules, smsTemplates } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { autoSendRuleCreateSchema } from "@/lib/validation";
import { requireAuth } from "@/lib/auth-helpers";

export async function GET() {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  try {
    const rules = await db
      .select({
        id: autoSendRules.id,
        triggerType: autoSendRules.triggerType,
        triggerValue: autoSendRules.triggerValue,
        templateId: autoSendRules.templateId,
        isEnabled: autoSendRules.isEnabled,
        createdAt: autoSendRules.createdAt,
        updatedAt: autoSendRules.updatedAt,
        templateKey: smsTemplates.key,
        templateLabel: smsTemplates.label,
        templateIcon: smsTemplates.icon,
        templateBody: smsTemplates.body,
        templateMsgType: smsTemplates.msgType,
      })
      .from(autoSendRules)
      .leftJoin(smsTemplates, eq(autoSendRules.templateId, smsTemplates.id))
      .orderBy(autoSendRules.id);

    return NextResponse.json({ code: 200, message: "규칙 조회 성공", data: rules });
  } catch {
    return NextResponse.json({ code: 500, message: "규칙 조회 실패" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(["ADMIN"]);
  if (authResult.error) return authResult.error;

  try {
    const body = await request.json();
    const parsed = autoSendRuleCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { code: 400, message: "유효하지 않은 데이터입니다." },
        { status: 400 }
      );
    }

    const [created] = await db
      .insert(autoSendRules)
      .values({
        triggerType: parsed.data.triggerType,
        triggerValue: parsed.data.triggerValue ?? null,
        templateId: parsed.data.templateId,
        isEnabled: parsed.data.isEnabled ? 1 : 0,
      })
      .returning();

    return NextResponse.json(
      { code: 201, message: "규칙이 생성되었습니다.", data: created },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ code: 400, message: "규칙 생성 실패" }, { status: 400 });
  }
}
