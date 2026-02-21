import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { leadMemos } from "@/lib/schema";
import { memoUpdateSchema } from "@/lib/validation";

type Params = { params: Promise<{ leadId: string; memoId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { leadId, memoId } = await params;
  const lid = Number.parseInt(leadId, 10);
  const mid = Number.parseInt(memoId, 10);
  if (Number.isNaN(lid) || Number.isNaN(mid)) {
    return NextResponse.json({ code: 400, message: "유효하지 않은 ID입니다." }, { status: 400 });
  }
  try {
    const body = await request.json();
    const parsed = memoUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ code: 400, message: "유효하지 않은 메모 데이터입니다." }, { status: 400 });
    }
    const where = and(eq(leadMemos.id, mid), eq(leadMemos.leadId, lid), eq(leadMemos.version, parsed.data.version));
    const [updated] = await db
      .update(leadMemos)
      .set({ body: parsed.data.body, updatedAt: new Date(), version: sql`${leadMemos.version} + 1` })
      .where(where)
      .returning();
    if (!updated) {
      return NextResponse.json({ code: 409, message: "다른 사용자가 먼저 수정했습니다. 새로고침 후 다시 시도하세요." }, { status: 409 });
    }
    return NextResponse.json({ code: 200, message: "메모가 수정되었습니다.", data: updated });
  } catch {
    return NextResponse.json({ code: 400, message: "잘못된 요청입니다." }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { leadId, memoId } = await params;
  const lid = Number.parseInt(leadId, 10);
  const mid = Number.parseInt(memoId, 10);
  if (Number.isNaN(lid) || Number.isNaN(mid)) {
    return NextResponse.json({ code: 400, message: "유효하지 않은 ID입니다." }, { status: 400 });
  }

  const [deleted] = await db
    .delete(leadMemos)
    .where(and(eq(leadMemos.id, mid), eq(leadMemos.leadId, lid)))
    .returning({ id: leadMemos.id });

  if (!deleted) {
    return NextResponse.json({ code: 404, message: "메모를 찾을 수 없습니다." }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
