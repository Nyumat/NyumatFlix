import { buildCatalogMetadata } from "@/lib/seo/metadata";

export default function SiteOgPreviewPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">
          Site OG Image Preview
        </h1>
        <p className="text-muted-foreground">
          Cinematic social card — warm sci-fi poster mosaic, no photo backdrop.
          Preview at 25% zoom before shipping.
        </p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-semibold text-foreground">Default site card</h2>
          <p className="text-sm text-muted-foreground">
            Production:{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">
              /opengraph-image
            </code>
            {" · "}
            Dev preview:{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">
              /dev/site-og/image
            </code>
          </p>
        </div>
        <div className="bg-black p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt="NyumatFlix site OG preview"
            src="/dev/site-og/image"
            className="mx-auto w-full max-w-[900px] rounded-xl border border-white/10"
          />
        </div>
      </section>
    </div>
  );
}

export const metadata = buildCatalogMetadata({
  title: "Site OG Preview",
  description: "Development preview for the NyumatFlix default social card.",
  path: "/dev/site-og",
});
