import { getCategories } from "@/lib/server/actions";
import { StaticHero } from "@/components/hero/hero-static";
import { ContentContainer } from "@/components/layout/content-container";
import { PageContainer } from "@/components/layout/page-container";
import { catalogCardsToMediaItems } from "@/lib/cards/catalog-dto";
import { fetchGenreBrowsePage } from "@/lib/server/browse-catalog";
import { tmdbImage } from "@/tmdb/utils";
import BrowseGenreClient from "./browse-client";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function BrowseGenrePage(props: PageProps) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const genreId = params.id;
  const typeParam = Array.isArray(searchParams?.type)
    ? searchParams.type[0]
    : searchParams?.type;
  const mediaType = typeParam === "tv" ? "tv" : "movie";

  const [categories, data] = await Promise.all([
    getCategories(mediaType),
    fetchGenreBrowsePage(genreId, mediaType, 1),
  ]);

  const matchedGenre = categories.find((g) => g.id.toString() === genreId);
  const genreName = matchedGenre ? matchedGenre.name : "Unknown Genre";
  const initialItems = catalogCardsToMediaItems(data.results);

  const backdropImage =
    initialItems.length > 0 && initialItems[0].backdrop_path
      ? tmdbImage.backdrop(initialItems[0].backdrop_path, "w1280")
      : "/movie-banner.webp";

  return (
    <PageContainer className="pb-16">
      <StaticHero
        imageUrl={backdropImage}
        title={genreName}
        route=""
        hideTitle
      />
      <ContentContainer className="relative z-10" topSpacing={false}>
        <div className="mx-auto w-full max-w-7xl space-y-8 px-2 pb-12 sm:px-4">
          <div className="flex flex-col gap-4 pb-2 pt-20 md:pt-28">
            <div className="text-center">
              <h1 className="mb-4 text-3xl font-bold tracking-tight text-foreground sm:mb-6 sm:text-5xl md:text-6xl">
                {genreName}
              </h1>
              <p className="mx-auto max-w-2xl text-muted-foreground">
                Discover titles in the {genreName} genre.
              </p>
            </div>
          </div>

          <BrowseGenreClient
            genreId={genreId}
            genreName={genreName}
            initialItems={initialItems}
            totalPages={data.total_pages || 1}
            mediaType={mediaType}
          />
        </div>
      </ContentContainer>
    </PageContainer>
  );
}
