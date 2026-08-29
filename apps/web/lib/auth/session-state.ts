import type { Session } from "next-auth";

export type AuthSessionStatus = "loading" | "authenticated" | "unauthenticated";

export function resolveAuthSession(
  clientSession: Session | null | undefined,
  status: AuthSessionStatus,
  fallbackSession?: Session | null,
): Session | null {
  if (status === "unauthenticated") {
    return null;
  }
  if (status === "authenticated") {
    return clientSession ?? fallbackSession ?? null;
  }
  return fallbackSession ?? clientSession ?? null;
}
