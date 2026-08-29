# Local File Playback

Play local video files directly from the user's device — no server upload required!

## Why Local Files?

- 🔒 **Privacy** - Files never leave the browser
- ⚡ **Instant** - No upload wait time
- 💾 **Large Files** - Handle multi-GB files easily
- 🌐 **Offline** - Works without internet connection

## Basic Example

### Using Custom Element

```html
<movi-player
  id="player"
  controls
  style="width: 100%; height: 500px;"
></movi-player>
<input type="file" id="fileInput" accept="video/*" />

<script type="module">
  import "movi-player";

  const player = document.getElementById("player");
  const fileInput = document.getElementById("fileInput");

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      player.src = file; // Can directly assign File object!
      player.play();
    }
  });
</script>
```

### Using Programmatic API

```typescript
import { MoviPlayer, FileSource } from "movi-player/player";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const fileInput = document.getElementById("fileInput") as HTMLInputElement;

let player: MoviPlayer | null = null;

fileInput.addEventListener("change", async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  // Cleanup previous player
  if (player) {
    player.destroy();
  }

  // Create new player
  player = new MoviPlayer({
    source: {
      type: "file",
      file: file,
    },
    canvas: canvas,
  });

  try {
    await player.load();
    const duration = player.getDuration();
    console.log(`Loaded: ${file.name}`);
    console.log(`Duration: ${duration}s`);
    console.log(`Size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);

    await player.play();
  } catch (error) {
    console.error("Failed to play:", error);
  }
});
```

## FileSource Class

For advanced use cases, you can use `FileSource` directly:

```typescript
import { Demuxer, FileSource } from "movi-player/demuxer";

const fileInput = document.getElementById("fileInput") as HTMLInputElement;

fileInput.addEventListener("change", async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  // Create FileSource
  const source = new FileSource(file);

  // Use with Demuxer
  const demuxer = new Demuxer(source);
  const info = await demuxer.open();

  console.log("File info:");
  console.log(`  Name: ${file.name}`);
  console.log(`  Size: ${file.size} bytes`);
  console.log(`  Type: ${file.type}`);
  console.log(`  Duration: ${info.duration}s`);
  console.log(`  Tracks: ${info.tracks.length}`);

  // List all tracks
  info.tracks.forEach((track, i) => {
    console.log(`  Track ${i}: ${track.type} - ${track.codec}`);
  });
});
```

## Supported File Types

FileSource works with any format supported by FFmpeg WASM:

| Format      | Extensions             | Notes        |
| ----------- | ---------------------- | ------------ |
| **MP4**     | `.mp4`, `.m4v`, `.m4a` | Most common  |
| **MKV**     | `.mkv`, `.mka`         | Multi-track  |
| **WebM**    | `.webm`                | VP8/VP9      |
| **MOV**     | `.mov`                 | Apple format |
| **MPEG-TS** | `.ts`, `.m2ts`         | Broadcast    |
| **AVI**     | `.avi`                 | Legacy       |
| **FLV**     | `.flv`                 | Legacy       |

## Memory Efficiency

FileSource uses intelligent chunked reading:

```typescript
// FileSource configuration
const source = new FileSource(file);

// Internal chunking:
// - Reads file in 2MB chunks
// - LRU cache for frequently accessed regions
// - Preloads ahead for smooth playback
// - Releases memory for old chunks
```

### Memory Usage

| File Size   | Typical Memory | Notes          |
| ----------- | -------------- | -------------- |
| < 100MB     | ~50MB          | Mostly cached  |
| 100MB - 1GB | ~100-200MB     | Partial cache  |
| > 1GB       | ~200-400MB     | Smart chunking |

## Handle Revocation (Mobile)

iOS Safari and Android Chrome silently revoke `File` handles after long backgrounding or memory pressure. Without recovery, the demuxer hangs forever waiting on a read that will never complete.

`FileSource` races each chunk read against an 8s timeout. When a read fails, it surfaces the failure as a one-shot event so the app can prompt the user to re-pick the file.

```html
<movi-player id="player" controls></movi-player>

<script type="module">
  import "movi-player";

  const player = document.getElementById("player");
  let lastFile = null;

  player.addEventListener("filerevoked", (e) => {
    // e.detail = { offset, length, reason }
    console.warn("File handle revoked:", e.detail);

    // Show the user a "Pick again" prompt — there is no way to recover
    // the original handle, so they must re-select the file from disk.
    showRepickDialog(lastFile?.name).then((newFile) => {
      if (newFile) {
        lastFile = newFile;
        player.src = newFile;
      }
    });
  });
