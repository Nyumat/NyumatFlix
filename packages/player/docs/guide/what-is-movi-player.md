# What is Movi-Player?

Movi-Player is a **modern, modular video player** for the web powered by WebCodecs and FFmpeg WASM.

## The Problem

Traditional web video players have limitations:

- 🚫 **Limited Format Support** - Only MP4/WebM with specific codecs
- 🚫 **No HDR** - Can't detect or render HDR content
- 🚫 **Server Processing** - Need backend for format conversion
- 🚫 **Large Bundle** - All-or-nothing approach

## The Solution

Movi-Player solves these problems with:

### 🎯 Modular Architecture

Use only what you need:

| Module                | Size   | Use Case                |
| --------------------- | ------ | ----------------------- |
| `movi-player/demuxer` | ~45KB  | Metadata, HDR detection |
| `movi-player/player`  | ~180KB | Playback control        |
| `movi-player` (full)  | ~410KB | Complete UI             |

### ⚡ WebCodecs + FFmpeg WASM

- **Hardware acceleration** via WebCodecs API
- **Universal fallback** via FFmpeg WASM
- **No server required** - all processing in browser

### 🌈 HDR Support

- HDR10, HLG, Dolby Vision metadata extraction
- BT.2020 wide color gamut
- Display-P3 rendering

### 📦 Universal Format Support

- **Containers**: MP4, MKV, WebM, MOV, MPEG-TS
- **Video**: H.264, H.265/HEVC, VP9, AV1
- **Audio**: AAC, MP3, Opus, FLAC, AC-3

## Who Uses Movi-Player?

Movi-Player is ideal for:

- 🎬 **Streaming platforms** needing HDR support
- 📹 **Video editors** processing local files
- 🏥 **Medical imaging** playing DICOM videos
- 🎮 **Gaming platforms** showing replays
- 📚 **Educational sites** with multi-track support

## Browser Support

| Browser      | WebCodecs | HDR |
| ------------ | --------- | --- |
| Chrome 94+   | ✅        | ✅  |
| Edge 94+     | ✅        | ✅  |
| Safari 16.4+ | ✅        | ✅  |
| Firefox      | ❌        | ❌  |

::: info Firefox Support
Firefox WebCodecs support is expected in Q2 2026. Movi-Player will automatically use FFmpeg WASM fallback.
:::
