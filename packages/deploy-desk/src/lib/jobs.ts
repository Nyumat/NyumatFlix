import { dirname } from "node:path";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { previewImage, previewPort, statePath } from "./config";
import type { Job, JobKind, PreviewState } from "./types";

type StoredState = { jobs: Job[]; preview: PreviewState };
type JobContext = {
  log: (line: string) => void;
  phase: (name: string) => void;
};
export class JobStore {
  private state: StoredState = {
    jobs: [],
    preview: {
      status: "idle",
      port: previewPort,
      url: "http://127.0.0.1:" + previewPort,
      image: previewImage,
    },
  };
  private writes: Promise<void> = Promise.resolve();
  private active: string | null = null;
  private timer?: ReturnType<typeof setTimeout>;
  constructor(
    private path: string,
    private redact: (value: string) => string = (value) => value,
  ) {}

  async persist() {
    const snapshot = JSON.stringify(this.state);
    this.writes = this.writes
      .catch(() => {
        // A failed prior write must not prevent the next state snapshot.
      })
      .then(async () => {
        await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
        await writeFile(this.path + ".tmp", snapshot, { mode: 0o600 });
        await rename(this.path + ".tmp", this.path);
      });
    return this.writes;
  }
  async load() {
    try {
      const saved: StoredState = JSON.parse(await readFile(this.path, "utf8"));
      if (!Array.isArray(saved.jobs) || !saved.preview)
        throw new Error("Invalid state file");
      this.state.jobs = saved.jobs
        .filter((job) => typeof job.id === "string" && Array.isArray(job.logs))
        .slice(0, 30);
      this.state.preview = {
        ...saved.preview,
        port: previewPort,
        url: "http://127.0.0.1:" + previewPort,
        image: previewImage,
      };
      for (const job of this.state.jobs) {
        job.logOffset ??= 0;
        if (job.status === "running" || job.status === "queued") {
          job.status = "failed";
          job.error =
            "Desk interrupted. Check production status before retrying; a remote rollout may have continued.";
          job.finishedAt = new Date().toISOString();
        }
      }
      if (["building", "starting"].includes(this.state.preview.status))
        this.state.preview.status = "failed";
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await this.persist();
  }
  get(id: string) {
    return this.state.jobs.find((job) => job.id === id);
  }
  list() {
    return this.state.jobs;
  }
  busy() {
    return this.active !== null;
  }
  preview() {
    return this.state.preview;
  }
  async setPreview(patch: Partial<PreviewState>) {
    this.state.preview = {
      ...this.state.preview,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    await this.persist();
  }
  async start(kind: JobKind, task: (context: JobContext) => Promise<void>) {
    // Both preview and deploy use this checkout and its Docker artifacts.
    if (this.active)
      throw new Error("Another job is running. Wait for it to finish.");
    const job: Job = {
      id: crypto.randomUUID(),
      kind,
      status: "queued",
      phase: "Queued",
      startedAt: new Date().toISOString(),
      logs: [],
      logOffset: 0,
    };
    this.active = job.id;
    this.state.jobs = [job, ...this.state.jobs].slice(0, 30);
    try {
      await this.persist();
    } catch (error) {
      this.active = null;
      this.state.jobs.shift();
      throw error;
    }
    const log = (text: string) => {
      const line = this.redact(text)
        .replace(new RegExp("\\u001b\\[[0-9;]*[a-zA-Z]", "g"), "")
        .slice(0, 8_192);
      if (!line) return;
      job.logs.push(line);
      if (job.logs.length > 1_000) {
        job.logs.shift();
        job.logOffset++;
      }
      if (!this.timer)
        this.timer = setTimeout(() => {
          this.timer = undefined;
          void this.persist().catch((error) =>
            console.error("Could not persist logs:", error.message),
          );
        }, 500);
    };
    void (async () => {
      job.status = "running";
      try {
        await task({
          log,
          phase: (name) => {
            job.phase = name;
            log("→ " + name);
          },
        });
        job.status = "succeeded";
        job.phase = "Complete";
      } catch (error) {
        job.status = "failed";
        job.phase = "Failed";
        job.error = this.redact(
          error instanceof Error ? error.message : "Job failed",
        );
        log(job.error);
      } finally {
        job.finishedAt = new Date().toISOString();
        job.durationMs = Date.now() - Date.parse(job.startedAt);
        clearTimeout(this.timer);
        this.timer = undefined;
        try {
          await this.persist();
        } catch (error) {
          console.error("Could not persist job:", error);
        }
        this.active = null;
      }
    })();
    return job;
  }
}

const secrets = new Set<string>();
export async function loadRedactions(paths: string[]) {
  for (const path of paths) {
    try {
      for (const line of (await readFile(path, "utf8")).split("\n")) {
        const match = line.match(/^\s*(?:export\s+)?([\w]+)\s*=\s*(.*?)\s*$/);
        if (
          match?.[1] &&
          /KEY|TOKEN|SECRET|PASSWORD|DATABASE|CREDENTIAL/i.test(match[1])
        ) {
          const value = (match[2] ?? "").replace(/^["']|["']$/g, "");
          if (value.length >= 6) secrets.add(value);
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}
function redact(text: string) {
  for (const secret of secrets) text = text.split(secret).join("[redacted]");
  return text.replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/g, "$1[redacted]@");
}
export const jobs = new JobStore(statePath, redact);
export const getJob = (id: string) => jobs.get(id);
export const getJobs = () => jobs.list();
export const getStoredPreview = () => jobs.preview();
export const setStoredPreview = (patch: Partial<PreviewState>) =>
  jobs.setPreview(patch);
export const startJob = (
  kind: JobKind,
  task: (context: JobContext) => Promise<void>,
) => jobs.start(kind, task);
