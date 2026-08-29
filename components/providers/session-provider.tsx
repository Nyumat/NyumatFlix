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
    // Session data is a cheap JWT read (see auth.ts); refetching on every
    // window focus still hammers `/api/auth/session` across nav, watchlist,
    // settings, and iframe-heavy players.
    <SessionProvider session={session} refetchOnWindowFocus={false}>
      {children}
    </SessionProvider>
  );
};
