/**
 * ThumbnailHttpSource - Buffered HTTP source for thumbnail extraction.
 *
 * Uses a simple sliding buffer to cache data and reduce HTTP requests.
 * Each seek position triggers a larger chunk fetch, and subsequent reads
 * are served from the buffer until a new seek is needed.
 */

import type { SourceAdapter } from "./SourceAdapter";
import { Logger } from "../utils/Logger";

const TAG = "ThumbnailHttpSource";

// Buffer 2MB at a time. A single 4K HDR keyframe can run 1-2MB, and the
// demuxer also issues several scattered index/keyframe reads around the
// target before it hands us the packet. At 512KB each of those reads missed
// the buffer and paid its own HTTP round-trip — a single far-position hover
// fired ~8 sequential fetches (the ~4s vs <2s gap against a real seek).
// 2MB lets one fetch cover the keyframe plus its neighbouring reads.
const BUFFER_SIZE = 2 * 1024 * 1024;
// Maximum fetch size to prevent excessive downloads (5MB cap)
const MAX_FETCH_SIZE = 5 * 1024 * 1024;

/**
 * Minimal interface describing a source we can peek into without mutating.
 * HttpSource implements this structurally via peekMetadata() / peekRange().
 */
export interface PeekableSource {
  peekMetadata(offset: number, length: number): Uint8Array | null;
  peekRange(offset: number, length: number): Uint8Array | null;
}

export class ThumbnailHttpSource implements SourceAdapter {
  private url: string;
  private headers: Record<string, string>;
  private size: number = -1;
  private position: number = 0;
  private abortController: AbortController | null = null;
  // Set once a fetch comes back 200 (server ignores Range). From then on we
  // never hit the network — thumbnails are served purely by borrowing bytes
  // the main source already has in its RAM window; a borrow miss just yields
  // no preview rather than a doomed (and spammy) range fetch.
  private rangeUnsupported: boolean = false;

  // Simple buffer cache
  private buffer: Uint8Array | null = null;
  private bufferStart: number = 0;
  private bufferEnd: number = 0;

  // Optional main source to borrow already-buffered bytes from.
  // Used to avoid re-fetching data the main playback stream has cached
  // — particularly hot for seekbar hover previews near current playback.
  private borrowSource: PeekableSource | null = null;

  constructor(
    url: string,
    headers: Record<string, string> = {},
    borrowSource: PeekableSource | null = null,
  ) {
    this.url = url;
    this.headers = headers;
    this.borrowSource = borrowSource;
  }

  setBorrowSource(source: PeekableSource | null): void {
    this.borrowSource = source;
  }

  /**
   * Seed the file size from the main source so getSize() skips its own HEAD /
   * ranged-GET probe. Essential for non-range servers where that probe can't
   * recover a size (Cloudflare strips Content-Length on HEAD and may chunk the
   * 200 GET) — the main source already knows the size, so just reuse it.
   */
  seedSize(size: number): void {
    if (size > 0) this.size = size;
  }

