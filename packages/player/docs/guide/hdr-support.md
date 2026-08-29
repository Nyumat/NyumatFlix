# HDR Support

Movi-Player provides comprehensive HDR (High Dynamic Range) support for metadata extraction and rendering.

## HDR Detection

### Quick Detection

```typescript
import { MoviPlayer } from "movi-player/player";

const player = new MoviPlayer({
  source: { type: "url", url: "hdr-video.mp4" },
  canvas: document.getElementById("canvas") as HTMLCanvasElement,
});

await player.load();

const videoTrack = player.getVideoTracks()[0];

// Simple HDR check
if (videoTrack.isHDR) {
  console.log("🌈 HDR content detected!");
} else {
  console.log("📺 SDR content");
}
```

### Detailed HDR Information

```typescript
const videoTrack = player.getVideoTracks()[0];

console.log("Color Information:");
console.log(`  Primaries: ${videoTrack.colorPrimaries}`);
console.log(`  Transfer: ${videoTrack.colorTransfer}`);
console.log(`  Matrix: ${videoTrack.colorSpace}`);

// Determine HDR format
if (videoTrack.colorTransfer === "smpte2084") {
  console.log("Format: HDR10 (PQ - Perceptual Quantizer)");
} else if (videoTrack.colorTransfer === "arib-std-b67") {
  console.log("Format: HLG (Hybrid Log-Gamma)");
}

// Check for wide color gamut
if (videoTrack.colorPrimaries === "bt2020") {
  console.log("Color Gamut: BT.2020 (Wide Color Gamut)");
} else if (videoTrack.colorPrimaries === "bt709") {
  console.log("Color Gamut: BT.709 (Standard)");
}
```

## HDR Formats

| Format           | Transfer Function | Color Primaries | Common Use             |
| ---------------- | ----------------- | --------------- | ---------------------- |
| **HDR10**        | `smpte2084` (PQ)  | `bt2020`        | Streaming, UHD Blu-ray |
| **HLG**          | `arib-std-b67`    | `bt2020`        | Broadcasting           |
| **Dolby Vision** | `smpte2084`       | `bt2020`        | Premium streaming      |
| **HDR10+**       | `smpte2084`       | `bt2020`        | Samsung TVs            |

## Using Demuxer Only

Extract HDR metadata without playing the video:

```typescript
import { Demuxer, HttpSource } from "movi-player/demuxer";

async function analyzeHDR(url: string) {
  const source = new HttpSource(url);
  const demuxer = new Demuxer(source);

  await demuxer.open();

  const videoTrack = demuxer.getVideoTracks()[0];

  const analysis = {
    resolution: `${videoTrack.width}x${videoTrack.height}`,
    codec: videoTrack.codec,
    bitDepth: videoTrack.codec.includes("Main10") ? 10 : 8,
    isHDR: videoTrack.isHDR,
    hdrFormat: "SDR",
    colorPrimaries: videoTrack.colorPrimaries,
    colorTransfer: videoTrack.colorTransfer,
    colorMatrix: videoTrack.colorSpace,
  };

  // Determine HDR format
  if (videoTrack.isHDR) {
    if (videoTrack.colorTransfer === "smpte2084") {
      analysis.hdrFormat = "HDR10";
    } else if (videoTrack.colorTransfer === "arib-std-b67") {
      analysis.hdrFormat = "HLG";
    } else {
      analysis.hdrFormat = "Unknown HDR";
    }
  }

  demuxer.close();

  return analysis;
}

// Usage
const hdrInfo = await analyzeHDR("https://example.com/4k-hdr.mp4");
console.log(hdrInfo);
// {
//   resolution: '3840x2160',
//   codec: 'hvc1.2.4.L153.B0',
//   bitDepth: 10,
//   isHDR: true,
//   hdrFormat: 'HDR10',
//   colorPrimaries: 'bt2020',
//   colorTransfer: 'smpte2084',
//   colorMatrix: 'bt2020-ncl'
// }
```

## HDR Rendering

### Enable HDR Mode

```html
<!-- Custom Element with HDR -->
<movi-player src="hdr-video.mp4" controls hdr></movi-player>
```

