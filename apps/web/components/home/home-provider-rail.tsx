import { ProviderLogoMark } from "@/components/provider/provider-logo-mark";
import {
  getWatchProviderBrands,
  type WatchProviderBrand,
} from "@/lib/watch-providers";
import Link from "next/link";

export async function HomeProviderRail() {
  const homeProviders: WatchProviderBrand[] = await getWatchProviderBrands();

  return (
    <section
      aria-labelledby="home-providers-heading"
      className="index-bleed relative z-[1] space-y-4"
    >
      <div className="index-rail-padding">
        <div className="flex items-baseline gap-2.5">
          <span className="h-[1.2em] w-1 shrink-0 bg-pink-500" aria-hidden />
          <h2
            id="home-providers-heading"
            className="text-xl font-semibold text-foreground md:text-2xl"
          >
            Browse by Provider
          </h2>
        </div>
      </div>

      <div className="index-rail-padding scroll-px-6 lg:scroll-px-16">
        <div
          className="scrollbar-hide overflow-x-auto"
          role="list"
          aria-label="Streaming providers"
        >
          <div className="flex w-max snap-x snap-mandatory gap-5 pb-1 lg:gap-6">
            {homeProviders.map((provider) => (
              <Link
                key={provider.id}
                href={`/providers/${provider.id}?type=movie`}
                className="group w-[5.75rem] shrink-0 snap-start lg:w-[6.75rem]"
                aria-label={`Browse ${provider.name}`}
                role="listitem"
                prefetch={true}
              >
                <ProviderLogoMark
                  provider={provider}
                  className="mx-auto aspect-square w-20 rounded-2xl lg:w-24"
                />
                <span className="mt-2.5 block px-0.5 text-center text-sm font-medium leading-5 text-white transition-colors duration-300 group-hover:text-pink-500 group-focus-visible:text-pink-500">
                  {provider.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
