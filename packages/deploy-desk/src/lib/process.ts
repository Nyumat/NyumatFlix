import { spawn } from "node:child_process";
import { repoRoot } from "./config";

export type ProcessResult = {
  ok: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
};
type RunOptions = {
  cwd?: string;
  env?: Record<string, string>;
  onLine?: (line: string) => void;
  timeoutMs?: number;
};
const children = new Set<number>();
export function stopProcesses() {
  for (const pid of children) {
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      /* Already exited. */
    }
  }
}

export function runProcess(
  command: string,
  args: string[],
  options: RunOptions = {},
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoRoot,
      env: { ...process.env, ...options.env },
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    });
    if (child.pid) children.add(child.pid);
    let stdout = "";
    let stderr = "";
    const attach = (
      stream: NodeJS.ReadableStream,
      save: (text: string) => void,
    ) => {
      let pending = "";
      stream.setEncoding("utf8");
      stream.on("data", (text: string) => {
        save(text);
        pending += text;
        const lines = pending.split(/[\r\n]+/);
        pending = lines.pop() ?? "";
        for (const line of lines) options.onLine?.(line.slice(0, 8_192));
        if (pending.length > 8_192) {
          options.onLine?.(pending.slice(0, 8_192));
          pending = "";
        }
      });
      stream.on("end", () => {
        if (pending) options.onLine?.(pending);
      });
    };
    attach(child.stdout, (text) => {
      stdout = (stdout + text).slice(-256_000);
    });
    attach(child.stderr, (text) => {
      stderr = (stderr + text).slice(-64_000);
    });
    const timeout = setTimeout(
      () => {
        if (child.pid) {
          try {
            process.kill(-child.pid, "SIGKILL");
          } catch {
            /* Already exited. */
          }
        }
      },
      options.timeoutMs ?? 45 * 60_000,
    );
    const cleanup = () => {
      clearTimeout(timeout);
      if (child.pid) children.delete(child.pid);
    };
    child.on("error", (error) => {
      cleanup();
      reject(error);
    });
    child.on("close", (code) => {
      cleanup();
      resolve({ ok: code === 0, exitCode: code ?? -1, stdout, stderr });
    });
  });
}

export const runSync = (command: string, args: string[]): ProcessResult => {
  const result = Bun.spawnSync([command, ...args], {
    cwd: repoRoot,
    env: process.env,
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    ok: result.exitCode === 0,
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
};
export const shellQuote = (value: string) =>
  "'" + value.replace(/'/g, "'\\''") + "'";
