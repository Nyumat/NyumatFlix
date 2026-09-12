#!/usr/bin/env node

const paths = ["/", "/movies", "/tvshows", "/trending", "/anime"];

const baseUrl = (
  process.env.WARM_BASE_URL ??
  process.env.SITE_URL ??
  "http://127.0.0.1:8081"
).replace(/\/$/, "");

const warmPath = async (path) => {
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "nyumatflix-isr-warm/1",
      Accept: "text/html",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${url}`);
  }

  console.log(`warmed ${response.status} ${url}`);
};

const main = async () => {
  for (const path of paths) {
    await warmPath(path);
  }
};

main().catch((error) => {
  console.error(
    "[warm-isr] failed:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
