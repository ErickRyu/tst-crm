import { NextRequest, NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads, smsLogs } from "@/lib/schema";
import { sendSms } from "@/lib/sms";
import { bulkSmsSchema } from "@/lib/validation";
import { requireAuth } from "@/lib/auth-helpers";

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  try {
    const body = await request.json();
    const parsed = bulkSmsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { code: 400, message: "유효하지 않은 요청입니다.", errors: parsed.error.issues },
        { status: 400 }
      );
    }

    const { leadIds, msg, templateKey, msgType } = parsed.data;

    // Fetch all target leads
    const targetLeads = await db
      .select({ id: leads.id, name: leads.name, phone: leads.phone })
      .from(leads)
      .where(inArray(leads.id, leadIds));

    type LeadInfo = { id: number; name: string; phone: string };
    const leadMap = new Map<number, LeadInfo>(targetLeads.map((l: LeadInfo) => [l.id, l]));

    const results: { leadId: number; status: string; error?: string }[] = [];
    let success = 0;
    let failed = 0;

    // Send SMS sequentially to avoid rate limiting
    for (const leadId of leadIds) {
      const lead = leadMap.get(leadId);
      if (!lead) {
        results.push({ leadId, status: "not_found", error: "리드를 찾을 수 없습니다." });
        failed++;
        continue;
      }

      try {
        const result = await sendSms({
          receiver: lead.phone,
          msg,
          msgType,
          patientName: lead.name,
        });

        const isSuccess = result.result_code === "1";
        const isTestMode = process.env.ALIGO_TESTMODE !== "N";
        const logStatus = isTestMode ? "test" : isSuccess ? "sent" : "failed";

        await db.insert(smsLogs).values({
          leadId,
          phone: lead.phone,
          templateKey: templateKey || null,
          body: msg,
          msgType: msgType || "SMS",
          status: logStatus,
          senderName: authResult.user.name,
          msgId: result.msg_id || null,
          errorMessage: !isSuccess ? result.message : null,
        });

        if (isSuccess || isTestMode) {
          results.push({ leadId, status: "success" });
          success++;
        } else {
          results.push({ leadId, status: "failed", error: result.message });
          failed++;
        }
      } catch (e) {
        results.push({ leadId, status: "failed", error: e instanceof Error ? e.message : "발송 오류" });
        failed++;
      }
    }

    return NextResponse.json({
      code: 200,
      message: `${success}건 SMS 발송 완료${failed > 0 ? `, ${failed}건 실패` : ""}`,
      data: { success, failed, results },
    });
  } catch {
    return NextResponse.json(
      { code: 400, message: "잘못된 요청입니다." },
      { status: 400 }
    );
  }
}
