/**
 * FileSource - Uses LRU cache for chunked file access with preloading
 *
 * For local File objects, we read the file in chunks and cache them
 * using an LRU cache. Chunks are preloaded sequentially to fill the cache.
 */

import type { SourceAdapter } from "./SourceAdapter";
import { LRUCache } from "../cache/LRUCache";
import { Logger } from "../utils/Logger";

const TAG = "FileSource";

// Chunk size for reading file (2MB chunks)
const CHUNK_SIZE = 2 * 1024 * 1024;

export class FileSource implements SourceAdapter {
  private file: File;
  private cache: LRUCache;
  private size: number = -1;
  private position: number = 0;
  private preloadPromise: Promise<void> | null = null;
  private sourceKey: string;
  private currentTime: number = 0;
  private duration: number = 0;
  private preloadOffset: number = 0; // Current byte offset being preloaded around
  private preloadAbort: boolean = false; // Signal to abort current preload cycle

  // Disk read stats
  private totalBytesRead: number = 0;
  private lastSpeedBytes: number = 0;
  private lastSpeedTime: number = 0;
  private currentReadSpeed: number = 0; // bytes per second
  private readStartTime: number = 0;

  // Notified when a file read times out — the underlying File handle has likely
  // been revoked by the browser (mobile background, memory pressure). Fired
  // once per source; subsequent reads continue to throw.
  private onRevokedCallback: ((info: { offset: number; length: number; reason: string }) => void) | null = null;
  private revokedFired: boolean = false;

  // Fires once when the initial preload pass settles (success, error, or
  // abort). Used by MoviPlayer to gate playback on mobile 4K+ where early
  // disk I/O competes with the decode pipeline.
  private preloadComplete: boolean = false;
  private onPreloadCompleteCallback: (() => void) | null = null;

  constructor(file: File, cache: LRUCache | null = null) {
    this.file = file;
    this.size = file.size;
    // Use provided cache or create a default one
    this.cache = cache || new LRUCache(100); // Default 100MB cache
    this.sourceKey = this.getKey();
  }

  /**
   * Register a callback fired the first time a file read times out (likely
   * revocation by mobile browser). Lets the host surface a re-pick UI.
   */
  setOnRevoked(cb: (info: { offset: number; length: number; reason: string }) => void): void {
    this.onRevokedCallback = cb;
  }

  /**
   * Register a one-shot callback fired when the initial preload pass settles.
   * If preload is already complete, fires synchronously.
   */
  setOnPreloadComplete(cb: () => void): void {
    if (this.preloadComplete) {
      cb();
      return;
    }
    this.onPreloadCompleteCallback = cb;
  }

  /**
   * True once the initial preload pass has settled (success, error, or abort).
   */
  isPreloadComplete(): boolean {
    return this.preloadComplete;
  }

  /**
   * Get the total size of the source in bytes
   */
  async getSize(): Promise<number> {
    if (this.size === -1) {
      this.size = this.file.size;
    }
    // Start preloading chunks into cache (from beginning initially)
    this.startPreload();
    return this.size;
  }

  /**
   * Update preload position based on current playback time
   * @param currentTime Current playback time in seconds
   * @param duration Total duration in seconds
   */
  updatePreloadPosition(currentTime: number, duration: number): void {
    if (duration <= 0 || this.size <= 0) return;

    this.currentTime = currentTime;
    this.duration = duration;
    // Let the initial preload finish — it's caching the file for smooth playback.
    // Don't restart or trigger new preloads during playback; demux reads via
    // readFromFile() already cache every chunk they touch as a fallback.
  }

