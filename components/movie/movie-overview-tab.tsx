"use client";

import { MovieCollectionClient } from "@/components/movie/movie-collection-client";
import { MediaDetailFactsPanel } from "@/components/media/media-detail-facts-panel";
import { CountryBadge } from "@/components/ui/country-badge";
import { PrimaryGenreBadge } from "@/components/ui/genre-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { buildProductionCompanyCatalogUrl } from "@/lib/catalog-query";
import { cn, formatValue, joiner } from "@/lib/utils";
import { format } from "@/tmdb/utils";
import type { MovieDetails } from "@/tmdb/models";
import { Genre, ProductionCountry } from "@/utils/typings";
import { isUpcomingMovie } from "@/utils/movie-helpers";
import { Calendar, Clock, Star } from "lucide-react";
import Link from "next/link";

const factLinkClass =
  "text-sky-300/95 underline decoration-sky-400/35 underline-offset-2 transition hover:text-sky-200 hover:decoration-sky-300/60";

type MovieOverviewTabProps = {
  details: MovieDetails;
};

export const MovieOverviewTab = ({ details }: MovieOverviewTabProps) => {
  const isUpcoming = isUpcomingMovie(details);
  const hasRuntime = Boolean(details.runtime && details.runtime > 0);
  const hours = Math.floor((details.runtime || 0) / 60);
  const minutes = (details.runtime || 0) % 60;
  const formattedRuntime = hasRuntime ? `${hours}h ${minutes}m` : "Runtime TBA";

  const releaseDate = details.release_date
    ? new Date(details.release_date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Release Date TBA";

  const {
    status,
    budget,
    revenue,
    spoken_languages,
    production_companies,
    belongs_to_collection,
    original_title,
    original_language,
    production_countries,
    overview,
    genres,
    vote_average,
    vote_count,
  } = details;

  const moreRows = [
    { label: "Original Title", value: formatValue(original_title) },
    {
      label: "Spoken Languages",
      value: joiner(spoken_languages ?? [], "english_name"),
    },
    {
      label: "Original Language",
      value: formatValue(original_language, format.country),
    },
    {
      label: "Production Companies",
      value: production_companies?.length ? (
        <span className="flex flex-wrap gap-x-1 gap-y-1">
          {production_companies.map(
            (c: { id: number; name: string }, i: number) => (
              <span key={c.id}>
                {i > 0 ? ", " : null}
                <Link
                  href={buildProductionCompanyCatalogUrl("movie", c)}
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
  ];

  return (
    <section className="space-y-8">
      {overview ? (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">Overview</h2>
          <p className="leading-relaxed text-muted-foreground">{overview}</p>
          {genres && genres.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {(genres as Genre[]).map((genre) => (
                <PrimaryGenreBadge
                  key={genre.id}
                  genreId={genre.id}
                  genreName={genre.name}
                  mediaType="movie"
                />
              ))}
            </div>
          )}
        </div>
      ) : null}

      <div
        className={cn(
          "overflow-hidden rounded-xl border border-white/15 bg-black/45 shadow-2xl backdrop-blur-xl supports-[backdrop-filter]:bg-black/35",
        )}
      >
        <div className="border-b border-white/10 bg-white/[0.03] px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-white/70">
            At a glance
          </h2>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          {(hasRuntime || !isUpcoming) && (
            <div className="flex items-start gap-3 rounded-lg bg-white/[0.04] p-3 ring-1 ring-white/10">
              <Clock
                className="mt-0.5 size-5 shrink-0 text-sky-400/90"
                aria-hidden
              />
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  Runtime
                </p>
                <p
                  className={cn(
                    "text-sm font-medium text-white",
                    !hasRuntime && isUpcoming && "text-gray-400",
                  )}
                >
                  {formattedRuntime}
                </p>
              </div>
            </div>
          )}
          <div className="flex items-start gap-3 rounded-lg bg-white/[0.04] p-3 ring-1 ring-white/10">
            <Calendar
              className="mt-0.5 size-5 shrink-0 text-sky-400/90"
              aria-hidden
            />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Release
              </p>
              <p
                className={cn(
                  "text-sm font-medium text-white",
                  !details.release_date && isUpcoming && "text-gray-400",
                )}
              >
                {releaseDate}
              </p>
            </div>
          </div>
          {((vote_count && vote_count > 0) || !isUpcoming) && (
            <div className="flex items-start gap-3 rounded-lg bg-white/[0.04] p-3 ring-1 ring-white/10">
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
                    : "Not yet rated"}
                  {vote_count && vote_count > 0 ? (
                    <span className="text-gray-400">
                      {" "}
                      ({vote_count.toLocaleString()} votes)
                    </span>
                  ) : null}
                </p>
              </div>
            </div>
          )}
        </div>

        {isUpcoming && status ? (
          <div className="border-t border-white/10 px-5 pb-5 pt-0">
            <div className="flex justify-center pt-2">
              <StatusBadge status={status} />
            </div>
          </div>
        ) : null}

        {(budget > 0 || revenue > 0) && !isUpcoming ? (
          <div className="border-t border-white/10 px-5 py-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Box office
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {budget > 0 ? (
                <div className="rounded-lg bg-white/[0.04] px-4 py-3 ring-1 ring-white/10">
                  <p className="text-xs text-gray-400">Budget</p>
                  <p className="text-sm font-medium text-white">
                    ${budget.toLocaleString()}
                  </p>
                </div>
              ) : null}
              {revenue > 0 ? (
                <div className="rounded-lg bg-white/[0.04] px-4 py-3 ring-1 ring-white/10">
                  <p className="text-xs text-gray-400">Revenue</p>
                  <p className="text-sm font-medium text-white">
                    ${revenue.toLocaleString()}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {isUpcoming ? (
          <div className="border-t border-white/10 px-5 py-4">
            <p className="text-center text-sm text-gray-400">
              More details will be available closer to release
            </p>
          </div>
        ) : null}

        {production_countries && production_countries.length > 0 ? (
          <div className="border-t border-white/10 px-5 py-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Production countries
            </p>
            <div className="flex flex-wrap gap-2">
              {production_countries.map((country: ProductionCountry) => (
                <CountryBadge
                  key={country.iso_3166_1}
                  country={country}
                  variant="outline"
                  mediaType="movie"
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <MediaDetailFactsPanel title="Languages & production" rows={moreRows} />

      {belongs_to_collection ? (
        <MovieCollectionClient collectionId={belongs_to_collection.id} />
      ) : null}
    </section>
  );
};
