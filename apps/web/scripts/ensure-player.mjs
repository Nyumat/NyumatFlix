import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const repoRoot = path.resolve(webRoot, "../..");
const vendorElement = path.join(webRoot, "public/vendor/player/element.js");
const vendorCompat = path.join(webRoot, "public/vendor/player/compat.js");
const vendorWasm = path.join(webRoot, "public/vendor/player/wasm/movi.js");

function missingBundledChunks() {
  const sources = [vendorElement, vendorCompat].filter((file) =>
    existsSync(file),
  );
  const missing = [];
  const pattern = /(?:import\(|from\s+)["'](\.\/[^"']+\.js)["']/g;
  for (const source of sources) {
    const code = readFileSync(source, "utf8");
    for (const match of code.matchAll(pattern)) {
      const file = path.join(
        webRoot,
        "public/vendor/player",
        match[1].slice(2),
      );
      if (!existsSync(file) && !missing.includes(file)) missing.push(file);
    }
  }
  return missing;
}

const vendorReady =
  existsSync(vendorElement) &&
  existsSync(vendorCompat) &&
  existsSync(vendorWasm);
const missingChunks = missingBundledChunks();

if (vendorReady && missingChunks.length === 0) {
  process.exit(0);
}

if (vendorReady && missingChunks.length > 0) {
  const copyVendor = path.join(
    repoRoot,
    "packages/player/scripts/copy-vendor.mjs",
  );
  const copied = spawnSync(process.execPath, [copyVendor], {
    cwd: repoRoot,
    stdio: "inherit",
  });
  process.exit(copied.status ?? 1);
}

console.log(
  "[ensure-player] vendor player missing — building @nyumatflix/player (needs docker)",
);

const result = spawnSync(
  "bunx",
  ["turbo", "build", "--filter=@nyumatflix/player"],
  { cwd: repoRoot, stdio: "inherit" },
);

process.exit(result.status ?? 1);
