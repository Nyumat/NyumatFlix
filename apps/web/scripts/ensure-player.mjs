import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
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

if (
  existsSync(vendorElement) &&
  existsSync(vendorCompat) &&
  existsSync(vendorWasm)
) {
  process.exit(0);
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
