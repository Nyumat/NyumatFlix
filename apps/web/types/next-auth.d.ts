import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      requiresPasskey?: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    emailPasskeyEnrollmentRequired?: boolean;
    profileHydrated?: boolean;
  }
}
