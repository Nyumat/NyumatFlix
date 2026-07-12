import type { NextRequest } from "next/server";

export function isFfsHost(host: string | null): boolean {
  if (!host) return false;
  const hostname = host.split(":")[0]?.toLowerCase() ?? "";
  return hostname.startsWith("ffs.");
}

export function assertFfsHost(request: NextRequest): boolean {
  if (
    process.env.NODE_ENV === "development" &&
    isFfsHost(request.headers.get("host"))
  ) {
    return true;
  }
  return isFfsHost(request.headers.get("host"));
}
