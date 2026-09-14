import type { Browser, BrowserContext, Page } from "playwright";
import { chromium } from "playwright";

const HEXA_ORIGIN = "https://hexa.su/";
const WASM_ORIGIN = "https://theemoviedb.hexa.su";

/** Playwright `evaluate` expression (async IIFE; string form avoids Vitest rewriting import). */
const buildDecryptExpression = (payload: {
  encrypted: string;
  apiKey: string;
  wasmOrigin: string;
}): string => `(async () => {
  const payload = ${JSON.stringify(payload)};
  const origin = payload.wasmOrigin;
  const { default: init, process_img_data } = await import(
    origin + "/assets/wasm/img_data.js"
  );
  if (!globalThis.__hexaWasmReady) {
    await init({ module_or_path: origin + "/assets/wasm/img_data_bg.wasm" });
    globalThis.__hexaWasmReady = true;
  }
  return await process_img_data(payload.encrypted.trim(), payload.apiKey);
})()`;

const SOLVE_CAP_IN_BROWSER = `async (capEndpoint) => {
  let endpoint = capEndpoint;
  if (!endpoint.endsWith("/")) endpoint += "/";
  const widget = document.createElement("cap-widget");
  widget.setAttribute("data-cap-api-endpoint", endpoint);
  widget.style.display = "none";
  document.documentElement.appendChild(widget);
  const solved = await widget.solve();
  if (!solved?.success || !solved.token) {
    throw new Error("Hexa Cap solve failed");
  }
  return solved.token;
}`;

type HexaWasmSession = {
  context: BrowserContext;
  page: Page;
  ready: Promise<void>;
};

let sessionPromise: Promise<HexaWasmSession> | null = null;
let browserPromise: Promise<Browser> | null = null;

const launchBrowser = (): Promise<Browser> => {
  browserPromise ??= chromium.launch({
    headless: false,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  return browserPromise;
};

const createSession = async (): Promise<HexaWasmSession> => {
  const browser = await launchBrowser();
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => undefined,
    });
  });
  const page = await context.newPage();
  await page.goto(HEXA_ORIGIN, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.addScriptTag({
    url: "https://cdn.jsdelivr.net/npm/@cap.js/widget@0.1.56/cap.min.js",
  });
  await page.waitForFunction(
    () => customElements.get("cap-widget") !== undefined,
  );

  const ready = Promise.resolve();
  return { context, page, ready };
};

const getSession = (): Promise<HexaWasmSession> => {
  sessionPromise ??= createSession();
  return sessionPromise;
};

export const resetHexaWasmSessionForTests = async (): Promise<void> => {
  if (sessionPromise) {
    const session = await sessionPromise.catch(() => null);
    await session?.context.close().catch(() => undefined);
  }
  sessionPromise = null;
  if (browserPromise) {
    const browser = await browserPromise.catch(() => null);
    await browser?.close().catch(() => undefined);
  }
  browserPromise = null;
};

/** Cap.js redeem token for `X-Cap-Token` (cap.hexa.su). */
export async function encHexaCapToken(init?: {
  signal?: AbortSignal;
}): Promise<string> {
  const { page, ready } = await getSession();
  await ready;
  init?.signal?.throwIfAborted();

  return page.evaluate(SOLVE_CAP_IN_BROWSER, "https://cap.hexa.su/15d2cf0395/");
}

/** Decrypt TMDB `/images` ciphertext using theemoviedb.hexa.su WASM (`process_img_data`). */
export async function decryptHexaViaWasm(
  encryptedBase64: string,
  apiKeyHex: string,
  init?: { signal?: AbortSignal },
): Promise<string> {
  const { page, ready } = await getSession();
  await ready;
  init?.signal?.throwIfAborted();

  return page.evaluate(
    buildDecryptExpression({
      encrypted: encryptedBase64,
      apiKey: apiKeyHex,
      wasmOrigin: WASM_ORIGIN,
    }),
  );
}
