# Demuxer API

The Demuxer module provides media file parsing, packet extraction, and metadata extraction using FFmpeg WASM.

## Installation

```typescript
import { Demuxer, HttpSource, FileSource } from "movi-player/demuxer";
```

## Basic Usage

```typescript
import { Demuxer, HttpSource } from "movi-player/demuxer";

// Create source and demuxer
const source = new HttpSource("https://example.com/video.mp4");
const demuxer = new Demuxer(source);

// Open and get media info
const mediaInfo = await demuxer.open();

console.log("Format:", mediaInfo.formatName);
console.log("Duration:", mediaInfo.duration);
console.log("Tracks:", mediaInfo.tracks.length);

// Get specific tracks
const videoTracks = demuxer.getVideoTracks();
const audioTracks = demuxer.getAudioTracks();
const subtitleTracks = demuxer.getSubtitleTracks();

// Cleanup
demuxer.close();
```

## Exports

The `movi-player/demuxer` module exports:

### Classes

| Export                 | Description                     |
| ---------------------- | ------------------------------- |
| `Demuxer`              | Main demuxer class              |
| `HttpSource`           | HTTP/HTTPS source adapter       |
| `FileSource`           | Local file source adapter       |
| `ThumbnailHttpSource`  | Optimized source for thumbnails |
| `MoviVideoDecoder`     | WebCodecs video decoder         |
| `MoviAudioDecoder`     | WebCodecs audio decoder         |
| `SubtitleDecoder`      | Subtitle parser/decoder         |
| `SoftwareVideoDecoder` | Software video decoder fallback |
| `SoftwareAudioDecoder` | Software audio decoder fallback |
| `CodecParser`          | Codec string parser             |
| `LRUCache`             | LRU cache implementation        |
| `WasmBindings`         | Low-level WASM bindings         |
| `ThumbnailBindings`    | Thumbnail WASM bindings         |
| `EventEmitter`         | Event emitter utility           |
| `Logger`               | Logging utility                 |
| `Time`                 | Time conversion utilities       |
| `ThumbnailRenderer`    | Thumbnail rendering utility     |

### Factory Functions

| Export                           | Description                |
| -------------------------------- | -------------------------- |
| `createHttpSource(url)`          | Create HttpSource          |
| `createFileSource(file)`         | Create FileSource          |
| `createThumbnailHttpSource(url)` | Create ThumbnailHttpSource |
| `loadWasmModule(options)`        | Load shared WASM module    |
| `loadWasmModuleNew(options)`     | Load new WASM instance     |
| `getWasmModule()`                | Get loaded WASM module     |
| `isWasmModuleLoaded()`           | Check if WASM is loaded    |

### Types

```typescript
import type {
  // Track types
  Track,
  TrackType,
  VideoTrack,
  AudioTrack,
  SubtitleTrack,
  SubtitleCue,

  // Config types
  SourceConfig,
  CacheConfig,
  RendererType,
  DecoderType,
  PlayerConfig,

  // Media types
  MediaInfo,
  Packet,
  DecodedVideoFrame,
  DecodedAudioFrame,

  // Decoder configs
  VideoDecoderConfig,
  AudioDecoderConfig,

  // State types
  PlayerState,
  PlayerEventMap,

  // WASM types
  MoviWasmModule,
  StreamInfo,
  PacketInfo,
  DataSource,
  SourceAdapter,
} from "movi-player/demuxer";
```

## Demuxer Class

### Constructor

```typescript
new Demuxer(
  source: SourceAdapter,
  wasmBinary?: Uint8Array,
  useNewWasmInstance?: boolean
)
```

| Parameter            | Type            | Description                                 |
| -------------------- | --------------- | ------------------------------------------- |
| `source`             | `SourceAdapter` | Data source (HttpSource or FileSource)      |
| `wasmBinary`         | `Uint8Array`    | Optional embedded WASM binary               |
| `useNewWasmInstance` | `boolean`       | Create isolated WASM instance (for preview) |

