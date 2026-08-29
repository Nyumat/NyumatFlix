"use client";

import {
  CAP_SESSION_CLIENT_SAFETY_WINDOW_MS,
  isCapDevBypassEnabled,
} from "@/lib/cap/constants";
import { warmCapWidgetAssets } from "@/lib/cap/warmup-client";

const SESSION_SAFETY_WINDOW_MS = CAP_SESSION_CLIENT_SAFETY_WINDOW_MS;

let verifiedUntil = 0;
let verificationPromise: Promise<void> | null = null;
let endpointPromise: Promise<{ endpoint: string; wasmUrl?: string }> | null =
  null;

const getCapClientConfig = async (): Promise<{
  endpoint: string;
  wasmUrl?: string;
}> => {
  endpointPromise ??= fetch("/api/cap/config", { cache: "no-store" }).then(
    async (response) => {
      if (!response.ok) throw new Error("Cap is unavailable");
      const data = (await response.json()) as {
        endpoint?: unknown;
        wasmUrl?: unknown;
      };
      if (typeof data.endpoint !== "string") {
        throw new Error("Cap endpoint is invalid");
      }
      return {
        endpoint: data.endpoint,
        wasmUrl: typeof data.wasmUrl === "string" ? data.wasmUrl : undefined,
      };
    },
  );
  return endpointPromise;
};

const loadCapWidget = async (): Promise<typeof import("@cap.js/widget")> => {
  await warmCapWidgetAssets();
  return import("@cap.js/widget");
};

const createSession = async (): Promise<void> => {
  const existing = await fetch("/api/cap/session", {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (existing.ok) {
    verifiedUntil = Date.now() + SESSION_SAFETY_WINDOW_MS;
    return;
  }

  const [{ default: Cap }, { endpoint }] = await Promise.all([
    loadCapWidget(),
    getCapClientConfig(),
  ]);
  const cap = new Cap({ apiEndpoint: endpoint });
  const result = await cap.solve();
  if (!result.success || !result.token) {
    throw new Error("Human verification failed");
  }

  const response = await fetch("/api/cap/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: result.token }),
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error("Human verification failed");
  verifiedUntil = Date.now() + SESSION_SAFETY_WINDOW_MS;
};

export const ensureCapSession = async (): Promise<void> => {
  if (isCapDevBypassEnabled()) return;
  if (verifiedUntil > Date.now()) return;
  verificationPromise ??= createSession().finally(() => {
    verificationPromise = null;
  });
  await verificationPromise;
};

export const fetchWithCapSession = async (
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> => {
  await ensureCapSession();
  let response = await fetch(input, init);
  if (
    response.status !== 403 ||
    response.headers.get("x-cap-required") !== "1"
  ) {
    return response;
  }

  verifiedUntil = 0;
  await ensureCapSession();
  response = await fetch(input, init);
  return response;
};
