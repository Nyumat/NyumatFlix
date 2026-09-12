import {
  previewContainer,
  previewImage,
  previewPort,
  repoRoot,
} from "./config";
import { getGitMeta } from "./git";
import { jobs, getStoredPreview, setStoredPreview, startJob } from "./jobs";
import { runProcess } from "./process";

export const previewEnvironment = () => ({
  PREVIEW_PORT: String(previewPort),
  PREVIEW_ENV_FILE:
    process.env.DEPLOY_DESK_PREVIEW_ENV ?? repoRoot + "/.env.prod",
});
export const inspectPreview = async () => {
  const [image, container] = await Promise.all([
    runProcess(
      "docker",
      [
        "image",
        "inspect",
        "--format",
        '{{.Id}}|{{index .Config.Labels "nyumatflix.preview.fingerprint"}}',
        previewImage,
      ],
      { timeoutMs: 8_000 },
    ),
    runProcess(
      "docker",
      [
        "container",
        "inspect",
        "--format",
        '{{.Id}}|{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}|{{index .Config.Labels "nyumatflix.preview"}}|{{.Image}}|{{json .NetworkSettings.Ports}}',
        previewContainer,
      ],
      { timeoutMs: 8_000 },
    ),
  ]);
  return { image, container };
};
export async function refreshPreview() {
  if (jobs.busy()) return getStoredPreview();
  try {
    const { image, container } = await inspectPreview();
    const [imageId, fingerprint] = image.ok
      ? image.stdout.trim().split("|")
      : [];
    const [containerId, status, health, label, runningImageId, bindings] =
      container.stdout.trim().split("|");
    let boundPort: string | undefined;
    if (container.ok && bindings) {
      const ports = JSON.parse(bindings) as Record<
        string,
        { HostIp: string; HostPort: string }[] | null
      >;
      boundPort = ports["8080/tcp"]?.find(
        (entry) => entry.HostIp === "127.0.0.1",
      )?.HostPort;
    }
    if (container.ok && label !== "local")
      throw new Error(
        "Container name belongs to an unmanaged container; it will not be touched",
      );
    if (jobs.busy()) return getStoredPreview(); // Do not overwrite a job that started during inspection.
    const running = container.ok && status === "running";
    await setStoredPreview({
      status: running ? "running" : image.ok ? "ready" : "idle",
      imageId,
      fingerprint:
        imageId && running && runningImageId !== imageId
          ? undefined
          : fingerprint,
      containerId: container.ok ? containerId : undefined,
      health: running ? health : undefined,
      port: boundPort ? Number(boundPort) : previewPort,
      url: "http://127.0.0.1:" + (boundPort ?? previewPort),
      error:
        !image.ok && !/No such (image|object)/i.test(image.stderr)
          ? "Docker is unavailable. Start Docker and refresh."
          : undefined,
    });
  } catch (error) {
    if (!jobs.busy())
      await setStoredPreview({
        status: "failed",
        health: undefined,
        error: error instanceof Error ? error.message : "Docker is unavailable",
      });
  }
  return getStoredPreview();
}

export const buildPreview = () =>
  startJob("preview-build", async ({ log, phase }) => {
    await setStoredPreview({
      status: "building",
      fingerprint: undefined,
      error: undefined,
    });
    try {
      const fingerprint = getGitMeta().fingerprint;
      phase("Build local production image");
      const result = await runProcess(
        repoRoot + "/scripts/deploy.sh",
        ["preview-build"],
        {
          env: {
            ...previewEnvironment(),
            DEPLOY_DESK_FINGERPRINT: fingerprint,
          },
          onLine: log,
        },
      );
      if (!result.ok)
        throw new Error("Preview build exited " + result.exitCode);
      if (getGitMeta().fingerprint !== fingerprint)
        throw new Error(
          "Checkout changed during the build. Review the changes and build again before using the preview gate.",
        );
      const { image } = await inspectPreview();
      if (!image.ok) throw new Error("Built image could not be inspected");
      await setStoredPreview({
        status: "ready",
        imageId: image.stdout.trim().split("|")[0],
        fingerprint,
      });
    } catch (error) {
      await setStoredPreview({ status: "failed", fingerprint: undefined });
      throw error;
    }
  });

export const startPreview = () =>
  startJob("preview-start", async ({ log, phase }) => {
    await setStoredPreview({ status: "starting", error: undefined });
    try {
      phase("Start isolated preview container");
      const result = await runProcess(
        repoRoot + "/scripts/deploy.sh",
        ["preview-serve"],
        { env: previewEnvironment(), onLine: log },
      );
      if (!result.ok)
        throw new Error("Preview start exited " + result.exitCode);
      const { image, container } = await inspectPreview();
      const [imageId, fingerprint] = image.stdout.trim().split("|");
      const [containerId, status, health, label, runningImageId] =
        container.stdout.trim().split("|");
      if (
        !container.ok ||
        status !== "running" ||
        health !== "healthy" ||
        label !== "local" ||
        runningImageId !== imageId
      )
        throw new Error("Preview health or image verification failed");
      await setStoredPreview({
        status: "running",
        imageId,
        fingerprint,
        containerId,
        health,
        port: previewPort,
        url: "http://127.0.0.1:" + previewPort,
      });
    } catch (error) {
      await setStoredPreview({ status: "failed", health: undefined });
      throw error;
    }
  });

export const stopPreview = () =>
  startJob("preview-stop", async ({ log, phase }) => {
    phase("Stop isolated preview container");
    const result = await runProcess(
      repoRoot + "/scripts/deploy.sh",
      ["preview-stop"],
      { onLine: log },
    );
    if (!result.ok) throw new Error("Preview stop exited " + result.exitCode);
    await setStoredPreview({
      status: getStoredPreview().imageId ? "ready" : "idle",
      containerId: undefined,
      health: undefined,
      error: undefined,
    });
  });
