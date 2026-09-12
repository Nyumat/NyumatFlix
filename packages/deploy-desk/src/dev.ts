import { connect } from "node:net";
import { createServer } from "vite";
import { apiPort, deskPort, packageRoot } from "./lib/config";

async function portInUse(port: number) {
  return new Promise<boolean>((resolve) => {
    const socket = connect({ host: "127.0.0.1", port });
    socket.setTimeout(1000);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(true);
    });
  });
}
for (const port of [deskPort, apiPort]) {
  if (await portInUse(port))
    throw new Error(
      "Port " + port + " is already in use; the desk was not started",
    );
}
const api = Bun.spawn([process.execPath, "src/server.ts"], {
  cwd: packageRoot,
  env: { ...process.env, DEPLOY_DESK_DEV: "1" },
  stdin: "ignore",
  stdout: "inherit",
  stderr: "inherit",
});
let vite: Awaited<ReturnType<typeof createServer>> | undefined;
let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  api.kill("SIGTERM");
  await vite?.close();
  await api.exited;
  process.exit(code);
}
process.on("SIGINT", () => {
  void stop();
});
process.on("SIGTERM", () => {
  void stop();
});
void api.exited.then((code) => {
  if (!stopping) void stop(code || 1);
});
try {
  // API startup must succeed before opening the browser.
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      ready = (await fetch("http://127.0.0.1:" + apiPort + "/api/health")).ok;
    } catch {
      /* Starting. */
    }
    if (ready) break;
    await Bun.sleep(100);
  }
  if (!ready) throw new Error("Deploy Desk API did not start");
  vite = await createServer({
    root: packageRoot,
    configFile: packageRoot + "/vite.config.ts",
  });
  await vite.listen();
  const url = "http://127.0.0.1:" + deskPort;
  console.log("Deploy Desk → " + url);
  if (!process.argv.includes("--no-open")) {
    Bun.spawn([process.platform === "darwin" ? "open" : "xdg-open", url], {
      stdout: "ignore",
      stderr: "ignore",
    });
  }
  await new Promise<void>(() => {
    // Keep the Vite process alive until a signal or API exit requests shutdown.
  });
} catch (error) {
  console.error(error);
  await stop(1);
}
