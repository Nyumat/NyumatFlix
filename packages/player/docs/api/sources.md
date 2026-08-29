# Sources API

Movi-Player provides different source adapters for various input types.

## Available Sources

| Source         | Use Case             | Import                |
| -------------- | -------------------- | --------------------- |
| `HttpSource`   | Remote URLs          | `movi-player/demuxer` |
| `FileSource`   | Local files          | `movi-player/demuxer` |
| Custom adapter | Any other protocol   | implement `SourceAdapter` |

## HttpSource

For loading videos from HTTP/HTTPS URLs.

### Basic Usage

```typescript
import { Demuxer, HttpSource } from "movi-player/demuxer";

const source = new HttpSource("https://example.com/video.mp4");
const demuxer = new Demuxer(source);

await demuxer.open();
console.log("Duration:", demuxer.getDuration());
```

### With Player

```typescript
import { MoviPlayer } from "movi-player/player";

const player = new MoviPlayer({
  source: { type: "url", url: "https://example.com/video.mp4" },
  canvas: document.getElementById("canvas") as HTMLCanvasElement,
});

await player.load();
```

`HttpSource` is created internally for `{ type: "url" }`. If you want to plug a pre-built `HttpSource` (or any other adapter instance) directly into `MoviPlayer` or `<movi-player>` — for tweaked headers, alternate buffering, or a fully custom protocol — use the `sourceAdapter` field instead. See [Custom Sources](#creating-custom-sources).

### CORS Requirements

::: warning CORS
HttpSource requires the server to send proper CORS headers:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, HEAD
Access-Control-Expose-Headers: Content-Length, Content-Range
```

:::

### Features

- ✅ Range request support (seeking)
- ✅ Automatic chunk caching
- ✅ HEAD request for file size
- ✅ Error recovery

## FileSource

For loading local files from the user's device.

### Basic Usage

```typescript
import { Demuxer, FileSource } from "movi-player/demuxer";

const fileInput = document.getElementById("file") as HTMLInputElement;

fileInput.addEventListener("change", async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const source = new FileSource(file);
  const demuxer = new Demuxer(source);

  await demuxer.open();
  console.log("File:", file.name);
  console.log("Duration:", demuxer.getDuration());
});
```

### With Player

```typescript
import { MoviPlayer } from "movi-player/player";

fileInput.addEventListener("change", async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const player = new MoviPlayer({
    source: { type: "file", file },
    canvas: document.getElementById("canvas") as HTMLCanvasElement,
  });

  await player.load();
  await player.play();
});
```

### Features

- ✅ No CORS needed
- ✅ Instant seeking (no network latency)
- ✅ LRU cache for chunks
- ✅ Memory efficient (2MB chunks)
- ✅ Works offline
- ✅ Revocation recovery (8s timeout per chunk read)

### Handle Revocation (mobile)

iOS Safari and Android Chrome silently revoke `File` handles after long backgrounding or memory pressure, leaving the demuxer hung forever waiting on a read that will never complete.

`FileSource` races each chunk read against an 8s timeout. The first time a read fails this way, it fires a one-shot `onRevoked` callback so the host can prompt for a re-pick. `MoviPlayer` re-emits this as a `filerevoked` event, and `<movi-player>` re-dispatches it as a DOM `CustomEvent`.

```typescript
// Direct FileSource use:
const source = new FileSource(file);
source.setOnRevoked(({ offset, length, reason }) => {
  console.warn(`File handle revoked at byte ${offset} (${reason})`);
  promptUserToRepickFile();
});

// Via the player:
player.on("filerevoked", (info) => promptUserToRepickFile());

// Via the element:
el.addEventListener("filerevoked", (e: CustomEvent) => {
  promptUserToRepickFile();
});
```

### Memory Management

FileSource uses intelligent chunking:

```typescript
// Internal configuration
const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunks
const MAX_CACHED_CHUNKS = 50; // ~100MB max cache

// LRU cache evicts least recently used chunks
// when cache is full
```

## Source Interface

All sources implement the `SourceAdapter` interface:

```typescript
interface SourceAdapter {
  // Total size of the source in bytes
  getSize(): Promise<number>;

  // Read `length` bytes starting at `offset`. Must return an ArrayBuffer.
  read(offset: number, length: number): Promise<ArrayBuffer>;

  // Seek to a position (sources that need state can track it here)
  seek(offset: number): number;

  // Current read position
  getPosition(): number;

  // Close and release resources
  close(): void;

