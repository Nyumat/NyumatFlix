/** In-memory VidEasy/VidKing API + player origins. No fetch — safe for fetch.ts. */

export type WingsApiRuntime = {
  apiBase: string;
  videasyPlayerOrigin: string;
  vidkingPlayerOrigin: string;
  discoveredAt: number;
};

const extraApiHostnames = new Set<string>();
let runtime: WingsApiRuntime | null = null;

export const registerWingsApiHostname = (hostname: string): void => {
  const normalized = hostname.trim().toLowerCase();
  if (normalized) {
    extraApiHostnames.add(normalized);
  }
};

export const isRegisteredWingsApiHostname = (hostname: string): boolean =>
  extraApiHostnames.has(hostname.trim().toLowerCase());

export const getWingsApiRuntime = (): WingsApiRuntime | null => runtime;

export const setWingsApiRuntime = (next: WingsApiRuntime): void => {
  runtime = next;
  try {
    registerWingsApiHostname(new URL(next.apiBase).hostname);
  } catch {
    void 0;
  }
};

export const resetWingsApiRuntime = (): void => {
  runtime = null;
  extraApiHostnames.clear();
};
