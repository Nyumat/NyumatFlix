import { buildCatalogMetadata } from "@/lib/seo/metadata";
import {
  getOgPreviewExamples,
  getPopularMovieSeoExamples,
  getPopularTvSeoExamples,
} from "@/lib/seo/preview-examples";
const routeForType = (type: string, id: string) => {
  switch (type) {
    case "movie":
      return `/movies/${id}`;
    case "tv":
      return `/tvshows/${id}`;
    case "person":
      return `/person/${id}`;
    case "collection":
      return `/collection/${id}`;
    default:
      return `/${type}/${id}`;
  }
};

export default async function OgPreviewIndexPage() {
  const [examples, popularMovies, popularTv] = await Promise.all([
    Promise.resolve(getOgPreviewExamples()),
    getPopularMovieSeoExamples(),
    getPopularTvSeoExamples(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">OG Image Preview</h1>
        <p className="text-muted-foreground">
          Development-only previews for dynamically generated social cards.
          These render the same output as each route&apos;s{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">
            opengraph-image
          </code>{" "}
          file.
        </p>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Share cards</h2>
          <p className="text-sm text-muted-foreground">
            Generated PNGs at 1200×630 using poster, backdrop, and metadata.
          </p>
        </div>

        <div className="grid gap-6">
          {examples.map((example) => (
            <article
              key={`${example.type}-${example.id}`}
              className="overflow-hidden rounded-2xl border border-border bg-card"
            >
              <div className="border-b border-border px-4 py-3">
                <h3 className="font-semibold text-foreground">
                  {example.label}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {routeForType(example.type, example.id)}
                </p>
              </div>
              <div className="bg-black p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={`${example.label} OG preview`}
                  src={`/dev/og-preview/${example.type}/${example.id}/image`}
                  className="mx-auto w-full max-w-[900px] rounded-xl border border-white/10"
                />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Popular movies — title & description
          </h2>
          <p className="text-sm text-muted-foreground">
            Current SEO output from{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">
              generateMediaMetadata
            </code>
            .
          </p>
        </div>

        <div className="grid gap-4">
          {popularMovies.map((example) => (
            <article
              key={`movie-seo-${example.id}`}
              className="rounded-2xl border border-border bg-card p-4"
            >
              <p className="text-sm font-medium text-muted-foreground">
                {example.label} · /movies/{example.id}
              </p>
              <p className="mt-2 font-semibold text-foreground">
                {example.title}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {example.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Popular TV shows — title & description
          </h2>
          <p className="text-sm text-muted-foreground">
            Current SEO output from{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">
              generateMediaMetadata
            </code>
            .
          </p>
        </div>

        <div className="grid gap-4">
          {popularTv.map((example) => (
            <article
              key={`tv-seo-${example.id}`}
              className="rounded-2xl border border-border bg-card p-4"
            >
              <p className="text-sm font-medium text-muted-foreground">
                {example.label} · /tvshows/{example.id}
              </p>
              <p className="mt-2 font-semibold text-foreground">
                {example.title}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {example.description}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export const metadata = buildCatalogMetadata({
  title: "OG Preview",
  description: "Development preview for NyumatFlix social share images.",
  path: "/dev/og-preview",
});
