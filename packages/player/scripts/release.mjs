#!/usr/bin/env node
/**
 * Unified release orchestrator for movi-player.
 *
 * The player bundle (dist/element.js) ships into four surfaces that each used to
 * need their own build run:
 *   - web app        (Cloudflare Worker + R2)
 *   - chrome-extension
 *   - vscode-extension
 *   - desktop app    (Electron)
 * This script bumps the version everywhere, builds element.js ONCE, and fans it
 * out to every target — so a release is a single command.
 *
 * Usage:
 *   node scripts/release.mjs <patch|minor|major|X.Y.Z> [flags]
 *   npm run release -- minor
 *   npm run release -- 0.3.5 --package
 *
 * Flags:
 *   --wasm            also rebuild the WASM (docker); default reuses dist/wasm
 *   --targets=a,b     limit sync to a subset of: chrome,vscode,desktop  (default: all)
 *   --package         build distributables: .vsix (vscode) + versioned .zip (chrome)
 *   --dist            build desktop installers (electron-builder — slow)
 *   --deploy          deploy the web app (harden + R2 upload + worker deploy) — OUTWARD
 *   --commit          git add + commit locally (no push). Off by default.
 *   --dry             print the plan and version changes without doing anything
 *
 * Safe by default: bumps versions + builds + syncs local targets. It never
 * publishes, pushes, or deploys unless you explicitly pass --deploy / --commit.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const rootPkgPath = join(ROOT, "package.json");

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const positional = args.filter((a) => !a.startsWith("--") && !a.startsWith("-"));
const DRY = flags.has("--dry");
const targetsArg = args.find((a) => a.startsWith("--targets="));
const TARGETS = targetsArg
  ? targetsArg.slice("--targets=".length).split(",").map((s) => s.trim())
  : ["chrome", "vscode", "desktop"];

const C = {
  b: (s) => `\x1b[1m${s}\x1b[0m`,
  g: (s) => `\x1b[32m${s}\x1b[0m`,
  y: (s) => `\x1b[33m${s}\x1b[0m`,
  r: (s) => `\x1b[31m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

function die(msg) {
  console.error(C.r(`\n✗ ${msg}\n`));
  process.exit(1);
}

function step(msg) {
  console.log(C.b(`\n▶ ${msg}`));
}

function run(cmd, opts = {}) {
  console.log(C.dim(`  $ ${cmd}`));
  if (DRY) return;
  execSync(cmd, { stdio: "inherit", cwd: ROOT, ...opts });
}

function printHelp() {
  const cur = (() => {
    try {
      return JSON.parse(readFileSync(rootPkgPath, "utf8")).version;
    } catch {
      return "?";
    }
  })();
  console.log(`
${C.b("movi-player release")} ${C.dim("— bump the version everywhere, build element.js once, fan it out")}

${C.b("Usage")}
  npm run release -- <${C.g("patch")}|${C.g("minor")}|${C.g("major")}|${C.g("X.Y.Z")}> [flags]
  node scripts/release.mjs <patch|minor|major|X.Y.Z> [flags]

${C.b("Version")}  ${C.dim("(current: " + cur + ")")}
  patch          x.y.${C.g("z+1")}        minor   x.${C.g("y+1")}.0        major   ${C.g("x+1")}.0.0
  X.Y.Z          set an explicit version (unifies all packages, even drifted ones)

${C.b("Flags")}
  --dry              preview the plan + version changes; write nothing
  --wasm             also rebuild the WASM (docker); default reuses dist/wasm
  --targets=a,b      limit sync to a subset of ${C.dim("chrome,vscode,desktop")} ${C.dim("(default: all)")}
  --package          build distributables: .vsix (vscode) + versioned .zip (chrome)
  --dist             build desktop installers (electron-builder — slow)
  --deploy           deploy the web app (harden + R2 upload + worker) ${C.y("— OUTWARD")}
  --commit           git add + commit locally ${C.dim("(no push)")}. Off by default.
  -h, --help         show this help

${C.b("Bumps")}     ${C.dim("package.json · desktop · vscode-extension · chrome-extension/manifest (+ locks)")}
${C.b("Stamps")}    ${C.dim("CHANGELOG + docs/changelog ([Unreleased] → version) · VitePress nav · app JSON-LD")}
${C.b("Builds")}    ${C.dim("element.js once → chrome-extension/dist · vscode webview/dist · desktop vendor")}
${C.b("Safe")}      ${C.dim("never publishes/pushes/deploys unless you pass --deploy / --commit")}

${C.b("Examples")}
  npm run release -- minor --dry          ${C.dim("# preview a minor bump")}
  npm run release -- patch                ${C.dim("# bump + build + sync all targets")}
  npm run release -- 0.4.0 --package      ${C.dim("# + build .vsix and chrome .zip")}
  npm run release -- minor --targets=vscode --package
  npm run release -- patch --deploy       ${C.dim("# also push the web app live")}
`);
}

if (
  args.length === 0 ||
  args.includes("--help") ||
  args.includes("-h") ||
  positional[0] === "help"
) {
  printHelp();
  process.exit(0);
}

// ── Version resolution ──────────────────────────────────────────────────────
const current = JSON.parse(readFileSync(rootPkgPath, "utf8")).version;
const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(current || "");
if (!m) die(`Root package.json version "${current}" is not X.Y.Z`);
const [maj, min, pat] = m.slice(1).map(Number);

const spec = positional[0];
if (!spec) {
  die(
    "Missing version. Pass patch | minor | major | X.Y.Z\n" +
      "  e.g. node scripts/release.mjs minor",
  );
}
let next;
if (spec === "patch") next = `${maj}.${min}.${pat + 1}`;
else if (spec === "minor") next = `${maj}.${min + 1}.0`;
else if (spec === "major") next = `${maj + 1}.0.0`;
else if (/^\d+\.\d+\.\d+$/.test(spec)) next = spec;
else die(`Invalid version spec "${spec}" — use patch | minor | major | X.Y.Z`);

if (next === current && spec.includes(".")) {
  console.log(C.y(`\n! ${next} equals the current version — re-releasing.`));
}

console.log(C.b("\nmovi-player release"));
console.log(`  ${current}  →  ${C.g(next)}`);
console.log(`  targets: ${TARGETS.join(", ")}`);
console.log(
  `  build:  build:ts${flags.has("--wasm") ? " + build:wasm" : ""}` +
    `${flags.has("--package") ? " + package" : ""}` +
    `${flags.has("--dist") ? " + desktop installers" : ""}` +
    `${flags.has("--deploy") ? " + web deploy" : ""}`,
);
if (DRY) console.log(C.y("  (dry run — nothing will be written)"));

// ── Bump version everywhere ─────────────────────────────────────────────────
/** The file's own current version — read from JSON so drifted packages (e.g. a
 *  vscode-extension already ahead) still get unified to `next`, not skipped. */
