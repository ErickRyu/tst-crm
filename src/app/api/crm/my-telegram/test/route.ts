import { NextRequest, NextResponse } from "next/server";
import { testTelegramConnection, detectChatIds } from "@/lib/telegram";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { userTelegramSettings } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "@/lib/crypto";

async function getUserBotToken(userId: number): Promise<string | null> {
  const [settings] = await db
    .select({ botToken: userTelegramSettings.botToken })
    .from(userTelegramSettings)
    .where(eq(userTelegramSettings.userId, userId))
    .limit(1);

  if (!settings?.botToken) return null;
  try {
    return decrypt(settings.botToken);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  try {
    const body = await request.json();
    const { chatId, action } = body;

    const token = await getUserBotToken(authResult.user.id);
    if (!token) {
      return NextResponse.json(
        { code: 400, message: "저장된 Bot Token이 없습니다. 먼저 토큰을 저장해주세요." },
        { status: 400 }
      );
    }

    if (action === "detect") {
      const result = await detectChatIds(token);
      if (!result.ok) {
        return NextResponse.json(
          { code: 400, message: `감지 실패: ${result.description || "알 수 없는 오류"}` },
          { status: 400 }
        );
      }
      if (result.chats.length === 0) {
        return NextResponse.json(
          { code: 404, message: "감지된 채팅이 없습니다. 봇에게 먼저 메시지를 보내주세요." },
          { status: 404 }
        );
      }
      return NextResponse.json({ code: 200, message: "채팅 감지 성공", data: result.chats });
    }

    if (!chatId) {
      return NextResponse.json(
        { code: 400, message: "테스트할 Chat ID를 지정해주세요." },
        { status: 400 }
      );
    }

    const result = await testTelegramConnection(token, chatId);
    if (result.ok) {
      return NextResponse.json({ code: 200, message: "테스트 메시지가 전송되었습니다." });
    } else {
      return NextResponse.json(
        { code: 400, message: `전송 실패: ${result.description || "알 수 없는 오류"}` },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json(
      { code: 500, message: "테스트 실패. 네트워크를 확인해주세요." },
      { status: 500 }
    );
  }
}
