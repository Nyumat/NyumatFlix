import {
  ALL_FLAG_DEFINITIONS,
  DEFAULT_FLAG_VALUES,
  type AdminFlagState,
} from "@/lib/flags/flag-catalog";

export const FLIPT_URL =
  process.env.FLIPT_URL?.replace(/\/$/, "") ?? "http://flipt:8080";
export const FLIPT_NAMESPACE = process.env.FLIPT_NAMESPACE ?? "production";
export const FLIPT_API_TOKEN = process.env.FLIPT_API_TOKEN ?? "";

const CACHE_TTL_MS = Number(process.env.FLIPT_FLAG_CACHE_TTL_MS ?? "30000");

type CacheEntry = { expiresAt: number; state: AdminFlagState };

let flagCache: CacheEntry | null = null;

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

type FliptFlag = {
  key: string;
  enabled: boolean;
  type?: string;
};

async function listFlags(): Promise<FliptFlag[]> {
  const res = await fliptFetch(
    `/api/v1/namespaces/${encodeURIComponent(FLIPT_NAMESPACE)}/flags`,
  );
  if (!res.ok) {
    throw new Error(`Flipt list flags failed: ${res.status}`);
  }
  const body = (await res.json()) as { flags?: FliptFlag[] };
  return body.flags ?? [];
}

async function createFlag(
  def: (typeof ALL_FLAG_DEFINITIONS)[number],
): Promise<void> {
  const res = await fliptFetch(
    `/api/v1/namespaces/${encodeURIComponent(FLIPT_NAMESPACE)}/flags`,
    {
      method: "POST",
      body: JSON.stringify({
        key: def.key,
        name: def.label,
        description: def.description ?? "",
        enabled: def.defaultValue,
        type: "BOOLEAN_FLAG_TYPE",
      }),
    },
  );
  if (!res.ok && res.status !== 409) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Flipt create flag ${def.key} failed: ${res.status} ${text}`,
    );
  }
}

async function updateFlag(key: string, enabled: boolean): Promise<void> {
  const res = await fliptFetch(
    `/api/v1/namespaces/${encodeURIComponent(FLIPT_NAMESPACE)}/flags/${encodeURIComponent(key)}`,
    {
      method: "PUT",
      body: JSON.stringify({ enabled }),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Flipt update flag ${key} failed: ${res.status} ${text}`);
  }
}

export async function ensureFlagsSeeded(): Promise<void> {
  let existing: FliptFlag[];
  try {
    existing = await listFlags();
  } catch {
    return;
  }
  const existingKeys = new Set(existing.map((f) => f.key));
  const missing = ALL_FLAG_DEFINITIONS.filter((d) => !existingKeys.has(d.key));
  await Promise.all(missing.map((d) => createFlag(d)));
}

export async function readAdminFlagState(): Promise<AdminFlagState> {
  const now = Date.now();
  if (flagCache && flagCache.expiresAt > now) {
    return flagCache.state;
  }

  try {
    await ensureFlagsSeeded();
    const flags = await listFlags();
    const state: AdminFlagState = { ...DEFAULT_FLAG_VALUES };
    for (const flag of flags) {
      if (flag.key in state) {
        state[flag.key] = flag.enabled;
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
  await ensureFlagsSeeded();
  const updates = ALL_FLAG_DEFINITIONS.map(async (def) => {
    const enabled = state[def.key] ?? def.defaultValue;
    await updateFlag(def.key, enabled);
  });
  await Promise.all(updates);
  invalidateFlagCache();
}

export async function evaluateBooleanFlag(
  key: string,
  defaultValue: boolean,
): Promise<boolean> {
  const state = await readAdminFlagState();
  return state[key] ?? defaultValue;
}
