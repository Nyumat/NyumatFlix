import { describe, expect, it } from "vitest";

import { extractXPassPlaylistPath } from "@/lib/scrape/providers/xpass";

const movieEmbedHtml = `
<script>var data={"width":"100%","height":"100%","playlist":"/mvid/Qn9K2Vc9YXHhNxZScAiVgM/1/playlist.json","tracks":[],"autostart":true,"cast":{}}</script>
`;

const tvEmbedHtml = `
<script>var data={"width":"100%","height":"100%","playlist":"/vip/eCtFSdaW_HaR24t_oRvFCDnvooJnqXKE4oPR23k8UdZQq4h3--Bsc3EMDqmh4vyZmQ2PM5doPf88oj7C4Bb3BJPGQg/1/playlist.json","tracks":[],"autostart":true,"cast":{}}</script>
<script>var backups=[{"id":"","name":"MEG 1","url":"/meg/tv/46298/1/52/1/playlist.json","dl":true}]</script>
`;

describe("extractXPassPlaylistPath", () => {
  it("extracts mvid playlist paths from movie embed pages", () => {
    expect(extractXPassPlaylistPath(movieEmbedHtml)).toBe(
      "mvid/Qn9K2Vc9YXHhNxZScAiVgM/1/playlist.json",
    );
  });

  it("extracts vip playlist paths from tv embed pages", () => {
    expect(extractXPassPlaylistPath(tvEmbedHtml)).toBe(
      "vip/eCtFSdaW_HaR24t_oRvFCDnvooJnqXKE4oPR23k8UdZQq4h3--Bsc3EMDqmh4vyZmQ2PM5doPf88oj7C4Bb3BJPGQg/1/playlist.json",
    );
  });

  it("falls back to meg/tv paths when playlist json is absent", () => {
    const html = `{"url":"/meg/tv/46298/1/52/1/playlist.json"}`;
    expect(extractXPassPlaylistPath(html)).toBe(
      "meg/tv/46298/1/52/1/playlist.json",
    );
  });

  it("returns null when no playlist path is present", () => {
    expect(extractXPassPlaylistPath("<html></html>")).toBeNull();
  });
});
