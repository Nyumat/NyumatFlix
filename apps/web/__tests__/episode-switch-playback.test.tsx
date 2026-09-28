import { act, render, renderHook } from "@testing-library/react";
import { useEffect, type ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlaybackShell } from "@/components/media/playback-shell";
import { HeroScrapePlayerPanel } from "@/components/hero/hero-scrape-player-panel";
import { usePlaybackResolve } from "@/hooks/use-playback-resolve";
import type { ScrapeApiResponse } from "@/lib/playback/provider-lookup";
import { createSourceLookupCache } from "@/lib/playback/source-lookup-cache";
import { toPlayableManifestFromScrape } from "@/lib/playback/to-playable-manifest";
import type { VideoServer } from "@/lib/stores/server-store";

type ShellProps = ComponentProps<typeof PlaybackShell>;

const shellMounts: string[] = [];
let latestShellProps: ShellProps | null = null;

const PlaybackShellStub = (props: ShellProps) => {
  latestShellProps = props;
  useEffect(() => {
    shellMounts.push(props.manifest.id);
  }, []);
  return null;
};

vi.mock("next/dynamic", () => ({
  default: () => (props: ShellProps) => PlaybackShellStub(props),
}));

vi.mock("@/components/providers/feature-flags-provider", () => ({
  useFeatureFlags: () => ({ maintenanceMode: false }),
}));

vi.mock("@/hooks/use-movi-player-loaded", () => ({
  useMoviPlayerLoaded: () => true,
}));

vi.mock("@/lib/stores/server-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/stores/server-store")>()),
  isScrapeServer: () => true,
}));

type EpisodeInput = { episode: number; audio?: string };

type Deferred = {
  body: Record<string, unknown>;
  resolve: (response: ScrapeApiResponse) => void;
  settled: boolean;
};

