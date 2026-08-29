import "server-only";

import { auth } from "@/auth";
import { isCapDevBypassEnabled } from "@/lib/cap/constants";
import { requestHasCapSession } from "@/lib/cap/server";

export const allowsCapProtectedAccess = async (
  request: Request,
): Promise<boolean> => {
  if (isCapDevBypassEnabled()) {
    return true;
  }
  if (requestHasCapSession(request)) {
    return true;
  }
  const session = await auth();
  return Boolean(session?.user?.id);
};
