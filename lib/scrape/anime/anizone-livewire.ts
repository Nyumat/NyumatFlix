import { decodeHtmlEntities } from "./html-utils";
import { scrapeFetch } from "../fetch";

type LivewireUpdateResponse = {
  components?: Array<{
    effects?: {
      html?: string;
    };
  }>;
};

const extractAnimeIndexSnapshot = (pageHtml: string): string | null => {
  const match = pageHtml.match(
    /wire:snapshot="(\{&quot;data&quot;:\{&quot;title&quot;:&quot;Anime Index&quot;[\s\S]*?\})" wire:effects/,
  );

  if (!match?.[1]) {
    return null;
  }

  return decodeHtmlEntities(match[1].replace(/&quot;/g, '"'));
};

const extractCsrfToken = (pageHtml: string): string | null =>
  pageHtml.match(/name="csrf-token" content="([^"]+)"/)?.[1] ?? null;

const parseSetCookieHeader = (header: string): string =>
  header
    .split(/,(?=\s*[A-Za-z0-9_-]+=)/)
    .map((part) => part.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");

/** AniZone search is Livewire-only — query params do not SSR results. */
export const searchAnizoneSlug = async (
  query: string,
): Promise<string | null> => {
  const indexResponse = await scrapeFetch("https://anizone.to/anime", {
    headers: { Referer: "https://anizone.to/" },
  });

  if (!indexResponse.ok) {
    return null;
  }

  const indexHtml = await indexResponse.text();
  const csrf = extractCsrfToken(indexHtml);
  const snapshot = extractAnimeIndexSnapshot(indexHtml);
  const cookieHeader = parseSetCookieHeader(
    indexResponse.headers.get("set-cookie") ?? "",
  );

  if (!csrf || !snapshot) {
    return null;
  }

  const payload = {
    _token: csrf,
    components: [
      {
        snapshot,
        updates: { search: query },
        calls: [],
      },
    ],
  };

  const response = await fetch("https://anizone.to/livewire/update", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Livewire": "true",
      "X-CSRF-TOKEN": csrf,
      Referer: "https://anizone.to/anime",
      Origin: "https://anizone.to",
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const livewire = (await response.json()) as LivewireUpdateResponse;
  const html = livewire.components?.[0]?.effects?.html ?? "";
  const slugs = [...html.matchAll(/\/anime\/([a-z0-9]+)/g)].map(
    (entry) => entry[1],
  );

  if (slugs.length === 0) {
    return null;
  }

  const normalizedQuery = query.trim().toLowerCase();
  const titledSlugMatch = html.match(
    new RegExp(
      `/anime/([a-z0-9]+)[\\s\\S]{0,240}?${normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
      "i",
    ),
  );

  return titledSlugMatch?.[1] ?? slugs[slugs.length - 1] ?? null;
};
