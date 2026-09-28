import { describe, expect, it } from "vitest";

import {
  DEFAULT_EXPERIENCE_DEFAULTS,
  resolveExperiencePreferences,
  sanitizeExperienceDefaultsConfig,
} from "@/lib/flags/experience-defaults";
import { computePolicyGeneration } from "@/lib/flags/policy-generation";
import { getDefaultSiteFlags, resolveSiteFlags } from "@/lib/flags/site-flags";
import { DEFAULT_FLAG_VALUES } from "@/lib/flags/flag-catalog";
import { selectPlaybackShellEngine } from "@/lib/playback/select-playback-engine";
import { toPlayableManifestFromScrape } from "@/lib/playback/to-playable-manifest";

describe("sanitizeExperienceDefaultsConfig", () => {
  it("fills invalid enum values with defaults", () => {
    const result = sanitizeExperienceDefaultsConfig({
      playerEngine: "invalid",
      dashEngine: "bad",
      catalogCardStyle: "wide",
      playbackAudio: "eng",
      playbackQuality: "4k",
      vidsrcApi: "9",
      vidnestContentType: "doc",
      englishSubtitles: "yes",
      hoverSound: 1,
    });

    expect(result).toEqual(DEFAULT_EXPERIENCE_DEFAULTS);
  });

  it("keeps valid overrides", () => {
    const result = sanitizeExperienceDefaultsConfig({
      playerEngine: "movi",
      forcePlayerEngine: true,
      dashEngine: "shaka",
      catalogCardStyle: "poster",
      playbackAudio: "dub",
      playbackQuality: "720p",
      vidsrcApi: "3",
      vidnestContentType: "anime",
      englishSubtitles: false,
      hoverSound: true,
      heroTrailers: false,
      ambientGlow: true,
    });

    expect(result.playerEngine).toBe("movi");
    expect(result.forcePlayerEngine).toBe(true);
    expect(result.dashEngine).toBe("shaka");
    expect(result.catalogCardStyle).toBe("poster");
    expect(result.playbackAudio).toBe("dub");
    expect(result.playbackQuality).toBe("720p");
    expect(result.vidsrcApi).toBe("3");
    expect(result.vidnestContentType).toBe("anime");
    expect(result.englishSubtitles).toBe(false);
    expect(result.hoverSound).toBe(true);
    expect(result.heroTrailers).toBe(false);
    expect(result.ambientGlow).toBe(true);
  });
});

