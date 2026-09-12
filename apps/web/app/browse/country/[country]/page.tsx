import { StaticHero } from "@/components/hero/hero-static";
import { ContentContainer } from "@/components/layout/content-container";
import { PageContainer } from "@/components/layout/page-container";
import { catalogCardsToMediaItems } from "@/lib/cards/catalog-dto";
import { fetchCountryBrowsePage } from "@/lib/server/browse-catalog";
import { tmdbImage } from "@/tmdb/utils";
import { getFriendlyCountryName } from "@/utils/country-helpers";
import { countries } from "country-data-list";
import BrowseCountryClient from "./browse-client";

interface PageProps {
  params: Promise<{ country: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function BrowseCountryPage(props: PageProps) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const countryCode = params.country.toUpperCase();
  const typeParam = Array.isArray(searchParams?.type)
    ? searchParams.type[0]
    : searchParams?.type;
  const mediaType = typeParam === "tv" ? "tv" : "movie";

  const countryData = countries.all.find((c) => c.alpha2 === countryCode);
  const countryName = getFriendlyCountryName(countryCode, countryData?.name);
  const countryEmoji = countryData?.emoji || "🌎";

  const data = await fetchCountryBrowsePage(
    countryCode,
    mediaType,
    1,
    "vote_average.desc",
  );
  const initialItems = catalogCardsToMediaItems(data.results);

  const backdropImage =
    initialItems.length > 0 && initialItems[0].backdrop_path
      ? tmdbImage.backdrop(initialItems[0].backdrop_path, "w1280")
      : "/movie-banner.webp";

  return (
    <PageContainer className="pb-16">
      <StaticHero
        imageUrl={backdropImage}
        title={countryName}
        route=""
        hideTitle
      />
      <ContentContainer className="relative z-10" topSpacing={false}>
        <div className="mx-auto w-full max-w-7xl space-y-8 px-2 pb-12 sm:px-4">
          <div className="flex flex-col gap-4 pb-2 pt-20 md:pt-28">
            <div className="text-center">
              <h1 className="mb-4 flex flex-wrap items-center justify-center gap-2 text-3xl font-bold tracking-tight text-foreground sm:mb-6 sm:gap-4 sm:text-5xl md:text-6xl">
                <span className="text-4xl sm:text-6xl" aria-hidden>
                  {countryEmoji}
                </span>
                <span>{countryName}</span>
              </h1>
              <p className="mx-auto max-w-2xl text-muted-foreground">
                Discover standout{" "}
                {mediaType === "movie" ? "movies" : "TV shows"} from{" "}
                {countryName}.
              </p>
            </div>
          </div>

          <BrowseCountryClient
            countryCode={countryCode}
            countryName={countryName}
            initialItems={initialItems}
            totalPages={data.total_pages || 1}
            mediaType={mediaType}
          />
        </div>
      </ContentContainer>
    </PageContainer>
  );
}
