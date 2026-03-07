"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  getRatingCategory,
  getRatingColor,
  SeasonRatings,
  TimelineMode,
} from "./types";

type TimelineViewProps = {
  seasons: SeasonRatings[];
  mode: TimelineMode;
  showTrendline: boolean;
};

export function TimelineView({
  seasons,
  mode,
  showTrendline,
}: TimelineViewProps) {
  if (seasons.length === 0) return null;

  if (mode === "seasons") {
    return <SeasonTimeline seasons={seasons} showTrendline={showTrendline} />;
  }

  return <EpisodeTimeline seasons={seasons} showTrendline={showTrendline} />;
}

type DataPoint = {
  x: number;
  y: number;
  rating: number;
  label: string;
  name: string;
  seasonNumber: number;
  episodeNumber?: number;
};

function EpisodeTimeline({
  seasons,
  showTrendline,
}: {
  seasons: SeasonRatings[];
  showTrendline: boolean;
}) {
  const allEpisodes = seasons.flatMap((season) =>
    season.episodes.map((ep) => ({
      ...ep,
      seasonNumber: season.seasonNumber,
    })),
  );

  if (allEpisodes.length === 0) return null;

  const minRating = 5;
  const maxRating = 10;
  const width = Math.max(600, allEpisodes.length * 25);
  const height = 280;
  const padding = { top: 30, right: 30, bottom: 50, left: 40 };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const dataPoints: DataPoint[] = allEpisodes.map((ep, index) => ({
    x: padding.left + (index / (allEpisodes.length - 1 || 1)) * chartWidth,
    y:
      padding.top +
      chartHeight -
      ((Math.min(Math.max(ep.rating, minRating), maxRating) - minRating) /
        (maxRating - minRating)) *
        chartHeight,
    rating: ep.rating,
    label: `S${ep.seasonNumber} E${ep.episodeNumber}`,
    name: ep.name,
    seasonNumber: ep.seasonNumber,
    episodeNumber: ep.episodeNumber,
  }));

  const seasonBreaks = getSeasonBreakIndices(seasons);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="min-w-full"
        style={{ minWidth: width }}
      >
        <YAxis
          height={height}
          padding={padding}
          minRating={minRating}
          maxRating={maxRating}
        />

        {showTrendline && <Trendline points={dataPoints} />}

        <DataLine points={dataPoints} />

        {dataPoints.map((point, index) => (
          <DataPointDot key={index} point={point} />
        ))}

        <SeasonLabels
          seasons={seasons}
          seasonBreaks={seasonBreaks}
          height={height}
          padding={padding}
          totalEpisodes={allEpisodes.length}
          chartWidth={chartWidth}
        />
      </svg>
    </div>
  );
}

function SeasonTimeline({
  seasons,
  showTrendline,
}: {
  seasons: SeasonRatings[];
  showTrendline: boolean;
}) {
  if (seasons.length === 0) return null;

  const minRating = 5;
  const maxRating = 10;
  const width = Math.max(400, seasons.length * 80);
  const height = 280;
  const padding = { top: 30, right: 30, bottom: 50, left: 40 };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const dataPoints: DataPoint[] = seasons.map((season, index) => ({
    x: padding.left + (index / (seasons.length - 1 || 1)) * chartWidth,
    y:
      padding.top +
      chartHeight -
      ((Math.min(Math.max(season.average, minRating), maxRating) - minRating) /
        (maxRating - minRating)) *
        chartHeight,
    rating: season.average,
    label: `S${season.seasonNumber}`,
    name: season.seasonName,
    seasonNumber: season.seasonNumber,
  }));

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="min-w-full"
        style={{ minWidth: width }}
      >
        <YAxis
          height={height}
          padding={padding}
          minRating={minRating}
          maxRating={maxRating}
        />

        {showTrendline && <Trendline points={dataPoints} />}

        <DataLine points={dataPoints} />

        {dataPoints.map((point, index) => (
          <SeasonDataPoint key={index} point={point} />
        ))}

        {dataPoints.map((point, index) => (
          <text
            key={`label-${index}`}
            x={point.x}
            y={height - 15}
            textAnchor="middle"
            className="fill-muted-foreground text-xs"
          >
            S{point.seasonNumber}
          </text>
        ))}
      </svg>
    </div>
  );
}

