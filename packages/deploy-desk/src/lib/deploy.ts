import { repoRoot, sshHost, remoteAppDir } from "./config";
import { getGitMeta, resolveDeployIdentity } from "./git";
import { getStoredPreview, startJob } from "./jobs";
import { inspectPreview } from "./preview";
import { runProcess } from "./process";
import { fetchHistory, remoteServe } from "./remote";

export const startDeploy = (options: {
  fast: boolean;
  skipPreview: boolean;
  fingerprint: string;
}) =>
  startJob("deploy", async ({ log, phase }) => {
    const meta = getGitMeta();
    if (meta.fingerprint !== options.fingerprint)
      throw new Error(
        "Checkout changed since review. Refresh and confirm again.",
      );
    if (!options.skipPreview) {
      phase("Verify preview");
      const { image, container } = await inspectPreview();
      const [imageId, fingerprint] = image.stdout.trim().split("|");
      const [, status, health, label, runningImage] = container.stdout
        .trim()
        .split("|");
      if (
        !image.ok ||
        !container.ok ||
        label !== "local" ||
        status !== "running" ||
        health !== "healthy" ||
        imageId !== runningImage ||
        fingerprint !== meta.fingerprint ||
        getStoredPreview().fingerprint !== meta.fingerprint
      ) {
        throw new Error(
          "A healthy preview of this checkout is required. Build and start it, or explicitly skip the preview.",
        );
      }
    }
    const deploy = resolveDeployIdentity(meta);
    const image = "whotypes/nyumatflix:" + deploy.sha;
    const env: Record<string, string> = {
      DEPLOY_SHA: deploy.sha,
      DEPLOY_SHORT_SHA: deploy.shortSha,
      DEPLOY_MESSAGE: deploy.message,
      DEPLOY_AUTHOR: deploy.author,
      DEPLOY_SOURCE: deploy.source,
      DOCKER_IMAGE: image,
      SSH_HOST: sshHost,
      REMOTE_APP_DIR: remoteAppDir,
    };
    if (options.fast) {
      env.SKIP_PLAYER_BUILD = "1";
      env.SKIP_SCRAPE_STACK = "1";
    }
    phase(
      options.fast ? "Build and push image (fast)" : "Build and push image",
    );
    const build = await runProcess(repoRoot + "/scripts/deploy.sh", ["bp"], {
      env,
      onLine: log,
    });
    if (!build.ok) throw new Error("Image build/push exited " + build.exitCode);
    if (getGitMeta().fingerprint !== meta.fingerprint)
      throw new Error(
        "Checkout changed during build. Image was pushed, but production rollout was stopped. Review and retry.",
      );
    phase("Sync production environment");
    const sync = await runProcess(
      repoRoot + "/scripts/sync-prod-env.sh",
      ["push"],
      { env, onLine: log },
    );
    if (!sync.ok) throw new Error("Environment sync exited " + sync.exitCode);
    phase("Roll production container");
    const remote = await remoteServe({ ...deploy, image }, "local", log);
    if (!remote.ok)
      throw new Error(
        "Remote rollout exited " +
          remote.exitCode +
          ". Check production status before retrying.",
      );
  });

export const startRollback = (sha: string, image: string, deployedAt: string) =>
  startJob("rollback", async ({ log, phase }) => {
    phase("Verify rollback target");
    // Resolve all metadata server-side; never execute a client-supplied image or command.
    let target;
    for (let offset = 0; offset <= 1000; offset += 100) {
      const history = await fetchHistory(100, offset);
      target = history.find(
        (entry) =>
          entry.sha === sha &&
          entry.image === image &&
          entry.deployedAt === deployedAt,
      );
      if (target || history.length < 100) break;
    }
    if (!target)
      throw new Error("Rollback target is no longer present in remote history");
    if (
      !/^whotypes\/nyumatflix(?::[a-zA-Z0-9_.-]+|@sha256:[a-f0-9]{64})$/.test(
        target.image,
      )
    )
      throw new Error("Rollback image is outside the NyumatFlix repository");
    phase("Roll back to " + target.shortSha);
    const remote = await remoteServe(target, "rollback", log);
    if (!remote.ok)
      throw new Error(
        "Remote rollback exited " +
          remote.exitCode +
          ". Check production status before retrying.",
      );
  });
