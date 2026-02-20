import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { crmUserCreateSchema } from "@/lib/validation";

export async function GET() {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.isActive, 1))
    .orderBy(asc(users.name));

  return NextResponse.json({ code: 200, message: "상담원 목록 조회 성공", data: rows });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = crmUserCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { code: 400, message: "유효하지 않은 데이터입니다." },
        { status: 400 }
      );
    }

    const [created] = await db
      .insert(users)
      .values({ name: parsed.data.name, isActive: 1 })
      .returning();

    return NextResponse.json(
      { code: 201, message: "상담원이 생성되었습니다.", data: created },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { code: 400, message: "잘못된 요청입니다." },
      { status: 400 }
    );
  }
}
