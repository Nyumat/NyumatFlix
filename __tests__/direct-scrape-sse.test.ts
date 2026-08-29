import { describe, expect, it } from "vitest";

import { collectStreamsFromDirectSse } from "@/lib/direct/scrape-sse";

const sseBody = (frames: string[]): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      const frame = frames[index];
      index += 1;
      if (frame === undefined) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(frame));
    },
  });
};

describe("collectStreamsFromDirectSse", () => {
  it("returns as soon as a playable stream chunk arrives", async () => {
    const response = new Response(
      sseBody([
        `event: status\ndata: {"message":"Finding streams","loading":["addon"]}\n\n`,
        `event: streams\ndata: {"streams":[{"name":"YIFY.1080p","url":"/api/media?u=mp4","hash":"a","playback":"direct","browserPlayable":true}],"partial":true}\n\n`,
        `event: streams\ndata: {"streams":[{"name":"late","url":"/api/media?u=late","hash":"b"}],"partial":true}\n\n`,
      ]),
      { headers: { "Content-Type": "text/event-stream" } },
    );

    const payload = await collectStreamsFromDirectSse(
      response,
      new AbortController().signal,
      (streams) => streams.some((stream) => stream.url.includes("mp4")),
    );

    expect(payload.streams.map((stream) => stream.hash)).toEqual(["a"]);
  });

  it("returns the done payload when nothing was playable yet", async () => {
    const response = new Response(
      sseBody([
        `event: streams\ndata: {"streams":[{"name":"Empty","url":"","hash":"z"}],"partial":true}\n\n`,
        `event: done\ndata: {"streams":[{"name":"Empty","url":"","hash":"z"}],"message":"No streams found"}\n\n`,
      ]),
      { headers: { "Content-Type": "text/event-stream" } },
    );

    const payload = await collectStreamsFromDirectSse(
      response,
      new AbortController().signal,
      (streams) => streams.some((stream) => stream.url.trim().length > 0),
    );

    expect(payload.message).toBe("No streams found");
    expect(payload.streams).toHaveLength(1);
  });
});
