import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { crmSettings, telegramRecipients } from "@/lib/schema";
import { eq, InferSelectModel } from "drizzle-orm";
import { encrypt, decrypt } from "@/lib/crypto";
import { requireAuth } from "@/lib/auth-helpers";

type TelegramRecipientRow = InferSelectModel<typeof telegramRecipients>;

const TELEGRAM_KEYS = [
  "telegram_bot_token",
  "telegram_enabled",
  "telegram_notify_new_lead",
  "telegram_notify_status_change",
] as const;

type TelegramKey = (typeof TELEGRAM_KEYS)[number];

function isTelegramKey(key: string): key is TelegramKey {
  return (TELEGRAM_KEYS as readonly string[]).includes(key);
}

function maskToken(token: string): string {
  if (token.length <= 10) return "***";
  return token.slice(0, 5) + "..." + token.slice(-4);
}

export async function GET() {
  const authResult = await requireAuth(["ADMIN"]);
  if (authResult.error) return authResult.error;

  try {
    const rows = await db.select().from(crmSettings);
    const result: Record<string, string> = {};

    for (const row of rows) {
      if (!row.key.startsWith("telegram_")) continue;

      if (row.key === "telegram_bot_token") {
        try {
          const decrypted = decrypt(row.value);
          result[row.key] = maskToken(decrypted);
        } catch {
          result[row.key] = "***";
        }
      } else {
        result[row.key] = row.value;
      }
    }

    const recipientRows = await db.select().from(telegramRecipients);

    return NextResponse.json({
      code: 200,
      message: "텔레그램 설정 조회 성공",
      data: {
        ...result,
        recipients: recipientRows.map((r: TelegramRecipientRow) => ({
          id: r.id,
          chatId: r.chatId,
          label: r.label,
          chatType: r.chatType,
          isEnabled: r.isEnabled === 1,
        })),
      },
    });
  } catch {
    return NextResponse.json({ code: 500, message: "설정 조회 실패" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const authResult = await requireAuth(["ADMIN"]);
  if (authResult.error) return authResult.error;

  try {
    const body = await request.json();
    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ code: 400, message: "유효하지 않은 데이터입니다." }, { status: 400 });
    }

    const now = new Date();

    for (const [key, rawValue] of Object.entries(body)) {
      if (!isTelegramKey(key)) continue;

      let value = String(rawValue);

      // Encrypt bot token
      if (key === "telegram_bot_token") {
        if (!value || value.includes("...")) continue; // skip masked/empty tokens
        value = encrypt(value);
      }

      const [existing] = await db
        .select()
        .from(crmSettings)
        .where(eq(crmSettings.key, key))
        .limit(1);

      if (existing) {
        await db
          .update(crmSettings)
          .set({ value, updatedAt: now })
          .where(eq(crmSettings.key, key));
      } else {
        await db.insert(crmSettings).values({ key, value, updatedAt: now });
      }
    }

    return NextResponse.json({ code: 200, message: "텔레그램 설정이 저장되었습니다." });
  } catch (err) {
    console.error("[Telegram Settings PATCH]", err);
    const msg = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json({ code: 400, message: `설정 저장 실패: ${msg}` }, { status: 400 });
  }
}
