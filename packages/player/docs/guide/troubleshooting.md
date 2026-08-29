# Troubleshooting

Common issues and their solutions.

## Installation Issues

### WASM Not Loading

**Symptom:** Error about WASM file not found or failed to compile.

**Solution:**

1. Ensure WASM files are served with correct MIME type:

```
Content-Type: application/wasm
```

2. If using Vite/Webpack, WASM files should be in `public` or handled by a loader.

3. Check browser console for specific WASM errors.

### Module Not Found

**Symptom:** `Cannot find module 'movi-player/player'`

**Solution:**

```bash
# Reinstall the package
npm uninstall movi-player
npm install movi-player
```

Check your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler" // or "node16"
  }
}
```

## Cross-Origin Isolation

### Do I need COOP/COEP headers?

**No — cross-origin isolation is optional.** The WASM engine is single-threaded with Asyncify I/O, so it plays fine **without** `SharedArrayBuffer`. The player no longer hard-blocks or shows a "Security Headers Missing" screen when the headers are absent.

Setting these two headers only enables an **optional zero-copy `SharedArrayBuffer` fast-path** for HTTP streaming — without them, `HttpSource` falls back to a plain-buffer path and streams normally:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Check whether the fast-path is active with:

```javascript
console.log(crossOriginIsolated); // true = SharedArrayBuffer fast-path on
```

::: tip `Failed to open media: Timeout at 0`
Older builds could time out on the very first HTTP read when **not** cross-origin isolated. That was a fallback bug (fixed) — update to a current build and HTTP sources stream without any headers.
:::

::: tip Static hosts (GitHub Pages, Netlify free tier, etc.)
You don't need any headers to play. If you *want* the fast-path and can't set response headers, [`coi-serviceworker`](https://github.com/gzuidhof/coi-serviceworker) injects them client-side via a service worker on the *second* page load (the first registers the SW and reloads).
:::

::: warning Cross-origin assets
With `COEP: require-corp` set, every `<img>`, `<script>`, font, and `<video>` from a different origin must serve `Cross-Origin-Resource-Policy: cross-origin` *or* be loaded with `crossorigin="anonymous"`. Otherwise the browser blocks them silently and the player can't read pixel data for ambient mode / snapshots.
:::

---

## Playback Issues

### Video Not Playing

**Symptom:** Video loads but doesn't play.

**Checklist:**

1. **Check autoplay policy:**

```typescript
// Most browsers block autoplay without user interaction
// Muted autoplay is usually allowed
<movi-player src="video.mp4" autoplay muted></movi-player>
```

2. **Check for errors:**

```typescript
player.on("error", (e) => console.error("Error:", e));
```

3. **Check codec support:**

```typescript
const tracks = player.getVideoTracks();
console.log("Video codec:", tracks[0]?.codec);
// Some codecs need software decoding
```

### Black Screen

**Symptom:** Audio plays but video shows black screen.

**Solutions:**

1. **Force canvas renderer:**

```html
<movi-player src="video.mp4" renderer="canvas"></movi-player>
```

2. **Check canvas size:**

```css
movi-player {
  width: 100%;
  height: auto;
  min-height: 300px;
}
```

3. **Check WebGL support:**

```javascript
const canvas = document.createElement("canvas");
const gl = canvas.getContext("webgl2");
if (!gl) {
  console.error("WebGL2 not supported");
}
```

### Audio Not Playing

**Symptom:** Video plays but no audio.

**Solutions:**

1. **Check muted state:**

```typescript
player.setMuted(false);
player.setVolume(1.0);
```

2. **Check audio track selection:**

```typescript
const audioTracks = player.getAudioTracks();
if (audioTracks.length > 0) {
  player.selectAudioTrack(audioTracks[0].id);
}
```

3. **User interaction required:**

```typescript
// Audio context may need user interaction
document.addEventListener(
  "click",
  () => {
    player.play();
  },
  { once: true },
);
```

### Choppy/Stuttering Playback

**Symptom:** Video plays with stutters or frame drops.

**Solutions:**

1. **Check decoder:**

```typescript
// Try software decoding if hardware fails
const player = new MoviPlayer({
  source: { type: "url", url },
  canvas,
  decoder: "software",
});
```

2. **Shrink the prefetch window:**

```typescript
// Lower memory pressure on weak devices
player.setMaxBufferSize(80); // 80 MB ahead instead of the default 250
```

For HLS streams, the built-in `<movi-player>` quality menu can drop to a lower-bitrate rendition.

3. **Check available memory:**

```typescript
// Reduce cache size if needed
const player = new MoviPlayer({
  source: { type: "url", url },
  canvas,
  cache: { maxSizeMB: 50 },
});
```

## Network Issues

### CORS Errors

**Symptom:** `Access-Control-Allow-Origin` error.

**Server-side fix:**

```nginx
# Nginx
location /videos/ {
    add_header 'Access-Control-Allow-Origin' '*';
    add_header 'Access-Control-Allow-Methods' 'GET, HEAD, OPTIONS';
    add_header 'Access-Control-Expose-Headers' 'Content-Length, Content-Range';
}
```

```apache
# Apache
<IfModule mod_headers.c>
    Header set Access-Control-Allow-Origin "*"
    Header set Access-Control-Allow-Methods "GET, HEAD"
    Header set Access-Control-Expose-Headers "Content-Length, Content-Range"
