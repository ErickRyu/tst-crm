import { NextRequest, NextResponse } from "next/server";
import { testTelegramConnection } from "@/lib/telegram";

export async function POST(request: NextRequest) {
  try {
    const { botToken, chatId } = await request.json();

    if (!botToken || !chatId) {
      return NextResponse.json(
        { code: 400, message: "Bot Token과 Chat ID를 모두 입력해주세요." },
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
