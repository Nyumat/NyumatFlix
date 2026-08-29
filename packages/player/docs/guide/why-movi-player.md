# Why Movi-Player?

See how Movi-Player compares to other popular video players.

## Feature Comparison

| Feature              | Movi-Player | video.js | hls.js  | Plyr |
| -------------------- | ----------- | -------- | ------- | ---- |
| WebCodecs            | ✅          | ❌       | ❌      | ❌   |
| HDR Support          | ✅          | ❌       | ❌      | ❌   |
| MKV / MPEG-TS        | ✅          | ❌       | TS only | ❌   |
| Canvas Renderer      | ✅          | ❌       | ❌      | ❌   |
| Modular              | ✅          | ❌       | ✅      | ❌   |
| FFmpeg WASM          | ✅          | ❌       | ❌      | ❌   |
| No Server Processing | ✅          | ❌       | ❌      | ❌   |
| HLS/DASH             | ✅          | ✅       | ✅      | ✅   |
| Custom UI            | ✅          | ✅       | ❌      | ✅   |

## Bundle Size

| Player          | Full Bundle | Minimal |
| --------------- | ----------- | ------- |
| **Movi-Player** | 410KB       | 45KB    |
| video.js        | 500KB+      | N/A     |
| hls.js          | 300KB       | 300KB   |
| Plyr            | 100KB       | N/A     |

## Key Advantages

### 1. No Server-Side Processing

Other players require server-side transcoding for:

- Format conversion (MKV → MP4)
- Codec transcoding (HEVC → H.264)
- HLS/DASH packaging

**Movi-Player processes everything in the browser.**

```typescript
// Direct MKV playback - no server conversion needed!
<movi-player src="video.mkv" controls></movi-player>
```

### 2. HDR Content Support

Movi-Player is the only web player with full HDR support:

```typescript
const videoTrack = player.getVideoTracks()[0];

if (videoTrack.isHDR) {
  console.log("HDR Format:", videoTrack.colorTransfer);
  // "smpte2084" (HDR10) or "arib-std-b67" (HLG)
}
```

### 3. Multi-Track Without Processing

Switch audio/subtitle tracks without server-side extraction:

```typescript
// Get all audio tracks
const audioTracks = player.getAudioTracks();
// [{ id: 0, language: 'eng' }, { id: 1, language: 'jpn' }]

// Switch to Japanese audio
player.selectAudioTrack(1);
```

### 4. Local File Privacy

Play files directly from user's device:

```typescript
import { FileSource } from "movi-player/player";

// File never leaves the browser
const source = new FileSource(userSelectedFile);
player.load({ type: "file", file: userSelectedFile });
```

::: info Privacy Benefit
User files are never uploaded to any server. All processing happens locally.
:::

## Migration from Other Players

### From video.js

**Before** — video.js requires the script, the stylesheet, the placeholder `<video>` element, and a JS call to attach the player:

```html
<link href="https://vjs.zencdn.net/8.10.0/video-js.css" rel="stylesheet" />

<video id="my-video" class="video-js" controls preload="auto" data-setup="{}">
  <source src="video.mp4" type="video/mp4" />
</video>
```

```js
import videojs from "video.js";
import "video.js/dist/video-js.css";

const player = videojs("my-video", {
  controls: true,
  autoplay: false,
  preload: "auto",
});

player.on("ended", () => console.log("done"));
```

**After** — Movi Player ships as a custom element. Side-effect import registers `<movi-player>`; no stylesheet, no `videojs()` call, no placeholder `<video>`:

```html
<movi-player id="my-video" src="video.mp4" controls preload="auto"></movi-player>
```

```js
import "movi-player";

const player = document.getElementById("my-video");
player.addEventListener("ended", () => console.log("done"));
```

The element implements the same `play()` / `pause()` / `currentTime` / events surface as `<video>`, so most existing logic carries over with a `getElementById` instead of a `videojs()` factory call.

#### Multiple sources / split source

Movi Player accepts child `<source>` elements just like `<video>`, so the `<source>` fallback pattern keeps working:

```html
<movi-player controls>
  <source src="movie.av1.mp4" type="video/mp4; codecs=av01.0.05M.08" />
  <source src="movie.h264.mp4" type="video/mp4" />
</movi-player>
```

In addition, Movi extends the syntax with `kind="audio"` so you can serve a video-only file alongside a separate audio track (DASH-style split source) — something native `<video>` and video.js can't do without manual MSE wiring:

```html
<movi-player controls>
  <source src="video-only.mp4" type="video/mp4" />
  <source src="audio-only.m4a" type="audio/mp4" kind="audio" />
</movi-player>
```

The two streams are kept in sync automatically. The same is available via JS:

```js
player.source({
  video: { src: "video-only.mp4", type: "video/mp4" },
  audio: { src: "audio-only.m4a", type: "audio/mp4" },
});
```

### From hls.js

**Before** — hls.js wires up MSE manually on a `<video>` element:

```html
<video id="my-video" controls></video>
```

```js
import Hls from "hls.js";

const video = document.getElementById("my-video");
if (Hls.isSupported()) {
  const hls = new Hls();
  hls.loadSource("https://example.com/stream.m3u8");
  hls.attachMedia(video);
  hls.on(Hls.Events.MANIFEST_PARSED, () => video.play());
}
```

**After** — Movi Player handles HLS internally via hls.js; just point `src` at the manifest:

```html
<movi-player src="https://example.com/stream.m3u8" controls autoplay></movi-player>
```

```js
import "movi-player";
```

For DRM-protected HLS streams, add the `drm` and `licenseurl` attributes — Movi switches to the native `<video>` + EME pipeline automatically.
