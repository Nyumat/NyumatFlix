import { describe, expect, it } from "vitest";

import {
  chapterSegmentPercent,
  findChapterAtTime,
  introDbSegmentClassName,
} from "../utils/chapterMarkers";

describe("chapterMarkers", () => {
  const chapters = [
    { title: "Intro", start: 0, end: 90 },
    { title: "Credits", start: 1380, end: 1440 },
  ];

  it("finds a chapter only inside its explicit range", () => {
    expect(findChapterAtTime(chapters, 45)?.title).toBe("Intro");
    expect(findChapterAtTime(chapters, 500)).toBeNull();
    expect(findChapterAtTime(chapters, 1390)?.title).toBe("Credits");
  });

  it("sizes chapter segments from start to end", () => {
    expect(chapterSegmentPercent(chapters[0], 1500)).toEqual({
      left: 0,
      width: 6,
    });
    expect(chapterSegmentPercent(chapters[1], 1500)).toEqual({
      left: 92,
      width: 4,
    });
  });

  it("maps introdb segment titles to css classes", () => {
    expect(introDbSegmentClassName("Intro")).toBe("movi-chapter-segment--intro");
    expect(introDbSegmentClassName("credits")).toBe(
      "movi-chapter-segment--credits",
    );
    expect(introDbSegmentClassName("Main")).toBeNull();
  });
});