  async getSize(): Promise<number> {
    if (this.size >= 0) return this.size;

    const response = await fetch(this.url, {
      method: "HEAD",
      headers: this.headers,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const contentLength = response.headers.get("Content-Length");
    if (contentLength) {
      this.size = parseInt(contentLength, 10);
    } else {
      // Cloudflare (and some CDNs) strip Content-Length from null-body HEAD
      // responses — recover the total from a 1-byte ranged GET's Content-Range.
      // Mirrors HttpSource.resolveSizeViaRange.
      const viaRange = await this.resolveSizeViaRange();
      if (viaRange === null) throw new Error("Content-Length missing");
      this.size = viaRange;
    }
    Logger.debug(TAG, `File size: ${this.size} bytes`);

    return this.size;
  }

  /**
   * Recover total size from a 1-byte ranged GET when HEAD lacks Content-Length.
   * Body is cancelled immediately — we only need the Content-Range header.
   */
  private async resolveSizeViaRange(): Promise<number | null> {
    let res: Response;
    try {
      res = await fetch(this.url, {
        method: "GET",
        headers: { ...this.headers, Range: "bytes=0-0" },
      });
    } catch {
      return null;
    }
    res.body?.cancel().catch(() => {});
    if (!res.ok && res.status !== 206) return null;

    const contentRange = res.headers.get("Content-Range");
    if (contentRange) {
      const m = /\/\s*(\d+)\s*$/.exec(contentRange);
      if (m) return parseInt(m[1], 10);
    }
    const cl = res.headers.get("Content-Length");
    if (res.status === 200 && cl) return parseInt(cl, 10);
    return null;
  }

  /**
   * Check if requested data is in buffer
   */
  private isInBuffer(offset: number, length: number): boolean {
    return (
      this.buffer !== null &&
      offset >= this.bufferStart &&
      offset + length <= this.bufferEnd
    );
  }

  /**
   * Read data - uses buffer cache to minimize HTTP requests
   */
  async read(offset: number, length: number): Promise<ArrayBuffer> {
    // Clamp to file size if known
    if (this.size > 0 && offset >= this.size) {
      return new ArrayBuffer(0);
    }

    // Serve from buffer if available
    if (this.isInBuffer(offset, length)) {
      const localOffset = offset - this.bufferStart;
      const result = new Uint8Array(length);
      result.set(this.buffer!.subarray(localOffset, localOffset + length));
      this.position = offset + length;
      Logger.debug(TAG, `Read from buffer: offset=${offset}, length=${length}`);
      return result.buffer;
    }

    // Try borrowing from main source's buffers before paying for a new fetch.
    // Metadata LRU covers moov/ftyp/Cues reads the main player has already
    // served (format-agnostic); sliding window covers keyframe bytes near
    // current playback (seekbar hover previews).
    if (this.borrowSource) {
      const meta = this.borrowSource.peekMetadata(offset, length);
      if (meta) {
        this.position = offset + length;
        Logger.debug(TAG, `Read borrowed from metadata LRU: offset=${offset}, length=${length}`);
        // peek methods always return fresh Uint8Array backed by ArrayBuffer
        return meta.buffer as ArrayBuffer;
      }
      const hit = this.borrowSource.peekRange(offset, length);
      if (hit) {
        this.position = offset + length;
        Logger.debug(TAG, `Read borrowed from main window: offset=${offset}, length=${length}`);
        return hit.buffer as ArrayBuffer;
      }
    }

    // Non-range source: the borrow missed and the server can't serve a range,
    // so there's nothing to fetch. Yield empty — the requested frame just isn't
    // in the buffered window, so no preview is shown there.
    if (this.rangeUnsupported) {
      return new ArrayBuffer(0);
    }

    // Need to fetch - calculate optimal range
    // Fetch a larger chunk to avoid multiple small requests, but cap at MAX_FETCH_SIZE
    const fetchStart = offset;
    const fetchSize = Math.min(
      Math.max(BUFFER_SIZE, length),
      MAX_FETCH_SIZE // Cap to prevent excessive downloads
    );
    const fetchEnd =
      this.size > 0
        ? Math.min(fetchStart + fetchSize - 1, this.size - 1)
        : fetchStart + fetchSize - 1;

    Logger.debug(
      TAG,
      `Fetching: range=${fetchStart}-${fetchEnd} (${((fetchEnd - fetchStart + 1) / 1024).toFixed(1)} KB)`,
    );

    // Retry loop
    const MAX_RETRIES = 5;
    const BASE_DELAY = 1000;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      // Check for offline state
      if (
        typeof self !== "undefined" &&
        self.navigator &&
        !self.navigator.onLine
      ) {
        Logger.warn(TAG, "Network offline, waiting for connection...");
        await new Promise<void>((resolve) => {
          const onOnline = () => {
            self.removeEventListener("online", onOnline);
            resolve();
          };
          self.addEventListener("online", onOnline);
        });
        Logger.info(TAG, "Network online, resuming...");
        attempt = 0; // Reset retries
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      try {
        const response = await fetch(this.url, {
          headers: {
            ...this.headers,
            Range: `bytes=${fetchStart}-${fetchEnd}`,
          },
          cache: 'no-store', // Prevent cached 200 responses
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        // If the server returns 200 instead of 206 it's ignoring Range and
        // would stream the whole file. Latch range-unsupported and fall back to
        // borrow-only: abort this download and yield empty (no preview here).
        // No retries — they'd all come back 200 too (the old behavior spammed
        // 5 failed fetches per hover).
        if (response.status === 200) {
          Logger.info(
            TAG,
            "Server returned 200 (no Range support) — thumbnails switch to borrow-only.",
          );
          controller.abort();
          this.rangeUnsupported = true;
          return new ArrayBuffer(0);
        }

        if (!response.ok && response.status !== 206) {
          if (response.status === 416) {
            Logger.warn(
              TAG,
              `HTTP 416 (Range Not Satisfiable) at ${fetchStart}-${fetchEnd}. Treating as EOF.`,
            );
            return new ArrayBuffer(0);
          } else if (response.status >= 500 || response.status === 429) {
            // Retry server errors
            throw new Error(`HTTP ${response.status}`);
          } else {
            // Fatal client error
            throw new Error(`HTTP ${response.status} (Fatal)`);
          }
        }

        const arrayBuffer = await response.arrayBuffer();

        // Store in buffer
        this.buffer = new Uint8Array(arrayBuffer);
        this.bufferStart = fetchStart;
        this.bufferEnd = fetchStart + arrayBuffer.byteLength;

        Logger.debug(
          TAG,
          `Buffered: ${this.bufferStart}-${this.bufferEnd} (${(arrayBuffer.byteLength / 1024).toFixed(1)} KB)`,
        );

        // Return requested portion
        const resultLength = Math.min(length, arrayBuffer.byteLength);
        const result = new Uint8Array(resultLength);
        result.set(this.buffer.subarray(0, resultLength));
        this.position = offset + resultLength;

        return result.buffer;
      } catch (error) {
        clearTimeout(timeoutId);

        if ((error as any).name === "AbortError") {
          Logger.debug(TAG, `Read aborted at offset ${offset}`);
          return new ArrayBuffer(0); // Cancelled
        }

        // Check for CORS errors (TypeError: Failed to fetch)
        // CORS errors are fatal and should not be retried
        const errorMessage = (error as any).message || "";
        const isCorsError =
          (error as any).name === "TypeError" &&
          errorMessage.includes("Failed to fetch");

        if (isCorsError) {
          Logger.error(TAG, `CORS error accessing ${this.url}`);
          throw new Error(
            "Failed to fetch video resource. Check your connection or CORS settings."
          );
        }

        // Check if fatal error
        if (
          (error as any).message &&
          (error as any).message.includes("(Fatal)")
        ) {
          throw error;
        }

        if (attempt === MAX_RETRIES) {
          Logger.error(
            TAG,
            `Max retries (${MAX_RETRIES}) reached for thumbnail fetch, giving up.`,
          );
          throw error;
        }

        Logger.warn(
          TAG,
          `Fetch error (attempt ${attempt + 1}/${MAX_RETRIES}), retrying...`,
          error,
        );
        const delay = Math.min(BASE_DELAY * Math.pow(1.5, attempt), 5000);
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    return new ArrayBuffer(0); // Should not reach here
  }

  seek(offset: number): number {
    this.position = offset;
    return this.position;
  }

  getPosition(): number {
    return this.position;
  }

  /**
   * Clear buffer to free memory when thumbnails aren't being actively generated
   * Call this after thumbnail generation is complete
   */
  clearBuffer(): void {
    this.buffer = null;
    this.bufferStart = 0;
    this.bufferEnd = 0;
    Logger.debug(TAG, "Buffer cleared");
  }

  close(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.buffer = null;
    Logger.debug(TAG, "Source closed");
  }

  getKey(): string {
    return `thumbnail:${this.url}`;
  }

  getUrl(): string {
    return this.url;
  }

  getBufferedEnd(): number {
    return this.bufferEnd;
  }

  getBufferStart(): number {
    return this.bufferStart;
  }
}

export async function createThumbnailHttpSource(
  url: string,
  headers?: Record<string, string>,
): Promise<ThumbnailHttpSource> {
  const source = new ThumbnailHttpSource(url, headers);
  return source;
}
