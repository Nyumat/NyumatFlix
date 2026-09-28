export type ScrapeStage =
  | "metadata"
  | "mirrors"
  | "servers"
  | "validation"
  | "provider"
  | "response";

export type ScrapeStageTimer = {
  record: (stage: ScrapeStage, durationMs: number) => void;
  time: <T>(stage: ScrapeStage, work: () => Promise<T>) => Promise<T>;
  since: (stage: ScrapeStage, startedAt: number) => void;
  durations: () => Partial<Record<ScrapeStage, number>>;
  serverTimingHeader: () => string;
  log: (meta: { providerId: string; mediaKind: string; ok: boolean }) => void;
};

const roundMs = (value: number): number => Math.round(value * 10) / 10;

const shouldLogScrapeTimings = (): boolean =>
  process.env.SCRAPE_TIMING_LOG === "1" ||
  (process.env.NODE_ENV === "development" &&
    process.env.SCRAPE_TIMING_LOG !== "0");

export const scrapeNow = (): number =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

/** stage names and durations only — never stream urls, referers, or tokens. */
export const createScrapeStageTimer = (): ScrapeStageTimer => {
  const totals = new Map<ScrapeStage, number>();

  const record = (stage: ScrapeStage, durationMs: number) => {
    totals.set(stage, (totals.get(stage) ?? 0) + Math.max(0, durationMs));
  };

  const since = (stage: ScrapeStage, startedAt: number) => {
    record(stage, scrapeNow() - startedAt);
  };

  const time = async <T>(
    stage: ScrapeStage,
    work: () => Promise<T>,
  ): Promise<T> => {
    const startedAt = scrapeNow();
    try {
      return await work();
    } finally {
      since(stage, startedAt);
    }
  };

  const durations = () =>
    Object.fromEntries(
      [...totals.entries()].map(([stage, value]) => [stage, roundMs(value)]),
    ) as Partial<Record<ScrapeStage, number>>;

  const serverTimingHeader = () =>
    [...totals.entries()]
      .map(([stage, value]) => `${stage};dur=${roundMs(value)}`)
      .join(", ");

  const log = (meta: {
    providerId: string;
    mediaKind: string;
    ok: boolean;
  }) => {
    if (!shouldLogScrapeTimings()) {
      return;
    }
    console.info(
      "[scrape-timing]",
      JSON.stringify({ ...meta, stages: durations() }),
    );
  };

  return { record, time, since, durations, serverTimingHeader, log };
};
