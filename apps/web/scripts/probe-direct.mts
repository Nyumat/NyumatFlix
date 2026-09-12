import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), ".env") });
loadEnv({ path: resolve(process.cwd(), ".env.local"), override: true });

const { isDirectScrapeProviderConfigured, getCalluspiratesApiUrl } =
  await import("../lib/scrape/calluspirates-config.ts");
const { scrapeDirect } = await import("../lib/scrape/providers/direct.ts");
const { fetchCalluspirates } = await import(
  "../lib/scrape/calluspirates-fetch.ts"
);

console.log("NODE_ENV", process.env.NODE_ENV);
console.log("configured", isDirectScrapeProviderConfigured());
const apiBase = getCalluspiratesApiUrl();
console.log("apiBase", apiBase ?? "(missing)");
console.log(
  "has secret",
  Boolean(process.env.CALLUSPIRATES_INTERNAL_SECRET?.trim()),
);

if (apiBase) {
  const healthUrl = `${apiBase}/api/health`;
  try {
    const health = await fetchCalluspirates(healthUrl, { timeoutMs: 15_000 });
    console.log("health", health.status, (await health.text()).slice(0, 120));
  } catch (error) {
    console.log(
      "health error",
      error instanceof Error ? error.message : String(error),
    );
    if (error instanceof Error && "cause" in error) {
      console.log("cause", error.cause);
    }
  }

  const streamUrl = `${apiBase}/api/movie/550/streams/stream`;
  try {
    const stream = await fetchCalluspirates(streamUrl, {
      timeoutMs: 30_000,
      responseKind: "event-stream",
      headers: { Accept: "text/event-stream" },
    });
    console.log(
      "stream probe",
      stream.status,
      stream.headers.get("content-type"),
    );
    await stream.cancel();
  } catch (error) {
    console.log(
      "stream error",
      error instanceof Error ? error.message : String(error),
    );
    if (error instanceof Error && "cause" in error) {
      console.log("cause", error.cause);
    }
  }
}

const result = await scrapeDirect({ mediaType: "movie", tmdbId: 550 });
console.log(
  "scrapeDirect",
  result.ok ? "OK" : "FAIL",
  result.ok ? result.streamUrl.slice(0, 80) : result.error,
);

const { scrapeProvider } = await import("../lib/scrape/index.ts");
const viaRegistry = await scrapeProvider("direct", {
  mediaType: "movie",
  tmdbId: 550,
});
console.log(
  "scrapeProvider(direct)",
  viaRegistry.ok ? "OK" : "FAIL",
  viaRegistry.ok ? viaRegistry.streamUrl.slice(0, 80) : viaRegistry.error,
);
