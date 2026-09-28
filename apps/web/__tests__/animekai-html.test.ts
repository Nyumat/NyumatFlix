import { describe, expect, it } from "vitest";

import {
  parseKaiEpisodesHtml,
  parseKaiServersHtml,
} from "@/lib/scrape/anime/animekai-html";

describe("parseKaiServersHtml", () => {
  it("matches enc-dec parse-html server shape", () => {
    const html = `
      <div class="server-items lang-group" data-id="softsub">
        <div class="server" data-lid="dIG98qei6A" data-num="1">Server 1</div>
      </div>
      <div class="server-items lang-group" data-id="dub">
        <div class="server" data-lid="abc" data-num="1">Dub</div>
      </div>
    `;

    expect(parseKaiServersHtml(html)).toEqual({
      softsub: {
        "1": { sid: null, lid: "dIG98qei6A", name: "Server 1" },
      },
      dub: {
        "1": { sid: null, lid: "abc", name: "Dub" },
      },
    });
  });
});

describe("parseKaiEpisodesHtml", () => {
  it("extracts season, episode number, and token from eplist anchors", () => {
    const html = `
      <div class="eplist" data-season="1">
        <a num="1" token="J9ThpPPzvEyh238Ry5DV"><span>Let You Down</span></a>
        <a num="2" token="MIrkrPjjvhrj035CjZPb"><span>Ep 2</span></a>
      </div>
    `;

    expect(parseKaiEpisodesHtml(html)).toEqual({
      "1": {
        "1": { token: "J9ThpPPzvEyh238Ry5DV", title: "Let You Down" },
        "2": { token: "MIrkrPjjvhrj035CjZPb", title: "Ep 2" },
      },
    });
  });
});