  // Stable, unique identifier — used for the resume-position storage key
  getKey(): string;
}
```

### What the Player Actually Calls

Out of the six methods, only three are load-bearing for a custom adapter — the rest are required by TypeScript but can be no-ops:

| Method          | Required | Where it's called                                            |
| --------------- | -------- | ------------------------------------------------------------ |
| `getSize()`     | **Yes**  | File size cache + demuxer EOF check                          |
| `read()`        | **Yes**  | Every WASM/FFmpeg I/O request                                |
| `getKey()`      | **Yes**  | Resume-position storage key (must be stable across sessions) |
| `seek()`        | No       | WASM probes for it via `typeof === "function"`; safe no-op   |
| `getPosition()` | No       | Only used inside `instanceof HttpSource` branches            |
| `close()`       | No       | Called on `destroy()`; no-op if nothing to clean up          |

### Creating Custom Sources

Bring your own protocol — WebSocket, WebRTC data channel, IndexedDB, custom encryption, anything — without touching the demuxer or the UI:

```typescript
import type { SourceAdapter } from "movi-player";

class MySource implements SourceAdapter {
  constructor(private url: string, private totalSize: number) {}

  async getSize() {
    return this.totalSize;
  }

  async read(offset: number, length: number): Promise<ArrayBuffer> {
    // Fetch bytes [offset, offset + length) from your protocol.
    // If offset + length > totalSize, return a TRUNCATED buffer — do not throw.
    // FFmpeg's probe phase expects partial reads near EOF.
  }

  getKey() {
    return this.url; // Stable key for resume storage
  }

  // ↓ TS requires these — safe no-ops for read-only random-access adapters
  seek(o: number) { return o; }
  getPosition() { return 0; }
  close() {}
}
```

### Plugging In

Same adapter, three integration surfaces:

```typescript
// 1. Demuxer (low-level, no playback) — direct constructor argument
import { Demuxer } from "movi-player/demuxer";
const dm = new Demuxer(new MySource(url, size));
await dm.open();

// 2. MoviPlayer (programmatic, no UI) — `sourceAdapter` config field
import { MoviPlayer } from "movi-player/player";
const player = new MoviPlayer({
  sourceAdapter: new MySource(url, size),
  canvas: document.querySelector("canvas")!,
});
await player.load();

// 3. <movi-player> custom element — `sourceAdapter` property
const el = document.querySelector("movi-player");
el.sourceAdapter = new MySource(url, size);
```

When `sourceAdapter` is set, the standard `source` / `src` path is bypassed — the player feeds bytes through your adapter directly. Setting `src` after clears the adapter (and vice versa) so the two stay mutually exclusive.

::: warning Random-access is mandatory
FFmpeg seeks to the end of the file to find the `moov` atom (MP4), then back to the start. Pure-streaming protocols like a single WebSocket frame won't work — you need either server-side range queries or client-side buffering of the whole file before playback.
:::

::: tip Return `ArrayBuffer`, not `Uint8Array`
The adapter contract is `Promise<ArrayBuffer>`. Returning `Uint8Array` works at runtime but forces a silent `new Uint8Array(uint8array)` copy inside the demuxer wrapper.
:::

## Source Selection

`SourceConfig` requires an explicit `type` discriminant — the player picks the right adapter from it:

```typescript
// HTTP URL → HttpSource
await player.load({ type: "url", url: "https://example.com/video.mp4" });

// Local File → FileSource
await player.load({ type: "file", file: selectedFile });

// Encrypted endpoint → EncryptedHttpSource
await player.load({
  type: "encrypted",
  encrypted: {
    videoUrl: "/api/video",
    tokenUrl: "/api/token",
    videoId: "movie.mp4",
    fingerprint: await generateFingerprint(),
    sessionToken: jwt,
  },
});
```

## Error Handling

### HttpSource Errors

```typescript
try {
  const source = new HttpSource(url);
  const demuxer = new Demuxer(source);
  await demuxer.open();
} catch (error) {
  if (error.message.includes("CORS")) {
    console.error("CORS error: Server must allow cross-origin requests");
  } else if (error.message.includes("404")) {
    console.error("File not found");
  } else if (error.message.includes("network")) {
    console.error("Network error");
  }
}
```

### FileSource Errors

```typescript
try {
  const source = new FileSource(file);
  const demuxer = new Demuxer(source);
  await demuxer.open();
} catch (error) {
  if (error.message.includes("format")) {
    console.error("Unsupported file format");
  } else if (error.message.includes("corrupt")) {
    console.error("File may be corrupted");
  }
}
```

## Performance Comparison

| Metric       | HttpSource        | FileSource |
| ------------ | ----------------- | ---------- |
| Initial load | Network dependent | Instant    |
| Seeking      | ~100-500ms        | <10ms      |
| Memory       | ~200MB            | ~100-400MB |
| Offline      | ❌                | ✅         |
| CORS         | Required          | Not needed |
