import { describe, expect, it } from "vitest";

import { mergeProgramSchedules } from "@/lib/live/guide-utils";
import type { LiveChannel, LiveProgram } from "@/lib/live/types";

const program: LiveProgram = {
  id: "p1",
  title: "Show",
  startsAt: new Date().toISOString(),
  endsAt: new Date(Date.now() + 3_600_000).toISOString(),
  episodeTitle: null,
  description: null,
};

const channel = (name: string, programs?: LiveProgram[]): LiveChannel => ({
  id: name,
  name,
  category: "entertainment",
  categoryName: "Entertainment",
  country: "US",
  logoUrl: null,
  playUrl: "/live/play/test",
  sourceUrl: "https://example.com/stream.m3u8",
  sourceHost: "example.com",
  availability: "ready",
  unavailableReason: null,
  kind: "channel",
  startsAt: null,
  label: null,
  searchText: name.toLowerCase(),
  programs,
});

describe("mergeProgramSchedules", () => {
  it("copies donor schedules onto channels missing programs", () => {
    const target = channel("Cartoon Network");
    const donor = channel("Cartoon Network", [program]);

    const merged = mergeProgramSchedules([target], [donor]);
    expect(merged[0]?.programs).toEqual([program]);
  });
});
