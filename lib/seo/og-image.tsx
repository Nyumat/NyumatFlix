import type { ReactElement } from "react";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { OG_IMAGE_SIZE, tmdbImageUrl } from "./constants";
import { tmdb } from "@/tmdb/api";
import type { PersonDetails } from "@/tmdb/models";

export { OG_IMAGE_SIZE };

export const ogImageContentType = "image/png";

export type OgEntityLabel = "FILM" | "SERIES" | "PERSON" | "COLLECTION";

export type MediaOgImageProps = {
  label: OgEntityLabel;
  title: string;
  metaLine?: string;
  tagline?: string;
  rating?: number;
  posterUrl?: string | null;
  backdropUrl?: string | null;
};

export type PersonOgImageProps = {
  name: string;
  headline?: string;
  knownForTitles?: string[];
  profileUrl?: string | null;
  filmPosterUrls?: string[];
};

export type CollectionOgImageProps = {
  title: string;
  metaLine?: string;
  posterUrls?: Array<string | null>;
  backdropUrl?: string | null;
};

const BG = "#0A0A0A";
const SAFE = 60;
const LEFT_COLUMN_INSET = 28;
const MEDIA_CONTENT_PADDING = `${SAFE}px ${SAFE}px ${SAFE}px ${SAFE + LEFT_COLUMN_INSET}px`;
const LOGO_SIZE = 56;
const MEDIA_POSTER_W = 268;
const MEDIA_POSTER_H = 402;
const MEDIA_POSTER_RADIUS = 16;
const COLLECTION_POSTER_W = 152;
const COLLECTION_POSTER_H = 228;
const COLLECTION_POSTER_RADIUS = 16;
const COLLECTION_POSTER_OVERLAP = 56;
const TEXT_PRIMARY = "#F5F5F5";
const TEXT_MUTED = "rgba(245,245,245,0.62)";
const TEXT_SHADOW = "0 2px 20px rgba(0,0,0,0.95)";
const RATING_ACCENT = "#E8B04A";

const BLUR_OVERSCAN = 8;