</IfModule>
```

**Client-side workaround:**

Use FileSource for local files (no CORS needed):

```typescript
const source = new FileSource(localFile);
```

### Range Request Errors

**Symptom:** Seeking doesn't work or fails with HTTP 416.

**Solution:**

Ensure server supports range requests:

```
Accept-Ranges: bytes
Content-Range: bytes 0-1023/10240
```

## Format Issues

### Unsupported Format

**Symptom:** `Unsupported format` or `No suitable decoder`

**Check supported formats:**

| Container | Supported  |
| --------- | ---------- |
| MP4       | ✅         |
| MKV       | ✅         |
| WebM      | ✅         |
| MOV       | ✅         |
| MPEG-TS   | ✅         |
| AVI       | ✅         |
| FLV       | ⚠️ Partial |

| Video Codec | Supported          |
| ----------- | ------------------ |
| H.264/AVC   | ✅                 |
| H.265/HEVC  | ✅                 |
| VP8         | ✅                 |
| VP9         | ✅                 |
| AV1         | ✅ (with fallback) |

### HDR Not Detected

**Symptom:** HDR content shows `isHDR: false`

**Solutions:**

1. **Check color metadata:**

```typescript
const track = player.getVideoTracks()[0];
console.log("Transfer:", track.colorTransfer);
console.log("Primaries:", track.colorPrimaries);
// HDR should have 'smpte2084' or 'arib-std-b67'
```

2. **Check container metadata:**
   Some containers don't properly store HDR metadata. Try remuxing to MKV.

## Memory Issues

### High Memory Usage

**Symptom:** Browser tab using excessive memory.

**Solutions:**

1. **Reduce cache:**

```typescript
const player = new MoviPlayer({
  source: { type: "url", url },
  canvas,
  cache: { maxSizeMB: 50 }, // Default is 100
});
```

2. **Destroy when done:**

```typescript
// Always destroy player when finished
player.destroy();

// React cleanup
useEffect(() => {
  return () => player.destroy();
}, []);
```

3. **Single player instance:**

```typescript
// Don't create multiple players
if (currentPlayer) {
  currentPlayer.destroy();
}
currentPlayer = new MoviPlayer({ ... });
```

### Memory Leak

**Symptom:** Memory keeps increasing over time.

**Solutions:**

1. **Remove event listeners:**

```typescript
const handler = () => { ... };
player.on('timeupdate', handler);

// Later
player.off('timeupdate', handler);
```

2. **Clean up object URLs:**

```typescript
const url = URL.createObjectURL(blob);
img.src = url;

// After using
URL.revokeObjectURL(url);
```

## Browser-Specific Issues

### Firefox: WebCodecs Not Supported

**Symptom:** Playback fails on Firefox.

**Solution:** Movi-Player automatically falls back to software decoding. Ensure you're using the latest version.

### Safari: Fullscreen Issues

**Symptom:** Fullscreen doesn't work on Safari.

**Solution:**

```typescript
// Use webkit-prefixed API
const element = document.querySelector("movi-player");
if (element.webkitRequestFullscreen) {
  element.webkitRequestFullscreen();
} else {
  element.requestFullscreen();
}
```

### Mobile: Touch Not Working

**Symptom:** Touch gestures don't respond.

**Solution:**

```css
movi-player {
  touch-action: none; /* Enable custom touch handling */
}
```

## Debugging

### Enable Debug Logging

```typescript
// Before creating player
localStorage.setItem("movi-debug", "true");

// Or check movi logs filter
// In Chrome DevTools > Console > Filter: "movi"
```

### Get Player State

```typescript
console.log("State:", player.getState());
console.log("Current time:", player.getCurrentTime());
console.log("Duration:", player.getDuration());
console.log("Video tracks:", player.getVideoTracks());
console.log("Audio tracks:", player.getAudioTracks());
```

### Export Debug Info

```typescript
function getDebugInfo(player: MoviPlayer) {
  const state = player.getState();
  return {
    state,
    currentTime: player.getCurrentTime(),
    duration: player.getDuration(),
    videoTrack: player.getVideoTracks()[0],
    audioTrack: player.getAudioTracks()[0],
    paused: state === "paused",
    volume: player.getVolume(),
    muted: player.getMuted(),
    playbackRate: player.getPlaybackRate(),
    softwareDecoding: player.isSoftwareDecoding(),
    bufferedTime: player.getBufferedTime(),
    userAgent: navigator.userAgent,
  };
}

console.log(JSON.stringify(getDebugInfo(player), null, 2));
```

## Getting Help

If you can't resolve an issue:

1. **Check GitHub Issues:** [movi-player/issues](https://github.com/MrUjjwalG/movi-player/issues)

2. **Create a minimal reproduction** on CodeSandbox or StackBlitz

3. **Include debug info** when reporting issues
