#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const ROOT = new URL("..", import.meta.url).pathname;
const SSH_HOST = process.env.SSH_HOST ?? "leetbot";
const REMOTE_APP_DIR = process.env.REMOTE_APP_DIR ?? "apps/nyumatflix";
const DOCKER_REPO = "whotypes/nyumatflix";

type DeployEntry = {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  deployedAt: string;
  image: string;
  source: string;
  port: number;
};

type LiveDeploy = {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  deployedAt: string;
  source: string;
  image: string;
};

type ServiceRow = {
  name: string;
  status: string;
  image: string;
};

const c = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

const shellQuote = (value: string): string =>
  `'${value.replace(/'/g, `'\\''`)}'`;

const runLocal = (
  command: string,
  args: string[],
  env: Record<string, string> = {},
): { ok: boolean; stdout: string; stderr: string } => {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
};

const ssh = (
  remoteCommand: string,
): { ok: boolean; stdout: string; stderr: string } =>
  runLocal("ssh", [SSH_HOST, remoteCommand]);

const gitMeta = (): {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  dirty: boolean;
} => {
  const sha = runLocal("git", ["rev-parse", "HEAD"]).stdout.trim();
  const shortSha = runLocal("git", [
    "rev-parse",
    "--short=7",
    "HEAD",
  ]).stdout.trim();
  const message = runLocal("git", [
    "log",
    "-1",
    "--pretty=format:%s",
  ]).stdout.trim();
  const author = runLocal("git", [
    "log",
    "-1",
    "--pretty=format:%an",
  ]).stdout.trim();
  const dirty =
    runLocal("git", ["status", "--porcelain"]).stdout.trim().length > 0;
  return { sha, shortSha, message, author, dirty };
};

const resolveDeployIdentity = (
  meta: ReturnType<typeof gitMeta>,
): {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  source: string;
  dirty: boolean;
} => {
  if (!meta.dirty) {
    return {
      sha: meta.sha,
      shortSha: meta.shortSha,
      message: meta.message,
      author: meta.author,
      source: "local",
      dirty: false,
    };
  }

  return {
    sha: `${meta.sha}-dirty`,
    shortSha: `${meta.shortSha}+`,
    message: `${meta.message} (uncommitted)`,
    author: meta.author,
    source: "local",
    dirty: true,
  };
};

const relativeTime = (iso: string): string => {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return iso;
  const delta = Math.max(0, Date.now() - then);
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const parseHistory = (raw: string): DeployEntry[] => {
  const entries: DeployEntry[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      entries.push(JSON.parse(trimmed) as DeployEntry);
    } catch {
      continue;
    }
  }
  return entries.reverse();
};

const fetchHistory = async (limit = 20): Promise<DeployEntry[]> => {
  const remote = ssh(
    `test -f ~/${REMOTE_APP_DIR}/deployments.jsonl && tail -n ${limit} ~/${REMOTE_APP_DIR}/deployments.jsonl || true`,
  );
  return parseHistory(remote.stdout);
};

const fetchLive = async (): Promise<LiveDeploy | null> => {
  const remote = ssh(
    `cd ~/${REMOTE_APP_DIR} && ./scripts/deploy.sh current 2>/dev/null || true`,
  );
  if (!remote.stdout.trim()) return null;

  const fields = new Map<string, string>();
  for (const line of remote.stdout.split("\n")) {
    const index = line.indexOf("=");
    if (index === -1) continue;
    fields.set(line.slice(0, index), line.slice(index + 1));
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

const fetchServices = async (): Promise<ServiceRow[]> => {
  const remote = ssh(
    `sudo docker ps -a --filter name=^/nyumatflix$ --filter name=^/nyumatflix-imgproxy$ --filter name=^/cap$ --filter name=^/cap-valkey$ --filter name=^/flipt$ --filter name=^/gluetun$ --filter name=^/flaresolverr$ --format '{{.Names}}|{{.Status}}|{{.Image}}'`,
  );
  return remote.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = "", status = "", image = ""] = line.split("|");
      return { name, status, image };
    });
};

const runStep = async (
  label: string,
  action: () => Promise<{ ok: boolean; stderr: string }>,
): Promise<void> => {
  let frame = 0;
  const timer = setInterval(() => {
    process.stdout.write(
      `\r${c.cyan}${frames[frame % frames.length]}${c.reset} ${label}`,
    );
    frame += 1;
  }, 80);

  const result = await action();
  clearInterval(timer);
  process.stdout.write("\r");

  if (result.ok) {
    console.log(`${c.green}✓${c.reset} ${label}`);
    return;
  }

  console.log(`${c.red}✗${c.reset} ${label}`);
  if (result.stderr.trim()) {
    console.log(`${c.dim}${result.stderr.trim()}${c.reset}`);
  }
  process.exit(1);
};

let skipConfirm = false;

const confirm = async (prompt: string): Promise<boolean> => {
  if (skipConfirm) return true;
  const rl = createInterface({ input, output });
  const answer = (await rl.question(`${prompt} ${c.dim}[Y/n]${c.reset} `))
    .trim()
    .toLowerCase();
  rl.close();
  return answer === "" || answer === "y" || answer === "yes";
};

const printHeader = () => {
  console.log("");
  console.log(
    `${c.bold}${c.magenta}nyumatflix${c.reset} ${c.dim}deploy${c.reset}`,
  );
  console.log(`${c.dim}${SSH_HOST} · ${REMOTE_APP_DIR}${c.reset}`);
  console.log("");
};

const printDeployLine = (
  prefix: string,
  shortSha: string,
  message: string,
  when: string,
  live = false,
) => {
  const badge = live ? `${c.green}live${c.reset}` : `${c.dim}     ${c.reset}`;
  const sha = `${c.bold}${shortSha}${c.reset}`;
  const msg = message.length > 52 ? `${message.slice(0, 49)}...` : message;
  console.log(
    `${badge}  ${prefix.padEnd(6)} ${sha}  ${c.dim}${msg}${c.reset}  ${c.dim}${when}${c.reset}`,
  );
};

const remoteServe = (
  entry: Pick<DeployEntry, "sha" | "shortSha" | "message" | "author" | "image">,
  source: string,
) => {
  const message = shellQuote(entry.message);
  const author = shellQuote(entry.author);
  const image = entry.image || `${DOCKER_REPO}:${entry.sha}`;
  return ssh(
    `set -euo pipefail; cd ~/${REMOTE_APP_DIR}; export NYUMATFLIX_ROOT=~/${REMOTE_APP_DIR}; export DOCKER_IMAGE=${shellQuote(image)}; export DEPLOY_SHA=${shellQuote(entry.sha)}; export DEPLOY_SHORT_SHA=${shellQuote(entry.shortSha)}; export DEPLOY_MESSAGE=${message}; export DEPLOY_AUTHOR=${author}; export DEPLOY_SOURCE=${shellQuote(source)}; ./scripts/deploy.sh serve`,
  );
};

const cmdStatus = async () => {
  printHeader();
  const [live, services] = await Promise.all([fetchLive(), fetchServices()]);

  if (live) {
    printDeployLine(
      "",
      live.shortSha,
      live.message,
      relativeTime(live.deployedAt),
      true,
    );
    console.log(
      `${c.dim}       ${live.author} · ${live.source} · ${live.image}${c.reset}`,
    );
    console.log("");
  } else {
    console.log(`${c.yellow}no live deployment labels found${c.reset}\n`);
  }

  console.log(`${c.bold}services${c.reset}`);
  if (services.length === 0) {
    console.log(`${c.dim}  none reported${c.reset}`);
    return;
  }

  for (const service of services) {
    const healthy = /healthy|up /i.test(service.status);
    const mark = healthy ? `${c.green}●${c.reset}` : `${c.yellow}●${c.reset}`;
    console.log(
      `  ${mark} ${service.name.padEnd(22)} ${c.dim}${service.status}${c.reset}`,
    );
  }
  console.log("");
};

const cmdList = async () => {
  printHeader();
  const [live, history] = await Promise.all([fetchLive(), fetchHistory(15)]);

  if (live) {
    printDeployLine(
      "",
      live.shortSha,
      live.message,
      relativeTime(live.deployedAt),
      true,
    );
    console.log("");
  }

  if (history.length === 0) {
    console.log(`${c.dim}no deployment history yet${c.reset}\n`);
    return;
  }

  console.log(`${c.bold}history${c.reset}`);
  for (const entry of history) {
    const isLive = live?.shortSha === entry.shortSha;
    printDeployLine(
      isLive ? "" : " ",
      entry.shortSha,
      entry.message,
      relativeTime(entry.deployedAt),
      isLive,
    );
    console.log(`       ${c.dim}${entry.author} · ${entry.source}${c.reset}`);
  }
  console.log("");
};

const cmdDeploy = async (options: { fast?: boolean } = {}) => {
  const fast = options.fast === true;
  printHeader();
  const meta = gitMeta();
  const deploy = resolveDeployIdentity(meta);
  const live = await fetchLive();

  if (live) {
    printDeployLine(
      "",
      live.shortSha,
      live.message,
      relativeTime(live.deployedAt),
      true,
    );
  }

  console.log("");
  printDeployLine("ship", deploy.shortSha, deploy.message, "now");
  console.log(`${c.dim}       ${deploy.author}${c.reset}`);
  if (deploy.dirty) {
    console.log(
      `${c.yellow}       local changes will ship · image ${DOCKER_REPO}:${deploy.sha}${c.reset}`,
    );
  }
  if (fast) {
    console.log(
      `${c.cyan}fast deploy${c.reset} ${c.dim}(skip movi/wasm rebuild when artifacts exist)${c.reset}`,
    );
  }
  console.log("");

  console.log(`${c.bold}steps${c.reset}`);
  for (const step of [
    fast ? "build & push (fast)" : "build & push",
    "sync prod",
    "roll container",
  ]) {
    console.log(`  ${c.dim}○${c.reset} ${step}`);
  }
  console.log("");

  const approved = await confirm(`deploy to ${SSH_HOST}?`);
  if (!approved) {
    console.log(`${c.dim}cancelled${c.reset}`);
    return;
  }

  console.log("");
  const env: Record<string, string> = {
    DEPLOY_SHA: deploy.sha,
    DEPLOY_SHORT_SHA: deploy.shortSha,
    DEPLOY_MESSAGE: deploy.message,
    DEPLOY_AUTHOR: deploy.author,
    DEPLOY_SOURCE: deploy.source,
    DOCKER_IMAGE: `${DOCKER_REPO}:${deploy.sha}`,
  };
  if (fast) {
    env.SKIP_PLAYER_BUILD = "1";
    env.SKIP_SCRAPE_STACK = "1";
  }

  await runStep("build & push", async () => {
    const result = runLocal(`${ROOT}/scripts/deploy.sh`, ["bp"], env);
    return { ok: result.ok, stderr: result.stderr || result.stdout };
  });

  await runStep("sync prod", async () => {
    const result = runLocal(`${ROOT}/scripts/sync-prod-env.sh`, ["push"]);
    return { ok: result.ok, stderr: result.stderr || result.stdout };
  });

  await runStep("roll container", async () => {
    const message = shellQuote(deploy.message);
    const author = shellQuote(deploy.author);
    const result = ssh(
      `set -euo pipefail; cd ~/${REMOTE_APP_DIR}; export NYUMATFLIX_ROOT=~/${REMOTE_APP_DIR}; export DOCKER_IMAGE=${shellQuote(env.DOCKER_IMAGE)}; export DEPLOY_SHA=${shellQuote(deploy.sha)}; export DEPLOY_SHORT_SHA=${shellQuote(deploy.shortSha)}; export DEPLOY_MESSAGE=${message}; export DEPLOY_AUTHOR=${author}; export DEPLOY_SOURCE=${shellQuote(deploy.source)}; ./scripts/deploy.sh serve`,
    );
    if (result.ok) {
      process.stdout.write(result.stdout);
    }
    return { ok: result.ok, stderr: result.stderr || result.stdout };
  });

  console.log("");
  console.log(
    `${c.green}${c.bold}live${c.reset}  ${deploy.shortSha}  ${deploy.message}`,
  );
  console.log("");
};

const pickRollbackTarget = async (
  history: DeployEntry[],
  live: LiveDeploy | null,
  targetArg?: string,
): Promise<DeployEntry | null> => {
  const candidates = history.filter(
    (entry) => entry.shortSha !== live?.shortSha,
  );
  if (candidates.length === 0) return null;

  if (targetArg) {
    return (
      candidates.find(
        (entry) =>
          entry.shortSha.startsWith(targetArg) ||
          entry.sha.startsWith(targetArg),
      ) ?? null
    );
  }

  console.log(`${c.bold}pick a rollback target${c.reset}`);
  candidates.slice(0, 8).forEach((entry, index) => {
    console.log(
      `  ${c.cyan}${index + 1}${c.reset}  ${entry.shortSha}  ${c.dim}${entry.message}${c.reset}  ${c.dim}${relativeTime(entry.deployedAt)}${c.reset}`,
    );
  });
  console.log("");

  const rl = createInterface({ input, output });
  const answer = (
    await rl.question(`number or short sha ${c.dim}[1]${c.reset} `)
  ).trim();
  rl.close();

  if (!answer) return candidates[0] ?? null;
  if (/^\d+$/.test(answer)) {
    const picked = candidates[Number(answer) - 1];
    return picked ?? null;
  }
  return (
    candidates.find(
      (entry) =>
        entry.shortSha.startsWith(answer) || entry.sha.startsWith(answer),
    ) ?? null
  );
};

const cmdRollback = async (targetArg?: string) => {
  printHeader();
  const [live, history] = await Promise.all([fetchLive(), fetchHistory(30)]);

  if (live) {
    printDeployLine(
      "",
      live.shortSha,
      live.message,
      relativeTime(live.deployedAt),
      true,
    );
    console.log("");
  }

  const target = await pickRollbackTarget(history, live, targetArg);
  if (!target) {
    console.log(`${c.red}no rollback target found${c.reset}\n`);
    process.exit(1);
  }

  printDeployLine(
    "rollback",
    target.shortSha,
    target.message,
    relativeTime(target.deployedAt),
  );
  console.log("");

  const approved = await confirm(`rollback ${SSH_HOST} to ${target.shortSha}?`);
  if (!approved) {
    console.log(`${c.dim}cancelled${c.reset}`);
    return;
  }

  console.log("");
  await runStep("roll container", async () => {
    const result = remoteServe(target, "rollback");
    if (result.ok) {
      process.stdout.write(result.stdout);
    }
    return { ok: result.ok, stderr: result.stderr || result.stdout };
  });

  console.log("");
  console.log(
    `${c.green}${c.bold}live${c.reset}  ${target.shortSha}  ${target.message}`,
  );
  console.log("");
};

const printHelp = () => {
  console.log(`