const LOGO_DATA_URI =
  "data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeD0iMHB4IiB5PSIwcHgiIHZpZXdCb3g9IjAgMCAxMjAwIDEyMDAiPjxnPjxnPjxnPjxwb2x5Z29uIGZpbGw9IiMwNTI3RTIiIHBvaW50cz0iMTA1NS4wMTMsNDI4LjE3NiAxMDU1LjAxMyw1MzguNDE4IDg4OC4yODksMzkwLjc1MiA4ODguMjQ1LDI5Ni41NDMgODg4LjU5MSwyOTYuNTQzIj48L3BvbHlnb24+PHBvbHlnb24gZmlsbD0iIzA1MjdFMiIgcG9pbnRzPSIxMDU1LjAxMyw3MjMuODk4IDEwNTUuMDEzLDgwNS45NjQgODg4Ljg5NCw2NzcuMTM5IDg4OC40MTgsNjc3LjEzOSA4ODguMzc1LDU4My45MjQiPjwvcG9seWdvbj48cG9seWdvbiBmaWxsPSIjMDUyN0UyIiBwb2ludHM9IjEwNTUuMDEzLDEwMTUuMzQxIDEwNTUuMDEzLDExMjguNzgxIDg4OC41OTEsOTcyLjQyOSA4ODguNTQ4LDg4MS4xMTUiPjwvcG9seWdvbj48cG9seWdvbiBmaWxsPSIjMDUyN0UyIiBwb2ludHM9Ijc1NC42NjcsOTgzLjI3NiA4OTcuNTgsMTE0NC4xNjYgODM3LjcyNywxMTUwIDY3MC40ODQsOTkwLjA2Ij48L3BvbHlnb24+PHBvbHlnb24gZmlsbD0iIzA1MjdFMiIgcG9pbnRzPSI1NDMuNTYxLDExMjMuNDIzIDQ2MS41ODIsMTEyMy4xNjMgNDYxLjU4MiwxMTIyLjk0NyAzMTIuODM1LDk2MS41ODIgMzc3LjcwMSw5NjEuNzk4Ij48L3BvbHlnb24+PHBvbHlnb24gZmlsbD0iIzA1MjdFMiIgcG9pbnRzPSI1MzUuNDgsODM1LjE3NyA1MzguNDYyLDk0Mi42NTMgMzgyLjEwOSw3ODcuMTIyIDM4MS44OTMsNzg3LjEyMiAzODQuNTI5LDY3Ny4xMzkgNTMzLjkyNCw4MzUuMjIiPjwvcG9seWdvbj48cG9seWdvbiBmaWxsPSIjMDUyN0UyIiBwb2ludHM9IjY0OC40NDQsMzg0LjE4MyA2NzguOTk3LDQzNi41MTcgNjc4LjgyNSw0NjQuNDc3IDY3Ny4xODIsNDY0LjQ3NyA1OTguMjI4LDQxMS44ODQgNTk3LjgzOSw0MTIuMSA1MzYuMzAxLDMxMS4xMDYgNjQ4LjQwMSwzODQuMTgzIj48L3BvbHlnb24+PHBvbHlnb24gZmlsbD0iIzI0NjRGMCIgcG9pbnRzPSIzODUuNDgsMTEyMi45NDcgMzE1LjU1NywxMTIyLjczMSAxNDcuMzIxLDk2MS4wNjMgMjIzLjEyLDk2MS4zMjIiPjwvcG9seWdvbj48cG9seWdvbiBmaWxsPSIjMjQ2NEYwIiBwb2ludHM9IjU0MC43OTUsMTAyNC43NjIgNTQzLjU2MSwxMTIzLjQyMyAzNzcuNzAxLDk2MS43OTggMzc5LjY4OSw4NzguMjYzIDM4MS4xMTUsODc4LjMwNiI+PC9wb2x5Z29uPjxwb2x5Z29uIGZpbGw9IiMyNDY0RjAiIHBvaW50cz0iNTM1LjQ4LDgzNS4xNzcgNTMzLjkyNCw4MzUuMjIgMzg0LjUyOSw2NzcuMTM5IDM4Ni41MTcsNTkzLjk5MyA1MDYuOTU4LDcwNS45NjQgNTA3LjAwMSw3MDUuOTY0IDUzMy4xMDMsNzUxLjM4MyI+PC9wb2x5Z29uPjxwb2x5Z29uIGZpbGw9IiMyNDY0RjAiIHBvaW50cz0iODMwLjcyNiw5NzcuMDk2IDk3Ni4xNDUsMTEzNi40NzQgODk3LjU4LDExNDQuMTY2IDc1NC42NjcsOTgzLjI3NiA3OTcuNzUzLDk3OS43NzUiPjwvcG9seWdvbj48cG9seWdvbiBmaWxsPSIjMjQ2NEYwIiBwb2ludHM9IjEwNTUuMDEzLDg5Ny40MDcgMTA1NS4wMTMsMTAxNS4zNDEgODg4LjU0OCw4ODEuMTE1IDg4OC41MDUsNzczLjAzNCA4ODkuMzY5LDc3My4wMzQiPjwvcG9seWdvbj48cG9seWdvbiBmaWxsPSIjMjQ2NEYwIiBwb2ludHM9IjEwNTUuMDEzLDYyNy4zMTIgMTA1NS4wMTMsNzIzLjg5OCA4ODguMzc1LDU4My45MjQgODg4LjMzMiw0NzIuODE4Ij48L3BvbHlnb24+PHBvbHlnb24gZmlsbD0iIzI0NjRGMCIgcG9pbnRzPSIxMDU1LjAxMywzMjYuNDQ4IDEwNTUuMDEzLDQyOC4xNzYgODg4LjU5MSwyOTYuNTQzIDg4OC4yNDUsMjk2LjU0MyA4ODguMTU5LDE2NS44MTciPjwvcG9seWdvbj48cG9seWdvbiBmaWxsPSIjMjQ2NEYwIiBwb2ludHM9IjY0OC40MDEsMzg0LjE4MyA1MzYuMzAxLDMxMS4xMDYgNDcyLjkwNCwyMDcuMTc0IDYwOC45MDIsMzE2LjUwOCI+PC9wb2x5Z29uPjxwb2x5Z29uIGZpbGw9IiMwMDI5NTUiIHBvaW50cz0iMTA1NS4wMTMsMTEyOC43ODEgOTc2LjE0NSwxMTM2LjQ3NCA4MzAuNzI2LDk3Ny4wOTYgODg4LjU5MSw5NzIuNDI5Ij48L3BvbHlnb24+PHBvbHlnb24gZmlsbD0iIzAwMjk1NSIgcG9pbnRzPSIxMDU1LjAxMyw4MDUuOTY0IDEwNTUuMDEzLDg5Ny40MDcgODg5LjM2OSw3NzMuMDM0IDg4OC41MDUsNzczLjAzNCA4ODguNDE4LDY3Ny4xMzkgODg4Ljg5NCw2NzcuMTM5Ij48L3BvbHlnb24+PHBvbHlnb24gZmlsbD0iIzAwMjk1NSIgcG9pbnRzPSIxMDU1LjAxMyw1MzguNDE4IDEwNTUuMDEzLDYyNy4zMTIgODg4LjMzMiw0NzIuODE4IDg4OC4yODksMzkwLjc1MiI+PC9wb2x5Z29uPjxwb2x5Z29uIGZpbGw9IiMwMDI5NTUiIHBvaW50cz0iMTA1NS4wMTMsMjE2LjI0OSAxMDU1LjAxMywzMjYuNDQ4IDg4OC4xNTksMTY1LjgxNyA4ODguMTE2LDUwIj48L3BvbHlnb24+PHBvbHlnb24gZmlsbD0iIzAwMjk1NSIgcG9pbnRzPSI0NjEuNTgyLDExMjIuOTQ3IDQ2MS41ODIsMTEyMy4xNjMgMzg1LjQ4LDExMjIuOTQ3IDIyMy4xMiw5NjEuMzIyIDI3MC45NTksOTYxLjQ1MiAzMTIuODM1LDk2MS41ODIiPjwvcG9seWdvbj48cG9seWdvbiBmaWxsPSIjMDAyOTU1IiBwb2ludHM9IjUzOC40NjIsOTQyLjY1MyA1NDAuNzk1LDEwMjQuNzYyIDM4MS4xMTUsODc4LjMwNiAzNzkuNjg5LDg3OC4yNjMgMzgxLjg5Myw3ODcuMTIyIDM4Mi4xMDksNzg3LjEyMiI+PC9wb2x5Z29uPjxwb2x5Z29uIGZpbGw9IiMwMDI5NTUiIHBvaW50cz0iMzg4Ljc2NCw1MDAuNTE5IDUwNy4wMDEsNzA1Ljk2NCA1MDYuOTU4LDcwNS45NjQgMzg2LjUxNyw1OTMuOTkzIj48L3BvbHlnb24+PHBvbHlnb24gZmlsbD0iIzAwMjk1NSIgcG9pbnRzPSI2NzguODI1LDQ2NC40NzcgNjc4LjQzNiw1NDQuMjk2IDU5Ny44MzksNDEyLjEgNTk4LjIyOCw0MTEuODg0IDY3Ny4xODIsNDY0LjQ3NyI+PC9wb2x5Z29uPjxwb2x5Z29uIGZpbGw9IiMwMDI5NTUiIHBvaW50cz0iNTU3LjAwMSwyMjcuNjU4IDYwOC45MDIsMzE2LjUwOCA0NzIuOTA0LDIwNy4xNzQgMzg4Ljg5NCw2OS4zNiI+PC9wb2x5Z29uPjxwb2x5Z29uIGZpbGw9IiNjYTRiYzEiIHBvaW50cz0iNzM1LjY5Niw4ODAuNzY5IDc5Ny43NTMsOTc5Ljc3NSA3NTQuNjY3LDk4My4yNzYgNjcwLjQ4NCw5OTAuMDYgNTMzLjEwMyw3NTEuMzgzIDUwNy4wMDEsNzA1Ljk2NCAzODguMjY0LDUwMC41MTkgMzg2LjUxNyw1OTMuOTkzIDM4NC41MjksNjc3LjEzOSAzODEuODkzLDc4Ny4xMjIgMzc5LjY4OSw4NzguMjYzIDM3Ny43MDEsOTYxLjc5OCAzMTIuODM1LDk2MS41ODIgMjcwLjk1OSw5NjEuNDUyIDI3MC45NTksOTYxLjA2MyAyODAuMDM1LDE1My44MDMiPjwvcG9seWdvbj48cG9seWdvbiBmaWxsPSIjY2E0YmMxIiBwb2ludHM9Ijg4OC41NDgsODgxLjExNSA4ODguNTkxLDk3Mi40MjkgODMwLjcyNiw5NzcuMDk2IDc5Ny43NTMsOTc5Ljc3NSA3MzUuNjk2LDg4MC43NjkgNzg1LjMwNyw1OS42MzcgODg4LjExNiw1MCA4ODguMTU5LDE2NS44MTcgODg4LjI0NSwyOTYuNTQzIDg4OC4yODksMzkwLjc1MiA4ODguMzMyLDQ3Mi44MTggODg4LjM3NSw1ODMuOTI0IDg4OC40MTgsNjc3LjEzOSA4ODguNTA1LDc3My4wMzQiPjwvcG9seWdvbj48cG9seWdvbiBmaWxsPSIjY2E0YmMxIiBwb2ludHM9Ijc4NS4zMDcsNTkuNjM3IDczNS42OTYsODgwLjc2OSAyODAuMDM1LDE1My44MDMgMjgwLjk0Miw3MS43MzcgMzg4Ljg5NCw2OS4zNiA0NzIuOTA0LDIwNy4xNzQgNTM2LjMwMSwzMTEuMTA2IDU5Ny44MzksNDEyLjEgNjc4LjQzNiw1NDQuMjk2IDY3OC44MjUsNDY0LjQ3NyA2NzguOTk3LDQzNi41MTcgNjgwLjg1Niw2OS40NDciPjwvcG9seWdvbj48cG9seWdvbiBmaWxsPSIjY2E0YmMxIiBwb2ludHM9IjI4MC45NDIsNzEuNzM3IDI4MC4wMzUsMTUzLjgwMyAyNzAuOTU5LDk2MS4wNjMgMjcwLjk1OSw5NjEuNDUyIDIyMy4xMiw5NjEuMzIyIDE0Ny4zMjEsOTYxLjA2MyAxNDQuOTg3LDc0Ljc2MiI+PC9wb2x5Z29uPjwvZz48L2c+PC9nPjwvc3ZnPg==";

