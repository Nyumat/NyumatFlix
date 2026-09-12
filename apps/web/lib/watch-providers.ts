import "server-only";

import { TMDB_WATCH_REGION } from "@/lib/constants";
import { tmdb } from "@/tmdb/api";
import { cache } from "react";

export type WatchProviderSeed = {
  id: number;
  name: string;
  localLogo?: string;
  surface: string;
};

export type WatchProviderBrand = WatchProviderSeed & {
  logoPath?: string;
};

export const WATCH_PROVIDER_SEEDS: readonly WatchProviderSeed[] = [
  {
    id: 8,
    name: "Netflix",
    localLogo: "/netflix.svg",
    surface: "bg-linear-to-br from-[#9b111e] via-[#4e080e] to-[#100103]",
  },
  {
    id: 9,
    name: "Prime Video",
    localLogo: "/primevideo.svg",
    surface: "bg-linear-to-br from-[#0f5378] via-[#082b42] to-[#020b13]",
  },
  {
    id: 337,
    name: "Disney Plus",
    localLogo: "/disneyplus.svg",
    surface: "bg-linear-to-br from-[#263e9f] via-[#111e5b] to-[#050817]",
  },
  {
    id: 350,
    name: "Apple TV+",
    localLogo: "/appletvplus.svg",
    surface: "bg-linear-to-br from-[#145b19] via-[#073b0d] to-[#010b03]",
  },
  {
    id: 15,
    name: "Hulu",
    localLogo: "/hulu.svg",
    surface: "bg-linear-to-br from-[#16885e] via-[#084d36] to-[#021a12]",
  },
  {
    id: 1899,
    name: "HBO Max",
    localLogo: "/hbomax.svg",
    surface: "bg-linear-to-br from-[#6730bb] via-[#2f125f] to-[#0e0621]",
  },
  {
    id: 2,
    name: "Apple TV",
    surface: "bg-linear-to-br from-[#565660] via-[#25252d] to-[#08080b]",
  },
  {
    id: 2303,
    name: "Paramount Plus",
    surface: "bg-linear-to-br from-[#275faa] via-[#153764] to-[#050d1d]",
  },
  {
    id: 386,
    name: "Peacock Premium",
    localLogo: "/peacock.svg",
    surface: "bg-linear-to-br from-[#3e4350] via-[#1b1e28] to-[#07080c]",
  },
  {
    id: 283,
    name: "Crunchyroll",
    surface: "bg-linear-to-br from-[#e89a16] via-[#a9570a] to-[#321301]",
  },
  {
    id: 43,
    name: "Starz",
    surface: "bg-linear-to-br from-[#292929] via-[#121212] to-[#020202]",
  },
  {
    id: 526,
    name: "AMC+",
    surface: "bg-linear-to-br from-[#9baaba] via-[#4b5d6e] to-[#131d27]",
  },
  {
    id: 34,
    name: "MGM Plus",
    surface: "bg-linear-to-br from-[#826e2e] via-[#473810] to-[#171106]",
  },
  {
    id: 188,
    name: "YouTube Premium",
    surface: "bg-linear-to-br from-[#e72d2f] via-[#941218] to-[#2c0306]",
  },
  {
    id: 192,
    name: "YouTube",
    surface: "bg-linear-to-br from-[#e9383d] via-[#9f161d] to-[#300306]",
  },
  {
    id: 73,
    name: "Tubi TV",
    surface: "bg-linear-to-br from-[#e34a3a] via-[#a51e22] to-[#35070b]",
  },
  {
    id: 300,
    name: "Pluto TV",
    surface: "bg-linear-to-br from-[#5542d5] via-[#30258b] to-[#0e0b31]",
  },
];

const getProviderLogoPaths = cache(async () => {
  const [movieResponse, tvResponse] = await Promise.allSettled([
    tmdb.watchProviders.movie({ region: TMDB_WATCH_REGION }),
    tmdb.watchProviders.tv({ region: TMDB_WATCH_REGION }),
  ]);
  const logos = new Map<number, string>();

  for (const response of [movieResponse, tvResponse]) {
    if (response.status !== "fulfilled") continue;

    for (const provider of response.value.results ?? []) {
      if (provider.logo_path && !logos.has(provider.provider_id)) {
        logos.set(provider.provider_id, provider.logo_path);
      }
    }
  }

  return logos;
});

export const getWatchProviderBrands = cache(
  async (): Promise<WatchProviderBrand[]> => {
    const logos = await getProviderLogoPaths();
    return WATCH_PROVIDER_SEEDS.map((provider) => ({
      ...provider,
      logoPath: logos.get(provider.id),
    }));
  },
);

export const getWatchProviderBrand = cache(
  async (id: number): Promise<WatchProviderBrand | undefined> => {
    const provider = WATCH_PROVIDER_SEEDS.find((item) => item.id === id);
    if (!provider) return undefined;

    const logos = await getProviderLogoPaths();
    return { ...provider, logoPath: logos.get(provider.id) };
  },
);