${c.bold}nyumatflix deploy${c.reset}

  ${c.cyan}bun run deploy${c.reset}                 ship HEAD to ${SSH_HOST}
  ${c.cyan}bun run deploy:fast${c.reset}            ship without movi/wasm rebuild
  ${c.cyan}bun run deploy status${c.reset}          live deploy + service health
  ${c.cyan}bun run deploy ls${c.reset}              recent deployments
  ${c.cyan}bun run deploy rollback${c.reset}        pick a previous deploy
  ${c.cyan}bun run deploy rollback abc123${c.reset} rollback by short sha

  add ${c.dim}-y${c.reset} to skip confirmation
`);
};

const main = async () => {
  const rawArgs = process.argv.slice(2);
  skipConfirm = rawArgs.includes("-y") || rawArgs.includes("--yes");
  const args = rawArgs.filter((arg) => arg !== "-y" && arg !== "--yes");
  const [command = "deploy", ...rest] = args;

  switch (command) {
    case "deploy":
      await cmdDeploy();
      break;
    case "fast":
      await cmdDeploy({ fast: true });
      break;
    case "status":
      await cmdStatus();
      break;
    case "ls":
    case "list":
      await cmdList();
      break;
    case "rollback":
      await cmdRollback(rest[0]);
      break;
    case "help":
    case "--help":
    case "-h":
      printHelp();
      break;
    default:
      console.error(`${c.red}unknown command:${c.reset} ${command}`);
      printHelp();
      process.exit(1);
  }
};

await main();
