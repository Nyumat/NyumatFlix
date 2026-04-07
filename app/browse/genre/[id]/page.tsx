import { getCategories } from "@/app/actions";
import { StaticHero } from "@/components/hero";
import { ContentContainer } from "@/components/layout/content-container";
import { PageContainer } from "@/components/layout/page-container";
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

  // Fetch genre list to find the name
  const categories = await getCategories(mediaType);
  const matchedGenre = categories.find((g) => g.id.toString() === genreId);
  const genreName = matchedGenre ? matchedGenre.name : "Unknown Genre";

  // Fetch initial content from the new API endpoint with enriched data
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/genre/${genreId}?type=${mediaType}&page=1`,
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch genre content: ${response.status}`);
  }

  const data = await response.json();
  const initialItems = data.results || [];

  const backdropImage =
    initialItems.length > 0 && initialItems[0].backdrop_path
      ? `https://image.tmdb.org/t/p/original${initialItems[0].backdrop_path}`
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
            mediaType={mediaType as "movie" | "tv"}
          />
        </div>
      </ContentContainer>
    </PageContainer>
  );
}
