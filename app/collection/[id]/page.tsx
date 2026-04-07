import { PageContainer } from "@/components/layout/page-container";
import { ContentContainer } from "@/components/layout/content-container";
import { StaticHero } from "@/components/hero";
import { MovieCard } from "@/components/movie/movie-card";
import { BackButton } from "@/components/ui/back-button";
import { tmdb } from "@/tmdb/api";
import { Metadata } from "next";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

const tmdbBackdrop = (path: string | null | undefined) =>
  path ? `https://image.tmdb.org/t/p/original${path}` : null;

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { id } = await props.params;
  const collection = await tmdb.collection.details({ id }).catch(() => null);
  if (!collection) return { title: "Collection" };
  return { title: `${collection.name} · Collection` };
}

export default async function CollectionPage(props: Props) {
  const { id } = await props.params;
  const collection = await tmdb.collection.details({ id }).catch(() => null);
  if (!collection) notFound();

  const backdropImage =
    tmdbBackdrop(collection.backdrop_path) ??
    tmdbBackdrop(collection.parts[0]?.backdrop_path) ??
    "/movie-banner.webp";

  return (
    <PageContainer className="pb-16">
      <StaticHero
        imageUrl={backdropImage}
        title={collection.name}
        route=""
        hideTitle
      />
      <ContentContainer className="relative z-10" topSpacing={false}>
        <div className="mx-auto w-full max-w-7xl space-y-6 px-2 pb-12 sm:px-4">
          <div className="flex flex-col gap-4 pb-8 pt-20 md:pt-28">
            <BackButton fallbackUrl="/movies" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
                {collection.name}
              </h1>
              {collection.overview ? (
                <p className="mt-2 max-w-3xl text-muted-foreground">
                  {collection.overview}
                </p>
              ) : null}
            </div>
          </div>
          <section className="grid-list">
            {collection.parts.map((movie) => (
              <MovieCard key={movie.id} {...movie} />
            ))}
          </section>
        </div>
      </ContentContainer>
    </PageContainer>
  );
}
