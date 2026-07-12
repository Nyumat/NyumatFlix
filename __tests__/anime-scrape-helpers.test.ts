import { describe, expect, it } from "vitest";

import { decodeAllanimeProviderPath } from "@/lib/scrape/anime/allanime-crypto";
import {
  extractHtmlSubtitleTracks,
  isDirectMediaUrl,
  parseCatPlayerProps,
  unpackDeanEdwardsScripts,
} from "@/lib/scrape/anime/html-utils";
import { selectAllmangaShow } from "@/lib/scrape/anime/providers/allmanga";
import { animeSearchLabelMatches } from "@/lib/scrape/anime/title-match";

describe("anime scrape helpers", () => {
  it("parses KickAssAnime cat-player props manifest and subtitles", () => {
    const html = `props="{&quot;manifest&quot;:[0,&quot;https://hls.krussdomi.com/manifest/abc/master.m3u8&quot;],&quot;subtitles&quot;:[1,[[0,{&quot;language&quot;:[0,&quot;eng&quot;],&quot;name&quot;:[0,&quot;English&quot;],&quot;src&quot;:[0,&quot;https://subst.krussdomi.com/abc/en.vtt&quot;]}]]]}"`;

    expect(parseCatPlayerProps(html)).toEqual({
      manifest: "https://hls.krussdomi.com/manifest/abc/master.m3u8",
      subtitles: [
        {
          lang: "eng",
          name: "English",
          src: "https://subst.krussdomi.com/abc/en.vtt",
        },
      ],
    });
  });

  it("extracts all HTML softsub tracks with labels and skips chapters", () => {
    const html = `
      <track kind="subtitles" label="English [Kaizoku]" srclang="en" src="https://cdn.example/0_en.ass">
      <track kind=chapters src="https://cdn.example/chapters.vtt">
      <track kind="subtitles" label="Deutsch" src=https://cdn.example/2_de.ass>
      https://cdn.example/storyboard.vtt
    `;

    expect(extractHtmlSubtitleTracks(html)).toEqual([
      {
        lang: "English [Kaizoku]",
        url: "https://cdn.example/0_en.ass",
        format: "ass",
      },
      {
        lang: "Deutsch",
        url: "https://cdn.example/2_de.ass",
        format: "ass",
      },
    ]);
  });

  it("rejects hostnames that merely contain mp4", () => {
    expect(
      isDirectMediaUrl("https://www.mp4upload.com/embed-abc123.html"),
    ).toBe(false);
    expect(isDirectMediaUrl("https://cdn.example/video.mp4")).toBe(true);
    expect(isDirectMediaUrl("https://cdn.example/master.m3u8?token=1")).toBe(
      true,
    );
  });

  it("decodes AllAnime provider path tokens", () => {
    const encoded =
      "--175948514e4c4f57175b54575b5307515c050f5c0a0c0f0b0f0c0e590a0c0b5b0a0c0e0c0e0a0b0f0e0c";
    const decoded = decodeAllanimeProviderPath(encoded);

    expect(decoded.length).toBeGreaterThan(10);
    expect(decoded).toContain("/clock.json");
  });

  it("requires an exact known title instead of token-overlap guessing", () => {
    const selected = selectAllmangaShow(
      [
        { _id: "more", name: "Boku no Hero Academia: More" },
        { _id: "final", name: "Boku no Hero Academia Final Season" },
        { _id: "base", name: "Boku no Hero Academia" },
      ],
      ["My Hero Academia", "Boku no Hero Academia"],
    );

    expect(selected?._id).toBe("base");
  });

  it("rejects AllManga results when no exact known title exists", () => {
    expect(
      selectAllmangaShow(
        [{ _id: "sequel", name: "My Hero Academia Season 2" }],
        ["My Hero Academia"],
      ),
    ).toBeUndefined();
  });

  it("matches AllManga abbreviated names via AniList id and englishName", () => {
    const shows = [
      {
        _id: "heroines",
        name: "ONE PIECE HEROINES",
        englishName: "ONE PIECE HEROINES",
        aniListId: "197178",
      },
      {
        _id: "one-piece",
        name: "1P",
        englishName: "ONE PIECE",
        nativeName: "ONE PIECE",
        aniListId: "21",
      },
    ];

    expect(selectAllmangaShow(shows, ["ONE PIECE"], 21)?._id).toBe("one-piece");
    expect(selectAllmangaShow(shows, ["ONE PIECE"])?._id).toBe("one-piece");
  });

  it("matches AnimeGG search labels that embed episodes metadata", () => {
    expect(
      animeSearchLabelMatches(
        "Naruto Episodes: 220 Alt Titles : Naruto ,ナルト Status : Completed",
        ["Naruto"],
      ),
    ).toBe(true);
    expect(
      animeSearchLabelMatches(
        "Naruto Shippuden Episodes: 500 Alt Titles : Naruto: Shippuuden Status : Completed",
        ["Naruto"],
      ),
    ).toBe(false);
  });

  it("matches episode page titles that append Episode N", () => {
    expect(
      animeSearchLabelMatches("Jujutsu Kaisen Episode 1", ["Jujutsu Kaisen"]),
    ).toBe(true);
  });

  it("unpacks Dean Edwards scripts without evaluating them", () => {
    const packed =
      "eval(function(p,a,c,k,e,d){return p}('0 1=\\'2://3/4.5\\';',62,6,'var|url|https|cdn.example|master|m3u8'.split('|'),0,{}))";

    expect(unpackDeanEdwardsScripts(packed)).toEqual([
      "var url='https://cdn.example/master.m3u8';",
    ]);
  });
});