  /**
   * Read data from the source at the given offset
   * @param offset Byte offset to start reading from
   * @param length Number of bytes to read
   * @returns ArrayBuffer containing the requested data
   */
  async read(offset: number, length: number): Promise<ArrayBuffer> {
    // Clamp offset and length to valid range
    const clampedOffset = Math.max(0, Math.min(offset, this.size));
    const availableLength = this.size - clampedOffset;
    const clampedLength = Math.max(0, Math.min(length, availableLength));

    if (clampedLength === 0) {
      return new ArrayBuffer(0);
    }

    // Update position
    this.position = clampedOffset + clampedLength;

    // Try to get exact match from cache first
    const cached = this.cache.get(this.sourceKey, clampedOffset, clampedLength);
    if (cached) {
      // Exact match found in cache
      return cached;
    }

    // Check for overlapping cached chunks
    const overlapping = this.cache.findOverlapping(
      this.sourceKey,
      clampedOffset,
      clampedLength,
    );
    if (overlapping.length > 0) {
      // Try to construct the result from overlapping chunks
      const result = this.constructFromOverlapping(
        overlapping,
        clampedOffset,
        clampedLength,
      );
      if (result) {
        return result;
      }
    }

    // Not in cache, read from file
    return await this.readFromFile(clampedOffset, clampedLength);
  }

  /**
   * Seek to a position (for sources that need state)
   * @param offset The byte offset to seek to
   * @returns The actual offset seeked to
   */
  seek(offset: number): number {
    this.position = Math.max(0, Math.min(offset, this.size));
    return this.position;
  }

  /**
   * Get the current read position
   */
  getPosition(): number {
    return this.position;
  }

  /**
   * Get disk read stats for nerd stats overlay
   */
  getDiskStats(): { totalBytes: number; currentSpeed: number; elapsed: number } {
    // If no read in last 1s, speed is 0 (paused/idle)
    const timeSinceLastRead = this.lastSpeedTime > 0 ? (Date.now() - this.lastSpeedTime) / 1000 : 0;
    const speed = timeSinceLastRead > 1 ? 0 : this.currentReadSpeed;
    return {
      totalBytes: this.totalBytesRead,
      currentSpeed: speed,
      elapsed: this.readStartTime > 0 ? (Date.now() - this.readStartTime) / 1000 : 0,
    };
  }

  /**
   * Close the source and release resources
   */
  close(): void {
    // Clear cache entries for this source
    this.cache.clear();
    this.position = 0;
  }

  /**
   * Get a unique identifier for this source (used for caching)
   */
  getKey(): string {
    // Use file name, size, and last modified time as key
    return `file:${this.file.name}:${this.file.size}:${this.file.lastModified}`;
  }

  /**
   * Start preloading chunks into cache
   * This method is idempotent - multiple calls will share the same preload promise
   */
  private startPreload(): void {
    // Cancel existing preload if running
    if (this.preloadPromise) {
      // Let it continue, but it will check preloadOffset
      return;
    }

    // Start preloading in background (don't await)
    this.preloadPromise = this.preloadChunks();
  }