### Programmatic HDR

```typescript
const player = new MoviPlayer({
  source: { type: "url", url: "hdr-video.mp4" },
  canvas: document.getElementById("canvas") as HTMLCanvasElement,
  renderer: "canvas", // Canvas renderer supports HDR
});
```

### Display-P3 Rendering

Movi-Player automatically uses Display-P3 color space when available:

```typescript
const canvas = document.getElementById("canvas") as HTMLCanvasElement;

// Check Display-P3 support
const ctx = canvas.getContext("2d", { colorSpace: "display-p3" });
if (ctx) {
  console.log("Display-P3 supported! HDR rendering enabled.");
} else {
  console.log("Display-P3 not supported. Falling back to sRGB.");
}
```

## HDR Detection Logic

The `isHDR` property uses multi-layered detection:

```typescript
// Detection priority:
// 1. Explicit color metadata from container
// 2. 4K resolution heuristic (≥3840×2160)
// 3. HEVC Main10 profile

function detectHDR(track: VideoTrack): boolean {
  // Check transfer function (most reliable)
  const hdrTransfer = ["smpte2084", "arib-std-b67"];
  if (hdrTransfer.includes(track.colorTransfer)) {
    return true;
  }

  // Check color primaries
  if (track.colorPrimaries === "bt2020") {
    return true;
  }

  // 4K heuristic (often HDR)
  if (track.width >= 3840 && track.height >= 2160) {
    // Additional checks for 4K content
    if (track.codec.includes("hvc1") || track.codec.includes("hev1")) {
      return true; // HEVC 4K is usually HDR
    }
  }

  return false;
}
```

## Color Space Values

### Color Primaries

| Value      | Description | Gamut          |
| ---------- | ----------- | -------------- |
| `bt709`    | Standard HD | SDR            |
| `bt2020`   | Ultra HD    | HDR Wide Gamut |
| `p3`       | Display P3  | Wide Gamut     |
| `smpte431` | DCI-P3      | Cinema         |

### Transfer Functions

| Value          | Description          | Type    |
| -------------- | -------------------- | ------- |
| `bt709`        | Standard gamma       | SDR     |
| `smpte2084`    | Perceptual Quantizer | HDR10   |
| `arib-std-b67` | Hybrid Log-Gamma     | HLG     |
| `linear`       | Linear light         | Editing |

### Color Matrix

| Value        | Description                |
| ------------ | -------------------------- |
| `bt709`      | Standard HD                |
| `bt2020-ncl` | UHD non-constant luminance |
| `bt2020-cl`  | UHD constant luminance     |

## Browser HDR Support

| Browser      | Display-P3 | HDR Video |
| ------------ | ---------- | --------- |
| Chrome 94+   | ✅         | ✅        |
| Edge 94+     | ✅         | ✅        |
| Safari 16.4+ | ✅         | ✅        |
| Firefox      | ❌         | ❌        |

::: warning Display Requirements
HDR rendering requires:

- HDR-capable display
- Display-P3 color space support
- WebGL2 for tone mapping
  :::

## HDR Badge Component

```typescript
function HDRBadge({ videoTrack }: { videoTrack: VideoTrack }) {
  if (!videoTrack.isHDR) return null;

  let format = 'HDR';
  let color = '#00ff00';

  if (videoTrack.colorTransfer === 'smpte2084') {
    format = 'HDR10';
    color = '#ff6b00';
  } else if (videoTrack.colorTransfer === 'arib-std-b67') {
    format = 'HLG';
    color = '#00ccff';
  }

  return (
    <span style={{
      background: color,
      color: 'black',
      padding: '2px 6px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: 'bold',
    }}>
      {format}
    </span>
  );
}
```

## Test HDR Videos

Free HDR test content:

- [4K HDR Demo Clips](https://4kmedia.org/)
- [YouTube HDR Test Videos](https://www.youtube.com/playlist?list=PLbpi6ZahtOH6Blw3RGYpWkSByi_T7Rygb)
- [Kodi HDR Test Files](https://kodi.wiki/view/Samples)
