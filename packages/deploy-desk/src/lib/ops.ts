import { repoRoot, remoteAppDir, sshHost } from "./config";
import { startJob } from "./jobs";
import { runProcess } from "./process";
import { fetchLive, remoteServe, runRemoteScript } from "./remote";

const prodEnvFile = () =>
  process.env.DEPLOY_DESK_PROD_ENV ?? repoRoot + "/.env.prod";

const remoteEnv = () => ({
  SSH_HOST: sshHost,
  REMOTE_APP_DIR: remoteAppDir,
});

export const startMigrate = () =>
  startJob("migrate", async ({ log, phase }) => {
    phase("Run production migrations");
    const result = await runProcess(
      repoRoot + "/scripts/db-migrate-if-needed.sh",
      [],
      { env: { ENV_FILE: prodEnvFile() }, onLine: log },
    );
    if (!result.ok)
      throw new Error("Database migration exited " + result.exitCode);
  });

export const startSyncEnv = () =>
  startJob("sync-env", async ({ log, phase }) => {
    phase("Sync production environment");
    const result = await runProcess(
      repoRoot + "/scripts/sync-prod-env.sh",
      ["push"],
      { env: remoteEnv(), onLine: log },
    );
    if (!result.ok)
      throw new Error("Environment sync exited " + result.exitCode);
  });

export const startRestart = () =>
  startJob("restart", async ({ log, phase }) => {
    phase("Read live deployment");
    const live = await fetchLive();
    if (!live?.image) throw new Error("No live deployment to restart");
    phase("Restart " + live.shortSha);
    const remote = await remoteServe(live, "local", log);
    if (!remote.ok) throw new Error("Restart exited " + remote.exitCode);
  });

export const startInfraStatus = () =>
  startJob("infra-status", async ({ log, phase }) => {
    phase("Check production infrastructure");
    const result = await runRemoteScript(
      "reconcile-prod-infra.sh",
      ["status"],
      log,
    );
    if (!result.ok)
      throw new Error("Infrastructure check exited " + result.exitCode);
  });

export const prodOps = {
  migrate: startMigrate,
  "sync-env": startSyncEnv,
  restart: startRestart,
  "infra-status": startInfraStatus,
} as const;
