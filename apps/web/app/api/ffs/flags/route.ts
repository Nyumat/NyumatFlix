import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import {
  readAdminFlagState,
  readAnnouncementBannerConfig,
  readExperienceDefaultsConfig,
  readHeroBackdropOverridesConfig,
  readProviderMenuOrderConfig,
  writeAdminFlagState,
} from "@/lib/flags/flipt-admin";
import {
  DEFAULT_EXPERIENCE_DEFAULTS,
  sanitizeExperienceDefaultsConfig,
  type ExperienceDefaultsConfig,
} from "@/lib/flags/experience-defaults";
import {
  DEFAULT_ANNOUNCEMENT_BANNER_CONFIG,
  sanitizeAnnouncementBannerConfig,
  type AnnouncementBannerConfig,
} from "@/lib/flags/announcement-banner";
import {
  DEFAULT_PROVIDER_MENU_ORDER,
  sanitizeProviderMenuOrderConfig,
  type ProviderMenuOrderConfig,
} from "@/lib/flags/provider-menu-order";
import {
  DEFAULT_HERO_BACKDROP_OVERRIDES,
  sanitizeHeroBackdropOverridesConfig,
  type HeroBackdropOverridesConfig,
} from "@/lib/flags/hero-backdrop-overrides";
import { HERO_BACKDROP_OVERRIDES_CACHE_TAG } from "@/lib/flags/hero-backdrop-overrides-server";
import { SITE_FLAGS_CACHE_TAG } from "@/lib/flags/site-flags-cache-tag";
import { buildAnilistTvDetailHref } from "@/lib/anilist-route-id";
import { buildMalAnimeDetailHref } from "@/lib/mal/route-id";
import { buildTmdbAnimeDetailHref } from "@/lib/tmdb-anime-route-id";
import {
  applyPlaybackMutualExclusion,
  buildDefaultAdminFlagState,
  type AdminFlagState,
} from "@/lib/flags/flag-catalog";
import { assertFfsHost } from "@/lib/ffs/require-ffs-host";

const HUB_PATHS = ["/", "/movies", "/tvshows", "/anime", "/trending"];

const revalidateHeroBackdropPaths = (
  overrides: HeroBackdropOverridesConfig,
): void => {
  try {
    revalidateTag(HERO_BACKDROP_OVERRIDES_CACHE_TAG, "max");
  } catch {
    void 0;
  }

  const paths = new Set<string>(HUB_PATHS);
  for (const entry of overrides.entries) {
    if (entry.mediaType === "movie" && entry.tmdbId) {
      paths.add(`/movies/${entry.tmdbId}`);
    }
    if (entry.mediaType === "tv" && entry.tmdbId) {
      paths.add(`/tvshows/${entry.tmdbId}`);
    }
    if (entry.mediaType === "anime") {
      if (entry.anilistId) {
        paths.add(buildAnilistTvDetailHref(entry.anilistId));
      }
      if (entry.malId) {
        paths.add(buildMalAnimeDetailHref(entry.malId));
      }
      if (entry.tmdbId) {
        paths.add(buildTmdbAnimeDetailHref(entry.tmdbId, "tv"));
        paths.add(buildTmdbAnimeDetailHref(entry.tmdbId, "movie"));
      }
    }
  }

  for (const path of paths) {
    try {
      revalidatePath(path);
    } catch {
      void 0;
    }
  }
};

export async function GET(request: NextRequest) {
  if (!assertFfsHost(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const [
      flags,
      announcementBanner,
      providerMenuOrder,
      heroBackdropOverrides,
      experienceDefaults,
    ] = await Promise.all([
      readAdminFlagState(),
      readAnnouncementBannerConfig(),
      readProviderMenuOrderConfig(),
      readHeroBackdropOverridesConfig(),
      readExperienceDefaultsConfig(),
    ]);
    return NextResponse.json({
      flags,
      announcementBanner,
      providerMenuOrder,
      heroBackdropOverrides,
      experienceDefaults,
    });
  } catch (error) {
    console.error("[ffs] GET flags failed:", error);
    return NextResponse.json(
      {
        flags: buildDefaultAdminFlagState(),
        announcementBanner: DEFAULT_ANNOUNCEMENT_BANNER_CONFIG,
        providerMenuOrder: DEFAULT_PROVIDER_MENU_ORDER,
        heroBackdropOverrides: DEFAULT_HERO_BACKDROP_OVERRIDES,
        experienceDefaults: DEFAULT_EXPERIENCE_DEFAULTS,
        degraded: true,
      },
      { status: 200 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  if (!assertFfsHost(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: {
    flags?: AdminFlagState;
    announcementBanner?: AnnouncementBannerConfig;
    providerMenuOrder?: ProviderMenuOrderConfig;
    heroBackdropOverrides?: HeroBackdropOverridesConfig;
    experienceDefaults?: ExperienceDefaultsConfig;
  };
  try {
    body = (await request.json()) as {
      flags?: AdminFlagState;
      announcementBanner?: AnnouncementBannerConfig;
      providerMenuOrder?: ProviderMenuOrderConfig;
      heroBackdropOverrides?: HeroBackdropOverridesConfig;
      experienceDefaults?: ExperienceDefaultsConfig;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.flags || typeof body.flags !== "object") {
    return NextResponse.json({ error: "Missing flags" }, { status: 400 });
  }

  const flags = applyPlaybackMutualExclusion(body.flags);
  const announcementBanner = sanitizeAnnouncementBannerConfig(
    body.announcementBanner,
  );
  const providerMenuOrder = sanitizeProviderMenuOrderConfig(
    body.providerMenuOrder,
  );
  const heroBackdropOverrides = sanitizeHeroBackdropOverridesConfig(
    body.heroBackdropOverrides,
  );
  const experienceDefaults = sanitizeExperienceDefaultsConfig(
    body.experienceDefaults,
  );

  if (
    flags["global.announcement_banner"] &&
    !announcementBanner.title &&
    !announcementBanner.message
  ) {
    return NextResponse.json(
      { error: "Add a banner title or message before enabling it" },
      { status: 400 },
    );
  }

  try {
    await writeAdminFlagState(
      flags,
      announcementBanner,
      providerMenuOrder,
      heroBackdropOverrides,
      experienceDefaults,
    );
    try {
      revalidateTag(SITE_FLAGS_CACHE_TAG, { expire: 0 });
    } catch {
      void 0;
    }
    revalidateHeroBackdropPaths(heroBackdropOverrides);
    return NextResponse.json({
      flags,
      announcementBanner,
      providerMenuOrder,
      heroBackdropOverrides,
      experienceDefaults,
      ok: true,
    });
  } catch (error) {
    console.error("[ffs] PATCH flags failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Save failed" },
      { status: 502 },
    );
  }
}
