import { db } from "@/lib/db";
import { crmSettings, telegramRecipients, userTelegramSettings, userTelegramRecipients } from "@/lib/schema";
import { eq, inArray, InferSelectModel } from "drizzle-orm";
import { decrypt } from "@/lib/crypto";
import * as Sentry from "@sentry/nextjs";

type TelegramRecipientRow = InferSelectModel<typeof telegramRecipients>;
interface TelegramRecipient {
  id: number;
  chatId: string;
  label: string;
  chatType: string | null;
  isEnabled: number;
  botToken?: string | null;
}

interface TelegramSettings {
  botToken: string | null;
  recipients: TelegramRecipient[];
  enabled: boolean;
  notifyNewLead: boolean;
  notifyStatusChange: boolean;
}

export async function getTelegramSettings(): Promise<TelegramSettings> {
  const maxRetries = 2;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
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

      const recipientRows: TelegramRecipientRow[] = await db
        .select()
        .from(telegramRecipients);

      return {
        botToken,
        recipients: recipientRows.map((r: TelegramRecipientRow) => ({
          id: r.id,
          chatId: r.chatId,
          label: r.label,
          chatType: r.chatType,
          isEnabled: r.isEnabled,
        })),
        enabled: map.telegram_enabled === "1",
        notifyNewLead: map.telegram_notify_new_lead !== "0",
        notifyStatusChange: map.telegram_notify_status_change !== "0",
      };
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }

  Sentry.captureException(lastError, {
    tags: { function: "getTelegramSettings", retries: maxRetries },
  });
  return {
    botToken: null,
    recipients: [],
    enabled: false,
    notifyNewLead: false,
    notifyStatusChange: false,
  };
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string
): Promise<{ ok: boolean; description?: string }> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const options: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    }),
  };

  const maxRetries = 2;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, options, 8000);
      return await res.json();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

