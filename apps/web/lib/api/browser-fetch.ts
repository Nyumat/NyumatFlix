"use client";

import { ensureCapSession } from "@/lib/cap/client";
import {
  isDevtoolsFetchBlocked,
  linkDevtoolsGuardSignal,
  rejectDevtoolsBlockedFetch,
} from "@/lib/api/devtools-fetch-guard";
import {
  NYUMAT_CLIENT_HEADER,
  NYUMAT_CLIENT_VALUE,
} from "@/lib/api/request-guard";

let installed = false;

const resolveRequestUrl = (input: RequestInfo | URL): string => {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
};

export const isInternalApiRequest = (url: string): boolean => {
  if (url.startsWith("/api/")) {
    return true;
  }

  try {
    const parsed = new URL(url, window.location.origin);
    return (
      parsed.origin === window.location.origin &&
      parsed.pathname.startsWith("/api/")
    );
  } catch {
    return false;
  }
};

export const withNyumatClientHeaders = (
  init?: RequestInit,
): RequestInit | undefined => {
  const headers = new Headers(init?.headers);
  if (!headers.has(NYUMAT_CLIENT_HEADER)) {
    headers.set(NYUMAT_CLIENT_HEADER, NYUMAT_CLIENT_VALUE);
  }
  return { ...init, headers };
};

const shouldRetryCap = (response: Response, url: string): boolean =>
  isInternalApiRequest(url) &&
  response.status === 403 &&
  response.headers.get("x-cap-required") === "1";

export const installBrowserApiFetch = (): void => {
  if (installed || typeof window === "undefined") {
    return;
  }

  installed = true;
  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = resolveRequestUrl(input);
    const isInternal = isInternalApiRequest(url);

    if (isInternal && isDevtoolsFetchBlocked()) {
      return rejectDevtoolsBlockedFetch();
    }

    const guarded = isInternal ? linkDevtoolsGuardSignal(init?.signal) : null;
    const nextInit = isInternal
      ? withNyumatClientHeaders({ ...init, signal: guarded?.signal })
      : init;

    try {
      let response = await nativeFetch(input, nextInit);
      if (!shouldRetryCap(response, url)) {
        return response;
      }

      if (isDevtoolsFetchBlocked()) {
        return rejectDevtoolsBlockedFetch();
      }

      await ensureCapSession();
      response = await nativeFetch(input, nextInit);
      return response;
    } finally {
      guarded?.release();
    }
  };
};
