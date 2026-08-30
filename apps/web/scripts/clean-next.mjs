import { rmSync } from "node:fs";
import { join } from "node:path";

const webRoot = join(import.meta.dirname, "..");

rmSync(join(webRoot, ".next"), { recursive: true, force: true });
console.log("[clean-next] removed .next");