  /**
   * Preload chunks around current position (ahead for playback, behind for seeking)
   */
  private async preloadChunks(): Promise<void> {
    this.preloadAbort = false;

    try {
      const startOffset = this.preloadOffset > 0 ? this.preloadOffset : 0;
      const timeInfo =
        this.duration > 0 && this.currentTime > 0
          ? ` (time: ${this.currentTime.toFixed(2)}s / ${this.duration.toFixed(2)}s)`
          : "";
      Logger.debug(
        TAG,
        `Starting preload for file: ${this.file.name} around offset ${startOffset}${timeInfo} (${this.size} bytes)`,
      );

      // Preload only runs before playback starts (initial load).
      // During playback, demux reads fill the cache naturally.
      // If the entire file fits in cache, preload ALL chunks to avoid disk I/O
      // during playback (which causes stutter on 4K content with heavy processLoop).
      const totalChunks = Math.ceil(this.size / CHUNK_SIZE);
      const cacheMaxBytes = this.cache.getMaxSize();
      const fileFitsInCache = cacheMaxBytes > 0 && this.size < cacheMaxBytes * 0.8;
      const PRELOAD_AHEAD_CHUNKS = fileFitsInCache ? totalChunks : 20;
      const PRELOAD_BEHIND_CHUNKS = fileFitsInCache ? 0 : 5;

      // Calculate range to preload
      const startChunk = Math.floor(startOffset / CHUNK_SIZE);
      const aheadStart = fileFitsInCache ? 0 : startChunk;
      const aheadEnd = Math.min(
        (fileFitsInCache ? 0 : startChunk) + PRELOAD_AHEAD_CHUNKS,
        totalChunks,
      );
      const behindStart = Math.max(0, startChunk - PRELOAD_BEHIND_CHUNKS);
      const behindEnd = startChunk;

      // Preload ahead chunks first (for playback)
      for (let chunkIdx = aheadStart; chunkIdx < aheadEnd; chunkIdx++) {
        if (this.preloadAbort || await this.shouldStopPreload()) break;

        const offset = chunkIdx * CHUNK_SIZE;
        const chunkLength = Math.min(CHUNK_SIZE, this.size - offset);

        if (chunkLength <= 0) break;

        // Check if already cached
        const cached = this.cache.get(this.sourceKey, offset, chunkLength);
        if (cached) continue;

        // Read and cache chunk
        const chunk = await this.readChunkFromFile(offset, chunkLength);
        this.cache.set(this.sourceKey, offset, chunkLength, chunk);
      }

      // Preload behind chunks (for seeking backward)
      for (let chunkIdx = behindEnd - 1; chunkIdx >= behindStart; chunkIdx--) {
        if (this.preloadAbort || await this.shouldStopPreload()) break;

        const offset = chunkIdx * CHUNK_SIZE;
        const chunkLength = Math.min(CHUNK_SIZE, this.size - offset);

        if (chunkLength <= 0) continue;

        // Check if already cached
        const cached = this.cache.get(this.sourceKey, offset, chunkLength);
        if (cached) continue;

        // Read and cache chunk
        const chunk = await this.readChunkFromFile(offset, chunkLength);
        this.cache.set(this.sourceKey, offset, chunkLength, chunk);
      }

      if (!this.preloadAbort) {
        Logger.debug(
          TAG,
          `Preload completed for file: ${this.file.name} around offset ${startOffset}`,
        );
      }
    } catch (error) {
      Logger.error(TAG, `Failed to preload file: ${this.file.name}`, error);
    } finally {
      this.preloadPromise = null;
      this.preloadAbort = false;
      if (!this.preloadComplete) {
        this.preloadComplete = true;
        const cb = this.onPreloadCompleteCallback;
        this.onPreloadCompleteCallback = null;
        if (cb) cb();
      }
    }
  }

  /**
   * Check if preloading should stop (cache full)
   */
  private async shouldStopPreload(): Promise<boolean> {
    // Check if cache is nearly full (95% utilization)
    const utilization = this.cache.getUtilization();
    if (utilization >= 95) {
      Logger.debug(
        TAG,
        `Cache nearly full (${utilization.toFixed(1)}%), stopping preload`,
      );
      return true;
    }

    return false;
  }

