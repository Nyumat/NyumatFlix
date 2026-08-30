import {
  ALL_FLAG_DEFINITIONS,
  DEFAULT_FLAG_VALUES,
  type AdminFlagState,
  type FlagDefinition,
} from "@/lib/flags/flag-catalog";
import {
  DEFAULT_ANNOUNCEMENT_BANNER_CONFIG,
  sanitizeAnnouncementBannerConfig,
  type AnnouncementBannerConfig,
} from "@/lib/flags/announcement-banner";
import {
  DEFAULT_PROVIDER_MENU_ORDER,
  sanitizeProviderMenuOrderConfig,
  type ProviderMenuOrderConfig,
} from "@/lib/flags/provider-menu-order";

export const FLIPT_URL =
  process.env.FLIPT_URL?.replace(/\/$/, "") ??
  (process.env.NODE_ENV === "development"
    ? "http://127.0.0.1:8090"
    : "http://flipt:8080");
export const FLIPT_ENVIRONMENT = process.env.FLIPT_ENVIRONMENT ?? "default";
export const FLIPT_NAMESPACE = process.env.FLIPT_NAMESPACE ?? "default";
export const FLIPT_API_TOKEN = process.env.FLIPT_API_TOKEN ?? "";

const FLAG_TYPE_URL = "flipt.core.Flag";
const ANNOUNCEMENT_FLAG_KEY = "global.announcement_banner";
const PROVIDER_MENU_ORDER_FLAG_KEY = "global.provider_menu_order";

