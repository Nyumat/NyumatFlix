import { afterAll, describe, expect, it, vi } from "vitest";
import { TrackManager } from "../core/TrackManager";
import { MoviElement } from "../render/MoviElement";
import type { PlayerState } from "../types";

vi.hoisted(() => vi.stubGlobal("HTMLElement", class {}));
vi.mock("../core/MoviPlayer", () => ({ MoviPlayer: class {} }));
afterAll(() => vi.unstubAllGlobals());

class VideoStub extends EventTarget {
  videoWidth = 0;
  videoHeight = 0;
  readyState = 0;
  style = { width: "", height: "", display: "", objectFit: "" };
  className = "";
  replaceWith = vi.fn();
}

class ClassListStub extends Set<string> {
  contains(name: string): boolean { return this.has(name); }
  remove(...names: string[]): void { names.forEach((name) => this.delete(name)); }
  toggle(name: string, enabled: boolean): boolean {
    if (enabled) this.add(name);
    else this.delete(name);
    return enabled;
  }
}

const createPlayer = (nativeVideo: VideoStub | null) => ({
  trackManager: new TrackManager(),
  hasAudibleSource: () => true,
  getState: vi.fn<() => PlayerState>(() => "ready"),
  getNativeVideoElement: () => nativeVideo,
  destroy: vi.fn(),
});

interface LayoutHarness {
  player: ReturnType<typeof createPlayer> | null;
  video: VideoStub;
  classList: ClassListStub;
  eventHandlers: Map<string, () => void>;
  _src: string;
  _audioOnly: boolean;
  _mediaMetadataReady: boolean;
  updateCoverArtOverlay(): void;
  mountNativeStreamVideo(): void;
  observeNativeVideoLayout(): void;
  load(): Promise<void>;
}

const createHarness = (nativeVideo: VideoStub | null = new VideoStub()) => {
  const element = Object.create(MoviElement.prototype) as LayoutHarness;
  const player = createPlayer(nativeVideo);
  Object.assign(element, {
    player,
    video: new VideoStub(),
    classList: new ClassListStub(),
    eventHandlers: new Map<string, () => void>(),
    shadowRoot: { querySelector: () => null },
    coverArtOverlay: { style: { display: "none" } },
    coverArtCanvas: {},
    _src: "https://cdn.example/movie.m3u8",
    _presentation: "native",
    _audioOnly: false,
    _mediaMetadataReady: false,
    _lastStripDispatched: null,
    ensurePosterCoverArt: vi.fn(),
    dispatchEvent: vi.fn(),
    resetTimeline: vi.fn(),
    initializePlayer: vi.fn().mockResolvedValue(undefined),
  });
  return { element, player };
};

const expectVideoLayout = (element: LayoutHarness) => {
  expect(element.classList.contains("movi-audio-mode")).toBe(false);
  expect(element.classList.contains("movi-audio-strip")).toBe(false);
};

