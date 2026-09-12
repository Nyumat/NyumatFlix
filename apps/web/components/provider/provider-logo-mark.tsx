import { tmdbImage } from "@/tmdb/utils";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { WatchProviderBrand } from "@/lib/watch-providers";

type ProviderLogoMarkProps = {
  provider: WatchProviderBrand;
  className?: string;
};

export function ProviderLogoMark({
  provider,
  className,
}: ProviderLogoMarkProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl",
        provider.logoPath ? "bg-transparent" : provider.surface,
        className,
      )}
    >
      {provider.logoPath ? (
        <Image
          src={tmdbImage.logo(provider.logoPath, "w154")}
          alt=""
          fill
          className="object-cover"
          sizes="(max-width: 640px) 116px, 136px"
        />
      ) : provider.localLogo ? (
        <Image
          src={provider.localLogo}
          alt=""
          fill
          className="object-contain p-5"
          sizes="(max-width: 640px) 116px, 136px"
        />
      ) : (
        <span className="flex size-full items-center justify-center px-3 text-center text-sm font-bold text-white sm:text-base">
          {provider.name}
        </span>
      )}
    </div>
  );
}
