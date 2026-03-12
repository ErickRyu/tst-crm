import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-helpers";

export async function GET() {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  try {
    const [user] = await db
      .select({
        name: users.name,
        phone: users.phone,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, authResult.user.id))
      .limit(1);

    if (!user) {
      return NextResponse.json({ code: 404, message: "사용자를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({
      code: 200,
      message: "프로필 조회 성공",
      data: {
        name: user.name,
        phone: user.phone || "",
        email: user.email || "",
      },
    });
  } catch {
    return NextResponse.json({ code: 500, message: "프로필 조회 실패" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  try {
    const body = await request.json();
    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ code: 400, message: "유효하지 않은 데이터입니다." }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) {
        return NextResponse.json({ code: 400, message: "이름은 필수입니다." }, { status: 400 });
      }
      updates.name = name;
    }
    if (body.phone !== undefined) {
      updates.phone = String(body.phone).trim() || null;
    }

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, authResult.user.id))
      .returning({ name: users.name, phone: users.phone, email: users.email });

    return NextResponse.json({
      code: 200,
      message: "프로필이 저장되었습니다.",
      data: updated,
    });
  } catch (err) {
    console.error("[My Profile PATCH]", err);
    return NextResponse.json({ code: 500, message: "프로필 저장 실패" }, { status: 500 });
  }
}
