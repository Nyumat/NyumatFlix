import "server-only";

import {
  getCalluspiratesApiUrl,
  getCalluspiratesPublicUrl,
} from "@/lib/scrape/calluspirates-config";
import { fetchCalluspirates } from "@/lib/scrape/calluspirates-fetch";

export type CalluspiratesClientSession = {
  apiBase: string;
  token: string;
};

export async function mintCalluspiratesClientSession(): Promise<CalluspiratesClientSession | null> {
  const apiBase = getCalluspiratesApiUrl();
  const publicBase = getCalluspiratesPublicUrl();
  if (!apiBase || !publicBase) {
    return null;
  }

  const response = await fetchCalluspirates(`${apiBase}/api/session`, {
    timeoutMs: 15_000,
  });
  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { token?: unknown };
  if (typeof payload.token !== "string" || payload.token.length === 0) {
    return null;
  }

  return { apiBase: publicBase, token: payload.token };
}
