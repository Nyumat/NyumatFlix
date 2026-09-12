import { resolve } from "node:path";
import {
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync,
  closeSync,
  unlinkSync,
} from "node:fs";
import { serveStatic } from "hono/bun";
import { createApp } from "./api";
import { apiPort, deskPort, host, packageRoot, repoRoot } from "./lib/config";
import { jobs, loadRedactions } from "./lib/jobs";
import { stopProcesses } from "./lib/process";

const lock = resolve(repoRoot, ".deploy-desk/server.pid");
mkdirSync(resolve(repoRoot, ".deploy-desk"), { recursive: true, mode: 0o700 });
try {
  const pid = Number(readFileSync(lock, "utf8"));
  if (!Number.isSafeInteger(pid) || pid < 1)
    throw new Error("Invalid desk lock; inspect .deploy-desk/server.pid");
  try {
    process.kill(pid, 0);
    throw new Error(
      "A Deploy Desk server is already running (PID " + pid + ")",
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    unlinkSync(lock);
  }
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
const fd = openSync(lock, "wx", 0o600);
writeFileSync(fd, String(process.pid));
closeSync(fd);
process.on("exit", () => {
  try {
    unlinkSync(lock);
  } catch {
    /* Already released. */
  }
});
await loadRedactions([
  resolve(repoRoot, ".env.prod"),
  process.env.DEPLOY_DESK_PREVIEW_ENV ?? resolve(repoRoot, ".env.prod"),
]);
await jobs.load();
const app = createApp();
const development = process.env.DEPLOY_DESK_DEV === "1";
if (!development) {
  const dist = resolve(packageRoot, "dist");
  if (!(await Bun.file(resolve(dist, "index.html")).exists()))
    throw new Error("Build the desk UI with bun run deploy:desk:build first");
  app.use("/*", serveStatic({ root: dist }));
  app.get("*", serveStatic({ path: resolve(dist, "index.html") }));
}
const port = development ? apiPort : deskPort;
const server = Bun.serve({
  fetch: app.fetch,
  hostname: host,
  port,
  idleTimeout: 60,
});
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  stopProcesses();
  await server.stop(true);
  await jobs.persist();
  process.exit(0);
}
process.on("SIGINT", () => {
  void shutdown();
});
process.on("SIGTERM", () => {
  void shutdown();
});
console.log("Deploy Desk API → http://" + host + ":" + port);
