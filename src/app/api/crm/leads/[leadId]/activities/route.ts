import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { leadActivities, smsLogs } from "@/lib/schema";

type Params = { params: Promise<{ leadId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { leadId } = await params;
  const id = Number.parseInt(leadId, 10);

  if (Number.isNaN(id)) {
    return NextResponse.json(
      { code: 400, message: "유효하지 않은 ID입니다." },
      { status: 400 }
    );
  }

  const [activities, sms] = await Promise.all([
    db
      .select()
      .from(leadActivities)
      .where(eq(leadActivities.leadId, id))
      .orderBy(desc(leadActivities.createdAt)),
    db
      .select()
      .from(smsLogs)
      .where(eq(smsLogs.leadId, id))
      .orderBy(desc(smsLogs.createdAt)),
  ]);

  const timeline = [
    ...activities.map((a) => ({
      id: `activity-${a.id}`,
      type: a.action,
      actorName: a.actorName,
      detail: a.detail,
      oldValue: a.oldValue,
      newValue: a.newValue,
      createdAt: a.createdAt.toISOString(),
    })),
    ...sms.map((s) => ({
      id: `sms-${s.id}`,
      type: "sms_sent",
      actorName: s.senderName,
      detail: `SMS ${s.status === "sent" ? "발송" : s.status === "test" ? "테스트 발송" : "실패"}: ${s.body.slice(0, 50)}${s.body.length > 50 ? "..." : ""}`,
      oldValue: null,
      newValue: s.phone,
      createdAt: s.createdAt.toISOString(),
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({ code: 200, message: "활동 이력 조회 성공", data: timeline });
}