### Methods

#### `open(): Promise<MediaInfo>`

Open media file and parse metadata.

```typescript
const info = await demuxer.open();

console.log(info.formatName); // 'mp4', 'matroska', etc.
console.log(info.duration); // Duration in seconds
console.log(info.bitRate); // Bitrate
console.log(info.startTime); // Start time offset
console.log(info.tracks); // Array of tracks
console.log(info.metadata); // { title?: string, ... }
```

#### `getTracks(): Track[]`

Get all tracks.

```typescript
const tracks = demuxer.getTracks();
```

#### `getVideoTracks(): VideoTrack[]`

Get video tracks only.

```typescript
const videoTracks = demuxer.getVideoTracks();

videoTracks.forEach((track) => {
  console.log(`Track ${track.id}:`);
  console.log(`  Codec: ${track.codec}`);
  console.log(`  Resolution: ${track.width}x${track.height}`);
  console.log(`  Frame Rate: ${track.frameRate}`);
  console.log(`  HDR: ${track.isHDR}`);
  console.log(`  Color Primaries: ${track.colorPrimaries}`);
  console.log(`  Color Transfer: ${track.colorTransfer}`);
  console.log(`  Color Space: ${track.colorSpace}`);
});
```

#### `getAudioTracks(): AudioTrack[]`

Get audio tracks only.

```typescript
const audioTracks = demuxer.getAudioTracks();

audioTracks.forEach((track) => {
  console.log(`Track ${track.id}:`);
  console.log(`  Codec: ${track.codec}`);
  console.log(`  Channels: ${track.channels}`);
  console.log(`  Sample Rate: ${track.sampleRate}`);
  console.log(`  Language: ${track.language}`);
});
```

#### `getSubtitleTracks(): SubtitleTrack[]`

Get subtitle tracks only.

```typescript
const subtitleTracks = demuxer.getSubtitleTracks();

subtitleTracks.forEach((track) => {
  console.log(`Track ${track.id}:`);
  console.log(`  Codec: ${track.codec}`);
  console.log(`  Type: ${track.subtitleType}`); // 'text' | 'image'
  console.log(`  Language: ${track.language}`);
});
```

#### `getExtradata(trackId: number): Uint8Array | null`

Get codec extradata for a track.

```typescript
const extradata = demuxer.getExtradata(0);
if (extradata) {
  console.log("Extradata size:", extradata.length);
}
```

#### `getDuration(): number`

Get media duration in seconds.

```typescript
const duration = demuxer.getDuration();
```

#### `seek(timestamp: number, flags?: number): Promise<void>`

Seek to timestamp.

```typescript
await demuxer.seek(60.5); // Seek to 60.5 seconds
```

#### `readPacket(): Promise<Packet | null>`

Read next packet from stream.

```typescript
const packet = await demuxer.readPacket();

if (packet) {
  console.log("Stream:", packet.streamIndex);
  console.log("Keyframe:", packet.keyframe);
  console.log("PTS:", packet.timestamp);
  console.log("DTS:", packet.dts);
  console.log("Duration:", packet.duration);
  console.log("Data size:", packet.data.length);
}
```

#### `close(): void`

Close and cleanup resources.

```typescript
demuxer.close();
```

## Type Definitions

### MediaInfo

```typescript
interface MediaInfo {
  formatName: string; // Container format ('mp4', 'matroska', 'webm')
  duration: number; // Duration in seconds
  bitRate: number; // Overall bitrate
  startTime: number; // Start time offset
  tracks: Track[]; // All tracks
  metadata?: {
    title?: string;
    [key: string]: string;
  };
}
```

### VideoTrack

