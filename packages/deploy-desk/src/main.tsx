import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpRight,
  Box,
  ChevronRight,
  Copy,
  Database,
  ExternalLink,
  GitBranch,
  History,
  LayoutDashboard,
  LoaderCircle,
  OctagonX,
  Play,
  RefreshCw,
  Rocket,
  RotateCcw,
  RotateCw,
  Square,
  Terminal,
  Upload,
  X,
} from "lucide-react";
import type {
  DeployEntry,
  GitMeta,
  Job,
  LiveDeploy,
  PreviewState,
  ProdOp,
  ServiceRow,
} from "./lib/types";
import "./styles.css";

type Status = {
  live: LiveDeploy | null;
  services: ServiceRow[];
  remote: string;
  productionUrl: string;
  errors: string[];
  checkedAt: string;
};
type JobSummary = Omit<Job, "logs">;
type HistoryPage = { entries: DeployEntry[]; nextOffset: number | null };
type Page = "overview" | "deploy" | "history" | "preview";

const pages: { id: Page; icon: typeof Box; label: string }[] = [
  { id: "overview", icon: LayoutDashboard, label: "Overview" },
  { id: "deploy", icon: Rocket, label: "Deploy" },
  { id: "history", icon: History, label: "History" },
  { id: "preview", icon: Box, label: "Preview" },
];

const pageLabel = (id: Page) =>
  pages.find((page) => page.id === id)?.label ?? id;

const prodTasks: {
  id: ProdOp;
  label: string;
  hint: string;
  icon: typeof Database;
  confirm?: string;
}[] = [
  {
    id: "migrate",
    label: "Migrate DB",
    hint: "Apply pending Drizzle migrations",
    icon: Database,
    confirm: "Run production database migrations?",
  },
  {
    id: "sync-env",
    label: "Sync env",
    hint: "Push .env.prod and scripts to the server",
    icon: Upload,
    confirm: "Sync production environment files?",
  },
  {
    id: "restart",
    label: "Restart app",
    hint: "Re-roll the live container, no rebuild",
    icon: RotateCw,
    confirm: "Restart the live app container?",
  },
  {
    id: "infra-status",
    label: "Infra check",
    hint: "Run infrastructure health checks",
    icon: Activity,
  },
];

const running = (job?: JobSummary) =>
  job?.status === "running" || job?.status === "queued";

const healthy = (status: string) =>
  !/unhealthy|exited|dead|restarting/i.test(status) &&
  /healthy|^up\b/i.test(status);

function relative(iso?: string) {
  if (!iso || !Number.isFinite(Date.parse(iso))) return "—";
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(iso)) / 60_000),
  );
  if (minutes < 1) return "now";
  if (minutes < 60) return minutes + "m";
  if (minutes < 1440) return Math.floor(minutes / 60) + "h";
  return Math.floor(minutes / 1440) + "d";
}

function duration(ms?: number) {
  if (ms === undefined) return "—";
  const seconds = Math.floor(ms / 1000);
  return seconds < 60
    ? seconds + "s"
    : Math.floor(seconds / 60) + "m " + (seconds % 60) + "s";
}

function normalizeGit(meta: GitMeta): GitMeta {
  const changes = meta.changes ?? [];
  return {
    ...meta,
    changes,
    changedFiles: meta.changedFiles ?? changes.length,
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    signal: AbortSignal.timeout(35_000),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error ?? "Request failed (" + response.status + ")");
  return data as T;
}

function Accordion({
  title,
  meta,
  open,
  onToggle,
  children,
}: {
  title: string;
  meta?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!innerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (open && innerRef.current) setHeight(innerRef.current.scrollHeight);
    });
    observer.observe(innerRef.current);
    if (open) setHeight(innerRef.current.scrollHeight);
    return () => observer.disconnect();
  }, [open, children]);

  return (
    <section className="accordion">
      <button
        type="button"
        className="accordion-trigger"
        aria-expanded={open}
        onClick={onToggle}
      >
        <ChevronRight
          size={14}
          className={"accordion-chevron" + (open ? " open" : "")}
        />
        {title}
        {meta && <span className="accordion-meta">{meta}</span>}
      </button>
      <div
        className={"accordion-body" + (open ? " open" : " closed")}
        style={{ maxHeight: open ? (height ?? 2000) : 0 }}
      >
        <div ref={innerRef} className="accordion-inner">
          {children}
        </div>
      </div>
    </section>
  );
}

