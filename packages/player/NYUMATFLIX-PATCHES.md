# NyumatFlix patches applied to vendored movi-player v0.3.5

1. **tabindex** — `MoviElement.ts`: do not set `tabindex="0"` on custom element
2. **post-seek sync** — `MoviPlayer.ts`: `AUDIO_SYNC_GAP_LIMIT` 0.2 → 0 (video-first)
3. **demux audio starving** — `MoviPlayer.ts`: `audioBuffered < 0.1` → `0.05`
4. **stall audio low** — `MoviPlayer.ts`: stall threshold `0.05` → `0.02`
5. **isAudioStarved** — `AudioRenderer.ts`: buffer bar `0.1` → `0.05`

Previously applied via regex in `scripts/prepare-movi-player.mjs`.
