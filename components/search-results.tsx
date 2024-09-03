"use client";

import { cn } from "@/lib/utils";
import { Genre, Movie, TmdbResponse, TvShow } from "@/utils/typings";
import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  Suspense,
} from "react";
import { Card, CardContent } from "./ui/card";
import { format } from "date-fns";
import { Badge } from "./ui/badge";
import { Rating } from "./ui/rating";
import { Button } from "./ui/button";
import { MultiSelect } from "./multi-select";
import Image from "next/image";

async function searchTMDBData(
  endpoint: string,
  params: any,
  page: number,
  apiKey: string,
): Promise<TmdbResponse<Movie | TvShow>> {
  if (!apiKey) {
    throw new Error("TMDB API key is missing");
  }

  const url = new URL(`https://api.themoviedb.org/3${endpoint}`);
  url.searchParams.append("api_key", apiKey);
  url.searchParams.append("page", page.toString());

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.append(key, value as string);
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(
      `TMDB API error: ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
}

export function ContentGrid({
  title,
  items,
  href,
  currentPage,
  totalPages,
  onPageChange,
  genres,
}: {
  title: string;
  items: any[];
  href: string;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  genres: { [key: number]: string };
}) {
  const parsedGenres = Object.entries(genres).map(([key, value]) => ({
    label: value,
    value: key,
  }));

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className={cn("text-3xl font-semibold", "text-primary-foreground")}>
          {title}
        </h2>
        {/* Filter combobox */}
        <div className="md:w-64 w-min md:max-w-72 max-w-40">
          <MultiSelect
            options={parsedGenres}
            maxCount={3}
            onValueChange={(values) => {
              // TODO: filter data based on selected genres
            }}
            placeholder="Filter"
            defaultValue={[]}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {items.map((item) => (
          <Card
            key={item.id}
            className={cn("flex flex-col border-none bg-transparent")}
          >
            <div className="relative aspect-[2/3]">
              <Image
                width={300}
                height={450}
                src={`https://image.tmdb.org/t/p/w300${item.poster_path}`}
                alt={item.title || item.name}
                className="w-full h-full object-cover transition-transform hover:scale-105 rounded-sm"
              />
            </div>
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm mb-1 line-clamp-1">
                {item.title || item.name}
              </h3>
              <p className="text-xs text-muted-foreground mb-2">
                {item.release_date &&
                  format(new Date(item.release_date), "MMM d, yyyy")}
              </p>
              <div className="flex flex-wrap gap-1 mb-2">
                {item.genre_ids.map((genreId: number) => (
                  <Badge
                    key={genreId}
                    variant="secondary"
                    className="text-xs px-1 py-0"
                  >
                    {genres[genreId]}
                  </Badge>
                ))}
              </div>
              <Rating rating={item.vote_average / 2} />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex justify-between items-center mt-8">
        <Button
          variant="outline"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          Previous
        </Button>
        <span className="text-muted-foreground">
          Page {currentPage} of {totalPages}
        </span>
        <Button
          variant="outline"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export default function SearchResults({
  query,
  apiKey,
}: {
  query: string;
  apiKey: string;
}) {
  const itemsPerPage = 20;
  const [items, setItems] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const fetchData = async () => {
      const searchResults = await searchTMDBData(
        "/search/multi",
        { query },
        currentPage,
        apiKey,
      );

      if (!searchResults.results) {
        return;
      }

      if (!searchResults.total_results) {
        return;
      }

      const filteredItems = searchResults.results
        .filter(
          (item) =>
            item.poster_path &&
            item.release_date &&
            new Date(item.release_date) <= new Date() &&
            item.vote_average > 0 &&
            item.vote_count > 0,
        )
        .map((item) => ({
          ...item,
        }));

      setItems(filteredItems);
      setTotalPages(Math.ceil(searchResults.total_results / itemsPerPage));
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, currentPage]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const [genres, setGenres] = useState<{ [key: number]: string }>({});

  async function getCategories(mediaType: "movie" | "tv"): Promise<Genre[]> {
    const endpoint =
      mediaType === "movie" ? "genre/movie/list" : "genre/tv/list";
    const response = await fetch(
      `https://api.themoviedb.org/3/${endpoint}?api_key=${apiKey}`,
    );
    const data = await response.json();
    return data.genres;
  }

  useEffect(() => {
    const fetchData = async () => {
      const movieGenres = await getCategories("movie");
      const tvGenres = await getCategories("tv");

      const allGenres = movieGenres.concat(tvGenres);
      const genresMap: { [key: number]: string } = {};

      allGenres.forEach((genre) => {
        genresMap[genre.id] = genre.name;
      });

      setGenres(genresMap);
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ContentGrid
      title={`Search Results for "${query}"`}
      items={items}
      href={`/search?query=${query}`}
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={handlePageChange}
      genres={genres}
    />
  );
}
