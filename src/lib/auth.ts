import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "이메일", type: "email" },
        password: { label: "비밀번호", type: "password" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) {
            console.log("[AUTH] Missing credentials");
            return null;
          }

          const email = credentials.email as string;
          const password = credentials.password as string;
          console.log("[AUTH] Attempting login for:", email);

          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

          if (!user) { console.log("[AUTH] User not found"); return null; }
          if (!user.passwordHash) { console.log("[AUTH] No password hash"); return null; }
          if (user.status !== "ACTIVE") { console.log("[AUTH] User not active:", user.status); return null; }

          const isValid = await bcrypt.compare(password, user.passwordHash);
          if (!isValid) { console.log("[AUTH] Invalid password"); return null; }
          console.log("[AUTH] Login success for:", email);

          // Update lastLoginAt
          await db
            .update(users)
            .set({ lastLoginAt: new Date() })
            .where(eq(users.id, user.id));

          return {
            id: String(user.id),
            name: user.name,
            email: user.email,
            role: user.role,
            forcePasswordChange: user.forcePasswordChange === 1,
          };
        } catch (err) {
          console.error("[AUTH] Error in authorize:", err);
          return null;
        }
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = Number(user.id);
        token.role = (user as unknown as Record<string, unknown>).role as string;
        token.forcePasswordChange = (user as unknown as Record<string, unknown>).forcePasswordChange as boolean;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.userId);
        (session.user as unknown as Record<string, unknown>).role = token.role;
        (session.user as unknown as Record<string, unknown>).forcePasswordChange = token.forcePasswordChange;
      }
      return session;
    },
  },
});
