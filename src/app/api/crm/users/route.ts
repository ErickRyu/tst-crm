import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { requireAuth, hashPassword } from "@/lib/auth-helpers";
import { z } from "zod";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const includeAll = searchParams.get("includeAll") === "true";

  // includeAll requires ADMIN role
  const authResult = includeAll
    ? await requireAuth(["ADMIN"])
    : await requireAuth();
  if (authResult.error) return authResult.error;

  const rows = includeAll
    ? await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          phone: users.phone,
          role: users.role,
          status: users.status,
          lastLoginAt: users.lastLoginAt,
          isActive: users.isActive,
          createdAt: users.createdAt,
        })
        .from(users)
        .orderBy(asc(users.name))
    : await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(eq(users.isActive, 1))
        .orderBy(asc(users.name));

  return NextResponse.json({ code: 200, message: "상담원 목록 조회 성공", data: rows });
}

const userCreateSchema = z.object({
  name: z.string().min(1, "이름은 필수입니다."),
  email: z.string().email("유효한 이메일을 입력하세요.").optional(),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다.").optional(),
  role: z.enum(["ADMIN", "COUNSELOR", "HOSPITAL_STAFF"]).default("COUNSELOR"),
});

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(["ADMIN"]);
  if (authResult.error) return authResult.error;

  try {
    const body = await request.json();
    const parsed = userCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { code: 400, message: parsed.error.issues[0]?.message || "유효하지 않은 데이터입니다." },
        { status: 400 }
      );
    }

    const values: Record<string, unknown> = {
      name: parsed.data.name,
      isActive: 1,
      role: parsed.data.role,
      status: "ACTIVE",
    };

    if (parsed.data.email) {
      values.email = parsed.data.email;
    }

    if (parsed.data.password) {
      values.passwordHash = await hashPassword(parsed.data.password);
      values.forcePasswordChange = 1;
    }

    const [created] = await db
      .insert(users)
      .values(values)
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
        status: users.status,
        createdAt: users.createdAt,
      });

    return NextResponse.json(
      { code: 201, message: "사용자가 생성되었습니다.", data: created },
      { status: 201 }
    );
  } catch (e) {
    const isUnique = e instanceof Error && e.message.includes("unique");
    return NextResponse.json(
      { code: 400, message: isUnique ? "이미 존재하는 이메일입니다." : "잘못된 요청입니다." },
      { status: 400 }
    );
  }
}