```typescript
interface VideoTrack {
  id: number;
  type: "video";
  codec: string; // 'h264', 'hevc', 'vp9', etc.
  width: number;
  height: number;
  frameRate: number;
  bitRate?: number;
  profile?: number;
  level?: number;
  language?: string;
  label?: string;
  rotation?: number; // 0, 90, 180, 270
  pixelFormat?: string;
  colorRange?: string;

  // HDR metadata
  isHDR?: boolean;
  colorPrimaries?: string; // 'bt709', 'bt2020', etc.
  colorTransfer?: string; // 'bt709', 'smpte2084', 'arib-std-b67'
  colorSpace?: string; // 'bt709', 'bt2020-ncl', 'bt2020-cl'

  extradata?: Uint8Array;
}
```

### AudioTrack

```typescript
interface AudioTrack {
  id: number;
  type: "audio";
  codec: string; // 'aac', 'mp3', 'opus', 'flac', etc.
  channels: number; // 1, 2, 6, 8
  sampleRate: number; // 44100, 48000, etc.
  bitRate?: number;
  language?: string; // 'eng', 'jpn', 'spa'
  label?: string; // 'English 5.1', 'Commentary'
  extradata?: Uint8Array;
}
```

### SubtitleTrack

```typescript
interface SubtitleTrack {
  id: number;
  type: "subtitle";
  codec: string; // 'subrip', 'ass', 'webvtt', 'hdmv_pgs_subtitle'
  subtitleType: "text" | "image";
  language?: string;
  label?: string;
  extradata?: Uint8Array;
}
```

### Packet

```typescript
interface Packet {
  streamIndex: number; // Track ID
  keyframe: boolean; // Is keyframe?
  timestamp: number; // PTS in seconds
  dts: number; // DTS in seconds
  duration: number; // Duration in seconds
  data: Uint8Array; // Raw packet data
}
```

## Use Cases

### Extract Video Metadata

```typescript
import { Demuxer, HttpSource } from "movi-player/demuxer";

async function getVideoInfo(url: string) {
  const source = new HttpSource(url);
  const demuxer = new Demuxer(source);

  const info = await demuxer.open();
  const video = demuxer.getVideoTracks()[0];
  const audio = demuxer.getAudioTracks()[0];

  const result = {
    format: info.formatName,
    duration: info.duration,
    title: info.metadata?.title,

    video: video
      ? {
          codec: video.codec,
          resolution: `${video.width}x${video.height}`,
          frameRate: video.frameRate,
          isHDR: video.isHDR,
          hdrFormat:
            video.colorTransfer === "smpte2084"
              ? "HDR10"
              : video.colorTransfer === "arib-std-b67"
                ? "HLG"
                : "SDR",
        }
      : null,

    audio: audio
      ? {
          codec: audio.codec,
          channels: audio.channels,
          sampleRate: audio.sampleRate,
          language: audio.language,
        }
      : null,

    subtitles: demuxer.getSubtitleTracks().map((s) => ({
      language: s.language,
      codec: s.codec,
    })),
  };

  demuxer.close();
  return result;
}
```

### Detect HDR Content

```typescript
import { Demuxer, HttpSource } from "movi-player/demuxer";

async function isHDR(url: string): Promise<boolean> {
  const source = new HttpSource(url);
  const demuxer = new Demuxer(source);

  await demuxer.open();

  const video = demuxer.getVideoTracks()[0];
  const isHDR = video?.isHDR ?? false;

  demuxer.close();
  return isHDR;
}
```

### List Available Languages

```typescript
import { Demuxer, FileSource } from "movi-player/demuxer";

async function getAvailableLanguages(file: File) {
  const source = new FileSource(file);
  const demuxer = new Demuxer(source);

  await demuxer.open();

  const audioLanguages = demuxer
    .getAudioTracks()
    .map((t) => t.language)
    .filter(Boolean);

  const subtitleLanguages = demuxer
    .getSubtitleTracks()
    .map((t) => t.language)
    .filter(Boolean);

  demuxer.close();

  return {
    audio: [...new Set(audioLanguages)],
    subtitles: [...new Set(subtitleLanguages)],
  };
}
```

