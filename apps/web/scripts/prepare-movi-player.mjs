import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const repoRoot = path.resolve(webRoot, "../..");

const result = spawnSync(
  "bunx",
  ["turbo", "build", "--filter=@nyumatflix/player"],
  { cwd: repoRoot, stdio: "inherit" },
);

process.exit(result.status ?? 1);
