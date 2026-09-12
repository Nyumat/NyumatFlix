import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Box,
  Check,
  ChevronRight,
  Circle,
  Clock,
  ExternalLink,
  GitBranch,
  GitCommitHorizontal,
  History,
  LayoutDashboard,
  LoaderCircle,
  Play,
  RefreshCw,
  Rocket,
  RotateCcw,
  ShieldCheck,
  Square,
  Terminal,
  X,
} from "lucide-react";
import type {
  DeployEntry,
  GitMeta,
  Job,
  LiveDeploy,
  PreviewState,
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
type Page = "Overview" | "Deploy" | "History" | "Preview";
const pages: { name: Page; icon: typeof Box }[] = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Deploy", icon: Rocket },
  { name: "History", icon: History },
  { name: "Preview", icon: Box },
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
  if (minutes < 1) return "just now";
  if (minutes < 60) return minutes + "m ago";
  if (minutes < 1440) return Math.floor(minutes / 60) + "h ago";
  return Math.floor(minutes / 1440) + "d ago";
}
function duration(ms?: number) {
  if (ms === undefined) return "—";
  const seconds = Math.floor(ms / 1000);
  return seconds < 60
    ? seconds + "s"
    : Math.floor(seconds / 60) + "m " + (seconds % 60) + "s";
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
function Badge({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <span className={"badge " + tone}>
      <span className="dot" />
      {children}
    </span>
  );
}
function OutLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="button" href={href} target="_blank" rel="noreferrer">
      {children}
      <ArrowUpRight size={14} />
    </a>
  );
}
function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
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
      <header className="section-heading">
        <h2 id="dialog-title">{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={close}
        >
          <X size={18} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
function App() {
  const initial = window.location.hash.slice(1);
  const [page, setPage] = useState<Page>(
    pages.find((p) => p.name.toLowerCase() === initial)?.name ?? "Overview",
  );
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
  const [confirmation, setConfirmation] = useState<GitMeta | null>(null);
  const [detail, setDetail] = useState<DeployEntry | null>(null);
  const [rollbackConfirmed, setRollbackConfirmed] = useState(false);
  const [frame, setFrame] = useState(false);
  const [tick, setTick] = useState(Date.now());
  const busy = pending || jobs.some(running) || running(streamJob);
  const previewReady =
    preview?.status === "running" &&
    preview.health === "healthy" &&
    !!git &&
    preview.fingerprint === git.fingerprint;

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
      request<GitMeta>("/api/git").then(setGit),
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
    const timer = setInterval(() => {
      void refresh();
    }, 15_000);
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
      const found = pages.find(
        (p) => p.name.toLowerCase() === window.location.hash.slice(1),
      );
      if (found) setPage(found.name);
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
        [...current, JSON.parse(event.data) as string].slice(-1000),
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
    source.onerror = () =>
      setStreamError("Log connection interrupted; reconnecting…");
    return () => source.close();
  }, [selectedJob, refresh, loadHistory]);

  const navigate = (next: Page) => {
    setPage(next);
    window.location.hash = next.toLowerCase();
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
      setConfirmation(null);
      setDetail(null);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  const pageDescriptions: Record<Page, string> = {
    Overview: "Production, your checkout, and the next release.",
    Deploy: "Review your changes. Preview locally. Ship with confidence.",
    History: "Every recorded rollout, with a path back.",
    Preview: "The production app, running on your machine.",
  };
  const live = status?.live;
  const previewControls = (
    <div className="actions">
      <button disabled={busy} onClick={() => void action("/api/preview/build")}>
        <Box size={15} />
        Build preview
      </button>
      <button
        disabled={busy || !preview?.imageId}
        onClick={() => void action("/api/preview/start")}
      >
        <Play size={15} />
        {preview?.status === "running" ? "Restart" : "Start preview"}
      </button>
      <button
        disabled={busy || !preview?.containerId}
        onClick={() => {
          setFrame(false);
          void action("/api/preview/stop");
        }}
      >
        <Square size={13} />
        Stop
      </button>
      {preview?.status === "running" && (
        <OutLink href={preview.url}>Open preview</OutLink>
      )}
    </div>
  );
  const gitReview = (
    <div className="git-review">
      <div className="split">
        <span className="inline">
          <GitBranch size={15} />
          {git?.branch ?? "Reading checkout…"}
        </span>
        <Badge tone={git?.dirty ? "warning" : ""}>
          {git?.dirty
            ? "Uncommitted changes"
            : git
              ? "Clean checkout"
              : "Loading"}
        </Badge>
      </div>
      <h3>{git?.message ?? "Loading commit…"}</h3>
      <p className="muted inline">
        <GitCommitHorizontal size={15} />
        <code>{git?.shortSha ?? "—"}</code>
        <span>{git?.author}</span>
      </p>
      {git?.dirty && (
        <details>
          <summary>
            {git.changedFiles} changed files · view diff summary
          </summary>
          <pre className="diff">{git.diffStat}</pre>
          <p className="muted">
            Untracked files count toward dirty state; the diff summary covers
            tracked files.
          </p>
        </details>
      )}
    </div>
  );
  return (
    <div className="shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#overview"
          onClick={() => navigate("Overview")}
        >
          <span className="brand-mark">N</span>
          <span>
            NyumatFlix<small>Deploy Desk</small>
          </span>
        </a>
        <nav aria-label="Main navigation">
          {pages.map(({ name, icon: Icon }) => (
            <a
              key={name}
              href={"#" + name.toLowerCase()}
              aria-current={page === name ? "page" : undefined}
              onClick={() => navigate(name)}
            >
              <Icon size={17} />
              {name}
              {name === "Preview" && preview?.status === "running" && (
                <span className="nav-dot" />
              )}
            </a>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="inline">
            <ShieldCheck size={16} />
            Local access only
          </span>
          <span className="muted">127.0.0.1 · this machine</span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span className="inline">
            <span className="project-dot" />
            NyumatFlix <ChevronRight size={14} />
            <span className="muted">Deploy Desk</span>
          </span>
          <span className="inline muted">
            <span className="dot" />
            {status?.remote ?? "leetbot"}
          </span>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <h1>{page}</h1>
              <p>{pageDescriptions[page]}</p>
            </div>
            <div className="actions">
              <button
                className="icon-button"
                title="Refresh status (r)"
                aria-label="Refresh status"
                disabled={refreshing}
                onClick={() => {
                  void refresh();
                  void loadHistory();
                }}
              >
                <RefreshCw className={refreshing ? "spin" : ""} size={16} />
              </button>
              {page !== "Deploy" && (
                <button className="primary" onClick={() => navigate("Deploy")}>
                  <Rocket size={15} />
                  Start deploy
                </button>
              )}
            </div>
          </div>
          {error && (
            <div className="notice error" role="alert">
              {error}
              <button
                className="icon-button"
                aria-label="Dismiss error"
                onClick={() => setError("")}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {git?.dirty && (
            <div className="notice warning">
              <GitBranch size={16} />
              <span>
                {git.changedFiles} local changes will ship with this checkout.
                <span className="muted"> The image will be marked dirty.</span>
              </span>
            </div>
          )}
          {page === "Overview" && (
            <>
              <section className="panel production">
                <header className="section-heading">
                  <h2>Production</h2>
                  <Badge
                    tone={
                      status?.errors.length ? "warning" : live ? "success" : ""
                    }
                  >
                    {status?.errors.length
                      ? "Status unavailable"
                      : live
                        ? "Deployed"
                        : status
                          ? "No deployment"
                          : "Connecting"}
                  </Badge>
                </header>
                {status?.errors.map((message) => (
                  <p key={message} className="inline-error">
                    {message}
                  </p>
                ))}
                {live ? (
                  <>
                    <div className="release">
                      <span className="release-glyph">
                        <GitCommitHorizontal size={25} />
                      </span>
                      <div>
                        <h3>
                          {live.message ||
                            "Deployment without a commit message"}
                        </h3>
                        <p className="muted">
                          <code>{live.shortSha}</code>
                          <span className="separator">/</span>
                          {live.author}
                          <span className="separator">/</span>
                          {relative(live.deployedAt)}
                        </p>
                      </div>
                    </div>
                    <dl className="metadata">
                      <div>
                        <dt>Image</dt>
                        <dd>
                          <code>{live.image}</code>
                        </dd>
                      </div>
                      <div>
                        <dt>Source</dt>
                        <dd>{live.source}</dd>
                      </div>
                      <div>
                        <dt>Deployed</dt>
                        <dd>{new Date(live.deployedAt).toLocaleString()}</dd>
                      </div>
                    </dl>
                  </>
                ) : (
                  <Empty>
                    {status
                      ? "No live deployment metadata reported. Service status is shown below."
                      : "Connecting to your production host…"}
                  </Empty>
                )}
                <footer className="panel-footer">
                  <span className="muted inline">
                    <Clock size={14} />
                    {status
                      ? "Checked " + relative(status.checkedAt)
                      : "Waiting for status"}
                  </span>
                  <OutLink
                    href={status?.productionUrl ?? "https://nyumatflix.com"}
                  >
                    Visit production
                  </OutLink>
                </footer>
              </section>
              <div className="overview-columns">
                <section className="panel">
                  <header className="section-heading">
                    <h2>Services</h2>
                    <span className="muted">
                      {status?.services.length ?? "—"} reported
                    </span>
                  </header>
                  {status?.services.length ? (
                    <div className="services">
                      {status.services.map((service) => (
                        <div className="service" key={service.name}>
                          <span
                            className={
                              "status-dot " +
                              (healthy(service.status) ? "success" : "warning")
                            }
                          />
                          <div>
                            <strong>{service.name}</strong>
                            <span title={service.image}>{service.image}</span>
                          </div>
                          <span className="service-status">
                            {service.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty>
                      {refreshing
                        ? "Reading service health…"
                        : "No services reported. Check SSH access and refresh."}
                    </Empty>
                  )}
                </section>
                <section className="panel">
                  <header className="section-heading">
                    <h2>Next release</h2>
                    <GitBranch size={17} />
                  </header>
                  {gitReview}
                  <footer className="panel-footer">
                    <span className="muted">From this working tree</span>
                    <button
                      className="text-button"
                      onClick={() => navigate("Deploy")}
                    >
                      Review release
                      <ChevronRight size={15} />
                    </button>
                  </footer>
                </section>
              </div>
            </>
          )}
          {page === "Deploy" && (
            <>
              <div className="deploy-layout">
                <section className="panel wizard">
                  <div className="wizard-step">
                    <span className="step-number">1</span>
                    <div>
                      <h2>Review checkout</h2>
                      <p className="muted">
                        These local files are the release source.
                      </p>
                      {gitReview}
                    </div>
                  </div>
                  <div className="wizard-step">
                    <span className="step-number">
                      {previewReady ? <Check size={15} /> : "2"}
                    </span>
                    <div>
                      <div className="section-heading">
                        <h2>Verify a local preview</h2>
                        <Badge tone={previewReady ? "success" : ""}>
                          {previewReady
                            ? "Ready to review"
                            : (preview?.status ?? "idle")}
                        </Badge>
                      </div>
                      <p className="muted">
                        Build the full app from the production Dockerfile, then
                        start it and check your changes.
                      </p>
                      {previewControls}
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={skipPreview}
                          onChange={(e) => setSkipPreview(e.target.checked)}
                          disabled={busy}
                        />
                        Skip preview for this deploy
                      </label>
                      {preview?.fingerprint &&
                        git &&
                        preview.fingerprint !== git.fingerprint && (
                          <p className="inline-error">
                            Checkout changed since the preview build. Rebuild to
                            use the gate.
                          </p>
                        )}
                    </div>
                  </div>
                  <div className="wizard-step">
                    <span className="step-number">3</span>
                    <div>
                      <h2>Ship to {status?.remote ?? "leetbot"}</h2>
                      <p className="muted">
                        Build and push, sync production, then roll through the
                        existing health checks.
                      </p>
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={fast}
                          onChange={(e) => setFast(e.target.checked)}
                          disabled={busy}
                        />
                        Fast deploy{" "}
                        <span className="muted">
                          Reuse available player / WASM artifacts
                        </span>
                      </label>
                      <button
                        className="primary"
                        disabled={
                          busy || !git || (!skipPreview && !previewReady)
                        }
                        onClick={() => setConfirmation(git)}
                      >
                        <Rocket size={15} />
                        Review and deploy
                      </button>
                    </div>
                  </div>
                </section>
                <aside className="release-notes">
                  <ShieldCheck size={24} />
                  <h2>Production stays protected</h2>
                  <p>
                    The candidate passes health checks before nginx switches
                    traffic. A remote lock prevents overlapping rollouts.
                  </p>
                  <hr />
                  <h3>Release sequence</h3>
                  <ol>
                    <li>Build & push image</li>
                    <li>Sync production environment</li>
                    <li>Health-check & switch</li>
                  </ol>
                  <p className="muted">
                    Preview validates the checkout. Shipping rebuilds the
                    production image using the existing CLI path.
                  </p>
                </aside>
              </div>
            </>
          )}
          {page === "History" && (
            <section className="panel">
              <header className="section-heading">
                <h2>Deployment history</h2>
                <span className="muted">Newest first</span>
              </header>
              {historyError && (
                <div className="notice error">
                  {historyError}
                  <button onClick={() => void loadHistory()}>Retry</button>
                </div>
              )}
              {history.entries.length ? (
                <div className="history-list">
                  {history.entries.map((entry, index) => (
                    <button
                      className="history-row"
                      key={entry.deployedAt + entry.sha + index}
                      onClick={() => {
                        setDetail(entry);
                        setRollbackConfirmed(false);
                      }}
                    >
                      <span className="history-line">
                        <GitCommitHorizontal size={20} />
                      </span>
                      <span className="history-copy">
                        <strong>
                          {entry.message || "Untitled deployment"}
                        </strong>
                        <span>
                          <code>{entry.shortSha}</code>
                          <span className="separator">/</span>
                          {entry.author}
                          <span className="separator">/</span>
                          {entry.source}
                          {entry.dirty && " · dirty"}
                        </span>
                      </span>
                      <span className="history-end">
                        {live?.image === entry.image &&
                        live.sha === entry.sha &&
                        live.deployedAt?.slice(0, 16) ===
                          entry.deployedAt.slice(0, 16) ? (
                          <Badge tone="success">Live</Badge>
                        ) : (
                          <span className="muted">
                            {relative(entry.deployedAt)}
                          </span>
                        )}
                        <ChevronRight size={16} />
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <Empty>
                  {historyLoading
                    ? "Reading remote deployment history…"
                    : historyError
                      ? "History could not be loaded."
                      : "No deployment history has been recorded yet."}
                </Empty>
              )}
              {history.nextOffset !== null && (
                <footer className="panel-footer">
                  <span className="muted">
                    {history.entries.length} deployments loaded
                  </span>
                  <button
                    disabled={historyLoading}
                    onClick={() => void loadHistory(history.nextOffset ?? 0)}
                  >
                    <ArrowDownToLine size={14} />
                    {historyLoading ? "Loading…" : "Load older"}
                  </button>
                </footer>
              )}
            </section>
          )}
          {page === "Preview" && (
            <section className="panel">
              <header className="section-heading">
                <h2>Local Docker preview</h2>
                <Badge
                  tone={
                    preview?.health === "healthy"
                      ? "success"
                      : preview?.status === "failed"
                        ? "warning"
                        : ""
                  }
                >
                  {preview?.status ?? "Checking"}
                </Badge>
              </header>
              <div className="preview-body">
                <div className="preview-identity">
                  <Box size={35} />
                  <div>
                    <h3>{preview?.image ?? "nyumatflix-preview:local"}</h3>
                    <p className="muted">
                      Production Dockerfile · linux/amd64 · local image only
                    </p>
                  </div>
                </div>
                {preview?.error && (
                  <div className="notice error">{preview.error}</div>
                )}
                <dl className="metadata">
                  <div>
                    <dt>Address</dt>
                    <dd>
                      <code>{preview?.url ?? "—"}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Container health</dt>
                    <dd>{preview?.health ?? "Not running"}</dd>
                  </div>
                  <div>
                    <dt>Image ID</dt>
                    <dd>
                      <code title={preview?.imageId}>
                        {preview?.imageId?.slice(0, 24) ?? "Not built"}
                      </code>
                    </dd>
                  </div>
                </dl>
                {previewControls}
                <p className="preview-note">
                  Uses <code>.env.prod</code> unless overridden. Preview may
                  connect to production services with those credentials. For an
                  isolated environment, set <code>DEPLOY_DESK_PREVIEW_ENV</code>
                  . Scrape-dependent pages may need{" "}
                  <code>bun run dev:stack</code> separately; container URLs
                  should use <code>host.docker.internal</code> for host
                  services.
                </p>
                {preview?.status === "running" && (
                  <button onClick={() => setFrame(!frame)}>
                    <ExternalLink size={14} />
                    {frame ? "Hide embedded preview" : "Show embedded preview"}
                  </button>
                )}
              </div>
              {frame && preview?.status === "running" && (
                <iframe
                  className="preview-frame"
                  title="Local NyumatFlix preview"
                  src={preview.url}
                  sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
                />
              )}
            </section>
          )}
          {(selectedJob || jobs.length > 0) && (
            <section className="panel job-panel">
              <header className="section-heading">
                <h2 className="inline">
                  <Terminal size={17} />
                  Activity
                </h2>
                <div className="inline">
                  <label className="sr-only" htmlFor="job-select">
                    Select job
                  </label>
                  <select
                    id="job-select"
                    value={selectedJob ?? ""}
                    onChange={(e) => setSelectedJob(e.target.value)}
                  >
                    {jobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.kind} · {relative(job.startedAt)}
                      </option>
                    ))}
                  </select>
                  {streamJob && (
                    <Badge
                      tone={
                        streamJob.status === "succeeded"
                          ? "success"
                          : streamJob.status === "failed"
                            ? "danger"
                            : ""
                      }
                    >
                      {streamJob.status}
                    </Badge>
                  )}
                </div>
              </header>
              <div className="job-phase">
                <span className="inline">
                  {running(streamJob) ? (
                    <LoaderCircle size={14} className="spin" />
                  ) : (
                    <Circle size={10} />
                  )}{" "}
                  {streamJob?.phase ?? "Connecting to logs…"}
                </span>
                <span className="muted">
                  {duration(
                    running(streamJob) && streamJob
                      ? tick - Date.parse(streamJob.startedAt)
                      : streamJob?.durationMs,
                  )}
                </span>
              </div>
              {streamError && <p className="inline-error">{streamError}</p>}
              <pre className="logs" aria-label="Job output" tabIndex={0}>
                {logs.join("\n") || "Waiting for output…"}
              </pre>
            </section>
          )}
          <footer className="desk-footer">
            <span>NyumatFlix Deploy Desk</span>
            <span>
              Refresh <kbd>r</kbd>
              <span className="separator">/</span>Local machine only
            </span>
          </footer>
        </main>
      </div>
      {confirmation && (
        <Dialog
          title="Deploy to production?"
          close={() => setConfirmation(null)}
        >
          <p className="muted">
            This will build and push an image, synchronize production
            configuration, and replace the live release on{" "}
            {status?.remote ?? "leetbot"}.
          </p>
          <div className="confirm-release">
            <code>
              {confirmation.shortSha}
              {confirmation.dirty ? "+" : ""}
            </code>
            <h3>{confirmation.message}</h3>
            <p className="muted">
              {confirmation.branch} · {confirmation.author}
            </p>
          </div>
          {skipPreview && (
            <div className="notice warning">
              The local preview gate is skipped for this deploy.
            </div>
          )}
          <footer className="dialog-actions">
            <button disabled={pending} onClick={() => setConfirmation(null)}>
              Cancel
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                void action("/api/deploy", {
                  confirmed: true,
                  fingerprint: confirmation.fingerprint,
                  fast,
                  skipPreview,
                })
              }
            >
              <Rocket size={15} />
              Deploy now
            </button>
          </footer>
        </Dialog>
      )}
      {detail && (
        <Dialog title="Deployment details" close={() => setDetail(null)}>
          <div className="confirm-release">
            <code>{detail.shortSha}</code>
            <h3>{detail.message}</h3>
            <p className="muted">
              {detail.author} · {relative(detail.deployedAt)}
            </p>
          </div>
          <dl className="detail-list">
            {Object.entries({
              SHA: detail.sha,
              Image: detail.image,
              Deployed: detail.deployedAt,
              Port: String(detail.port),
              Source: detail.source,
              Dirty: String(detail.dirty ?? detail.sha.endsWith("-dirty")),
            }).map(([name, value]) => (
              <div key={name}>
                <dt>{name}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={rollbackConfirmed}
              onChange={(e) => setRollbackConfirmed(e.target.checked)}
              disabled={busy}
            />
            I confirm replacing production with this deployment.
          </label>
          <p className="muted">
            Rollback uses the recorded image and the normal candidate health
            checks. Registry tags, especially dirty tags, can be overwritten;
            history is not a registry backup.
          </p>
          <footer className="dialog-actions">
            <button onClick={() => setDetail(null)}>Close</button>
            <button
              className="danger-button"
              disabled={busy || !rollbackConfirmed}
              onClick={() =>
                void action("/api/rollback", {
                  confirmed: true,
                  sha: detail.sha,
                  image: detail.image,
                  deployedAt: detail.deployedAt,
                })
              }
            >
              <RotateCcw size={15} />
              Roll back
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
