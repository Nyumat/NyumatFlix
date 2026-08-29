import { existsSync, lstatSync, symlinkSync } from "node:fs";

const links = [
  [".env.local", "../../.env.local"],
  [".env", "../../.env"],
];

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
