import {
  existsSync,
  lstatSync,
  readlinkSync,
  symlinkSync,
  unlinkSync,
} from "node:fs";

const links = [
  [".env.local", "../../.env.local"],
  [".env", "../../.env"],
];

const removeBrokenSymlink = (target) => {
  try {
    const stat = lstatSync(target);
    if (!stat.isSymbolicLink()) {
      return;
    }
    const linkTarget = readlinkSync(target);
    if (!existsSync(linkTarget)) {
      unlinkSync(target);
      console.log(`[ensure-env] removed broken symlink ${target}`);
    }
  } catch {
    // target does not exist
  }
};

if (process.env.SKIP_ENSURE_ENV === "1") {
  for (const [target] of links) {
    removeBrokenSymlink(target);
  }
  console.log("[ensure-env] skipped (SKIP_ENSURE_ENV)");
  process.exit(0);
}

for (const [target] of links) {
  removeBrokenSymlink(target);
}

for (const [target, source] of links) {
  if (existsSync(target)) {
    continue;
  }
  if (!existsSync(source)) {
    continue;
  }
  try {
    symlinkSync(source, target);
    console.log(`[ensure-env] linked ${target} -> ${source}`);
  } catch (error) {
    console.warn(`[ensure-env] could not link ${target}:`, error);
  }
}
