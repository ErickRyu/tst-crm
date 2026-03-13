import { NextRequest, NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads, leadMemos } from "@/lib/schema";
import { memoCreateSchema } from "@/lib/validation";
import { logActivity } from "@/lib/activity-log";
import { requireAuth } from "@/lib/auth-helpers";

type Params = { params: Promise<{ leadId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  const { leadId } = await params;
  const id = Number.parseInt(leadId, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ code: 400, message: "유효하지 않은 ID입니다." }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(leadMemos)
    .where(eq(leadMemos.leadId, id))
    .orderBy(desc(leadMemos.createdAt))
    .limit(1);

  return NextResponse.json({ code: 200, message: "메모 조회 성공", data: rows });
}

export async function POST(request: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  const { leadId } = await params;
  const id = Number.parseInt(leadId, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ code: 400, message: "유효하지 않은 ID입니다." }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parsed = memoCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ code: 400, message: "유효하지 않은 메모 데이터입니다." }, { status: 400 });
    }

    // 리드 존재 여부 확인
    const [exists] = await db.select({ id: leads.id }).from(leads).where(eq(leads.id, id)).limit(1);
    if (!exists) {
      return NextResponse.json({ code: 404, message: "리드를 찾을 수 없습니다." }, { status: 404 });
    }

    // Upsert: 기존 메모가 있으면 업데이트, 없으면 새로 생성
    const [existing] = await db
      .select()
      .from(leadMemos)
      .where(eq(leadMemos.leadId, id))
      .orderBy(desc(leadMemos.createdAt))
      .limit(1);

    let memo;
    if (existing) {
      const [updated] = await db
        .update(leadMemos)
        .set({
          body: parsed.data.body,
          authorName: authResult.user.name,
          version: sql`${leadMemos.version} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(leadMemos.id, existing.id))
        .returning();
      memo = updated;
    } else {
      const [created] = await db
        .insert(leadMemos)
        .values({ leadId: id, authorName: authResult.user.name, body: parsed.data.body })
        .returning();
      memo = created;
    }

    // Fire-and-forget: log activity
    logActivity({
      leadId: id,
      action: "memo_save",
      actorName: authResult.user.name,
      detail: existing ? "메모 수정" : "메모 작성",
    }).catch(console.error);

    return NextResponse.json({ code: 200, message: "메모가 저장되었습니다.", data: memo });
  } catch {
    return NextResponse.json({ code: 400, message: "잘못된 요청입니다." }, { status: 400 });
  }
}