function DirtyNotice({ git }: { git: GitMeta }) {
  if (!git.dirty) return null;
  return (
    <div className="notice dirty" role="status">
      <AlertTriangle size={15} />
      <span>
        {git.changedFiles} uncommitted file
        {git.changedFiles === 1 ? "" : "s"} in this checkout will be included in
        the deploy image
      </span>
    </div>
  );
}

function GitChanges({ git }: { git: GitMeta }) {
  const changes = git.changes ?? [];
  if (!changes.length) return null;
  return (
    <ul className="change-list" aria-label="Changed files">
      {changes.map((change) => (
        <li key={change.path}>
          <code className="change-mark mono">{change.mark || "?"}</code>
          <span>{change.path}</span>
        </li>
      ))}
    </ul>
  );
}

function Dialog({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} onCancel={close} aria-labelledby="dialog-title">
      <header className="dialog-head">
        <h2 id="dialog-title">{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Close"
          onClick={close}
        >
          <X size={16} />
        </button>
      </header>
      {children}
    </dialog>
  );
}

function App() {
  const initial = window.location.hash.slice(1) as Page;
  const [page, setPage] = useState<Page>(
    pages.find((p) => p.id === initial)?.id ?? "overview",
  );
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    production: true,
    services: false,
    checkout: true,
    preview: true,
    ship: true,
    history: true,
    logs: true,
    previewPage: true,
    tasks: false,
  });
  const [status, setStatus] = useState<Status | null>(null);
  const [git, setGit] = useState<GitMeta | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [history, setHistory] = useState<HistoryPage>({
    entries: [],
    nextOffset: null,
  });
  const [historyError, setHistoryError] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [selectedJob, setSelectedJob] = useState<string>();
  const [streamJob, setStreamJob] = useState<JobSummary>();
  const [logs, setLogs] = useState<string[]>([]);
  const [streamError, setStreamError] = useState("");
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [fast, setFast] = useState(false);
  const [skipPreview, setSkipPreview] = useState(false);
  const [confirmDeploy, setConfirmDeploy] = useState(false);
  const [confirmOp, setConfirmOp] = useState<ProdOp | null>(null);
  const [rollbackTarget, setRollbackTarget] = useState<DeployEntry | null>(
    null,
  );
  const [frame, setFrame] = useState(false);
  const [tick, setTick] = useState(Date.now());
  const [copied, setCopied] = useState(false);
  const logsRef = useRef<HTMLPreElement>(null);
  const jobSelectId = useId();

  const activeJob =
    jobs.find(running) ?? (running(streamJob) ? streamJob : undefined);
  const busy = pending || !!activeJob;
  const previewReady =
    preview?.status === "running" &&
    preview.health === "healthy" &&
    !!git &&
    preview.fingerprint === git.fingerprint;
  const live = status?.live;

  const isOpen = (key: string) => openSections[key] ?? false;
  const toggle = (key: string) =>
    setOpenSections((current) => ({
      ...current,
      [key]: !(current[key] ?? false),
    }));

  const loadHistory = useCallback(async (offset = 0) => {
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const result = await request<HistoryPage>(
        "/api/history?limit=20&offset=" + offset,
      );
      setHistory((current) => ({
        ...result,
        entries: offset
          ? [...current.entries, ...result.entries]
          : result.entries,
      }));
    } catch (e) {
      setHistoryError((e as Error).message);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    setError("");
    const results = await Promise.allSettled([
      request<Status>("/api/status").then(setStatus),
      request<GitMeta>("/api/git").then((meta) => setGit(normalizeGit(meta))),
      request<PreviewState>("/api/preview").then(setPreview),
      request<{ jobs: JobSummary[] }>("/api/jobs").then((result) => {
        setJobs(result.jobs);
        setSelectedJob((current) => current ?? result.jobs[0]?.id);
      }),
    ]);
    const failures = results.flatMap((result) =>
      result.status === "rejected" ? [(result.reason as Error).message] : [],
    );
    if (failures.length) setError(failures.join(" · "));
    refreshingRef.current = false;
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void refresh();
    void loadHistory();
    const timer = setInterval(() => void refresh(), 15_000);
    const clock = setInterval(() => setTick(Date.now()), 1_000);
    return () => {
      clearInterval(timer);
      clearInterval(clock);
    };
  }, [refresh, loadHistory]);

  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() === "r" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !(
          event.target instanceof HTMLElement &&
          (event.target.matches("input, textarea, select") ||
            event.target.isContentEditable)
        ) &&
        !document.querySelector("dialog[open]")
      ) {
        event.preventDefault();
        void refresh();
        void loadHistory();
      }
    };
    const hash = () => {
      const found = pages.find((p) => p.id === window.location.hash.slice(1));
      if (found) setPage(found.id);
    };
    window.addEventListener("keydown", keyboard);
    window.addEventListener("hashchange", hash);
    return () => {
      window.removeEventListener("keydown", keyboard);
      window.removeEventListener("hashchange", hash);
    };
  }, [refresh, loadHistory]);

  useEffect(() => {
    if (!selectedJob) return;
    setLogs([]);
    setStreamJob(undefined);
    setStreamError("");
    const source = new EventSource("/api/jobs/" + selectedJob + "/events");
    source.addEventListener("log", (event: MessageEvent<string>) => {
      setLogs((current) =>
        [...current, JSON.parse(event.data) as string].slice(-2000),
      );
    });
    source.addEventListener("status", (event: MessageEvent<string>) => {
      const job = JSON.parse(event.data) as JobSummary;
      setStreamJob(job);
      setStreamError("");
      if (!running(job)) {
        source.close();
        setJobs((current) =>
          current.map((entry) => (entry.id === job.id ? job : entry)),
        );
        void refresh();
        void loadHistory();
      }
    });
    source.onerror = () => setStreamError("Reconnecting…");
    return () => source.close();
  }, [selectedJob, refresh, loadHistory]);

  useEffect(() => {
    const el = logsRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [logs]);

  const navigate = (next: Page) => {
    setPage(next);
    window.location.hash = next;
  };

  async function abortRunningJob() {
    const current = streamJob ?? jobs.find((job) => job.id === selectedJob);
    if (!selectedJob || !running(current)) return;
    setPending(true);
    setError("");
    try {
      const { token } = await request<{ token: string }>("/api/session");
      await request("/api/jobs/" + selectedJob + "/abort", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Deploy-Desk-Token": token,
        },
        body: "{}",
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function runOp(name: ProdOp) {
    setPending(true);
    setError("");
    try {
      const { token } = await request<{ token: string }>("/api/session");
      const { job } = await request<{ job: Job }>("/api/ops/" + name, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Deploy-Desk-Token": token,
        },
        body: JSON.stringify({ confirmed: true }),
      });
      setSelectedJob(job.id);
      setJobs((current) => [
        job,
        ...current.filter((entry) => entry.id !== job.id),
      ]);
      setConfirmOp(null);
      setOpenSections((current) => ({ ...current, logs: true }));
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  const handleProdTask = (task: (typeof prodTasks)[number]) => {
    if (task.confirm) {
      setConfirmOp(task.id);
      return;
    }
    void runOp(task.id);
  };

  async function action(path: string, body: Record<string, unknown> = {}) {
    setPending(true);
    setError("");
    try {
      const { token } = await request<{ token: string }>("/api/session");
      const { job } = await request<{ job: Job }>(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Deploy-Desk-Token": token,
        },
        body: JSON.stringify(body),
      });
      setSelectedJob(job.id);
      setJobs((current) => [
        job,
        ...current.filter((entry) => entry.id !== job.id),
      ]);
      setConfirmDeploy(false);
      setRollbackTarget(null);
      setOpenSections((current) => ({ ...current, logs: true }));
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  const isLive = (entry: DeployEntry) =>
    live?.image === entry.image &&
    live.sha === entry.sha &&
    live.deployedAt?.slice(0, 16) === entry.deployedAt.slice(0, 16);

  const previewControls = (
    <div className="actions-row">
      <button
        type="button"
        className="icon-button"
        title="Build preview"
        aria-label="Build preview"
        disabled={busy}
        onClick={() => void action("/api/preview/build")}
      >
        <Box size={15} />
      </button>
      <button
        type="button"
        className="icon-button"
        title={preview?.status === "running" ? "Restart" : "Start preview"}
        aria-label="Start preview"
        disabled={busy || !preview?.imageId}
        onClick={() => void action("/api/preview/start")}
      >
        <Play size={15} />
      </button>
      <button
        type="button"
        className="icon-button"
        title="Stop preview"
        aria-label="Stop preview"
        disabled={busy || !preview?.containerId}
        onClick={() => {
          setFrame(false);
          void action("/api/preview/stop");
        }}
      >
        <Square size={13} />
      </button>
      {preview?.status === "running" && (
        <a
          className="button icon-button"
          href={preview.url}
          target="_blank"
          rel="noreferrer"
          title="Open preview"
          aria-label="Open preview"
        >
          <ArrowUpRight size={15} />
        </a>
      )}
    </div>
  );

  const checkoutDiffersFromLive =
    live && git && live.shortSha.replace(/\+$/, "") !== git.shortSha;

  const deployBlocked = !git || busy || (!skipPreview && !previewReady);

  const deployHint = !git
    ? "Waiting for git status"
    : busy
      ? "Wait for the current job to finish"
      : !skipPreview && !previewReady
        ? "Build and start a healthy preview, or skip preview"
        : null;

  const gitBlock = git ? (
    <div className="git-block">
      <p className="git-message">{git.message}</p>
      <div className="git-meta">
        <span className="inline">
          <GitBranch size={12} />
          {git.branch}
        </span>
        <code className="mono">{git.shortSha}</code>
        <span>{git.author}</span>
        {git.dirty && (
          <span className="tag">{git.changedFiles} uncommitted</span>
        )}
        {checkoutDiffersFromLive && (
          <span className="tag">not on production</span>
        )}
      </div>
      {git.dirty && <GitChanges git={git} />}
      {git.dirty && git.diffStat !== "No tracked diff" && (
        <pre className="diff-block mono">{git.diffStat}</pre>
      )}
    </div>
  ) : (
    <p className="empty">Loading checkout…</p>
  );

  const handleCopyLogs = async () => {
    if (!logs.length) return;
    await navigator.clipboard.writeText(logs.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#overview"
          title="Deploy Desk"
          onClick={() => navigate("overview")}
        >
          N
        </a>
        <nav aria-label="Navigation">
          {pages.map(({ id, icon: Icon, label }) => (
            <a
              key={id}
              href={"#" + id}
              title={label}
              aria-label={label}
              aria-current={page === id ? "page" : undefined}
              onClick={() => navigate(id)}
            >
              <Icon size={17} />
              {id === "preview" && preview?.status === "running" && (
                <span className="nav-dot" />
              )}
            </a>
          ))}
        </nav>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <span className="topbar-title">{pageLabel(page)}</span>
          <span className="inline topbar-meta">
            {activeJob && (
              <span className="topbar-status">
                <LoaderCircle size={12} className="spin" />
                {activeJob.kind}
                {streamJob?.phase ? ` · ${streamJob.phase}` : ""}
              </span>
            )}
            {status?.remote ?? "—"}
          </span>
        </header>

        <main>
          <div className="page-actions">
            <button
              type="button"
              className="icon-button"
              title="Refresh (r)"
              aria-label="Refresh"
              disabled={refreshing}
              onClick={() => {
                void refresh();
                void loadHistory();
              }}
            >
              <RefreshCw className={refreshing ? "spin" : ""} size={15} />
            </button>
            {page !== "deploy" && (
              <button
                type="button"
                className="icon-button"
                title="Deploy"
                aria-label="Deploy"
                onClick={() => navigate("deploy")}
              >
                <Rocket size={15} />
              </button>
            )}
            {status?.productionUrl && (
              <a
                className="button icon-button"
                href={status.productionUrl}
                target="_blank"
                rel="noreferrer"
                title="Production"
                aria-label="Open production"
              >
                <ArrowUpRight size={15} />
              </a>
            )}
          </div>

          {error && (
            <div className="notice error" role="alert">
              {error}
              <button
                type="button"
                className="icon-button"
                aria-label="Dismiss"
                onClick={() => setError("")}
              >
                <X size={14} />
              </button>
            </div>
          )}

          {git?.dirty && (page === "deploy" || page === "overview") && (
            <DirtyNotice git={git} />
          )}

          {page === "overview" && (
            <>
              <Accordion
                title="Production"
                open={isOpen("production")}
                onToggle={() => toggle("production")}
                meta={
                  <>
                    <span
                      className={
                        "dot " +
                        (status?.errors.length ? "warn" : live ? "live" : "off")
                      }
                    />
                    {live ? relative(live.deployedAt) : "—"}
                  </>
                }
              >
                {status?.errors.map((message) => (
                  <p key={message} className="row-sub">
                    {message}
                  </p>
                ))}
                {live ? (
                  <div className="git-block">
                    <p className="git-message">{live.message || "—"}</p>
                    <div className="git-meta">
                      <code className="mono">{live.shortSha}</code>
                      <span>{live.author}</span>
                      <span className="mono">{live.image}</span>
                    </div>
                  </div>
                ) : (
                  <p className="empty">{status ? "No deployment" : "…"}</p>
                )}
              </Accordion>

              <Accordion
                title="Services"
                open={isOpen("services")}
                onToggle={() => toggle("services")}
                meta={status?.services.length ?? "—"}
              >
                {status?.services.length ? (
                  status.services.map((service) => (
                    <div className="row" key={service.name}>
                      <span
                        className={
                          "dot " + (healthy(service.status) ? "live" : "warn")
                        }
                      />
                      <div className="row-main">
                        <div className="row-title">{service.name}</div>
                        <div className="row-sub mono">{service.image}</div>
                      </div>
                      <span className="tag">{service.status}</span>
                    </div>
                  ))
                ) : (
                  <p className="empty">—</p>
                )}
              </Accordion>

              <Accordion
                title="Checkout"
                open={isOpen("checkout")}
                onToggle={() => toggle("checkout")}
                meta={
                  git?.dirty ? `${git.changedFiles} changed` : git?.shortSha
                }
              >
                {gitBlock}
              </Accordion>

              <Accordion
                title="Tasks"
                open={isOpen("tasks")}
                onToggle={() => toggle("tasks")}
              >
                <div className="task-grid">
                  {prodTasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      className="task-chip"
                      title={task.hint}
                      disabled={busy || (task.id === "restart" && !live)}
                      onClick={() => handleProdTask(task)}
                    >
                      <task.icon size={14} />
                      {task.label}
                    </button>
                  ))}
                </div>
              </Accordion>
            </>
          )}

          {page === "deploy" && (
            <>
              <Accordion
                title="Checkout"
                open={isOpen("checkout")}
                onToggle={() => toggle("checkout")}
                meta={
                  git?.dirty ? `${git.changedFiles} changed` : git?.shortSha
                }
              >
                {gitBlock}
              </Accordion>

              <Accordion
                title="Preview"
                open={isOpen("preview")}
                onToggle={() => toggle("preview")}
                meta={previewReady ? "ready" : (preview?.status ?? "idle")}
              >
                {previewControls}
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={skipPreview}
                    onChange={(e) => setSkipPreview(e.target.checked)}
                    disabled={busy}
                  />
                  Skip preview
                </label>
                {preview?.fingerprint &&
                  git &&
                  preview.fingerprint !== git.fingerprint && (
                    <p className="row-sub">Rebuild required</p>
                  )}
              </Accordion>

              <Accordion
                title="Ship"
                open={isOpen("ship")}
                onToggle={() => toggle("ship")}
                meta={status?.remote}
              >
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={fast}
                    onChange={(e) => setFast(e.target.checked)}
                    disabled={busy}
                  />
                  Fast deploy
                </label>
                <div className="actions-row">
                  <button
                    type="button"
                    className="primary labeled"
                    disabled={deployBlocked}
                    title="Deploy"
                    aria-label="Deploy"
                    onClick={() => setConfirmDeploy(true)}
                  >
                    <Rocket size={15} />
                    Deploy
                  </button>
                </div>
                {deployHint && <p className="hint">{deployHint}</p>}
              </Accordion>
            </>
          )}

          {page === "history" && (
            <Accordion
              title="History"
              open={isOpen("history")}
              onToggle={() => toggle("history")}
              meta={history.entries.length}
            >
              {historyError && (
                <div className="notice error">
                  {historyError}
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Retry"
                    onClick={() => void loadHistory()}
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
              )}
              {history.entries.length ? (
                history.entries.map((entry, index) => (
                  <div
                    className="row"
                    key={entry.deployedAt + entry.sha + index}
                  >
                    <div className="row-main">
                      <div className="row-title">
                        {entry.message || entry.shortSha}
                      </div>
                      <div className="row-sub">
                        <code className="mono">{entry.shortSha}</code>
                        {" · "}
                        {entry.author}
                        {" · "}
                        {relative(entry.deployedAt)}
                      </div>
                    </div>
                    <div className="row-actions">
                      {isLive(entry) ? (
                        <span className="tag live">live</span>
                      ) : (
                        <button
                          type="button"
                          className="icon-button"
                          title="Rollback"
                          aria-label={"Rollback to " + entry.shortSha}
                          disabled={busy}
                          onClick={() => setRollbackTarget(entry)}
                        >
                          <RotateCcw size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="empty">
                  {historyLoading ? "…" : historyError ? "—" : "No history"}
                </p>
              )}
              {history.nextOffset !== null && (
                <button
                  type="button"
                  className="load-more labeled"
                  disabled={historyLoading}
                  onClick={() => void loadHistory(history.nextOffset ?? 0)}
                >
                  <ArrowDownToLine size={14} />
                  {historyLoading ? "Loading…" : "Load more"}
                </button>
              )}
            </Accordion>
          )}

          {page === "preview" && (
            <Accordion
              title="Preview"
              open={isOpen("previewPage")}
              onToggle={() => toggle("previewPage")}
              meta={preview?.status ?? "—"}
            >
              <div className="git-meta">
                <code className="mono">{preview?.url ?? "—"}</code>
                <span>{preview?.health ?? "—"}</span>
              </div>
              {preview?.error && (
                <p className="row-sub" style={{ marginTop: 8 }}>
                  {preview.error}
                </p>
              )}
              {previewControls}
              {preview?.status === "running" && (
                <button
                  type="button"
                  className="labeled"
                  style={{ marginTop: 12 }}
                  onClick={() => setFrame(!frame)}
                >
                  <ExternalLink size={14} />
                  {frame ? "Hide" : "Embed"}
                </button>
              )}
              {frame && preview?.status === "running" && (
                <iframe
                  className="preview-frame"
                  title="Preview"
                  src={preview.url}
                  sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
                />
              )}
            </Accordion>
          )}

          <div className="logs-wrap">
            <Accordion
              title="Logs"
              open={isOpen("logs")}
              onToggle={() => toggle("logs")}
              meta={
                streamJob ? (
                  <span className="inline">
                    {running(streamJob) && (
                      <LoaderCircle size={12} className="spin" />
                    )}
                    {streamJob.status}
                  </span>
                ) : jobs.length ? (
                  "idle"
                ) : (
                  "—"
                )
              }
            >
              <div className="logs-header">
                <Terminal size={13} />
                <span className="logs-phase">
                  {streamJob?.phase ?? "—"}
                  {" · "}
                  {duration(
                    running(streamJob) && streamJob
                      ? tick - Date.parse(streamJob.startedAt)
                      : streamJob?.durationMs,
                  )}
                </span>
                {jobs.length > 0 && (
                  <>
                    <label className="sr-only" htmlFor={jobSelectId}>
                      Job
                    </label>
                    <select
                      id={jobSelectId}
                      value={selectedJob ?? ""}
                      onChange={(e) => setSelectedJob(e.target.value)}
                    >
                      {jobs.map((job) => (
                        <option key={job.id} value={job.id}>
                          {job.kind} · {relative(job.startedAt)}
                        </option>
                      ))}
                    </select>
                  </>
                )}
                {running(streamJob) && (
                  <button
                    type="button"
                    className="icon-button"
                    title="Abort job"
                    aria-label="Abort job"
                    disabled={pending}
                    onClick={() => void abortRunningJob()}
                  >
                    <OctagonX size={14} />
                  </button>
                )}
                <button
                  type="button"
                  className="icon-button"
                  title={copied ? "Copied" : "Copy logs"}
                  aria-label="Copy logs"
                  disabled={!logs.length}
                  onClick={() => void handleCopyLogs()}
                >
                  <Copy size={14} />
                </button>
              </div>
              {streamError && (
                <p className="row-sub" style={{ marginBottom: 8 }}>
                  {streamError}
                </p>
              )}
              <pre
                ref={logsRef}
                className="logs"
                aria-label="Job output"
                tabIndex={0}
              >
                {logs.join("\n") || "—"}
              </pre>
            </Accordion>
          </div>
        </main>
      </div>

      {confirmDeploy && git && (
        <Dialog title="Deploy" close={() => setConfirmDeploy(false)}>
          <div className="dialog-body">
            <code className="dialog-sha mono">
              {git.shortSha}
              {git.dirty ? "+" : ""}
            </code>
            <p className="dialog-message">{git.message}</p>
            {git.dirty && (
              <>
                <p className="hint">
                  Includes {git.changedFiles} uncommitted file
                  {git.changedFiles === 1 ? "" : "s"}.
                </p>
                <GitChanges git={git} />
              </>
            )}
          </div>
          <footer className="dialog-actions">
            <button
              type="button"
              className="icon-button"
              aria-label="Cancel"
              disabled={pending}
              onClick={() => setConfirmDeploy(false)}
            >
              <X size={15} />
            </button>
            <button
              type="button"
              className="primary icon-button"
              aria-label="Confirm deploy"
              disabled={busy}
              onClick={() =>
                void action("/api/deploy", {
                  confirmed: true,
                  fingerprint: git.fingerprint,
                  fast,
                  skipPreview,
                })
              }
            >
              <Rocket size={15} />
            </button>
          </footer>
        </Dialog>
      )}

      {confirmOp && (
        <Dialog
          title={
            prodTasks.find((task) => task.id === confirmOp)?.label ?? "Confirm"
          }
          close={() => setConfirmOp(null)}
        >
          <p className="hint">
            {prodTasks.find((task) => task.id === confirmOp)?.confirm}
          </p>
          <footer className="dialog-actions">
            <button
              type="button"
              className="labeled"
              disabled={pending}
              onClick={() => setConfirmOp(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="primary labeled"
              disabled={busy}
              onClick={() => void runOp(confirmOp)}
            >
              Run
            </button>
          </footer>
        </Dialog>
      )}

      {rollbackTarget && (
        <Dialog title="Rollback" close={() => setRollbackTarget(null)}>
          <div className="dialog-body">
            <code className="dialog-sha mono">{rollbackTarget.shortSha}</code>
            <p className="dialog-message">
              {rollbackTarget.message || rollbackTarget.shortSha}
            </p>
          </div>
          <footer className="dialog-actions">
            <button
              type="button"
              className="icon-button"
              aria-label="Cancel"
              onClick={() => setRollbackTarget(null)}
            >
              <X size={15} />
            </button>
            <button
              type="button"
              className="danger-button icon-button"
              aria-label="Confirm rollback"
              disabled={busy}
              onClick={() =>
                void action("/api/rollback", {
                  confirmed: true,
                  sha: rollbackTarget.sha,
                  image: rollbackTarget.image,
                  deployedAt: rollbackTarget.deployedAt,
                })
              }
            >
              <RotateCcw size={15} />
            </button>
          </footer>
        </Dialog>
      )}
    </div>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");
createRoot(root).render(<App />);
