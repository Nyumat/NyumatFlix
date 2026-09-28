"use client";

import { useIndexHeroTransition } from "@/components/catalog/index-hero-transition-context";
import {
  HERO_CROSSFADE_DURATION_MS,
  HERO_CROSSFADE_EASE_CSS,
} from "@/lib/hero-crossfade";
import Image from "next/image";
import { useEffect, useState } from "react";

export type PageBackdrop = {
  imageUrl: string;
  alt: string;
  priority?: boolean;
};

type AmbientPageBackdropProps = {
  backdrop?: PageBackdrop | null;
};

export function AmbientPageBackdrop({ backdrop }: AmbientPageBackdropProps) {
  const transition = useIndexHeroTransition();
  const sharedBackdrop = transition?.backdrops[transition.activeIndex];
  const resolvedBackdrop =
    transition && sharedBackdrop !== undefined
      ? sharedBackdrop
      : (backdrop ?? null);
  const [visibleBackdrop, setVisibleBackdrop] = useState(
    resolvedBackdrop ?? null,
  );
  const [outgoingBackdrop, setOutgoingBackdrop] = useState<PageBackdrop | null>(
    null,
  );
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (resolvedBackdrop?.imageUrl === visibleBackdrop?.imageUrl) return;
    setOutgoingBackdrop(visibleBackdrop);
    setVisibleBackdrop(resolvedBackdrop);
    setIsTransitioning(true);
    const frame = requestAnimationFrame(() => setIsTransitioning(false));
    const timeout = window.setTimeout(
      () => setOutgoingBackdrop(null),
      HERO_CROSSFADE_DURATION_MS,
    );
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [resolvedBackdrop]);

  backdrop = visibleBackdrop;
  if (!backdrop?.imageUrl) {
    return null;
  }

  const renderBackdrop = (
    item: PageBackdrop,
    opacity: "opacity-0" | "opacity-100",
  ) => (
    <div
      key={item.imageUrl}
      className={`absolute inset-0 motion-reduce:transition-none transition-opacity ${opacity}`}
      style={{
        transitionDuration: `${HERO_CROSSFADE_DURATION_MS}ms`,
        transitionTimingFunction: HERO_CROSSFADE_EASE_CSS,
      }}
    >
      <div className="absolute -inset-20">
        <Image
          src={item.imageUrl}
          alt=""
          fill
          priority={item.priority}
          sizes="100vw"
          className="scale-[1.2] object-cover opacity-50 blur-[80px] saturate-100"
        />
      </div>
      <div className="absolute left-0 top-0 hidden h-[40dvh] w-full mix-blend-screen opacity-20 lg:block">
        <Image
          src={item.imageUrl}
          alt=""
          fill
          priority={item.priority}
          sizes="100vw"
          className="scale-[1.2] object-cover blur-[50px] saturate-100 [mask-image:linear-gradient(to_bottom,black_0%,transparent_100%)]"
        />
      </div>
    </div>
  );

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 hidden overflow-hidden bg-[#050505] lg:block"
      data-page-backdrop="image"
    >
      {outgoingBackdrop
        ? renderBackdrop(outgoingBackdrop, "opacity-100")
        : null}
      {renderBackdrop(backdrop, isTransitioning ? "opacity-0" : "opacity-100")}
    </div>
  );
}
