import {
  catalogCardToMediaItem,
  catalogMovieToMediaItem,
  getCatalogCardYear,
  homeCollectionPartToMediaItem,
  slimMediaItemsForRsc,
  toCatalogMovieCard,
  toCatalogTvCard,
  toHomeCollectionCard,
} from "@/lib/cards/catalog-dto";
import type { Movie, TvShow } from "@/tmdb/models";
import { describe, expect, it } from "vitest";

const sampleMovie: Movie = {
  adult: false,
  backdrop_path: "/backdrop.jpg",
  genre_ids: [28, 12],
  id: 42,
  original_language: "en",
  original_title: "Sample Movie",
  overview: "A long overview that should not ship in catalog cards.",
  popularity: 123.4,
  poster_path: "/poster.jpg",
  release_date: "2024-01-15",
  title: "Sample Movie",
  video: false,
  vote_average: 7.8,
  vote_count: 900,
};

const sampleTv: TvShow = {
  backdrop_path: "/tv-backdrop.jpg",
  first_air_date: "2023-06-01",
  genre_ids: [18],
  id: 7,
  name: "Sample Show",
  origin_country: ["US"],
  original_language: "en",
  original_name: "Sample Show",
  overview: "TV overview we do not need in cards.",
  popularity: 88.2,
  poster_path: "/tv-poster.jpg",
  vote_average: 8.1,
  vote_count: 400,
};

describe("catalog card DTO mapping", () => {
  it("keeps only fields the catalog UI reads for movies", () => {
    const card = toCatalogMovieCard({
      ...sampleMovie,
      media_type: "movie",
      logo: { file_path: "/logo.png", width: 200, height: 80 },
    });

    expect(card).toEqual({
      id: 42,
      media_type: "movie",
      title: "Sample Movie",
      poster_path: "/poster.jpg",
      backdrop_path: "/backdrop.jpg",
      release_date: "2024-01-15",
      vote_average: 7.8,
      vote_count: 900,
      logo: { file_path: "/logo.png", width: 200, height: 80 },
    });
    expect(card).not.toHaveProperty("overview");
    expect(card).not.toHaveProperty("popularity");
  });

  it("round-trips slim movie cards for UI components", () => {
    const card = toCatalogMovieCard({ ...sampleMovie, media_type: "movie" });
    const restored = catalogMovieToMediaItem(card);

    expect(restored.id).toBe(42);
    expect(restored.title).toBe("Sample Movie");
    expect(restored.media_type).toBe("movie");
    expect(restored.overview).toBe("");
    expect(restored.popularity).toBe(0);
  });

  it("slims mixed media lists without changing count", () => {
    const items = slimMediaItemsForRsc([
      { ...sampleMovie, media_type: "movie" as const },
      { ...sampleTv, media_type: "tv" as const, name: sampleTv.name },
    ]);

    expect(items).toHaveLength(2);
    expect(items[0]?.overview).toBe("");
    expect(items[1]?.overview).toBe("");
    const tvItem = catalogCardToMediaItem(toCatalogTvCard(sampleTv));
    expect(tvItem.media_type).toBe("tv");
    expect("name" in tvItem && tvItem.name).toBe("Sample Show");
  });

  it("maps collection payloads to slim part cards", () => {
    const collection = toHomeCollectionCard({
      id: 1,
      name: "Test Collection",
      overview: "Franchise overview",
      backdrop_path: "/collection.jpg",
      poster_path: "/collection-poster.jpg",
      parts: [sampleMovie],
    });

    expect(collection.parts).toHaveLength(1);
    expect(collection.parts[0]).not.toHaveProperty("overview");
    expect(homeCollectionPartToMediaItem(collection.parts[0]).title).toBe(
      "Sample Movie",
    );
    expect(getCatalogCardYear(collection.parts[0])).toBe("2024");
  });
});
