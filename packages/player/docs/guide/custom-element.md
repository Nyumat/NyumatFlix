# Custom Element

The `<movi-player>` custom element is a drop-in replacement for the native `<video>` element with enhanced capabilities.

## Basic Usage

```html
<script type="module">
  import "movi-player";
</script>

<movi-player
  src="video.mp4"
  controls
  autoplay
  muted
  style="width: 100%; height: 500px;"
></movi-player>
```

## Attributes

### Standard Video Attributes

| Attribute  | Type      | Default | Description                                   |
| ---------- | --------- | ------- | --------------------------------------------- |
| `src`      | `string`  | -       | Video URL or can be set to File object via JS |
| `controls` | `boolean` | `false` | Show player controls                          |
| `autoplay` | `boolean` | `false` | Start playing when loaded                     |
| `muted`    | `boolean` | `false` | Mute audio                                    |
| `loop`     | `boolean` | `false` | Loop playback                                 |
| `poster`   | `string`  | -       | Poster image URL                              |
| `width`    | `number`  | -       | Player width in pixels                        |
| `height`   | `number`  | -       | Player height in pixels                       |

### Enhanced Attributes

| Attribute     | Type                | Values                             | Description                                       |
| ------------- | ------------------- | ---------------------------------- | ------------------------------------------------- |
| `objectfit`   | `string`            | `contain`, `cover`, `fill`, `zoom` | Video scaling mode                                |
| `theme`       | `string`            | `dark`, `light`                    | UI theme                                          |
| `hdr`         | `boolean`           | -                                  | Enable HDR rendering                              |
| `ambientmode` | `boolean`           | -                                  | Ambient background effects                        |
| `renderer`    | `string`            | `canvas` (only)                    | Rendering backend (HLS/DRM auto-pick separately)  |
| `sw`          | `boolean`, `string` | `auto`                             | Decoder mode (`auto`, `true`/`software`, `false`) |
| `fps`         | `number`            | -                                  | Custom frame rate override                        |
| `thumb`       | `boolean`           | -                                  | Enable seek preview thumbnails                    |
| `fastseek`    | `boolean`           | -                                  | Enable skip buttons and gestures                  |
| `showtitle`   | `boolean`           | -                                  | Show video title bar                              |
| `resume`      | `boolean`           | -                                  | Resume from last position                         |
| `stablevolume`| `boolean`           | -                                  | Loudness normalization                            |
| `startat`     | `number`            | -                                  | Start at time (seconds)                           |
| `playsinline` | `boolean`           | -                                  | Play inline (no iOS auto-fullscreen); on any touch device, suppress swipe/volume gestures while inline so they don't fight page scroll (fullscreen unaffected) |
| `gesturefs`   | `boolean`           | -                                  | **Deprecated** — use `playsinline` |
| `nohotkeys`   | `boolean`           | -                                  | Disable keyboard shortcuts                        |
| `noerrorscreen` | `boolean`         | -                                  | Suppress the built-in error overlays              |
| `encrypted`   | `boolean`           | -                                  | Encrypted playback mode                           |
| `tokenurl`    | `string`            | -                                  | Token endpoint (encrypted mode)                   |
| `videourl`    | `string`            | -                                  | Video endpoint (encrypted mode)                   |
| `videoid`     | `string`            | -                                  | Video ID (encrypted mode)                         |
| `drm`         | `boolean`           | -                                  | DRM mode for HLS (native video + EME)             |
| `licenseurl`  | `string`            | -                                  | Widevine/FairPlay license server URL              |
| `subtitledelay` | `number`          | -                                  | Subtitle offset in seconds (positive = later)     |
| `subtitlesize` | `number`           | `1`                                | Subtitle size multiplier                          |
| `subtitlecolor` | `string`          | `#FFFFFF`                          | Subtitle text color                               |
| `subtitlebg`   | `number`           | `0.75`                             | Subtitle background opacity (0..1)                |
| `subtitleedge` | `string`           | `none`, `shadow`, `outline`, `raised` | Subtitle edge style                            |
| `postertime`  | `string`            | -                                  | Generate poster from timestamp (`5`, `1:30`, `10%`) |

## Examples

### Dark Theme with HDR

