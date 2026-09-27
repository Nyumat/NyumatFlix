const BODY_SNIFF_LIMIT = 512;

export type SniffedProxiedBodyKind = "mpeg-ts" | "mp4" | "other";

const TS_PACKET_LENGTH = 188;

const bytesMatchAscii = (
  head: Uint8Array,
  offset: number,
  ascii: string,
): boolean => {
  if (head.length < offset + ascii.length) {
    return false;
  }
  for (let index = 0; index < ascii.length; index += 1) {
    if (head[offset + index] !== ascii.charCodeAt(index)) {
      return false;
    }
  }
  return true;
};

/**
 * Classify the leading bytes of a proxied upstream body. Binary media
 * (extension-less MPEG-TS / MP4) must never be decoded as playlist text —
 * decoding corrupts bytes via UTF-8 replacement characters (U+FFFD).
 */
export const classifyProxiedBodyHead = (
  head: Uint8Array,
): SniffedProxiedBodyKind => {
  // MPEG-TS: 0x47 sync byte at packet boundaries 0 and 188.
  if (
    head.length > TS_PACKET_LENGTH &&
    head[0] === 0x47 &&
    head[TS_PACKET_LENGTH] === 0x47
  ) {
    return "mpeg-ts";
  }

  // Standalone MP4 starts with ftyp; fragmented media often starts with
  // styp or moof and still must be streamed as bytes.
  if (
    bytesMatchAscii(head, 4, "ftyp") ||
    bytesMatchAscii(head, 4, "styp") ||
    bytesMatchAscii(head, 4, "moof")
  ) {
    return "mp4";
  }

  return "other";
};

const concatChunks = (chunks: Uint8Array[]): Uint8Array => {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
};

/**
 * Peek the first bytes of a body stream without losing the remainder:
 * returns the sniffed kind and a reattached stream that replays the peeked
 * head before the rest of the body.
 */
export const sniffUpstreamBody = async (
  body: ReadableStream<Uint8Array>,
): Promise<{
  kind: SniffedProxiedBodyKind;
  stream: ReadableStream<Uint8Array>;
}> => {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (total < BODY_SNIFF_LIMIT) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      chunks.push(value);
      total += value.byteLength;
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  }

  const head = concatChunks(chunks);
  const kind = classifyProxiedBodyHead(head);
  const replayed = head.length > 0;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      if (replayed) {
        controller.enqueue(head);
      }
    },
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
        } else {
          controller.enqueue(value);
        }
      } catch (error) {
        controller.error(error);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });

  return { kind, stream };
};

export type ByteRange = { start: number; end: number | null };

export const parseByteRangeHeader = (
  rangeHeader: string | null,
): ByteRange | null => {
  if (!rangeHeader) {
    return null;
  }
  const match = rangeHeader.match(/^bytes=(\d+)-(\d*)$/);
  if (!match) {
    return null;
  }
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : null;
  if (
    !Number.isSafeInteger(start) ||
    (end !== null && (!Number.isSafeInteger(end) || end < start))
  ) {
    return null;
  }
  return { start, end };
};

/**
 * Serve a byte range from a stream when the upstream ignored the client's
 * Range request (200 full-body). Drops bytes outside [start, end] and stops
 * pulling (cancels the upstream) once the range is satisfied.
 */
export const sliceStreamToByteRange = (
  source: ReadableStream<Uint8Array>,
  start: number,
  endInclusive: number,
): ReadableStream<Uint8Array> => {
  const reader = source.getReader();
  let position = 0;
  let finished = false;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (finished) {
        controller.close();
        return;
      }
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) {
            finished = true;
            controller.close();
            return;
          }

          const chunkStart = position;
          const chunkEnd = position + value.byteLength;
          position = chunkEnd;

          const from = Math.max(start, chunkStart);
          const to = Math.min(endInclusive + 1, chunkEnd);
          if (to > from) {
            controller.enqueue(
              value.subarray(from - chunkStart, to - chunkStart),
            );
          }

          if (chunkEnd > endInclusive) {
            finished = true;
            await reader.cancel().catch(() => undefined);
            controller.close();
            return;
          }
        }
      } catch (error) {
        controller.error(error);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
};
