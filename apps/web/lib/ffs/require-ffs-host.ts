import type { NextRequest } from "next/server";
import { isFfsHost } from "@/lib/ffs/ffs-host-paths";

export { isFfsHost } from "@/lib/ffs/ffs-host-paths";

export function assertFfsHost(request: NextRequest): boolean {
  if (
    process.env.NODE_ENV === "development" &&
    isFfsHost(request.headers.get("host"))
  ) {
    return true;
  }
  return isFfsHost(request.headers.get("host"));
}
