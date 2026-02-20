import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leads } from "@/lib/schema";
import { leadCreateSchema } from "@/lib/validation";
import { eq, and, sql, gte, lt, SQL } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = leadCreateSchema.safeParse(body);

    if (!parsed.success) {
      const errors = parsed.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      return NextResponse.json(
        { code: 400, message: "필수 필드가 누락되었습니다.", errors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // 중복 체크: 같은 phone + event 조합
    const existing = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.phone, data.phone), eq(leads.event, data.event)))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { code: 409, message: "이미 등록된 연락처입니다." },
        { status: 409 }
      );
    }

    // IP 추출
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const [created] = await db
      .insert(leads)
      .values({
        event: data.event,
        site: data.site,
        advertiser: data.advertiser,
        media: data.media,
        category: data.category,
        name: data.name,
        phone: data.phone,
        age: data.age ?? null,
        gender: data.gender ?? null,
        branch: data.branch ?? null,
        address: data.address ?? null,
        email: data.email ?? null,
        survey1: data.survey1 ?? null,
        survey2: data.survey2 ?? null,
        survey3: data.survey3 ?? null,
        survey4: data.survey4 ?? null,
        survey5: data.survey5 ?? null,
        survey6: data.survey6 ?? null,
        status: data.status,
        memo: data.memo ?? null,
        ip,
      })
      .returning();

    return NextResponse.json(
      { code: 201, message: "리드가 등록되었습니다.", data: created },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { code: 400, message: "잘못된 요청입니다." },
      { status: 400 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const page = Math.max(0, parseInt(searchParams.get("page") || "0", 10));
    const size = Math.min(100, Math.max(1, parseInt(searchParams.get("size") || "20", 10)));

    const conditions: SQL[] = [];

    const event = searchParams.get("event");
    if (event) conditions.push(eq(leads.event, event));

    const site = searchParams.get("site");
    if (site) conditions.push(eq(leads.site, site));

    const advertiser = searchParams.get("advertiser");
    if (advertiser) conditions.push(eq(leads.advertiser, advertiser));

    const media = searchParams.get("media");
    if (media) conditions.push(eq(leads.media, media));

    const status = searchParams.get("status");
    if (status) conditions.push(eq(leads.status, status));

    const startDate = searchParams.get("startDate");
    if (startDate) {
      conditions.push(gte(leads.createdAt, new Date(startDate)));
    }

    const endDate = searchParams.get("endDate");
    if (endDate) {
      // endDate는 해당 날짜의 끝까지 포함 (다음날 0시 미만)
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      conditions.push(lt(leads.createdAt, end));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(where);

    const totalElements = Number(countResult.count);
    const totalPages = Math.ceil(totalElements / size);

    const content = await db
      .select()
      .from(leads)
      .where(where)
      .orderBy(leads.id)
      .limit(size)
      .offset(page * size);

    return NextResponse.json(
      {
        code: 200,
        message: "리드 목록을 조회했습니다.",
        data: {
          content,
          page,
          size,
          totalElements,
          totalPages,
        },
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { code: 400, message: "잘못된 요청입니다." },
      { status: 400 }
    );
  }
}
