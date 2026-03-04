import { db } from "@/lib/db";
import { autoSendRules, smsTemplates, smsLogs, crmSettings, users } from "@/lib/schema";
import { eq, and, gte } from "drizzle-orm";
import { sendSms, calcMsgType } from "@/lib/sms";

export interface LeadContext {
  leadId: number;
  name: string;
  phone: string;
  category: string;
  assigneeId: number | null;
  appointmentAt: string | Date | null;
}

// Simple in-memory dedup (60s window)
const recentSends = new Map<string, number>();

function dedup(leadId: number, ruleId: number): boolean {
  const key = `${leadId}:${ruleId}`;
  const now = Date.now();
  const last = recentSends.get(key);
  if (last && now - last < 60_000) return false;
  recentSends.set(key, now);
  // Cleanup old entries
  if (recentSends.size > 1000) {
    for (const [k, t] of recentSends) {
      if (now - t > 60_000) recentSends.delete(k);
    }
  }
  return true;
}

async function getClinicName(): Promise<string> {
  const [row] = await db
    .select({ value: crmSettings.value })
    .from(crmSettings)
    .where(eq(crmSettings.key, "clinic_name"))
    .limit(1);
  return row?.value || "OO치과";
}

async function getAssigneePhone(assigneeId: number | null): Promise<string> {
  if (!assigneeId) return "";
  const [user] = await db
    .select({ phone: users.phone })
    .from(users)
    .where(eq(users.id, assigneeId))
    .limit(1);
  return user?.phone || "";
}

function formatAppointment(at: string | Date | null): string {
  if (!at) return "(미정)";
  const d = new Date(at);
  if (isNaN(d.getTime())) return "(미정)";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function todayString(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function replaceVariables(
  body: string,
  vars: Record<string, string>
): string {
  let result = body;
  // New {변수명} format
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  // Legacy %고객명% format
  if (vars["고객명"]) {
    result = result.replace(/%고객명%/g, vars["고객명"]);
  }
  if (vars["고객이름"]) {
    result = result.replace(/%고객이름%/g, vars["고객이름"]);
  }
  return result;
}

export async function executeAutoSend(
  triggerType: "new_lead" | "appointment_set" | "status_absent",
  triggerValue: string | null,
  ctx: LeadContext
): Promise<void> {
  // Find matching enabled rules
  const conditions = [
    eq(autoSendRules.triggerType, triggerType),
    eq(autoSendRules.isEnabled, 1),
  ];
  if (triggerValue) {
    conditions.push(eq(autoSendRules.triggerValue, triggerValue));
  }

  const rules = await db
    .select({
      ruleId: autoSendRules.id,
      templateId: autoSendRules.templateId,
      triggerValue: autoSendRules.triggerValue,
    })
    .from(autoSendRules)
    .where(and(...conditions));

  if (rules.length === 0) return;

  // For rules without triggerValue match (null trigger_value matches any)
  const allRules = triggerValue
    ? [
        ...rules,
        ...(await db
          .select({
            ruleId: autoSendRules.id,
            templateId: autoSendRules.templateId,
            triggerValue: autoSendRules.triggerValue,
          })
          .from(autoSendRules)
          .where(
            and(
              eq(autoSendRules.triggerType, triggerType),
              eq(autoSendRules.isEnabled, 1),
              eq(autoSendRules.triggerValue, "")
            )
          )),
      ]
    : rules;

  // Dedup by ruleId
  const uniqueRules = Array.from(
    new Map(allRules.map((r) => [r.ruleId, r])).values()
  );

  const clinicName = await getClinicName();
  const assigneePhone = await getAssigneePhone(ctx.assigneeId);

  const vars: Record<string, string> = {
    고객명: ctx.name,
    고객이름: ctx.name,
    문의내용: ctx.category,
    Today: todayString(),
    "상담사 전화번호": assigneePhone,
    예약확정일시: formatAppointment(ctx.appointmentAt),
    치과명: clinicName,
  };

  for (const rule of uniqueRules) {
    if (!dedup(ctx.leadId, rule.ruleId)) continue;

    // Load template
    const [tpl] = await db
      .select()
      .from(smsTemplates)
      .where(
        and(eq(smsTemplates.id, rule.templateId), eq(smsTemplates.isActive, 1))
      )
      .limit(1);

    if (!tpl) continue;

    const msg = replaceVariables(tpl.body, vars);
    const { msgType: computedMsgType } = calcMsgType(msg);

    try {
      const result = await sendSms({
        receiver: ctx.phone,
        msg,
        msgType: computedMsgType,
        title: tpl.label,
      });

      await db.insert(smsLogs).values({
        leadId: ctx.leadId,
        phone: ctx.phone,
        templateKey: tpl.key,
        body: msg,
        msgType: computedMsgType,
        status: result.result_code === "1" ? "sent" : "failed",
        senderName: "시스템(자동)",
        msgId: result.msg_id || null,
        errorMessage:
          result.result_code !== "1" ? result.message : null,
        isAutoSend: 1,
        autoSendRuleId: rule.ruleId,
      });
    } catch (err) {
      await db.insert(smsLogs).values({
        leadId: ctx.leadId,
        phone: ctx.phone,
        templateKey: tpl.key,
        body: msg,
        msgType: computedMsgType,
        status: "failed",
        senderName: "시스템(자동)",
        errorMessage: err instanceof Error ? err.message : "Unknown error",
        isAutoSend: 1,
        autoSendRuleId: rule.ruleId,
      });
    }
  }
}
