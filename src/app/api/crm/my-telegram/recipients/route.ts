import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userTelegramRecipients } from "@/lib/schema";
import { requireAuth } from "@/lib/auth-helpers";

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  try {
    const body = await request.json();
    const { chatId, label, chatType } = body;

    if (!chatId || !label) {
      return NextResponse.json(
        { code: 400, message: "chatId와 label은 필수입니다." },
        { status: 400 }
      );
    }

    const [inserted] = await db
      .insert(userTelegramRecipients)
      .values({
        userId: authResult.user.id,
        chatId: String(chatId),
        label: String(label),
        chatType: chatType ? String(chatType) : null,
      })
      .returning();

    return NextResponse.json({
      code: 200,
      message: "수신자가 추가되었습니다.",
      data: inserted,
    });
  } catch (err) {
    console.error("[My Telegram Recipients POST]", err);
    return NextResponse.json(
      { code: 500, message: "수신자 추가 실패" },
      { status: 500 }
    );
  }
}
