import { describe, expect, it } from "vitest";

import {
  classifyProxiedBodyHead,
  parseByteRangeHeader,
  sliceStreamToByteRange,
  sniffUpstreamBody,
} from "@/lib/scrape/media-sniff";

const streamFromChunks = (chunks: Uint8Array[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });

const tsPacket = (index: number): Uint8Array => {
  const packet = new Uint8Array(188);
  packet[0] = 0x47;
  packet[1] = 0x40;
  packet[2] = 0x00;
  packet[3] = 0x30 + (index % 8);
  packet.fill(0xff, 4);
  return packet;
};

describe("media-sniff", () => {
  it("classifies MPEG-TS by dual sync bytes", () => {
    const head = new Uint8Array(512);
    head.set(tsPacket(0), 0);
    head.set(tsPacket(1), 188);
    expect(classifyProxiedBodyHead(head)).toBe("mpeg-ts");
  });

  it("does not classify short text starting with 0x47 as MPEG-TS", () => {
    const head = new Uint8Array(64);
    head[0] = 0x47; // "G"
    expect(classifyProxiedBodyHead(head)).toBe("other");
  });

  it("classifies MP4 by ftyp box", () => {
    const head = new Uint8Array([
      0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32,
    ]);
    expect(classifyProxiedBodyHead(head)).toBe("mp4");
  });

  it("classifies fragmented MP4 segments before text decoding", () => {
    for (const box of ["styp", "moof"]) {
      const head = new Uint8Array(16);
      head[3] = 16;
      head.set(new TextEncoder().encode(box), 4);
      expect(classifyProxiedBodyHead(head)).toBe("mp4");
    }
  });

  it("classifies HLS playlist text as other", () => {
    const head = new TextEncoder().encode("#EXTM3U\n#EXT-X-VERSION:3\n");
    expect(classifyProxiedBodyHead(head)).toBe("other");
  });

  it("reattaches sniffed head to the rest of the stream", async () => {
    const head = new Uint8Array(1024);
    head.set(tsPacket(0), 0);
    head.set(tsPacket(1), 188);
    head.set(tsPacket(2), 376);
    head.set(tsPacket(3), 564);
    const tail = tsPacket(3);
    const body = streamFromChunks([head, tail]);

    const sniff = await sniffUpstreamBody(body);
    expect(sniff.kind).toBe("mpeg-ts");

    const bytes = new Uint8Array(
      await new Response(sniff.stream).arrayBuffer(),
    );
    expect(bytes.byteLength).toBe(head.byteLength + tail.byteLength);
    expect(bytes[0]).toBe(0x47);
    expect(bytes[188]).toBe(0x47);
    expect(bytes[head.byteLength]).toBe(0x47);
  });

  it("parses byte range headers", () => {
    expect(parseByteRangeHeader("bytes=0-2047")).toEqual({
      start: 0,
      end: 2047,
    });
    expect(parseByteRangeHeader("bytes=1024-")).toEqual({
      start: 1024,
      end: null,
    });
    expect(parseByteRangeHeader(null)).toBeNull();
    expect(parseByteRangeHeader("items=0-1")).toBeNull();
    expect(parseByteRangeHeader("bytes=9007199254740992-")).toBeNull();
    expect(parseByteRangeHeader("bytes=0-9007199254740992")).toBeNull();
  });

  it("slices a stream to a byte range and stops pulling", async () => {
    const source = new Uint8Array(1000);
    for (let index = 0; index < source.length; index += 1) {
      source[index] = index % 256;
    }
    const body = streamFromChunks([
      source.subarray(0, 400),
      source.subarray(400, 800),
      source.subarray(800),
    ]);

    const sliced = sliceStreamToByteRange(body, 350, 650);
    const bytes = new Uint8Array(await new Response(sliced).arrayBuffer());
    expect(bytes.byteLength).toBe(301);
    expect(bytes[0]).toBe(350 % 256);
    expect(bytes[bytes.byteLength - 1]).toBe(650 % 256);
  });
});
