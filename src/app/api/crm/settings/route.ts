import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { crmSettings } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { crmSettingsUpdateSchema } from "@/lib/validation";
import { requireAuth } from "@/lib/auth-helpers";

// 공개 키: 모든 인증된 사용자가 조회 가능
const PUBLIC_SETTING_KEYS = ["clinic_name"];

export async function GET() {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  const isAdmin = authResult.user.role === "ADMIN";

  try {
    const rows = await db.select().from(crmSettings);
    const settings: Record<string, string> = {};
    for (const row of rows) {
      if (isAdmin || PUBLIC_SETTING_KEYS.includes(row.key)) {
        settings[row.key] = row.value;
      }
    }
    return NextResponse.json({ code: 200, message: "설정 조회 성공", data: settings });
  } catch {
    return NextResponse.json({ code: 500, message: "설정 조회 실패" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const authResult = await requireAuth(["ADMIN"]);
  if (authResult.error) return authResult.error;

  try {
    const body = await request.json();
    const parsed = crmSettingsUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { code: 400, message: "유효하지 않은 데이터입니다." },
        { status: 400 }
      );
    }

    const now = new Date();
    for (const [key, value] of Object.entries(parsed.data)) {
      const [existing] = await db
        .select()
        .from(crmSettings)
        .where(eq(crmSettings.key, key))
        .limit(1);

      if (existing) {
        await db
          .update(crmSettings)
          .set({ value, updatedAt: now })
          .where(eq(crmSettings.key, key));
      } else {
        await db.insert(crmSettings).values({ key, value, updatedAt: now });
      }
    }

    return NextResponse.json({ code: 200, message: "설정이 저장되었습니다." });
  } catch {
    return NextResponse.json({ code: 400, message: "설정 저장 실패" }, { status: 400 });
  }
}
