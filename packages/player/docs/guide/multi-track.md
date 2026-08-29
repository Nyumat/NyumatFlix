# Multi-Track Support

Movi-Player supports multiple audio, video, and subtitle tracks without any server-side processing.

## Overview

Many video files contain multiple tracks:

- **Audio**: Different languages, commentary, audio descriptions
- **Subtitles**: Various languages, captions, forced subs
- **Video**: Different quality levels, camera angles

Movi-Player can switch between tracks seamlessly during playback.

## Audio Tracks

### Get Available Audio Tracks

```typescript
import { MoviPlayer } from "movi-player/player";

const player = new MoviPlayer({
  source: { type: "url", url: "anime.mkv" },
  canvas: document.getElementById("canvas") as HTMLCanvasElement,
});

await player.load();

const audioTracks = player.getAudioTracks();
console.log("Available audio tracks:", audioTracks);

// Example output:
// [
//   { id: 1, language: 'eng', title: 'English 5.1', codec: 'eac3', channels: 6 },
//   { id: 2, language: 'jpn', title: 'Japanese', codec: 'aac', channels: 2 },
//   { id: 3, language: 'eng', title: 'English Commentary', codec: 'aac', channels: 2 }
// ]
```

### Switch Audio Track

```typescript
// Switch to Japanese audio
const japaneseTrack = audioTracks.find((t) => t.language === "jpn");
if (japaneseTrack) {
  player.selectAudioTrack(japaneseTrack.id);
}

// Or by index
player.selectAudioTrack(audioTracks[1].id);
```

### Audio Track UI

```typescript
function setupAudioSelector(player: MoviPlayer) {
  const audioTracks = player.getAudioTracks();
  const selector = document.getElementById("audioSelect") as HTMLSelectElement;

  // Clear existing options
  selector.innerHTML = "";

  // Add options
  audioTracks.forEach((track, index) => {
    const option = document.createElement("option");
    option.value = String(track.id);

    let label = track.language?.toUpperCase() || `Track ${index + 1}`;
    if (track.title) {
      label += ` - ${track.title}`;
    }
    if (track.channels) {
      label += ` (${track.channels === 6 ? "5.1" : track.channels === 8 ? "7.1" : "Stereo"})`;
    }

    option.textContent = label;
    selector.appendChild(option);
  });

  // Handle selection
  selector.onchange = () => {
    const trackId = parseInt(selector.value);
    player.selectAudioTrack(trackId);
  };
}
```

## Subtitle Tracks

### Get Available Subtitles

```typescript
const subtitleTracks = player.getSubtitleTracks();
console.log("Available subtitles:", subtitleTracks);

// Example output:
// [
//   { id: 3, language: 'eng', title: 'English', codec: 'subrip', forced: false },
//   { id: 4, language: 'eng', title: 'English (SDH)', codec: 'subrip', forced: false },
//   { id: 5, language: 'jpn', title: 'Japanese', codec: 'ass', forced: false },
//   { id: 6, language: 'eng', title: 'Signs/Songs', codec: 'ass', forced: true }
// ]
```

### Enable/Disable Subtitles

```typescript
// Enable English subtitles
const englishSub = subtitleTracks.find(
  (t) => t.language === "eng" && !t.forced,
);
if (englishSub) {
  player.selectSubtitleTrack(englishSub.id);
}

// Disable subtitles
player.selectSubtitleTrack(null);
```

### Subtitle Selector UI

```typescript
function setupSubtitleSelector(player: MoviPlayer) {
  const subtitleTracks = player.getSubtitleTracks();
  const selector = document.getElementById(
    "subtitleSelect",
  ) as HTMLSelectElement;

  // Clear and add "Off" option
  selector.innerHTML = '<option value="">Subtitles Off</option>';

  subtitleTracks.forEach((track, index) => {
    const option = document.createElement("option");
    option.value = String(track.id);

    let label = track.language?.toUpperCase() || `Subtitle ${index + 1}`;
    if (track.title) {
      label += ` - ${track.title}`;
    }
    if (track.forced) {
      label += " (Forced)";
    }

    option.textContent = label;
    selector.appendChild(option);
  });

  selector.onchange = () => {
    const value = selector.value;
    if (value === "") {
      player.selectSubtitleTrack(null);
    } else {
      player.selectSubtitleTrack(parseInt(value));
    }
  };
}
```

## Video Tracks (Quality)

```typescript
const videoTracks = player.getVideoTracks();
console.log("Video tracks:", videoTracks);
// [{ id: 0, width: 1920, height: 1080, codec: 'hevc', bitrate: 8000000, isHDR: false }, ...]
```

::: warning Programmatic switching is HLS-only
`MoviPlayer` does **not** expose `selectVideoTrack()` — multi-quality switching is supported only on HLS streams (driven internally by `hls.js`). The `<movi-player>` element surfaces the HLS quality menu via the gear icon → Quality.

For a non-HLS multi-bitrate scenario, swap the URL via a fresh `load()` instead.
:::

## Complete Track Manager