```html
<movi-player
  src="hdr-video.mp4"
  controls
  theme="dark"
  hdr
  style="width: 100%; max-width: 1280px; aspect-ratio: 16/9;"
></movi-player>
```

### Cover Mode (Fill Container)

```html
<movi-player
  src="video.mp4"
  controls
  objectfit="cover"
  style="width: 100%; height: 100vh;"
></movi-player>
```

### Multi-Track via `<source>` and `<track>`

Ship a full multi-quality + multi-language + multi-subtitle setup as plain HTML — the player parses these children at connect time, so no JS source setter is needed:

```html
<movi-player controls>
  <!-- Quality picker (data-height + data-label) -->
  <source src="movie-1080p.mp4" type="video/mp4" data-height="1080" data-default>
  <source src="movie-720p.mp4"  type="video/mp4" data-height="720">

  <!-- Parallel-language audio tracks -->
  <source src="audio-en.m4a" type="audio/mp4" kind="audio" srclang="en" label="English" default>
  <source src="audio-hi.m4a" type="audio/mp4" kind="audio" srclang="hi" label="Hindi">

  <!-- Sidecar subtitles -->
  <track src="subs-en.vtt" srclang="en" label="English" kind="subtitles" default>
  <track src="subs-jp.srt" srclang="ja" label="Japanese" kind="subtitles" data-format="srt">
</movi-player>
```

See [Multi-Track Support](./multi-track.md) for the audio default-pick order and the full attribute reference.

### Ambient Mode

Ambient mode applies a dynamic glow effect around the player by sampling the video colors and applying them to a wrapper element.

To enable this, you must:

1. Add the `ambientmode` attribute.
2. Provide the ID of the wrapper element via the `ambientwrapper` attribute.

```html
<div
  id="my-player-container"
  style="padding: 50px; background: #000; transition: background 0.5s ease;"
>
  <movi-player
    src="video.mp4"
    controls
    ambientmode
    ambientwrapper="my-player-container"
    theme="dark"
  ></movi-player>
</div>
```

::: warning Important
The wrapper element should have enough padding to show the glow and its `overflow` should NOT be `hidden`.
:::

### Software Decoding (SW)

By default, Movi-Player uses hardware-accelerated decoding. You can control the fallback behavior using the `sw` attribute:

- `sw="auto"`: **Seamless Fallback (Recommended)**. If hardware fails, the player automatically switches to software and reloads the video without user intervention.
- Omitted (No attribute): **User-Triggered Fallback**. If hardware fails, a "Try Software Decoding" button appears for the user to manually switch.
- `sw` or `sw="true"`: **Force Software**. Uses FFmpeg WASM regardless of hardware support.
- `sw="false"`: **Force Hardware**. Disables software fallback and doesn't show the recovery button.

### Decoder Fallback UX

Depending on the `sw` mode, the recovery process differs:

1. **Automatic (`sw="auto"`)**: If hardware decoding fails (unsupported codec or runtime error), the player shows a brief loading state and resumes playback in software mode.
2. **Manual (Default)**: If hardware fails, an error overlay appears with a **"Try Software Decoding"** button. Playback only resumes after the user clicks the button.

This ensures a reliable experience even when hardware limits are hit, without forcing inefficient software decoding for everyone.

## JavaScript API

### Properties

```javascript
const player = document.querySelector("movi-player");

// Read/Write properties
player.src = "new-video.mp4";
player.currentTime = 60; // Seek to 60s
player.volume = 0.5; // 50% volume
player.muted = true;
player.loop = true;
player.playbackRate = 1.5;
player.sw = "auto"; // "auto", true (software), false (hardware-first)

// Read-only properties
console.log(player.duration); // Total duration
console.log(player.paused); // Is paused?
console.log(player.ended); // Has ended?
console.log(player.readyState); // Loading state
```

### Methods

```javascript
// Playback control
await player.play();
player.pause();

// Seek
player.currentTime = 120; // Seek to 2:00

// Fullscreen
player.requestFullscreen();
document.exitFullscreen();
```

### Events

```javascript
// Standard video events
player.addEventListener("play", () => console.log("Playing"));
player.addEventListener("pause", () => console.log("Paused"));
player.addEventListener("ended", () => console.log("Ended"));
player.addEventListener("timeupdate", () => {
  console.log("Time:", player.currentTime);
});
player.addEventListener("loadedmetadata", () => {
  console.log("Duration:", player.duration);
});

// Error handling
player.addEventListener("error", (e) => {
  console.error("Error:", e.detail);
});
```

