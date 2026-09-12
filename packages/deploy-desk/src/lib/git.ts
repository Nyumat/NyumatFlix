import type { GitMeta } from "./types";
import { runSync } from "./process";
import { createHash } from "node:crypto";

const git = (...args: string[]) => {
  const result = runSync("git", args);
  if (!result.ok)
    throw new Error(result.stderr.trim() || `git ${args[0]} failed`);
  return result.stdout.trim();
};

export const getGitMeta = (): GitMeta => {
  const status = git("status", "--porcelain");
  const unstaged = git("diff", "--stat");
  const staged = git("diff", "--cached", "--stat");
  const diffStat =
    [unstaged, staged].filter(Boolean).join("\n") || "No tracked diff";
  const fingerprint = createHash("sha256")
    .update(git("rev-parse", "HEAD"))
    .update(git("diff", "HEAD", "--binary"))
    .update(status);
  const untracked = git("ls-files", "--others", "--exclude-standard", "-z")
    .split("\0")
    .filter(Boolean);
  for (const file of untracked)
    fingerprint.update(file).update(git("hash-object", "--", file));
  return {
    branch: git("branch", "--show-current") || "detached HEAD",
    sha: git("rev-parse", "HEAD"),
    shortSha: git("rev-parse", "--short=7", "HEAD"),
    message: git("log", "-1", "--pretty=format:%s"),
    author: git("log", "-1", "--pretty=format:%an"),
    dirty: status.length > 0,
    diffStat,
    changedFiles: status ? status.split("\n").length : 0,
    fingerprint: fingerprint.digest("hex"),
  };
};

export const resolveDeployIdentity = (meta: GitMeta) => ({
  sha: meta.dirty ? `${meta.sha}-dirty` : meta.sha,
  shortSha: meta.dirty ? `${meta.shortSha}+` : meta.shortSha,
  message: meta.dirty ? `${meta.message} (uncommitted)` : meta.message,
  author: meta.author,
  source: "local",
  dirty: meta.dirty,
});
