import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const source = path.join(root, "node_modules/movi-player/dist/element.js");
const targetDir = path.join(root, "public/vendor/movi-player");
const target = path.join(targetDir, "element.js");

const tabindexBug =
  /this\.hasAttribute\("tabindex"\)\s*\|\|\s*this\.setAttribute\("tabindex",\s*"0"\)/g;

// movi syncs clock to audio for gaps ≤200ms after seek, which leaves video
// frozen on the pre-seek frame while audio/time advance. force video-first.
const postSeekAudioFirstSync =
  /const t3 = 0\.2;\s*let n3 = A2, b3 = false;\s*if \(this\.pendingAudioPackets\.length > 0\)/;

if (!fs.existsSync(source)) {
  console.warn("[prepare-movi-player] movi-player not installed, skipping");
  process.exit(0);
}

let code = fs.readFileSync(source, "utf8");
let patches = 0;

if (tabindexBug.test(code)) {
  tabindexBug.lastIndex = 0;
  code = code.replace(tabindexBug, "void 0");
  patches += 1;
}

if (postSeekAudioFirstSync.test(code)) {
  postSeekAudioFirstSync.lastIndex = 0;
  code = code.replace(
    postSeekAudioFirstSync,
    "const t3 = 0; let n3 = A2, b3 = false; if (this.pendingAudioPackets.length > 0)",
  );
  patches += 1;
} else {
  console.warn(
    "[prepare-movi-player] post-seek audio-first sync pattern not found — movi version may have changed",
  );
}

fs.mkdirSync(targetDir, { recursive: true });
fs.writeFileSync(target, code);
console.log(
  `[prepare-movi-player] wrote ${path.relative(root, target)} (${patches} patches)`,
);