const OG_FONT_PATH = join(process.cwd(), "public/fonts/manrope-bold.ttf");

let manropeFontPromise: Promise<ArrayBuffer> | null = null;

const loadManrope = async (): Promise<ArrayBuffer> => {
  if (!manropeFontPromise) {
    manropeFontPromise = readFile(OG_FONT_PATH).then((buffer) =>
      buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      ),
    );
  }

  return manropeFontPromise;
};

const truncateTagline = (text: string, maxLength = 90) => {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
};

const formatRuntime = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
};

const formatYearRange = (start?: string, end?: string) => {
  const startYear = start?.slice(0, 4);
  const endYear = end?.slice(0, 4);
  if (!startYear) return undefined;
  if (!endYear || startYear === endYear) return startYear;
  return `${startYear}-${endYear}`;
};

const pickTagline = (tagline?: string | null) => {
  const trimmed = tagline?.trim();
  if (!trimmed || trimmed.length < 15 || trimmed.length > 120) return undefined;
  return truncateTagline(trimmed);
};

const formatPersonHeadline = (gender?: number, department?: string) => {
  if (department === "Acting") {
    if (gender === 1) return "ACTRESS";
    return "ACTOR";
  }
  if (department === "Directing") return "DIRECTOR";
  if (department === "Production") return "PRODUCER";
  if (department === "Writing") return "WRITER";
  if (department) return department.toUpperCase();
  return undefined;
};

