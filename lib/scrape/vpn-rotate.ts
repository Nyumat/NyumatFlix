import "server-only";

const VPN_STATUS_PATH = "/v1/vpn/status";
const VPN_SETTINGS_PATH = "/v1/vpn/settings";
const PUBLIC_IP_PATH = "/v1/publicip/ip";
const VPN_READY_POLL_MS = 1_000;
const VPN_READY_MAX_ATTEMPTS = 45;
const VPN_STOP_SETTLE_MS = 2_000;

export const scrapeVpnControlUrl = (): string | undefined => {
  const url = process.env.SCRAPE_VPN_CONTROL_URL?.trim();
  return url || undefined;
};

export const scrapeVpnControlApiKey = (): string | undefined => {
  const key = process.env.SCRAPE_VPN_CONTROL_API_KEY?.trim();
  return key || undefined;
};

export const scrapeVpnRotateCountries = (): string[] => {
  const raw =
    process.env.SCRAPE_VPN_ROTATE_COUNTRIES?.trim() ??
    process.env.SERVER_COUNTRIES?.trim() ??
    "Germany,Netherlands,France";
  return raw
    .split(",")
    .map((country) => country.trim())
    .filter(Boolean);
};

export const scrapeRateLimitRotateHostname = (hostname: string): boolean =>
  hostname === "api.wingsdatabase.com";

export type VpnRotateOptions = {
  countries?: string[];
};

export type VpnRotateResult = {
  ok: boolean;
  previousPublicIp?: string;
  publicIp?: string;
  countries?: string[];
  error?: string;
};

export type VpnStatusResult = {
  ok: boolean;
  vpnStatus?: string;
  publicIp?: string;
  countries?: string[];
  error?: string;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let inflightRotate: Promise<VpnRotateResult> | undefined;
let countryCursor = 0;

const controlHeaders = (
  contentType = "application/json",
): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (contentType) {
    headers["Content-Type"] = contentType;
  }

  const apiKey = scrapeVpnControlApiKey();
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }

  return headers;
};

const controlFetch = async (
  path: string,
  init: RequestInit = {},
): Promise<Response | null> => {
  const controlUrl = scrapeVpnControlUrl();
  if (!controlUrl) {
    return null;
  }

  const baseUrl = controlUrl.replace(/\/$/, "");
  const headers = {
    ...controlHeaders(init.body ? "application/json" : ""),
    ...Object.fromEntries(new Headers(init.headers).entries()),
  };

  try {
    return await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
      signal: init.signal ?? AbortSignal.timeout(60_000),
    });
  } catch {
    return null;
  }
};

const readPublicIp = async (): Promise<string | undefined> => {
  const response = await controlFetch(PUBLIC_IP_PATH, { method: "GET" });
  if (!response?.ok) {
    return undefined;
  }

  const payload = (await response.json()) as { public_ip?: string };
  return payload.public_ip;
};

const readVpnStatus = async (): Promise<string | undefined> => {
  const response = await controlFetch(VPN_STATUS_PATH, { method: "GET" });
  if (!response?.ok) {
    return undefined;
  }

  const payload = (await response.json()) as { status?: string };
  return payload.status;
};

const putVpnStatus = async (
  status: "running" | "stopped",
): Promise<boolean> => {
  const response = await controlFetch(VPN_STATUS_PATH, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });

  return Boolean(response?.ok);
};

const patchVpnCountries = async (countries: string[]): Promise<boolean> => {
  const response = await controlFetch(VPN_SETTINGS_PATH, {
    method: "PUT",
    body: JSON.stringify({
      VPN_SERVICE_PROVIDER: "surfshark",
      SERVER_COUNTRIES: countries.join(","),
    }),
  });

  return Boolean(response?.ok);
};

const waitForVpnRunning = async (): Promise<boolean> => {
  for (let attempt = 0; attempt < VPN_READY_MAX_ATTEMPTS; attempt += 1) {
    await sleep(VPN_READY_POLL_MS);
    if ((await readVpnStatus()) === "running") {
      return true;
    }
  }

  return false;
};

const pickRotateCountries = (requested?: string[]): string[] => {
  if (requested?.length) {
    return requested;
  }

  const pool = scrapeVpnRotateCountries();
  if (pool.length === 0) {
    return [];
  }

  const country = pool[countryCursor % pool.length];
  countryCursor += 1;
  return country ? [country] : [];
};

export async function getScrapeVpnStatus(): Promise<VpnStatusResult> {
  if (!scrapeVpnControlUrl()) {
    return { ok: false, error: "SCRAPE_VPN_CONTROL_URL is not configured" };
  }

  const [vpnStatus, publicIp] = await Promise.all([
    readVpnStatus(),
    readPublicIp(),
  ]);

  if (!vpnStatus && !publicIp) {
    return { ok: false, error: "Gluetun control API unreachable" };
  }

  return {
    ok: true,
    vpnStatus,
    publicIp,
    countries: scrapeVpnRotateCountries(),
  };
}

export async function rotateScrapeVpnEgress(
  options: VpnRotateOptions = {},
): Promise<VpnRotateResult> {
  if (!scrapeVpnControlUrl()) {
    return { ok: false, error: "SCRAPE_VPN_CONTROL_URL is not configured" };
  }

  if (inflightRotate) {
    return inflightRotate;
  }

  inflightRotate = (async () => {
    const countries = pickRotateCountries(options.countries);
    const previousPublicIp = await readPublicIp();

    if (countries.length > 0) {
      await patchVpnCountries(countries);
    }

    if (!(await putVpnStatus("stopped"))) {
      return { ok: false, error: "Failed to stop Gluetun VPN" };
    }

    await sleep(VPN_STOP_SETTLE_MS);

    if (!(await putVpnStatus("running"))) {
      return { ok: false, error: "Failed to start Gluetun VPN" };
    }

    if (!(await waitForVpnRunning())) {
      return { ok: false, error: "Gluetun VPN did not become ready" };
    }

    const publicIp = await readPublicIp();
    return {
      ok: true,
      previousPublicIp,
      publicIp,
      countries: countries.length > 0 ? countries : scrapeVpnRotateCountries(),
    };
  })().finally(() => {
    inflightRotate = undefined;
  });

  return inflightRotate;
}

export const authorizeScrapeVpnRotateRequest = (request: Request): boolean => {
  const secret = process.env.SCRAPE_VPN_ROTATE_SECRET?.trim();
  if (!secret) {
    return false;
  }

  const authorization = request.headers.get("authorization");
  if (authorization === `Bearer ${secret}`) {
    return true;
  }

  return request.headers.get("x-scrape-vpn-secret") === secret;
};
