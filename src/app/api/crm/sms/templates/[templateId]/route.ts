import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { smsTemplates } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { smsTemplateUpdateSchema } from "@/lib/validation";
import { calcMsgType } from "@/lib/sms";
import { requireAuth } from "@/lib/auth-helpers";

type Params = { params: Promise<{ templateId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const authResult = await requireAuth(["ADMIN"]);
  if (authResult.error) return authResult.error;

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

    const { statuses, isActive, ...rest } = parsed.data;
    const updates: Record<string, unknown> = { ...rest, updatedAt: new Date() };
    if (statuses !== undefined) {
      updates.statuses = statuses ? JSON.stringify(statuses) : null;
    }
    if (isActive !== undefined) {
      updates.isActive = isActive ? 1 : 0;
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
  const authResult = await requireAuth(["ADMIN"]);
  if (authResult.error) return authResult.error;

  const { templateId } = await params;
  const id = Number.parseInt(templateId, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ code: 400, message: "유효하지 않은 ID입니다." }, { status: 400 });
  }

  try {
    // Guard: prevent deletion of default templates
    const [existing] = await db
      .select({ isDefault: smsTemplates.isDefault })
      .from(smsTemplates)
      .where(eq(smsTemplates.id, id));
    if (existing?.isDefault === 1) {
      return NextResponse.json(
        { code: 403, message: "기본 템플릿은 삭제할 수 없습니다. 비활성화를 이용해주세요." },
        { status: 403 }
      );
    }

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
