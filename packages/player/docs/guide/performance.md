# Performance Guide

Optimize Movi-Player for best performance.

## Bundle Size Optimization

### Use Only What You Need

```typescript
// ❌ Imports everything (~410KB)
import "movi-player";

// ✅ Import only demuxer (~45KB)
import { Demuxer } from "movi-player/demuxer";

// ✅ Import only player (~180KB)
import { MoviPlayer } from "movi-player/player";
```

### Dynamic Import

```typescript
// Load player only when needed
const playButton = document.getElementById("play");

playButton.onclick = async () => {
  const { MoviPlayer } = await import("movi-player/player");

  const player = new MoviPlayer({
    source: { type: "url", url: "video.mp4" },
    canvas: document.getElementById("canvas"),
  });

  await player.load();
  await player.play();
};
```

## Memory Optimization

### Cache Configuration

```typescript
// Reduce cache for memory-constrained environments
const player = new MoviPlayer({
  source: { type: "url", url },
  canvas,
  cache: {
    maxSizeMB: 50, // Default is 100MB
  },
});
```

### Cleanup

```typescript
// Always destroy players when done
player.destroy();

// React example
useEffect(() => {
  const player = new MoviPlayer({ ... });

  return () => {
    player.destroy();
  };
}, []);

// Vue example
onUnmounted(() => {
  player.destroy();
});
```

### Single Player Instance

```typescript
// Avoid multiple concurrent players
let currentPlayer: MoviPlayer | null = null;

function loadVideo(url: string) {
  // Destroy previous player
  if (currentPlayer) {
    currentPlayer.destroy();
  }

  currentPlayer = new MoviPlayer({
    source: { type: "url", url },
    canvas,
  });
}
```

## Decoding Optimization

### Hardware-First (default)

```typescript
// "auto" tries hardware (WebCodecs) first and falls back to software on failure.
const player = new MoviPlayer({
  source: { type: "url", url },
  canvas,
  decoder: "auto", // default
});
```

### Force Software Decoding

```typescript
// Use when hardware decode is producing visual artifacts on a particular file.
const player = new MoviPlayer({
  source: { type: "url", url },
  canvas,
  decoder: "software",
});
```

### Decoder Selection Logic

```
"auto" (default)
└── Try WebCodecs (GPU-accelerated, low CPU)
    └── On configure/decode failure → fall back to FFmpeg WASM (software)

"software"
└── Always FFmpeg WASM — universal format support, higher CPU
```

::: tip There is no "hardware" value
`DecoderType` is `"auto" | "software"`. There's no explicit `"hardware"` flag — `"auto"` already prefers hardware, and falls back automatically when hardware can't handle a stream.
:::

## Rendering

```typescript
// "canvas" is the only renderer today.
const player = new MoviPlayer({
  source: { type: "url", url },
  canvas,
  renderer: "canvas",
});
```

DRM/HLS playback paths internally hand off to a native `<video>` element + EME, but that is selected automatically when `drm: true` is configured — there is no separate `"mse"` renderer setting.

## Network Optimization

### Preload Metadata

```html
<!-- Preload only metadata -->
<movi-player src="video.mp4" preload="metadata"></movi-player>
```

### Lazy Loading

```typescript
// Don't load until needed
const player = new MoviPlayer({
  source: { type: "url", url },
  canvas,
});

// Load only when user clicks play
playButton.onclick = async () => {
  await player.load();
  await player.play();
};
```

### Adaptive Buffer Sizing

For programmatic-API multi-quality, drive HLS streams (the only supported quality-switching path) and let `hls.js` handle ABR. For non-HLS sources, scale the prefetch window based on connection quality:

```typescript
function tuneBufferForConnection(player: MoviPlayer) {
  const connection = (navigator as any).connection;
  if (!connection) return;

  const downlink = connection.downlink; // Mbps
  if (downlink < 3) {
    player.setMaxBufferSize(60);  // 60 MB on slow links
  } else if (downlink < 10) {
    player.setMaxBufferSize(150);
  } else {
    player.setMaxBufferSize(400); // Generous on fast connections
  }
}
```

## Thumbnail Generation

### Efficient Thumbnail Generation

`getPreviewFrame()` runs on an isolated WASM instance, so it doesn't disturb playback. Generate frames sequentially — parallel calls would just queue on the same WASM worker.

```typescript
async function generateThumbnails(
  player: MoviPlayer,
  count: number = 10,
): Promise<Blob[]> {
  const duration = player.getDuration();
  const interval = duration / count;
  const thumbnails: Blob[] = [];

  for (let i = 0; i < count; i++) {
    const time = i * interval;
    const blob = await player.getPreviewFrame(time);
    if (blob) thumbnails.push(blob);
  }

  return thumbnails;
}
```

### Thumbnail Caching

```typescript
const thumbnailCache = new Map<number, string>();

async function getThumbnail(player: MoviPlayer, time: number): Promise<string | null> {
  const key = Math.floor(time / 10) * 10; // 10s buckets

  if (thumbnailCache.has(key)) {
    return thumbnailCache.get(key)!;
  }

  const blob = await player.getPreviewFrame(key);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  thumbnailCache.set(key, url);

  return url;
}
```

## Event Throttling

### Throttle Time Updates

```typescript
let lastUpdate = 0;

player.on("timeUpdate", (currentTime: number) => {
  const now = Date.now();

  // Limit to 4 updates per second
  if (now - lastUpdate < 250) return;
  lastUpdate = now;

  updateUI(currentTime);
});
```

### Debounce Seek

```typescript
let seekTimeout: number;

progressBar.oninput = () => {
  clearTimeout(seekTimeout);

  seekTimeout = window.setTimeout(() => {
    const time = parseFloat(progressBar.value);
    player.seek(time);
  }, 100);
};
```

## Monitoring Performance

### FPS Counter

```typescript
let frameCount = 0;
let lastTime = performance.now();

player.on("frame", () => {
  frameCount++;

  const now = performance.now();
  if (now - lastTime >= 1000) {
    console.log("FPS:", frameCount);
    frameCount = 0;
    lastTime = now;
  }
});
```

### Memory Monitoring

```typescript
function logMemoryUsage() {
  if ((performance as any).memory) {
    const memory = (performance as any).memory;
    console.log("Memory:", {
      usedJSHeapSize: `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
      totalJSHeapSize: `${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
    });
  }
}

setInterval(logMemoryUsage, 5000);
```

## Best Practices

1. **Destroy players when done**
2. **Use appropriate module** (demuxer vs player vs element)
3. **Match decoder to content** (hardware for common codecs)
4. **Throttle frequent events**
5. **Cache thumbnails**
6. **Select appropriate quality**
7. **Use lazy loading**
8. **Monitor memory usage**