const joinMeta = (parts: Array<string | undefined>, max = 3) =>
  parts.filter(Boolean).slice(0, max).join(" · ");

// Satori stacks by DOM order (no z-index). Wrap backdrop + overlays in one
// positioned box, dim the image via `opacity`, then paint a flat wash on top.
const BackdropLayer = ({ url }: { url?: string | null }) => {
  if (!url) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: OG_IMAGE_SIZE.width,
        height: OG_IMAGE_SIZE.height,
        display: "flex",
        background: "#000000",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt=""
        src={url}
        style={{
          position: "absolute",
          top: -BLUR_OVERSCAN,
          left: -BLUR_OVERSCAN,
          width: OG_IMAGE_SIZE.width + BLUR_OVERSCAN * 2,
          height: OG_IMAGE_SIZE.height + BLUR_OVERSCAN * 2,
          objectFit: "cover",
          opacity: 0.38,
        }}
      />
      <OgImageDimOverlays />
    </div>
  );
};

const OgImageDimOverlays = () => (
  <div
    style={{
      position: "absolute",
      top: 0,
      left: 0,
      width: OG_IMAGE_SIZE.width,
      height: OG_IMAGE_SIZE.height,
      display: "flex",
      background: "rgba(0,0,0,0.55)",
    }}
  />
);

const EntityLabel = ({ label }: { label: string }) => (
  <div
    style={{
      display: "flex",
      color: TEXT_MUTED,
      fontSize: 13,
      fontWeight: 700,
      letterSpacing: 2.4,
      marginBottom: 10,
    }}
  >
    {label}
  </div>
);

const OgLogo = () => (
  <div
    style={{
      position: "absolute",
      top: SAFE,
      right: SAFE,
      display: "flex",
    }}
  >
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img alt="" src={LOGO_DATA_URI} width={LOGO_SIZE} height={LOGO_SIZE} />
  </div>
);

const PosterSlot = ({
  posterUrl,
  width = MEDIA_POSTER_W,
  height = MEDIA_POSTER_H,
}: {
  posterUrl?: string | null;
  width?: number;
  height?: number;
}) => (
  <div
    style={{
      display: "flex",
      flexShrink: 0,
      alignItems: "center",
      justifyContent: "center",
      width,
      height,
    }}
  >
    <div
      style={{
        display: "flex",
        width,
        height,
        borderRadius: MEDIA_POSTER_RADIUS,
        overflow: "hidden",
        background: "#141414",
        boxShadow: "0 18px 52px rgba(0,0,0,0.55)",
      }}
    >
      {posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          src={posterUrl}
          width={width}
          height={height}
          style={{ objectFit: "cover" }}
        />
      ) : (
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width,
            height,
            color: "rgba(255,255,255,0.25)",
            fontSize: 18,
          }}
        >
          No poster
        </span>
      )}
    </div>
  </div>
);

const collectionPosterOffset = (index: number, total: number) => {
  if (total <= 1) return 0;
  if (index === total - 1) return 0;
  if (index === 0) return 14;
  return 8;
};

const pickPersonCollageLayout = (count: number) => {
  if (count <= 0) return { cols: 0, rows: 0 };
  if (count === 1) return { cols: 1, rows: 1 };
  if (count <= 4) return { cols: 2, rows: 2 };
  if (count <= 6) return { cols: 3, rows: 2 };
  if (count <= 9) return { cols: 3, rows: 3 };
  if (count <= 12) return { cols: 4, rows: 3 };
  if (count <= 16) return { cols: 4, rows: 4 };
  if (count <= 20) return { cols: 5, rows: 4 };
  return { cols: 5, rows: 5 };
};

const PERSON_PORTRAIT_WIDTH = Math.round(OG_IMAGE_SIZE.width * 0.44);
const PERSON_COLLAGE_WIDTH = OG_IMAGE_SIZE.width - PERSON_PORTRAIT_WIDTH;
const PERSON_COLLAGE_HEIGHT = OG_IMAGE_SIZE.height;

const distributeSize = (total: number, count: number) => {
  const base = Math.floor(total / count);
  const remainder = total % count;

  return Array.from(
    { length: count },
    (_, index) => base + (index < remainder ? 1 : 0),
  );
};

const buildAxisOffsets = (sizes: number[]) => {
  const offsets = [0];

  for (let index = 1; index < sizes.length; index += 1) {
    offsets.push(offsets[index - 1] + sizes[index - 1]);
  }

  return offsets;
};

