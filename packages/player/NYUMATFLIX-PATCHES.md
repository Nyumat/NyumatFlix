# NyumatFlix patches applied to vendored movi-player v0.3.5

1. **tabindex** — `MoviElement.ts`: do not set `tabindex="0"` on custom element
2. **post-seek sync** — `MoviPlayer.ts`: `AUDIO_SYNC_GAP_LIMIT` 0.2 → 0 (video-first)
3. **demux audio starving** — `MoviPlayer.ts`: `audioBuffered < 0.1` → `0.05`
4. **stall audio low** — `MoviPlayer.ts`: stall threshold `0.05` → `0.02`
5. **isAudioStarved** — `AudioRenderer.ts`: buffer bar `0.1` → `0.05`
6. **native presentation** — Phase 1: `presentation: native|canvas` auto-select; adaptive/MP4/DRM → light-DOM `<video>` without canvas rVFC copy loop
7. **compat bundle** — `movi-player/compat` entry without eager WASM; lazy WASM via dynamic import in `FFmpegLoader.ts`
8. **browser matrix** — Safari native HLS first; Firefox prefers hls.js; Cast hidden on Firefox/canvas mode

Previously applied via regex in `scripts/prepare-movi-player.mjs` (now builds `@nyumatflix/player` directly).
