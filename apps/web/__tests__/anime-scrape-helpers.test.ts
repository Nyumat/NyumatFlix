import { describe, expect, it } from "vitest";

import { decodeAllanimeProviderPath } from "@/lib/scrape/anime/allanime-crypto";
import { normalizeAllanimeStreamUrl } from "@/lib/scrape/anime/allanime-stream-url";
import {
  extractHtmlSubtitleTracks,
  isDirectMediaUrl,
  parseCatPlayerProps,
  unpackDeanEdwardsScripts,
} from "@/lib/scrape/anime/html-utils";
import { selectAllmangaShow } from "@/lib/scrape/anime/providers/allmanga";
import {
  extractAnizoneSearchItems,
  extractAnizoneVidstackPlayer,
  pickAnizoneSlugFromItems,
} from "@/lib/scrape/anime/anizone-livewire";
import {
  extractAnimeggSources,
  isUsableAnimeggHtml,
  shouldFlareSolveAnimegg,
} from "@/lib/scrape/anime/providers/animegg";
import {
  animeSearchLabelMatches,
  fuzzyMatchAnimeTitle,
  isExactAnimeTitleMatch,
} from "@/lib/scrape/anime/title-match";

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
    expect(
      selectAllmangaShow(
        [{ _id: "final-season-p2", name: "AOT FS P2", aniListId: 131681 }],
        ["Attack on Titan: The Final Season Part 2"],
        131681,
      )?._id,
    ).toBe("final-season-p2");
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

  it("matches franchise subtitles without matching sequel series names", () => {
    expect(
      animeSearchLabelMatches("Jujutsu Kaisen: Shimetsu Kaiyuu - Zenpen", [
        "Jujutsu Kaisen",
      ]),
    ).toBe(true);
    expect(
      animeSearchLabelMatches(
        "Completed Sub Frieren: Beyond Journey's End Season 2",
        ["Frieren: Beyond Journey's End"],
      ),
    ).toBe(true);
    expect(
      animeSearchLabelMatches(
        "Naruto Shippuden Episodes: 500 Alt Titles : Naruto: Shippuuden Status : Completed",
        ["Naruto"],
      ),
    ).toBe(false);
    expect(
      animeSearchLabelMatches(
        "One Piece Episode of Merry - Mou Hitori no Nakama no Monogatari",
        ["ONE PIECE"],
      ),
    ).toBe(false);
  });

  it("treats AnimeGG (TV) labels as exact matches for the TV series", () => {
    expect(
      isExactAnimeTitleMatch("Jujutsu Kaisen (TV)", ["Jujutsu Kaisen"]),
    ).toBe(true);
    expect(
      isExactAnimeTitleMatch("Jujutsu Kaisen 2nd Season", ["Jujutsu Kaisen"]),
    ).toBe(false);
    expect(
      animeSearchLabelMatches(
        "Jujutsu Kaisen (TV) Episodes: 24 Alt Titles : Jujutsu Kaisen Status : Completed",
        ["Jujutsu Kaisen"],
      ),
    ).toBe(true);
  });

  it("fuzzy matches adult catalog titles that diverge by typos or suffixes", () => {
    // Jimihen: site has `jimko`/`kouyouu` typos + "Uncensored" suffix
    expect(
      fuzzyMatchAnimeTitle(
        "Jimihen!! Jimko Wo Kaechau Jun Isei Kouyouu!! Uncensored",
        ["Jimihen!!: Jimiko wo Kaechau Jun Isei Kouyuu", "Simple yet Sexy"],
      ),
    ).toBe(true);
    // gibo/haha: site uses `gibo`, AniList uses `haha`
    expect(
      fuzzyMatchAnimeTitle("Succubus Yondara Gibo ga Kita", [
        "Succubus Yondara Haha ga Kita!?",
      ]),
    ).toBe(true);
    // Punctuation / casing only
    expect(
      fuzzyMatchAnimeTitle(
        "Araiya-San! Ore To Aitsu Ga Onnayu De! Uncensored",
        ["Araiya-san!: Ore to Aitsu ga Onnayu de!?"],
      ),
    ).toBe(true);
    // Pure suffix noise
    expect(fuzzyMatchAnimeTitle("Overflow Uncensored", ["Overflow"])).toBe(
      true,
    );
  });

  it("rejects unrelated adult catalog titles under fuzzy matching", () => {
    // Extra junk tokens sink the Jaccard score
    expect(
      fuzzyMatchAnimeTitle("Overflow Uncensored Sex Scenes Season", [
        "Overflow",
      ]),
    ).toBe(false);
    // Different shows sharing a common word
    expect(fuzzyMatchAnimeTitle("Princess Burst!", ["Princess Lover!"])).toBe(
      false,
    );
    expect(
      fuzzyMatchAnimeTitle(
        "Body Washing Service Spa With Brown Skinned Big Breasted Succubus",
        ["Marshmallow, Imouto, Succubus"],
      ),
    ).toBe(false);
    // Empty candidate
    expect(fuzzyMatchAnimeTitle("", ["Overflow"])).toBe(false);
  });

  it("parses AniZone Alpine JSON.parse search items instead of /anime/ hrefs", () => {
    const html =
      "items: JSON.parse('[{\\u0022slug\\u0022:\\u0022uyyyn4kf\\u0022,\\u0022main_title\\u0022:\\u0022One Piece\\u0022,\\u0022title_list\\u0022:{\\u00228\\u0022:\\u0022ONE PIECE\\u0022},\\u0022type\\u0022:\\u0022TV Series\\u0022},{\\u0022slug\\u0022:\\u0022zldcbsft\\u0022,\\u0022main_title\\u0022:\\u0022One Piece Novel Heroines\\u0022,\\u0022type\\u0022:\\u0022TV Special\\u0022},{\\u0022slug\\u0022:\\u0022filmred\\u0022,\\u0022main_title\\u0022:\\u0022One Piece Film Red\\u0022,\\u0022type\\u0022:\\u0022Movie\\u0022}]')";

    const items = extractAnizoneSearchItems(html);
    expect(items.map((item) => item.slug)).toEqual([
      "uyyyn4kf",
      "zldcbsft",
      "filmred",
    ]);
    expect(pickAnizoneSlugFromItems(items, "ONE PIECE")).toBe("uyyyn4kf");
    expect(pickAnizoneSlugFromItems(items, "One Piece Film Red")).toBe(
      "filmred",
    );
    expect(html.match(/\/anime\/([a-z0-9-]+)/g)).toBeNull();
  });

  it("parses AniZone vidstackPlayer JSON.parse HLS + subtitles", () => {
    const html =
      "x-data=\"vidstackPlayer(JSON.parse('{\\u0022src\\u0022:\\u0022https:\\\\\\/\\\\\\/cdn.example\\\\\\/master.m3u8\\u0022,\\u0022subtitles\\u0022:[{\\u0022title\\u0022:\\u0022English\\u0022,\\u0022format\\u0022:\\u0022ass\\u0022,\\u0022language\\u0022:\\u0022en\\u0022,\\u0022file\\u0022:\\u0022https:\\\\\\/\\\\\\/cdn.example\\\\\\/en.ass\\u0022}]}'))\"";
    const player = extractAnizoneVidstackPlayer(html);
    expect(player?.src).toBe("https://cdn.example/master.m3u8");
    expect(player?.subtitles[0]).toEqual({
      title: "English",
      format: "ass",
      language: "en",
      file: "https://cdn.example/en.ass",
    });
  });

  it("rejects AnimeGG episode-not-found shells that still return HTTP 200", () => {
    const errorPage = `${"x".repeat(3000)}<h1>Error: Episode not found</h1>`;
    expect(isUsableAnimeggHtml(200, errorPage)).toBe(false);
    expect(shouldFlareSolveAnimegg(200, errorPage)).toBe(false);
    expect(shouldFlareSolveAnimegg(403, "<html>Just a moment</html>")).toBe(
      true,
    );
    expect(
      extractAnimeggSources(
        '{file:"/play/25881/video.mp4", label:"1080"} {file:"https://cdn.example/video.mp4", label:"720"}',
      ),
    ).toEqual([{ path: "/play/25881/video.mp4", label: "1080" }]);
  });

  it("unpacks Dean Edwards scripts without evaluating them", () => {
    const packed =
      "eval(function(p,a,c,k,e,d){return p}('0 1=\\'2://3/4.5\\';',62,6,'var|url|https|cdn.example|master|m3u8'.split('|'),0,{}))";

    expect(unpackDeanEdwardsScripts(packed)).toEqual([
      "var url='https://cdn.example/master.m3u8';",
    ]);
  });

  it("normalizes double-escaped AllAnime okcdn query strings", () => {
    const raw =
      "https://vd543.okcdn.ru/video.m3u8?cmd=videoPlayerCdn\\\\u0026expires=1\\\\u0026sig=abc\\";
    expect(normalizeAllanimeStreamUrl(raw)).toBe(
      "https://vd543.okcdn.ru/video.m3u8?cmd=videoPlayerCdn&expires=1&sig=abc",
    );
  });
});
