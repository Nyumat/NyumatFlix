import { getMovies } from "@/app/actions";
import { BrowseWrap, InfiniteScrollMovies } from "./wrap";

type MovieCategory = "popular" | "top-rated" | "now-playing" | "upcoming";

export default async function Page({
  searchParams,
}: {
  searchParams: {
    type: MovieCategory;
  };
}) {
  const { type } = searchParams;
  const initialMovies = await getMovies("popular", 1);

  const title =
    type === "popular"
      ? "Popular Movies"
      : type === "top-rated"
        ? "Top Rated Movies"
        : type === "now-playing"
          ? "Now Playing Movies"
          : "Upcoming Movies";

  return (
    <div>
      <main>
        <BrowseWrap>
          <div className="container mx-auto">
            <InfiniteScrollMovies
              initialMovies={initialMovies.results!}
              type={type}
              title={title}
            />
          </div>
        </BrowseWrap>
      </main>
    </div>
  );
}
