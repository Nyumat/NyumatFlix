# Movi Architecture Documentation

**Comprehensive Technical Overview**

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Core Principles](#core-principles)
3. [Component Architecture](#component-architecture)
4. [Data Flow](#data-flow)
5. [Technology Stack](#technology-stack)
6. [Module System](#module-system)
7. [Memory Management](#memory-management)
8. [Performance Optimization](#performance-optimization)
9. [Standards Compliance](#standards-compliance)
10. [Future Roadmap](#future-roadmap)

---

## System Overview

Movi is a **modular streaming video library** for browsers that provides:

- **Pull-based streaming** for efficient memory usage
- **Hardware-first decoding** with automatic software fallback
- **HDR support** with proper color space handling
- **Multi-track** audio/video/subtitle selection
- **Professional UI** via custom HTML element

### Design Philosophy

1. **Modular by Default:** Three export levels (demuxer, player, full element)
2. **Standards-First:** ISO/ITU-T compliance for interoperability
3. **Performance-Critical:** Zero-copy I/O, hardware acceleration
4. **User-Friendly:** Drop-in `<video>` replacement with enhanced features

---

## Core Principles

### 1. Pull-Based Streaming

**Traditional Push Model:**

```
Server → [Full File] → Client Memory → Play
```

Problems: High memory, slow start, no seeking until fully loaded

**Movi Pull Model:**

```
Client → [Request Chunk] → Server
       ← [Chunk Data]    ←
Client → Demux → Decode → Render
```

Benefits: Low memory, instant start, random access

### 2. Hardware-First Decoding

**Decision Tree:**

```
┌─────────────────┐
│ Video Packet    │
└────────┬────────┘
         │
    Try WebCodecs (Hardware)
         │
    ┌────▼────┐
    │Success? │
    └────┬────┘
         │
    Yes  │  No
    ┌────▼────┐  ┌───────────┐
    │ Render  │  │ Try WASM  │
    └─────────┘  │ (Software)│
                 └─────┬─────┘
                       │
                   ┌───▼────┐
                   │ Render │
                   └────────┘
```

### 3. Audio-Master Synchronization

**Why Audio-Master?**

- Audio glitches are **highly noticeable** (pops/clicks)
- Video frame drops are **less noticeable** (motion blur)
- Web Audio API provides **precise timing**

**Implementation:**

```typescript
// Audio renderer is the master clock
const audioTime = audioRenderer.getAudioClock();

// Video syncs to audio
if (videoFrame.timestamp <= audioTime) {
  renderFrame(videoFrame);
} else {
  waitForAudio(); // Video ahead, pause until audio catches up
}
```

---

## Component Architecture

### High-Level View

```
┌─────────────────────────────────────────────────────────────┐
│                     Movi Library                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Export Level 1: Demuxer                  │  │
│  │                 (movi/demuxer)                        │  │
│  │                    ~45KB                              │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │  • FFmpeg WASM (libavformat)                          │  │
│  │  • Container parsing (MP4, MKV, WebM, etc.)           │  │
│  │  • Packet extraction                                  │  │
│  │  • Metadata reading                                   │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Export Level 2: Player                   │  │
│  │                 (movi/player)                         │  │
│  │                   ~180KB                              │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │  • Demuxer +                                          │  │
│  │  • Decoders (Video, Audio, Subtitle)                  │  │
│  │  • Renderers (Canvas, Audio)                          │  │
│  │  • State management                                   │  │
│  │  • A/V synchronization                                │  │
│  │  • Track management                                   │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Export Level 3: Element                  │  │
│  │                   (movi)                              │  │
│  │                   ~410KB                              │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │  • Player +                                           │  │
│  │  • Custom HTML element (<movi-player>)                │  │
│  │  • UI controls                                        │  │
│  │  • Gestures (tap, swipe, pinch)                       │  │
│  │  • Theme system                                       │  │
│  │  • Ambient mode                                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Component Dependency Graph

```
                    MoviElement (Web Component)
                           │
                           ▼
                      MoviPlayer
                     ╱     │     ╲
                    ╱      │      ╲
                   ╱       │       ╲
                  ▼        ▼        ▼
            Demuxer   TrackManager  Clock
                │          │         │
                ▼          ▼         ▼
           WasmBindings  Decoders  Renderers
                │          │         │
                ▼          ▼         ▼
           FFmpeg WASM  WebCodecs  WebGL2/WebAudio
```

---

## Data Flow

### Playback Pipeline

```
┌──────────────────────────────────────────────────────────────┐
│ 1. SOURCE LAYER                                              │
├──────────────────────────────────────────────────────────────┤
│  HttpSource (Range Requests) │ FileSource (LRU Cache)        │
│  • SharedArrayBuffer mode     │ • 1MB chunks                 │
│  • Zero-copy transfer         │ • 64-chunk cache             │
└────────────────┬─────────────────────────────────────────────┘
                 │ read(offset, size) → ArrayBuffer
                 ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. DEMUX LAYER                                               │
├──────────────────────────────────────────────────────────────┤
│  Demuxer → WasmBindings → FFmpeg WASM (Asyncify)             │
│  • Container parsing (ISO BMFF, Matroska)                    │
│  • Track enumeration (codec, resolution, bitrate)            │
│  • Packet extraction (PTS, DTS, keyframe flag)               │
│  • Seeking (keyframe index)                                  │
└────────────────┬─────────────────────────────────────────────┘
                 │ readPacket() → Packet { data, timestamp, ... }
                 ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. TRACK SELECTION LAYER                                     │
├──────────────────────────────────────────────────────────────┤
│  TrackManager                                                │
│  • Filters packets by stream index                           │
│  • Handles track switching                                   │
│  • Language/quality selection                                │
└─────────┬─────────────────┬─────────────────┬────────────────┘
          │ Video           │ Audio           │ Subtitle
          ▼                 ▼                 ▼
┌─────────────────┐ ┌─────────────────┐ ┌──────────────────┐
│ 4. DECODE LAYER │ │                 │ │                  │
├─────────────────┤ ├─────────────────┤ ├──────────────────┤
│ MoviVideoDecoder│ │MoviAudioDecoder │ │ SubtitleDecoder  │
│                 │ │                 │ │                  │
│ Try WebCodecs   │ │ Try WebCodecs   │ │ Text/Image parse │
│   ↓ (Fail)      │ │   ↓ (Fail)      │ │                  │
│ WASM Fallback   │ │ WASM Fallback   │ │                  │
│                 │ │                 │ │                  │
│ → VideoFrame    │ │ → AudioData     │ │ → SubtitleCue    │
└────────┬────────┘ └────────┬────────┘ └────────┬─────────┘
         │                   │                   │
         ▼                   ▼                   ▼
┌──────────────────────────────────────────────────────────────┐
│ 5. SYNCHRONIZATION LAYER                                     │
├──────────────────────────────────────────────────────────────┤
│  Clock (Audio-Master)                                        │
│  • Audio renderer = master clock                             │
│  • Video syncs to audio time                                 │
│  • Subtitle syncs to audio time                              │
└────────┬─────────────────────────────────────────────────────┘
         │ getTime() → currentTime
         ▼
┌──────────────────────────────────────────────────────────────┐
│ 6. RENDER LAYER                                              │
├──────────────────────────────────────────────────────────────┤
│  CanvasRenderer (WebGL2)     AudioRenderer (Web Audio API)   │
│  • Frame queue (120 frames)  • Audio buffer (2 seconds)      │
│  • 60Hz presentation loop    • Sample scheduling             │
│  • HDR support (P3 canvas)   • Volume control                │
│  • Subtitle overlay          • Clock provider                │
└──────────────────────────────────────────────────────────────┘
                 │
                 ▼
         ┌──────────────────┐
         │  USER OUTPUT     │
         │  Screen + Audio  │
         └──────────────────┘
```

---

## Technology Stack

### Core Technologies

| Layer                 | Technology            | Purpose                      |
| --------------------- | --------------------- | ---------------------------- |
| **Container Parsing** | FFmpeg WASM           | Universal format support     |
| **Video Decoding**    | WebCodecs API         | Hardware acceleration        |
| **Audio Decoding**    | WebCodecs API         | Hardware acceleration        |
| **Video Rendering**   | WebGL2                | GPU-accelerated, HDR support |
| **Audio Rendering**   | Web Audio API         | High-precision timing        |
| **UI**                | Web Components        | Custom element, Shadow DOM   |
| **Async I/O**         | Asyncify (Emscripten) | WASM async operations        |
| **Language**          | TypeScript            | Type safety, tooling         |

### FFmpeg WASM Configuration

**Compilation Flags:**

```bash
-s ASYNCIFY=1              # Enable async/await in WASM
-s ASYNCIFY_STACK_SIZE=128KB  # Stack for suspended calls
-s ALLOW_MEMORY_GROWTH=1   # Dynamic memory allocation
-s EXPORTED_FUNCTIONS=[...] # Export only needed functions
```

**Enabled FFmpeg Components:**

- `libavformat` - Container demuxing
- `libavcodec` - Software decode (fallback)
- `libswscale` - Frame scaling (thumbnails)
- `libswresample` - Audio resampling

**Disabled Components:**

- Filters (not needed, saves 500KB+)
- Muxers (read-only library)
- Encoders (playback only)

**Size Optimization:**

- Strip debug symbols: `--strip-all`
- Dead code elimination: `--gc-sections`
- LTO (Link-Time Optimization): `-flto`
- Result: ~4MB WASM (vs ~20MB full FFmpeg)

---

## Module System

### Export Structure

```typescript
// movi/demuxer (Minimal - 45KB)
export { Demuxer } from "./demux/Demuxer";
export { HttpSource, FileSource } from "./source";
export type { SourceAdapter, MediaInfo, Track } from "./types";

// movi/player (Core - 180KB)
export { MoviPlayer } from "./core/MoviPlayer";
export { Demuxer } from "./demux/Demuxer";
export { HttpSource, FileSource } from "./source";
export type { PlayerConfig, PlayerState, PlayerEventMap } from "./types";

// movi (Full - 410KB)
export { MoviElement } from "./render/MoviElement";
export { MoviPlayer } from "./core/MoviPlayer";
export { Demuxer } from "./demux/Demuxer";
export * from "./types";

// Auto-register custom element
customElements.define("movi-player", MoviElement);
```

### Tree-Shaking

Modern bundlers can tree-shake unused components:

```typescript
// Only imports Demuxer (~45KB)
import { Demuxer } from "movi-player/demuxer";

// Only imports Player (~180KB)
import { MoviPlayer } from "movi-player/player";

// Imports everything (~410KB)
import { MoviElement } from "movi-player";
```

---

## Memory Management

### WASM Memory Layout

```
┌─────────────────────────────────────────────────────┐
│                  WASM Heap                          │
│                 (Dynamic Growth)                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │  FFmpeg Context (~10MB)                      │   │
│  │  • AVFormatContext (demuxer state)           │   │
│  │  • AVCodecContext (decoder state)            │   │
│  │  • I/O buffers                               │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │  Packet Buffers (~10-20MB)                   │   │
│  │  • Encoded video/audio packets               │   │
│  │  • Temporary decode buffers                  │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │  Frame Buffers (Software Decode)             │   │
│  │  • Only used for fallback decoding           │   │
│  │  • ~50MB for 4K YUV frames                   │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
Total WASM: ~50-80MB (varies by video resolution)
```

### JavaScript Memory

```
┌─────────────────────────────────────────────────────┐
│               JavaScript Heap                       │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │  Video Frame Queue (~1.5GB for 4K)           │   │
│  │  • 120 VideoFrame objects                    │   │
│  │  • Each ~12MB (3840×2160 YUV 4:2:0)          │   │
│  │  • GPU textures (video memory)               │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │  Audio Buffer (~384KB)                       │   │
│  │  • 2 seconds × 48kHz × 2ch × 4B              │   │
│  │  • Float32Array buffers                      │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │  HTTP Cache (64MB default)                   │   │
│  │  • Recently fetched chunks                   │   │
│  │  • LRU eviction policy                       │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
Total JS: ~1.5-2GB (4K), ~200-400MB (1080p)
```

### Memory Optimization Strategies

1. **Frame Queue Adaptive Sizing:**

   ```typescript
   const queueSize = frameRate > 40 ? 120 : 60;
   // 60fps → 120 frames (~2s buffer)
   // 30fps → 60 frames (~2s buffer)
   ```

2. **VideoFrame Lifecycle:**

   ```typescript
   // Create from decoder
   const frame = decodedFrame;

   // Use for rendering
   renderToCanvas(frame);

   // CRITICAL: Close when done
   frame.close(); // Frees GPU memory
   ```

3. **Packet Pooling:**

   ```typescript
   // Reuse packet buffers instead of allocating new ones
   const packetPool = new PacketPool(maxSize);
   const packet = packetPool.acquire();
   // ... use packet
   packetPool.release(packet);
   ```

4. **Lazy Initialization:**
   ```typescript
   // Don't create decoders until needed
   if (!this.videoDecoder && hasVideoPacket) {
     this.videoDecoder = new MoviVideoDecoder();
   }
   ```

---

## Performance Optimization

### Zero-Copy I/O (SharedArrayBuffer Mode)

**Traditional HTTP Streaming:**

```
Server → Network → ArrayBuffer (Copy 1) → WASM (Copy 2) → Use
```

**Zero-Copy Mode:**

```
Server → Network → SharedArrayBuffer → WASM (Direct Access)
```

**Implementation:**

```typescript
class HttpSource {
  private sharedBuffer: SharedArrayBuffer | null = null;

  async read(offset: number, size: number): Promise<ArrayBuffer> {
    if (this.sharedBuffer) {
      // Zero-copy: WASM reads directly from shared memory
      const view = new Uint8Array(this.sharedBuffer, offset, size);
      return view.buffer;
    } else {
      // Fallback: Copy to ArrayBuffer
      const response = await fetch(url, {
        headers: { Range: `bytes=${offset}-${offset + size - 1}` },
      });
      return response.arrayBuffer();
    }
  }
}
```

**Requirements (for this optional fast-path only):**

- HTTPS (cross-origin isolation)
- Headers: `Cross-Origin-Opener-Policy: same-origin`
- Headers: `Cross-Origin-Embedder-Policy: require-corp`

> These headers are **not** required to play. The WASM engine is single-threaded with Asyncify I/O, so without `SharedArrayBuffer` the `else` branch above (a plain-buffer copy) is used and HTTP streaming works normally — the shared buffer is purely a zero-copy optimisation.

---

### Hardware Acceleration

**WebCodecs Decision Tree:**

```typescript
class MoviVideoDecoder {
  async tryHardwareDecode(packet: Packet) {
    try {
      // 1. Check if codec supported
      const config = {
        codec: "hvc1.2.4.L153.B0",
        optimizeForLatency: true,
      };

      const support = await VideoDecoder.isConfigSupported(config);
      if (!support.supported) {
        throw new Error("Codec not supported");
      }

      // 2. Try decode
      const decoder = new VideoDecoder({
        output: (frame) => this.onFrame(frame),
        error: (err) => this.onError(err),
      });

      decoder.configure(config);
      decoder.decode(
        new EncodedVideoChunk({
          type: packet.keyframe ? "key" : "delta",
          timestamp: packet.timestamp * 1e6,
          data: packet.data,
        }),
      );

      return true; // Success
    } catch (error) {
      console.warn("Hardware decode failed, trying software:", error);
      return false;
    }
  }

  async trySoftwareDecode(packet: Packet) {
    // Fallback to FFmpeg WASM
    const frame = await this.wasmDecoder.decode(packet);
    return frame;
  }
}
```

---

### Intelligent Buffering

**Back-Pressure Algorithm:**

```typescript
class MoviPlayer {
  private async demuxLoop() {
    while (this.playing) {
      // Check buffer health
      const videoQueueSize = this.videoRenderer.getQueueSize();
      const audioQueueSize = this.audioRenderer.getQueueSize();

      // Apply back-pressure if buffers full
      if (videoQueueSize > 100 || audioQueueSize > 100) {
        await sleep(50); // Slow down demuxing
        continue;
      }

      // Read next packet
      const packet = await this.demuxer.readPacket();
      if (!packet) break;

      // Route to appropriate decoder
      if (packet.streamIndex === this.selectedVideoTrack) {
        await this.videoDecoder.decode(packet);
      } else if (packet.streamIndex === this.selectedAudioTrack) {
        await this.audioDecoder.decode(packet);
      }
    }
  }
}
```

**Benefits:**

- Prevents memory overflow
- Reduces decode latency
- Smooth playback even on slow devices

---

## Standards Compliance

### ISO/IEC 14496-15: Codec Configuration Parsing

**Example: HEVC (hvcC box) Parsing**

```typescript
// Binary structure (ISO/IEC 14496-15 Section 8.3.3.1.2)
class CodecParser {
  static parseHEVC(data: Uint8Array): string {
    const reader = new BitReader(data);

    // Byte 0: configurationVersion
    const version = reader.readBits(8);

    // Byte 1:
    const profileSpace = reader.readBits(2); // general_profile_space
    const tierFlag = reader.readBits(1); // general_tier_flag
    const profileIdc = reader.readBits(5); // general_profile_idc

    // Bytes 2-5: general_profile_compatibility_flags
    const compatFlags = reader.readBits(32);

    // Bytes 6-11: general_constraint_indicator_flags
    const constraints = [];
    for (let i = 0; i < 6; i++) {
      constraints.push(reader.readBits(8));
    }

    // Byte 12: general_level_idc
    const levelIdc = reader.readBits(8);

    // Generate codec string per spec
    const profileSpaceChar = ["", "A", "B", "C"][profileSpace];
    const tierChar = tierFlag ? "H" : "L";

    return `hvc1.${profileSpaceChar}${profileIdc}.${compatFlags.toString(16)}.${tierChar}${levelIdc}`;
  }
}
```

**Standards Reference:**

- ISO/IEC 14496-15:2022 - Carriage of NAL unit structured video in the ISO Base Media File Format
- Section 8.3.3.1.2: HEVC decoder configuration record

---

### ITU-T H.273: Color Space Identification

**Mapping Table Implementation:**

```typescript
// ITU-T Recommendation H.273 (12/2016)
class ColorSpaceMapper {
  // Table 2: Colour primaries
  static readonly COLOR_PRIMARIES = {
    1: "bt709", // Rec. ITU-R BT.709-6
    2: "unspecified",
    4: "bt470m", // Rec. ITU-R BT.470-6 System M
    5: "bt470bg", // Rec. ITU-R BT.470-6 System B, G
    6: "smpte170m", // SMPTE 170M (NTSC)
    7: "smpte240m", // SMPTE 240M
    8: "film", // Film
    9: "bt2020", // Rec. ITU-R BT.2020-2
    10: "smpte428", // SMPTE ST 428-1
    11: "p3dci", // DCI-P3
    12: "p3d65", // Display P3
    22: "ebu3213", // EBU Tech. 3213-E
  };

  // Table 3: Transfer characteristics
  static readonly TRANSFER_CHARACTERISTICS = {
    1: "bt709", // Rec. ITU-R BT.709-6
    4: "gamma22", // Gamma 2.2
    5: "gamma28", // Gamma 2.8
    6: "smpte170m", // SMPTE 170M
    7: "smpte240m", // SMPTE 240M
    8: "linear", // Linear transfer
    13: "iec61966-2-4", // IEC 61966-2-4
    14: "bt1361", // Rec. ITU-R BT.1361-0
    15: "iec61966-2-1", // IEC 61966-2-1 (sRGB)
    16: "bt2020-10", // Rec. ITU-R BT.2020-2 (10-bit)
    17: "bt2020-12", // Rec. ITU-R BT.2020-2 (12-bit)
    18: "pq", // SMPTE ST 2084 (PQ)
    19: "smpte428", // SMPTE ST 428-1
    20: "hlg", // ARIB STD-B67 (HLG)
  };

  // Table 4: Matrix coefficients
  static readonly MATRIX_COEFFICIENTS = {
    0: "identity", // Identity matrix
    1: "bt709", // Rec. ITU-R BT.709-6
    4: "fcc", // FCC
    5: "bt470bg", // Rec. ITU-R BT.470-6 System B, G
    6: "smpte170m", // SMPTE 170M
    7: "smpte240m", // SMPTE 240M
    8: "ycocg", // YCoCg
    9: "bt2020-ncl", // Rec. ITU-R BT.2020-2 (non-constant)
    10: "bt2020-cl", // Rec. ITU-R BT.2020-2 (constant)
  };
}
```

---

## Future Roadmap

### Q1 2026

- [x] ISO standards compliance verification
- [x] Comprehensive documentation
- [ ] Unit test coverage (80%+)
- [ ] Performance benchmarking suite

### Q2 2026

- [ ] Firefox WebCodecs support (when available)
- [ ] Dolby Vision metadata parsing
- [ ] AV1 sequence header parsing for advanced color info
- [ ] Full HEVC SPS VUI parser (optional, low priority)

### Q3 2026

- [ ] Adaptive Bitrate Streaming (ABR) support
- [ ] Live streaming (DASH, HLS)
- [ ] DRM support (Widevine, PlayReady)
- [ ] Chromecast integration

### Q4 2026

- [ ] React/Vue/Svelte wrapper components
- [ ] Server-side rendering (SSR) compatibility
- [ ] Advanced analytics (QoE metrics)
- [ ] Plugin system for custom decoders

---

## Summary

Movi's architecture provides:

✅ **Modular Design:** Three export levels for different use cases
✅ **Standards Compliance:** ISO/ITU-T adherence for interoperability
✅ **Performance:** Zero-copy I/O, hardware acceleration, intelligent buffering
✅ **User Experience:** Professional UI, gesture support, HDR rendering
✅ **Flexibility:** Custom element, programmatic API, multi-track support
✅ **Reliability:** Error recovery, fallback decoding, robust state management

**Target Use Cases:**

- Video streaming platforms
- Media players
- Video editors (web-based)
- Live streaming applications
- Educational platforms
- Digital signage

---

**Last Updated:** February 5, 2026
