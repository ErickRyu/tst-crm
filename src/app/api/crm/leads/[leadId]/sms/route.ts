import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads, smsLogs, leadMemos } from "@/lib/schema";
import { sendSms } from "@/lib/sms";
import { z } from "zod";

type Params = { params: Promise<{ leadId: string }> };

const smsSendSchema = z.object({
  msg: z.string().min(1, "메시지 내용은 필수입니다.").max(2000),
  templateKey: z.string().optional(),
  msgType: z.enum(["SMS", "LMS"]).optional(),
  title: z.string().max(44).optional(),
  senderName: z.string().min(1).max(50),
});

export async function POST(request: NextRequest, { params }: Params) {
  const { leadId } = await params;
  const id = Number.parseInt(leadId, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ code: 400, message: "유효하지 않은 ID입니다." }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parsed = smsSendSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { code: 400, message: "유효하지 않은 요청입니다.", errors: parsed.error.issues },
        { status: 400 }
      );
    }

    // 리드 존재 여부 및 전화번호 조회
    const [lead] = await db
      .select({ id: leads.id, name: leads.name, phone: leads.phone })
      .from(leads)
      .where(eq(leads.id, id))
      .limit(1);

    if (!lead) {
      return NextResponse.json({ code: 404, message: "리드를 찾을 수 없습니다." }, { status: 404 });
    }

    // SMS 발송
    const result = await sendSms({
      receiver: lead.phone,
      msg: parsed.data.msg,
      msgType: parsed.data.msgType,
      title: parsed.data.title,
      patientName: lead.name,
    });

    const isSuccess = result.result_code === "1";
    const isTestMode = process.env.ALIGO_TESTMODE !== "N";
    const status = isTestMode ? "test" : isSuccess ? "sent" : "failed";

    // SMS 발송 로그 저장
    const [log] = await db
      .insert(smsLogs)
      .values({
        leadId: id,
        phone: lead.phone,
        templateKey: parsed.data.templateKey || null,
        body: parsed.data.msg,
        msgType: parsed.data.msgType || "SMS",
        status,
        senderName: parsed.data.senderName,
        msgId: result.msg_id || null,
        errorMessage: !isSuccess ? result.message : null,
      })
      .returning();

    // system 메모 자동 기록
    const memoBody = `[SMS ${isTestMode ? "테스트" : "발송"}] ${status === "test" ? "(테스트모드)" : status === "sent" ? "발송 완료" : "발송 실패"}\n수신: ${lead.phone}\n내용: ${parsed.data.msg.slice(0, 100)}${parsed.data.msg.length > 100 ? "..." : ""}`;

    await db.insert(leadMemos).values({
      leadId: id,
      authorName: `[시스템] ${parsed.data.senderName}`,
      body: memoBody,
    });

    return NextResponse.json({
      code: isSuccess || isTestMode ? 200 : 500,
      message: isTestMode
        ? "테스트 모드: SMS가 실제 발송되지 않았습니다."
        : isSuccess
          ? "SMS 발송 성공"
          : `SMS 발송 실패: ${result.message}`,
      data: {
        logId: log.id,
        msgId: result.msg_id,
        status,
        testMode: isTestMode,
        successCount: result.success_cnt,
        errorCount: result.error_cnt,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "SMS 발송 중 오류가 발생했습니다.";
    return NextResponse.json({ code: 500, message: msg }, { status: 500 });
  }
}

// GET: 해당 리드의 SMS 발송 이력
export async function GET(_request: NextRequest, { params }: Params) {
  const { leadId } = await params;
  const id = Number.parseInt(leadId, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ code: 400, message: "유효하지 않은 ID입니다." }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(smsLogs)
    .where(eq(smsLogs.leadId, id))
    .orderBy(smsLogs.createdAt)
    .limit(50);

  return NextResponse.json({ code: 200, message: "SMS 이력 조회 성공", data: rows });
}
