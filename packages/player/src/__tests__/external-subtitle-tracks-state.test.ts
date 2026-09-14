import { describe, expect, it } from "vitest";

import {
  getExternalSubtitleId,
  mergeExternalSubtitleActiveId,
  type SubtitleSourceEntry,
} from "../types";

describe("mergeExternalSubtitleActiveId", () => {
  const primary: SubtitleSourceEntry = {
    id: "scrape-english-aaa",
    url: "https://cdn.example/a.vtt",
    lang: "eng",
    label: "eng (ENG)",
  };

  it("preserves the active id when sidecars refresh", () => {
    const activeId = "scrape-english-aaa";
    const next = mergeExternalSubtitleActiveId(activeId, [
      primary,
      {
        id: "scrape-english-bbb",
        url: "https://cdn.example/b.vtt",
        lang: "eng",
        label: "eng (2)",
      },
    ]);

    expect(next).toBe(activeId);
    expect(getExternalSubtitleId(primary)).toBe("scrape-english-aaa");
  });

  it("clears active id when the previous track disappears", () => {
    const next = mergeExternalSubtitleActiveId("scrape-english-aaa", [
      {
        id: "scrape-english-bbb",
        url: "https://cdn.example/b.vtt",
        lang: "eng",
        label: "eng (2)",
      },
    ]);

    expect(next).toBe("");
  });

  it("keeps empty selection empty", () => {
    expect(mergeExternalSubtitleActiveId("", [primary])).toBe("");
  });
});
