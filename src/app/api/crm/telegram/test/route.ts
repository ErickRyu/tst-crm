import { NextRequest, NextResponse } from "next/server";
import { testTelegramConnection, detectChatIds, getTelegramSettings } from "@/lib/telegram";
import { requireAuth } from "@/lib/auth-helpers";

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(["ADMIN"]);
  if (authResult.error) return authResult.error;

  try {
    const body = await request.json();
    const { botToken, chatId, action } = body;

    // body에 값이 없으면 DB에서 복호화된 토큰을 가져옴
    const settings = (!botToken || (!chatId && action !== "detect"))
      ? await getTelegramSettings()
      : null;
    const token = botToken || settings?.botToken;

    if (!token) {
      return NextResponse.json(
        { code: 400, message: "저장된 Bot Token이 없습니다. 먼저 토큰을 저장해주세요." },
        { status: 400 }
      );
    }

    // Chat ID 자동 감지
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

    // 테스트 메시지 전송 — chatId 파라미터로 특정 수신자 테스트
    const chat = chatId;
    if (!chat) {
      return NextResponse.json(
        { code: 400, message: "테스트할 Chat ID를 지정해주세요." },
        { status: 400 }
      );
    }

    const result = await testTelegramConnection(token, chat);

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
