# movi-player framework wrappers

Thin, typed wrappers around the `<movi-player>` web component so you can drop the
player into React, Vue, or Svelte with real prop/event typing instead of an
untyped custom element. Every wrapper is a shim over the same engine — the
codec/VR/encrypted feature set is identical; only the ergonomics change.

| Package | Import |
| --- | --- |
| [`@movi-player/react`](./react) | `import { MoviPlayer } from "@movi-player/react"` |
| [`@movi-player/vue`](./vue) | `import { MoviPlayer } from "@movi-player/vue"` |
| [`@movi-player/svelte`](./svelte) | `import MoviPlayer from "@movi-player/svelte"` |

## React

```tsx
import { MoviPlayer } from "@movi-player/react";

<MoviPlayer
  src="video.mkv"
  controls
  autoplay
  theme="dark"
  onQoe={(e) => console.log(e.type, e)}
  onReady={(el) => console.log("duration", el.duration)}
/>;
```

`ref` forwards the underlying `MoviElement`, so `ref.current.play()`,
`ref.current.getQoeSession()`, etc. all work and are typed.

## Vue 3

```vue
<script setup lang="ts">
import { MoviPlayer } from "@movi-player/vue";
</script>

<template>
  <MoviPlayer src="video.mkv" controls autoplay @qoe="(e) => console.log(e)" />
</template>
```

## Svelte

```svelte
<script>
  import MoviPlayer from "@movi-player/svelte";
  let player;
</script>

<MoviPlayer bind:element={player} src="video.mkv" controls autoplay
  on:movi-qoe={(e) => console.log(e.detail)} />
```

## Plain web component (no framework)

```ts
import "movi-player/element"; // registers <movi-player>
const el = document.querySelector("movi-player")!; // typed as MoviElement
el.setAnalyticsBeacon("/qoe"); // POST QoE events
```

## QoE analytics

Every wrapper surfaces the `movi-qoe` event stream (`session_start`, `startup`,
`rebuffer`, `bitrate_switch`, `decode_fallback`, `error`, `heartbeat`, `ended`).
Forward it to Mux / GA4 / your endpoint, or use the built-in beacon sink:

```ts
import { beaconSink } from "movi-player/element";
el.addQoeSink(beaconSink("https://example.com/qoe"));
```

## Theming

Override the documented `--movi-*` custom properties from anywhere in your CSS:

```css
movi-player {
  --movi-primary: #7c5cff;   /* accent / progress fill */
  --movi-chrome-fg: #eaeaea; /* control-bar text/icons */
  --movi-surface: #14141c;   /* menu / panel background */
  --movi-btn-size: 40px;
}
```
