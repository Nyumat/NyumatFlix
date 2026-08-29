"use client";

import {
  isHeroBackdropWideEnough,
  MIN_HERO_BACKDROP_ASPECT_RATIO,
} from "@/lib/hero-backdrop-aspect";
import type { ResolvedHeroBackgroundImage } from "@/lib/hero-background-image";
import { useEffect, useRef, useState } from "react";

const backdropValidationCache = new Map<string, boolean>();

type UseValidatedHeroBackdropArgs = {
  heroImage: ResolvedHeroBackgroundImage | null;
  heroImageSrc: string | null;
  preferPosterWhenNoBackdrop: boolean;
  minAspectRatio?: number;
};

export type ValidatedHeroBackdropState = {
  /** True while probing backdrop dimensions. */
  isValidating: boolean;
  /** Use poster hero layout (blur + contained poster). */
  usePosterHero: boolean;
  /** Render the backdrop image layer. */
  showBackdropImage: boolean;
};

export const useValidatedHeroBackdrop = ({
  heroImage,
  heroImageSrc,
  preferPosterWhenNoBackdrop,
  minAspectRatio = MIN_HERO_BACKDROP_ASPECT_RATIO,
}: UseValidatedHeroBackdropArgs): ValidatedHeroBackdropState => {
  const cachedAcceptance =
    heroImageSrc != null
      ? (backdropValidationCache.get(heroImageSrc) ?? null)
      : null;
  const [backdropAccepted, setBackdropAccepted] = useState<boolean | null>(
    cachedAcceptance,
  );
  const lastAcceptedRef = useRef<boolean | null>(cachedAcceptance);

  useEffect(() => {
    if (!preferPosterWhenNoBackdrop) {
      setBackdropAccepted(true);
      lastAcceptedRef.current = true;
      return;
    }

    if (!heroImage || heroImage.kind !== "backdrop" || !heroImageSrc) {
      setBackdropAccepted(false);
      lastAcceptedRef.current = false;
      return;
    }

    const image = new Image();
    image.onload = () => {
      const accepted = isHeroBackdropWideEnough(
        image.naturalWidth,
        image.naturalHeight,
        minAspectRatio,
      );
      lastAcceptedRef.current = accepted;
      if (heroImageSrc) {
        backdropValidationCache.set(heroImageSrc, accepted);
      }
      setBackdropAccepted(accepted);
    };
    image.onerror = () => {
      lastAcceptedRef.current = false;
      if (heroImageSrc) {
        backdropValidationCache.set(heroImageSrc, false);
      }
      setBackdropAccepted(false);
    };
    image.src = heroImageSrc;

    return () => {
      image.onload = null;
      image.onerror = null;
    };
  }, [heroImage, heroImageSrc, minAspectRatio, preferPosterWhenNoBackdrop]);

  const isPosterKind = heroImage?.kind === "poster";
  const isBackdropKind = heroImage?.kind === "backdrop";

  if (isPosterKind) {
    return {
      isValidating: false,
      usePosterHero: true,
      showBackdropImage: false,
    };
  }

  if (!preferPosterWhenNoBackdrop) {
    return {
      isValidating: false,
      usePosterHero: false,
      showBackdropImage: Boolean(heroImageSrc),
    };
  }

  if (!isBackdropKind || !heroImageSrc) {
    return {
      isValidating: false,
      usePosterHero: true,
      showBackdropImage: false,
    };
  }

  if (backdropAccepted === null) {
    if (lastAcceptedRef.current === false) {
      return {
        isValidating: true,
        usePosterHero: true,
        showBackdropImage: false,
      };
    }

    // Assume widescreen backdrop until probe finishes — avoids poster flash on load.
    return {
      isValidating: true,
      usePosterHero: false,
      showBackdropImage: Boolean(heroImageSrc),
    };
  }

  return {
    isValidating: false,
    usePosterHero: !backdropAccepted,
    showBackdropImage: backdropAccepted,
  };
};
