import { SearchComponent } from "@/components/search";
import SearchResults from "@/components/search-results";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { query: string };
}) {
  const query = searchParams.query;
  const apiKey = process.env.TMDB_API_KEY;

  if (!apiKey) {
    throw new Error("TMDB API key is missing");
  }

  return (
    <>
      <div className="absolute transform -translate-x-1/2 top-1/3 left-1/2">
        <SearchComponent />
      </div>
      {!query && (
        <div className="text-center text-muted-foreground mt-4">
          Enter a Search Query To Get Started
        </div>
      )}
      {query && <SearchResults query={query} apiKey={apiKey} />}
    </>
  );
}
