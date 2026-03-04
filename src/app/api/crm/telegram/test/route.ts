import { NextRequest, NextResponse } from "next/server";
import { testTelegramConnection, detectChatIds } from "@/lib/telegram";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { botToken, chatId, action } = body;

    if (!botToken) {
      return NextResponse.json(
        { code: 400, message: "Bot Token을 입력해주세요." },
        { status: 400 }
      );
    }

    // Chat ID 자동 감지
    if (action === "detect") {
      const result = await detectChatIds(botToken);
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

    // 테스트 메시지 전송
    if (!chatId) {
      return NextResponse.json(
        { code: 400, message: "Chat ID를 입력해주세요." },
        { status: 400 }
      );
    }

    const result = await testTelegramConnection(botToken, chatId);

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
