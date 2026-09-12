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
      className="index-bleed space-y-4 overflow-hidden"
    >
      <div className="px-6 lg:px-16">
        <h2
          id="home-providers-heading"
          className="text-xl font-semibold text-foreground"
        >
          Browse by Provider
        </h2>
      </div>

      <div
        className="scrollbar-hide flex min-w-0 snap-x snap-mandatory scroll-px-6 gap-5 overflow-x-auto px-6 pb-1 lg:scroll-px-16 lg:gap-6 lg:px-16"
        role="list"
        aria-label="Streaming providers"
      >
        {homeProviders.map((provider) => (
          <Link
            key={provider.id}
            href={`/providers/${provider.id}?type=movie`}
            className="group w-[4.75rem] shrink-0 snap-start lg:w-[5.75rem]"
            aria-label={`Browse ${provider.name}`}
            role="listitem"
            prefetch={false}
          >
            <ProviderLogoMark
              provider={provider}
              className="mx-auto aspect-square w-16 rounded-xl transition duration-300 group-hover:-translate-y-1 lg:w-20"
            />
            <span className="mt-2 block min-h-8 px-1 text-center text-xs font-medium leading-4 text-muted-foreground transition-colors group-hover:text-foreground">
              {provider.name}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
