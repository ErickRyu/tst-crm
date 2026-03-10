import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { requireAuth, hashPassword, verifyPassword } from "@/lib/auth-helpers";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "비밀번호는 8자 이상이어야 합니다."),
});

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  const rl = rateLimit(`change-pw:${authResult.user.id}`, 5, 15 * 60 * 1000);
  if (!rl.success) {
    return NextResponse.json(
      { code: 429, message: "너무 많은 요청입니다. 15분 후 다시 시도해주세요." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { code: 400, message: parsed.error.issues[0]?.message || "유효하지 않은 데이터입니다." },
        { status: 400 }
      );
    }

    const [user] = await db
      .select({ id: users.id, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, authResult.user.id))
      .limit(1);

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { code: 400, message: "사용자를 찾을 수 없습니다." },
        { status: 400 }
      );
    }

    const isValid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { code: 400, message: "현재 비밀번호가 일치하지 않습니다." },
        { status: 400 }
      );
    }

    const newHash = await hashPassword(parsed.data.newPassword);
    await db
      .update(users)
      .set({
        passwordHash: newHash,
        forcePasswordChange: 0,
        updatedAt: new Date(),
      })
      .where(eq(users.id, authResult.user.id));

    return NextResponse.json({ code: 200, message: "비밀번호가 변경되었습니다." });
  } catch {
    return NextResponse.json(
      { code: 500, message: "비밀번호 변경 실패" },
      { status: 500 }
    );
  }
}
