# Use Cases

Real-world applications and industry-specific examples for Movi-Player.

## Demuxer Use Cases

The lightweight demuxer module (~45KB) is perfect for metadata extraction without playback.

### Media Asset Management (MAM)

Catalog and index large video libraries:

```typescript
import { Demuxer, HttpSource } from "movi-player/demuxer";

async function catalogVideo(url: string) {
  const source = new HttpSource(url);
  const demuxer = new Demuxer(source);
  const info = await demuxer.open();

  const video = demuxer.getVideoTracks()[0];

  const result = {
    duration: info.duration,
    resolution: `${video.width}x${video.height}`,
    codec: video.codec,
    isHDR: video.isHDR,
    hdrFormat: video.isHDR
      ? video.colorTransfer === "smpte2084"
        ? "HDR10"
        : "HLG"
      : null,
    audioTracks: demuxer.getAudioTracks().map((t) => ({
      language: t.language,
      channels: t.channels,
      codec: t.codec,
    })),
    subtitles: demuxer.getSubtitleTracks().map((t) => ({
      language: t.language,
      codec: t.codec,
    })),
  };

  demuxer.close();
  return result;
}
```

### Video File Validator

Validate uploaded videos meet platform requirements:

```typescript
import { Demuxer, FileSource } from "movi-player/demuxer";

interface ValidationResult {
  valid: boolean;
  errors: string[];
  metadata?: object;
}

async function validateUpload(file: File): Promise<ValidationResult> {
  const source = new FileSource(file);
  const demuxer = new Demuxer(source);

  try {
    const info = await demuxer.open();
    const video = demuxer.getVideoTracks()[0];

    const errors: string[] = [];

    if (video.width > 3840 || video.height > 2160) {
      errors.push("Resolution exceeds 4K limit");
    }

    if (!["h264", "hevc", "vp9", "av1"].includes(video.codec)) {
      errors.push("Unsupported video codec");
    }

    if (info.duration > 3600) {
      errors.push("Duration exceeds 1 hour limit");
    }

    demuxer.close();

    return {
      valid: errors.length === 0,
      errors,
      metadata: {
        duration: info.duration,
        resolution: `${video.width}x${video.height}`,
        codec: video.codec,
      },
    };
  } catch (error) {
    return { valid: false, errors: ["Invalid video file"] };
  }
}
```

### HDR Content Detection

Automatically detect and tag HDR content:

```typescript
import { Demuxer, HttpSource } from "movi-player/demuxer";

async function detectHDR(videoUrls: string[]) {
  return Promise.all(
    videoUrls.map(async (url) => {
      const source = new HttpSource(url);
      const demuxer = new Demuxer(source);
      await demuxer.open();

      const video = demuxer.getVideoTracks()[0];

      const result = {
        url,
        isHDR: video.isHDR,
        colorSpace: {
          primaries: video.colorPrimaries,
          transfer: video.colorTransfer,
          matrix: video.colorSpace,
        },
        hdrFormat:
          video.colorTransfer === "smpte2084"
            ? "HDR10"
            : video.colorTransfer === "arib-std-b67"
              ? "HLG"
              : null,
      };

      demuxer.close();
      return result;
    }),
  );
}
```

## Player Use Cases

The player module (~180KB) provides full playback with custom UI.

### Custom Branded Player

Build a branded video player:

```typescript
import { MoviPlayer, LogLevel } from "movi-player/player";

class CustomVideoPlayer {
  private player: MoviPlayer;
  private canvas: HTMLCanvasElement;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement("canvas");
    container.appendChild(this.canvas);

    MoviPlayer.setLogLevel(LogLevel.ERROR);

    this.player = new MoviPlayer({
      source: { type: "url", url: "" },
      canvas: this.canvas,
      renderer: "canvas",
      decoder: "auto",
    });

    this.setupControls(container);
    this.setupEvents();
  }

  private setupControls(container: HTMLElement) {
    const controls = document.createElement("div");
    controls.innerHTML = `
      <button id="play">Play</button>
      <button id="pause">Pause</button>
      <input type="range" id="seek" min="0" max="100">
      <span id="time">0:00 / 0:00</span>
    `;
    container.appendChild(controls);

    controls.querySelector("#play")!.onclick = () => this.player.play();
    controls.querySelector("#pause")!.onclick = () => this.player.pause();
  }

  private setupEvents() {
    this.player.on("stateChange", (state) => {
      console.log("State:", state);
    });

    this.player.on("error", (error) => {
      console.error("Error:", error);
    });
  }

  async load(url: string) {
    this.player = new MoviPlayer({
      source: { type: "url", url },
      canvas: this.canvas,
    });
    await this.player.load();
  }
}
```

### E-Learning Platform

Interactive video with quizzes:

```typescript
import { MoviPlayer } from "movi-player/player";

interface QuizPoint {
  timestamp: number;
  question: string;
  answers: string[];
  correct: number;
  completed: boolean;
}

class InteractiveLearningVideo {
  private player: MoviPlayer;
  private quizPoints: QuizPoint[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.player = new MoviPlayer({
      source: { type: "url", url: "" },
      canvas,
    });
  }

  async loadCourse(url: string, quizzes: QuizPoint[]) {
    this.quizPoints = quizzes;

    this.player = new MoviPlayer({
      source: { type: "url", url },
      canvas: document.getElementById("canvas") as HTMLCanvasElement,
    });

    // Check for quiz points during playback
    setInterval(() => {
      const currentTime = this.player.getCurrentTime();

      const quiz = this.quizPoints.find(
        (q) => Math.abs(currentTime - q.timestamp) < 0.5 && !q.completed,
      );

      if (quiz) {
        this.player.pause();
        this.showQuiz(quiz);
      }
    }, 500);

    await this.player.load();
  }

  private showQuiz(quiz: QuizPoint) {
    // Show quiz UI, pause video until answered
  }
}
```

