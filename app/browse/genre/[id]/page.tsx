import { getCategories } from "@/app/actions";
import { StaticHero } from "@/components/hero";
import { ContentContainer } from "@/components/layout/content-container";
import { PageContainer } from "@/components/layout/page-container";
import BrowseGenreClient from "./browse-client";

interface PageProps {
  params: { id: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export default async function BrowseGenrePage({
  params,
  searchParams,
}: PageProps) {
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
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch genre content: ${response.status}`);
  }

  const data = await response.json();
  const initialItems = data.results || [];

  const backdropImage =
    initialItems.length > 0 && initialItems[0].backdrop_path
      ? `https://image.tmdb.org/t/p/original${initialItems[0].backdrop_path}`
      : "/movie-banner.jpg";

  return (
    <PageContainer>
      <StaticHero
        imageUrl={backdropImage}
        title={genreName}
        route=""
        hideTitle
      />
      <ContentContainer className="relative z-10" topSpacing={false}>
        <div className="pt-32 md:pt-48 pb-8 w-full flex flex-col items-center">
          <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-10 text-center">
            {genreName}
          </h1>
          <div className="w-full max-w-7xl">
            <BrowseGenreClient
              genreId={genreId}
              genreName={genreName}
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
