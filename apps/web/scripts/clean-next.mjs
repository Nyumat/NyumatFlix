import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const webRoot = join(import.meta.dirname, "..");
const nextDir = join(webRoot, ".next");

if (process.env.SKIP_CLEAN_NEXT === "1") {
  console.log("[clean-next] skipped (SKIP_CLEAN_NEXT)");
  process.exit(0);
}

if (!existsSync(nextDir)) {
  console.log("[clean-next] nothing to clean");
  process.exit(0);
}

try {
  rmSync(nextDir, { recursive: true, force: true });
  console.log("[clean-next] removed .next");
} catch (error) {
  if (error?.code !== "EBUSY") {
    throw error;
  }

  for (const entry of readdirSync(nextDir)) {
    if (entry === "cache") continue;
    rmSync(join(nextDir, entry), { recursive: true, force: true });
  }
  console.log("[clean-next] cleared .next (kept cache mount)");
}
