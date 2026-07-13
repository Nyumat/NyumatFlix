import {
  ALL_FLAG_DEFINITIONS,
  DEFAULT_FLAG_VALUES,
  type AdminFlagState,
  type FlagDefinition,
} from "@/lib/flags/flag-catalog";

export const FLIPT_URL =
  process.env.FLIPT_URL?.replace(/\/$/, "") ?? "http://flipt:8080";
export const FLIPT_ENVIRONMENT = process.env.FLIPT_ENVIRONMENT ?? "default";
export const FLIPT_NAMESPACE = process.env.FLIPT_NAMESPACE ?? "default";
export const FLIPT_API_TOKEN = process.env.FLIPT_API_TOKEN ?? "";

const CACHE_TTL_MS = Number(process.env.FLIPT_FLAG_CACHE_TTL_MS ?? "30000");
const FLAG_TYPE_URL = "flipt.core.Flag";

/** Flipt v2 keys only allow [-_,A-Za-z0-9]; catalog keys use dots. */
export function toFliptStorageKey(catalogKey: string): string {
  return catalogKey.replaceAll(".", "_");
}

const FLAG_DEFINITIONS_BY_STORAGE_KEY = new Map(
  ALL_FLAG_DEFINITIONS.map((def) => [toFliptStorageKey(def.key), def]),
);

if (FLAG_DEFINITIONS_BY_STORAGE_KEY.size !== ALL_FLAG_DEFINITIONS.length) {
  throw new Error("Flipt flag storage keys must be unique");
}

type CacheEntry = { expiresAt: number; state: AdminFlagState };

let flagCache: CacheEntry | null = null;

type FliptFlag = {
  "@type"?: typeof FLAG_TYPE_URL;
  key: string;
  enabled: boolean;
  type: "BOOLEAN_FLAG_TYPE";
  name: string;
  description: string;
  metadata?: Record<string, unknown>;
  rollouts?: unknown[];
};

type FliptResource<T> = {
  key: string;
  payload: T;
};

type FliptResourceList<T> = {
  resources?: FliptResource<T>[];
  revision?: string;
};

type FliptResourceResponse<T> = {
  resource?: FliptResource<T>;
  revision?: string;
};

function authHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (FLIPT_API_TOKEN) {
    headers.Authorization = `Bearer ${FLIPT_API_TOKEN}`;
  }
  return headers;
}

export function invalidateFlagCache(): void {
  flagCache = null;
}

export function getCachedRawFlagsSync(): AdminFlagState | null {
  if (flagCache && flagCache.expiresAt > Date.now()) {
    return flagCache.state;
  }
  return null;
}

async function fliptFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = `${FLIPT_URL}${path}`;
  return fetch(url, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(5000),
  });
}

function flagsResourcePath(): string {
  return `/api/v2/environments/${encodeURIComponent(FLIPT_ENVIRONMENT)}/namespaces/${encodeURIComponent(FLIPT_NAMESPACE)}/resources`;
}

async function responseError(prefix: string, res: Response): Promise<Error> {
  const text = await res.text().catch(() => "");
  return new Error(`${prefix}: ${res.status} ${text}`);
}

async function listFlags(): Promise<FliptResourceList<FliptFlag>> {
  const res = await fliptFetch(
    `${flagsResourcePath()}/${encodeURIComponent(FLAG_TYPE_URL)}`,
  );
  if (!res.ok) {
    throw await responseError("Flipt list flags failed", res);
  }
  return (await res.json()) as FliptResourceList<FliptFlag>;
}

function flagPayload(
  def: FlagDefinition,
  enabled: boolean,
  current?: FliptFlag,
): FliptFlag {
  return {
    ...current,
    "@type": FLAG_TYPE_URL,
    key: toFliptStorageKey(def.key),
    name: def.label,
    description: def.description ?? "",
    enabled,
    type: "BOOLEAN_FLAG_TYPE",
  };
}

async function mutateFlag(
  method: "POST" | "PUT",
  def: FlagDefinition,
  enabled: boolean,
  revision: string | undefined,
  current?: FliptFlag,
): Promise<string | undefined> {
  const action = method === "POST" ? "create" : "update";
  const res = await fliptFetch(flagsResourcePath(), {
    method,
    body: JSON.stringify({
      key: toFliptStorageKey(def.key),
      revision,
      payload: flagPayload(def, enabled, current),
    }),
  });
  if (!res.ok) {
    throw await responseError(`Flipt ${action} flag ${def.key} failed`, res);
  }
  const body = (await res.json()) as FliptResourceResponse<FliptFlag>;
  return body.revision ?? revision;
}

export async function ensureFlagsSeeded(): Promise<void> {
  const listed = await listFlags();
  const existingKeys = new Set(
    (listed.resources ?? []).map((resource) => resource.key),
  );
  let revision = listed.revision;

  for (const def of ALL_FLAG_DEFINITIONS) {
    if (existingKeys.has(toFliptStorageKey(def.key))) continue;
    revision = await mutateFlag("POST", def, def.defaultValue, revision);
  }
}

export async function readAdminFlagState(): Promise<AdminFlagState> {
  const now = Date.now();
  if (flagCache && flagCache.expiresAt > now) {
    return flagCache.state;
  }

  try {
    await ensureFlagsSeeded();
    const listed = await listFlags();
    const state: AdminFlagState = { ...DEFAULT_FLAG_VALUES };
    for (const resource of listed.resources ?? []) {
      const flag = resource.payload;
      const def = FLAG_DEFINITIONS_BY_STORAGE_KEY.get(resource.key);
      if (def) {
        state[def.key] = flag.enabled;
      }
    }
    flagCache = { expiresAt: now + CACHE_TTL_MS, state };
    return state;
  } catch (error) {
    console.warn("[flipt] read failed, using defaults:", error);
    return { ...DEFAULT_FLAG_VALUES };
  }
}

export async function writeAdminFlagState(
  state: AdminFlagState,
): Promise<void> {
  const listed = await listFlags();
  const existing = new Map(
    (listed.resources ?? []).map((resource) => [
      resource.key,
      resource.payload,
    ]),
  );
  let revision = listed.revision;

  for (const def of ALL_FLAG_DEFINITIONS) {
    const enabled = state[def.key] ?? def.defaultValue;
    const current = existing.get(toFliptStorageKey(def.key));
    if (!current) {
      revision = await mutateFlag("POST", def, enabled, revision);
    } else if (current.enabled !== enabled) {
      revision = await mutateFlag("PUT", def, enabled, revision, current);
    }
  }

  invalidateFlagCache();
}

export async function evaluateBooleanFlag(
  key: string,
  defaultValue: boolean,
): Promise<boolean> {
  const state = await readAdminFlagState();
  return state[key] ?? defaultValue;
}
