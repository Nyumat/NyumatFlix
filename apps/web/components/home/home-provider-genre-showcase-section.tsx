import { HomeProviderGenreShowcase } from "@/components/home/home-provider-genre-showcase";
import type { ProviderWatchBrand } from "@/components/provider/provider-watch-select";
import { providerPopularCacheKey } from "@/lib/provider-popular-shared";
import { getProviderCatalog } from "@/lib/server/provider-catalog-data";
import { getWatchProviderBrands } from "@/lib/watch-providers";

const toClientProvider = (
  provider: Awaited<ReturnType<typeof getWatchProviderBrands>>[number],
): ProviderWatchBrand => ({
  id: provider.id,
  name: provider.name,
  logoPath: provider.logoPath,
  localLogo: provider.localLogo,
  surface: provider.surface,
});

export async function HomeProviderGenreShowcaseSection() {
  const providers = await getWatchProviderBrands();
  if (providers.length === 0) {
    return null;
  }

  const defaultProvider = providers[0];
  const defaultProviderId = defaultProvider.id;

  const [movieCatalog, tvCatalog] = await Promise.all([
    getProviderCatalog(defaultProvider, "movie"),
    getProviderCatalog(defaultProvider, "tv"),
  ]);

  const initialItemsByKey = {
    [providerPopularCacheKey(String(defaultProviderId), "movie")]:
      movieCatalog.items,
    [providerPopularCacheKey(String(defaultProviderId), "tv")]: tvCatalog.items,
  };

  return (
    <HomeProviderGenreShowcase
      providers={providers.map(toClientProvider)}
      defaultProviderId={defaultProviderId}
      initialItemsByKey={initialItemsByKey}
    />
  );
}
