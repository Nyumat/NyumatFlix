"use client";

import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";

interface AuthSessionProviderProps {
  children: ReactNode;
  session?: Session | null;
}

export const AuthSessionProvider = ({
  children,
  session,
}: AuthSessionProviderProps) => {
  return (
    // Do not default `session` to `null`. NextAuth treats an explicit null as
    // "we already checked, this person is logged out" and will not fetch
    // `/api/auth/session`. Omit the prop so the client reads the JWT cookie.
    // Sessions use JWT cookies with a database enrollment check. Avoid
    // repeated focus refetches across nav, watchlist, settings, and players.
    <SessionProvider session={session} refetchOnWindowFocus={false}>
      {children}
    </SessionProvider>
  );
};
