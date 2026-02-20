import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leads } from "@/lib/schema";
import { leadUpdateSchema } from "@/lib/validation";
import { eq } from "drizzle-orm";

type Params = { params: Promise<{ leadId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { leadId } = await params;
  const id = parseInt(leadId, 10);

  if (isNaN(id)) {
    return NextResponse.json(
      { code: 400, message: "유효하지 않은 ID입니다." },
      { status: 400 }
    );
  }

  const [lead] = await db.select().from(leads).where(eq(leads.id, id)).limit(1);

  if (!lead) {
    return NextResponse.json(
      { code: 404, message: "리드를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  return NextResponse.json(
    { code: 200, message: "리드를 조회했습니다.", data: lead },
    { status: 200 }
  );
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { leadId } = await params;
  const id = parseInt(leadId, 10);

  if (isNaN(id)) {
    return NextResponse.json(
      { code: 400, message: "유효하지 않은 ID입니다." },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const parsed = leadUpdateSchema.safeParse(body);

    if (!parsed.success) {
      const errors = parsed.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      return NextResponse.json(
        { code: 400, message: "유효하지 않은 데이터입니다.", errors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // 빈 업데이트 방지
    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { code: 400, message: "변경할 필드가 없습니다." },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(leads)
      .set(data)
      .where(eq(leads.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { code: 404, message: "리드를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { code: 200, message: "리드가 수정되었습니다.", data: updated },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { code: 400, message: "잘못된 요청입니다." },
      { status: 400 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { leadId } = await params;
  const id = parseInt(leadId, 10);

  if (isNaN(id)) {
    return NextResponse.json(
      { code: 400, message: "유효하지 않은 ID입니다." },
      { status: 400 }
    );
  }

  const [deleted] = await db
    .delete(leads)
    .where(eq(leads.id, id))
    .returning({ id: leads.id });

  if (!deleted) {
    return NextResponse.json(
      { code: 404, message: "리드를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  return new NextResponse(null, { status: 204 });
}
