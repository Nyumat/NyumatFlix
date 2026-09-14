import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const fixturePath = resolve(
  import.meta.dirname,
  "../__tests__/fixtures/hexa-movie-550.json",
);

const browser = await chromium.launch({
  headless: false,
  args: ["--disable-blink-features=AutomationControlled"],
});
const context = await browser.newContext();
await context.addInitScript(() => {
  Object.defineProperty(navigator, "webdriver", {
    get: () => undefined,
  });
});
const page = await context.newPage();
await page.goto("https://hexa.su/", {
  waitUntil: "domcontentloaded",
  timeout: 90_000,
});
await page.addScriptTag({
  url: "https://cdn.jsdelivr.net/npm/@cap.js/widget@0.1.56/cap.min.js",
});
await page.waitForFunction(
  () => customElements.get("cap-widget") !== undefined,
  {
    timeout: 30_000,
  },
);
await page.waitForTimeout(2000);

const sample = await page.evaluate(async () => {
  const endpoint = "https://cap.hexa.su/15d2cf0395/";
  const widget = document.createElement("cap-widget");
  widget.setAttribute("data-cap-api-endpoint", endpoint);
  widget.style.display = "none";
  document.documentElement.appendChild(widget);
  let solved = await widget.solve();
  if (!solved?.success) {
    await new Promise((r) => setTimeout(r, 2000));
    widget.reset();
    solved = await widget.solve();
  }
  if (!solved?.success || !solved.token) {
    throw new Error("cap failed");
  }
  const apiKey = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const enc = await (
    await fetch("https://theemoviedb.hexa.su/api/tmdb/movie/550/images", {
      headers: {
        Accept: "text/plain",
        Origin: "https://hexa.su",
        Referer: "https://hexa.su/",
        "X-Fingerprint-Lite": "e9136c41504646444",
        "X-Api-Key": apiKey,
        "X-Cap-Token": solved.token,
      },
    })
  ).text();
  const base = "https://theemoviedb.hexa.su";
  const { default: init, process_img_data } = await import(
    `${base}/assets/wasm/img_data.js`
  );
  await init({ module_or_path: `${base}/assets/wasm/img_data_bg.wasm` });
  const plain = await process_img_data(enc.trim(), apiKey);
  const decrypted = JSON.parse(plain);
  const roundTrip = await process_img_data(enc.trim(), apiKey);
  if (roundTrip !== plain) {
    throw new Error("wasm decrypt not stable");
  }
  return {
    apiKey,
    capToken: solved.token,
    encrypted: enc.trim(),
    decrypted,
  };
});

writeFileSync(fixturePath, `${JSON.stringify(sample, null, 2)}\n`);
console.log("fixture refreshed", sample.decrypted.sources.length, "sources");

await browser.close();