function formatTime(date: Date | string): string {
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function sendToAllRecipients(
  fallbackBotToken: string | null,
  recipients: TelegramRecipient[],
  text: string,
  context: string
): Promise<void> {
  const activeRecipients = recipients.filter((r) => r.isEnabled === 1);
  if (activeRecipients.length === 0) {
    console.info(`[Telegram] ${context} skipped — no active recipients`);
    return;
  }

  const results = await Promise.allSettled(
    activeRecipients.map((r) => {
      const token = r.botToken || fallbackBotToken;
      if (!token) {
        return Promise.reject(new Error("no bot token"));
      }
      return sendTelegramMessage(token, r.chatId, text);
    })
  );

  results.forEach((result, idx) => {
    const recipient = activeRecipients[idx];
    if (result.status === "rejected") {
      const error = new Error(
        `[Telegram] ${context} failed for "${recipient.label}" (${recipient.chatId}): ${result.reason}`
      );
      console.error(error.message);
      Sentry.captureException(error, {
        tags: { recipientLabel: recipient.label, chatId: recipient.chatId },
      });
    } else if (!result.value.ok) {
      const error = new Error(
        `[Telegram] ${context} failed for "${recipient.label}" (${recipient.chatId}): ${result.value.description}`
      );
      console.error(error.message);
      Sentry.captureException(error, {
        tags: { recipientLabel: recipient.label, chatId: recipient.chatId },
      });
    }
  });
}

interface UserTelegramConfig {
  userId: number;
  botToken: string;
  notifyNewLead: boolean;
  notifyStatusChange: boolean;
  recipients: TelegramRecipient[];
}

async function getEnabledUserTelegramConfigs(): Promise<UserTelegramConfig[]> {
  try {
    // 1) enabled 사용자 설정 조회 (1 query)
    const settingsRows = await db
      .select()
      .from(userTelegramSettings)
      .where(eq(userTelegramSettings.enabled, 1));

    if (settingsRows.length === 0) return [];

    // botToken 복호화 + 유효한 설정만 필터
    const validSettings: Array<{ row: typeof settingsRows[number]; botToken: string }> = [];
    for (const row of settingsRows) {
      if (!row.botToken) continue;
      try {
        validSettings.push({ row, botToken: decrypt(row.botToken) });
      } catch {
        continue;
      }
    }

    if (validSettings.length === 0) return [];

    // 2) 해당 사용자들의 수신자 한번에 조회 (1 query, N+1 해소)
    const userIds = validSettings.map((s) => s.row.userId);
    const allRecipientRows = await db
      .select()
      .from(userTelegramRecipients)
      .where(inArray(userTelegramRecipients.userId, userIds));

    // userId 기준으로 그룹핑 (수신자별 botToken 복호화)
    const recipientsByUser = new Map<number, TelegramRecipient[]>();
    for (const r of allRecipientRows) {
      let recipientBotToken: string | null = null;
      if (r.botToken) {
        try {
          recipientBotToken = decrypt(r.botToken);
        } catch {
          // 복호화 실패 시 fallback으로 user-level 토큰 사용
        }
      }
      const list = recipientsByUser.get(r.userId) ?? [];
      list.push({ id: r.id, chatId: r.chatId, label: r.label, chatType: r.chatType, isEnabled: r.isEnabled, botToken: recipientBotToken });
      recipientsByUser.set(r.userId, list);
    }

    // 3) config 조립
    const configs: UserTelegramConfig[] = [];
    for (const { row, botToken } of validSettings) {
      const recipients = recipientsByUser.get(row.userId);
      if (!recipients || recipients.length === 0) continue;

      configs.push({
        userId: row.userId,
        botToken,
        notifyNewLead: row.notifyNewLead === 1,
        notifyStatusChange: row.notifyStatusChange === 1,
        recipients,
      });
    }

    return configs;
  } catch (err) {
    console.error("[Telegram] getEnabledUserTelegramConfigs error:", err);
    Sentry.captureException(err, { tags: { function: "getEnabledUserTelegramConfigs" } });
    return [];
  }
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
  const text = [
    "🆕 <b>새 리드 인입</b>",
    "",
    `👤 이름: ${lead.name}`,
    `📱 연락처: ${lead.phone}`,
    `📋 문의: ${lead.category}`,
    `🌐 사이트: ${lead.site}`,
    `🕐 시간: ${formatTime(lead.createdAt)}`,
  ].join("\n");

  const userConfigs = await getEnabledUserTelegramConfigs();
  if (userConfigs.length === 0) {
    console.info("[Telegram] notifyNewLead skipped — no enabled user configs");
    return;
  }

  await Promise.allSettled(
    userConfigs
      .filter((c) => c.notifyNewLead)
      .map((c) => sendToAllRecipients(c.botToken, c.recipients, text, `notifyNewLead(user:${c.userId})`))
  );
}

interface StatusChangeData {
  leadId: number;
  leadName: string;
  from: string;
  to: string;
  actorName: string;
}

export async function notifyStatusChange(data: StatusChangeData): Promise<void> {
  const text = [
    "🔄 <b>상태 변경</b>",
    "",
    `👤 리드: ${data.leadName}`,
    `📌 변경: ${data.from} → ${data.to}`,
    `🙋 담당: ${data.actorName}`,
  ].join("\n");

  const userConfigs = await getEnabledUserTelegramConfigs();
  if (userConfigs.length === 0) {
    console.info("[Telegram] notifyStatusChange skipped — no enabled user configs");
    return;
  }

  await Promise.allSettled(
    userConfigs
      .filter((c) => c.notifyStatusChange)
      .map((c) => sendToAllRecipients(c.botToken, c.recipients, text, `notifyStatusChange(user:${c.userId})`))
  );
}

export async function testTelegramConnection(
  botToken: string,
  chatId: string
): Promise<{ ok: boolean; description?: string }> {
  const text = "✅ <b>텔레그램 알림 연동 테스트</b>\n\nCRM 알림이 정상적으로 연결되었습니다.";
  return sendTelegramMessage(botToken, chatId, text);
}

interface TelegramChat {
  id: number;
  type: string;
  title?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export async function detectChatIds(
  botToken: string
): Promise<{ ok: boolean; chats: TelegramChat[]; description?: string }> {
  const res = await fetchWithTimeout(
    `https://api.telegram.org/bot${botToken}/getUpdates?limit=100`,
    {},
    8000
  );
  const data = await res.json();

  if (!data.ok) {
    return { ok: false, chats: [], description: data.description };
  }

  const chatMap = new Map<number, TelegramChat>();
  for (const update of data.result || []) {
    const msg = update.message || update.channel_post;
    if (msg?.chat) {
      chatMap.set(msg.chat.id, {
        id: msg.chat.id,
        type: msg.chat.type,
        title: msg.chat.title,
        first_name: msg.chat.first_name,
        last_name: msg.chat.last_name,
        username: msg.chat.username,
      });
    }
  }

  return { ok: true, chats: Array.from(chatMap.values()) };
}
