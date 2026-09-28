#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const DEFAULT_PATHS = ["/", "/movies", "/tvshows", "/trending", "/anime"];

const baseUrl = (
  process.env.WARM_BASE_URL ??
  process.env.SITE_URL ??
  "http://127.0.0.1:8081"
).replace(/\/$/, "");

const warmPathsFile = new URL("../data/hubs/warm-paths.json", import.meta.url);

const loadPaths = async () => {
  try {
    const raw = await readFile(warmPathsFile, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.paths) && parsed.paths.length > 0) {
      return parsed.paths;
    }
  } catch {
    void 0;
  }
  return DEFAULT_PATHS;
};

const warmPath = async (path, { rsc = false } = {}) => {
  const url = `${baseUrl}${path}`;
  const headers = {
    "User-Agent": "nyumatflix-isr-warm/2",
    Accept: rsc ? "text/x-component" : "text/html",
  };
  if (rsc) {
    headers.Rsc = "1";
  }

  const response = await fetch(url, {
    headers,
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${url}${rsc ? " (rsc)" : ""}`);
  }

  console.log(`warmed ${response.status} ${url}${rsc ? " (rsc)" : ""}`);
};

const main = async () => {
  const paths = await loadPaths();
  for (const path of paths) {
    await warmPath(path);
    await warmPath(path, { rsc: true });
  }
};

main().catch((error) => {
  console.error(
    "[warm-isr] failed:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
