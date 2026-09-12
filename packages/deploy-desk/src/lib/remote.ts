import { remoteAppDir, sshHost } from "./config";
import { runProcess, shellQuote } from "./process";
import type { DeployEntry, LiveDeploy, ServiceRow } from "./types";

const ssh = (command: string, onLine?: (line: string) => void) =>
  runProcess(
    "ssh",
    [
      "-o",
      "BatchMode=yes",
      "-o",
      "ConnectTimeout=8",
      "-o",
      "ServerAliveInterval=15",
      "-o",
      "ServerAliveCountMax=3",
      sshHost,
      command,
    ],
    { onLine, timeoutMs: onLine ? 45 * 60_000 : 25_000 },
  );

const isDeployEntry = (value: unknown): value is DeployEntry => {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.sha === "string" &&
    typeof row.shortSha === "string" &&
    typeof row.message === "string" &&
    typeof row.author === "string" &&
    typeof row.deployedAt === "string" &&
    typeof row.image === "string" &&
    typeof row.source === "string" &&
    typeof row.port === "number"
  );
};

export const parseHistory = (raw: string): DeployEntry[] => {
  const entries: DeployEntry[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const parsed: unknown = JSON.parse(line);
      if (isDeployEntry(parsed)) entries.push(parsed);
    } catch {
      // A partial history line should not take down the control plane.
    }
  }
  return entries.reverse();
};

export const fetchHistory = async (limit = 30, offset = 0) => {
  if (
    !Number.isInteger(limit) ||
    !Number.isInteger(offset) ||
    limit < 1 ||
    offset < 0
  )
    throw new Error("Invalid history pagination");
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const safeOffset = Math.min(Math.max(offset, 0), 1_000);
  const result = await ssh(
    `test -f ~/${remoteAppDir}/deployments.jsonl && tail -n ${safeLimit + safeOffset} ~/${remoteAppDir}/deployments.jsonl || true`,
  );
  if (!result.ok)
    throw new Error(
      result.stderr.trim() || "Could not read deployment history",
    );
  return parseHistory(result.stdout).slice(safeOffset, safeOffset + safeLimit);
};

export const fetchLive = async (): Promise<LiveDeploy | null> => {
  const result = await ssh(
    `cd ~/${remoteAppDir} && ./scripts/deploy.sh current`,
  );
  if (!result.ok)
    throw new Error(result.stderr.trim() || "Could not read live deployment");
  const fields = new Map<string, string>();
  for (const line of result.stdout.split("\n")) {
    const index = line.indexOf("=");
    if (index > 0) fields.set(line.slice(0, index), line.slice(index + 1));
  }
  const shortSha = fields.get("shortSha") ?? "";
  if (!shortSha || shortSha === "<no value>") return null;
  return {
    sha: fields.get("sha") ?? "",
    shortSha,
    message: fields.get("message") ?? "",
    author: fields.get("author") ?? "",
    deployedAt: fields.get("deployedAt") ?? "",
    source: fields.get("source") ?? "",
    image: fields.get("image") ?? "",
  };
};

export const fetchServices = async (): Promise<ServiceRow[]> => {
  const result = await ssh(
    "sudo docker ps -a --filter name=^/nyumatflix$ --filter name=^/nyumatflix-imgproxy$ --filter name=^/cap$ --filter name=^/cap-valkey$ --filter name=^/flipt$ --filter name=^/gluetun$ --filter name=^/flaresolverr$ --format '{{.Names}}|{{.Status}}|{{.Image}}'",
  );
  if (!result.ok)
    throw new Error(result.stderr.trim() || "Could not read service status");
  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = "", status = "", image = ""] = line.split("|");
      return { name, status, image };
    });
};

export const remoteServe = async (
  entry: Pick<DeployEntry, "sha" | "shortSha" | "message" | "author" | "image">,
  source: "local" | "rollback",
  onLine: (line: string) => void,
) =>
  ssh(
    `set -euo pipefail; cd ~/${remoteAppDir}; export NYUMATFLIX_ROOT=~/${remoteAppDir}; export DOCKER_IMAGE=${shellQuote(entry.image)}; export DEPLOY_SHA=${shellQuote(entry.sha)}; export DEPLOY_SHORT_SHA=${shellQuote(entry.shortSha)}; export DEPLOY_MESSAGE=${shellQuote(entry.message)}; export DEPLOY_AUTHOR=${shellQuote(entry.author)}; export DEPLOY_SOURCE=${shellQuote(source)}; ./scripts/deploy.sh serve`,
    onLine,
  );
