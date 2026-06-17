const LARGE_APPEND_ITEMS = new Set([
  "aggregate_credits",
  "combined_credits",
  "credits",
  "images",
]);

const LARGE_ENDPOINT_PATTERNS = [
  /\/(?:aggregate_credits|combined_credits|credits|images)(?:\/|$)/,
  /\/tv\/[^/]+\/season\/\d+(?:\/|$)/,
];

type TmdbParams =
  | Record<string, string | undefined>
  | URLSearchParams
  | undefined;

const normalizeEndpoint = (endpoint: string) => {
  if (/^https?:\/\//i.test(endpoint)) {
    try {
      return new URL(endpoint).pathname;
    } catch {
      return endpoint;
    }
  }

  return endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
};

const getParamValue = (params: TmdbParams, key: string) => {
  if (!params) {
    return undefined;
  }

  if (params instanceof URLSearchParams) {
    return params.get(key) ?? undefined;
  }

  return params[key];
};

const getAppendItems = (endpoint: string, params: TmdbParams) => {
  const fromParams = getParamValue(params, "append_to_response");
  if (fromParams) {
    return fromParams.split(",").map((item) => item.trim());
  }

  if (!/^https?:\/\//i.test(endpoint)) {
    return [];
  }

  try {
    const url = new URL(endpoint);
    return (url.searchParams.get("append_to_response") ?? "")
      .split(",")
      .map((item) => item.trim());
  } catch {
    return [];
  }
};

export const shouldBypassTmdbDataCache = (
  endpoint: string,
  params?: TmdbParams,
) => {
  const normalizedEndpoint = normalizeEndpoint(endpoint);
  if (
    LARGE_ENDPOINT_PATTERNS.some((pattern) => pattern.test(normalizedEndpoint))
  ) {
    return true;
  }

  return getAppendItems(endpoint, params).some((item) =>
    LARGE_APPEND_ITEMS.has(item),
  );
};

export const tmdbFetchInit = ({
  endpoint,
  params,
  revalidate,
  init,
}: {
  endpoint: string;
  params?: TmdbParams;
  revalidate: number;
  init?: RequestInit;
}): RequestInit => {
  const nextInit: RequestInit = { ...init };

  if (shouldBypassTmdbDataCache(endpoint, params)) {
    delete nextInit.next;
    return {
      ...nextInit,
      cache: "no-store",
    };
  }

  return {
    ...nextInit,
    next: { revalidate, ...nextInit.next },
  };
};

export const redactTmdbUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has("api_key")) {
      parsed.searchParams.set("api_key", "[redacted]");
    }
    return parsed.toString();
  } catch {
    return url.replace(/([?&]api_key=)[^&]+/i, "$1[redacted]");
  }
};
