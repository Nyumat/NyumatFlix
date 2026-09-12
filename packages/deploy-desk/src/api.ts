import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { streamSSE } from "hono/streaming";
import { apiPort, deskPort, productionUrl, sshHost } from "./lib/config";
import { startDeploy, startRollback } from "./lib/deploy";
import { getGitMeta } from "./lib/git";
import { getJob, getJobs } from "./lib/jobs";
import {
  buildPreview,
  refreshPreview,
  startPreview,
  stopPreview,
} from "./lib/preview";
import { fetchHistory, fetchLive, fetchServices } from "./lib/remote";

const defaults = {
  getGitMeta,
  getJob,
  getJobs,
  buildPreview,
  refreshPreview,
  startPreview,
  stopPreview,
  fetchHistory,
  fetchLive,
  fetchServices,
  startDeploy,
  startRollback,
};
export function createApp(overrides: Partial<typeof defaults> = {}) {
  const deps = { ...defaults, ...overrides };
  const token = crypto.randomUUID();
  const app = new Hono();
  const hosts = new Set(["127.0.0.1:" + deskPort, "127.0.0.1:" + apiPort]);
  const origins = new Set([...hosts].map((host) => "http://" + host));
  app.use("*", async (c, next) => {
    const url = new URL(c.req.url);
    if (!hosts.has(c.req.header("Host") ?? url.host))
      return c.json({ error: "Invalid local host" }, 403);
    const origin = c.req.header("Origin");
    if (origin && !origins.has(origin))
      return c.json({ error: "Cross-origin access is not allowed" }, 403);
    c.header("Cache-Control", "no-store");
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header("Referrer-Policy", "no-referrer");
    c.header("Content-Security-Policy", "frame-ancestors 'none'");
    if (!["GET", "HEAD"].includes(c.req.method)) {
      if (!origin || c.req.header("X-Deploy-Desk-Token") !== token)
        return c.json({ error: "Refresh the desk before making changes" }, 403);
      if (c.req.header("Content-Type")?.split(";")[0] !== "application/json")
        return c.json({ error: "JSON body required" }, 415);
    }
    await next();
  });
  app.use(
    "/api/*",
    bodyLimit({
      maxSize: 4096,
      onError: (c) => c.json({ error: "Request body is too large" }, 413),
    }),
  );
  app.onError((error, c) => c.json({ error: error.message }, 500));
  app.get("/api/session", (c) =>
    c.json({ token, remote: sshHost, productionUrl }),
  );
  app.get("/api/health", (c) => c.json({ ok: true }));
  app.get("/api/git", (c) => c.json(deps.getGitMeta()));
  app.get("/api/status", async (c) => {
    const [live, services] = await Promise.allSettled([
      deps.fetchLive(),
      deps.fetchServices(),
    ]);
    const errors = [live, services].flatMap((result) =>
      result.status === "rejected"
        ? [
            result.reason instanceof Error
              ? result.reason.message
              : "Remote status unavailable",
          ]
        : [],
    );
    return c.json({
      live: live.status === "fulfilled" ? live.value : null,
      services: services.status === "fulfilled" ? services.value : [],
      remote: sshHost,
      productionUrl,
      errors,
      checkedAt: new Date().toISOString(),
    });
  });
  app.get("/api/history", async (c) => {
    const limit = Number(c.req.query("limit") ?? 20);
    const offset = Number(c.req.query("offset") ?? 0);
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      !Number.isInteger(offset) ||
      offset < 0 ||
      offset > 1000
    )
      return c.json({ error: "Invalid pagination" }, 400);
    try {
      const entries = await deps.fetchHistory(limit, offset);
      return c.json({
        entries,
        nextOffset:
          entries.length === limit && offset + limit <= 1000
            ? offset + limit
            : null,
      });
    } catch (error) {
      return c.json(
        {
          error: error instanceof Error ? error.message : "History unavailable",
        },
        502,
      );
    }
  });
  app.get("/api/preview", async (c) => c.json(await deps.refreshPreview()));
  app.get("/api/jobs", (c) =>
    c.json({ jobs: deps.getJobs().map(({ logs: _logs, ...job }) => job) }),
  );
  app.get("/api/jobs/:id", (c) => {
    const job = deps.getJob(c.req.param("id"));
    return job ? c.json(job) : c.json({ error: "Job not found" }, 404);
  });
  for (const action of ["build", "start", "stop"] as const) {
    app.post("/api/preview/" + action, async (c) => {
      try {
        const task = {
          build: deps.buildPreview,
          start: deps.startPreview,
          stop: deps.stopPreview,
        }[action];
        return c.json({ job: await task() }, 202);
      } catch (error) {
        return c.json(
          {
            error:
              error instanceof Error ? error.message : "Preview action failed",
          },
          409,
        );
      }
    });
  }
  app.post("/api/deploy", async (c) => {
    const body: unknown = await c.req.json().catch(() => null);
    if (
      !body ||
      typeof body !== "object" ||
      !("confirmed" in body) ||
      body.confirmed !== true ||
      !("fingerprint" in body) ||
      typeof body.fingerprint !== "string" ||
      !("fast" in body) ||
      typeof body.fast !== "boolean" ||
      !("skipPreview" in body) ||
      typeof body.skipPreview !== "boolean"
    )
      return c.json({ error: "Review and confirm the deployment first" }, 400);
    try {
      return c.json(
        {
          job: await deps.startDeploy({
            fast: body.fast,
            skipPreview: body.skipPreview,
            fingerprint: body.fingerprint,
          }),
        },
        202,
      );
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error ? error.message : "Deploy could not start",
        },
        409,
      );
    }
  });
  app.post("/api/rollback", async (c) => {
    const body: unknown = await c.req.json().catch(() => null);
    if (
      !body ||
      typeof body !== "object" ||
      !("confirmed" in body) ||
      body.confirmed !== true ||
      !("sha" in body) ||
      typeof body.sha !== "string" ||
      !/^[a-f0-9]{7,40}(?:-dirty)?$/i.test(body.sha) ||
      !("image" in body) ||
      typeof body.image !== "string" ||
      !("deployedAt" in body) ||
      typeof body.deployedAt !== "string"
    )
      return c.json(
        { error: "An exact history entry and confirmation are required" },
        400,
      );
    try {
      return c.json(
        {
          job: await deps.startRollback(body.sha, body.image, body.deployedAt),
        },
        202,
      );
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error ? error.message : "Rollback could not start",
        },
        409,
      );
    }
  });
  app.get("/api/jobs/:id/events", (c) => {
    const id = c.req.param("id");
    if (!deps.getJob(id)) return c.json({ error: "Job not found" }, 404);
    const lastId = Number(c.req.header("Last-Event-ID") ?? -1);
    return streamSSE(c, async (stream) => {
      let cursor = Number.isSafeInteger(lastId) ? lastId + 1 : 0;
      while (!stream.aborted) {
        const job = deps.getJob(id);
        if (!job) return;
        cursor = Math.max(cursor, job.logOffset);
        for (; cursor < job.logOffset + job.logs.length; cursor++) {
          await stream.writeSSE({
            event: "log",
            id: String(cursor),
            data: JSON.stringify(job.logs[cursor - job.logOffset]),
          });
        }
        const { logs: _logs, ...status } = job;
        await stream.writeSSE({
          event: "status",
          data: JSON.stringify(status),
        });
        if (job.status === "succeeded" || job.status === "failed") return;
        await stream.sleep(500);
      }
    });
  });
  app.all("/api/*", (c) => c.json({ error: "API route not found" }, 404));
  return app;
}