  /**
   * Read a chunk from file and cache it
   *
   * Mobile browsers (iOS Safari, Android Chrome) can revoke the underlying File
   * handle after long backgrounding or under memory pressure. The Blob then
   * silently hangs on read instead of rejecting, which stalls the demuxer
   * forever. Race against a timeout and surface a clear error so the UI can
   * prompt the user to re-pick the file.
   */
  private async readChunkFromFile(
    offset: number,
    length: number,
  ): Promise<ArrayBuffer> {
    const blob = this.file.slice(offset, offset + length);
    const READ_TIMEOUT_MS = 8000;
    const reason = `FileSource read timeout (${READ_TIMEOUT_MS}ms) at offset=${offset} length=${length} — file handle likely revoked by browser; user must re-pick the file`;
    let arrayBuffer: ArrayBuffer;
    try {
      arrayBuffer = await Promise.race([
        blob.arrayBuffer(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(reason)), READ_TIMEOUT_MS),
        ),
      ]);
    } catch (err) {
      if (!this.revokedFired && this.onRevokedCallback) {
        this.revokedFired = true;
        try {
          this.onRevokedCallback({ offset, length, reason });
        } catch {
          // Don't let listener errors mask the original read failure
        }
      }
      throw err;
    }

    // Track disk read stats
    if (this.readStartTime === 0) {
      this.readStartTime = Date.now();
      this.lastSpeedTime = this.readStartTime;
    }
    this.totalBytesRead += arrayBuffer.byteLength;
    const now = Date.now();
    const elapsed = (now - this.lastSpeedTime) / 1000;
    if (elapsed >= 0.5) {
      this.currentReadSpeed = (this.totalBytesRead - this.lastSpeedBytes) / elapsed;
      this.lastSpeedBytes = this.totalBytesRead;
      this.lastSpeedTime = now;
    }

    return arrayBuffer;
  }

  /**
   * Read from file (not cached) and optionally cache it
   */
  /**
   * Read from file (not cached) and optionally cache it
   * Enforces strict CHUNK_SIZE alignment to prevent cache duplication
   */
  private async readFromFile(
    offset: number,
    length: number,
  ): Promise<ArrayBuffer> {
    const result = new ArrayBuffer(length);
    const resultView = new Uint8Array(result);

    // Calculate which standard chunks cover this range
    const startChunkIndex = Math.floor(offset / CHUNK_SIZE);
    const endChunkIndex = Math.floor((offset + length - 1) / CHUNK_SIZE);

    for (let i = startChunkIndex; i <= endChunkIndex; i++) {
      const chunkOffset = i * CHUNK_SIZE;
      const chunkLength = Math.min(CHUNK_SIZE, this.size - chunkOffset);

      if (chunkLength <= 0) break;

      // Try to get standard chunk from cache first
      let chunkData = this.cache.get(this.sourceKey, chunkOffset, chunkLength);

      if (!chunkData) {
        // Not in cache, read it from file
        chunkData = await this.readChunkFromFile(chunkOffset, chunkLength);
        // Cache the standard chunk
        this.cache.set(this.sourceKey, chunkOffset, chunkLength, chunkData);
      }

      // Copy relevant portion to result
      const overlapStart = Math.max(offset, chunkOffset);
      const overlapEnd = Math.min(offset + length, chunkOffset + chunkLength);

      if (overlapEnd > overlapStart) {
        const dstOffset = overlapStart - offset;
        const srcOffset = overlapStart - chunkOffset;
        const copyLength = overlapEnd - overlapStart;

        resultView.set(
          new Uint8Array(chunkData, srcOffset, copyLength),
          dstOffset,
        );
      }
    }

    return result;
  }

  /**
   * Construct result from overlapping cached chunks
   */
  private constructFromOverlapping(
    overlapping: Array<{ offset: number; length: number; data: ArrayBuffer }>,
    requestedOffset: number,
    requestedLength: number,
  ): ArrayBuffer | null {
    const requestedEnd = requestedOffset + requestedLength;
    const result = new ArrayBuffer(requestedLength);
    const resultView = new Uint8Array(result);
    let filled = 0;

    // Sort by offset
    overlapping.sort((a, b) => a.offset - b.offset);

    for (const chunk of overlapping) {
      const chunkEnd = chunk.offset + chunk.length;

      // Calculate overlap
      const overlapStart = Math.max(requestedOffset, chunk.offset);
      const overlapEnd = Math.min(requestedEnd, chunkEnd);

      if (overlapStart < overlapEnd) {
        const overlapLength = overlapEnd - overlapStart;
        const srcStart = overlapStart - chunk.offset;
        const dstStart = overlapStart - requestedOffset;

        resultView.set(
          new Uint8Array(chunk.data, srcStart, overlapLength),
          dstStart,
        );
        filled += overlapLength;
      }
    }

    // If we filled the entire request, return it
    if (filled === requestedLength) {
      return result;
    }

    // Partial fill, return null to trigger file read
    return null;
  }
}

/**
 * Factory function to create a FileSource
 */
export async function createFileSource(
  file: File,
  cache: LRUCache | null = null,
): Promise<FileSource> {
  const source = new FileSource(file, cache);
  // Start preloading chunks into cache
  await source.getSize();
  return source;
}
