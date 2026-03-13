import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq, and, ne, sql } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-helpers";
import { adminUserUpdateSchema } from "@/lib/validation";

type Params = { params: Promise<{ userId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const authResult = await requireAuth(["ADMIN"]);
  if (authResult.error) return authResult.error;

  const { userId } = await params;
  const id = Number.parseInt(userId, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ code: 400, message: "유효하지 않은 ID입니다." }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parsed = adminUserUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { code: 400, message: parsed.error.issues[0]?.message || "유효하지 않은 데이터입니다." },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};

    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone;
    if (parsed.data.email !== undefined) updates.email = parsed.data.email;
    if (parsed.data.role !== undefined) updates.role = parsed.data.role;
    if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;
    if (parsed.data.status !== undefined) updates.status = parsed.data.status;

    // Sync isActive and status
    if (parsed.data.status === "INACTIVE" && parsed.data.isActive === undefined) {
      updates.isActive = 0;
    }
    if (parsed.data.status === "ACTIVE" && parsed.data.isActive === undefined) {
      updates.isActive = 1;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ code: 400, message: "변경할 항목이 없습니다." }, { status: 400 });
    }

    // Prevent deactivating last admin
    if (parsed.data.status === "INACTIVE" || parsed.data.role !== undefined) {
      const [target] = await db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (target?.role === "ADMIN") {
        const [adminCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(users)
          .where(and(eq(users.role, "ADMIN"), eq(users.status, "ACTIVE"), ne(users.id, id)));

        if (Number(adminCount.count) === 0) {
          if (parsed.data.status === "INACTIVE" || (parsed.data.role && parsed.data.role !== "ADMIN")) {
            return NextResponse.json(
              { code: 400, message: "마지막 관리자는 비활성화하거나 역할을 변경할 수 없습니다." },
              { status: 400 }
            );
          }
        }
      }
    }

    updates.updatedAt = new Date();

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
        status: users.status,
        isActive: users.isActive,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    if (!updated) {
      return NextResponse.json({ code: 404, message: "상담원을 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ code: 200, message: "상담원 정보가 수정되었습니다.", data: updated });
  } catch {
    return NextResponse.json({ code: 400, message: "수정 실패" }, { status: 400 });
  }
}