function ownVersion(txt) {
  try {
    const v = JSON.parse(txt).version;
    if (v) return v;
  } catch {
    /* fall through to regex for non-strict JSON */
  }
  const mm = /"version"\s*:\s*"([^"]+)"/.exec(txt);
  return mm ? mm[1] : null;
}

/** Replace the FIRST `"version": "<own>"` in a JSON file (package.json /
 *  manifest.json) with `next` — preserves the file's formatting. Drift-tolerant. */
function bumpJsonVersion(relPath) {
  const p = join(ROOT, relPath);
  if (!existsSync(p)) return console.log(C.y(`  ~ skip (missing): ${relPath}`));
  const txt = readFileSync(p, "utf8");
  const own = ownVersion(txt);
  if (!own) return console.log(C.y(`  ~ ${relPath}: no version field`));
  if (own === next) return console.log(C.dim(`  = ${relPath} already ${next}`));
  const re = new RegExp(`("version"\\s*:\\s*")${escapeRe(own)}(")`);
  const out = txt.replace(re, `$1${next}$2`);
  if (!DRY) writeFileSync(p, out);
  console.log(C.g(`  ✓ ${relPath}  ${C.dim(own + " →")} ${next}`));
}

/** Bump only the top-level + packages[""] version in a package-lock.json (its
 *  first two "version" fields, both equal to that lock's own package version). */