### Multi-Language Platform

Netflix-style audio/subtitle switching:

```typescript
import { MoviPlayer } from "movi-player/player";

class MultiLanguagePlayer {
  private player: MoviPlayer;

  async initialize(url: string, canvas: HTMLCanvasElement) {
    this.player = new MoviPlayer({
      source: { type: "url", url },
      canvas,
    });

    await this.player.load();
    this.buildTrackMenu();
  }

  private buildTrackMenu() {
    const audioTracks = this.player.getAudioTracks();
    const subtitleTracks = this.player.getSubtitleTracks();

    console.log(
      "Audio tracks:",
      audioTracks.map((t) => ({
        id: t.id,
        language: t.language,
        channels: t.channels === 6 ? "5.1" : "2.0",
      })),
    );

    console.log(
      "Subtitle tracks:",
      subtitleTracks.map((t) => ({
        id: t.id,
        language: t.language,
      })),
    );
  }

  switchAudio(trackId: number) {
    this.player.selectAudioTrack(trackId);
  }

  switchSubtitle(trackId: number | null) {
    this.player.selectSubtitleTrack(trackId);
  }
}
```

### Thumbnail Generation

Generate video thumbnails:

```typescript
import { MoviPlayer } from "movi-player/player";

class ThumbnailGenerator {
  async generateThumbnails(url: string, count: number = 10): Promise<Blob[]> {
    const canvas = document.createElement("canvas");
    const player = new MoviPlayer({
      source: { type: "url", url },
      canvas,
      enablePreviews: true,
    });

    await player.load();

    const duration = player.getDuration();
    const interval = duration / (count + 1);
    const thumbnails: Blob[] = [];

    for (let i = 1; i <= count; i++) {
      const timestamp = interval * i;
      const thumbnail = await player.getPreviewFrame(timestamp);
      if (thumbnail) thumbnails.push(thumbnail);
    }

    player.destroy();
    return thumbnails;
  }
}
```

## Element Use Cases

The full element (~410KB) provides drop-in video player.

### CMS Integration

WordPress/Drupal video player:

```html
<movi-player
  src="https://cdn.example.com/videos/tutorial.mp4"
  poster="https://cdn.example.com/thumbnails/tutorial.jpg"
  controls
  width="800"
  height="450"
></movi-player>
```

### E-Commerce Product Videos

Shopify product showcase:

```html
<div class="product-video">
  <movi-player
    src="https://cdn.shop.com/products/demo.mp4"
    poster="https://cdn.shop.com/products/thumb.jpg"
    hdr
    theme="light"
    objectfit="contain"
    controls
    autoplay
    muted
    loop
  ></movi-player>
</div>

<script type="module">
  import "movi-player";

  const player = document.querySelector("movi-player");

  player.addEventListener("ended", () => {
    showAddToCartButton();
  });
</script>
```

### News & Media

Auto-play muted with scroll detection:

```html
<article>
  <h1>Breaking News</h1>

  <movi-player
    src="https://news.cdn.com/videos/story.mp4"
    controls
    autoplay
    muted
    theme="dark"
    style="width: 100%; max-width: 800px;"
  ></movi-player>
</article>

<script type="module">
  import "movi-player";

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const player = entry.target;
        if (entry.isIntersecting) {
          player.play();
        } else {
          player.pause();
        }
      });
    },
    { threshold: 0.5 },
  );

  document.querySelectorAll("movi-player").forEach((player) => {
    observer.observe(player);
  });
</script>
```

### Online Course Platform

Progress tracking:

```html
<movi-player
  id="course-video"
  src="https://courses.com/lessons/lesson-01.mp4"
  controls
  theme="dark"
></movi-player>

<script type="module">
  import "movi-player";

  const player = document.getElementById("course-video");

  // Save progress
  player.addEventListener("timeupdate", (e) => {
    const progress = player.currentTime / player.duration;
    localStorage.setItem("course-progress", progress.toString());
  });

  // Resume from last position
  player.addEventListener("loadedmetadata", () => {
    const saved = parseFloat(localStorage.getItem("course-progress") || "0");
    if (saved > 0) {
      player.currentTime = saved * player.duration;
    }
  });

  // Next lesson
  player.addEventListener("ended", () => {
    showNextLessonButton();
  });
</script>
```

### Portfolio Demo Reel

HDR with ambient mode:

```html
<div class="demo-reel">
  <movi-player
    src="https://portfolio.com/demo-reel.mp4"
    poster="https://portfolio.com/demo-thumb.jpg"
    controls
    hdr
    ambientmode
    theme="dark"
    objectfit="cover"
    style="width: 100%; height: 600px; border-radius: 12px;"
  ></movi-player>
</div>
```

## Industry Applications

| Industry                | Module         | Key Features                      |
| ----------------------- | -------------- | --------------------------------- |
| **Streaming Platforms** | Element/Player | Multi-track, HDR, subtitles       |
| **E-Commerce**          | Element        | Product videos, loop, autoplay    |
| **Education**           | Player         | Quizzes, chapters, progress       |
| **News/Media**          | Element        | Auto-play muted, scroll detection |
| **MAM Systems**         | Demuxer        | Metadata extraction, indexing     |
| **Video Validators**    | Demuxer        | File validation, codec check      |
| **Transcoding**         | Demuxer        | Pre-inspection, preset selection  |
| **Digital Signage**     | Element        | Loop, fullscreen, HDR             |
