import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const repoRoot = join(import.meta.dirname, "..", "..", "..");
const scriptPath = join(repoRoot, "apps/web/scripts/ensure-env.mjs");

type Fixture = {
  root: string;
  webDir: string;
  cleanup: () => void;
};

const createFixture = (): Fixture => {
  const root = mkdtempSync(join(tmpdir(), "ensure-env-"));
  const webDir = join(root, "apps", "web");
  mkdirSync(webDir, { recursive: true });
  return {
    root,
    webDir,
    cleanup: () => {
      rmSync(root, { recursive: true, force: true });
    },
  };
};

const runEnsureEnv = (
  webDir: string,
  env: Record<string, string | undefined> = {},
) =>
  spawnSync("node", [scriptPath], {
    cwd: webDir,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });

describe("ensure-env", () => {
  const fixtures: Fixture[] = [];

  afterEach(() => {
    while (fixtures.length > 0) {
      fixtures.pop()?.cleanup();
    }
  });

  it("links repo-root env files into apps/web for local dev", () => {
    const fixture = createFixture();
    fixtures.push(fixture);

    writeFileSync(join(fixture.root, ".env"), "TMDB_API_KEY=test\n");
    writeFileSync(join(fixture.root, ".env.local"), "AUTH_SECRET=test\n");

    const result = runEnsureEnv(fixture.webDir);
    expect(result.status).toBe(0);

    const envLink = join(fixture.webDir, ".env");
    const envLocalLink = join(fixture.webDir, ".env.local");
    expect(lstatSync(envLink).isSymbolicLink()).toBe(true);
    expect(lstatSync(envLocalLink).isSymbolicLink()).toBe(true);
    expect(readlinkSync(envLink)).toBe("../../.env");
    expect(readlinkSync(envLocalLink)).toBe("../../.env.local");
    expect(existsSync(envLink)).toBe(true);
    expect(existsSync(envLocalLink)).toBe(true);
  });

  it("removes broken env symlinks instead of leaving next build to fail", () => {
    const fixture = createFixture();
    fixtures.push(fixture);

    symlinkSync("../../.env", join(fixture.webDir, ".env"));

    const result = runEnsureEnv(fixture.webDir);
    expect(result.status).toBe(0);
    expect(existsSync(join(fixture.webDir, ".env"))).toBe(false);
  });

  it("skips linking when SKIP_ENSURE_ENV is set (container builds)", () => {
    const fixture = createFixture();
    fixtures.push(fixture);

    writeFileSync(join(fixture.root, ".env"), "TMDB_API_KEY=test\n");
    symlinkSync("../../missing.env", join(fixture.webDir, ".env"));

    const result = runEnsureEnv(fixture.webDir, { SKIP_ENSURE_ENV: "1" });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("skipped (SKIP_ENSURE_ENV)");
    expect(existsSync(join(fixture.webDir, ".env"))).toBe(false);
  });
});
