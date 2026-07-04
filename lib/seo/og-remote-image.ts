import "server-only";

import sharp from "sharp";
import { OG_IMAGE_SIZE } from "./constants";
import type {
  CollectionOgImageProps,
  MediaOgImageProps,
  PersonOgImageProps,
} from "./og-image";

const MEDIA_POSTER_W = 268;
const MEDIA_POSTER_H = 402;
const COLLECTION_POSTER_W = 152;
const COLLECTION_POSTER_H = 228;
const PERSON_PORTRAIT_WIDTH = Math.round(OG_IMAGE_SIZE.width * 0.44);
const SITE_POSTER_W = 184;
const SITE_POSTER_H = 276;

const FETCH_TIMEOUT_MS = 8_000;
const IMAGE_DATA_URI_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_IMAGE_DATA_URI_CACHE_ENTRIES = 300;

type ImageCacheEntry = {
  dataUri: string;
  expiresAt: number;
};

const imageDataUriCache = new Map<string, ImageCacheEntry>();

const setImageDataUriCache = (url: string, dataUri: string) => {
  imageDataUriCache.set(url, {
    dataUri,
    expiresAt: Date.now() + IMAGE_DATA_URI_CACHE_TTL_MS,
  });

  if (imageDataUriCache.size <= MAX_IMAGE_DATA_URI_CACHE_ENTRIES) return;

  const oldestKey = imageDataUriCache.keys().next().value;
  if (oldestKey) imageDataUriCache.delete(oldestKey);
};

export async function fetchOgImageDataUri(
  url: string | null | undefined,
  width: number,
  height: number,
): Promise<string | null> {
  if (!url) return null;

  const cached = imageDataUriCache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.dataUri;
  }

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;

    const input = Buffer.from(await response.arrayBuffer());
    const pngBuffer = await sharp(input)
      .rotate()
      .resize(width, height, { fit: "cover", position: "centre" })
      .png()
      .toBuffer();

    const dataUri = `data:image/png;base64,${pngBuffer.toString("base64")}`;
    setImageDataUriCache(url, dataUri);
    return dataUri;
  } catch {
    return null;
  }
}

const resolveUrls = (
  entries: Array<{
    url: string | null | undefined;
    width: number;
    height: number;
  }>,
): Promise<Array<string | null>> =>
  Promise.all(
    entries.map(({ url, width, height }) =>
      fetchOgImageDataUri(url, width, height),
    ),
  );

export async function resolveMediaOgImageProps(
  props: MediaOgImageProps,
): Promise<MediaOgImageProps> {
  const [posterUrl, backdropUrl] = await resolveUrls([
    { url: props.posterUrl, width: MEDIA_POSTER_W, height: MEDIA_POSTER_H },
    {
      url: props.backdropUrl,
      width: OG_IMAGE_SIZE.width + 16,
      height: OG_IMAGE_SIZE.height + 16,
    },
  ]);

  return {
    ...props,
    posterUrl: posterUrl ?? undefined,
    backdropUrl: backdropUrl ?? undefined,
  };
}

export async function resolvePersonOgImageProps(
  props: PersonOgImageProps,
): Promise<PersonOgImageProps> {
  const collageEntries = (props.filmPosterUrls ?? []).map((url) => ({
    url,
    width: 120,
    height: 180,
  }));

  const resolved = await resolveUrls([
    {
      url: props.profileUrl,
      width: PERSON_PORTRAIT_WIDTH,
      height: OG_IMAGE_SIZE.height,
    },
    ...collageEntries,
  ]);

  const [profileUrl, ...collageResolved] = resolved;

  return {
    ...props,
    profileUrl: profileUrl ?? undefined,
    filmPosterUrls: collageResolved.filter((url): url is string =>
      Boolean(url),
    ),
  };
}

export async function resolveCollectionOgImageProps(
  props: CollectionOgImageProps,
): Promise<CollectionOgImageProps> {
  const posterEntries = (props.posterUrls ?? []).map((url) => ({
    url,
    width: COLLECTION_POSTER_W,
    height: COLLECTION_POSTER_H,
  }));

  const resolved = await resolveUrls([
    ...posterEntries,
    {
      url: props.backdropUrl,
      width: OG_IMAGE_SIZE.width + 16,
      height: OG_IMAGE_SIZE.height + 16,
    },
  ]);

  const backdropUrl = resolved.at(posterEntries.length) ?? null;
  const posterUrls = resolved
    .slice(0, posterEntries.length)
    .filter((url): url is string => Boolean(url));

  return {
    ...props,
    posterUrls,
    backdropUrl: backdropUrl ?? undefined,
  };
}

export async function resolveSiteOgPosterUrls(
  posterUrls: string[],
  bannerUrl: string,
): Promise<{ posterUrls: string[]; bannerUrl: string }> {
  const resolved = await resolveUrls([
    ...posterUrls.map((url) => ({
      url,
      width: SITE_POSTER_W,
      height: SITE_POSTER_H,
    })),
    {
      url: bannerUrl,
      width: OG_IMAGE_SIZE.width,
      height: OG_IMAGE_SIZE.height,
    },
  ]);

  const resolvedBanner = resolved.at(posterUrls.length);
  const resolvedPosters = resolved
    .slice(0, posterUrls.length)
    .filter((url): url is string => Boolean(url));

  return {
    posterUrls: resolvedPosters,
    bannerUrl: resolvedBanner ?? bannerUrl,
  };
}
