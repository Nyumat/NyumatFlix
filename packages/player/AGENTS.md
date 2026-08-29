# AGENTS.md — `movi-player` for AI coding assistants

This file orients an AI assistant (Claude, Cursor, Codex, Copilot, …) that has just been pointed at the `movi-player` repo or has it installed as a dependency. It is **not** end-user documentation — see [README.md](./README.md) and [https://moviplayer.com](https://moviplayer.com) for that. The intent here is to make the assistant useful for debugging, extending, and integrating the player without re-discovering the architecture every conversation.

If you are an AI assistant: read this top to bottom once, then refer back by section when you take an action that touches the player.

---

## 1. What this is

`movi-player` is a browser video player that plays formats the native `<video>` element can't: MKV, HEVC, AV1, 4K HDR, multi-audio, embedded subtitles, encrypted streams. It does this with:

- **FFmpeg (libavformat) compiled to WebAssembly** for demuxing arbitrary container formats.
- **WebCodecs API** (Chrome, Safari 18+, Firefox 130+) for hardware-accelerated decoding when available, software dav1d/de265 in WASM as fallback.
- **Canvas/WebGL2** for presentation (the spec for `<canvas>` lets you render HDR via `display-p3` color space; native `<video>` can't expose that on most browsers).

Shipped as a web component (`<movi-player>`) plus three lower-level entry points (`/player`, `/demuxer`) for programmatic use. License: Apache-2.0.

The same engine ships in three wrappers built on the web component: an Electron **desktop app** (`desktop/`, Win/Mac/Linux — local files, URLs, native always-on-top PiP, playlist), a **Chrome extension** (`chrome-extension/`), and a **VS Code extension** (`vscode-extension/`).

---

## 2. Package entry points

Set in `package.json`. Three bundle tiers, picked by import path:

| Import | Bundle size | What you get |
|--------|-------------|--------------|
| `movi-player` or `movi-player/element` | ~410 KB | Full web component including all controls, gestures, ambient mode, subtitle rendering, chapters, etc. |
| `movi-player/player` | ~180 KB | `MoviPlayer` class — programmatic playback orchestration without UI. Bring your own canvas + controls. |
| `movi-player/demuxer` | ~45 KB | `Demuxer`, source adapters, decoders. For metadata extraction, thumbnail generation, manual pipelines. |

WASM blob (`dist/wasm/*.wasm`) is loaded lazily on first use and shared across instances (~2 MB compressed).

The three entry points re-export progressively more of the codebase. `element` re-exports everything in `player`, which re-exports everything in `demuxer`. So `import { Demuxer } from 'movi-player'` works too — it's just bigger.

---

## 3. Architecture map

Reading order if you've never touched this code:

```
src/
├── element.ts                 — entry, re-exports MoviElement
├── player.ts                  — entry, re-exports MoviPlayer
├── demuxer.ts                 — entry, re-exports Demuxer
├── index.ts                   — top-level entry (re-exports element.ts)
├── types.ts                   — public TypeScript types (start here)
│
├── render/
│   ├── MoviElement.ts         (~15k lines) Web component. UI, attributes,
│   │                          events, keyboard, gestures, menus, ambient
│   │                          mode, subtitles overlay, theming. Wraps a
│   │                          MoviPlayer instance.
│   ├── CanvasRenderer.ts      WebGL2 video presentation. HDR via display-p3
│   │                          on Chromium; PQ tone-map shader elsewhere.
│   │                          Owns the frame queue and A/V sync.
│   ├── AudioRenderer.ts       Web Audio scheduling, Signalsmith stretcher
│   │                          for non-1x rates, stable-audio compressor.
│   └── HLSPlayerWrapper.ts    Delegates to hls.js for HLS sources, with a
│                              compatible API surface.
│
├── core/
│   ├── MoviPlayer.ts          (~4500 lines) The orchestrator: load, play,
│   │                          pause, seek, demux loop, decoder wiring,
│   │                          backpressure, A/V sync, state machine.
│   ├── PlayerState.ts         State machine: idle → loading → ready →
│   │                          playing ⇄ paused ⇄ seeking ⇄ buffering →
│   │                          ended | error.
│   ├── Clock.ts               Media-time clock with playbackRate support.
│   ├── TrackManager.ts        Active video/audio/subtitle track selection.
│   └── PlaybackController.ts  High-level play/pause coordination.
│
├── demux/Demuxer.ts           Thin wrapper over WasmBindings.demux.
│
├── decode/
│   ├── VideoDecoder.ts        Hardware-first WebCodecs decoder with
│   │                          extensive fallback chain (color-space strip,
│   │                          HEVC Rext profile retries, software dav1d).
│   ├── AudioDecoder.ts        WebCodecs audio. Opus is force-software
│   │                          (WebCodecs chokes on Opus packet gaps).
│   ├── SoftwareVideoDecoder.ts  WASM dav1d/de265 path.
│   ├── SoftwareAudioDecoder.ts  WASM Opus/AAC path.
│   ├── SubtitleDecoder.ts     SRT/ASS/SSA/WebVTT/PGS parsing.
│   └── CodecParser.ts         Extradata → WebCodecs codec string. Knows
│                              hvcC, avcC, AV1 OBU sequence headers.
│
├── source/
│   ├── SourceAdapter.ts       Interface: read(offset, length) → bytes.
│   ├── FileSource.ts          Local File / Blob (LRU-cached chunked reads).
│   ├── HttpSource.ts          Range-request streaming with prefetch.
│   ├── ThumbnailHttpSource.ts Lighter variant for poster/thumbnail use.
│   └── EncryptedHttpSource.ts Token-gated DRM-lite ciphered streams.
│
├── cache/LRUCache.ts          Shared 520 MB byte cache for source reads.
├── wasm/
│   ├── FFmpegLoader.ts        Loads the WASM module (lazy, idempotent).
│   ├── bindings.ts            Typed wrapper around exported C functions.
│   └── types.ts               WASM module ABI types.
├── events/EventEmitter.ts     Internal typed event bus.
└── utils/                     Logger, Time, Fingerprint, ThumbnailRenderer.
```

`MoviElement` is the public-facing thing. `MoviPlayer` is where the work happens. Most bugs touch one of the two; the rest of the tree changes rarely.

---

## 4. The web component — `<movi-player>`

### 4.1 Attributes

All observed attributes are listed in `MoviElement.observedAttributes` (around [src/render/MoviElement.ts:257](src/render/MoviElement.ts#L257)). Grouped:

**Source**
- `src` — File, URL string, or HLS manifest URL. Setting this triggers load.
- `crossorigin` — observed but currently a no-op (MoviPlayer's HttpSource doesn't take a CORS hint yet). Don't rely on it.
- `encrypted` / `tokenurl` / `videourl` / `videoid` / `drm` / `licenseurl` — encrypted source config.

**Playback**
- `autoplay`, `loop`, `muted`, `playsinline`, `controls`, `preload`
- `volume` (0–1), `playbackrate` (0.25–2, clamped to 1.5 for 4K+ sources)
- `startat` — seconds to seek to on load
- `loop`, `fastseek`, `doubletap`

**UI**
- `theme` (`"dark"` / `"light"`), `themecolor`, `title`, `showtitle`
- `objectfit` (`"contain"` / `"cover"` / `"fill"` / `"control"`)
- `nohotkeys`, `gesturefs` (gesture-driven fullscreen on mobile)
- `thumb` — enable scrubber thumbnail previews
- `poster` (URL) / `postertime` (e.g. `"10%"`, `"01:30"`, `"45"`) — `postertime` generates a poster from a frame in an isolated pipeline; first-load only.

**Subtitles**
- `subtitlesize` (px), `subtitlecolor`, `subtitlebg`, `subtitleedge`, `subtitledelay` (s)

**Layout**
- `width`, `height` — explicit dimensions (CSS values). Like `<video>`, set on the host element.

**Other**
- `ambientmode` + `ambientwrapper="<element-id>"` — paint average frame color as a blurred glow on the given element. **Heavy** on mobile (see §7).
- `resume` — persist + restore playback position via `localStorage`.
- `stablevolume` — DynamicsCompressor for loudness normalization.
- `renderer` (`"canvas"` — only supported value today)
- `sw` — force software decoding (debug aid).
- `fps` — override frame rate for unusual sources.
- `hdr` — force HDR pipeline on (auto-detected from primaries normally).
- `buffersize` (MB) — LRU cache size override.
- `vr` / `vrpad` — immersive projection (360 / 180 / fisheye / `sbs`(3d) / `littleplanet`), WebGL2 raycast in `CanvasRenderer` with a spring-animated camera. Auto-enters from the source's spherical metadata (`StreamInfo.projection` from the WASM demuxer); the attribute only forces/overrides it. `vrpad` adds an on-screen joystick.
- `audiooutput` — route audio to an output device via `AudioContext.setSinkId` in `AudioRenderer`. Accepts a `deviceId` or a label substring (ids are session-salted). `""`/`"default"` = system default.

**Authoritative list:** `MoviElement.observedAttributes` ([src/render/MoviElement.ts:257](src/render/MoviElement.ts#L257)) is the source of truth — if it's not in there, the element ignores it.

### 4.2 Methods + properties

`MoviElement` exposes a partial `HTMLMediaElement`-like surface:

- Methods: `play()`, `pause()`, `requestFullscreen()`, `requestPictureInPicture()`
- Getters: `src`, `currentTime`, `duration`, `paused`, `ended`, `volume`, `muted`, `playbackRate`, `subtitleDelay`
- Setters: `src`, `currentTime`, `volume`, `muted`, `playbackRate`, `subtitleDelay`

Tracks are **not** exposed as `el.audioTracks` getters. Reach through the underlying player:

```ts
const el = document.querySelector("movi-player");
const audio = el.player.getAudioTracks();
const subs  = el.player.getSubtitleTracks();
el.player.setAudioTrack(audio[1].id);
el.player.setSubtitleTrack(subs[0].id);
```

Subscribe to `trackschange` / `audiotrackchange` / `subtitletrackchange` events to react to changes (e.g. when a new media file finishes loading and tracks become available).

Audio **output device** routing has a fuller surface on the element: `getAudioOutputs()` (enumerate), `setAudioOutput(deviceId | labelSubstring)`, `getAudioOutput()` — these resolve labels and update the right-click "Audio Output" menu, then forward to `player.setAudioOutputDevice()` → `AudioRenderer.setSinkId()`. The core (`MoviPlayer`) only has the raw `setAudioOutputDevice()` / `getAudioOutputDevice()`.

### 4.3 Events

Dispatched on the `<movi-player>` element. Names follow `HTMLMediaElement` conventions where there's a sensible match; the rest are custom.

**Standard-style (no detail unless noted):**
- `play`, `pause`, `ended` — playback transitions
- `loadstart` (`detail: { src }`) — new source assigned
- `loadeddata` — first frame ready
- `timeupdate` (`detail: <seconds>`) — current time tick
- `volumechange` (`detail: { volume, muted }`)
- `ratechange` (`detail: { playbackRate }`)
- `error` (`detail: Error`)

**Custom:**
- `statechange` (`detail: PlayerState`) — the internal state machine (`idle | loading | ready | playing | paused | seeking | buffering | ended | error`). Use this for custom buffering overlays.
- `audiotrackchange`, `subtitletrackchange` — active track changed
- `trackschange` (`detail: { audio, subtitle, video }`) — track list changed
- `qualitychange` (`detail: { trackId }`)
- `pipchange` (`detail: { pip }`) — picture-in-picture entered/exited
- `fullscreenchange` (`detail: { fullscreen }`)
- `titlechange` (`detail: { title }`)
- `audiooutputchange` (`detail: { deviceId }`) — output device switched (`""` = system default)
- `filerevoked` (`detail: <info>`) — local File handle was revoked by the browser

**Important:** `playing`, `waiting`, `seeking`, `seeked` (which `<video>` dispatches) are **not** emitted as DOM events on `<movi-player>`. Subscribe to `statechange` instead — it carries the same information with explicit state names. `MoviPlayer` (the programmatic core) does emit `seeking`/`seeked` via its `EventEmitter`, but those don't bubble through to the custom element.

### 4.4 Slots / fallback content

Children of `<movi-player>` render as fallback while loading or if JS fails. Useful for SSR-friendly placeholders (the existing `index.html` uses a shimmer div).

---

## 5. The programmatic core — `MoviPlayer`

For headless / non-DOM use:

```ts
import { MoviPlayer } from "movi-player/player";

const player = new MoviPlayer({
  source: { type: "url", url: "video.mkv" },
  renderer: "canvas",
  canvas: document.querySelector("canvas"),
});

await player.load();
await player.play();

player.on("timeupdate", (t) => console.log("at", t));
```

Key methods (in [src/core/MoviPlayer.ts](src/core/MoviPlayer.ts)):

- `load(sourceConfig?)`, `destroy()`
- `play()`, `pause()`, `seek(seconds)`
- `setPlaybackRate(rate)`, `setVolume(v)`, `setMuted(m)`
- `getCurrentTime()`, `getDuration()`, `getState()`
- `getMediaInfo()`, `getCacheStats()`
- Events via the `EventEmitter` parent: `play`, `pause`, `ended`, `timeupdate`, `seeking`, `seeked`, `error`, `stateChange`, `trackChange`, …

`PlayerEventMap` in `types.ts` is the source of truth for event names + payloads.

---

## 6. Demuxer-only — `Demuxer`

For metadata, thumbnails, or custom decode pipelines without the player:

```ts
import { Demuxer, HttpSource, MoviVideoDecoder } from "movi-player/demuxer";

const source = new HttpSource("video.mkv");
const demuxer = new Demuxer(source);
await demuxer.open();
const info = demuxer.getMediaInfo();   // tracks, duration, codec, color metadata
```

Useful for: server-side metadata workers (with the right WASM polyfills), thumbnail generation services, custom UIs that want to render frames into their own canvas.

---

## 7. Performance guidance (the hard-won knowledge)

This section documents tradeoffs that are not obvious from reading the code. Most are encoded as runtime checks in `MoviPlayer.ts`; the comments there cite the same reasoning.

### 7.1 4K+ playback rate is capped at 1.5x

Hardware AV1/HEVC decoders cannot sustain ≥120 effective fps at 8K. 2x playback on 8K @ 60 fps demands ~120 fps decode — beyond any current decoder. The clamp lives in `MoviElement.getMaxAllowedRate()` and `set playbackRate`, plus the speed menu UI greys out >1.5x options. Lighter sources keep the full 2x.

### 7.2 Renderer queue is resolution + device aware

`MoviPlayer.ts` (look for `baseHwQueue`) caps the renderer's `frameQueue` length based on source weight:

- 4K+ on desktop: 16 frames (VRAM bound — 8K HDR frames are ~50 MB each)
- 4K+ on mobile: 8–12 frames (decode throughput bound)
- ≤1080p on mobile: ~800 ms duration target
- ≤1080p on desktop: 100 frames (no change from default)

A deeper queue locks GBs of VRAM and starves the GPU compositor; a too-shallow queue fires backpressure before audio refills. Don't tune these without measuring on the target device.

### 7.3 `audioStarving` threshold tracks `latencyHint`

`AudioRenderer` uses `latencyHint: "interactive"` (~50–150 ms output buffer) so playback-rate changes don't glitch on Chromium. The demux loop's `skipVideoDecodeForAudio` path watches `audioBuffered < threshold`. **Threshold must scale with `latencyHint`**: at `"playback"` (~200 ms buffer) 0.5 s is correct; at `"interactive"` 0.1 s is the right number. Mismatching them produces false-positive "audio starving" every demux tick, which drops AV1 non-keyframes, which corrupts the reference chain, which produces `EncodingError` once per GOP. Don't paper over decoder errors with log-level downgrades — fix the threshold.

### 7.4 `skipVideoDecodeForAudio` is disabled on 4K+

For lighter sources, dropping a few video packets to keep audio flowing is acceptable (you get glitches, not freezes). For 4K+ the decoder is already at its ceiling — dropping packets doesn't help it catch up, it just corrupts the reference chain. So the path is gated `!isHighRes`. Accept a little audio drift instead.

### 7.5 Ambient mode is heavy on mobile

`ambientmode` runs a sampling RAF and updates a CSS gradient on the wrapper element. On 8K HDR the original implementation triggered a full canvas readback per sample (~100 ms GPU stall). Current implementation maintains a 16×16 RGBA8 FBO in `CanvasRenderer` and samples that (256-pixel `readPixels`, microseconds). Still costs a CSS gradient update per sample, which mobile compositors feel. **Default to off on mobile-targeted pages.** The hard-won mobile lag root cause for one user's `<movi-player>` setup turned out to be `ambientmode` + `ambientwrapper`, not any decode/queue issue.

### 7.6 Hardware AV1 may be unavailable

`VideoDecoder.configure()` requests `hardwareAcceleration: "prefer-hardware"` and falls back to `no-preference` if the browser rejects. Look for `hwAccel=…` in the `Configured:` log line. On Chrome Android the AV1 hardware whitelist is conservative — most devices fall through to software dav1d, which can't realtime 4K AV1. There is no web-side fix for this; the workaround is to deliver transcoded H.264/HEVC variants for mobile.

### 7.7 8K HDR-specific costs

- WebGL backbuffer at 7680×4320 with `display-p3` color space + 10-bit content can land on RGBA16F internally (~250 MB/frame).
- Per-frame `texImage2D` of an 8K `VideoFrame` is the dominant cost. The compositor downscales after.
- Limiting frame queue depth (see 7.2) is the single highest-leverage knob.

---

## 8. Common pitfalls

### 8.1 MPEG-TS (`.ts`) files

- TS streams have absolute PTS (broadcast wall clock), not zero-based. FFmpeg reports `start_time = 4200s` if the file starts at PTS 4200. `MoviPlayer.getCurrentTime()` normalizes by subtracting `startTime` so the UI sees 0-based time.
- TS keyframe spacing is often long (5+ seconds). FFmpeg's `seek(N)` lands on the nearest keyframe **at-or-after** N. To prevent the UI timeline from jumping from `0:00` to `0:02` after a seek, `MoviPlayer` tracks a per-seek `seekKeyframeOffset` and subtracts it from `getCurrentTime()` (offset is reset on every new seek/load).
- HEVC in TS often uses **Open GOP IDRs** that reference frames before themselves. WebCodecs rejects these. The decoder's recovery path (`waitingForKeyframe`) skips to the next real IDR. `MoviPlayer` listens on `videoDecoder.onKeyframeWaitChange` and transitions to `buffering` during this window so audio + clock pause until the decoder reconnects — without that, you get 1–2 s of "audio plays alone, video frozen" then a sync jump.

### 8.2 Opus audio

Forced to software decode regardless of WebCodecs support. WebCodecs chokes on Opus packet gaps that the WASM decoder tolerates. Don't pull "opus" out of the software-codec list in `AudioDecoder`.

### 8.3 HEVC Open-GOP & Rext profiles

`VideoDecoder.ts` has a fallback chain: tries the parsed codec string, retries without color metadata, then maps `hvc1.4` (Rext) to `hvc1.4.10.LXXX.B0` / Main10 with patched extradata, then falls back to software. The patching modifies hvcC bytes — if you touch it, double-check on a Rext source.

### 8.4 PIP and shadow DOM

PiP requires the `<video>` element to be in the light DOM, not the shadow root, on most browsers. The native cascade (currently not in `src/` — see [memory/project_native_cascade.md](#) if you have the local memory file) handles this by relocating the element; the canvas-only path doesn't need to.

### 8.5 Backpressure and audio drift

If you see audio drifting away from video, check `audioBuffered` vs the `audioStarving` threshold first (§7.3). If you see `Stall detected: buffers empty for 500ms` repeatedly on 4K+ non-1x playback, that's the decoder genuinely failing to keep up — there's no buffer tweak that will fix it.

---

## 9. Browser support matrix

| Feature | Chrome 110+ | Safari 18+ | Firefox 130+ |
|---------|-------------|------------|--------------|
| WebCodecs | ✅ | ✅ | ✅ |
| Hardware HEVC | ✅ (desktop+select Android) | ✅ | ✅ |
| Hardware AV1 | ✅ (whitelisted desktop) | ✅ (Apple Silicon) | partial |
| Software AV1 (dav1d-wasm) | ✅ | ✅ | ✅ |
| HDR via canvas `display-p3` | ✅ | partial | ❌ (PQ tone-map shader path) |
| `latencyHint: "interactive"` AudioContext | ✅ | ✅ | ✅ |
| `requestPictureInPicture()` | ✅ | ✅ | partial |

iOS Safari has WebCodecs since 17.4 but with quirks: no `display-p3` drawing buffer color space, software-only AV1 in most cases, no programmatic fullscreen.

---

## 10. How to extend

### Add a new attribute

1. Add to `observedAttributes` array ([src/render/MoviElement.ts:257](src/render/MoviElement.ts#L257)).
2. Handle in `attributeChangedCallback` switch (around line 11420+).
3. Add private state field near top of class, public getter/setter if needed.
4. Document above in §4.1 and update this file's table.

### Add a new source type

1. Implement `SourceAdapter` interface ([src/source/SourceAdapter.ts](src/source/SourceAdapter.ts)) — single `read(offset, length)` method.
2. Export from `src/source/index.ts`.
3. Add factory function (`createFooSource`) for ergonomics.
4. If special config is needed, extend `SourceConfig` discriminated union in `types.ts`.

### Add a new renderer

Currently only `canvas` is supported but the abstraction exists. To add e.g. a WebGPU renderer:

1. Mirror `CanvasRenderer`'s public surface (presentation loop, queue management, A/V sync hooks).
2. Add to `RendererType` union in `types.ts`.
3. Wire selection in `MoviPlayer.ts` (search for `this.videoRenderer = new CanvasRenderer`).
4. Update `MoviElement`'s `renderer` attribute handler.

### Touch the WASM layer

The WASM module is built via Docker: `npm run build:wasm`. It compiles FFmpeg + dav1d + Signalsmith Stretch into a single `.wasm`. ABI surface is in [src/wasm/types.ts](src/wasm/types.ts) and [src/wasm/bindings.ts](src/wasm/bindings.ts). Don't change exports without rebuilding both the WASM and the TS bindings.

---

## 11. Conventions

- **TypeScript strict mode**. `npm run typecheck` must pass.
- **No new dependencies** without a strong reason. `hls.js` is the only runtime dep; WASM blob is built in-tree.
- **No emojis in code**. UTF-8 text is fine in user-facing strings.
- **No new comments** that just describe what the code does. Comments earn their place by explaining *why* — a non-obvious invariant, a workaround for a specific browser bug, etc. Existing comments in `MoviPlayer.ts` and `VideoDecoder.ts` are the style template (long, explain history, cite the failure mode).
- **Backwards-compatibility** matters for public API (attributes, methods, events, exports). Internal changes (queue tuning, recovery heuristics) are fair game.
- **Logging**: use `Logger.debug/info/warn/error` from `src/utils/Logger.ts`, never `console.*`. Each module gets a `const TAG = "ModuleName"` for grep-ability.

---

## 12. Tests and verification

- `npm run typecheck` — TypeScript only, fast (~3 s).
- `npm test` — Vitest unit tests. Sparse coverage (this is a hard codebase to unit test; most behavior is integration-tested in `app/test-native.html`).
- `app/test-native.html` — minimal real-player smoke test that's served from the Cloudflare Worker at `/test-native.html`. Useful for isolating perf issues from app-shell costs by bisecting attributes.
- `npm run dev` — Vite dev server. Open `index.html` against a local video. **HMR does not always cleanly replace the `MoviPlayer` class** — full reload + dev server restart is safer when tuning the demux loop.

When reporting "this works" / "this is fixed", actually load a representative file and check the console for decoder errors. The decoder's recovery path silences a lot of issues that still degrade UX.

---

## 13. Where to look when something breaks

| Symptom | Start here |
|---------|------------|
| Decoder error / EncodingError loop | [src/decode/VideoDecoder.ts](src/decode/VideoDecoder.ts) `_doRecover`, plus `audioStarving` threshold in [src/core/MoviPlayer.ts](src/core/MoviPlayer.ts) |
| A/V drift, audio out of sync | `notifySeekCompletion` and `skipVideoDecodeForAudio` in [src/core/MoviPlayer.ts](src/core/MoviPlayer.ts) |
| Stuttering 4K/8K, frame drops | Renderer queue cap (`baseHwQueue`), `Backpressure during sync` logs |
| Mobile lag with no decoder errors | Check `ambientmode`, `resume` attributes; bisect against `app/test-native.html` |
| Seek lands at wrong time on `.ts` | `seekKeyframeOffset` (UI clamp) + `onKeyframeWaitChange` (mid-playback recovery) in [src/core/MoviPlayer.ts](src/core/MoviPlayer.ts) |
| Wrong colors on HDR | Browser detection + tone-map shader in [src/render/CanvasRenderer.ts](src/render/CanvasRenderer.ts) (`isHDRSource`, `hasNativeHDRSupport`) |
| HEVC/AV1 not playing at all | `VideoDecoder.configure` fallback chain — strip colorSpace, try Rext fallback, manual codec mapping |
| Build fails | `npm run build:wasm` requires Docker; `npm run build:ts` requires the `.wasm` blob to exist (`scripts/check-wasm.js`) |

---

## 14. When unsure, ask

This codebase has 7 years of accumulated browser-quirk handling. Most "weird" code paths exist for a specific reason that isn't documented in the diff. If you find code that looks redundant or overly defensive, **search git history first** — there's usually a postmortem in the commit message. If after that it still looks wrong, ask the human partner instead of deleting it.
