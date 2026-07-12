const SNAPSHOT_PREFIX = "nyumatflix:route-snapshot:";
const ORIGIN_PREFIX = "nyumatflix:route-origin:";
const PENDING_NAVIGATION_KEY = "nyumatflix:pending-route-navigation";
const PENDING_RESTORE_KEY = "nyumatflix:pending-route-restore";
const HISTORY_ORIGIN_KEY = "__nyumatflixRouteOrigin";

type PendingRestoreListener = (active: boolean) => void;
const pendingRestoreListeners = new Set<PendingRestoreListener>();

const notifyPendingRestore = (active: boolean) => {
  for (const listener of pendingRestoreListeners) {
    listener(active);
  }
};

/** Subscribe to soft-back restore overlay signals (true = cover UI). */
export const subscribePendingRouteRestore = (
  listener: PendingRestoreListener,
) => {
  pendingRestoreListeners.add(listener);
  return () => {
    pendingRestoreListeners.delete(listener);
  };
};

export interface RouteSnapshot {
  url: string;
  scrollX: number;
  scrollY: number;
  anchorHref?: string;
  anchorOccurrence?: number;
  /** Exact Embla scroll progress for the clicked card's carousel (0–1). */
  carouselScrollProgress?: number;
  /** Embla scroll progress for every carousel on the page, in DOM order. */
  pageCarouselScrolls?: number[];
}

export type NavigationOriginExtras = {
  carouselScrollProgress?: number;
  pageCarouselScrolls?: number[];
};

const getSessionStorage = () => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

export const getRelativeUrl = (url: URL = new URL(window.location.href)) =>
  `${url.pathname}${url.search}${url.hash}`;

const getAnchorHref = (anchor: HTMLAnchorElement) => {
  const url = new URL(anchor.href, window.location.href);
  return url.origin === window.location.origin ? getRelativeUrl(url) : null;
};

const getMatchingAnchors = (href: string) =>
  Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]")).filter(
    (candidate) => getAnchorHref(candidate) === href,
  );

const readJson = <T>(key: string): T | null => {
  const storage = getSessionStorage();
  if (!storage) return null;

  try {
    const value = storage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
};

const writeJson = (key: string, value: unknown) => {
  const storage = getSessionStorage();
  if (!storage) return;

  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    void 0;
  }
};

const readOriginForDestination = (destinationUrl: string) => {
  const origin = readJson<unknown>(`${ORIGIN_PREFIX}${destinationUrl}`);
  return typeof origin === "string" ? origin : null;
};

const writeOriginForDestination = (
  destinationUrl: string,
  sourceUrl: string,
) => {
  writeJson(`${ORIGIN_PREFIX}${destinationUrl}`, sourceUrl);
};

export const recordNavigationOrigin = (
  destination: URL,
  anchor?: HTMLAnchorElement,
  extras?: NavigationOriginExtras,
) => {
  if (destination.origin !== window.location.origin) return;

  const sourceUrl = getRelativeUrl();
  const destinationUrl = getRelativeUrl(destination);
  if (sourceUrl === destinationUrl) return;

  const anchorHref = anchor ? getAnchorHref(anchor) : null;
  const matchingAnchors = anchorHref ? getMatchingAnchors(anchorHref) : [];
  const anchorOccurrence = anchor ? matchingAnchors.indexOf(anchor) : -1;
  const snapshot: RouteSnapshot = {
    url: sourceUrl,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    ...(anchorHref && anchorOccurrence >= 0
      ? { anchorHref, anchorOccurrence }
      : {}),
    ...(typeof extras?.carouselScrollProgress === "number" &&
    Number.isFinite(extras.carouselScrollProgress)
      ? { carouselScrollProgress: extras.carouselScrollProgress }
      : {}),
    ...(extras?.pageCarouselScrolls && extras.pageCarouselScrolls.length > 0
      ? { pageCarouselScrolls: extras.pageCarouselScrolls }
      : {}),
  };

  writeJson(`${SNAPSHOT_PREFIX}${sourceUrl}`, snapshot);
  writeJson(PENDING_NAVIGATION_KEY, { destinationUrl, sourceUrl });
};

export const commitNavigationEntry = (currentUrl: string) => {
  const pending = readJson<{
    destinationUrl?: unknown;
    sourceUrl?: unknown;
  }>(PENDING_NAVIGATION_KEY);
  if (
    pending?.destinationUrl !== currentUrl ||
    typeof pending.sourceUrl !== "string"
  ) {
    return;
  }

  writeOriginForDestination(currentUrl, pending.sourceUrl);

  const currentState = window.history.state;
  const state =
    currentState && typeof currentState === "object" ? currentState : {};
  window.history.replaceState(
    { ...state, [HISTORY_ORIGIN_KEY]: pending.sourceUrl },
    "",
    window.location.href,
  );

  try {
    getSessionStorage()?.removeItem(PENDING_NAVIGATION_KEY);
  } catch {
    void 0;
  }
};

const resolveNavigationOrigin = (currentUrl = getRelativeUrl()) => {
  const fromHistory = window.history.state?.[HISTORY_ORIGIN_KEY];
  if (typeof fromHistory === "string") return fromHistory;
  return readOriginForDestination(currentUrl);
};

export const prepareNavigationBack = () => {
  const sourceUrl = resolveNavigationOrigin();
  if (typeof sourceUrl !== "string") return false;

  const snapshot = readRouteSnapshot(sourceUrl);
  if (!snapshot) return false;

  writeJson(PENDING_RESTORE_KEY, { sourceUrl });
  notifyPendingRestore(true);
  return true;
};

export const readRouteSnapshot = (url: string): RouteSnapshot | null => {
  const snapshot = readJson<RouteSnapshot>(`${SNAPSHOT_PREFIX}${url}`);
  if (
    !snapshot ||
    snapshot.url !== url ||
    !Number.isFinite(snapshot.scrollX) ||
    !Number.isFinite(snapshot.scrollY)
  ) {
    return null;
  }

  return snapshot;
};

export const consumePendingRouteSnapshot = (
  currentUrl: string,
): RouteSnapshot | null => {
  const pending = readJson<{ sourceUrl?: unknown }>(PENDING_RESTORE_KEY);
  if (pending?.sourceUrl !== currentUrl) return null;

  try {
    getSessionStorage()?.removeItem(PENDING_RESTORE_KEY);
  } catch {
    void 0;
  }

  return readRouteSnapshot(currentUrl);
};

export const findSnapshotAnchor = (snapshot: RouteSnapshot) => {
  if (!snapshot.anchorHref) return null;

  const matches = getMatchingAnchors(snapshot.anchorHref);
  return matches[snapshot.anchorOccurrence ?? 0] ?? matches[0] ?? null;
};