```typescript
class TrackManager {
  private player: MoviPlayer;

  constructor(player: MoviPlayer) {
    this.player = player;
  }

  getTrackInfo() {
    return {
      audio: this.player.getAudioTracks(),
      video: this.player.getVideoTracks(),
      subtitle: this.player.getSubtitleTracks(),
    };
  }

  setAudioByLanguage(language: string) {
    const track = this.player
      .getAudioTracks()
      .find((t) => t.language === language);
    if (track) {
      this.player.selectAudioTrack(track.id);
      return true;
    }
    return false;
  }

  setSubtitleByLanguage(language: string | null) {
    if (language === null) {
      this.player.selectSubtitleTrack(null);
      return true;
    }

    const track = this.player
      .getSubtitleTracks()
      .find((t) => t.language === language && !t.forced);
    if (track) {
      this.player.selectSubtitleTrack(track.id);
      return true;
    }
    return false;
  }

  autoSelectByPreferences(prefs: {
    audioLanguage?: string;
    subtitleLanguage?: string | null;
  }) {
    if (prefs.audioLanguage) {
      this.setAudioByLanguage(prefs.audioLanguage);
    }

    if (prefs.subtitleLanguage !== undefined) {
      this.setSubtitleByLanguage(prefs.subtitleLanguage);
    }
  }
}

// Usage
const trackManager = new TrackManager(player);

trackManager.autoSelectByPreferences({
  audioLanguage: "jpn",
  subtitleLanguage: "eng",
});
```

## Declarative Children (`<source>` + `<track>`)

The custom element parses `<source>` and `<track>` children at connect time, so you can ship full multi-track configurations as plain HTML — no JS source setter required. Use this for **external** files (parallel audio renditions, sidecar subtitles); muxed multi-track files keep using the regular `getAudioTracks()` / `getSubtitleTracks()` APIs above.

```html
<movi-player controls>
  <!-- Premuxed quality picker -->
  <source src="video-1080p.mp4" type="video/mp4" data-height="1080" data-default>
  <source src="video-720p.mp4"  type="video/mp4" data-height="720">

  <!-- Multi-language audio (parallel renditions) -->
  <source src="audio-en.m4a" type="audio/mp4" kind="audio" srclang="en" label="English" default>
  <source src="audio-hi.m4a" type="audio/mp4" kind="audio" srclang="hi" label="Hindi">
  <source src="audio-ja.m4a" type="audio/mp4" kind="audio" srclang="ja" label="Japanese">

  <!-- Sidecar subtitles -->
  <track src="subs-en.vtt" srclang="en" label="English" kind="subtitles" default>
  <track src="subs-hi.vtt" srclang="hi" label="Hindi"   kind="subtitles">
  <track src="subs-jp.srt" srclang="ja" label="Japanese" kind="subtitles" data-format="srt">
</movi-player>
```

**Audio default-pick order:** explicit `default` / `data-default` → first track matching `navigator.language` (two-letter prefix) → first track.

**`<track>` recognition:** `kind="subtitles"`, `kind="captions"`, or no `kind`. Defaults to VTT; pass `data-format="srt"` for SRT files.

See the [Custom Element attribute reference](../api/element.md#declarative-children-source-and-track) for the full list of supported attributes (`data-fps`, `data-badge`, etc.).

---

## Using with the Custom Element

The `<movi-player>` element exposes language-keyed helpers — there is no numeric track-selection on the element itself.

```html
<movi-player id="player" src="multi-track.mkv" controls></movi-player>

<div class="track-controls">
  <label>Audio: <select id="audioSelect"></select></label>
  <label>Subtitles: <select id="subtitleSelect"></select></label>
</div>

<script type="module">
  import "movi-player";

  const player = document.getElementById("player");

  // Tracks are ready by the time `loadeddata` fires
  player.addEventListener("loadeddata", () => {
    const audioSelect = document.getElementById("audioSelect");
    const subtitleSelect = document.getElementById("subtitleSelect");

    // Audio
    audioSelect.innerHTML = "";
    for (const t of player.getAudioLangs()) {
      audioSelect.add(
        new Option(`${t.label} (${t.lang})`, t.lang, t.active, t.active),
      );
    }
    audioSelect.onchange = () => player.selectAudioLang(audioSelect.value);

    // Subtitles
    subtitleSelect.innerHTML = '<option value="">Off</option>';
    for (const t of player.getSubtitleLangs()) {
      subtitleSelect.add(
        new Option(`${t.label} (${t.lang})`, t.lang, t.active, t.active),
      );
    }
    subtitleSelect.onchange = async () => {
      const v = subtitleSelect.value;
      await player.selectSubtitleLang(v || null);
    };
  });

  // React to runtime track switches (e.g., from the context menu)
  player.addEventListener("audiotrackchange", () => {/* refresh UI */});
  player.addEventListener("subtitleTrackChange", () => {/* refresh UI */});
</script>
```

## Supported Codecs

### Audio Codecs

| Codec    | Format       | Notes             |
| -------- | ------------ | ----------------- |
| `aac`    | AAC          | Most common       |
| `mp3`    | MP3          | Legacy            |
| `opus`   | Opus         | Modern            |
| `flac`   | FLAC         | Lossless          |
| `ac3`    | Dolby AC-3   | Surround          |
| `eac3`   | Dolby E-AC-3 | Enhanced Surround |
| `dts`    | DTS          | Surround          |
| `vorbis` | Vorbis       | WebM              |

### Subtitle Formats

| Format      | Extension      | Features           |
| ----------- | -------------- | ------------------ |
| **SRT**     | `.srt`         | Simple text        |
| **ASS/SSA** | `.ass`, `.ssa` | Styled, positioned |
| **WebVTT**  | `.vtt`         | Web standard       |
| **PGS**     | `.sup`         | Blu-ray image subs |
| **VobSub**  | `.sub`, `.idx` | DVD image subs     |

::: tip No Conversion Needed
All tracks are processed in the browser. No need to extract or convert tracks on the server!
:::
