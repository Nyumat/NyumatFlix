import { describe, expect, it } from "vitest";

import { firstOkInBatches, raceFirstOk } from "@/lib/scrape/race-first";

describe("raceFirstOk", () => {
  it("returns the first successful probe without waiting for slower failures", async () => {
    const started = Date.now();
    const winner = await raceFirstOk(["slow-fail", "fast-ok"], async (id) => {
      if (id === "slow-fail") {
        await new Promise((resolve) => setTimeout(resolve, 80));
        return null;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
      return id;
    });
    expect(winner).toEqual({ item: "fast-ok", value: "fast-ok" });
    expect(Date.now() - started).toBeLessThan(70);
  });

  it("returns null when every probe fails", async () => {
    const winner = await raceFirstOk(["a", "b"], async () => null);
    expect(winner).toBeNull();
  });
});

describe("firstOkInBatches", () => {
  it("walks candidate batches until one plays", async () => {
    const probed: string[] = [];
    const winner = await firstOkInBatches(
      ["a", "b", "c", "d"],
      async (id) => {
        probed.push(id);
        return id === "c" ? id : null;
      },
      2,
    );
    expect(winner).toEqual({ item: "c", value: "c" });
    expect(probed.sort()).toEqual(["a", "b", "c", "d"]);
  });
});
