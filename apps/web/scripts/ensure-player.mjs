import { access } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const repoRoot = path.resolve(webRoot, "../..");
const vendorElement = path.join(webRoot, "public/vendor/player/element.js");
const wasmMovi = path.join(repoRoot, "packages/player/dist/wasm/movi.js");

const pathsExist = async (...files) => {
  for (const file of files) {
    try {
      await access(file);
    } catch {
      return false;
    }
  }
  return true;
};

if (await pathsExist(vendorElement, wasmMovi)) {
  process.exit(0);
}

console.log(
  "player vendor missing — building @nyumatflix/player (wasm + bundle)...",
);
const result = spawnSync(
  "bunx",
  ["turbo", "build", "--filter=@nyumatflix/player"],
  { cwd: repoRoot, stdio: "inherit" },
);

process.exit(result.status ?? 1);