## Track Selection

### Audio Tracks

```javascript
const player = document.querySelector("movi-player");

// Get audio languages
const audioLangs = player.getAudioLangs();
console.log(audioLangs);
// [{ lang: 'eng', label: 'English', active: true },
//  { lang: 'jpn', label: 'Japanese', active: false }]

// Switch audio by language code
player.selectAudioLang("jpn");
```

### Subtitle Tracks

```javascript
// Get available subtitles
const subtitleLangs = player.getSubtitleLangs();

// Enable a subtitle by language
await player.selectSubtitleLang("eng");

// Disable subtitles
await player.selectSubtitleLang(null);
```

### Video Quality

For HLS streams, the built-in quality menu (gear icon → Quality) handles switching automatically. The element doesn't expose a programmatic `selectVideoTrack()` for non-HLS multi-bitrate sources — point `src` at a different file or use the `MoviPlayer` programmatic API for advanced cases.

## Gestures

The player includes built-in gesture support:

| Gesture              | Action                             |
| -------------------- | ---------------------------------- |
| **Tap**              | Play/Pause                         |
| **Double Tap Left**  | Seek -10s                          |
| **Double Tap Right** | Seek +10s                          |
| **Swipe Left/Right** | Seek ±10s (mobile)                 |
| **Swipe Up/Down**    | Volume (mobile)                    |
| **Pinch**            | Zoom (when objectfit="zoom")       |
| **Hover**            | Show controls (auto-hide after 3s) |

## Context Menu

Right-click (or long-press on mobile) shows a context menu with:

- Playback speed (0.25x - 2x)
- Aspect ratio (contain/cover/fill/zoom)
- Audio/subtitle track selection
- HDR toggle
- Picture-in-Picture
- Fullscreen
- Rotate video
- Loop toggle
- Stable volume
- Snapshot
- Timeline
- Stats for nerds

## Styling

### CSS Custom Properties

```css
movi-player {
  --movi-primary-color: #646cff;
  --movi-bg-color: rgba(0, 0, 0, 0.8);
  --movi-text-color: #ffffff;
  --movi-progress-color: #646cff;
  --movi-buffer-color: rgba(255, 255, 255, 0.3);
}
```

### Full Width Responsive

```css
movi-player {
  width: 100%;
  max-width: 1920px;
  aspect-ratio: 16 / 9;
  margin: 0 auto;
}
```

## React Integration

```tsx
import { useEffect, useRef } from "react";
import "movi-player";

// Type declaration for TypeScript
declare global {
  namespace JSX {
    interface IntrinsicElements {
      "movi-player": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          controls?: boolean;
          autoplay?: boolean;
          muted?: boolean;
          loop?: boolean;
        },
        HTMLElement
      >;
    }
  }
}

function VideoPlayer({ src }: { src: string }) {
  const playerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const player = playerRef.current;

    const handleTimeUpdate = () => {
      console.log("Time:", (player as any).currentTime);
    };

    player?.addEventListener("timeupdate", handleTimeUpdate);

    return () => {
      player?.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, []);

  return (
    <movi-player
      ref={playerRef}
      src={src}
      controls
      style={{ width: "100%", height: "500px" }}
    />
  );
}

export default VideoPlayer;
```

## Vue Integration

```vue
<script setup lang="ts">
import { ref, onMounted } from "vue";
import "movi-player";

const playerRef = ref<HTMLElement | null>(null);

onMounted(() => {
  const player = playerRef.value;

  player?.addEventListener("timeupdate", () => {
    console.log("Time:", (player as any).currentTime);
  });
});
</script>

<template>
  <movi-player
    ref="playerRef"
    src="video.mp4"
    controls
    style="width: 100%; height: 500px;"
  />
</template>
```

## Next.js Integration

```tsx
"use client";

import { useEffect, useRef } from "react";

export default function VideoPlayer({ src }: { src: string }) {
  const playerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // Dynamic import for client-side only
    import("movi-player");
  }, []);

  return (
    <movi-player
      ref={playerRef as any}
      src={src}
      controls
      style={{ width: "100%", height: "500px" }}
    />
  );
}
```