export function readFliptMetadataValue(
  metadata: Record<string, unknown> | undefined,
  key: string,
): unknown {
  const value = metadata?.[key];
  if (typeof value !== "string") {
    return value;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function withJsonMetadata(
  current: Record<string, unknown> | undefined,
  key: string,
  value: unknown,
): Record<string, unknown> {
  return {
    ...(current ?? {}),
    [key]: JSON.stringify(value),
  };
}

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

let lastKnownFlagState: AdminFlagState | null = null;
let failureCacheExpiresAt = 0;
const FAILURE_CACHE_TTL_MS = 5000;

let fliptUnavailableLogged = false;

function isFliptConnectionError(error: unknown): boolean {
  if (error instanceof TypeError && error.message === "fetch failed") {
    return true;
  }

  const cause =
    error && typeof error === "object" && "cause" in error
      ? (error as { cause?: unknown }).cause
      : null;

  if (cause && typeof cause === "object" && "code" in cause) {
    const code = (cause as { code?: string }).code;
    return code === "ECONNREFUSED" || code === "ENOTFOUND";
  }

  return false;
}

function logFliptFallback(error: unknown): void {
  if (fliptUnavailableLogged) {
    return;
  }

  fliptUnavailableLogged = true;

  if (isFliptConnectionError(error)) {
    console.info(
      `[flipt] not reachable at ${FLIPT_URL}, using defaults (start the container when you need live flags)`,
    );
    return;
  }

  console.warn("[flipt] read failed, using defaults:", error);
}

function enterFailureCooldown(now: number, error: unknown): void {
  if (failureCacheExpiresAt > now) {
    return;
  }

  logFliptFallback(error);
  failureCacheExpiresAt = now + FAILURE_CACHE_TTL_MS;
}

function clearFailureCooldown(): void {
  failureCacheExpiresAt = 0;
  fliptUnavailableLogged = false;
}

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
  lastKnownFlagState = null;
}

export function getCachedRawFlagsSync(): AdminFlagState | null {
  return lastKnownFlagState;
}

async function fliptFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = `${FLIPT_URL}${path}`;
  return fetch(url, {
    ...init,
    cache: "no-store",
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

async function getFlag(storageKey: string): Promise<FliptFlag | undefined> {
  const res = await fliptFetch(
    `${flagsResourcePath()}/${encodeURIComponent(FLAG_TYPE_URL)}/${encodeURIComponent(storageKey)}`,
  );
  if (res.status === 404) {
    return undefined;
  }
  if (!res.ok) {
    throw await responseError(`Flipt get flag ${storageKey} failed`, res);
  }
  const body = (await res.json()) as FliptResourceResponse<FliptFlag>;
  return body.resource?.payload;
}

async function hydrateFlagMetadata(
  existing: Map<string, FliptFlag>,
  storageKeys: readonly string[],
): Promise<void> {
  await Promise.all(
    storageKeys.map(async (storageKey) => {
      const current = existing.get(storageKey);
      if (current?.metadata && Object.keys(current.metadata).length > 0) {
        return;
      }
      const fetched = await getFlag(storageKey);
      if (fetched) {
        existing.set(storageKey, fetched);
      }
    }),
  );
}

function flagPayload(
  def: FlagDefinition,
  enabled: boolean,
  current?: FliptFlag,
  metadata?: Record<string, unknown>,
): FliptFlag {
  const nextMetadata = metadata ?? current?.metadata;
  return {
    ...current,
    "@type": FLAG_TYPE_URL,
    key: toFliptStorageKey(def.key),
    name: def.label,
    description: def.description ?? "",
    enabled,
    type: "BOOLEAN_FLAG_TYPE",
    ...(nextMetadata ? { metadata: nextMetadata } : {}),
  };
}

async function mutateFlag(
  method: "POST" | "PUT",
  def: FlagDefinition,
  enabled: boolean,
  revision: string | undefined,
  current?: FliptFlag,
  metadata?: Record<string, unknown>,
): Promise<string | undefined> {
  const action = method === "POST" ? "create" : "update";
  const res = await fliptFetch(flagsResourcePath(), {
    method,
    body: JSON.stringify({
      key: toFliptStorageKey(def.key),
      revision,
      payload: flagPayload(def, enabled, current, metadata),
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
  if (failureCacheExpiresAt > now) {
    return lastKnownFlagState ?? { ...DEFAULT_FLAG_VALUES };
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
    clearFailureCooldown();
    lastKnownFlagState = state;
    return state;
  } catch (error) {
    enterFailureCooldown(now, error);
    return lastKnownFlagState ?? { ...DEFAULT_FLAG_VALUES };
  }
}

export async function writeAdminFlagState(
  state: AdminFlagState,
  announcementBanner?: AnnouncementBannerConfig,
  providerMenuOrder?: ProviderMenuOrderConfig,
): Promise<void> {
  const listed = await listFlags();
  const existing = new Map(
    (listed.resources ?? []).map((resource) => [
      resource.key,
      resource.payload,
    ]),
  );
  await hydrateFlagMetadata(existing, [
    toFliptStorageKey(ANNOUNCEMENT_FLAG_KEY),
    toFliptStorageKey(PROVIDER_MENU_ORDER_FLAG_KEY),
  ]);
  let revision = listed.revision;

  for (const def of ALL_FLAG_DEFINITIONS) {
    const enabled = state[def.key] ?? def.defaultValue;
    const current = existing.get(toFliptStorageKey(def.key));
    const isAnnouncement = def.key === ANNOUNCEMENT_FLAG_KEY;
    const isMenuOrder = def.key === PROVIDER_MENU_ORDER_FLAG_KEY;
    const bannerConfig =
      isAnnouncement && announcementBanner
        ? sanitizeAnnouncementBannerConfig(announcementBanner)
        : undefined;
    const menuOrderConfig =
      isMenuOrder && providerMenuOrder
        ? sanitizeProviderMenuOrderConfig(providerMenuOrder)
        : undefined;
    const metadata = bannerConfig
      ? withJsonMetadata(current?.metadata, "announcementBanner", bannerConfig)
      : menuOrderConfig
        ? withJsonMetadata(
            current?.metadata,
            "providerMenuOrder",
            menuOrderConfig,
          )
        : undefined;
    const configChanged = Boolean(
      (bannerConfig &&
        JSON.stringify(
          readFliptMetadataValue(current?.metadata, "announcementBanner"),
        ) !== JSON.stringify(bannerConfig)) ||
        (menuOrderConfig &&
          JSON.stringify(
            readFliptMetadataValue(current?.metadata, "providerMenuOrder"),
          ) !== JSON.stringify(menuOrderConfig)),
    );
    if (!current) {
      revision = await mutateFlag(
        "POST",
        def,
        enabled,
        revision,
        undefined,
        metadata,
      );
    } else if (current.enabled !== enabled || configChanged) {
      revision = await mutateFlag(
        "PUT",
        def,
        enabled,
        revision,
        current,
        metadata,
      );
    }
  }

  invalidateFlagCache();
}

export async function readAnnouncementBannerConfig(): Promise<AnnouncementBannerConfig> {
  const now = Date.now();
  if (failureCacheExpiresAt > now) {
    return { ...DEFAULT_ANNOUNCEMENT_BANNER_CONFIG };
  }

  try {
    const banner = await getFlag(toFliptStorageKey(ANNOUNCEMENT_FLAG_KEY));
    return sanitizeAnnouncementBannerConfig(
      readFliptMetadataValue(banner?.metadata, "announcementBanner"),
    );
  } catch (error) {
    enterFailureCooldown(now, error);
    return { ...DEFAULT_ANNOUNCEMENT_BANNER_CONFIG };
  }
}

export async function readProviderMenuOrderConfig(): Promise<ProviderMenuOrderConfig> {
  const now = Date.now();
  if (failureCacheExpiresAt > now) {
    return { ...DEFAULT_PROVIDER_MENU_ORDER };
  }

  try {
    const menuOrderFlag = await getFlag(
      toFliptStorageKey(PROVIDER_MENU_ORDER_FLAG_KEY),
    );
    return sanitizeProviderMenuOrderConfig(
      readFliptMetadataValue(menuOrderFlag?.metadata, "providerMenuOrder"),
    );
  } catch (error) {
    enterFailureCooldown(now, error);
    return { ...DEFAULT_PROVIDER_MENU_ORDER };
  }
}

export async function evaluateBooleanFlag(
  key: string,
  defaultValue: boolean,
): Promise<boolean> {
  const state = await readAdminFlagState();
  return state[key] ?? defaultValue;
}
