import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: string;
      forcePasswordChange?: boolean;
    };
  }

  interface User {
    role?: string;
    forcePasswordChange?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: number;
    role?: string;
    forcePasswordChange?: boolean;
  }
}
