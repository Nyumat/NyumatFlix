import { ProviderLogoMark } from "@/components/provider/provider-logo-mark";
import type { WatchProviderBrand } from "@/lib/watch-providers";
import Link from "next/link";

type ManifestoProviderMarqueeProps = {
  providers: WatchProviderBrand[];
};

export const ManifestoProviderMarquee = ({
  providers,
}: ManifestoProviderMarqueeProps) => {
  if (providers.length === 0) {
    return null;
  }

  const tracks = [providers, providers] as const;

  return (
    <section
      aria-label="Streaming providers"
      className="relative z-10 my-12 w-full"
    >
      <div className="group/marquee overflow-hidden">
        <div className="flex w-max gap-8 motion-safe:animate-[streaming-marquee_40s_linear_infinite] motion-safe:group-hover/marquee:[animation-play-state:paused] motion-reduce:animate-none">
          {tracks.map((track, trackIndex) => (
            <ul
              key={trackIndex}
              className="flex gap-8"
              aria-hidden={trackIndex === 1}
            >
              {track.map((provider) => (
                <li key={`${trackIndex}-${provider.id}`}>
                  <Link
                    href={`/providers/${provider.id}?type=movie`}
                    aria-label={provider.name}
                    tabIndex={trackIndex === 1 ? -1 : undefined}
                    className="block w-20 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-white/80 lg:w-24"
                  >
                    <ProviderLogoMark
                      provider={provider}
                      className="aspect-square w-full rounded-2xl"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
};
