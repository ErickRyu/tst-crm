import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-helpers";

export async function GET() {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      role: users.role,
      status: users.status,
      forcePasswordChange: users.forcePasswordChange,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, authResult.user.id))
    .limit(1);

  if (!user) {
    return NextResponse.json({ code: 404, message: "사용자를 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ code: 200, message: "내 프로필 조회 성공", data: user });
}

export async function PATCH(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  try {
    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (body.name) updates.name = body.name;
    if (body.phone !== undefined) updates.phone = body.phone;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ code: 400, message: "변경할 항목이 없습니다." }, { status: 400 });
    }

    updates.updatedAt = new Date();

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, authResult.user.id))
      .returning();

    return NextResponse.json({ code: 200, message: "프로필이 수정되었습니다.", data: updated });
  } catch {
    return NextResponse.json({ code: 400, message: "프로필 수정 실패" }, { status: 400 });
  }
}
