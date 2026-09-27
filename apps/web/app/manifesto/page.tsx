import { ManifestoProviderMarquee } from "@/components/manifest/provider-marquee";
import { getWatchProviderBrands } from "@/lib/watch-providers";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Manifesto - NyumatFlix",
  description: "What NyumatFlix is for.",
};

export default async function Page() {
  const providers = await getWatchProviderBrands();

  return (
    <div className="relative flex min-h-dvh w-full flex-1 flex-col overflow-hidden bg-black text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0" aria-hidden>
        <img src="/aura.webp" alt="" className="w-full" />
        <div className="absolute inset-0 bg-linear-to-b from-black/20 via-black/70 to-black" />
      </div>

      <article className="relative z-10 mx-auto w-full max-w-2xl px-6 pt-20 sm:px-8 sm:pt-28 md:pt-32">
        <h1 className="text-center text-6xl font-semibold tracking-tight text-white [text-shadow:-0.04em_0_rgba(255,48,128,0.9),0.04em_0_rgba(70,90,255,0.9)] sm:text-7xl md:text-8xl">
          Manifesto
        </h1>

        <div className="mt-14 text-base leading-7 text-white/90 sm:mt-16 md:text-lg md:leading-8">
          <p>
            I created this site because I got{" "}
            <a
              className="text-purple-500"
              href="https://nyuma.dev/b/downloader#nyumatflix"
              target="_blank"
              rel="noopener"
            >
              tired
            </a>{" "}
            of these media companies raising prices...lying...bait and
            switching...and mostly importantly, removing my favorite content
            from their catalogs.
          </p>
        </div>
      </article>

      <ManifestoProviderMarquee providers={providers} />

      <article className="relative z-10 mx-auto w-full max-w-2xl px-6 pb-20 sm:px-8">
        <div className="space-y-6 text-base leading-7 text-white/90 md:text-lg md:leading-8">
          <p>
            Every time you resubscribe, you tell their analytics teams that
            their enshitification is working. I saw that and just went my own
            way. Legal or not, I wanted something that was MINE. And this site
            is that.
          </p>

          <p>
            If you hate this site, I have a guide on{" "}
            <a
              className="text-purple-500"
              href="https://nyuma.dev/b/media-home-lab"
              target="_blank"
              rel="noopener"
            >
              how to build your own Netflix
            </a>
            . <br />
            <br /> If that's too hard, I also have one{" "}
            <a
              className="text-purple-500"
              href="https://nyuma.dev/b/jailbreaktv"
              target="_blank"
              rel="noopener"
            >
              for Jailbreaking your TV
            </a>
            . <br />
            <br /> Or ya can just use this site. That works too ;)
          </p>

          <p></p>
        </div>
      </article>
    </div>
  );
}
