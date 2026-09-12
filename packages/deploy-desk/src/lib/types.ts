export type DeployEntry = {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  deployedAt: string;
  image: string;
  source: string;
  port: number;
  dirty?: boolean;
};

export type LiveDeploy = Omit<DeployEntry, "port">;

export type ServiceRow = {
  name: string;
  status: string;
  image: string;
};

export type GitMeta = {
  branch: string;
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  dirty: boolean;
  diffStat: string;
  changedFiles: number;
  fingerprint: string;
};

export type JobKind =
  | "deploy"
  | "rollback"
  | "preview-build"
  | "preview-start"
  | "preview-stop";

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export type Job = {
  id: string;
  kind: JobKind;
  status: JobStatus;
  phase: string;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  error?: string;
  logs: string[];
  logOffset: number;
};

export type PreviewState = {
  status: "idle" | "building" | "ready" | "starting" | "running" | "failed";
  port: number;
  url: string;
  image: string;
  imageId?: string;
  containerId?: string;
  health?: string;
  updatedAt?: string;
  fingerprint?: string;
  error?: string;
};
