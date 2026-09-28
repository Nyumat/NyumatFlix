import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = {
  id: number;
  userId: string;
  mediaType: string;
  contentId: number;
  seasonNumber: number;
  episodeNumber: number;
  watchedSeconds: number;
  durationSeconds: number;
  updatedAt: Date;
};

const tableProxy = (name: string): Record<PropertyKey, unknown> =>
  new Proxy({}, { get: (_target, prop) => `${name}.${String(prop)}` });

vi.mock("@/db", () => ({
  get db() {
    return globalThis.__testDb;
  },
  playbackProgress: tableProxy("playbackProgress"),
  watchlist: tableProxy("watchlist"),
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    and: (...args: unknown[]) => args,
    eq: (column: unknown, value: unknown) => ({ column, value }),
  };
});

const upsert = async (watched: number, updatedAtMs: number): Promise<void> => {
  const { upsertUserPlaybackProgress } = await import(
    "@/lib/server/playback-progress"
  );
  await upsertUserPlaybackProgress(
    "u1",
    { mediaType: "movie", contentId: 27205 },
    { watched, duration: 1000 },
    { updatedAt: updatedAtMs },
  );
};

describe("server playback progress merge", () => {
  let table: Row[];

  beforeEach(() => {
    table = [
      {
        id: 1,
        userId: "u1",
        mediaType: "movie",
        contentId: 27205,
        seasonNumber: 0,
        episodeNumber: 0,
        watchedSeconds: 640,
        durationSeconds: 1000,
        updatedAt: new Date(5_000),
      },
    ];
    let nextId = 2;
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: (n: number) => table.slice(0, n),
          }),
        }),
      }),
      insert: () => ({
        values: (values: Omit<Row, "id">) => {
          table.push({ ...values, id: nextId++ });
        },
      }),
      update: () => ({
        set: (values: Partial<Row>) => ({
          where: (condition: { value?: number }) => {
            const target = table.find((row) => row.id === condition?.value);
            if (target) {
              Object.assign(target, values);
            }
          },
        }),
      }),
      transaction: async (fn: (tx: typeof db) => Promise<void>) => fn(db),
    };
    (globalThis as { __testDb?: unknown }).__testDb = db;
    vi.resetModules();
  });

  const state = () => ({
    watched: table[0]?.watchedSeconds,
    updatedAt: table[0]?.updatedAt.getTime(),
  });

  it("accepts an advancing write", async () => {
    await upsert(900, 9_000);
    expect(state()).toEqual({ watched: 900, updatedAt: 9_000 });
  });

  it("rejects a stale write that would rewind progress", async () => {
    await upsert(300, 4_000);
    expect(state()).toEqual({ watched: 640, updatedAt: 5_000 });
  });

  it("keeps the higher watched position when writes race", async () => {
    await upsert(620, 9_000);
    expect(state()).toEqual({ watched: 640, updatedAt: 9_000 });
  });

  it("allows a deliberate large rewind", async () => {
    await upsert(100, 9_000);
    expect(state()).toEqual({ watched: 100, updatedAt: 9_000 });
  });

  it("leaves the row untouched when the write changes nothing", async () => {
    await upsert(640, 5_000);
    expect(state()).toEqual({ watched: 640, updatedAt: 5_000 });
  });
});