function bumpLockVersion(relPath) {
  const p = join(ROOT, relPath);
  if (!existsSync(p)) return;
  const txt = readFileSync(p, "utf8");
  const own = ownVersion(txt);
  if (!own || own === next) return;
  const re = new RegExp(`("version"\\s*:\\s*")${escapeRe(own)}(")`, "g");
  let n = 0;
  const out = txt.replace(re, (full, a, b) => (n++ < 2 ? `${a}${next}${b}` : full));
  if (n > 0 && !DRY) writeFileSync(p, out);
  if (n > 0) console.log(C.g(`  ✓ ${relPath} ${C.dim(`(${Math.min(n, 2)} field${n > 1 ? "s" : ""})`)}`));
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Release date (local YYYY-MM-DD) + changelog/VitePress anchor for `next`.
const today = (() => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
})();
const anchor = next.replace(/\./g, "-"); // 0.4.0 → 0-4-0

/**
 * Keep-a-Changelog: rename the `## [Unreleased]` section to the new version +
 * date and open a fresh empty Unreleased above it. Warns when there were no
 * accumulated notes (an empty release is almost always a mistake).
 */
function stampChangelog(relPath) {
  const p = join(ROOT, relPath);
  if (!existsSync(p)) return console.log(C.y(`  ~ skip (missing): ${relPath}`));
  const txt = readFileSync(p, "utf8");
  const re = /^## \[Unreleased\][^\n]*\n/m;
  if (!re.test(txt)) {
    return console.log(C.y(`  ~ ${relPath}: no "## [Unreleased]" section`));
  }
  const body = txt.split(re)[1] || "";
  const nextSec = body.search(/\n## \[/);
  const notes = (nextSec >= 0 ? body.slice(0, nextSec) : body).trim();
  if (!notes) {
    console.log(C.y(`  ! ${relPath}: Unreleased is EMPTY — add notes before releasing`));
  }
  const out = txt.replace(re, `## [Unreleased]\n\n## [${next}] - ${today}\n`);
  if (!DRY) writeFileSync(p, out);
  console.log(C.g(`  ✓ ${relPath}  ${C.dim("[Unreleased] →")} [${next}] - ${today}`));
}

/** VitePress nav: bump the version-dropdown label and mark the new version
 *  "(Latest)" in the Versions list, demoting the previous latest. */
function bumpDocsConfig(relPath = "docs/.vitepress/config.mts") {
  const p = join(ROOT, relPath);
  if (!existsSync(p)) return console.log(C.y(`  ~ skip (missing): ${relPath}`));
  let txt = readFileSync(p, "utf8");
  txt = txt.replace(/text:\s*"v\d+\.\d+\.\d+"/, `text: "v${next}"`); // dropdown label
  const latestRe =
    /(\n\s*)\{ text: "v(\d+\.\d+\.\d+) \(Latest\)", link: "([^"]+)" \},/;
  const mm = latestRe.exec(txt);
  if (mm && mm[2] !== next) {
    const [, ind, oldV, oldLink] = mm;
    txt = txt.replace(
      latestRe,
      `${ind}{ text: "v${next} (Latest)", link: "/changelog#${anchor}" },` +
        `${ind}{ text: "v${oldV}", link: "${oldLink}" },`,
    );
  }
  if (!DRY) writeFileSync(p, txt);
  console.log(C.g(`  ✓ ${relPath} ${C.dim("(nav label + Latest)")}`));
}

/** Web app JSON-LD softwareVersion (drift-tolerant). */
function bumpAppMeta(relPath = "app/index.html") {
  const p = join(ROOT, relPath);
  if (!existsSync(p)) return;
  const txt = readFileSync(p, "utf8");
  const re = /("softwareVersion"\s*:\s*")\d+\.\d+\.\d+(")/;
  if (!re.test(txt)) return;
  if (!DRY) writeFileSync(p, txt.replace(re, `$1${next}$2`));
  console.log(C.g(`  ✓ ${relPath} ${C.dim("(softwareVersion)")}`));
}