const flushAsync = async () => {
  for (let index = 0; index < 5; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

const okFor = (providerId: string, episode: unknown): ScrapeApiResponse => ({
  ok: true,
  providerId,
  providerName: providerId,
  playUrl: `https://cdn/${providerId}/e${String(episode)}.m3u8`,
  streamKind: "hls",
});

const setupResolve = () => {
  const requests: Deferred[] = [];
  const requestScrape = vi.fn(
    (body: Record<string, unknown>) =>
      new Promise<ScrapeApiResponse>((resolve) => {
        requests.push({ body, resolve, settled: false });
      }),
  );
  const lookupCache = createSourceLookupCache();
  const onAllProvidersFailed = vi.fn();
  const config = {
    mediaKeyFor: (input: EpisodeInput) =>
      `tv:1:1:${input.episode}:${input.audio ?? "default"}`,
    episodeKeyFor: (input: EpisodeInput) => `tv:1:1:${input.episode}`,
    providerOrderFor: () => ["alpha", "beta"],
    providerLabels: { alpha: "Alpha", beta: "Beta" },
    buildScrapeBody: (input: EpisodeInput, providerId: string) => ({
      providerId,
      episode: input.episode,
    }),
    lookupCache,
    requestScrape,
    onAllProvidersFailed,
  };
  const hook = renderHook(() => usePlaybackResolve(config));
  const settle = async (
    match: (body: Record<string, unknown>) => boolean,
    response: (body: Record<string, unknown>) => ScrapeApiResponse,
  ) => {
    await act(async () => {
      await flushAsync();
      for (const request of requests) {
        if (request.settled || !match(request.body)) {
          continue;
        }
        request.settled = true;
        request.resolve(response(request.body));
      }
      await flushAsync();
    });
  };
  return {
    hook,
    requests,
    requestScrape,
    lookupCache,
    onAllProvidersFailed,
    settle,
  };
};

const forEpisode = (episode: number) => (body: Record<string, unknown>) =>
  body.episode === episode;
const ok = (body: Record<string, unknown>) =>
  okFor(String(body.providerId), body.episode);
const fail = (): ScrapeApiResponse => ({ ok: false, error: "Not found" });

describe("episode switching in usePlaybackResolve", () => {
  it("rapid E1 → E2 → E1 only ever shows E1, and ignores E2's late answer", async () => {
    const { hook, settle } = setupResolve();

    act(() => hook.result.current.startScraping({ episode: 1 }));
    act(() => hook.result.current.startScraping({ episode: 2 }));
    act(() => hook.result.current.startScraping({ episode: 1 }));

    await settle(forEpisode(2), ok);
    expect(hook.result.current.result).toBeNull();
    expect(hook.result.current.status).toBe("scraping");
    expect(hook.result.current.episodeKey).toBe("tv:1:1:1");

    await settle(forEpisode(1), ok);
    expect(hook.result.current.status).toBe("playing");
    expect(hook.result.current.result?.playUrl).toContain("/e1.m3u8");
  });

  it("clears the previous episode immediately when a different one is selected", async () => {
    const { hook, settle } = setupResolve();

    act(() => hook.result.current.startScraping({ episode: 1 }));
    await settle(forEpisode(1), ok);
    expect(hook.result.current.manifest).not.toBeNull();

    act(() => hook.result.current.startScraping({ episode: 2 }));
    expect(hook.result.current.status).toBe("scraping");
    expect(hook.result.current.result).toBeNull();
    expect(hook.result.current.manifest).toBeNull();
  });

  it("a failed lookup errors for the selected episode and never restores the previous stream", async () => {
    const { hook, settle, onAllProvidersFailed } = setupResolve();

    act(() => hook.result.current.startScraping({ episode: 1 }));
    await settle(forEpisode(1), ok);

    act(() => hook.result.current.startScraping({ episode: 2 }));
    await settle(forEpisode(2), fail);
    await settle(forEpisode(2), fail);

    expect(hook.result.current.status).toBe("error");
    expect(hook.result.current.result).toBeNull();
    expect(hook.result.current.manifest).toBeNull();
    expect(hook.result.current.episodeKey).toBe("tv:1:1:2");
    expect(onAllProvidersFailed).toHaveBeenCalledTimes(1);
  });

  it("keeps playing the current stream while changing sources within the same episode", async () => {
    const { hook, settle } = setupResolve();

    act(() => hook.result.current.startScraping({ episode: 1 }));
    await settle(forEpisode(1), ok);
    const playing = hook.result.current.result;

    act(() => hook.result.current.switchToProvider({ episode: 1 }, "beta"));
    expect(hook.result.current.result).toBe(playing);

    await settle((body) => body.providerId === "beta", fail);
    await settle((body) => body.providerId === "alpha", fail);
    expect(hook.result.current.status).toBe("playing");
    expect(hook.result.current.result).toBe(playing);
  });

  it("keeps playing across an audio change within the same episode", async () => {
    const { hook, settle } = setupResolve();

    act(() => hook.result.current.startScraping({ episode: 1 }));
    await settle(forEpisode(1), ok);
    const playing = hook.result.current.result;

    act(() => hook.result.current.startScraping({ episode: 1, audio: "ja" }));
    expect(hook.result.current.result).toBe(playing);
  });

  it("joins a prefetch for play and replaces an expired cached stream with a fresh lookup", async () => {
    const { hook, settle, requestScrape } = setupResolve();

    act(() => {
      hook.result.current.prefetch({ episode: 1 });
    });
    act(() => hook.result.current.startScraping({ episode: 1 }));
    await settle(forEpisode(1), ok);
    const sharedLookupCalls = requestScrape.mock.calls.length;
    expect(sharedLookupCalls).toBe(2);

    act(() => hook.result.current.startScraping({ episode: 1 }));
    await act(flushAsync);
    expect(requestScrape).toHaveBeenCalledTimes(sharedLookupCalls);
    expect(hook.result.current.status).toBe("playing");

    let recovered = false;
    act(() => {
      recovered = hook.result.current.recoverCachedStartFailure({ episode: 1 });
    });
    expect(recovered).toBe(true);
    expect(hook.result.current.status).toBe("scraping");
    expect(hook.result.current.result).toBeNull();

    await settle(
      (body) => body.episode === 1,
      (body) => ({
        ...ok(body),
        playUrl: "https://cdn/alpha/e1-fresh.m3u8",
      }),
    );
    expect(hook.result.current.result?.playUrl).toBe(
      "https://cdn/alpha/e1-fresh.m3u8",
    );
  });

  it("does not treat a stream from another episode as a recoverable cached failure", async () => {
    const { hook, settle } = setupResolve();

    act(() => hook.result.current.startScraping({ episode: 1 }));
    await settle(forEpisode(1), ok);
    act(() => hook.result.current.startScraping({ episode: 1 }));
    await act(flushAsync);

    expect(hook.result.current.recoverCachedStartFailure({ episode: 2 })).toBe(
      false,
    );
  });
});

describe("hero scrape player panel generations", () => {
  const selectedServer = { id: "scrape" } as unknown as VideoServer;
  const manifestFor = (episode: number) =>
    toPlayableManifestFromScrape({
      providerId: "alpha",
      providerName: "Alpha",
      playUrl: `https://cdn/alpha/e${episode}.m3u8`,
      streamKind: "hls",
    });

  const renderPanel = (
    playbackGeneration: number,
    episode: number,
    handlers: {
      onEnded: (generation: number) => Promise<boolean>;
      onFatalError: (generation: number, started: boolean) => void;
      onMediaReadyChange: (generation: number, ready: boolean) => void;
    },
  ) => (
    <HeroScrapePlayerPanel
      selectedServer={selectedServer}
      scrapeStatus="playing"
      scrapeResult={null}
      playbackManifest={manifestFor(episode)}
      scrapeError={null}
      activeProviderId="alpha"
      sourceOverlayItems={[]}
      playbackTitle={`Episode ${episode}`}
      playbackPosterUrl={null}
      progressKey={{
        mediaType: "tv",
        contentId: 1,
        seasonNumber: 1,
        episodeNumber: episode,
      }}
      imdbId={null}
      isTv
      onSelectEmbedServer={() => undefined}
      playbackGeneration={playbackGeneration}
      {...handlers}
    />
  );

  beforeEach(() => {
    shellMounts.length = 0;
    latestShellProps = null;
  });

  it("remounts media per episode and tags end, error, and ready events with their generation", () => {
    const handlers = {
      onEnded: vi.fn(async () => true),
      onFatalError: vi.fn(),
      onMediaReadyChange: vi.fn(),
    };
    const view = render(renderPanel(1, 1, handlers));
    const firstEpisodeShell = latestShellProps;

    view.rerender(renderPanel(2, 2, handlers));
    expect(shellMounts).toHaveLength(2);

    act(() => {
      void firstEpisodeShell?.onEnded?.();
      firstEpisodeShell?.onFatalError();
      firstEpisodeShell?.onMediaReady?.(true);
    });
    expect(handlers.onEnded).toHaveBeenLastCalledWith(1);
    expect(handlers.onFatalError).toHaveBeenLastCalledWith(1, false);
    expect(handlers.onMediaReadyChange).not.toHaveBeenCalledWith(1, true);

    act(() => {
      void latestShellProps?.onEnded?.();
      latestShellProps?.onMediaReady?.(true);
    });
    expect(handlers.onEnded).toHaveBeenLastCalledWith(2);
    expect(handlers.onMediaReadyChange).toHaveBeenLastCalledWith(2, true);
  });

  it("remounts media when returning to an episode with the same stream", () => {
    const handlers = {
      onEnded: vi.fn(async () => true),
      onFatalError: vi.fn(),
      onMediaReadyChange: vi.fn(),
    };
    const view = render(renderPanel(1, 1, handlers));
    view.rerender(renderPanel(2, 2, handlers));
    view.rerender(renderPanel(3, 1, handlers));

    expect(shellMounts).toEqual([
      manifestFor(1).id,
      manifestFor(2).id,
      manifestFor(1).id,
    ]);
  });
});
