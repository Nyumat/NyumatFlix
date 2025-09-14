import { StaticHero } from "@/components/hero";
import { ContentContainer } from "@/components/layout/content-container";
import { PageContainer } from "@/components/layout/page-container";
import { BackButton } from "@/components/ui/back-button";
import { getFriendlyCountryName } from "@/utils/country-helpers";
import { countries } from "country-data-list";
import BrowseCountryClient from "./browse-client";

interface PageProps {
  params: { country: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export default async function BrowseCountryPage({
  params,
  searchParams,
}: PageProps) {
  const countryCode = params.country.toUpperCase();
  const typeParam = Array.isArray(searchParams?.type)
    ? searchParams.type[0]
    : searchParams?.type;
  const mediaType = typeParam === "tv" ? "tv" : "movie";

  // Find country name from country code with friendly name override
  const countryData = countries.all.find((c) => c.alpha2 === countryCode);
  const countryName = getFriendlyCountryName(countryCode, countryData?.name);
  const countryEmoji = countryData?.emoji || "🌎";

  // Fetch initial content from the new API endpoint with enriched data
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/country/${countryCode}?type=${mediaType}&page=1&sortBy=vote_average.desc`,
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch country content: ${response.status}`);
  }

  const data = await response.json();
  const initialItems = data.results || [];

  // Get backdrop image from the first high-rated item
  const backdropImage =
    initialItems.length > 0 && initialItems[0].backdrop_path
      ? `https://image.tmdb.org/t/p/original${initialItems[0].backdrop_path}`
      : "/movie-banner.webp";

  const pageTitle = `${countryEmoji} ${countryName} ${mediaType === "movie" ? "Movies" : "TV Shows"}`;

  return (
    <PageContainer>
      {/* Back Button */}
      <BackButton />

      <StaticHero
        imageUrl={backdropImage}
        title={pageTitle}
        route=""
        hideTitle
      />
      <ContentContainer className="relative z-10" topSpacing={false}>
        <div className="pt-12 md:pt-24 pb-8 w-full flex flex-col items-center">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold text-foreground mb-4 text-center flex items-center gap-2 sm:gap-4">
            <span className="text-4xl sm:text-6xl">{countryEmoji}</span>
            {countryName}
          </h1>
          <p className="text-lg text-muted-foreground mb-10 text-center">
            Discover the best {mediaType === "movie" ? "movies" : "TV shows"}{" "}
            from {countryName}
          </p>
          <div className="w-full max-w-7xl px-2 sm:px-4">
            <BrowseCountryClient
              countryCode={countryCode}
              countryName={countryName}
              initialItems={initialItems}
              totalPages={data.total_pages || 1}
              mediaType={mediaType as "movie" | "tv"}
            />
          </div>
        </div>
      </ContentContainer>
    </PageContainer>
  );
}
