import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JobStore } from "./jobs";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true })),
  );
});

test("aborted job cannot continue to another phase or report success", async () => {
  const directory = await mkdtemp(join(tmpdir(), "deploy-desk-job-"));
  directories.push(directory);
  const store = new JobStore(join(directory, "state.json"));
  let release!: () => void;
  const paused = new Promise<void>((resolve) => {
    release = resolve;
  });
  let nextPhaseRan = false;
  const job = await store.start("deploy", async ({ phase }) => {
    phase("First step");
    await paused;
    phase("Production rollout");
    nextPhaseRan = true;
  });

  store.abort(job.id);
  release();
  for (let attempt = 0; attempt < 50 && store.busy(); attempt++) {
    await Bun.sleep(10);
  }

  expect(store.busy()).toBe(false);
  expect(nextPhaseRan).toBe(false);
  expect(job.status).toBe("failed");
  expect(job.phase).toBe("Aborted");
});
