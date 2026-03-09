import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auditLogs, users } from "@/lib/schema";
import { desc, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-helpers";

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(["ADMIN"]);
  if (authResult.error) return authResult.error;

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(0, parseInt(searchParams.get("page") || "0", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "50", 10)));

    const rows = await db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        userName: users.name,
        action: auditLogs.action,
        targetType: auditLogs.targetType,
        targetId: auditLogs.targetId,
        details: auditLogs.details,
        ipAddress: auditLogs.ipAddress,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(pageSize)
      .offset(page * pageSize);

    return NextResponse.json({
      code: 200,
      message: "감사 로그 조회 성공",
      data: rows,
      meta: { page, pageSize },
    });
  } catch {
    return NextResponse.json({ code: 500, message: "감사 로그 조회 실패" }, { status: 500 });
  }
}
