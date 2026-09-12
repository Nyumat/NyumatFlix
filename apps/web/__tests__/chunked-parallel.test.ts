import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { firstNonNull, runInChunks } from "@/lib/server/chunked-parallel";

describe("runInChunks", () => {
  it("preserves input order across chunks", async () => {
    const results = await runInChunks(
      [1, 2, 3, 4, 5],
      async (item) => item * 10,
      2,
    );

    expect(results).toEqual([10, 20, 30, 40, 50]);
  });
});

describe("firstNonNull", () => {
  it("stops after the first resolved value", async () => {
    const worker = vi.fn(async (item: number) =>
      item === 2 ? `hit-${item}` : null,
    );

    await expect(firstNonNull([1, 2, 3], worker)).resolves.toBe("hit-2");
    expect(worker).toHaveBeenCalledTimes(2);
  });

  it("returns null when every worker misses", async () => {
    await expect(firstNonNull([1, 2], async () => null)).resolves.toBeNull();
  });
});