const PersonFilmCollage = ({
  urls,
  width,
  height,
  imageOpacity = 1,
}: {
  urls: string[];
  width: number;
  height: number;
  imageOpacity?: number;
}) => {
  if (!urls.length) return null;

  const { cols, rows } = pickPersonCollageLayout(urls.length);
  const colWidths = distributeSize(width, cols);
  const rowHeights = distributeSize(height, rows);
  const colOffsets = buildAxisOffsets(colWidths);
  const rowOffsets = buildAxisOffsets(rowHeights);
  const posters = urls.slice(0, cols * rows);

  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        display: "flex",
        overflow: "hidden",
        background: "#141414",
      }}
    >
      {posters.map((url, index) => {
        const row = Math.floor(index / cols);
        const col = index % cols;
        const cellWidth = colWidths[col];
        const cellHeight = rowHeights[row];

        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${url}-${index}`}
            alt=""
            src={url}
            width={cellWidth + COLLAGE_CELL_BLEED}
            height={cellHeight + COLLAGE_CELL_BLEED}
            style={{
              position: "absolute",
              left: colOffsets[col],
              top: rowOffsets[row],
              width: cellWidth + COLLAGE_CELL_BLEED,
              height: cellHeight + COLLAGE_CELL_BLEED,
              objectFit: "cover",
              opacity: imageOpacity,
            }}
          />
        );
      })}
    </div>
  );
};

const COLLAGE_CELL_BLEED = 2;

const PersonFilmCollageBackground = ({ urls }: { urls: string[] }) => {
  if (!urls.length) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: PERSON_COLLAGE_WIDTH,
        height: PERSON_COLLAGE_HEIGHT,
        display: "flex",
        overflow: "hidden",
        background: "#000000",
      }}
    >
      <PersonFilmCollage
        urls={urls}
        width={PERSON_COLLAGE_WIDTH}
        height={PERSON_COLLAGE_HEIGHT}
        imageOpacity={0.38}
      />
    </div>
  );
};

const OverlappingPosters = ({ urls }: { urls: Array<string | null> }) => {
  const posters = urls.filter(Boolean).slice(0, 3) as string[];
  const stackWidth =
    posters.length === 0
      ? COLLECTION_POSTER_W
      : COLLECTION_POSTER_W +
        (posters.length - 1) *
          (COLLECTION_POSTER_W - COLLECTION_POSTER_OVERLAP);

  return (
    <div
      style={{
        display: "flex",
        flexShrink: 0,
        alignItems: "center",
        justifyContent: "center",
        width: stackWidth,
        height: COLLECTION_POSTER_H + 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          height: COLLECTION_POSTER_H + 16,
          width: stackWidth,
        }}
      >
        {posters.map((url, index) => (
          <div
            key={`${url}-${index}`}
            style={{
              display: "flex",
              marginLeft: index === 0 ? 0 : -COLLECTION_POSTER_OVERLAP,
              marginTop: collectionPosterOffset(index, posters.length),
            }}
          >
            <div
              style={{
                display: "flex",
                width: COLLECTION_POSTER_W,
                height: COLLECTION_POSTER_H,
                borderRadius: COLLECTION_POSTER_RADIUS,
                overflow: "hidden",
                background: "#141414",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt=""
                src={url}
                width={COLLECTION_POSTER_W}
                height={COLLECTION_POSTER_H}
                style={{ objectFit: "cover" }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const MediaTextColumn = ({
  label,
  title,
  metaLine,
  tagline,
  rating,
}: Pick<
  MediaOgImageProps,
  "label" | "title" | "metaLine" | "tagline" | "rating"
>) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      flex: 1,
      minWidth: 0,
      paddingRight: 12,
    }}
  >
    <EntityLabel label={label} />
    <div
      style={{
        display: "flex",
        color: TEXT_PRIMARY,
        fontSize: 58,
        fontWeight: 800,
        lineHeight: 1.04,
        letterSpacing: -1.1,
        marginBottom: 16,
        textShadow: TEXT_SHADOW,
      }}
    >
      {title}
    </div>
    {metaLine ? (
      <div
        style={{
          display: "flex",
          color: TEXT_MUTED,
          fontSize: 23,
          lineHeight: 1.35,
          marginBottom: rating !== undefined || tagline ? 18 : 0,
        }}
      >
        {metaLine}
      </div>
    ) : null}
    {rating !== undefined ? (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: tagline ? 14 : 0,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill={RATING_ACCENT}>
          <polygon points="12,2 15,9 22,9 17,14 19,22 12,17 5,22 7,14 2,9 9,9" />
        </svg>
        <span
          style={{
            display: "flex",
            color: RATING_ACCENT,
            fontSize: 26,
            fontWeight: 700,
          }}
        >
          {rating.toFixed(1)}
        </span>
      </div>
    ) : null}
    {tagline ? (
      <div
        style={{
          display: "flex",
          color: "rgba(245,245,245,0.82)",
          fontSize: 26,
          lineHeight: 1.35,
          fontStyle: "italic",
          textShadow: TEXT_SHADOW,
        }}
      >
        {tagline}
      </div>
    ) : null}
  </div>
);

export const MediaOgImage = ({
  label,
  title,
  metaLine,
  tagline,
  rating,
  posterUrl,
  backdropUrl,
}: MediaOgImageProps) => (
  <div
    style={{
      width: "100%",
      height: "100%",
      display: "flex",
      position: "relative",
      background: BG,
      fontFamily: "Manrope",
    }}
  >
    <BackdropLayer url={backdropUrl} />
    <div
      style={{
        position: "relative",
        display: "flex",
        width: "100%",
        height: "100%",
        padding: MEDIA_CONTENT_PADDING,
        alignItems: "center",
        gap: 52,
      }}
    >
      <PosterSlot posterUrl={posterUrl} />
      <MediaTextColumn
        label={label}
        title={title}
        metaLine={metaLine}
        tagline={tagline}
        rating={rating}
      />
    </div>
    <OgLogo />
  </div>
);

export const PersonOgImage = ({
  name,
  headline,
  knownForTitles,
  profileUrl,
  filmPosterUrls = [],
}: PersonOgImageProps) => {
  const portraitWidth = PERSON_PORTRAIT_WIDTH;
  const hasCollage = filmPosterUrls.length > 0;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        background: BG,
        fontFamily: "Manrope",
      }}
    >
      {hasCollage ? (
        <>
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: OG_IMAGE_SIZE.width,
              height: OG_IMAGE_SIZE.height,
              display: "flex",
            }}
          >
            <div
              style={{
                width: portraitWidth,
                height: "100%",
                flexShrink: 0,
              }}
            />
            <div
              style={{
                display: "flex",
                flex: 1,
                position: "relative",
                overflow: "hidden",
                background: "#141414",
              }}
            >
              <PersonFilmCollageBackground urls={filmPosterUrls} />
            </div>
          </div>
          <OgImageDimOverlays />
        </>
      ) : null}
      {profileUrl ? (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: portraitWidth,
            height: OG_IMAGE_SIZE.height,
            display: "flex",
            overflow: "hidden",
            background: "#141414",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt=""
            src={profileUrl}
            width={portraitWidth}
            height={OG_IMAGE_SIZE.height}
            style={{ objectFit: "cover", objectPosition: "top center" }}
          />
        </div>
      ) : null}
      <div
        style={{
          display: "flex",
          flex: 1,
          width: "100%",
          position: "relative",
        }}
      >
        <div
          style={{
            width: portraitWidth,
            flexShrink: 0,
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
            padding: `${SAFE}px ${SAFE}px ${SAFE}px 40px`,
          }}
        >
          {headline ? <EntityLabel label={headline} /> : null}
          <div
            style={{
              display: "flex",
              color: TEXT_PRIMARY,
              fontSize: 56,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -1,
              marginBottom: knownForTitles?.length ? 28 : 0,
              textShadow: TEXT_SHADOW,
            }}
          >
            {name}
          </div>
          {knownForTitles && knownForTitles.length > 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  display: "flex",
                  color: TEXT_MUTED,
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: 2,
                  marginBottom: 10,
                }}
              >
                KNOWN FOR
              </div>
              <div
                style={{
                  display: "flex",
                  color: "rgba(255,255,255,0.88)",
                  fontSize: 22,
                  lineHeight: 1.4,
                  textShadow: TEXT_SHADOW,
                }}
              >
                {knownForTitles.join(" · ")}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <OgLogo />
    </div>
  );
};

export const CollectionOgImage = ({
  title,
  metaLine,
  posterUrls = [],
  backdropUrl,
}: CollectionOgImageProps) => (
  <div
    style={{
      width: "100%",
      height: "100%",
      display: "flex",
      position: "relative",
      background: BG,
      fontFamily: "Manrope",
    }}
  >
    <BackdropLayer url={backdropUrl} />
    <div
      style={{
        position: "relative",
        display: "flex",
        width: "100%",
        height: "100%",
        padding: MEDIA_CONTENT_PADDING,
        alignItems: "center",
        gap: 52,
      }}
    >
      <OverlappingPosters urls={posterUrls} />
      <MediaTextColumn label="COLLECTION" title={title} metaLine={metaLine} />
    </div>
    <OgLogo />
  </div>
);

const SITE_POSTER_W = 184;
const SITE_POSTER_H = 276;
const SITE_POSTER_RADIUS = 16;
const SITE_LOGO_SIZE = 45;
const SITE_TITLE_SIZE = 43;
const SITE_HEADLINE_SIZE = 55;
const SITE_FAN_STEP = 140;
const SITE_FAN_TILTS = [-2, -1, 0, 1, 2];
const SITE_FAN_LIFTS = [6, 3, 0, 3, 6];

const SiteBannerBackground = ({ url }: { url: string }) => (
  <div
    style={{
      position: "absolute",
      top: 0,
      left: 0,
      width: OG_IMAGE_SIZE.width,
      height: OG_IMAGE_SIZE.height,
      display: "flex",
      background: BG,
    }}
  >
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      alt=""
      src={url}
      width={OG_IMAGE_SIZE.width}
      height={OG_IMAGE_SIZE.height}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: OG_IMAGE_SIZE.width,
        height: OG_IMAGE_SIZE.height,
        objectFit: "cover",
        objectPosition: "center top",
      }}
    />
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: OG_IMAGE_SIZE.width,
        height: OG_IMAGE_SIZE.height,
        display: "flex",
        background: "rgba(0,0,0,0.78)",
      }}
    />
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: OG_IMAGE_SIZE.width,
        height: OG_IMAGE_SIZE.height,
        display: "flex",
        background:
          "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.12) 50%, rgba(0,0,0,0.3) 100%)",
      }}
    />
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: OG_IMAGE_SIZE.width,
        height: OG_IMAGE_SIZE.height,
        display: "flex",
        background:
          "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.35) 100%)",
      }}
    />
  </div>
);

const SitePosterGlow = () => (
  <div
    style={{
      position: "absolute",
      bottom: -260,
      left: "50%",
      marginLeft: -440,
      width: 880,
      height: 720,
      display: "flex",
      background:
        "radial-gradient(ellipse at 50% 50%, rgba(36,100,240,0.32) 0%, rgba(124,58,237,0.16) 42%, rgba(10,10,10,0) 76%)",
    }}
  />
);

const sitePosterFanLayout = (
  index: number,
  { active = false }: { active?: boolean } = {},
) => ({
  display: "flex" as const,
  marginLeft: index === 0 ? 0 : -(SITE_POSTER_W - SITE_FAN_STEP),
  marginTop: SITE_FAN_LIFTS[index],
  transform: `rotate(${SITE_FAN_TILTS[index]}deg)`,
  zIndex: active ? 10 : index,
});

const SitePosterShadow = ({
  index,
  active = false,
}: {
  index: number;
  active?: boolean;
}) => (
  <div style={sitePosterFanLayout(index)}>
    <div
      style={{
        position: "relative",
        display: "flex",
        width: SITE_POSTER_W,
        height: SITE_POSTER_H,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: SITE_POSTER_H - 2,
          left: "6%",
          width: "88%",
          height: active ? 38 : 30,
          display: "flex",
          background: active
            ? "radial-gradient(ellipse 100% 100% at 50% 0%, rgba(0,0,0,0.5) 0%, transparent 72%)"
            : "radial-gradient(ellipse 100% 100% at 50% 0%, rgba(0,0,0,0.38) 0%, transparent 72%)",
        }}
      />
    </div>
  </div>
);

const SitePosterCard = ({
  url,
  index,
  active = false,
}: {
  url: string;
  index: number;
  active?: boolean;
}) => (
  <div style={sitePosterFanLayout(index, { active })}>
    <div
      style={{
        display: "flex",
        width: SITE_POSTER_W,
        height: SITE_POSTER_H,
        borderRadius: SITE_POSTER_RADIUS,
        overflow: "hidden",
        background: "#101010",
        border: active
          ? "1px solid rgba(255,255,255,0.1)"
          : "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt=""
        src={url}
        width={SITE_POSTER_W}
        height={SITE_POSTER_H}
        style={{ objectFit: "cover" }}
      />
    </div>
  </div>
);

const SitePosterFan = ({ urls }: { urls: string[] }) => {
  const posters = urls
    .filter((url) => Boolean(url))
    .slice(0, SITE_FAN_TILTS.length);
  const centerIndex = Math.floor(posters.length / 2);

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginTop: 10,
        marginLeft: SITE_POSTER_W - SITE_FAN_STEP,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {posters.map((url, index) => (
          <SitePosterShadow
            key={`shadow-${url}-${index}`}
            index={index}
            active={index === centerIndex}
          />
        ))}
      </div>
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {posters.map((url, index) => (
          <SitePosterCard
            key={`${url}-${index}`}
            url={url}
            index={index}
            active={index === centerIndex}
          />
        ))}
      </div>
    </div>
  );
};

export const SiteOgImage = ({
  title,
  headline,
  posterUrls,
  bannerUrl,
}: {
  title: string;
  headline: string;
  posterUrls: string[];
  bannerUrl: string;
}) => (
  <div
    style={{
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      position: "relative",
      background: BG,
      fontFamily: "Manrope",
    }}
  >
    <SiteBannerBackground url={bannerUrl} />
    <SitePosterGlow />
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        width: "100%",
        height: "100%",
        padding: `100px ${SAFE}px 48px`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 32,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          src={LOGO_DATA_URI}
          width={SITE_LOGO_SIZE}
          height={SITE_LOGO_SIZE}
        />
        <div
          style={{
            display: "flex",
            color: TEXT_PRIMARY,
            fontSize: SITE_TITLE_SIZE,
            fontWeight: 800,
            letterSpacing: -1.2,
            lineHeight: 1,
            textShadow: TEXT_SHADOW,
          }}
        >
          {title}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          color: TEXT_PRIMARY,
          fontSize: SITE_HEADLINE_SIZE,
          fontWeight: 800,
          lineHeight: 1,
          letterSpacing: -2,
          textAlign: "center",
          textShadow: TEXT_SHADOW,
          marginBottom: 24,
        }}
      >
        {headline}
      </div>
      <SitePosterFan urls={posterUrls} />
    </div>
  </div>
);

export const DefaultOgImage = ({
  title,
  description,
}: {
  title: string;
  description?: string;
}) => (
  <div
    style={{
      width: "100%",
      height: "100%",
      display: "flex",
      position: "relative",
      background: BG,
      fontFamily: "Manrope",
      padding: `${SAFE}px`,
    }}
  >
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        flex: 1,
      }}
    >
      <div
        style={{
          color: TEXT_PRIMARY,
          fontSize: 64,
          fontWeight: 800,
          lineHeight: 1.05,
          letterSpacing: -1.2,
          marginBottom: description ? 16 : 0,
          textShadow: TEXT_SHADOW,
        }}
      >
        {title}
      </div>
      {description ? (
        <div
          style={{
            color: TEXT_MUTED,
            fontSize: 26,
            lineHeight: 1.4,
          }}
        >
          {description}
        </div>
      ) : null}
    </div>
    <OgLogo />
  </div>
);

export async function createOgImageResponse(element: ReactElement) {
  const fontData = await loadManrope();

  return new ImageResponse(element, {
    ...OG_IMAGE_SIZE,
    fonts: [
      {
        name: "Manrope",
        data: fontData,
        style: "normal",
        weight: 700,
      },
    ],
  });
}

// TMDB TV genres: News, Reality, Talk — skip for person "known for" picks.
const EXCLUDED_KNOWN_FOR_TV_GENRE_IDS = new Set([10763, 10764, 10767]);

const TALK_SHOW_TITLE_PATTERN =
  /\b(daily show|late night|late show|tonight show|tonight with|last week tonight|real time with|watch what happens|after party|after show|talk show)\b/i;

const getCreditTitle = (credit: {
  title?: string;
  name?: string;
  media_type?: string;
}) =>
  credit.media_type === "movie"
    ? credit.title
    : credit.media_type === "tv"
      ? credit.name
      : credit.title || credit.name;

const isExcludedKnownForCredit = (credit: {
  media_type?: string;
  genre_ids?: number[];
  title?: string;
  name?: string;
}) => {
  if (credit.media_type !== "tv") return false;

  if (
    credit.genre_ids?.some((genreId) =>
      EXCLUDED_KNOWN_FOR_TV_GENRE_IDS.has(genreId),
    )
  ) {
    return true;
  }

  const title = getCreditTitle(credit);
  return title ? TALK_SHOW_TITLE_PATTERN.test(title) : false;
};

const dedupePersonCastCredits = <
  T extends {
    title?: string;
    name?: string;
    media_type?: string;
    popularity?: number;
  },
>(
  cast: T[],
) => {
  const sorted = [...cast]
    .filter((credit) => !isExcludedKnownForCredit(credit))
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));

  const seen = new Set<string>();
  const deduped: T[] = [];

  for (const credit of sorted) {
    const title = getCreditTitle(credit);
    if (!title || seen.has(title)) continue;
    seen.add(title);
    deduped.push(credit);
  }

  return deduped;
};

const fetchPersonCastCredits = async (personId: number) => {
  const credits = await tmdb.person
    .combinedCredits({ id: String(personId) })
    .catch(() => null);
  if (!credits?.cast?.length) return [];
  return dedupePersonCastCredits(credits.cast);
};

export const getPersonKnownForTitles = async (
  personId: number,
  limit = 3,
): Promise<string[]> => {
  const credits = await fetchPersonCastCredits(personId);

  return credits
    .slice(0, limit)
    .map((credit) => getCreditTitle(credit))
    .filter((title): title is string => Boolean(title));
};

const getPersonFilmPosterUrls = (
  credits: Array<{ poster_path?: string | null }>,
) => {
  const posterCredits = credits.filter((credit) => credit.poster_path);
  if (!posterCredits.length) return [];

  const { cols, rows } = pickPersonCollageLayout(posterCredits.length);
  const max = cols * rows;

  return posterCredits
    .slice(0, max)
    .map((credit) => tmdbImageUrl(credit.poster_path, "w342"))
    .filter((url): url is string => Boolean(url));
};

export const getMediaOgImageProps = (
  media: {
    title?: string;
    name?: string;
    poster_path?: string | null;
    backdrop_path?: string | null;
    vote_average?: number;
    release_date?: string;
    first_air_date?: string;
    last_air_date?: string;
    runtime?: number;
    tagline?: string;
    number_of_seasons?: number;
    genres?: Array<{ name: string }>;
  },
  mediaType: "movie" | "tv",
): MediaOgImageProps => {
  const title =
    mediaType === "tv" ? media.name || "TV Show" : media.title || "Movie";
  const primaryGenre = media.genres?.[0]?.name;

  const metaLine =
    mediaType === "movie"
      ? joinMeta([
          media.release_date?.slice(0, 4),
          media.runtime ? formatRuntime(media.runtime) : undefined,
          primaryGenre,
        ])
      : joinMeta([
          formatYearRange(media.first_air_date, media.last_air_date),
          media.number_of_seasons
            ? `${media.number_of_seasons} season${media.number_of_seasons === 1 ? "" : "s"}`
            : undefined,
          primaryGenre,
        ]);

  return {
    label: mediaType === "movie" ? "FILM" : "SERIES",
    title,
    metaLine: metaLine || undefined,
    tagline: pickTagline(media.tagline),
    rating: media.vote_average,
    posterUrl: tmdbImageUrl(media.poster_path, "w780"),
    backdropUrl: tmdbImageUrl(media.backdrop_path, "w1280"),
  };
};

export const getPersonOgImageProps = async (
  person: Pick<
    PersonDetails,
    "id" | "name" | "gender" | "known_for_department" | "profile_path"
  >,
): Promise<PersonOgImageProps> => {
  const credits = await fetchPersonCastCredits(person.id);
  const knownForTitles = credits
    .slice(0, 3)
    .map((credit) => getCreditTitle(credit))
    .filter((title): title is string => Boolean(title));

  return {
    name: person.name || "Unknown",
    headline: formatPersonHeadline(person.gender, person.known_for_department),
    knownForTitles,
    profileUrl: tmdbImageUrl(person.profile_path, "w500"),
    filmPosterUrls: getPersonFilmPosterUrls(credits),
  };
};

export const getCollectionOgImageProps = (collection: {
  name: string;
  backdrop_path?: string | null;
  parts: Array<{
    poster_path?: string | null;
    backdrop_path?: string | null;
    release_date?: string;
  }>;
}): CollectionOgImageProps => {
  const years = collection.parts
    .map((part) => part.release_date?.slice(0, 4))
    .filter(Boolean)
    .map(Number);
  const yearRange =
    years.length > 0
      ? `${Math.min(...years)}-${Math.max(...years)}`
      : undefined;
  const countLabel = `${collection.parts.length} film${collection.parts.length === 1 ? "" : "s"}`;

  return {
    title: collection.name,
    metaLine: joinMeta([countLabel, yearRange], 2),
    posterUrls: collection.parts
      .slice(0, 3)
      .map((part) => tmdbImageUrl(part.poster_path, "w500")),
    backdropUrl: tmdbImageUrl(
      collection.backdrop_path || collection.parts[0]?.backdrop_path,
      "w1280",
    ),
  };
};
