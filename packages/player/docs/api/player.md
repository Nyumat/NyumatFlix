# Player Documentation

**Movi Streaming Video Library - Player Component**

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [API Reference](#api-reference)
4. [Configuration](#configuration)
5. [Playback Control](#playback-control)
6. [Track Management](#track-management)
7. [Events](#events)
8. [A/V Synchronization](#av-synchronization)
9. [Usage Examples](#usage-examples)
10. [Performance](#performance)
11. [Troubleshooting](#troubleshooting)

---

## Overview

The MoviPlayer is the main orchestrator component that coordinates:

- **Source Management:** HTTP/File data streaming
- **Demuxing:** Container parsing and packet extraction
- **Decoding:** Video/Audio/Subtitle decoding (hardware + software fallback)
- **Rendering:** Canvas (WebGL2) and Audio (Web Audio API) output
- **Synchronization:** Audio-master A/V sync with frame-perfect timing
- **State Management:** Playback state machine with error recovery

**Key File:** [src/core/MoviPlayer.ts](../src/core/MoviPlayer.ts)

### Key Features

✅ **Hardware-First Decoding:** WebCodecs with automatic software fallback
✅ **Pull-Based Streaming:** Memory-efficient, handles multi-GB files
✅ **HDR Support:** BT.2020/PQ/HLG with Display-P3 rendering
✅ **Multi-Track:** Runtime audio/video/subtitle track switching
✅ **Intelligent Seeking:** Keyframe-based with post-seek throttling
✅ **Preview Generation:** Isolated WASM instance for thumbnails
✅ **Wake Lock:** Prevents screen sleep during playback
✅ **Pitch-Preserving Time-Stretch:** Signalsmith Stretch for clean non-1x playback
✅ **Audio-Only Mode:** Dedicated strip UI with embedded cover art extraction
✅ **Cover Art:** Automatic extraction from MP3/MP4/FLAC/MKV metadata

---

## Architecture

### Component Hierarchy

```
┌────────────────────────────────────────────────────────────┐
│                      MoviPlayer                            │
│                   (EventEmitter Core)                      │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐    │
│  │ HttpSource / │──>│   Demuxer    │──>│ TrackManager │    │
│  │  FileSource  │   │   (FFmpeg)   │   │              │    │
│  └──────────────┘   └──────────────┘   └──────────────┘    │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Decoding Pipeline                       │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  MoviVideoDecoder   MoviAudioDecoder   SubtitleDec   │  │
│  │  (WebCodecs→SW)     (WebCodecs→SW)     (Text/Image)  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Rendering Pipeline                      │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  CanvasRenderer           AudioRenderer              │  │
│  │  (WebGL2 + P3)           (Web Audio API)             │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐    │
│  │    Clock     │   │  StateManager│   │  WakeLock    │    │
│  │  (A/V Sync)  │   │ (FSM + Error)│   │  (Screen)    │    │
│  └──────────────┘   └──────────────┘   └──────────────┘    │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Data Flow

```
HTTP/File → Source → Demuxer → Packets → Decoders → Frames → Renderers → Output
                        ↓                    ↑
                   TrackManager          Clock (A/V Sync)
                        ↓                    ↓
                   StreamIndex           Audio Master
```

---

## API Reference

### Constructor

```typescript
constructor(config: PlayerConfig)
```

**Parameters:**

```typescript
interface PlayerConfig {
  source?: SourceConfig;                        // { type, url } or { type, file } — optional when sourceAdapter is set
  sourceAdapter?: SourceAdapter;                // Pre-built adapter — overrides `source` (custom protocols)
  audioSource?: SourceConfig;                   // Separate audio for split video+audio sources
  audioTracks?: AudioSourceEntry[];             // Multi-language audio with metadata
  subtitleTracks?: SubtitleSourceEntry[];       // External subtitles (VTT/SRT) with metadata
  canvas?: HTMLCanvasElement | OffscreenCanvas;
  renderer?: "canvas";                          // Only "canvas" today (MSE pathway is HLS-internal)
  decoder?: "auto" | "software";                // Default "auto" — hardware first, software fallback
  cache?: { maxSizeMB: number };
  wasmBinary?: Uint8Array;                      // Pre-loaded WASM (skips fetch)
  enablePreviews?: boolean;                     // Enable thumbnail-pipeline preview frames
  frameRate?: number;                           // Override fps (0 = auto from metadata)
  headers?: Record<string, string>;             // Custom HTTP headers for all media requests (manifest + segments + progressive + thumbnails + encrypted)
  audioOnly?: boolean;                          // Data saver: skip video decode; adaptive streams fetch an audio-only rendition
  drm?: boolean;                                // DRM mode for adaptive streams (native <video> + EME)
  licenseUrl?: string;                          // Widevine/PlayReady/FairPlay license server URL
  licenseHeaders?: Record<string, string>;      // Auth headers for license requests
  lcevc?: boolean;                              // Enable MPEG-5 LCEVC decoding (needs lcevc_dec.js)
  lcevcUrl?: string;                            // URL to lazy-load the lcevc_dec.js decoder library
}
```

**Example:**

```typescript
import { MoviPlayer } from "movi-player/player";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const player = new MoviPlayer({
  source: { type: "url", url: "video.mp4" },
  canvas: canvas,
  renderer: "canvas",
});
```

**With a custom SourceAdapter** (any protocol — WebSocket, IndexedDB, custom encryption, etc.):

```typescript
import { MoviPlayer } from "movi-player/player";
import type { SourceAdapter } from "movi-player";

const player = new MoviPlayer({
  sourceAdapter: myCustomAdapter,   // wins over `source` when present
  canvas,
});
await player.load();
```

See [Sources → Creating Custom Sources](./sources.md#creating-custom-sources) for the adapter contract.

---

### Methods

#### `load(sourceConfig?: SourceConfig): Promise<void>`

Loads the media source set in the constructor (or the override passed here) and initializes the playback pipeline. `SourceConfig` requires a `type` discriminant.

```typescript
interface SourceConfig {
  type: "url" | "file" | "encrypted";
  url?: string;     // For type: "url"
  file?: File;      // For type: "file"
  headers?: Record<string, string>;
  encrypted?: { videoUrl, tokenUrl, videoId, fingerprint, sessionToken, ... };
}
```

**Returns:** `void`. Inspect tracks/duration via [`getMediaInfo()`](#getmediainfo-mediainfo-null), [`getDuration()`](#getduration-number), and [`getTracks()`](#gettracks-track) after the promise resolves.

**Examples:**

```typescript
// Use the source from the constructor
await player.load();

// Override the source on an idle instance
await player.load({ type: "url", url: "https://example.com/video.mp4" });

const info = player.getMediaInfo();
console.log(`Loaded: ${info?.duration}s`);
```

---

#### `play(): Promise<void>`

Starts playback from current position.

**Behavior:**

- Acquires wake lock (prevents screen sleep)
- Starts demuxing loop
- Begins rendering at 60Hz
- Returns when playback starts (not when it ends)

**Example:**

```typescript
await player.play();
console.log("Playback started");
```

---

#### `pause(): void`

Pauses playback immediately.

**Behavior:**

- Stops demuxing loop
- Releases wake lock
- Preserves current time
- Keeps last frame visible

---

#### `seek(timestamp: number): Promise<void>`

Seeks to a specific timestamp.

**Parameters:**

- `timestamp` - Target time in seconds (must be ≥ 0 and ≤ duration)

**Behavior:**

- Seeks demuxer to nearest keyframe before timestamp
- Flushes video/audio decoders
- Skips packets until reaching target time
- Post-seek throttle (200ms) prevents rapid seeks

**Example:**

```typescript
await player.seek(120.5); // Seek to 2:00.5
console.log(`Seeked to: ${player.getCurrentTime()}s`);
```

**Note:** Actual position after seek may be slightly before target due to keyframe alignment.

---

#### `setPlaybackRate(rate: number): void`

Adjusts playback speed.

**Parameters:**

- `rate` - Speed multiplier (0.25 to 2.0)
  - `0.5` = half speed
  - `1.0` = normal speed (default)
  - `2.0` = double speed

**Example:**

```typescript
player.setPlaybackRate(1.5); // 1.5x speed
```

---

#### `setVolume(volume: number): void`

Sets audio volume.

**Parameters:**

- `volume` - Volume level (0.0 to 1.0)
  - `0.0` = muted
  - `1.0` = maximum (default)

**Example:**

```typescript
player.setVolume(0.5); // 50% volume
```

---

#### `setMuted(muted: boolean): void` / `getMuted(): boolean`

Toggle/read mute state independently from `setVolume()`. Muting also disables the audio decode path on the renderer to save CPU.

```typescript
player.setMuted(true);
console.log(player.getMuted()); // true
```

---

#### `setStableAudio(enabled: boolean): void` / `getStableAudio(): boolean`

Enable/disable the loudness-normalization compressor (driven by `DynamicsCompressorNode`). Same toggle as the `stablevolume` attribute on `<movi-player>`.

```typescript
player.setStableAudio(true);
```

---

#### `setHDREnabled(enabled: boolean): void` / `isHDRSupported(): boolean`

Force HDR rendering on/off, and check whether the **content** is HDR. Note that effective rendering also depends on browser/display capability — see the [HDR guide](../guide/hdr-support.md).

```typescript
if (player.isHDRSupported()) {
  player.setHDREnabled(true);
}
```

---

#### `setMaxBufferSize(megabytes: number): void`

Adjusts the prefetch window in megabytes (HTTP and encrypted sources). Mirrors the `buffersize` HTML attribute.

```typescript
player.setMaxBufferSize(400); // 400 MB ahead
```

---

#### `rotateVideo(): number` / `getVideoRotation(): number` / `setVideoRotation(deg: number): void`

Rotate the canvas output. `rotateVideo()` cycles 0 → 90 → 180 → 270 and returns the new angle. `setVideoRotation()` jumps directly to a value.

```typescript
player.rotateVideo();          // → 90
player.setVideoRotation(180);
console.log(player.getVideoRotation()); // 180
```

---

#### `setFitMode(mode): void`

Set the canvas fit policy. `mode` is `"contain" | "cover" | "fill" | "zoom" | "control"`.

```typescript
player.setFitMode("cover");
```

---

#### `setLetterboxColor(r: number, g: number, b: number): void`

Override the WebGL letterbox color (each channel `0..1`). Used internally by ambient mode; expose for custom UI tints.

---

#### `destroy(): void`

Destroys the player and releases all resources.

**Behavior:**

- Closes demuxer (frees WASM memory)
- Destroys decoders
- Clears frame queues
- Releases wake lock
- Removes all event listeners

**Important:** Always call this before removing player instance.

```typescript
player.destroy();
```

---

### Getters

#### `getCurrentTime(): number`

Returns current playback position in seconds.

---

#### `getDuration(): number`

Returns total media duration in seconds.

---

#### `getState(): PlayerState`

Returns current player state.

```typescript
type PlayerState =
  | "idle" // Not loaded
  | "loading" // Loading source
  | "ready" // Loaded, paused
  | "playing" // Active playback
  | "paused" // Paused
  | "seeking" // Seeking in progress
  | "buffering" // Waiting for data
  | "ended" // Playback finished
  | "error"; // Error occurred
```

---

#### `getVolume(): number`

Returns current volume (0.0 to 1.0).

---

#### `getPlaybackRate(): number`

Returns current playback rate multiplier.

---

#### `getMediaInfo(): MediaInfo | null`

Returns media metadata (null if not loaded).

---

#### `getContentDispositionFilename(): string | null` / `getMetadataTitle(): string | null`

Filename hinted by the server's `Content-Disposition` header, and the title carried in container metadata (e.g., MKV's `<Title>`). The element uses these to populate the in-player overlay and tab title.

---

#### `getChapters(): Array<{ title, start, end }>`

Chapters parsed from the source's metadata. Empty array when none are present.

```typescript
for (const ch of player.getChapters()) {
  console.log(`${ch.start}-${ch.end}: ${ch.title}`);
}
```

---

#### `getTracks(): Track[]`

Returns all tracks (video, audio, subtitle).

---

#### `getVideoTracks(): VideoTrack[]`

Returns video tracks only.

---

#### `getAudioTracks(): AudioTrack[]`

Returns audio tracks only.

---

#### `getSubtitleTracks(): SubtitleTrack[]`

Returns subtitle tracks only.

---

#### `getAudioLangs(): { lang, label, active }[]` / `selectAudioLang(lang: string): boolean`

Language-keyed accessors for muxed audio tracks — easier than working with numeric `trackId` when you just want "switch to Hindi".

```typescript
player.selectAudioLang("hi");
```

---

#### `getSubtitleLangs(): { lang, label, active }[]` / `selectSubtitleLang(lang: string \| null): Promise<boolean>`

Same idea for subtitles. Pass `null` to disable.

---

#### `useMuxedAudio(): void` / `isNativeAudioActive(): boolean` / `hasNativeAudio(): boolean`

Switch between muxed-in audio and a separately-loaded native audio element (the split-source path). `hasNativeAudio()` reports whether a separate audio element exists; `isNativeAudioActive()` whether it's currently driving playback.

---

#### `hasAudibleSource(): boolean`

Unified gate that returns `true` when the player has *any* audible output — covers muxed audio tracks, a separate native `<audio>` element (split source), **and** HLS audio that lives inside the hidden native `<video>`. Use this instead of `getAudioTracks().length` when deciding whether to show a mute button or accept volume hotkeys.

```typescript
if (player.hasAudibleSource()) {
  showVolumeButton();
}
```

---

#### `getCoverArt(): ImageBitmap | null`

Returns the embedded cover art extracted from the media file at load time, or `null` if the source has no embedded artwork or extraction failed. The caller owns the bitmap and must call `close()` on it when done.

```typescript
const art = player.getCoverArt();
if (art) {
  imgElement.src = await createImageBitmap(art).then(bmp => {
    const canvas = document.createElement("canvas");
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    canvas.getContext("2d")!.drawImage(bmp, 0, 0);
    bmp.close();
    return canvas.toDataURL();
  });
}
```

Cover art is extracted from ID3v2 APIC (MP3), `covr` atom (MP4), FLAC PICTURE block, or MKV attachments. The player emits a `coverart` event when extraction completes — the element listens for this and displays it in the audio-strip overlay.

---

#### `setSubtitleDelay(seconds: number): void` / `getSubtitleDelay(): number`

Shifts subtitle timing relative to video. Sign matches VLC and mpv: **positive** values shift subtitles **later**, negative shifts them earlier. Applied at the renderer's active-cue check, so the same offset works for text and image (PGS/DVB) cues without re-decoding.

```typescript
player.setSubtitleDelay(0.5);   // Subtitles 500ms later
console.log(player.getSubtitleDelay()); // 0.5
```

::: tip Persistence
The offset is **not** persisted to `SettingsStorage` — sync drift is per-source, so a global value would mis-shift unrelated videos.
:::

---

### Track Selection

#### `selectAudioTrack(trackId: number): boolean`

Switches to a different audio track by numeric ID. Returns `true` on success. For language-keyed switching see [`selectAudioLang()`](#getaudiolangs-lang-label-active-selectaudiolanglang-string-boolean).

```typescript
const tracks = player.getAudioTracks();
const english = tracks.find((t) => t.language === "eng");
if (english) player.selectAudioTrack(english.id);
```

::: info Video tracks
There is **no** `selectVideoTrack()` on `MoviPlayer` — for HLS quality switching, use the HLS-wrapped path or the `<movi-player>` quality menu. Multi-quality non-HLS sources are not yet supported at the programmatic-API level.
:::

---

#### `setAudioOutputDevice(deviceId: string): Promise<boolean>` / `getAudioOutputDevice(): string`

Routes audio to a specific output device through `AudioContext.setSinkId` (`""` = system default). Resolves to `false` when unsupported or the device is gone. The core takes a raw `deviceId` — enumerate devices yourself via `navigator.mediaDevices.enumerateDevices()` (the `<movi-player>` element adds `getAudioOutputs()` + label-substring resolution on top).

```typescript
await player.setAudioOutputDevice(deviceId);
player.getAudioOutputDevice(); // "" = system default
```

---

#### `selectSubtitleTrack(trackId: number | null): Promise<boolean>`

Enables a subtitle track or disables subtitles.

```typescript
const spanish = player.getSubtitleTracks().find((t) => t.language === "spa");
if (spanish) await player.selectSubtitleTrack(spanish.id);

await player.selectSubtitleTrack(null); // Off
```

---

### Preview / Timeline Generation

#### `getPreviewFrame(time: number): Promise<Blob | null>`

Generates a single thumbnail at a given timestamp using an **isolated** WASM instance, so it doesn't disturb the main playback decoders. Returns `null` if generation fails.

```typescript
const blob = await player.getPreviewFrame(60);
if (blob) imgElement.src = URL.createObjectURL(blob);
```

---

#### `generateTimeline(...): Promise<...>`

Pre-renders a strip of N evenly-spaced thumbnails for the timeline scrubber. Driven by the `T` keyboard shortcut and the timeline UI. See [src/core/MoviPlayer.ts:2437](../src/core/MoviPlayer.ts#L2437) for the current signature.

---

### Buffer / Cache Inspection

#### `getBufferedTime(): number`

Returns the highest contiguous buffered time (in seconds) starting from the current position. This is what the seek-bar buffered indicator reads.

---

#### `getCachedTimeRanges(): Array<{ start, end }>`

All cached time ranges, not just the contiguous one. Useful for drawing multi-segment buffer indicators.

---

#### `getCacheStats()` / `getNetworkSpeed(): number` / `getStats()`

Diagnostic counters surfaced in the "Stats for nerds" overlay (`I` key) — bytes cached, current network throughput, codec/decoder/buffer health, etc.

---

#### `getBufferStartBytes() / getBufferEndBytes() / getBufferStartTime() / getBufferEndTime()`

Byte- and time-level edges of the active buffer window. Used by the encrypted source's prefetch/refill heuristics; rarely needed in app code.

---

### Source / Renderer Inspection

#### `getSource(): SourceAdapter | null` / `isFileSource(): boolean` / `isHttpSource(): boolean`

Reflect on the currently-loaded source. `getSource()` returns the underlying `HttpSource`/`EncryptedHttpSource`/`FileSource` instance (advanced).

---

#### `isSoftwareDecoding(): boolean`

`true` if the player is currently using the software (FFmpeg WASM) decoder path — either because hardware decode failed or because the source forced it.

---

#### `getHLSVideoElement(): HTMLVideoElement | null`

The native `<video>` element used for HLS/DRM playback paths, or `null` for the canvas pipeline.

---

#### `resizeCanvas(width: number, height: number): void`

Notify the renderer that the canvas dimensions changed. The element calls this from its `ResizeObserver`; you only need it when driving `MoviPlayer` directly.

---

### Subtitle Surface

#### `setSubtitleOverlay(overlay: HTMLElement | null): void`

Mount/unmount the DOM node that subtitle text renders into. The element passes its shadow-root overlay automatically.

---

#### `setSubtitleControlsPadding(padding: number): void`

Push subtitles up by N pixels so they don't sit under the controls bar when controls are visible.

---

## Configuration

See the [Constructor](#constructor) section above for the full `PlayerConfig` shape. Highlights:

- `decoder: "auto"` (default) tries hardware (WebCodecs) first and falls back to software (FFmpeg WASM) on failure. Force `"software"` only when hardware decode is producing visual artifacts.
- `renderer: "canvas"` is currently the only option — DRM/HLS paths internally manage their own native `<video>` element when needed.
- `cache.maxSizeMB` defaults to ~100 MB; tune via [`setMaxBufferSize()`](#setmaxbuffersizemegabytes-number-void) at runtime.
- `enablePreviews: true` is required if you plan to call [`getPreviewFrame()`](#getpreviewframetime-number-promiseblob-null).

---

## Playback Control

### State Machine

```
     ┌──────┐
     │ idle │
     └───┬──┘
         │ load()
         ▼
    ┌─────────┐
    │ loading │
    └────┬────┘
         │ success
         ▼
      ┌──────┐  play()  ┌─────────┐
      │ready │◄─────────┤ playing │
      └──┬───┘  pause()  └────┬────┘
         │                    │ end
         │ seek()             ▼
         ├────────>┌─────────┐
         │         │ seeking │
         │         └────┬────┘
         │              │ complete
         └──────────────┘
              │ error
              ▼
         ┌───────┐
         │ error │
         └───────┘
```

### Playback Loop

The player runs an internal `requestAnimationFrame` loop:

1. **Check State:** Skip if paused/seeking
2. **Read Packets:** Demux next video/audio/subtitle packets
3. **Decode:** Send packets to appropriate decoders
4. **Buffer Management:** Apply back-pressure if buffers full
5. **Frame Presentation:** Renderer handles timing
6. **Repeat:** Until paused or ended

---

## Track Management

### Multi-Track Architecture

**File:** [src/core/TrackManager.ts](../src/core/TrackManager.ts)

**Features:**

- Runtime track switching without rebuffering
- Automatic selection (first video/audio, no subtitle)
- Track filtering by type, language, codec

### Track Selection Strategy

```typescript
class TrackManager {
  // Default selection on load
  autoSelectTracks() {
    this.selectedVideoTrack = videoTracks[0];
    this.selectedAudioTrack = audioTracks[0];
    this.selectedSubtitleTrack = null; // Disabled by default
  }

  // User selection
  selectVideoTrack(trackId: number) {
    // Flush current video decoder
    // Switch to new track
    // Continue playback seamlessly
  }
}
```

---

## Events

The player extends `EventEmitter` and fires the events declared in `PlayerEventMap`. See the **[full Events Reference](./events.md)** for every event, payload type, and example handler — including the MoviElement DOM event mirror.

### Event Types (summary)

```typescript
interface PlayerEventMap {
  // Lifecycle
  loadStart: void;
  loadEnd: void;
  preloadComplete: void;
  stateChange: PlayerState;
  ended: void;
  error: Error;

  // Progress
  timeUpdate: number;
  durationChange: number;
  seeking: number;
  seeked: number;
  bufferUpdate: { start: number; end: number }[]; // reserved (not yet emitted)

  // Tracks
  tracksChange: Track[];
  audioTrackChange: { lang: string; label: string };
  subtitleTrackChange:
    | { lang: string; label: string }
    | { lang: null; label: null };

  // Audio
  coverArt: ImageBitmap | null;  // Embedded cover art extracted at load (close() the bitmap when done)

  // Frame-level (advanced)
  frame: DecodedVideoFrame;
  audio: DecodedAudioFrame;
  subtitle: SubtitleCue;

  // Source recovery
  filerevoked: { offset: number; length: number; reason: string };
}
```

::: tip `filerevoked`
Mobile browsers (iOS Safari, Android Chrome) silently revoke `File` handles after long backgrounding or memory pressure, leaving the demuxer hung forever. `FileSource` races each chunk read against an 8s timeout and fires `filerevoked` once so app code can prompt the user to re-pick the file. The `<movi-player>` element re-dispatches this as a DOM `filerevoked` CustomEvent.
:::

### Event Subscription

```typescript
player.on("stateChange", (state) => console.log("State:", state));
player.on("timeUpdate", (t) => updateProgressBar(t / player.getDuration()));
player.on("error", (err) => showErrorMessage(err.message));

// Unsubscribe
const handler = () => console.log("Paused");
player.on("stateChange", handler);
player.off("stateChange", handler);
```

::: warning Event names are camelCase
`MoviPlayer` events are camelCase (`loadStart`, `timeUpdate`, `stateChange`). The DOM-level events on `<movi-player>` use HTML-style lowercase (`loadstart`, `timeupdate`, `statechange`). Don't mix the two — see the [events reference](./events.md) for both tables side-by-side.
:::

---

## A/V Synchronization

### Audio-Master Sync Model

**File:** [src/core/Clock.ts](../src/core/Clock.ts)

**Principle:** Audio is the master clock, video syncs to audio

**Why Audio-Master?**

- Audio glitches are **very noticeable** (pops, clicks)
- Video frame drops are **less noticeable** (smooth motion blur)
- Web Audio API provides high-precision timing

### Sync Implementation

```typescript
class Clock {
  // Get current playback time from audio renderer
  getTime(): number {
    if (this.audioRenderer.isHealthy()) {
      return this.audioRenderer.getAudioClock();
    }
    // Fallback to wall clock if audio unhealthy
    return this.wallClockTime;
  }
}
```

**CanvasRenderer Sync:**

```typescript
presentFrame() {
  const audioTime = this.getAudioTime();
  const frame = this.frameQueue[0];

  if (frame.timestamp <= audioTime) {
    // Audio ahead or in sync → present frame
    this.renderFrame(frame);
    this.frameQueue.shift();
  } else {
    // Video ahead → wait for audio to catch up
    // Check again next RAF
  }
}
```

### Sync Modes

1. **Loose Sync (Default)**
   - Video uses wall clock for smooth presentation
   - Periodic corrections from audio clock
   - ±50ms tolerance before correction

2. **Tight Sync (Optional)**
   - Every frame checked against audio time
   - More accurate, may cause frame drops

### Buffer Health

**Video Buffer:** 120 frames (~2s at 60fps, ~4s at 30fps)
**Audio Buffer:** 2 seconds of audio

If buffers drain:

- Player enters buffering state
- Playback pauses until buffers refill
- Fires `buffering` event (if implemented)

---

## Usage Examples

### Basic Playback

```typescript
import { MoviPlayer } from "movi-player/player";

const canvas = document.getElementById("myCanvas") as HTMLCanvasElement;
const player = new MoviPlayer({
  source: { type: "url", url: "https://example.com/video.mp4" },
  canvas: canvas,
  renderer: "canvas",
});

// Load and play
async function playVideo() {
  try {
    await player.load();
    const info = player.getMediaInfo();
    console.log(`Loaded: ${info?.duration}s`);

    await player.play();
  } catch (error) {
    console.error("Failed to play:", error);
  }
}

playVideo();
```

---

### Progress Bar

```typescript
const progressBar = document.getElementById("progress") as HTMLInputElement;
const timeDisplay = document.getElementById("time") as HTMLSpanElement;

player.on("timeUpdate", (currentTime: number) => {
  const duration = player.getDuration();
  const percent = (currentTime / duration) * 100;
  progressBar.value = percent.toString();

  timeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
});

progressBar.addEventListener("input", () => {
  const percent = parseFloat(progressBar.value);
  const duration = player.getDuration();
  const timestamp = (percent / 100) * duration;
  player.seek(timestamp);
});

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
```

---

### Multi-Language Audio

```typescript
async function setupAudioTracks() {
  await player.load();

  const audioTracks = player.getAudioTracks();
  const selector = document.getElementById("audioTrack") as HTMLSelectElement;

  // Populate dropdown
  audioTracks.forEach((track) => {
    const option = document.createElement("option");
    option.value = track.id.toString();
    option.textContent = `${track.language || "Unknown"} (${track.codec})`;
    selector.appendChild(option);
  });

  // Handle selection
  selector.addEventListener("change", () => {
    const trackId = parseInt(selector.value);
    player.selectAudioTrack(trackId);
  });
}
```

---

### HDR Detection

```typescript
async function checkHDR() {
  await player.load();

  const videoTrack = player.getVideoTracks()[0];
  const isHDR =
    videoTrack.colorPrimaries === "bt2020" &&
    (videoTrack.colorTransfer === "smpte2084" || // HDR10
      videoTrack.colorTransfer === "arib-std-b67"); // HLG

  if (isHDR) {
    console.log("HDR content detected!");
    console.log(`Transfer: ${videoTrack.colorTransfer}`);
    console.log(`Primaries: ${videoTrack.colorPrimaries}`);
  }
}
```

---

### Thumbnail Generation

```typescript
async function generateThumbnails(url: string, count: number) {
  const player = new MoviPlayer({ canvas });
  await player.load();

  const duration = player.getDuration();
  const interval = duration / (count + 1);

  const thumbnails: Blob[] = [];
  for (let i = 1; i <= count; i++) {
    const timestamp = interval * i;
    const thumbnail = await player.getPreviewFrame(timestamp);
    if (thumbnail) thumbnails.push(thumbnail);
  }

  player.destroy();
  return thumbnails;
}

// Usage
const thumbs = await generateThumbnails("video.mp4", 10);
thumbs.forEach((blob, i) => {
  const img = document.createElement("img");
  img.src = URL.createObjectURL(blob);
  document.body.appendChild(img);
});
```

---

## Performance

### Hardware Decoding

**WebCodecs API** provides access to platform hardware decoders:

**Supported Codecs (hardware):**

- H.264/AVC (all platforms)
- H.265/HEVC (macOS, Windows, Android)
- VP9 (Chrome, Edge)
- AV1 (modern browsers)

**Fallback:**
If hardware fails, player automatically switches to software decoding (FFmpeg WASM).

### Memory Usage

**Typical 4K HEVC Playback:**

- WASM heap: ~50MB
- Video frame queue: ~120 frames × ~12MB = ~1.4GB (YUV 4:2:0)
- Audio buffer: ~2s × 48kHz × 2ch × 4B = ~384KB
- **Total: ~1.5GB** (mostly video frames)

**Optimization:**

- Frame queue size adapts to frame rate
- Decoder buffer limits prevent overflow
- Back-pressure stops demuxing when buffers full

### Seeking Performance

**Keyframe Seeking:**

- **Fast:** 100-300ms (index-based)
- Used for most seeks

**Non-Keyframe Seeking:**

- **Slower:** 500-2000ms (decode from last keyframe)
- Rare (only when seeking to exact timestamp)

**Post-Seek Throttle:**

- 200ms delay prevents rapid seeks
- Improves UX on low-end devices

---

## Troubleshooting

### Video Not Playing

**Check:**

1. Codec support: `await navigator.mediaCapabilities.decodingInfo(...)`
2. Browser compatibility: WebCodecs requires Chrome 94+, Edge 94+, Safari 16.4+
3. CORS headers: Cross-origin videos need `Access-Control-Allow-Origin`

**Debug:**

```typescript
player.on("error", (error) => {
  console.error("Error details:", error);
  console.log("Current state:", player.getState());
  console.log("Media info:", player.getMediaInfo());
});
```

---

### Audio/Video Out of Sync

**Causes:**

- Decoder lag (software decode of 4K)
- Buffer underrun
- Incorrect PTS in source file

**Debug:**

```typescript
player.on("frame", (frame) => {
  const audioClock = audioRenderer.getAudioClock();
  const drift = frame.timestamp - audioClock;
  console.log(`A/V drift: ${drift * 1000}ms`);
});
```

**Fix:**

- Enable hardware decoding
- Reduce quality (lower resolution track)
- Increase buffer sizes

---

### High Memory Usage

**Causes:**

- Large frame queue for 4K/8K
- Memory leak (frames not closed)

**Fix:**

```typescript
// Reduce frame queue (edit CanvasRenderer)
private static readonly MAX_FRAME_QUEUE = 60; // Default: 120

// Ensure player destroyed when done
window.addEventListener('beforeunload', () => {
  player.destroy();
});
```

---

### Seeking is Slow

**Causes:**

- Non-seekable stream (no index)
- Large GOP size (keyframes far apart)

**Workaround:**

```typescript
// Show loading indicator during seek
player.on("seeking", () => {
  showLoadingSpinner();
});

player.on("seeked", () => {
  hideLoadingSpinner();
});
```

---

## Best Practices

### 1. Always Destroy Player

```typescript
// React example
useEffect(() => {
  const player = new MoviPlayer({ canvas });

  return () => {
    player.destroy(); // Cleanup on unmount
  };
}, []);
```

### 2. Handle Errors Gracefully

```typescript
player.on("error", async (error) => {
  console.error("Playback error:", error);

  // Try recovery
  try {
    await player.seek(0);
    await player.play();
  } catch {
    showErrorMessage("Playback failed");
  }
});
```

### 3. Optimize for Mobile

```typescript
// Detect mobile and shrink the prefetch window
const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);

if (isMobile) {
  player.setMaxBufferSize(80); // 80 MB prefetch instead of the default 250
}
```

Multi-quality switching is HLS-only at the programmatic-API level; for a non-HLS source, swap `src` to a lower-bitrate file when bandwidth/device dictates.

---

## See Also

- [Demuxer Documentation](./demuxer.md)
- [Video Element Documentation](./element.md)
- [ISO Standards Compliance](../guide/standards.md)

---

**Last Updated:** June 2, 2026
