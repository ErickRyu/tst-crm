import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq, and, ne, sql } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-helpers";

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
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) updates.name = body.name;
    if (body.phone !== undefined) updates.phone = body.phone;
    if (body.email !== undefined) updates.email = body.email;
    if (body.role !== undefined) updates.role = body.role;
    if (body.isActive !== undefined) updates.isActive = body.isActive;
    if (body.status !== undefined) updates.status = body.status;

    // Sync isActive and status
    if (body.status === "INACTIVE" && body.isActive === undefined) {
      updates.isActive = 0;
    }
    if (body.status === "ACTIVE" && body.isActive === undefined) {
      updates.isActive = 1;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ code: 400, message: "변경할 항목이 없습니다." }, { status: 400 });
    }

    // Prevent deactivating last admin
    if (body.status === "INACTIVE" || body.role !== undefined) {
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
          if (body.status === "INACTIVE" || (body.role && body.role !== "ADMIN")) {
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
      .returning();

    if (!updated) {
      return NextResponse.json({ code: 404, message: "상담원을 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ code: 200, message: "상담원 정보가 수정되었습니다.", data: updated });
  } catch {
    return NextResponse.json({ code: 400, message: "수정 실패" }, { status: 400 });
  }
}
