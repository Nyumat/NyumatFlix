import { fetchTMDBData, getCategories } from "@/app/actions";
import { StaticHero } from "@/components/hero";
import { ContentContainer } from "@/components/layout/content-container";
import { PageContainer } from "@/components/layout/page-container";
import type { MediaItem } from "@/utils/typings";
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

  // Initial content fetch (page 1)
  const data = await fetchTMDBData<MediaItem>(
    `/discover/${mediaType}`,
    {
      with_genres: genreId,
      sort_by: "popularity.desc",
      language: "en-US",
      include_adult: "false",
    },
    1,
  );

  const initialItems = (data.results || []).filter((item) => item.poster_path);

  const backdropImage =
    initialItems.length > 0 && initialItems[0].backdrop_path
      ? `https://image.tmdb.org/t/p/original${initialItems[0].backdrop_path}`
      : "/movie-banner.jpg";

  return (
    <PageContainer>
      <StaticHero imageUrl={backdropImage} title={genreName} route="" />
      <ContentContainer className="relative z-10" topSpacing={false}>
        <div className="pt-32 md:pt-48 pb-8 w-full flex flex-col items-center">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-10 text-center">
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