describe("Movi audio layout", () => {
  it.each<PlayerState>(["idle", "loading", "ready", "paused", "buffering", "seeking", "playing"])(
    "does not collapse an unresolved video in state %s",
    (state) => {
      const { element, player } = createHarness();
      player.getState.mockReturnValue(state);
      element.updateCoverArtOverlay();
      expectVideoLayout(element);
    },
  );

  it("waits for native media data even after the manifest finishes loading", () => {
    const video = new VideoStub();
    video.readyState = 1;
    const { element } = createHarness(video);
    element._mediaMetadataReady = true;
    element.updateCoverArtOverlay();
    expectVideoLayout(element);
  });

  it("uses the wrapper's video dimensions before its element is mounted", () => {
    const video = new VideoStub();
    video.videoWidth = 1728;
    video.videoHeight = 720;
    video.readyState = 4;
    const { element } = createHarness(video);
    element._mediaMetadataReady = true;
    element.updateCoverArtOverlay();
    expectVideoLayout(element);
  });

  it.each(["resize", "loadedmetadata", "loadeddata"])(
    "restores video layout when late dimensions arrive via %s",
    (event) => {
      const video = new VideoStub();
      video.readyState = 4;
      const { element } = createHarness(video);
      element._mediaMetadataReady = true;
      element.mountNativeStreamVideo();
      element.updateCoverArtOverlay();
      expect(element.classList.contains("movi-audio-strip")).toBe(true);

      video.videoWidth = 1728;
      video.videoHeight = 720;
      video.dispatchEvent(new Event(event));
      expectVideoLayout(element);
    },
  );

  it("keeps the strip for a resolved native audio source", () => {
    const video = new VideoStub();
    video.readyState = 4;
    const { element } = createHarness(video);
    element._mediaMetadataReady = true;
    element.updateCoverArtOverlay();
    expect(element.classList.contains("movi-audio-strip")).toBe(true);
  });

  it("keeps a known video rendition visible before its first frame", () => {
    const { element, player } = createHarness();
    player.trackManager.setTracks([{
      id: 0, type: "video", codec: "avc1", width: 1728, height: 720, frameRate: 24,
    }]);
    element._mediaMetadataReady = true;
    element.updateCoverArtOverlay();
    expectVideoLayout(element);
  });

  it("preserves audio files while metadata is still loading", () => {
    const { element } = createHarness(null);
    element._src = "https://cdn.example/song.mp3";
    element.updateCoverArtOverlay();
    expect(element.classList.contains("movi-audio-strip")).toBe(true);
  });

  it("supports demuxed audio only after its tracks are resolved", () => {
    const { element } = createHarness(null);
    element._src = "https://cdn.example/recording.mkv";
    element.updateCoverArtOverlay();
    expectVideoLayout(element);
    element._mediaMetadataReady = true;
    element.updateCoverArtOverlay();
    expect(element.classList.contains("movi-audio-strip")).toBe(true);
  });

  it("does not turn a failed video into an audio strip", () => {
    const video = new VideoStub();
    video.readyState = 4;
    const { element, player } = createHarness(video);
    element._mediaMetadataReady = true;
    player.getState.mockReturnValue("error");
    element.updateCoverArtOverlay();
    expectVideoLayout(element);
  });

  it("does not register duplicate listeners when remounting the same video", () => {
    const { element } = createHarness();
    element.mountNativeStreamVideo();
    element.mountNativeStreamVideo();
    const update = vi.spyOn(element, "updateCoverArtOverlay");
    element.video.dispatchEvent(new Event("resize"));
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("observes a native decoder's late dimensions without mounting its video", () => {
    const video = new VideoStub();
    video.readyState = 4;
    const { element } = createHarness(video);
    element._mediaMetadataReady = true;
    element.observeNativeVideoLayout();
    expect(element.classList.contains("movi-audio-strip")).toBe(true);
    video.videoWidth = 1728;
    video.videoHeight = 720;
    video.dispatchEvent(new Event("resize"));
    expectVideoLayout(element);
    expect(element.video).not.toBe(video);
  });

  it("preserves explicitly requested audio-only playback", () => {
    const video = new VideoStub();
    video.videoWidth = 1728;
    video.videoHeight = 720;
    const { element } = createHarness(video);
    element._audioOnly = true;
    element.updateCoverArtOverlay();
    expect(element.classList.contains("movi-audio-strip")).toBe(true);
  });

  it("resets classification and detaches native listeners on a source change", async () => {
    const video = new VideoStub();
    video.readyState = 4;
    const { element } = createHarness(video);
    element._mediaMetadataReady = true;
    element.mountNativeStreamVideo();
    const update = vi.spyOn(element, "updateCoverArtOverlay");
    element._src = "https://cdn.example/next.m3u8";
    await element.load();
    expect(element._mediaMetadataReady).toBe(false);
    expectVideoLayout(element);
    update.mockClear();
    video.dispatchEvent(new Event("resize"));
    expect(update).not.toHaveBeenCalled();
  });
});
