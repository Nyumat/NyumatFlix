# Getting Started

![Movi Player Showcase](../images/element.gif)

Welcome! Movi-Player is designed to be easy to integrate whether you want a drop-in video player or a powerful programmatic API for professional workflows.

## Choose Your Path

There are two main ways to use Movi-Player:

::: details 🧩 Custom Element (Recommended)
**Best for:** Most websites, blogs, and apps.
The easiest way. Works just like a standard `<video>` tag but with HDR, MKV support, and premium UI.
[Skip to Custom Element Guide](#quick-start-custom-element)
:::

::: details ⚙️ Programmatic API
**Best for:** Video editors, players with custom UIs, and performance-critical apps.
Gives you full control over demuxing, decoding, and rendering.
[Skip to Programmatic API Guide](#quick-start-programmatic-api)
:::

---

## 🏎️ Quick Start: Custom Element {#quick-start-custom-element}

The fastest way to get Movi-Player running in your browser.

### 1. Installation

Install via your preferred package manager:

::: code-group

```bash [npm]
npm install movi-player
```

```bash [yarn]
yarn add movi-player
```

```bash [pnpm]
pnpm add movi-player
```

:::

### 2. Implementation

Simply import the library and use the `<movi-player>` tag.

```html
<script type="module">
  import "movi-player";
</script>

<movi-player
  src="https://example.com/video.mp4"
  controls
  autoplay
  muted
  style="width: 100%; height: 500px; border-radius: 8px; overflow: hidden;"
></movi-player>
```

---

## 🛠️ Quick Start: Programmatic API {#quick-start-programmatic-api}

If you need lower-level control, use the `MoviPlayer` core class.

```typescript
import { MoviPlayer } from "movi-player/player";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const player = new MoviPlayer({
  source: {
    type: "url",
    url: "video.mp4",
  },
  canvas: canvas,
});

// Load and play
await player.load();
await player.play();
```

---

## ⚡ Try it without Install (CDN)

Perfect for quick prototypes or testing.

```html
<script type="module">
  import "https://unpkg.com/movi-player@latest/dist/element.js";
</script>

<movi-player src="video.mp4" controls></movi-player>
```

---

## CORS & Headers

Movi-Player runs on a **single-threaded** WebAssembly engine with Asyncify I/O, so it does **not** require `SharedArrayBuffer` or cross-origin isolation to play. For videos served over HTTP your server needs:

1.  **Range Requests:** Required for seeking in large files.
2.  **CORS Headers:** If your video is on a different domain.
3.  **COI Headers (_optional_):** Cross-origin isolation is **not required** — the player no longer hard-blocks or shows a "Security Headers Missing" screen without it. Setting these two headers only enables an **optional zero-copy `SharedArrayBuffer` fast-path** for HTTP streaming; without them `HttpSource` uses a plain-buffer path and streams normally.
    - `Cross-Origin-Opener-Policy: same-origin`
    - `Cross-Origin-Embedder-Policy: require-corp`

Check whether the fast-path is active with `console.log(crossOriginIsolated)`.

**Want the fast-path but can't modify server headers?** A **Service Worker** can inject the COI headers client-side (optional — playback works without it):

```javascript
// sw.js
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).then((response) => {
      const newHeaders = new Headers(response.headers);
      newHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
      newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    })
  );
});

// Register in your app
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
```

Or drop in [`coi-serviceworker`](https://github.com/gzuidhof/coi-serviceworker) which does this for you (one extra page reload on first visit).

::: tip Local Files
If you are playing local files using `FileSource` (drag & drop), you do **not** need to worry about CORS or COOP/COEP at all — local playback never touches the network.
:::

## 🚀 Next Steps

- **[Why Movi-Player?](/guide/why-movi-player)** - Learn about HDR and format support.
- **[Custom Element API](/guide/custom-element)** - Explore all attributes and methods.
- **[Local File Playback](/guide/local-files)** - Build "no-upload" video apps.
- **[Troubleshooting](/guide/troubleshooting)** - Common setup issues and fixes.
