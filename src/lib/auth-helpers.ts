import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import type { Role } from "@/lib/rbac";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: Role;
}

type AuthResult =
  | { error: null; user: AuthUser }
  | { error: NextResponse; user: null };

const AUTH_ENABLED = process.env.AUTH_ENABLED !== "false";

export async function requireAuth(roles?: Role[]): Promise<AuthResult> {
  if (!AUTH_ENABLED) {
    // Auth disabled: return a mock admin user
    return {
      error: null,
      user: {
        id: 0,
        name: process.env.NEXT_PUBLIC_USER_NAME || "시스템",
        email: "system@local",
        role: "ADMIN",
      },
    };
  }

  const session = await auth();

  if (!session?.user?.id) {
    return {
      error: NextResponse.json(
        { code: 401, message: "인증이 필요합니다." },
        { status: 401 }
      ),
      user: null,
    };
  }

  const userId = Number(session.user.id);

  // DB status check on every request
  const [dbUser] = await db
    .select({ id: users.id, status: users.status, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!dbUser || dbUser.status !== "ACTIVE") {
    return {
      error: NextResponse.json(
        { code: 401, message: "비활성화된 계정입니다." },
        { status: 401 }
      ),
      user: null,
    };
  }

  const userRole = dbUser.role as Role;

  if (roles && roles.length > 0 && !roles.includes(userRole)) {
    return {
      error: NextResponse.json(
        { code: 403, message: "권한이 없습니다." },
        { status: 403 }
      ),
      user: null,
    };
  }

  return {
    error: null,
    user: {
      id: userId,
      name: session.user.name || "",
      email: session.user.email || "",
      role: userRole,
    },
  };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
