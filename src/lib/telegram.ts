import { db } from "@/lib/db";
import { crmSettings } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "@/lib/crypto";

interface TelegramSettings {
  botToken: string | null;
  chatId: string | null;
  enabled: boolean;
  notifyNewLead: boolean;
  notifyStatusChange: boolean;
}

const TELEGRAM_KEYS = [
  "telegram_bot_token",
  "telegram_chat_id",
  "telegram_enabled",
  "telegram_notify_new_lead",
  "telegram_notify_status_change",
] as const;

export async function getTelegramSettings(): Promise<TelegramSettings> {
  const allRows = await db
    .select({ key: crmSettings.key, value: crmSettings.value })
    .from(crmSettings);

  const map: Record<string, string> = {};
  for (const row of allRows) {
    if (row.key.startsWith("telegram_")) {
      map[row.key] = row.value;
    }
  }

  let botToken: string | null = null;
  if (map.telegram_bot_token) {
    try {
      botToken = decrypt(map.telegram_bot_token);
    } catch {
      botToken = null;
    }
  }

  return {
    botToken,
    chatId: map.telegram_chat_id || null,
    enabled: map.telegram_enabled === "1",
    notifyNewLead: map.telegram_notify_new_lead !== "0",
    notifyStatusChange: map.telegram_notify_status_change !== "0",
  };
}

export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string
): Promise<{ ok: boolean; description?: string }> {
  const res = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
      }),
    }
  );
  return res.json();
}

function maskPhone(phone: string): string {
  if (phone.length < 7) return phone;
  return phone.slice(0, 3) + "-****-" + phone.slice(-4);
}

function formatTime(date: Date | string): string {
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface NewLeadData {
  id: number;
  name: string;
  phone: string;
  category: string;
  site: string;
  createdAt: Date | string;
}

export async function notifyNewLead(lead: NewLeadData): Promise<void> {
  const settings = await getTelegramSettings();
  if (!settings.enabled || !settings.notifyNewLead) return;
  if (!settings.botToken || !settings.chatId) return;

  const text = [
    "🆕 <b>새 리드 인입</b>",
    "",
    `👤 이름: ${lead.name}`,
    `📱 연락처: ${maskPhone(lead.phone)}`,
    `📋 문의: ${lead.category}`,
    `🌐 사이트: ${lead.site}`,
    `🕐 시간: ${formatTime(lead.createdAt)}`,
  ].join("\n");

  const result = await sendTelegramMessage(settings.botToken, settings.chatId, text);
  if (!result.ok) {
    console.error("[Telegram] Failed to send new lead notification:", result.description);
  }
}

interface StatusChangeData {
  leadId: number;
  leadName: string;
  from: string;
  to: string;
  actorName: string;
}

export async function notifyStatusChange(data: StatusChangeData): Promise<void> {
  const settings = await getTelegramSettings();
  if (!settings.enabled || !settings.notifyStatusChange) return;
  if (!settings.botToken || !settings.chatId) return;

  const text = [
    "🔄 <b>상태 변경</b>",
    "",
    `👤 리드: ${data.leadName}`,
    `📌 변경: ${data.from} → ${data.to}`,
    `🙋 담당: ${data.actorName}`,
  ].join("\n");

  const result = await sendTelegramMessage(settings.botToken, settings.chatId, text);
  if (!result.ok) {
    console.error("[Telegram] Failed to send status change notification:", result.description);
  }
}

export async function testTelegramConnection(
  botToken: string,
  chatId: string
): Promise<{ ok: boolean; description?: string }> {
  const text = "✅ <b>텔레그램 알림 연동 테스트</b>\n\nCRM 알림이 정상적으로 연결되었습니다.";
  return sendTelegramMessage(botToken, chatId, text);
}
