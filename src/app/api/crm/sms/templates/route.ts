import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { smsTemplates } from "@/lib/schema";
import { eq, or, asc } from "drizzle-orm";
import { smsTemplateCreateSchema } from "@/lib/validation";
import { calcMsgType } from "@/lib/sms";

export async function GET(request: NextRequest) {
  try {
    const includeDisabledDefaults =
      request.nextUrl.searchParams.get("includeDisabledDefaults") === "true";

    const whereClause = includeDisabledDefaults
      ? or(eq(smsTemplates.isActive, 1), eq(smsTemplates.isDefault, 1))
      : eq(smsTemplates.isActive, 1);

    const templates = await db
      .select()
      .from(smsTemplates)
      .where(whereClause)
      .orderBy(asc(smsTemplates.sortOrder), asc(smsTemplates.id));

    const data = templates.map((t) => {
      const { byteLength, msgType } = calcMsgType(t.body);
      return {
        id: t.id,
        key: t.key,
        label: t.label,
        icon: t.icon,
        body: t.body,
        msgType,
        byteLength,
        category: t.category,
        statuses: t.statuses ? JSON.parse(t.statuses) : undefined,
        isDefault: t.isDefault === 1,
        isActive: t.isActive === 1,
      };
    });

    return NextResponse.json({
      code: 200,
      message: "템플릿 조회 성공",
      data,
      meta: {
        testMode: process.env.ALIGO_TESTMODE !== "N",
      },
    });
  } catch {
    return NextResponse.json(
      { code: 500, message: "템플릿 조회 실패" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = smsTemplateCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { code: 400, message: "유효하지 않은 데이터입니다.", errors: parsed.error.issues },
        { status: 400 }
      );
    }

    const { statuses, ...rest } = parsed.data;
    const { msgType } = calcMsgType(rest.body);
    const [created] = await db
      .insert(smsTemplates)
      .values({
        ...rest,
        msgType,
        statuses: statuses ? JSON.stringify(statuses) : null,
      })
      .returning();

    return NextResponse.json(
      { code: 201, message: "템플릿이 생성되었습니다.", data: created },
      { status: 201 }
    );
  } catch (e) {
    const msg = e instanceof Error && e.message.includes("unique")
      ? "이미 존재하는 키입니다."
      : "템플릿 생성 실패";
    return NextResponse.json({ code: 400, message: msg }, { status: 400 });
  }
}
