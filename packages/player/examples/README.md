# movi-player examples

Runnable examples for the player. Plain-HTML demos work by opening the file
(served over a cross-origin-isolated origin so the WASM demuxer keeps
`SharedArrayBuffer`); the framework examples drop into any Vite app.

## Plain web component

| File | Shows |
| --- | --- |
| [`index.html`](./index.html) | Quick start — a single `<movi-player>` tag |
| [`element.html`](./element.html) | The full attribute / API / event surface |
| [`demuxer.html`](./demuxer.html) | Using the demuxer standalone (no player UI) |
| [`youtube.html`](./youtube.html) | A YouTube-style page built on the player |

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/movi-player/dist/element.js"></script>
<movi-player src="video.mkv" controls autoplay></movi-player>
```

## Frameworks

Typed wrappers live in [`../packages`](../packages). Each example here is the
app component; drop it into a Vite project and install the deps shown.

| Framework | Example | Install |
| --- | --- | --- |
| React | [`react/App.tsx`](./react/App.tsx) | `npm i movi-player @movi-player/react` |
| Vue 3 | [`vue/App.vue`](./vue/App.vue) | `npm i movi-player @movi-player/vue` |
| Svelte | [`svelte/App.svelte`](./svelte/App.svelte) | `npm i movi-player @movi-player/svelte` |

All three surface the same things: declarative attributes, the `movi-qoe`
analytics stream, a ref/bind to the underlying `MoviElement`, and 200% audio
boost via `element.volume = 2`.

> Note: `examples/` used to be a git submodule (movi-player-examples). It's now
> an in-repo directory so the examples version and test alongside the player.
