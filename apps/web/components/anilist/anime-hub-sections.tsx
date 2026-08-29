import { AnimeHero } from "@/components/anilist/anime-hero";
import { ContentRow } from "@/components/content/content-row";
import { ContentReveal } from "@/components/layout/page-loading/content-reveal";
import { TrendCarousel } from "@/components/trend/trend-client";
import type { MediaItem } from "@/lib/domain/typings";
import {
  ANIME_HUB_GENRES,
  enrichAnimeHubAdultRow,
  enrichAnimeHubStandardRow,
  enrichAnimeHubTrendingRow,
  fetchAnimeHubAiringRaw,
  fetchAnimeHubGenreBatch0Raw,
  fetchAnimeHubGenreBatch4Raw,
  fetchAnimeHubGenreBatch8Raw,
  fetchAnimeHubHentaiRaw,
  fetchAnimeHubMoviesRaw,
  fetchAnimeHubPopularRaw,
  fetchAnimeHubSeasonPopularRaw,
  fetchAnimeHubTopRatedRaw,
  fetchAnimeHubTrendingRaw,
  getAnimeHubLinks,
  getAnimeHubSeasonLabel,
} from "@/lib/server/anime-hub-data";
import {
  ANIME_HUB_MIN_VISIBLE_ROW,
  ANIME_HUB_ROW_CAROUSEL,
  ANIME_HUB_ROW_GENRE,
  ANIME_HUB_ROW_RANKED,
  pickHubCarouselItems,
} from "@/lib/server/anime-hub-layout";
import type { TvShowWithMediaType } from "@/tmdb/models";

const asTvItems = (items: MediaItem[]) =>
  items as unknown as TvShowWithMediaType[];

type HubTrendCarouselProps = {
  title: string;
  href: string;
  items: MediaItem[];
  count?: number;
};

const HubTrendCarousel = ({
  title,
  href,
  items,
  count = ANIME_HUB_ROW_CAROUSEL,
}: HubTrendCarouselProps) => {
  const picked = pickHubCarouselItems(items, count);
  if (picked.length < ANIME_HUB_MIN_VISIBLE_ROW) {
    return null;
  }

  return (
    <ContentReveal>
      <TrendCarousel
        type="tv"
        title={title}
        link={href}
        items={asTvItems(picked)}
      />
    </ContentReveal>
  );
};

const AnimeHubGenreSlice = async (startIndex: number) => {
  const fetchers = {
    0: fetchAnimeHubGenreBatch0Raw,
    4: fetchAnimeHubGenreBatch4Raw,
    8: fetchAnimeHubGenreBatch8Raw,
  } as const;

  const genreRaws = await fetchers[startIndex]();
  const links = getAnimeHubLinks();
  const enriched = await Promise.all(
    genreRaws.map((raw) => enrichAnimeHubStandardRow(raw)),
  );

  return (
    <>
      {ANIME_HUB_GENRES.slice(startIndex, startIndex + genreRaws.length).map(
        (genre, index) => (
          <HubTrendCarousel
            key={genre}
            title={genre}
            href={links.genre(genre)}
            items={enriched[index] ?? []}
            count={ANIME_HUB_ROW_GENRE}
          />
        ),
      )}
    </>
  );
};

export async function AnimeHubHero() {
  const raw = await fetchAnimeHubTrendingRaw();
  const items = await enrichAnimeHubTrendingRow(raw);
  if (items.length === 0) {
    return null;
  }

  return (
    <ContentReveal>
      <AnimeHero
        items={items.slice(0, 1)}
        label="Trending"
        priority
        count={1}
      />
    </ContentReveal>
  );
}

export async function AnimeHubRankedRow() {
  const raw = await fetchAnimeHubTopRatedRaw();
  const items = await enrichAnimeHubStandardRow(raw);
  const links = getAnimeHubLinks();
  const picked = pickHubCarouselItems(items, ANIME_HUB_ROW_RANKED);

  if (picked.length < ANIME_HUB_MIN_VISIBLE_ROW) {
    return null;
  }

  return (
    <ContentReveal>
      <ContentRow
        variant="ranked"
        title="Highest Rated"
        href={links.topRated}
        items={picked}
      />
    </ContentReveal>
  );
}

export async function AnimeHubTrendingCarousel() {
  const raw = await fetchAnimeHubTrendingRaw();
  const items = await enrichAnimeHubStandardRow(raw);
  const links = getAnimeHubLinks();

  return (
    <HubTrendCarousel title="Trending" href={links.trending} items={items} />
  );
}

export async function AnimeHubPopularCarousel() {
  const raw = await fetchAnimeHubPopularRaw();
  const items = await enrichAnimeHubStandardRow(raw);
  const links = getAnimeHubLinks();

  return (
    <HubTrendCarousel title="Popular" href={links.popular} items={items} />
  );
}

export async function AnimeHubSeasonCarousel() {
  const raw = await fetchAnimeHubSeasonPopularRaw();
  const items = await enrichAnimeHubStandardRow(raw);
  const links = getAnimeHubLinks();

  return (
    <HubTrendCarousel
      title={getAnimeHubSeasonLabel()}
      href={links.seasonPopular}
      items={items}
    />
  );
}

export async function AnimeHubAiringCarousel() {
  const raw = await fetchAnimeHubAiringRaw();
  const items = await enrichAnimeHubStandardRow(raw);
  const links = getAnimeHubLinks();

  return (
    <HubTrendCarousel title="Releasing" href={links.airing} items={items} />
  );
}

export async function AnimeHubMoviesCarousel() {
  const raw = await fetchAnimeHubMoviesRaw();
  const items = await enrichAnimeHubStandardRow(raw);
  const links = getAnimeHubLinks();

  return <HubTrendCarousel title="Movies" href={links.movies} items={items} />;
}

export async function AnimeHubGenreRowsPart1() {
  return AnimeHubGenreSlice(0);
}

export async function AnimeHubGenreRowsPart2() {
  return AnimeHubGenreSlice(4);
}

export async function AnimeHubGenreRowsPart3() {
  return AnimeHubGenreSlice(8);
}

export async function AnimeHubHentaiCarousel() {
  const raw = await fetchAnimeHubHentaiRaw();
  const items = await enrichAnimeHubAdultRow(raw);
  const links = getAnimeHubLinks();

  return (
    <HubTrendCarousel
      title="Hentai"
      href={links.hentai}
      items={items}
      count={ANIME_HUB_ROW_GENRE}
    />
  );
}
