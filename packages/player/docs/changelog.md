# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.5] - 2026-07-11

### Added
- **Captions rotate with the video**: rotating the video (`R` / menu) turns the subtitles with it and keeps them on the rotated bottom edge — text and image (PGS/VobSub) subtitles both.
- **Blurred backdrop for embedded album art**: audio with *embedded* cover art now gets the same blurred-artwork backdrop as poster-based audio, instead of a plain dark background.

### Fixed
- **Fullscreen: the right-click / gear menu wouldn't open**: the menu portals to a body-level layer to escape page clipping, but in fullscreen the player is the fullscreen element so that layer rendered outside it — the menu now stays within the player in fullscreen.
- **Context-menu toggles didn't reflect their new state**: Ambient Mode / Stable Volume / Loop / Rotate / HDR toggled from the menu now update their On/Off label and highlight (the state was written to the wrong place while the menu was portaled).
- **Volume slider offered a 200% boost on native audio**: a single external audio source plays through a native `<audio>` element that can't boost — the slider now caps at 100% there.

### Changed
- **Wider context-menu submenus**: audio-track and audio-output submenus are wider so long track / device names don't wrap.

## [0.3.4] - 2026-07-11

### Added
- **OS Media Session — lock-screen & hardware-key controls**: title metadata, artwork, and play/pause/stop/seek controls on the OS lock screen and notification shade via `navigator.mediaSession`, with a synced position scrubber.
- **Press-and-hold to 2x (touch)**: YouTube-style long-press speeds playback to 2x while held, reverts on release.
- **Settings (gear) button**: touch-friendly way to open the context menu now that long-press drives hold-to-2x.
- **"Play at 1x" stutter hint**: OSD nudge when a heavy source can't sustain above 1x (dropped video frames, smooth audio), with a cooldown.
- **360°/VR seek-bar preview reprojection**: seek-bar hover preview now matches your current viewing angle instead of the raw flat frame.
- **Themeable control-bar colors**: more chrome colors driven by overridable `--movi-*` CSS custom properties for embedder theming.
- **Volume boost to 200%**: the volume slider now reaches 200% (VLC-style) with a tinted boost zone above the unity mark, for quiet sources.
- **Screen-reader accessibility**: an off-screen `aria-live` region announces captions, and the seek/volume controls are now real `role="slider"` widgets with spoken position text.
- **QoE analytics (`movi-qoe`)**: a versioned QoE event stream (startup, rebuffering, bitrate switches, decode-fallback, errors, heartbeats) via a DOM event, `addQoeSink()` / `getQoeSession()`, and a built-in `beaconSink(url)`.
- **Framework wrappers + typed element**: official typed `@movi-player/react` / `vue` / `svelte` wrappers, plus `HTMLElementTagNameMap` typing for `<movi-player>`.
- **Embed / headless bare player + `noerrorscreen`**: no `controls` attribute makes `<movi-player>` a pure display surface (no resume dialog, empty state, spinner, or mouse interaction); `noerrorscreen` also suppresses the built-in error overlays.
- **Number-key seeking (`1`–`9`)**: `1`–`9` jump to 10%–90% of the timeline (YouTube-style), alongside `0` / `Home`.
- **Swipe-to-dismiss touch menu**: the gear-opened context menu is a right-side drawer on touch — drag it toward the right edge to close it. Vertical scrolling and taps inside the menu are unaffected.
- **Pinch to change aspect fit in fullscreen (touch)**: a two-finger pinch switches the fit YouTube-style — spread to zoom-to-fill (crop), pinch in to fit — with the same Fit/Fill OSD. Fullscreen-only (won't fight inline page pinch-zoom); excluded from 360° mode.
- **iOS Safari pseudo-fullscreen fallback**: iOS Safari only allows element-fullscreen on `<video>` and the player renders to canvas — fullscreen falls back to a CSS viewport-fill mode (behind Safari's toolbars) with forced-landscape rotation for landscape video. iPad / real element-fullscreen browsers unaffected.
- **Small-player control bar & menu overhaul**: usable down to ~100px wide — tighter padding/buttons below 400px, PiP folds behind the "more" toggle, the expanded cluster scrolls horizontally, fullscreen folds in below 290px, the resume dialog stacks instead of clipping, dropdown menus cap to the room inside the player, and the gear hides while a bottom dropdown or the timeline is open.

### Fixed
- **HTTP streaming without cross-origin isolation**: HTTP(S) sources no longer need COOP/COEP (`SharedArrayBuffer`) — single-threaded Asyncify WASM falls back to a plain-buffer path; fixes a `Timeout at 0` on pages without the headers. The headers now only enable an optional zero-copy fast-path.
- **Fullscreen forced landscape for portrait video (Android)**: the orientation lock now reads the effective display rotation, so a portrait clip stored as landscape-frames-plus-rotation stays portrait in fullscreen.
- **Audio-strip (collapsed) mode**: shortcuts work while collapsed; the gear aligns with the title, stays visible and appears on load; the touch menu no longer overflows; the strip reflows on late cover art; a strip with no `controls` hides itself.
- **Picture-in-Picture cursor**: the cursor stays visible above the controls in document PiP.
- **Touch hold-to-2x too eager**: threshold raised to 600ms and the gesture cancels when it becomes a scroll.
- **Resume-dialog selection ring**: visible on pointer devices (a global `outline` reset was hiding it), hidden on touch.
- **Blank snapshot on hardware AV1**: falls back to the decoded `VideoFrame` when WebGL read-back is blank.
- **Settings gear on non-touch**: hidden where right-click already opens the menu.
- **Safari first-load flash**: no flash of unstyled overlays on first load.
- **OS Media Session focus**: the silent audio anchor is now ≥5s so the OS grants full media-key focus.
- **Volume clamping**: native-element volume clamped to `[0,1]`; the slider caps at 100% unless boost is on.
- **Context menu clamped on-screen**: the menu repositions after opening so it never spills off-viewport.
- **Lite / proxy browsers without cross-origin isolation**: the player runs on reduced browsers with no `SharedArrayBuffer`.
- **Open-GOP CRA-opening HEVC stuck buffering**: a seek now accepts a CRA at or before the target instead of waiting indefinitely for an IDR.
- **TrueHD/DTS buzzy/jittery audio around seeks and replays**: software decoder now flushes on seek, a cold-start cushion applies on every seek/replay (not just first play), and replay no longer trips a spurious desync resync.
- **Multi-audio-track files stalling repeatedly**: unused audio streams are now discarded at the demuxer level so the active track isn't starved by interleaved packets from a track nobody's listening to.
- **Crash on load with newer WASM builds**: heap bytes are now copied out before `TextDecoder.decode()` (resizable `ArrayBuffer` heaps threw and blocked every file from loading).
- **Playback stalling after resuming from the background**: the un-throttled background decode timer now restarts on resume (including via Media Session), so audio no longer starves and video no longer jumps ahead of audio.
- **SigV4 presigned URLs (S3 / R2 / GCS) failing to load**: falls back to ranged/plain `GET` when a `HEAD` probe returns 403/401 instead of treating it as access-denied; extension link probe also recognizes presigned links without a file extension.
- **Context-menu submenu options all showing "active" (touch)**: Fit and Speed submenus no longer accumulate a stale highlight.
- **Selected-track text unreadable in light theme + auto-hide stuck open**: readable codec/language text in light theme; switching audio tracks restarts the auto-hide timer.
- **VS Code extension bundle out of date**: republished with the current player build (was missing the 0.3.3 audio-output/VR/FLAC fixes).
- **VS Code: fullscreen button hidden despite fullscreen working**: the webview iframe reports `fullscreenEnabled=false` (so the button auto-hid), but fullscreen works via the extension host — the webview now grants the capability so the button stays.
- **Embed: dead fullscreen/PiP/audio-output controls no longer shown**: hidden (instead of silently failing) when the embedding iframe's Permissions Policy disallows them; PiP also retires itself if opening its window throws.
- **`playsinline` now also gates touch gestures**: an inline touch player suppresses swipe-seek/volume gestures so they don't fight page scroll (resumes in fullscreen). The separate `gesturefs` attribute is now deprecated (still honored).
- **Right-click context menu clipped by page layout**: the menu portals to a body-level layer so it escapes clipping ancestors (a wrapper's `overflow:hidden`) instead of being chopped at the player edge; submenus are viewport-aware in this mode.
- **Resume-dialog selection ring didn't follow the pointer**: the ring now moves to whichever button the pointer is over, matching arrow-key behavior.
- **Scrub thumbnail previews depended on attribute order**: `<movi-player src=… thumb>` no longer silently builds with previews disabled; order doesn't matter, and the timeline key (`T`) generates thumbnails regardless of the `thumb` attribute.
- **Timeline panel: thumbnails touching + controls-bar flash on close**: bigger thumbnail-strip gap and a smaller hover/active pop so thumbnails don't overlap on small players; closing no longer flashes the auto-hidden controls bar.
- **360° mode: scroll-wheel accidentally zoomed the view**: removed the wheel-zoom listener so page scrolling behaves normally; drag-to-look and pinch-to-zoom remain.
- **Aspect-fit menu item didn't show the Fit/Fill OSD**: changing aspect from the context menu now flashes the same OSD as the button and keyboard shortcut.
- **Pinch-to-fit and press-and-hold-to-2x could fire together**: a second finger landing cancels hold-to-2x so a pinch can't trigger 2x mid-gesture.
- **HTTP streaming: large remote files restarted mid-playback on small out-of-window reads**: served with a one-off range fetch while the main stream keeps running (fixes the request "cancelling" on large torbox-style files), with a cap on consecutive one-off fetches so a real seek still restarts the stream. (Thanks @anilabhadatta.)

## [0.3.3] - 2026-06-29

### Added
- **Immersive / VR video (`vr` attribute)**: 360° equirectangular, 180° (VR180), fisheye, side-by-side **stereo (3D)**, and stereographic **"little planet"** projections, rendered with a WebGL2 fullscreen-quad raycast and a spring-animated look-around camera (drag / arrow keys / pinch-zoom). Auto-enters the right projection from the source's spherical metadata — no toggle UI — or force it with tokens (`vr="180"`, `vr="fisheye sbs"`, `vr="littleplanet"`). Opt-in on-screen joystick via `vrpad`.
- **Audio output device selection (`audiooutput` attribute / `setAudioOutput()` API)**: route playback to any system output device (speakers, Bluetooth, virtual). `getAudioOutputs()` lists devices, `setAudioOutput(deviceId)` switches — it also accepts a **label substring** (e.g. `"Headphones"`) since device ids are session-salted — `getAudioOutput()` reads the current sink, and an `audiooutputchange` event fires on change. Surfaced as an **"Audio Output"** submenu in the right-click menu (the browser asks for device permission on first use; granted hosts list devices directly). Routed through `AudioContext.setSinkId`.

### Fixed
- **FLAC audio playback**: FLAC now always uses the software (FFmpeg-WASM) decoder — WebCodecs' FLAC decoder throws `EncodingError` on these streams and the error→software fallback didn't recover in every browser, leaving FLAC silent.
- **Title HTML-entity decoding**: titles from scraped / download-site sources that carry entities like `&quot;` (and the non-standard `&Quot;`), `&amp;`, `&#39;` now render as the real characters (`"`, `&`, `'`).
- **Audio-strip title placement**: when an audio file *with a title* collapses to the thin control strip, the title now sits in its own row above the controls instead of overlapping the control row.
- **Controls auto-hide vs. the timeline & menus**: the control bar no longer auto-hides while the **storyboard timeline** (`T`) is open or when clicking a thumbnail in it, and it correctly re-arms its inactivity auto-hide after the right-click menu closes.

## [0.3.2] - 2026-06-17

### Added
- **Desktop app — Windows / macOS / Linux (`desktop/`)**: a new Electron app wrapping the player engine. Plays MKV, HEVC, AV1 and 4K HDR locally through the same WebCodecs + FFmpeg-WASM pipeline, served from a cross-origin-isolated localhost server so the WASM demuxer keeps `SharedArrayBuffer`. Includes drag-and-drop, native **Open With** / file associations for every supported format, URL playback through a built-in proxy (no CORS limits), a **multi-file playlist** with auto-advance, recent files, an Open-URL dialog with clipboard paste, full-window keyboard shortcuts, and a **native always-on-top Picture-in-Picture** window (Electron doesn't render Document PiP, so PiP is a real OS window that hands the source off and resumes on return). Cross-platform installers (`dmg` / `nsis` / `AppImage` + `deb`) and document icons via electron-builder.

### Fixed
- **Software-decoder fallback without WebCodecs**: when the browser has no WebCodecs `VideoDecoder` (e.g. Firefox, especially on mobile) the player now falls back to the WASM software decoder instead of failing — video was left stuck buffering while audio fell back on its own.
- **Seek before ready is queued**: the `currentTime` setter now holds a seek requested before the player is ready and applies it on the next seekable state, so a hand-off / early seek no longer stalls on a still-loading source.
- **`<movi-player hidden>` now hides**: the component's `:host { display: block }` was overriding the UA `[hidden]` rule, so the standard `hidden` attribute did nothing.
- **Centre play/pause + loading spinner positioning**: sit at the true centre on the initial / autoplay-off screen and lift slightly to balance the controls bar only once playback has started; they also animate in compact / PiP layouts. (Previously keyed off a `:host:has()` rule that some engines, e.g. Electron's Chromium, don't apply to shadow descendants.)

## [0.3.1] - 2026-06-10

### Added
- **MPEG-DASH playback (`.mpd`) (closes #9)**: DASH manifests now play alongside HLS through the adaptive pipeline.
- **Unified adaptive streaming via Shaka (HLS / DASH / Smooth)**: Shaka is the primary engine for `.m3u8` / `.mpd` / `.ism`; hls.js and dash.js remain as automatic fallbacks. `DashFallback` plays bare-`BaseURL` manifests Shaka rejects via the demuxer.
- **Live-stream UI**: `LIVE` badge that jumps to the live edge, DVR-window seeking, Auto-mode quality badge.
- **Custom request headers (`headers` attribute / property)**: Auth tokens / signed headers across manifest + segments, progressive HTTP, thumbnails, and the encrypted source. JSON-string attribute or object property; also `PlayerConfig.headers`.
- **Audio-only data-saver mode (`audioonly` attribute / `audioOnly` property)**: Play just the audio to save CPU/bandwidth — muxed files skip the video decode, streams switch to an audio-only rendition, split sources stop downloading the video body. Live-toggleable, forces the album-art strip UI.
- **Non-range (no-Range) server playback**: Servers that ignore `Range` (`200` not `206`) now play via a forward-only sliding window (**linear mode**); a new `linearmode` event lets the UI adapt.
- **MPEG-5 LCEVC decoding (`lcevc` / `lcevcurl` attributes)**: Opt-in LCEVC enhancement-layer decoding for adaptive streams.
- **Muted-autoplay fallback for split native-audio tracks**: rolls video muted + shows the tap-to-unmute pill instead of freezing.
- **Extension: detect `.mpd` (DASH) URLs in page scan.**
- **VS Code extension: adaptive streaming via URL** — `Movi: Open Video from URL` plays `.m3u8` / `.mpd` / `.ism` by loading them directly in the player engine (no host byte-range proxy); progressive files still use the proxy.
- **VS Code extension: `.ts` (MPEG-TS) added to the open-file dialog** (not the single-click association).

### Changed
- **DRM key-system order**: Widevine → PlayReady → FairPlay.
- **Manifests load directly, never via `/proxy`**: fixes relative segment resolution and the proxy content-type allowlist for `.m3u8` / `.mpd` / `.ism`.
- **Size resolution hardened**: HEAD → ranged GET → plain GET retry chain for CDNs that strip `Content-Length`.
- **deps**: add `shaka-player ^4.11.2`, `dashjs ^5.2.0`; bump `hls.js` to `^1.6.16`.

### Fixed
- **Robust startup**: visible play affordance on blocked autoplay, guarded first-play seek, background-tab autoplay deferred until visible.
- **Don't flash wrapper errors mid-fallback**: no spurious "Try Software Decoding" while falling back behind Shaka.
- **HTTP errors surface real messages**: `403` / `404` / `5xx` map to access-denied / not-found / server-error.
- **Wake lock**: skip while hidden, retry transient failure, re-acquire on visible/resize.
- **Don't collapse a loading/errored video into the 56px audio strip on resize.**
- **App proxy**: don't proxy same-origin URLs (522 loop); don't magic-sniff tiny range probes.
- **Volume slider opens on first touch; ambient re-applies after `src` change.**
- **Cover-art backdrop blur** via CSS `filter:blur()` (works in Safari < 17); audio-only `poster` renders as album art.
- **Audio-only replay/loop restarts the native `<audio>`; no context menu without `controls`.**

## [0.3.0] - 2026-06-02

### Added
- **Signalsmith Stretch audio rate-change pipeline**: Replaced SoundTouch with Signalsmith Stretch as the sole pitch-preserving time-stretcher.
- **First-class audio-only support with strip UI**: Audio-only files play through the canvas pipeline with a dedicated audio strip UI (cover art, title, progress bar, controls).
- **Muted-autoplay fallback with tap-to-unmute**: When autoplay is blocked, the player starts muted and shows an "unmute" pill overlay.
- **Cover art display for audio**: JS-only album art extraction via an isolated demuxer context.
- **Custom `SourceAdapter` for `<movi-player>` and `MoviPlayer` (closes #7)**: Plug any custom byte protocol directly into the element or player.
- **File-source preload settling gate**: `play()` and resume gated until initial preload fills.
- **YouTube-style centre play button**: Always-visible large play/pause icon.
- **Unified controls chrome — dark gradient bar + redesigned OSD**: Opaque backgrounds replace backdrop-filter blurs.
- **Extension: playlist shuffle, autoplay toggle, next button**
- **Extension: hover-probe links + opt-in toggle + flag detection**
- **Compare page (`/compare`)**: Side-by-side native vs movi-player.
- **VS Code extension — URL streaming, multi-window commands, Activity Bar entry**
- **Homepage redesign**

### Changed
- **4K playback rate cap raised to 2x** (only 8K+ capped at 1.5x)
- **Renderer queue split for 4K vs 8K**
- **UI update loop throttled to 4Hz**
- **Volume slider uses perceptual (log) gain curve**
- **Ambient mode FBO mirror** (no more full canvas readback)
- **Thumbnail hover latency cut**
- **Dropped backdrop-filter blur from all UI surfaces**
- **README redesigned**, browser support updated (Firefox 130+)
- **AGENTS.md shipped in package**

### Fixed
- **Decode**: RASL leading pictures after CRA/BLA seek, DoVi/HDR HEVC on hardware, open-GOP HEVC fallback, tiny packet drop, AV1 Temporal Delimiter OBU
- **Seek**: prefer IDR fall back to CRA, resume into buffering on timeout
- **Playback**: mid-playback decode-error recovery, auto-start on rate restore, rapid seeks stuck, stall detection during recovery, audio tail on rate change, EOF detection
- **Audio**: log gain curve, pitch-shift at startup, audio-only shortcuts, near-end seek clipping
- **UI**: controls flash, play/pause icon state, centre play flickering, cursor hiding, loop toggle replay
- **Canvas**: display-p3 fallback, rec2100-pq preservation
- **Thumbnail**: recreate dead WebCodecs decoder
- **Extension**: video link detection, loop replays
- **HTTP**: surface server errors

## [0.2.3] - 2026-05-07

### Added
- **Subtitle Delay / Offset (closes #4)**: Shift subtitle timing relative to video — `subtitledelay` attribute, `subtitleDelay` property, `setSubtitleDelay()` / `getSubtitleDelay()` API methods, and a new `subtitledelaychange` CustomEvent. Sign convention matches VLC/mpv (positive = subtitles later). UI cap ±300s with widened input. Z/X hotkeys nudge by 100ms per press; OSD shows the current offset. Auto-prefetch when delay becomes non-zero so negative offsets work (cues from stream positions ahead of the demuxer cursor). Applied at the renderer's active-cue check so a single offset works for text and image (PGS/DVB) cues without re-decoding.
- **Subtitle Customization Panel**: `subtitlesize`, `subtitlecolor`, `subtitlebg`, `subtitleedge` attributes, plus an in-player customize panel persisted to localStorage. Size multiplier drives both bitmap (PGS/VOBSUB) and text (SRT/ASS/VTT) cues; edge style applies to text subs.
- **Subtitle Transcript Browser**: Full-cover panel with search, click-to-seek, active-cue highlight, italic/bold/entity rendering, and delay-aware timestamps. Click on a live caption opens the transcript at the current cue. Backed by a native `movi_prefetch_subtitle_cues` that uses `AVDISCARD_ALL` so a 700 MB scan touches only subtitle packets, not every audio/video body.
- **Karaoke Captions for VTT**: Tag-only-token folding, min-width anchor measured offscreen, render-key cache to stop the 60fps `innerHTML` rewrite that prevented fade-in during playback. Format-aware backdrop (VTT-only).
- **Premuxed Quality Menu**: Multiple `<source data-height="...">` children give a YouTube-style quality picker for plain MP4/MKV files — no HLS manifest needed. Adopt/release native `<audio>` across switches preserves the user-activation token so the next switch isn't blocked by autoplay policy.
- **Multi-Language Audio via `<source kind="audio">`**: Two or more audio `<source>` tags with `srclang` (or `label`) become parallel language tracks; the player surfaces the audio-language menu and `getAudioLangs()` / `selectAudioLang()` work exactly as for muxed tracks. Default pick: explicit `default` / `data-default` → first locale match (`navigator.language` prefix) → first track. Single `<source kind="audio">` continues to use the legacy split-audio path.
- **External Subtitles via `<track>`**: Standard `<video>`-style declarative markup — `<track kind="subtitles">`, `kind="captions"`, or no `kind` are recognized. Reads `srclang`, `label`, and `data-format` (defaults to VTT, set `srt` for SRT sidecars). Lets integrators ship full caption configurations as plain HTML without wiring up `source({ subtitles: [...] })` from JS.
- **Host Fullscreen Handoff**: New cancelable `movi-fullscreen-request` CustomEvent + `setHostFullscreen(active)` method. Lets embedders (VS Code webviews, custom app shells) take over fullscreen with their own chrome while keeping the player's toolbar icon, OSD, and context-menu label in sync. Fullscreen state is now reflected in the context-menu label.
- **File Revoked Event**: `filerevoked` CustomEvent fires when the browser silently revokes a `File` handle (mobile background / memory pressure). `FileSource` races each chunk read against an 8s timeout — no more demuxer hanging forever — and surfaces the failure via a one-shot `onRevoked` callback on `MoviPlayer`.
- **`MoviPlayer.hasAudibleSource()`**: Unified gate covering muxed audio, split native `<audio>`, *and* HLS audio (which lives inside the hidden native `<video>`). Used internally to decide whether to show volume controls / accept volume hotkeys.
- **VS Code Extension**: New `vscode-extension/` package (Marketplace 0.2.5). Webview-hosted player registered as a CustomEditor — single-click opens any MP4/MKV/HEVC/AV1/WebM/MOV/TS file VS Code can't natively play. True streaming via a custom `DataSource` (webview's `File` proxy delegates `slice().arrayBuffer()` to extension-host `fs.createReadStream` chunks); memory cost drops from O(filesize) to ~chunk size, so multi-GB and 8K HDR files no longer hit the 4 GB Blob limit. Movi fullscreen toggle hides workbench chrome with auto-cleanup on crash. OS wake lock (`caffeinate -i` / `systemd-inhibit` / `SetThreadExecutionState`) held during fullscreen. Multi-window playback via `movi.openInNewWindow`. Output channel surfaces bundled-player logs.
- **Web App Explorer-Style Playlist**: Folder hierarchy tree with collapsible groups + guide rail, multi-select, live search (folders auto-expand on match), keyboard navigation (Tab toggle, Up/Down/Enter, Esc). Thumbnails + metadata cached in IndexedDB so reopening the same files skips every WASM call. SEO overhaul, landing animations, gradient circle brand mark.
- **Chrome Extension Explorer Playlist**: Folder tree, breadcrumb, badges, progress, drag/drop, multi-file + folder picking. Shared isolated WASM instance (2-instance budget) for thumbnail generation, cached in IndexedDB across sessions. Install detection on moviplayer.com hides the "Add to Chrome" prompt when the extension is already present. Gradient circle play-button branding to match the main app.
- **Stats 8K / 16K Tiers**: `4320p` (8K) and `8640p` (16K) labels in both native and HLS stats paths — previously bucketed as 4K.

### Changed
- **HLS Volume Controls Now Visible**: Volume button, `ArrowUp` / `ArrowDown` hotkeys, and volume OSD were gated only on muxed/split audio, so HLS streams (audio inside the native `<video>`) had no mute control. Consolidated behind `hasAudibleSource()` so the HLS path is covered too.
- **Audio Decode Stays Running While Muted**: The demux loop no longer drops audio packets when muted — `AudioRenderer` keeps gain at 0 instead. Fixes the "atak atak" judder on unmute, where the audio clock pivoted forward to the demuxer's lookahead (~1–3s ahead of presentation) and `CanvasRenderer` chased it 25%/frame.
- **Bluetooth A2DP Keepalive**: Pause path now suspends the AudioContext but starts a near-silent looping `<audio>` element so the OS audio session stays claimed. BT devices stop dropping/re-pairing on every pause without re-introducing the "2–3s jump-ahead on resume" regression.
- **DPR-Scaled Canvas Backbuffer**: Canvas backbuffer scales with `devicePixelRatio` (capped at 2×) so downsampling 4K/8K sources stays sharp. CSS dimensions remain in logical pixels.
- **Encrypted Source Static Import**: `EncryptedHttpSource` hoisted to a top-level import — no more async boundary on every encrypted load. Matches the other source adapters.
- **FFmpeg Bumped to n8.1.1**: Picks up upstream point-release fixes on the n8.1 branch. `dvbsubtitle` / `dvdsubtitle` decoders renamed to `dvbsub` / `dvdsub` to match.
- **Subtitle Default Sizing**: Bumped the text-subtitle base size and replaced the desktop-era 60px floor on bottom padding with a height-proportional 8% (24px floor) so subtitles don't crowd into the middle of small embeds.
- **Menu Animations**: Pop-in / pop-out on the audio, subtitle, quality, and speed dropdowns plus a fade between the customize panel and track list. Bottom-controls dropdowns enforce one-at-a-time. Click on the player area closes any open menu instead of toggling play/pause.
- **Keyboard Shortcuts Ignored While Typing in Inputs**: Hotkeys no longer fire when an input/textarea inside the shadow DOM is focused.
- **Audio Menu Always Shows Language Code**: `formatAudioBadge` previously dropped the language code when channel info was available, so muxed tracks from MKV/MP4 displayed only "AAC Stereo" with no way to tell languages apart.
- **COOP/COEP Hard-Required**: README/docs corrected — the player hard-blocks without `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`. Surfaces a "Security Headers Missing" diagnostic instead of a cryptic timeout. Mention `coi-serviceworker` as a static-host workaround.

### Fixed
- **~1s Fullscreen Freeze**: ResizeObserver fires repeatedly during the fullscreen animation. Each call set `canvas.width` twice (in `updateCanvasSize` and `CanvasRenderer.resize`), clearing the WebGL framebuffer on every burst. Coalesced same-size resizes, dropped the duplicate width/height assignment, dropped the `<video>.width/height` no-ops.
- **WebGL Context Loss Recovery (Mobile)**: Capture canvas to JPEG on `visibilitychange→hidden` while the GL context is alive; on return, hide instantly if `gl.isContextLost()` is false, otherwise leave it up so `handleContextLost`/`handleContextRestored` can run recovery without a corrupt framebuffer flashing through. Restored `isLoading` clear so `initializePlayer` doesn't early-return after long minimize. 5s cooldown between audio-resync seeks prevents stutter loops on slow software audio decoders.
- **HLS First-Frame Black**: Manifests without `RESOLUTION` caused `configure(0,0)` on the canvas renderer, producing a black frame that only cleared on the next ResizeObserver tick. Defer configure to `<video> loadedmetadata` when manifest dims are missing.
- **HLS Quality Badge / Fit Animation**: Re-emit `tracksChange` on `LEVEL_SWITCHED` so the gear badge reflects the active rendition in Auto mode. Skip smoothing-state reset on same-size canvas resizes so fit-mode toggles can lerp instead of snapping; clone last frame in the direct-render path so HLS paused redraws have a source to animate against.
- **Pause→Resume 2–3s Jump-Ahead**: Pause now preserves scheduled buffers and sync anchors exactly, so the first packet drained from `pendingPrebufferPackets` (whose timestamp is the demuxer's lookahead) doesn't become the new `firstBufferMediaTime` anchor on resume.
- **Aspect-Ratio Change While Paused**: Fit-mode change now repaints the canvas after a seek-to-paused and animates via a dedicated RAF loop instead of snapping. Poster overlay tracks the active fit mode, lets pointer events pass through so dblclick / gesture handlers still fire, and stays hidden until a source is set.
- **Mobile Speaker Tap**: Switched from `PointerEvent.pointerType` (Android Chrome synthesizes click with `pointerType="mouse"` from a touch tap) to `matchMedia("(hover: none)")` as the primary touch signal. `composedPath()` to cross shadow boundary in the close-volume listener. Mobile media query no longer hides the slider on `.active`.
- **Embed Security Headers Diagnostic**: Every `src=` change now re-runs `checkSecurityHeaders()`, so reused players surface "Security Headers Missing" instead of a cryptic "Failed to open media: Timeout at 0".
- **Pause Buffering Loop / Single-Track Streams**: Pause buffer loop required both audio and video targets via AND, so audio-only / video-only streams never satisfied it and ran to the 3000-packet safety cap (~30s of demux), surfacing as a burst of cache-read spam after pause. Now only checks targets for tracks that exist.
- **A/V Drift Loop on Hardware Burst Decoders**: Hardware decoders that emit 8K frames in bursts queued many future-PTS frames; on >60Hz displays the fallback drained them faster than wall-clock and tripped the audio-desync resync seek loop. Reject frames more than one frame interval ahead of playback time.
- **Audio-less Video in Background Tab**: Without an audio track, the background `processLoop` had no backpressure (video decode skipped, no audio buffer to fill), so the demuxer raced to EOF in seconds. Pause on hide and auto-resume on visible.
- **Volume Keys for Native Audio Sources**: Hotkeys + OSD gated on `getAudioTracks().length` (empty for split video/audio sources). Now also accept `hasNativeAudio()`.
- **Buffered Bar Stability**: Buffered bar is now monotonic between seeks; pause-time buffering no longer pushes past `HttpSource`'s buffered end and trigger a window-resetting refetch.
- **PGS Subtitles On-Canvas**: Image-subtitle overlay was sized in DPR-scaled buffer pixels, pushing the flex-anchored bitmap off-screen on retina. Switched to the canvas's CSS rect (matching the text-subtitle path).
- **Skip A/V Desync Check When Muted**: Demux loop drops audio decode while muted, so `maxScheduledMediaTime` freezes and `getAudioClock()` clamps to a stale value — disabled the 500ms desync detector while muted.
- **No Corrective Seek After Unmute**: Reset the desync cooldown on unmute so the audio clock can catch up first instead of forcing a resync seek (visible as a loading shutter).
- **Progress Handle at 0%**: Dropped the `Math.max(1, …)` floor so the handle sits at 0% at the start instead of jumping in from 1%.
- **Pre-Play Seek**: Re-arm the `seekTargetTime` filter on first-play re-seek so Open-GOP recovery frames (1–2s behind the seek target) get dropped instead of presented; matching drop on resume from pause.
- **`getCurrentPlaybackTime` Frozen When Paused**: `updateActiveSubtitle` called via `setSubtitleCues` during pause can no longer jump to a wall-clock-driven time.
- **PiP Exit Buffer Resize**: Invalidate `_lastCanvasW/H` on PiP exit so the buffer resizes back to host dimensions instead of staying pinned at PiP resolution.
- **Seek OSD Accuracy**: Track the actual delta between the pre-seek time and the clamped target instead of a fixed 10s step. Anchor chained presses on the previous target. Dismiss the OSD on a boundary hit / sub-second / NaN delta.
- **Coalesce Rapid `currentTime` Sets**: Overlapping seeks now collapse into a single tail seek instead of queueing them all.
- **`preventScroll` on Hover Focus**: `focus()` on mouseenter no longer yanks the page when the player is partly off-screen.
- **Subtitle Re-render on Resize via rAF**: Previously a burst per ResizeObserver tick stalled the presentation loop on window drags.
- **Centre Non-VTT Subtitle Lines**: Multi-line SRT cues (e.g. `"- A long line\n- short"`) now sit at the player's centre instead of drifting left.
- **Worker /proxy Probe Failures**: Transient probe errors no longer get misreported as `415 Unsupported Media Type`.

### Documentation
- WebCodecs team outreach playbook (`docs/webcodecs-outreach.md`).

## [0.2.2] - 2026-04-26

### Added
- **`postertime` Attribute**: Generate a native-resolution poster from any timestamp without an explicit `poster` URL. Accepts `"10%"`, `"5"`, `"1:30"`, or `"0:01:30"`. Uses an isolated thumbnail pipeline (WASM + `ThumbnailBindings`), respects rotation metadata, and is race-guarded so in-flight generators can't paint stale frames after a `src` change.
- **`dispose()` Method**: Tears down the internal player and resets transient UI (subtitles, timeline, time, title, generated poster) back to the no-source state. Called automatically on every `src` change so playlist-style flows never leak state between sources. Safe to call when nothing is loaded.
- **`playing` Getter**: Read-only boolean that's `true` only while the player is actively playing — distinguishes it from `ready`, `loading`, `seeking`, and `buffering` states (precise inverse of `paused`).
- **`MoviElement.cleanVideoTitle(filename)` Static**: Utility exposed for playlist UIs to derive the same cleaned title the player uses internally — useful for computing the resume localStorage key (`movi-resume:<cleanVideoTitle(name)>`).
- **Folder Playlist (web demo app)**: Sidebar/below-player playlist via File System Access API (with `webkitdirectory` fallback). YouTube-style items with thumbnail, duration, HDR chip, codec/quality/size meta, and watched-progress bar. Lazy thumbnail generation, natural-sort, autoplay-next toggle, drag-and-drop multi-file support.

### Changed
- **`play()` Semantics**: Now queues a play intent during `isLoading` and flushes it from `initializePlayer()`'s finally block — matches `HTMLMediaElement` behavior. Previously bailed silently when called during load.
- **Software Decoder Fallback Per-Source**: Choosing "Try software" no longer sticks across `src` changes. The next video gets a fresh hardware-decode attempt; the `sw` attribute is cleared on dispose.
- **Encrypted Playback Protocol**: `EncryptedHttpSource` rewritten — block prefetch high-water/low-water tuning, concurrent-stream cap, `getPosition()` reports the real read cursor, and parent position field is kept in sync so buffer math stays honest. Encrypted-server ported to match the new protocol.
- **Buffer Tuning**: Runtime tuning of prefetch high-water, refill threshold, and block cache cap via the existing `buffersize` attribute. README/docs corrected to clarify the value is in **megabytes** (not seconds) and applies to both HTTP and encrypted sources.
- **Production Bundles**: Re-enabled terser `drop_console` and `drop_debugger` so release builds ship without dev-only logging.
- **Build Stability**: `app:release` script ties build + R2 upload + worker deploy into a single command. Build version cache-bust scoped to the quoted `__BUILD_VERSION__` literal so unrelated lines aren't rewritten.

### Fixed
- **Post-Seek A/V Sync**: Cap the post-seek audio gap at 200ms — when the first video frame after a seek arrives late (sparse keyframes / slow HEVC+HDR decoders), sync the clock to video time and drop stale audio instead of syncing to the earliest audio packet. Small gaps still prefer audio for continuity.
- **Pre-Play Seek Position**: Scrubbing the timeline before pressing play no longer resets to 0 — the first-play poster-seek now reads `clock.getTime()` instead of a hardcoded start time. Pipeline is flushed on user seek so prebuffered start audio doesn't briefly play before jumping to the target.
- **Fully-Cached Buffered Duration**: Buffered range now reports the full media duration when the file is fully cached, instead of stopping at the last network read.
- **Buffer Indicator Race**: Collapsed the seek-race scan sweep that could draw a phantom buffered range mid-seek.
- **Encrypted Thumbnails**: Share the main source for thumbnail reads instead of opening a parallel session — cuts redundant token churn. Concurrent stream cap prevents seek-storm thrash. Hardened thumbnail read failures (no more fragile retry/cooldown loop).
- **Worker `/proxy` Empty 206**: Retry empty 206 responses from upstream before streaming back, so transient origin hiccups don't surface as broken playback.
- **Worker Probe Failures**: Transient probe errors no longer get misreported as `415 Unsupported Media Type`.
- **TMDb Title Parser**: Detect TV shows when the episode title trails the `SxxExx` code (e.g., `Show.S05E01.Title`).

### Security
- **Worker Referer Allowlist**: `/proxy` and `/eproxy` endpoints now gate requests by Referer to block hotlinking from unauthorized origins.
- **Worker Magic-Byte Validation**: `/proxy` responses are validated against expected media magic bytes before being streamed back, mitigating MIME confusion attacks.

## [0.2.1] - 2026-04-16

### Added
- **Persistent Preferences**: `stableVolume`, `ambientMode`, and `hdr` toggles now persist via OPFS alongside `volume`, `muted`, and `playbackRate`. User toggles win over HTML attribute defaults on subsequent loads.
- **Split-Source Volume Control**: Volume button now visible when a separate native audio element is loaded, even if the video file has no muxed audio track.
- **Smart Title Extraction**: VLC-style filename cleaning strips release tags, codecs, and quality markers from tab titles. `Content-Disposition` filename used when the server provides one.
- **Chrome Extension**: Local file playback via popup file picker, drag-and-drop onto the player page, and a redesigned popup layout.

### Changed
- **Context Menu**: Slide-panel variant now only used on touch devices (`pointer: coarse`); narrow desktop windows get the regular hover-driven menu.
- **Context Menu Scrolling**: Max-height clamped to player height with subtle scrollbar styling so tall menus stay accessible on short players.
- **Theme Color Cascade**: `themecolor` attribute now flows to `--movi-primary-light` and `--movi-primary-dark` via `color-mix`, so active menu items and highlights follow the custom theme.
- **`title` Attribute**: No longer triggers the browser's native tooltip on hover — title is rendered only by the in-player overlay.
- **Subtitle/Audio Track Menus**: Show language codes alongside track labels for clarity.

### Fixed
- **Short Video Stutter**: Prebuffer media before `ready` so `play()` doesn't immediately stall on short clips.
- **Background Audio at 50/60 fps**: Skip video decode while hidden so audio keeps flowing on high-fps content.
- **Narrow Viewport Controls**: Buttons, gaps, and center play button tightened on viewports ≤ 480px to prevent the controls bar from overflowing the player box on iPhone 12 Pro-class widths.
- **Empty State Placement**: "No Video" placeholder no longer clips into the controls bar on short/narrow players.
- **OSD Speed Icon**: Correct speed icon shown when playback rate changes via hotkeys/context menu.

## [0.2.0] - 2026-04-09

### Added
- **Ambient Mode**: Dynamic letterbox glow that samples video colors in real-time. Smooth 60fps color transitions via WebGL clearColor. Toggle with `G` key or context menu. Works in fullscreen (letterbox) and normal mode (external wrapper). `ambientmode` attribute.
- **Split Source Support**: Separate video, audio, and subtitle file URLs via `videosrc`, `audiosrc`, `subtitlesrc` attributes.
- **PGS Image Subtitles**: Bitmap subtitle decoding with zlib decompression support.
- **Network Disconnect Recovery**: Intelligent CORS vs transient network failure detection (3-strike threshold). Online-event-aware backoff for instant retry on reconnection. Auto re-seek on recovery. 30s timeout on offline wait.
- **Document Picture-in-Picture**: Floating video window with play/pause, seek, mute, progress bar, time display, keyboard shortcuts, and back-to-tab button. Portrait video sizing. Rotation save/restore on PiP enter/exit.
- **DRM Support**: `drm` and `licenseurl` attributes for HLS streams with Widevine/FairPlay via EME API.
- **HLS Quality Menu**: Duplicate resolutions show bitrate (e.g., "1080p · 5000 kbps").
- **HLS Nerd Stats**: Video codec, resolution, quality, frame rate, bitrate, buffer, HLS level, bandwidth, live latency, frames decoded/dropped.
- **VLC-style Shortcuts**: `V` subtitles, `B` audio, `+/-` speed, `L` loop, `U` stable volume, `H` HDR, `P` PiP, `G` ambient, `A` aspect ratio.
- **Aspect Ratio Controls**: `A` key cycles contain/cover/fill/zoom. Sub-menu with icons in context menu and bottom controls.
- **Stable Volume**: DynamicsCompressorNode for loudness normalization. Opt-in via `stablevolume` attribute.
- **Nerd Stats**: Press `I` for codec, resolution, FPS, decoder type, buffer health, color info, and live network/disk activity graph.
- **Timeline**: Press `T` for auto-generated thumbnail strip with chapter support. Arrow key navigation, click-to-seek.
- **Chapter Support**: Extract chapters from video metadata. Chapter markers on progress bar, chapter titles in seek tooltip.
- **Video Rotation**: Press `R` to rotate 90°. Metadata rotation auto-applied. Disabled during PiP.
- **Keyboard Shortcuts Panel**: Press `?` to view all shortcuts.
- **Resume Playback**: `resume` attribute saves position to localStorage with resume/start-over dialog.
- **Encrypted Playback**: AES-256-GCM chunked encryption with HMAC-SHA256 signed requests.
- **Background Audio**: Video keeps playing audio when tab is in background via Web Worker timer fallback.
- **Chrome Extension**: Popup with "Paste & Play" and "Play from Computer", context menu on video links, play button overlay on detected URLs.
- **Privacy Policy**: Published at docs site for Chrome Web Store compliance.

### Changed
- Buffering state now stops presentation loop so frames accumulate for reliable recovery.
- Buffering exit requires video frames ready (with 3s fallback for async decoder delays).
- Pause during buffering allowed from all UI controls (click, keyboard, buttons, PiP, context menu).
- `buffering → ended` state transition allowed for EOF during rebuffer.
- Invalid packet size at EOF treated as EOF (not fatal error) for FFmpeg stale buffer data.
- HDR icon changed to text badge style in OSD and context menu (matches bottom controls).
- Extension description rewritten to remove excessive format keywords (Chrome Web Store compliance).
- Console logs dropped in production build.

### Fixed
- Hardware decoder error recovery with keyframe cache and software fallback.
- Seek and play/pause during buffering state.
- Network disconnect causing permanent CORS misclassification when `navigator.onLine` lags.
- Stale stream loops from leaked online event listeners during backoff.
- Multiple concurrent fetch loops after network recovery.
- Clock advancing during buffering (presentation loop consuming frames).
- PiP rotation clipping — rotation reset on PiP enter, restored on close.
- PiP portrait video oversized — height-limited sizing for portrait aspect ratios.
- Pause-seek loading stuck — `VideoDecoder.flush()` 1s timeout with reset+reconfigure fallback.
- EOF not triggering — relaxed condition with 0.5s tolerance.
- PiP canvas restore using `shadowRoot` directly.
- PiP frame freeze on tab switch with `isPiPActive` guard.
- EncryptedHttpSource network resilience matching HttpSource.
- Nerd stats graph fullscreen positioning and CSS specificity.

## [0.1.5] - 2026-02-15

### Added
- Pitch preservation for playback rate changes
- Pitch preservation support for HLS playback
- MediaSession API integration for background playback and media controls
- HTTPS support for local development environment

### Changed
- Simplified error messages to be more concise and consistent
- Replaced all hardcoded purple colors with CSS variables (--movi-primary) for full theme customization
- Enhanced center play button with theme color by default
- Updated loading spinner with responsive sizing and theme-aware colors

### Fixed
- Improved playback stability with enhanced error handling and timeout management
- Resolved audio-video sync issues with hardware decoding
- Distinguished 403/401/404 errors from CORS errors for better error reporting
- CORS errors now propagate immediately instead of waiting for timeout
- Title bar z-index now properly positioned below control menus in mobile view
- Center play button backdrop blur now enabled on mobile/touch devices
- Controls no longer auto-hide when menus are open on mobile

## [0.1.4] - 2026-02-11

### Fixed
- Resolved video stalling during playback and improved A/V sync
- Playback speed changes now take immediate effect on audio
- Auto-unmute when volume slider is moved while muted
- Mute button now correctly toggles audio muting

## Previous Versions

See git commit history for changes in versions prior to 0.1.4.
