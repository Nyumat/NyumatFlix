/**
 * Post-build hardening pass for dist/element.js. The standalone build
 * already runs terser but with conservative settings (preserving class
 * names, skipping top-level mangle) so library consumers can reason
 * about the module. The deployed app bundle should be much harder to
 * reverse-engineer — this pass re-minifies dist/element.js with:
 *
 *   - top-level identifier mangling
 *   - property mangling on non-reserved names
 *   - multiple optimizer passes
 *
 * The WebCodecs / Emscripten / public attribute names listed in
 * `reserved` are preserved so the web component still works at
 * runtime. Everything else gets shortened.
 */

import { readFileSync, writeFileSync, statSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { minify } from "terser";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const target = resolve(root, "dist/element.js");

const RESERVED_IDENTIFIERS = [
  // Emscripten / WASM boundary
  "Module", "FS", "HEAP", "HEAPU8", "HEAPU16", "HEAPU32",
  "HEAP8", "HEAP16", "HEAP32", "HEAPF32", "HEAPF64",
  "createMoviModule", "locateFile", "wasmBinary",
  // Public API
  "Movi", "MoviPlayer", "MoviElement", "customElements",
  // Common DOM / browser globals touched dynamically
  "navigator", "document", "window", "globalThis",
  // WebCodecs — these are referenced via string lookups in a few spots
  "VideoDecoder", "VideoEncoder", "AudioDecoder", "AudioEncoder",
  "EncodedVideoChunk", "EncodedAudioChunk", "VideoFrame", "AudioData",
];

const RESERVED_PROP_NAMES = [
  // Standard lifecycle / attribute hooks exposed to external JS
  "connectedCallback", "disconnectedCallback", "attributeChangedCallback",
  "observedAttributes", "adoptedCallback",
  // Public methods / properties used from index.html
  "src", "videoId", "videoUrl", "tokenUrl", "videourl", "tokenurl",
  "videoid", "sessiontoken", "encrypted", "postertime", "poster",
  "renderer", "controls", "autoplay", "play", "pause", "load",
  "dispose", "currentTime", "duration", "volume", "muted", "playbackRate",
  "buffered", "playing", "paused", "ended", "seeking", "networkState",
  "readyState", "error", "isMovi", "setAttribute", "removeAttribute",
  "getAttribute", "hasAttribute", "addEventListener", "removeEventListener",
  "dispatchEvent",
];

async function harden() {
  try {
    statSync(target);
  } catch {
    console.error(`[harden-element] ${target} not found — run build first.`);
    process.exit(1);
  }

  // Diagnostic bypass — set MOVI_NO_HARDEN=1 to ship dist/element.js
  // untouched. Used when investigating whether the post-build terser
  // pass is what changes runtime behaviour vs the dev server.
  if (process.env.MOVI_NO_HARDEN === "1") {
    console.log("[harden-element] MOVI_NO_HARDEN=1 — skipping minify pass");
    return;
  }

  const src = readFileSync(target, "utf8");
  console.log(`[harden-element] Input: ${src.length.toLocaleString()} bytes`);

  const result = await minify(src, {
    compress: {
      passes: 3,
      drop_console: true,
      drop_debugger: true,
      pure_getters: true,
      unsafe: false,
      booleans_as_integers: false,
    },
    mangle: {
      // Only local-variable mangling. Property mangling is explicitly
      // OFF: a combined bundle of MoviPlayer + hls.js + FFmpeg WASM
      // glue has too many `"_foo"` string literals handed to event
      // dispatchers / EventEmitter.on calls that terser's static
      // analysis cannot connect to the `obj._foo` accesses on the
      // other end. Renaming only one side breaks the callback
      // wire-up and surfaces as cryptic runtime "X is not a function"
      // errors. Toplevel / class / function name mangling is also
      // off for the same reason — third-party dispatch that relies
      // on Function.name or constructor identity would break. What
      // remains still buys most of the hardening value: console.log
      // removal + multi-pass dead-code + expression compression +
      // shorter local variables.
      keep_classnames: true,
      keep_fnames: true,
      reserved: RESERVED_IDENTIFIERS,
      properties: false,
    },
    format: {
      comments: false,
      ascii_only: false,
      beautify: false,
    },
  });

  if (!result.code) {
    throw new Error("terser returned empty output");
  }

  writeFileSync(target, result.code, "utf8");
  console.log(`[harden-element] Output: ${result.code.length.toLocaleString()} bytes (${(
    (result.code.length / src.length) * 100
  ).toFixed(1)}% of input)`);
}

harden().catch((err) => {
  console.error("[harden-element] Failed:", err);
  process.exit(1);
});
