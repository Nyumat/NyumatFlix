const PROXY_MODE_HINT_SEEN_KEY = "nyumatflix:proxy-mode-hint-seen";

export function hasSeenProxyModeHint(): boolean {
  try {
    return localStorage.getItem(PROXY_MODE_HINT_SEEN_KEY) === "true";
  } catch {
    return false;
  }
}

export function rememberProxyModeHintSeen(): void {
  try {
    localStorage.setItem(PROXY_MODE_HINT_SEEN_KEY, "true");
  } catch {
    void 0;
  }
}