</script>
```

For programmatic use, listen to `filerevoked` on `MoviPlayer` instead — same payload.

## Drag & Drop Support

```html
<div
  id="dropZone"
  style="
  width: 100%;
  height: 300px;
  border: 2px dashed #ccc;
  display: flex;
  align-items: center;
  justify-content: center;
"
>
  Drop video file here
</div>
<movi-player id="player" controls style="display: none;"></movi-player>

<script type="module">
  import "movi-player";

  const dropZone = document.getElementById("dropZone");
  const player = document.getElementById("player");

  // Prevent default drag behaviors
  ["dragenter", "dragover", "dragleave", "drop"].forEach((event) => {
    dropZone.addEventListener(event, (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  // Highlight on drag
  ["dragenter", "dragover"].forEach((event) => {
    dropZone.addEventListener(event, () => {
      dropZone.style.borderColor = "#646cff";
      dropZone.style.background = "rgba(100, 108, 255, 0.1)";
    });
  });

  ["dragleave", "drop"].forEach((event) => {
    dropZone.addEventListener(event, () => {
      dropZone.style.borderColor = "#ccc";
      dropZone.style.background = "transparent";
    });
  });

  // Handle drop
  dropZone.addEventListener("drop", (e) => {
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("video/")) {
      dropZone.style.display = "none";
      player.style.display = "block";
      player.src = file;
      player.play();
    }
  });
</script>
```

## Extract Video Information

```typescript
import { Demuxer, FileSource } from "movi-player/demuxer";

async function getVideoInfo(file: File) {
  const source = new FileSource(file);
  const demuxer = new Demuxer(source);

  const info = await demuxer.open();

  const videoTrack = demuxer.getVideoTracks()[0];
  const audioTrack = demuxer.getAudioTracks()[0];

  const result = {
    // File info
    fileName: file.name,
    fileSize: file.size,

    // Duration
    duration: info.duration,

    // Video
    video: videoTrack
      ? {
          width: videoTrack.width,
          height: videoTrack.height,
          codec: videoTrack.codec,
          frameRate: videoTrack.frameRate,
          bitrate: videoTrack.bitrate,
          isHDR: videoTrack.isHDR,
        }
      : null,

    // Audio
    audio: audioTrack
      ? {
          codec: audioTrack.codec,
          sampleRate: audioTrack.sampleRate,
          channels: audioTrack.channels,
          bitrate: audioTrack.bitrate,
        }
      : null,

    // All tracks
    tracks: info.tracks,
  };

  // Cleanup
  demuxer.close();

  return result;
}

// Usage
const info = await getVideoInfo(selectedFile);
console.log(info);
```

## Generate Thumbnails from Local File

```typescript
import { MoviPlayer } from "movi-player/player";

async function generateThumbnails(file: File, count: number = 10) {
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 180;

  const player = new MoviPlayer({
    source: {
      type: "file",
      file: file,
    },
    canvas: canvas,
    enablePreviews: true,
  });

  await player.load();
  const duration = player.getDuration();
  const interval = duration / count;

  const thumbnails: Blob[] = [];

  for (let i = 0; i < count; i++) {
    const time = i * interval;
    const blob = await player.getPreviewFrame(time);
    if (blob) thumbnails.push(blob);
  }

  player.destroy();

  return thumbnails;
}

// Display thumbnails
async function showThumbnails(file: File) {
  const container = document.getElementById("thumbnails");
  const thumbnails = await generateThumbnails(file, 10);

  thumbnails.forEach((blob, i) => {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(blob);
    img.title = `Thumbnail ${i + 1}`;
    container.appendChild(img);
  });
}
```

## No CORS Issues

::: tip
Unlike HTTP sources, local files don't require CORS configuration. FileSource reads files directly using the File API.
:::

```typescript
// HTTP source - requires CORS
const httpSource = new HttpSource("https://example.com/video.mp4");
// ⚠️ May fail if server doesn't send CORS headers

// File source - no CORS
const fileSource = new FileSource(localFile);
// ✅ Always works, no server configuration needed
```

## Comparison: FileSource vs HttpSource

| Feature   | FileSource    | HttpSource        |
| --------- | ------------- | ----------------- |
| CORS      | Not needed ✅ | Required          |
| Speed     | Instant       | Network dependent |
| Offline   | Works ✅      | Requires network  |
| Privacy   | Local only ✅ | Server access     |
| File Size | Unlimited     | Server limits     |
| Seeking   | Instant       | Network latency   |
