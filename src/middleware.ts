import { NextRequest, NextResponse } from "next/server";
import { jwtDecrypt } from "jose";
import { hkdf } from "@panva/hkdf";
import { canAccessPage } from "@/lib/rbac";
import type { Role } from "@/lib/rbac";

const PUBLIC_PATHS = ["/login", "/api/auth"];
const AUTH_ENABLED = process.env.AUTH_ENABLED !== "false";

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-api-key",
    "Access-Control-Max-Age": "86400",
  };
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

// Derive the encryption key the same way Auth.js does
async function getDerivedEncryptionKey(secret: string, salt: string) {
  return await hkdf(
    "sha256",
    secret,
    salt,
    `Auth.js Generated Encryption Key (${salt})`,
    64 // A256CBC-HS512 needs 64 bytes
  );
}

async function getSessionToken(request: NextRequest) {
  const cookieName =
    process.env.NODE_ENV === "production"
      ? "__Secure-authjs.session-token"
      : "authjs.session-token";

  const token = request.cookies.get(cookieName)?.value;
  if (!token) return null;

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return null;

  try {
    const encryptionKey = await getDerivedEncryptionKey(secret, cookieName);
    const { payload } = await jwtDecrypt(token, encryptionKey, {
      clockTolerance: 15,
      contentEncryptionAlgorithms: ["A256CBC-HS512", "A256GCM"],
      keyManagementAlgorithms: ["dir"],
    });
    return payload;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: corsHeaders() });
  }

  const response = NextResponse.next();
  for (const [key, value] of Object.entries(corsHeaders())) {
    response.headers.set(key, value);
  }

  // If auth is disabled, just pass through with CORS
  if (!AUTH_ENABLED) {
    return response;
  }

  const { pathname } = request.nextUrl;

  // Public paths: no auth required
  if (isPublicPath(pathname)) {
    return response;
  }

  // Decrypt JWT token (Edge-compatible, using jose + hkdf)
  const token = await getSessionToken(request);

  if (!token) {
    // API routes return 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { code: 401, message: "인증이 필요합니다." },
        { status: 401, headers: corsHeaders() }
      );
    }
    // Page routes redirect to login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Force password change redirect
  if (token.forcePasswordChange && pathname !== "/change-password" && !pathname.startsWith("/api/")) {
    return NextResponse.redirect(new URL("/change-password", request.url));
  }

  // Role-based page access
  if (!pathname.startsWith("/api/")) {
    const role = token.role as Role;
    if (role && !canAccessPage(pathname, role)) {
      const fallback = role === "HOSPITAL_STAFF" ? "/crm/calendar" : "/crm";
      if (pathname !== fallback) {
        return NextResponse.redirect(new URL(fallback, request.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|monitoring).*)"],
};