step(`Bump version → ${next}`);
bumpJsonVersion("package.json");
bumpJsonVersion("desktop/package.json");
bumpJsonVersion("vscode-extension/package.json");
bumpJsonVersion("chrome-extension/manifest.json");
bumpLockVersion("package-lock.json");
bumpLockVersion("desktop/package-lock.json");
bumpLockVersion("vscode-extension/package-lock.json");

// ── Changelog + docs + web metadata ─────────────────────────────────────────
step(`Update changelog + docs → ${next} (${today})`);
stampChangelog("CHANGELOG.md");
stampChangelog("docs/changelog.md");
bumpDocsConfig();
bumpAppMeta();
// README carries no pinned version (npm badge + jsdelivr are dynamic) — nothing
// to bump there; noted so a future pinned reference isn't silently missed.
console.log(C.dim("  = README.md: no pinned version (npm/jsdelivr dynamic)"));

// ── Build the player bundle ONCE ────────────────────────────────────────────
step("Build player bundle (dist/element.js)");
if (flags.has("--wasm")) run("npm run build:wasm");
run("npm run build:ts");

// ── Fan out element.js to every target ──────────────────────────────────────
// Each target's build.sh honours SKIP_BUILD=1 so the bundle isn't rebuilt N×.
if (TARGETS.includes("chrome")) {
  step("Sync → chrome-extension");
  run("bash chrome-extension/build.sh", { env: { ...process.env, SKIP_BUILD: "1" } });
}
if (TARGETS.includes("vscode")) {
  step("Sync → vscode-extension (copy + compile)");
  run("bash vscode-extension/build.sh", { env: { ...process.env, SKIP_BUILD: "1" } });
}
if (TARGETS.includes("desktop")) {
  step("Sync → desktop app (renderer/vendor/element.js)");
  run("node desktop/scripts/sync-assets.mjs");
}

// ── Optional: build distributables ──────────────────────────────────────────
if (flags.has("--package")) {
  if (TARGETS.includes("vscode")) {
    step("Package vscode-extension (.vsix)");
    run("npx vsce package", { cwd: join(ROOT, "vscode-extension") });
  }
  if (TARGETS.includes("chrome")) {
    step(`Package chrome-extension → movi-player-${next}.zip`);
    // Zip the whole loadable extension (manifest + scripts + synced dist/ +
    // icons); exclude prior release zips, node_modules and OS cruft.
    run(
      `bash -c 'cd chrome-extension && rm -f movi-player-${next}.zip && ` +
        `zip -r -q movi-player-${next}.zip . ` +
        `-x "*.zip" "node_modules/*" "*.DS_Store" && ` +
        `echo "  zipped movi-player-${next}.zip ($(du -h movi-player-${next}.zip | cut -f1))"'`,
    );
  }
}

// ── Optional: desktop installers ────────────────────────────────────────────
if (flags.has("--dist") && TARGETS.includes("desktop")) {
  step("Build desktop installers (electron-builder)");
  run("npm run dist", { cwd: join(ROOT, "desktop") });
}

// ── Optional: deploy web app (OUTWARD) ──────────────────────────────────────
if (flags.has("--deploy")) {
  step("Deploy web app (harden + R2 upload + worker deploy)");
  run("npm run app:upload");
  run("npm run app:deploy");
}

// ── Optional: local commit (never pushes) ───────────────────────────────────
if (flags.has("--commit")) {
  step(`Commit v${next} locally (no push)`);
  run("git add -A");
  run(`git commit -m "chore(release): ${next}"`);
}

// ── Summary + next steps ────────────────────────────────────────────────────
console.log(C.b(`\n✓ Release ${next} prepared${DRY ? " (dry run)" : ""}.`));
const todo = [];
if (!flags.has("--package"))
  todo.push("package distributables:  npm run release -- " + next + " --package");
todo.push("write the release notes under ## [Unreleased] BEFORE bumping (the script stamps them)");
if (!flags.has("--commit")) todo.push('commit:  git add -A && git commit -m "chore(release): ' + next + '"');
if (!flags.has("--deploy")) todo.push("deploy web:  npm run app:release   (outward)");
todo.push("publish vsix / chrome zip manually (outward)");
console.log(C.dim("\nnext steps:"));
todo.forEach((t) => console.log(C.dim("  • " + t)));
console.log("");