describe("resolveExperiencePreferences", () => {
  const baseFlags = getDefaultSiteFlags();

  it("inherits site defaults when storage is unset", () => {
    const flags = {
      ...baseFlags,
      experienceDefaults: {
        ...DEFAULT_EXPERIENCE_DEFAULTS,
        playerEngine: "movi" as const,
        playbackAudio: "dub" as const,
        playbackQuality: "720p" as const,
        englishSubtitles: false,
        hoverSound: true,
        heroTrailers: false,
        ambientGlow: true,
        catalogCardStyle: "poster" as const,
        vidsrcApi: "2" as const,
        vidnestContentType: "anime" as const,
      },
    };

    const resolved = resolveExperiencePreferences(flags, {});

    expect(resolved.playerEngine).toBe("movi");
    expect(resolved.playbackAudio).toBe("dub");
    expect(resolved.playbackQuality).toBe("720p");
    expect(resolved.playbackEnglishSubtitles).toBe(false);
    expect(resolved.disableHoverSound).toBe(false);
    expect(resolved.disableHeroTrailers).toBe(true);
    expect(resolved.ambientGlow).toBe(false);
    expect(resolved.catalogCardStyle).toBe("poster");
    expect(resolved.vidsrcApi).toBe("2");
    expect(resolved.vidnestContentType).toBe("anime");
  });

  it("uses backdrop when the user has not chosen a catalog card style", () => {
    const resolved = resolveExperiencePreferences(baseFlags, {
      catalogCardStyle: null,
    });

    expect(DEFAULT_EXPERIENCE_DEFAULTS.catalogCardStyle).toBe("backdrop");
    expect(resolved.catalogCardStyle).toBe("backdrop");
  });

  it("prefers saved user values over site defaults", () => {
    const flags = {
      ...baseFlags,
      experienceDefaults: {
        ...DEFAULT_EXPERIENCE_DEFAULTS,
        playbackAudio: "dub" as const,
      },
    };

    const resolved = resolveExperiencePreferences(flags, {
      playbackAudio: "sub",
    });

    expect(resolved.playbackAudio).toBe("sub");
  });

  it("force player and lock catalog style override saved values", () => {
    const flags = {
      ...baseFlags,
      experienceDefaults: {
        ...DEFAULT_EXPERIENCE_DEFAULTS,
        playerEngine: "movi" as const,
        forcePlayerEngine: true,
        catalogCardStyle: "poster" as const,
        lockCatalogCardStyle: true,
      },
    };

    const resolved = resolveExperiencePreferences(flags, {
      playerEngine: "vidstack",
      catalogCardStyle: "backdrop",
    });

    expect(resolved.playerEngine).toBe("movi");
    expect(resolved.catalogCardStyle).toBe("poster");
    expect(resolved.locks.playerEngine).toBe(true);
    expect(resolved.locks.catalogCardStyle).toBe(true);
  });

  it("static hero backdrops still disable trailers", () => {
    const flags = {
      ...baseFlags,
      staticHeroBackdrops: true,
      experienceDefaults: {
        ...DEFAULT_EXPERIENCE_DEFAULTS,
        heroTrailers: true,
      },
    };

    const resolved = resolveExperiencePreferences(flags, {
      disableHeroTrailers: false,
    });

    expect(resolved.disableHeroTrailers).toBe(true);
  });

  it("ambient glow stays off when capability flag is disabled", () => {
    const flags = {
      ...baseFlags,
      ambientGlowEnabled: false,
      experienceDefaults: {
        ...DEFAULT_EXPERIENCE_DEFAULTS,
        ambientGlow: true,
      },
    };

    const resolved = resolveExperiencePreferences(flags, {
      ambientGlow: true,
    });

    expect(resolved.ambientGlow).toBe(false);
  });
});

describe("selectPlaybackShellEngine dash routing", () => {
  it("uses shaka when dashEngine is shaka", () => {
    const manifest = toPlayableManifestFromScrape({
      providerId: "animeonsen",
      providerName: "AnimeOnsen",
      playUrl: "/api/scrape/play/token/asset.mpd",
      streamKind: "dash",
    });

    expect(
      selectPlaybackShellEngine(manifest, {
        userEngine: "movi",
        dashEngine: "shaka",
      }),
    ).toBe("shaka");
  });

  it("uses vidstack for dash when dashEngine is vidstack", () => {
    const manifest = toPlayableManifestFromScrape({
      providerId: "animeonsen",
      providerName: "AnimeOnsen",
      playUrl: "/api/scrape/play/token/asset.mpd",
      streamKind: "dash",
    });

    expect(
      selectPlaybackShellEngine(manifest, {
        userEngine: "movi",
        dashEngine: "vidstack",
      }),
    ).toBe("vidstack");
  });
});

describe("site flags surface switches", () => {
  it("resolves new kill switches with production defaults", () => {
    const flags = resolveSiteFlags(DEFAULT_FLAG_VALUES);

    expect(flags.cardHoverPreviews).toBe(true);
    expect(flags.youtubeHoverFallback).toBe(true);
    expect(flags.adblockPrompt).toBe(true);
    expect(flags.devtoolsTrap).toBe(true);
    expect(flags.malSync).toBe(true);
    expect(flags.homeTop10).toBe(true);
    expect(flags.experienceDefaults).toEqual(DEFAULT_EXPERIENCE_DEFAULTS);
  });

  it("does not bump policy generation when experience defaults change", () => {
    const before = getDefaultSiteFlags();
    const after = resolveSiteFlags(DEFAULT_FLAG_VALUES, undefined, undefined, {
      ...DEFAULT_EXPERIENCE_DEFAULTS,
      playerEngine: "movi",
      playbackAudio: "dub",
    });

    expect(computePolicyGeneration(before)).toBe(
      computePolicyGeneration(after),
    );
  });
});
