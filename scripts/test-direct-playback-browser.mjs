#!/usr/bin/env node
/**
 * End-to-end Direct playback verification in a real browser.
 *
 * Usage:
 *   node scripts/test-direct-playback-browser.mjs nyumatflix
 *   node scripts/test-direct-playback-browser.mjs calluspirates
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const playwrightPath = [
  path.resolve(scriptDir, "../node_modules/playwright"),
  path.resolve(scriptDir, "../../calluspirates/node_modules/playwright"),
].find((candidate) => {
  try {
    require.resolve(candidate);
    return true;
  } catch {
    return false;
  }
});

if (!playwrightPath) {
  console.error("playwright not installed — run npm install in calluspirates");
  process.exit(1);
}

const { chromium } = require(playwrightPath);

const app = process.argv[2] ?? "nyumatflix";

const NYUMAT_TITLES = [
  ["Shrek", 808],
  ["Gone Girl", 210577],
  ["Inception", 27205],
  ["Dark Knight", 155],
  ["Matrix", 603],
  ["Shrek 2", 809],
];

const CUP_TITLES = [
  ["Shrek", 808],
  ["Gone Girl", 210577],
  ["Inception", 27205],
  ["Dark Knight", 155],
  ["Matrix", 603],
];

async function videoState(page) {
  return page.evaluate(() => {
    const video = document.querySelector("video");
    const movi = document.querySelector("movi-player");
    const failed =
      document.body.innerText.includes("Playback failed") ||
      document.body.innerText.includes("Couldn't play this file");
    if (!video) {
      return {
        failed,
        hasVideo: false,
        movi: !!movi,
        paused: null,
        currentTime: null,
        readyState: null,
        duration: null,
      };
    }
    return {
      failed,
      hasVideo: true,
      movi: !!movi,
      paused: video.paused,
      currentTime: video.currentTime,
      readyState: video.readyState,
      duration: video.duration,
    };
  });
}

async function seekVideo(page, seconds) {
  return page.evaluate((target) => {
    const video = document.querySelector("video");
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) {
      return { ok: false, reason: "no video or duration" };
    }
    video.currentTime = Math.min(target, Math.max(0, video.duration - 5));
    return {
      ok: true,
      currentTime: video.currentTime,
      duration: video.duration,
    };
  }, seconds);
}

async function testNyumatFlix(page, name, tmdbId) {
  const url = `http://127.0.0.1:3000/movies/${tmdbId}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(1500);

  const banner = page.getByRole("button", {
    name: /close announcement banner/i,
  });
  if (await banner.count()) {
    await banner.click({ force: true });
  }

  const play = page.getByRole("button", { name: /^Play$/i }).first();
  if (await play.count()) {
    await play.click({ force: true });
  }

  const proceed = page.getByRole("button", {
    name: /proceed without ad blocker/i,
  });
  if (await proceed.count()) {
    await proceed.click({ force: true });
  }

  await page.waitForTimeout(2000);

  const serverBtn = page.getByRole("button", {
    name: /choose playback mode and source/i,
  });
  if (await serverBtn.count()) {
    await serverBtn.click({ force: true });
    await page.waitForTimeout(300);
    const proxyTab = page.locator('button:has-text("Proxy")').first();
    if (await proxyTab.count()) {
      await proxyTab.click({ force: true });
    }
  }

  let state = await videoState(page);
  for (let i = 0; i < 24 && !state.hasVideo && !state.failed; i++) {
    await page.waitForTimeout(5000);
    state = await videoState(page);
  }

  if (state.failed || !state.hasVideo) {
    return { name, tmdbId, ok: false, phase: "load", state };
  }

  if (state.paused) {
    await page.evaluate(() => {
      const video = document.querySelector("video");
      if (video) {
        video.muted = true;
        void video.play().catch(() => undefined);
      }
    });
    await page.waitForTimeout(3000);
    state = await videoState(page);
  }

  if (state.paused) {
    return { name, tmdbId, ok: false, phase: "autoplay", state };
  }

  await page.waitForTimeout(4000);
  state = await videoState(page);
  const beforeSeek = state.currentTime ?? 0;

  const seek = await seekVideo(page, 120);
  await page.waitForTimeout(2500);
  state = await videoState(page);
  const afterSeek = state.currentTime ?? 0;

  const ok =
    !state.failed &&
    state.hasVideo &&
    !state.paused &&
    seek.ok &&
    afterSeek > beforeSeek + 30;

  return {
    name,
    tmdbId,
    ok,
    phase: "seek",
    state,
    beforeSeek,
    afterSeek,
    seek,
  };
}

async function testCalluspirates(page, name, tmdbId) {
  const url = `http://127.0.0.1:5174/movie/${tmdbId}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(3000);

  const mp4Btn = page
    .getByRole("button")
    .filter({ hasText: /1080p.*mp4|YIFY|YTS/i })
    .first();
  const any1080 = page.getByRole("button").filter({ hasText: "1080p" }).first();
  const streamBtn = (await mp4Btn.count()) ? mp4Btn : any1080;

  if (!(await streamBtn.count())) {
    return { name, tmdbId, ok: false, phase: "no-stream" };
  }

  await streamBtn.click();

  let state = await videoState(page);
  for (
    let i = 0;
    i < 24 && !state.hasVideo && !state.movi && !state.failed;
    i++
  ) {
    await page.waitForTimeout(5000);
    state = await videoState(page);
  }

  if (state.failed) {
    return { name, tmdbId, ok: false, phase: "failed", state };
  }

  if (state.paused && state.hasVideo) {
    await page.evaluate(() => {
      const video = document.querySelector("video");
      if (video) {
        video.muted = true;
        void video.play().catch(() => undefined);
      }
    });
    await page.waitForTimeout(3000);
    state = await videoState(page);
  }

  if (!state.hasVideo && state.movi) {
    await page.waitForTimeout(8000);
    state = await videoState(page);
  }

  if (!state.hasVideo || state.paused) {
    return { name, tmdbId, ok: false, phase: "autoplay", state };
  }

  const beforeSeek = state.currentTime ?? 0;
  const seek = await seekVideo(page, 120);
  await page.waitForTimeout(2500);
  state = await videoState(page);
  const afterSeek = state.currentTime ?? 0;

  const ok =
    !state.failed &&
    state.hasVideo &&
    !state.paused &&
    seek.ok &&
    afterSeek > beforeSeek + 20;

  return {
    name,
    tmdbId,
    ok,
    phase: "seek",
    state,
    beforeSeek,
    afterSeek,
    seek,
  };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const titles = app === "calluspirates" ? CUP_TITLES : NYUMAT_TITLES;
const tester = app === "calluspirates" ? testCalluspirates : testNyumatFlix;

let passed = 0;
console.log(`Direct browser playback test (${app})\n`);

for (const [name, tmdbId] of titles) {
  const result = await tester(page, name, tmdbId);
  if (result.ok) passed++;
  console.log(
    `${result.ok ? "OK  " : "FAIL"} ${name} (${tmdbId}) phase=${result.phase}`,
  );
  if (!result.ok) {
    console.log(`      ${JSON.stringify(result.state ?? result)}`);
  } else {
    console.log(
      `      playing t=${result.afterSeek?.toFixed?.(1)} seek=${result.beforeSeek?.toFixed?.(1)}→${result.afterSeek?.toFixed?.(1)} movi=${result.state?.movi}`,
    );
  }
}

await browser.close();
console.log(
  `\n${passed >= 5 ? "PASSED" : "FAILED"} (${passed}/${titles.length}, need 5+)`,
);
process.exit(passed >= 5 ? 0 : 1);