function YAxis({
  height,
  padding,
  minRating,
  maxRating,
}: {
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
  minRating: number;
  maxRating: number;
}) {
  const chartHeight = height - padding.top - padding.bottom;
  const ticks = [5, 6, 7, 8, 9, 10];

  return (
    <g>
      {ticks.map((tick) => {
        const y =
          padding.top +
          chartHeight -
          ((tick - minRating) / (maxRating - minRating)) * chartHeight;
        return (
          <g key={tick}>
            <line
              x1={padding.left - 5}
              x2={padding.left}
              y1={y}
              y2={y}
              className="stroke-muted-foreground/30"
            />
            <text
              x={padding.left - 10}
              y={y}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-muted-foreground text-xs"
            >
              {tick}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function DataLine({ points }: { points: DataPoint[] }) {
  if (points.length < 2) return null;

  const pathD = points
    .map((point, i) => `${i === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  return (
    <path
      d={pathD}
      fill="none"
      className="stroke-muted-foreground/50"
      strokeWidth={2}
    />
  );
}

function Trendline({ points }: { points: DataPoint[] }) {
  if (points.length < 4) return null;

  const smoothedPoints = computeMovingAverage(points, 3);
  const pathD = generateSmoothPath(smoothedPoints);

  return (
    <path
      d={pathD}
      fill="none"
      className="stroke-muted-foreground/70"
      strokeWidth={2.5}
    />
  );
}

function computeMovingAverage(
  points: DataPoint[],
  windowSize: number,
): DataPoint[] {
  return points.map((point, index) => {
    const start = Math.max(0, index - Math.floor(windowSize / 2));
    const end = Math.min(points.length, index + Math.ceil(windowSize / 2));
    const window = points.slice(start, end);
    const avgY = window.reduce((sum, p) => sum + p.y, 0) / window.length;
    return { ...point, y: avgY };
  });
}

function generateSmoothPath(points: DataPoint[]): string {
  if (points.length < 2) return "";

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev.x + curr.x) / 2;
    path += ` Q ${cpx} ${prev.y} ${cpx} ${(prev.y + curr.y) / 2}`;
    path += ` Q ${cpx} ${curr.y} ${curr.x} ${curr.y}`;
  }

  return path;
}

function DataPointDot({ point }: { point: DataPoint }) {
  const color = getRatingColor(point.rating);
  const category = getRatingCategory(point.rating);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <g style={{ cursor: "pointer" }}>
          <circle
            cx={point.x}
            cy={point.y}
            r={6}
            fill={color}
            className="transition-transform hover:scale-125"
          />
        </g>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-1">
          <p className="font-medium">{point.name}</p>
          <p className="text-xs text-muted-foreground">{point.label}</p>
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-sm font-semibold">
              {point.rating.toFixed(1)}
            </span>
            <span className="text-xs text-muted-foreground capitalize">
              ({category})
            </span>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function SeasonDataPoint({ point }: { point: DataPoint }) {
  const color = getRatingColor(point.rating);
  const category = getRatingCategory(point.rating);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <g style={{ cursor: "pointer" }}>
          <circle
            cx={point.x}
            cy={point.y}
            r={8}
            fill={color}
            className="transition-transform hover:scale-125"
          />
          <text
            x={point.x}
            y={point.y - 15}
            textAnchor="middle"
            className="fill-foreground text-xs font-medium italic"
          >
            {point.rating.toFixed(1)}
          </text>
        </g>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-1">
          <p className="font-medium">{point.name}</p>
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-sm font-semibold">
              {point.rating.toFixed(1)}
            </span>
            <span className="text-xs text-muted-foreground capitalize">
              ({category})
            </span>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function getSeasonBreakIndices(seasons: SeasonRatings[]): number[] {
  const breaks: number[] = [];
  let cumulative = 0;

  seasons.forEach((season, index) => {
    if (index > 0) {
      breaks.push(cumulative);
    }
    cumulative += season.episodes.length;
  });

  return breaks;
}

function SeasonLabels({
  seasons,
  seasonBreaks,
  height,
  padding,
  totalEpisodes,
  chartWidth,
}: {
  seasons: SeasonRatings[];
  seasonBreaks: number[];
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
  totalEpisodes: number;
  chartWidth: number;
}) {
  let cumulative = 0;

  return (
    <g>
      {seasons.map((season, index) => {
        const startIndex = cumulative;
        const endIndex = cumulative + season.episodes.length - 1;
        cumulative += season.episodes.length;

        const startX =
          padding.left + (startIndex / (totalEpisodes - 1 || 1)) * chartWidth;
        const endX =
          padding.left + (endIndex / (totalEpisodes - 1 || 1)) * chartWidth;
        const centerX = (startX + endX) / 2;

        return (
          <text
            key={season.seasonNumber}
            x={centerX}
            y={height - 15}
            textAnchor="middle"
            className="fill-muted-foreground text-xs"
          >
            S{season.seasonNumber}
          </text>
        );
      })}
    </g>
  );
}
