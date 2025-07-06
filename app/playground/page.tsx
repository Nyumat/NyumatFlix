"use client";

import { ContentContainer } from "@/components/layout/content-container";
import { PageContainer } from "@/components/layout/page-container";
import { CountryBadge, CountryBadgeList } from "@/components/ui/country-badge";
import { GenreBadge, PrimaryGenreBadge } from "@/components/ui/genre-badge";

export default function PlaygroundPage() {
  // Sample countries for testing
  const sampleCountries = [
    { iso_3166_1: "US", name: "United States" },
    { iso_3166_1: "GB", name: "United Kingdom" },
    { iso_3166_1: "JP", name: "Japan" },
    { iso_3166_1: "KR", name: "South Korea" },
    { iso_3166_1: "FR", name: "France" },
    { iso_3166_1: "DE", name: "Germany" },
    { iso_3166_1: "CA", name: "Canada" },
    { iso_3166_1: "AU", name: "Australia" },
  ];

  return (
    <PageContainer>
      <ContentContainer className="py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-8 text-center">
            Component Playground
          </h1>

          <div className="space-y-12">
            {/* Genre Badges Section */}
            <section>
              <h2 className="text-3xl font-semibold mb-6">Genre Badges</h2>

              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-medium mb-3">
                    Movie Genre Badges
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <PrimaryGenreBadge
                      genreId={28}
                      genreName="Action"
                      mediaType="movie"
                    />
                    <PrimaryGenreBadge
                      genreId={35}
                      genreName="Comedy"
                      mediaType="movie"
                    />
                    <PrimaryGenreBadge
                      genreId={18}
                      genreName="Drama"
                      mediaType="movie"
                    />
                    <PrimaryGenreBadge
                      genreId={27}
                      genreName="Horror"
                      mediaType="movie"
                    />
                    <PrimaryGenreBadge
                      genreId={878}
                      genreName="Science Fiction"
                      mediaType="movie"
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-medium mb-3">
                    TV Show Genre Badges
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <PrimaryGenreBadge
                      genreId={10759}
                      genreName="Action & Adventure"
                      mediaType="tv"
                    />
                    <PrimaryGenreBadge
                      genreId={35}
                      genreName="Comedy"
                      mediaType="tv"
                    />
                    <PrimaryGenreBadge
                      genreId={18}
                      genreName="Drama"
                      mediaType="tv"
                    />
                    <PrimaryGenreBadge
                      genreId={10765}
                      genreName="Sci-Fi & Fantasy"
                      mediaType="tv"
                    />
                    <PrimaryGenreBadge
                      genreId={9648}
                      genreName="Mystery"
                      mediaType="tv"
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-medium mb-3">
                    Different Variants
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <GenreBadge
                      genreId={28}
                      genreName="Action"
                      mediaType="movie"
                      variant="default"
                    />
                    <GenreBadge
                      genreId={35}
                      genreName="Comedy"
                      mediaType="movie"
                      variant="secondary"
                    />
                    <GenreBadge
                      genreId={18}
                      genreName="Drama"
                      mediaType="movie"
                      variant="outline"
                    />
                    <GenreBadge
                      genreId={27}
                      genreName="Horror (Not Clickable)"
                      mediaType="movie"
                      variant="destructive"
                      clickable={false}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Country Badges Section */}
            <section>
              <h2 className="text-3xl font-semibold mb-6">Country Badges</h2>

              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-medium mb-3">
                    Movie Country Badges
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {sampleCountries.slice(0, 4).map((country) => (
                      <CountryBadge
                        key={country.iso_3166_1}
                        country={country}
                        mediaType="movie"
                        variant="outline"
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-medium mb-3">
                    TV Show Country Badges
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {sampleCountries.slice(0, 4).map((country) => (
                      <CountryBadge
                        key={country.iso_3166_1}
                        country={country}
                        mediaType="tv"
                        variant="outline"
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-medium mb-3">
                    Country Badge List (Max 3)
                  </h3>
                  <CountryBadgeList
                    countries={sampleCountries}
                    maxDisplay={3}
                    mediaType="movie"
                    variant="outline"
                  />
                </div>

                <div>
                  <h3 className="text-xl font-medium mb-3">
                    Country Badge Sizes
                  </h3>
                  <div className="flex flex-wrap items-center gap-4">
                    <CountryBadge
                      country={sampleCountries[0]}
                      size="sm"
                      mediaType="movie"
                    />
                    <CountryBadge
                      country={sampleCountries[0]}
                      size="md"
                      mediaType="movie"
                    />
                    <CountryBadge
                      country={sampleCountries[0]}
                      size="lg"
                      mediaType="movie"
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-medium mb-3">
                    Flag Only vs Full Name
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <CountryBadge
                      country={sampleCountries[1]}
                      showName={false}
                      mediaType="movie"
                    />
                    <CountryBadge
                      country={sampleCountries[1]}
                      showFlag={false}
                      mediaType="movie"
                    />
                    <CountryBadge
                      country={sampleCountries[1]}
                      showName={true}
                      showFlag={true}
                      mediaType="movie"
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-medium mb-3">
                    Non-Clickable Country Badge
                  </h3>
                  <CountryBadge
                    country={sampleCountries[2]}
                    clickable={false}
                    variant="secondary"
                    mediaType="movie"
                  />
                </div>
              </div>
            </section>

            {/* Testing Instructions */}
            <section>
              <h2 className="text-3xl font-semibold mb-6">
                Testing Instructions
              </h2>
              <div className="bg-muted p-6 rounded-lg space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Genre Badges:</h4>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>Hover to see tooltips showing destination</li>
                    <li>Click to browse by genre with infinite scroll</li>
                    <li>Prefetching happens on hover (check network tab)</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Country Badges:</h4>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>Hover to see tooltips with country and media type</li>
                    <li>Click to browse popular content from that country</li>
                    <li>
                      Content is sorted by highest rated → most popular → most
                      voted
                    </li>
                    <li>Infinite scroll loads more content automatically</li>
                    <li>
                      Different media types (movie/TV) go to appropriate pages
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Try these examples:</h4>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>🇯🇵 Japan → Browse anime and J-dramas</li>
                    <li>
                      🇰🇷 South Korea → Discover K-dramas and Korean movies
                    </li>
                    <li>🇬🇧 UK → Explore British comedies and dramas</li>
                    <li>🇺🇸 US → American blockbusters and series</li>
                  </ul>
                </div>
              </div>
            </section>
          </div>
        </div>
      </ContentContainer>
    </PageContainer>
  );
}
