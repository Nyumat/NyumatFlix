#!/usr/bin/env node
/**
 * Browser playback smoke test for Direct streams (local only).
 * Usage: node scripts/test-direct-playback.mjs [baseUrl]
 *
 * Requires playwright — run from calluspirates/web or with PLAYWRIGHT= path.
 */
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://127.0.0.1:3000";

const TITLES = [
  ["Shrek", 808],
  ["Gone Girl", 210577],
  ["Dark Knight", 155],
  ["Matrix", 603],
  ["Inception", 27205],
  ["Shrek 2", 809],
];

async function testTitle(page, name, tmdbId) {
  const logs = [];
  page.on("console", (msg) => {
    const text = msg.text();
    if (
      /StreamPlayer|movi|vidstack|playback|error|failed|fallback/i.test(text)
    ) {
      logs.push(`[console] ${text}`);
    }
  });
  page.on("pageerror", (err) => logs.push(`[pageerror] ${err.message}`));

  await page.goto(`${BASE}/movie/${tmdbId}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForTimeout(2000);

  const playBtn = page.getByRole("button", { name: /^play$/i }).first();
  if (await playBtn.count()) {
    await playBtn.click();
  } else {
    const playMovie = page.getByRole("button", { name: /play movie/i }).first();
    if (await playMovie.count()) {
      await playMovie.click();
    }
  }

  await page.waitForTimeout(3000);

  const serverBtn = page.getByRole("button", {
    name: /choose playback mode and source/i,
  });
  if (await serverBtn.count()) {
    await serverBtn.click();
    await page.waitForTimeout(500);
    const directItem = page
      .getByRole("menuitem", { name: /^direct$/i })
      .first();
    if (await directItem.count()) {
      await directItem.click();
    } else {
      const directText = page.getByText(/^Direct$/).first();
      if (await directText.count()) await directText.click();
    }
    await page.waitForTimeout(500);
  }

  await page.waitForTimeout(45_000);

  const moviCount = await page.locator("movi-player").count();
  const vidstackCount = await page
    .locator(".nyumat-stream-player, media-player")
    .count();
  const bodyText = await page.locator("body").innerText();
  const failed =
    bodyText.includes("Couldn't play this file in the browser") ||
    bodyText.includes("Playback failed for this stream");
  const playing =
    !failed &&
    (moviCount > 0 ||
      (await page.locator("video").count()) > 0 ||
      vidstackCount > 0);

  return {
    name,
    tmdbId,
    moviCount,
    vidstackCount,
    videoCount: await page.locator("video").count(),
    failed,
    playing,
    logs: logs.slice(-8),
  };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

let failed = 0;
console.log(`Browser Direct playback test @ ${BASE}\n`);

for (const [name, tmdbId] of TITLES) {
  const result = await testTitle(page, name, tmdbId);
  const ok = result.playing && !result.failed;
  if (!ok) failed++;
  console.log(`${ok ? "OK  " : "FAIL"} ${name} (${tmdbId})`);
  console.log(
    `      movi=${result.moviCount} vidstack=${result.vidstackCount} video=${result.videoCount} failed=${result.failed}`,
  );
  if (result.logs.length) {
    console.log(`      logs: ${result.logs.join(" | ")}`);
  }
}

await browser.close();
console.log(
  `\n${failed ? "FAILED" : "PASSED"} (${TITLES.length - failed}/${TITLES.length})`,
);
process.exit(failed ? 1 : 0);