### Read Packets (Advanced)

```typescript
import { Demuxer, HttpSource } from "movi-player/demuxer";

async function analyzeKeyframes(url: string) {
  const source = new HttpSource(url);
  const demuxer = new Demuxer(source);

  await demuxer.open();

  const keyframes: number[] = [];
  let packetCount = 0;

  // Read first 1000 packets
  while (packetCount < 1000) {
    const packet = await demuxer.readPacket();
    if (!packet) break;

    if (packet.keyframe && packet.streamIndex === 0) {
      keyframes.push(packet.timestamp);
    }

    packetCount++;
  }

  demuxer.close();

  console.log("Keyframe timestamps:", keyframes);
  console.log(
    "Average keyframe interval:",
    keyframes.length > 1
      ? (keyframes[keyframes.length - 1] - keyframes[0]) /
          (keyframes.length - 1)
      : 0,
  );

  return keyframes;
}
```

### Validate Video File

```typescript
import { Demuxer, FileSource } from "movi-player/demuxer";

async function validateVideo(file: File): Promise<{
  valid: boolean;
  error?: string;
  info?: any;
}> {
  try {
    const source = new FileSource(file);
    const demuxer = new Demuxer(source);

    const info = await demuxer.open();

    const videoTracks = demuxer.getVideoTracks();
    if (videoTracks.length === 0) {
      demuxer.close();
      return { valid: false, error: "No video track found" };
    }

    const video = videoTracks[0];

    // Check resolution
    if (video.width < 100 || video.height < 100) {
      demuxer.close();
      return { valid: false, error: "Resolution too small" };
    }

    // Check duration
    if (info.duration < 1) {
      demuxer.close();
      return { valid: false, error: "Duration too short" };
    }

    const result = {
      valid: true,
      info: {
        format: info.formatName,
        duration: info.duration,
        resolution: `${video.width}x${video.height}`,
        codec: video.codec,
      },
    };

    demuxer.close();
    return result;
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
```

## Supported Formats

### Containers

| Format  | Extensions             | Notes           |
| ------- | ---------------------- | --------------- |
| MP4     | `.mp4`, `.m4v`, `.m4a` | Most common     |
| MKV     | `.mkv`, `.mka`         | Multi-track     |
| WebM    | `.webm`                | VP8/VP9/AV1     |
| MOV     | `.mov`                 | Apple QuickTime |
| MPEG-TS | `.ts`, `.m2ts`         | Broadcast       |
| AVI     | `.avi`                 | Legacy          |
| FLV     | `.flv`                 | Flash Video     |
| OGG     | `.ogg`, `.ogv`         | Vorbis/Theora   |

### Video Codecs

| Codec      | Description                       |
| ---------- | --------------------------------- |
| H.264/AVC  | Most common, hardware accelerated |
| H.265/HEVC | 4K/HDR, better compression        |
| VP8        | WebM, older                       |
| VP9        | WebM, good compression            |
| AV1        | Next-gen, best compression        |
| MPEG-4     | Legacy                            |
| Theora     | Open source                       |

### Audio Codecs

| Codec  | Description        |
| ------ | ------------------ |
| AAC    | Most common        |
| MP3    | Legacy, universal  |
| Opus   | Modern, efficient  |
| FLAC   | Lossless           |
| Vorbis | Open source        |
| AC-3   | Dolby, surround    |
| E-AC-3 | Dolby Digital Plus |
| DTS    | Surround           |
| PCM    | Uncompressed       |

### Subtitle Formats

| Format  | Type  | Description       |
| ------- | ----- | ----------------- |
| SRT     | Text  | Simple timed text |
| ASS/SSA | Text  | Styled subtitles  |
| WebVTT  | Text  | Web standard      |
| PGS     | Image | Blu-ray           |
| VobSub  | Image | DVD               |
| DVB     | Image | Broadcast         |
