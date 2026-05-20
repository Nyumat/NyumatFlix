"use client";

import { MovieCollectionClient } from "@/components/movie/movie-collection-client";
import { StatusBadge } from "@/components/ui/status-badge";
import { buildProductionCompanyCatalogUrl } from "@/lib/catalog-query";
import { formatValue } from "@/lib/utils";
import { format } from "@/tmdb/utils";
import type { MovieDetails } from "@/tmdb/models";
import { isUpcomingMovie } from "@/utils/movie-helpers";
import { Calendar, Clock, Star } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

const factLinkClass =
  "text-sky-300/95 underline decoration-sky-400/35 underline-offset-2 transition hover:text-sky-200 hover:decoration-sky-300/60";

type MovieOverviewTabProps = {
  details: MovieDetails;
  showOverviewHeading?: boolean;
};

type FactItemProps = {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
};

const FactItem = ({ label, value, icon }: FactItemProps) => (
  <div className="flex items-start gap-3 border-t border-border/70 py-4">
    {icon ? (
      <span className="mt-0.5 shrink-0 text-primary/90">{icon}</span>
    ) : null}
    <div className="min-w-0 space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="text-sm leading-relaxed text-foreground">{value}</div>
    </div>
  </div>
);

export const MovieOverviewTab = ({
  details,
  showOverviewHeading = true,
}: MovieOverviewTabProps) => {
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
    production_companies,
    belongs_to_collection,
    original_language,
    overview,
    vote_average,
    vote_count,
  } = details;

  const ratingValue =
    vote_average && vote_average > 0 ? (
      <>
        {vote_average.toFixed(1)}/10
        {vote_count && vote_count > 0 ? (
          <span className="text-muted-foreground">
            {" "}
            ({vote_count.toLocaleString()} votes)
          </span>
        ) : null}
      </>
    ) : (
      "Not yet rated"
    );

  const productionCompanies = production_companies?.length ? (
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
  );

  const facts: FactItemProps[] = [
    ...(hasRuntime || !isUpcoming
      ? [
          {
            label: "Runtime",
            value: formattedRuntime,
            icon: <Clock className="size-5" aria-hidden />,
          },
        ]
      : []),
    {
      label: "Release",
      value: releaseDate,
      icon: <Calendar className="size-5" aria-hidden />,
    },
    ...((vote_count && vote_count > 0) || !isUpcoming
      ? [
          {
            label: "Rating",
            value: ratingValue,
            icon: <Star className="size-5 text-amber-400" aria-hidden />,
          },
        ]
      : []),
    ...(isUpcoming && status
      ? [{ label: "Status", value: <StatusBadge status={status} /> }]
      : []),
    ...(!isUpcoming && budget > 0
      ? [{ label: "Budget", value: `$${budget.toLocaleString()}` }]
      : []),
    ...(!isUpcoming && revenue > 0
      ? [{ label: "Revenue", value: `$${revenue.toLocaleString()}` }]
      : []),
    {
      label: "Original language",
      value: formatValue(original_language, format.country),
    },
    { label: "Production companies", value: productionCompanies },
  ];

  return (
    <section className="space-y-6">
      <div className="space-y-4">
        {showOverviewHeading ? (
          <h2 className="text-xl font-semibold text-foreground">Overview</h2>
        ) : null}
        {overview ? (
          <p className="max-w-5xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {overview}
          </p>
        ) : null}
      </div>

      <div className="grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
        {facts.map((fact) => (
          <FactItem
            key={fact.label}
            label={fact.label}
            value={fact.value}
            icon={fact.icon}
          />
        ))}
      </div>

      {isUpcoming ? (
        <p className="text-sm text-muted-foreground">
          More details will be available closer to release.
        </p>
      ) : null}

      {belongs_to_collection ? (
        <MovieCollectionClient collectionId={belongs_to_collection.id} />
      ) : null}
    </section>
  );
};
