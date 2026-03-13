import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userTelegramSettings, userTelegramRecipients } from "@/lib/schema";
import { eq, InferSelectModel } from "drizzle-orm";
import { encrypt, decrypt } from "@/lib/crypto";
import { requireAuth } from "@/lib/auth-helpers";

type UserTelegramRecipientRow = InferSelectModel<typeof userTelegramRecipients>;

function maskToken(token: string): string {
  if (token.length <= 10) return "***";
  return token.slice(0, 5) + "..." + token.slice(-4);
}

export async function GET() {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  const userId = authResult.user.id;

  try {
    const [settings] = await db
      .select()
      .from(userTelegramSettings)
      .where(eq(userTelegramSettings.userId, userId))
      .limit(1);

    const recipients = await db
      .select()
      .from(userTelegramRecipients)
      .where(eq(userTelegramRecipients.userId, userId));

    let botTokenDisplay = "";
    if (settings?.botToken) {
      try {
        const decrypted = decrypt(settings.botToken);
        botTokenDisplay = maskToken(decrypted);
      } catch {
        botTokenDisplay = "***";
      }
    }

    return NextResponse.json({
      code: 200,
      message: "내 텔레그램 설정 조회 성공",
      data: {
        botToken: botTokenDisplay,
        enabled: settings?.enabled === 1,
        notifyNewLead: settings ? settings.notifyNewLead === 1 : true,
        notifyStatusChange: settings ? settings.notifyStatusChange === 1 : true,
        recipients: recipients.map((r: UserTelegramRecipientRow) => {
          let recipientBotToken = "";
          if (r.botToken) {
            try {
              recipientBotToken = maskToken(decrypt(r.botToken));
            } catch {
              recipientBotToken = "***";
            }
          }
          return {
            id: r.id,
            chatId: r.chatId,
            label: r.label,
            chatType: r.chatType,
            isEnabled: r.isEnabled === 1,
            botToken: recipientBotToken,
          };
        }),
      },
    });
  } catch {
    return NextResponse.json({ code: 500, message: "설정 조회 실패" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  const userId = authResult.user.id;

  try {
    const body = await request.json();
    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ code: 400, message: "유효하지 않은 데이터입니다." }, { status: 400 });
    }

    const now = new Date();

    // Check if settings row exists
    const [existing] = await db
      .select()
      .from(userTelegramSettings)
      .where(eq(userTelegramSettings.userId, userId))
      .limit(1);

    const updates: Record<string, unknown> = { updatedAt: now };

    if (body.botToken !== undefined) {
      const token = String(body.botToken);
      if (token && !token.includes("...")) {
        updates.botToken = encrypt(token);
      }
    }
    if (body.enabled !== undefined) {
      updates.enabled = body.enabled ? 1 : 0;
    }
    if (body.notifyNewLead !== undefined) {
      updates.notifyNewLead = body.notifyNewLead ? 1 : 0;
    }
    if (body.notifyStatusChange !== undefined) {
      updates.notifyStatusChange = body.notifyStatusChange ? 1 : 0;
    }

    if (existing) {
      await db
        .update(userTelegramSettings)
        .set(updates)
        .where(eq(userTelegramSettings.userId, userId));
    } else {
      await db.insert(userTelegramSettings).values({
        userId,
        ...updates,
        createdAt: now,
      });
    }

    return NextResponse.json({ code: 200, message: "내 텔레그램 설정이 저장되었습니다." });
  } catch (err) {
    console.error("[My Telegram Settings PATCH]", err);
    return NextResponse.json({ code: 400, message: "설정 저장 실패" }, { status: 400 });
  }
}
