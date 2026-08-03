#!/usr/bin/env bun
/**
 * Rotate Gluetun egress on leetbot over SSH.
 * Usage: bun run rotate [--status]
 */

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SSH_HOST = process.env.SSH_HOST ?? "leetbot";
const REMOTE_SCRIPT = resolve(
  fileURLToPath(new URL("./rotate-vpn-remote.sh", import.meta.url)),
);

type RotateResult = {
  ok: boolean;
  previousPublicIp?: string;
  publicIp?: string;
  country?: string;
  vpnStatus?: string;
  countries?: string;
  elapsedMs?: number;
  error?: string;
};

const parseRemoteResult = (
  stdout: string,
  stderr: string,
  exitCode: number,
): RotateResult => {
  const jsonLine = stdout
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .reverse()
    .find((line) => line.startsWith("{"));

  if (!jsonLine) {
    const detail = stderr.trim() || stdout.trim() || `ssh exited ${exitCode}`;
    return { ok: false, error: detail };
  }

  try {
    return JSON.parse(jsonLine) as RotateResult;
  } catch {
    return { ok: false, error: "Invalid response from remote host" };
  }
};

const command = process.argv.includes("--status") ? "status" : "rotate";
const remoteScript = await Bun.file(REMOTE_SCRIPT).text();
const proc = Bun.spawn(["ssh", SSH_HOST, "bash", "-s", "--", command], {
  stdin: new Blob([remoteScript]),
  stdout: "pipe",
  stderr: "pipe",
});

const [stdout, stderr, exitCode] = await Promise.all([
  new Response(proc.stdout).text(),
  new Response(proc.stderr).text(),
  proc.exited,
]);

const result = parseRemoteResult(stdout, stderr, exitCode);
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
