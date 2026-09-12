import {
  getProviderCatalog,
  ProviderCatalogPage,
} from "@/components/provider/provider-catalog-page";
import { getWatchProviderBrand } from "@/lib/watch-providers";
import { normalizeRouteSearchParams } from "@/lib/utils";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type ProviderPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const parseProviderId = (value: string) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const parseMediaType = (value: string | undefined): "movie" | "tv" =>
  value === "tv" ? "tv" : "movie";

export default async function ProviderPage(props: ProviderPageProps) {
  const [{ id: rawId }, rawSearchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  const id = parseProviderId(rawId);
  if (id === null) notFound();

  const provider = await getWatchProviderBrand(id);
  if (!provider) notFound();

  const searchParams = normalizeRouteSearchParams(rawSearchParams);
  const mediaType = parseMediaType(searchParams.type);
  const catalog = await getProviderCatalog(id, mediaType);

  return (
    <ProviderCatalogPage
      provider={provider}
      mediaType={mediaType}
      catalog={catalog}
    />
  );
}

export async function generateMetadata(
  props: ProviderPageProps,
): Promise<Metadata> {
  const { id: rawId } = await props.params;
  const id = parseProviderId(rawId);
  if (id === null) return { title: "Provider | NyumatFlix" };

  const provider = await getWatchProviderBrand(id);
  return {
    title: provider ? `${provider.name} | NyumatFlix` : "Provider | NyumatFlix",
  };
}
