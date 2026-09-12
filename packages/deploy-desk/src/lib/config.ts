import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";

const requireSafeToken = (value: string, label: string, pattern: RegExp) => {
  if (!pattern.test(value)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return value;
};

const numberInRange = (raw: string | undefined, fallback: number) => {
  const value = Number(raw ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    throw new Error(`Invalid port: ${raw}`);
  }
  return value;
};

function findRoot() {
  let directory = dirname(fileURLToPath(import.meta.url));
  while (true) {
    const manifest = resolve(directory, "package.json");
    if (
      existsSync(manifest) &&
      JSON.parse(readFileSync(manifest, "utf8")).name === "nyumatflix"
    )
      return directory;
    const parent = resolve(directory, "..");
    if (parent === directory)
      throw new Error("Run Deploy Desk inside the NyumatFlix checkout");
    directory = parent;
  }
}
export const repoRoot = findRoot();
export const packageRoot = resolve(repoRoot, "packages/deploy-desk");
export const deskPort = numberInRange(process.env.DEPLOY_DESK_PORT, 4545);
export const apiPort = numberInRange(
  process.env.DEPLOY_DESK_API_PORT,
  deskPort + 1,
);
export const host = process.env.DEPLOY_DESK_HOST ?? "127.0.0.1";
export const previewPort = numberInRange(process.env.PREVIEW_PORT, 9080);
export const sshHost = requireSafeToken(
  process.env.SSH_HOST ?? "leetbot",
  "SSH_HOST",
  /^[a-zA-Z0-9][a-zA-Z0-9_.@-]*$/,
);
export const remoteAppDir = requireSafeToken(
  process.env.REMOTE_APP_DIR ?? "apps/nyumatflix",
  "REMOTE_APP_DIR",
  /^[a-zA-Z0-9_][a-zA-Z0-9_./-]*$/,
);
export const productionUrl =
  process.env.DEPLOY_DESK_PROD_URL ?? "https://nyumatflix.com";
export const previewImage = "nyumatflix-preview:local";
export const previewContainer = "nyumatflix-preview-local";
export const statePath = resolve(repoRoot, ".deploy-desk/state.json");

if (host !== "127.0.0.1") {
  throw new Error("DEPLOY_DESK_HOST must be 127.0.0.1; the desk is local-only");
}
if (
  remoteAppDir.split("/").some((part) => !part || part === "." || part === "..")
)
  throw new Error(
    "REMOTE_APP_DIR must be a relative path below the remote home",
  );
if (deskPort === apiPort || [deskPort, apiPort].includes(previewPort))
  throw new Error("Desk, API, and preview ports must differ");
if (!/^https?:$/.test(new URL(productionUrl).protocol))
  throw new Error("Invalid production URL");
