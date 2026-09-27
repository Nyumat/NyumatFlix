"use client";

import {
  FEATURE_HERO_MAX_SCROLL_BLUR_PX,
  getFeatureHeroScrollBlurPx,
  getFeatureHeroScrollBlurRangePx,
} from "@/lib/feature-hero-scroll-blur";
import { indexHeroBackdropShellClassName } from "@/lib/hero-shell-layout";
import {
  HERO_CROSSFADE_DURATION_MS,
  HERO_CROSSFADE_EASE_CSS,
} from "@/lib/hero-crossfade";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type FeatureHeroBackdropProps = {
  imageUrl: string;
  priority?: boolean;
};

function FeatureHeroBackdropImage({
  imageUrl,
  priority,
  blurPx,
}: FeatureHeroBackdropProps & { blurPx: number }) {
  const t = Math.min(1, blurPx / FEATURE_HERO_MAX_SCROLL_BLUR_PX);
  const scale = 1 + t * 0.06;
  const layerOpacity = 1 - t * 0.18;

  const lastUrlRef = useRef(imageUrl);
  const idRef = useRef(0);
  const timeoutRef = useRef<number | null>(null);
  const [layers, setLayers] = useState<Array<{ id: number; url: string }>>([
    { id: 0, url: imageUrl },
  ]);

  useEffect(() => {
    if (lastUrlRef.current === imageUrl) return;
    lastUrlRef.current = imageUrl;

    idRef.current += 1;
    setLayers((current) => [...current, { id: idRef.current, url: imageUrl }]);

    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      setLayers((current) => current.slice(-1));
      timeoutRef.current = null;
    }, HERO_CROSSFADE_DURATION_MS);

    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [imageUrl]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none relative h-full w-full overflow-hidden [mask-image:linear-gradient(to_bottom,black_40%,transparent_98%)]"
    >
      {layers.map(({ id, url }, index) => {
        const isCurrent = index === layers.length - 1;
        return (
          <div
            key={id}
            className={`absolute inset-0 ${
              isCurrent
                ? "animate-in fade-in motion-reduce:animate-none"
                : "opacity-100"
            }`}
            style={
              isCurrent
                ? {
                    animationDuration: `${HERO_CROSSFADE_DURATION_MS}ms`,
                    animationTimingFunction: HERO_CROSSFADE_EASE_CSS,
                  }
                : undefined
            }
          >
            <div
              className={
                blurPx > 0
                  ? "absolute inset-0 will-change-[filter,transform,opacity]"
                  : "absolute inset-0"
              }
              style={{
                filter:
                  blurPx > 0 ? `blur(${blurPx}px) saturate(100%)` : undefined,
                opacity: layerOpacity,
                transform: `scale(${scale})`,
                transformOrigin: "top center",
              }}
            >
              <Image
                src={url}
                alt=""
                fill
                priority={priority}
                sizes="100vw"
                className="object-cover object-top"
              />
            </div>
          </div>
        );
      })}
      <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-linear-to-r from-black/40 via-transparent to-transparent" />
    </div>
  );
}

export function FeatureHeroStickyScrollBackdrop({
  imageUrl,
  priority,
}: FeatureHeroBackdropProps) {
  const [blurPx, setBlurPx] = useState(0);

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktopQuery = window.matchMedia("(min-width: 1024px)");

    const updateBlur = () => {
      if (motionQuery.matches || !desktopQuery.matches) {
        setBlurPx(0);
        return;
      }
      const range = getFeatureHeroScrollBlurRangePx(window.innerHeight);
      setBlurPx(getFeatureHeroScrollBlurPx(window.scrollY, range));
    };

    updateBlur();
    window.addEventListener("scroll", updateBlur, { passive: true });
    window.addEventListener("resize", updateBlur);
    motionQuery.addEventListener("change", updateBlur);
    desktopQuery.addEventListener("change", updateBlur);

    return () => {
      window.removeEventListener("scroll", updateBlur);
      window.removeEventListener("resize", updateBlur);
      motionQuery.removeEventListener("change", updateBlur);
      desktopQuery.removeEventListener("change", updateBlur);
    };
  }, []);

  return (
    <div className={indexHeroBackdropShellClassName}>
      <div className="absolute top-0 left-1/2 z-0 h-full w-screen max-w-[100vw] -translate-x-1/2">
        <FeatureHeroBackdropImage
          imageUrl={imageUrl}
          priority={priority}
          blurPx={blurPx}
        />
      </div>
    </div>
  );
}
