"use client";

import { MediaDetailFactsPanel } from "@/components/media/media-detail-facts-panel";
import { MediaBackdrop } from "@/components/media/media-shared";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { PrimaryGenreBadge } from "@/components/ui/genre-badge";
import { pages } from "@/config";
import {
  buildNetworkCatalogUrl,
  buildProductionCompanyCatalogUrl,
} from "@/lib/catalog-query";
import { useMediaDetailTabStore } from "@/lib/stores/media-detail-tab-store";
import { cn, formatValue, joiner, pad } from "@/lib/utils";
import { format } from "@/tmdb/utils";
import { Creator, Genre, TvShowDetails } from "@/utils/typings";
import { Calendar, ListVideo, Star, Tv } from "lucide-react";
import Link from "next/link";

const factLinkClass =
  "text-sky-300/95 underline decoration-sky-400/35 underline-offset-2 transition hover:text-sky-200 hover:decoration-sky-300/60";

type TvShowOverviewTabProps = {
  details: TvShowDetails;
  id: string;
};

export const TvShowOverviewTab = ({ details, id }: TvShowOverviewTabProps) => {
  const setMediaDetailTab = useMediaDetailTabStore((s) => s.setMediaDetailTab);
  const contentRating =
    details.content_ratings?.results?.find(
      (rating) => rating.iso_3166_1 === "US",
    )?.rating || "";

  const firstAirDate = details.first_air_date
    ? formatValue(details.first_air_date, format.date)
    : "Unknown";

  const {
    last_air_date,
    status,
    original_name,
    created_by,
    number_of_seasons,
    number_of_episodes,
    spoken_languages,
    production_companies,
    networks,
    episode_run_time,
    production_countries,
    original_language,
    last_episode_to_air: lastEpisode,
    overview,
    genres,
    vote_average,
    vote_count,
  } = details;

  const episodeRuntime =
    episode_run_time && episode_run_time.length > 0
      ? episode_run_time.map((m) => format.runtime(m)).join(", ")
      : "—";

  const detailRows = [
    {
      label: "Created By",
      value:
        created_by && created_by.length > 0 ? (
          <span className="flex flex-wrap gap-x-1">
            {(created_by as Creator[]).map((c, i) => (
              <span key={c.id}>
                {i > 0 ? ", " : null}
                <Link
                  href={`${pages.person.detail.link}/${c.id}`}
                  className={factLinkClass}
                >
                  {c.name}
                </Link>
              </span>
            ))}
          </span>
        ) : (
          "—"
        ),
    },
    { label: "Status", value: formatValue(status) },
    { label: "Original Name", value: formatValue(original_name) },
    {
      label: "Last Air Date",
      value: formatValue(last_air_date, format.date),
    },
    { label: "Episode Runtime", value: episodeRuntime },
    {
      label: "Language",
      value: joiner(spoken_languages ?? [], "english_name"),
    },
    {
      label: "Original Language",
      value: formatValue(original_language, format.country),
    },
    {
      label: "Production Countries",
      value: joiner(production_countries ?? [], "name"),
    },
    {
      label: "Production Companies",
      value: production_companies?.length ? (
        <span className="flex flex-wrap gap-x-1">
          {production_companies.map(
            (c: { id: number; name: string }, i: number) => (
              <span key={c.id}>
                {i > 0 ? ", " : null}
                <Link
                  href={buildProductionCompanyCatalogUrl("tv", c)}
                  className={factLinkClass}
                >
                  {c.name}
                </Link>
              </span>
            ),
          )}
        </span>
      ) : (
        "—"
      ),
    },
    {
      label: "Networks",
      value: networks?.length ? (
        <span className="flex flex-wrap gap-x-1">
          {networks.map((n: { id: number; name: string }, i: number) => (
            <span key={n.id}>
              {i > 0 ? ", " : null}
              <Link href={buildNetworkCatalogUrl(n)} className={factLinkClass}>
                {n.name}
              </Link>
            </span>
          ))}
        </span>
      ) : (
        "—"
      ),
    },
  ];

  return (
    <section className="space-y-8">
      {overview ? (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">Overview</h2>
          <p className="leading-relaxed text-muted-foreground">{overview}</p>
          {genres && (genres as Genre[]).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {(genres as Genre[]).map((genre) => (
                <PrimaryGenreBadge
                  key={genre.id}
                  genreId={genre.id}
                  genreName={genre.name}
                  mediaType="tv"
                />
              ))}
            </div>
          )}
        </div>
      ) : null}

      <MediaDetailFactsPanel title="Series details" rows={detailRows}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-start gap-3 rounded-lg bg-white/4 p-3 ring-1 ring-white/10">
            <Tv
              className="mt-0.5 size-5 shrink-0 text-sky-400/90"
              aria-hidden
            />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Seasons
              </p>
              <p className="text-sm font-medium text-white">
                {formatValue(number_of_seasons)}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg bg-white/4 p-3 ring-1 ring-white/10">
            <ListVideo
              className="mt-0.5 size-5 shrink-0 text-sky-400/90"
              aria-hidden
            />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Episodes
              </p>
              <p className="text-sm font-medium text-white">
                {formatValue(number_of_episodes)}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg bg-white/4 p-3 ring-1 ring-white/10">
            <Calendar
              className="mt-0.5 size-5 shrink-0 text-sky-400/90"
              aria-hidden
            />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                First aired
              </p>
              <p className="text-sm font-medium text-white">{firstAirDate}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg bg-white/4 p-3 ring-1 ring-white/10">
            <Star
              className="mt-0.5 size-5 shrink-0 text-amber-400/90"
              aria-hidden
            />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Rating
              </p>
              <p className="text-sm font-medium text-white">
                {vote_average && vote_average > 0
                  ? `${vote_average.toFixed(1)}/10`
                  : "—"}
                {vote_count && vote_count > 0 ? (
                  <span className="text-gray-400">
                    {" "}
                    ({vote_count.toLocaleString()} votes)
                  </span>
                ) : null}
              </p>
            </div>
          </div>
        </div>
        {contentRating ? (
          <div className="mt-4 rounded-lg border border-white/10 bg-white/3 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Content rating (US)
              </span>
              <span className="rounded-md bg-white/10 px-2.5 py-1 text-sm font-semibold text-white">
                {contentRating}
              </span>
            </div>
          </div>
        ) : null}
      </MediaDetailFactsPanel>

      {lastEpisode ? (
        <div className="relative h-hero w-full overflow-hidden rounded-xl border border-white/15 shadow-2xl">
          <MediaBackdrop
            image={lastEpisode.still_path ?? details.backdrop_path ?? undefined}
            alt={lastEpisode.name}
            size="w780"
          />
          <div className="overlay">
            <div className="p-4 md:p-10">
              <Badge className="mb-4 gap-1">
                <span>S{pad(lastEpisode.season_number)}</span>
                <span>E{pad(lastEpisode.episode_number)}</span>
              </Badge>

              <h2 className="line-clamp-1 text-lg font-medium text-foreground md:text-2xl">
                {lastEpisode.name}
              </h2>
              <p className="line-clamp-3 max-w-xl text-muted-foreground md:line-clamp-6">
                {lastEpisode.overview}
              </p>
              <button
                type="button"
                className={cn(buttonVariants({ variant: "default" }), "mt-4")}
                onClick={() => setMediaDetailTab("tv", id, "seasons-episodes")}
              >
                View seasons
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};
