import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userTelegramRecipients } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-helpers";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  try {
    const { id } = await params;
    const recipientId = parseInt(id, 10);
    if (isNaN(recipientId)) {
      return NextResponse.json({ code: 400, message: "유효하지 않은 ID" }, { status: 400 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (body.label !== undefined) updates.label = String(body.label);
    if (body.isEnabled !== undefined) updates.isEnabled = body.isEnabled ? 1 : 0;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ code: 400, message: "수정할 항목이 없습니다." }, { status: 400 });
    }

    const [updated] = await db
      .update(userTelegramRecipients)
      .set(updates)
      .where(
        and(
          eq(userTelegramRecipients.id, recipientId),
          eq(userTelegramRecipients.userId, authResult.user.id)
        )
      )
      .returning();

    if (!updated) {
      return NextResponse.json({ code: 404, message: "수신자를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ code: 200, message: "수신자가 수정되었습니다.", data: updated });
  } catch (err) {
    console.error("[My Telegram Recipients PATCH]", err);
    return NextResponse.json({ code: 500, message: "수정 실패" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  try {
    const { id } = await params;
    const recipientId = parseInt(id, 10);
    if (isNaN(recipientId)) {
      return NextResponse.json({ code: 400, message: "유효하지 않은 ID" }, { status: 400 });
    }

    const [deleted] = await db
      .delete(userTelegramRecipients)
      .where(
        and(
          eq(userTelegramRecipients.id, recipientId),
          eq(userTelegramRecipients.userId, authResult.user.id)
        )
      )
      .returning();

    if (!deleted) {
      return NextResponse.json({ code: 404, message: "수신자를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ code: 200, message: "수신자가 삭제되었습니다." });
  } catch (err) {
    console.error("[My Telegram Recipients DELETE]", err);
    return NextResponse.json({ code: 500, message: "삭제 실패" }, { status: 500 });
  }
}
