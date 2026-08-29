/**
 * EncryptedHttpSource — ECDH + AES-GCM + HMAC protected playback
 *
 * Wire protocol:
 *   1. Client generates an ephemeral P-256 ECDH keypair. The private key is
 *      re-imported as non-extractable so `crypto.subtle.exportKey()` and
 *      `wrapKey()` both refuse — a DevTools-only attacker can't read it.
 *   2. On /api/token the client sends its public key. The server generates
 *      its own ephemeral keypair, wraps its private key with the server
 *      secret, embeds that + the client's pubkey inside a signed token,
 *      and returns its ephemeral public key. No raw session key bytes
 *      transit the wire in either direction.
 *   3. Both peers independently ECDH-derive the shared secret and
 *      HKDF-expand it into two sub-keys:
 *        - masterKey: AES-GCM 256, decrypt-only, non-extractable
 *        - hmacKey:   HMAC-SHA256, sign-only, non-extractable
 *   4. Each read() issues a signed GET to /api/video (HMAC covers
 *      token:nonce:timestamp:offset:length). The worker encrypts the
 *      upstream byte range with masterKey and returns
 *      [12-byte IV || ciphertext || 16-byte tag]. The client peels the
 *      IV, decrypts with the same non-extractable masterKey, and hands
 *      plaintext to the demuxer.
 *
 * Why inherit from HttpSource? Purely for a shared SourceAdapter shape
 * + the convenience of resolveSize() and getKey() defaults. The
 * streaming machinery HttpSource provides is NOT used here — encrypted
 * mode has to read one full range at a time (AES-GCM is authenticated
 * per message, so you can't decrypt arbitrary byte offsets inside a
 * ciphertext).
 */

import { HttpSource } from "./HttpSource";
import { Logger } from "../utils/Logger";

const TAG = "EncryptedSource";

export interface EncryptedSourceConfig {
  videoUrl: string;
  tokenUrl: string;
  /** The upstream source URL. MoviElement passes this through as `videoId`. */
  videoId: string;
  fingerprint: string;
  sessionToken: string;
  headers?: Record<string, string>;
  onAuthFailed?: (reason: string) => void;
}

interface TokenResponse {
  token: string;
  expiresAt: number;
  fileSize: number;
  chunkSize: number;
  /** Raw (uncompressed) P-256 public key, base64. */
  serverPubKey: string;
  /**
   * Pre-parsed filename from the upstream's Content-Disposition header.
   * The worker probes this during token issuance so we avoid a second
   * HEAD on the client (and so encrypted mode has a reliable path to
   * the real filename for the title overlay).
   */
  contentDispositionFilename?: string | null;
  /**
   * Per-token random HKDF salt (base64). Folded into both HKDF expansions
   * so the session keys are unique even if two tokens ever derive from
   * the same ECDH shared secret (e.g. reused client keypair + identical
   * server keypair — astronomically unlikely but cheap defense-in-depth).
   * Older tokens without this field fall back to a zero salt.
   */
  hkdfSalt?: string;
}

function b64Encode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function b64Decode(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  // Allocate the ArrayBuffer explicitly so the view type is
  // `Uint8Array<ArrayBuffer>` rather than `Uint8Array<ArrayBufferLike>`
  // — the latter trips Web Crypto's BufferSource<ArrayBuffer> overloads
  // under strict DOM types.
  const ab = new ArrayBuffer(bin.length);
  const out = new Uint8Array(ab);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

export class EncryptedHttpSource extends HttpSource {
  private readonly _encConfig: EncryptedSourceConfig;

  // Ephemeral ECDH key material — private key is non-extractable.
  private _cryptoReady: Promise<void>;
  private _clientPrivKey: CryptoKey | null = null;
  private _clientPubB64: string = "";

  // Per-session state derived from ECDH shared secret.
  private _masterKey: CryptoKey | null = null;
  private _hmacKey: CryptoKey | null = null;
  private _token: string = "";
  private _expiresAt: number = 0;
  private _knownFileSize: number = -1;
  private _encContentDispositionFilename: string | null = null;

  private _tokenRefresh: Promise<void> | null = null;
  private readonly _usedNonces = new Set<string>();

  // Aborts all outstanding fetch()es (streams + token refreshes) when
  // close() fires. Without this, in-flight stream readers keep draining
  // the network after the player is disposed — wasted bandwidth and
  // a small leak of worker CPU on the server side.
  private readonly _abortCtrl = new AbortController();

  // Latches to true the first time the server returns 401/403 so the
  // background prefetch loop stops kicking off new streams that will
  // just generate more auth-failure callbacks.
  private _authFailed: boolean = false;

  // Per-block plaintext cache. The demuxer issues many tiny reads while
  // parsing metadata (EBML headers, MP4 atoms, MKV Cues etc.) — without
  // a cache each one would become its own token-signed fetch + AES-GCM
  // round-trip, which is both slow and wasteful of worker quota. Worker
  // emits an aligned frame per BLOCK_SIZE bytes of plaintext, so one
  // response stream can fill many blocks in sequence.
  private static readonly BLOCK_SIZE = 2 * 1024 * 1024;
  private static readonly MAX_CACHED_BLOCKS = 160; // ≈ 320 MB hot window
  // Per-stream payload = 17 blocks = 34 MB. Big enough to amortize
  // HTTP setup (token/HMAC/ECDH on the worker) but small enough that
  // the end-of-file metadata probe on a reasonably sized movie file
  // (> 34 MB, so > a few seconds long) falls in a different stream
  // than the head, letting it decrypt in parallel instead of queuing
  // behind every frame of the head stream.
  private static readonly READAHEAD_BLOCKS = 16;
  // Refill thresholds + concurrency cap. LOW_WATER = 32 blocks (64 MB)
  // means prefetch keeps firing until we have 64+ MB of cached-or-
  // inflight data ahead of playback. HIGH_WATER caps the scan horizon
  // and the depth we'll try to build. Multiple streams get fired in
  // one maybePrefetch() pass — that's what yields the HttpSource-like
  // "100+ MB buffered ahead" window instead of the one-stream-at-a-
  // time ladder we had before.
  private static readonly PREFETCH_LOW_WATER = 32;  //  64 MB — trigger refill
  private static readonly PREFETCH_HIGH_WATER = 96; // 192 MB — aim depth
  // Hard cap on streams running in parallel. Observed upstream behavior:
  // with 3+ concurrent token-signed streams from the same session, the
  // server truncates responses (206 with near-empty body, logs show
  // "delivered [N..N-1]" i.e. zero blocks). Capping at 2 keeps one
  // foreground demuxer stream + one background prefetch stream without
  // tripping that limit. maybePrefetch honors this cap directly; the
  // stale-stream abort in fetchBlock drops us back under it whenever a
  // far seek happens.
  private static readonly MAX_CONCURRENT_STREAMS = 2;

  // Per-instance override for prefetch depth + cache cap. Populated by
  // MoviElement when the `buffersize` attribute is set — lets callers
  // dial the window up (deep-scrub / low-latency seek) or down (memory-
  // constrained embeds) without forking the library. Defaults to the
  // static class values.
  private _maxCachedBlocks: number = EncryptedHttpSource.MAX_CACHED_BLOCKS;
  private _prefetchLowWater: number = EncryptedHttpSource.PREFETCH_LOW_WATER;
  private _prefetchHighWater: number = EncryptedHttpSource.PREFETCH_HIGH_WATER;
  private _lastReadEnd: number = 0;
  private readonly _blockCache = new Map<number, Uint8Array>();
  // Each block fetch is async — dedupe in-flight requests so parallel
  // reads for the same block share one HTTP round-trip.
  private readonly _blockInflight = new Map<number, Promise<Uint8Array>>();

  // Tracks every stream currently fetching from /api/video so we can
  // cancel stale ones when the user seeks away from their range. A
  // rapid scrub through a long file would otherwise pile up N in-flight
  // streams — all competing for worker CPU + upstream bandwidth — even
  // though only the latest seek's range is actually going to be played.
  private readonly _activeStreams = new Set<{
    firstBlock: number;
    lastBlock: number;
    abortCtrl: AbortController;
    // Reference to the stream's resolvers map. Undelivered entries mean
    // someone is still awaiting blocks from this stream — aborting would
    // reject their await with AbortError. Used by the stale-window and
    // cap-eviction logic in fetchBlock to skip streams that are still
    // actively serving consumers (e.g. a hover thumbnail request).
    resolvers: Map<number, { resolve: (v: Uint8Array) => void; reject: (e: unknown) => void }>;
  }>();

  constructor(config: EncryptedSourceConfig) {
    super(config.videoUrl, config.headers ?? {});
    this._encConfig = config;
    this._cryptoReady = this.initCrypto();
    Logger.info(TAG, "Created (ECDH protected)");
  }

  // ─── ECDH init ─────────────────────────────────────────────────

  private async initCrypto(): Promise<void> {
    // Generate ephemeral keypair as extractable, export the public key,
    // then re-import the private key with extractable=false. This is the
    // only way in WebCrypto to end up with an exportable public key AND a
    // non-extractable private key — generateKey applies one flag to both.
    const pair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"],
    );
    const pubRaw = new Uint8Array(
      await crypto.subtle.exportKey("raw", pair.publicKey),
    );
    this._clientPubB64 = b64Encode(pubRaw);

    const privPkcs8 = await crypto.subtle.exportKey("pkcs8", pair.privateKey);
    this._clientPrivKey = await crypto.subtle.importKey(
      "pkcs8",
      privPkcs8,
      { name: "ECDH", namedCurve: "P-256" },
      false,
      ["deriveBits"],
    );
  }

  // ─── HttpSource hook overrides ─────────────────────────────────

  protected async resolveSize(): Promise<number> {
    await this.ensureValidToken();
    if (this._knownFileSize < 0) {
      throw new Error("Token did not include fileSize");
    }
    return this._knownFileSize;
  }

  // HttpSource's streaming pipeline would try to read/write a shared
  // buffer with raw ciphertext bytes — unusable. We override read() to
  // fetch in aligned plaintext blocks, decrypt once per block, and
  // satisfy the demuxer's many small reads out of the resulting cache.
  async read(offset: number, length: number): Promise<ArrayBuffer> {
    const clampedOffset = Math.max(0, offset);
    let clampedLength = Math.max(0, length);
    if (clampedLength === 0) return new ArrayBuffer(0);

    // Clamp to file size so we never ask for bytes past EOF. Without
    // this, a read at offset=fileSize-64KB + length=512KB computes a
    // lastBlock that's beyond the last real block; fetchBlock() then
    // starts a stream with firstBlock > lastBlock (negative range) and
    // the worker returns 400. Trim the request to what actually exists.
    if (this._knownFileSize > 0) {
      if (clampedOffset >= this._knownFileSize) return new ArrayBuffer(0);
      clampedLength = Math.min(
        clampedLength,
        this._knownFileSize - clampedOffset,
      );
      if (clampedLength <= 0) return new ArrayBuffer(0);
    }

    const BLOCK = EncryptedHttpSource.BLOCK_SIZE;
    const firstBlock = Math.floor(clampedOffset / BLOCK);
    const lastBlock = Math.floor(
      (clampedOffset + clampedLength - 1) / BLOCK,
    );

    // Snap the cursor to the NEW read position synchronously, before
    // awaiting any fetchBlock() call. The UI polls getBufferedEnd on a
    // ~10 Hz timer — if we only updated _lastReadEnd after awaiting,
    // every seek would leave the cursor pointing at the pre-seek block
    // for the 500–2000ms it takes a new stream to open. During that
    // window getBufferedEnd walks from a stale anchor, finds no
    // contiguous cache around it, returns 0, and the progress bar's
    // Math.max(bufferedTime, currentTime) collapses to currentTime —
    // making buffer and progress visually identical. Moving the assign
    // here means inflight blocks (registered synchronously by
    // fetchBlock) are visible to the very next UI poll.
    this._lastReadEnd = clampedOffset + clampedLength;
    // Keep parent's position field in sync so downstream callers of
    // source.getPosition() (e.g. MoviPlayer.getBufferedTime computing
    // forward-buffered delta) see the real read cursor. Encrypted mode
    // bypasses parent's readFromBuffer which would normally update it.
    // Calls parent's public seek(); no streaming side effects.
    this.seek(this._lastReadEnd);

    const readStart = performance.now();
    const cacheHits = [];
    const misses = [];
    for (let b = firstBlock; b <= lastBlock; b++) {
      if (this._blockCache.has(b)) cacheHits.push(b);
      else misses.push(b);
    }
    console.log(
      `[EncSrc] read offset=${clampedOffset} len=${clampedLength} blocks=[${firstBlock}..${lastBlock}] hits=${cacheHits.length} misses=${misses.length}${misses.length ? ` missBlocks=${misses.join(",")}` : ""}`,
    );

    // Fetch all overlapping blocks sequentially; each fetchBlock dedupes
    // concurrent requests for the same block via `blockInflight`.
    // Observed upstream behavior: token-signed streams occasionally
    // return 206 with an empty/near-empty body — streamBlocks rejects
    // with "Stream ended before block N" and clears the inflight entry.
    // A bounded retry loop here pulls those failures inside the read,
    // so the caller (and the demuxer above it) see a successful read
    // once any attempt delivers. AbortError is included for the same
    // reason — a concurrent fetchBlock may abort a stream mid-way.
    // No per-block retry/cooldown here. Transient truncations surface
    // to the caller (demuxer processLoop / thumbnail pipeline) which
    // already retries on its own schedule. An in-read retry loop
    // re-issues the same deterministically-broken range back-to-back
    // and only wastes time; a persistent-failure cooldown blocks main
    // playback if block 0 ever has a hiccup, since the encrypted
    // source is shared between playback and thumbnails.
    const blocks: Uint8Array[] = [];
    for (let b = firstBlock; b <= lastBlock; b++) {
      blocks.push(await this.fetchBlock(b));
    }

    const readElapsed = performance.now() - readStart;
    if (readElapsed > 100) {
      console.log(
        `[EncSrc] read DONE offset=${clampedOffset} blocks=[${firstBlock}..${lastBlock}] took ${readElapsed.toFixed(0)}ms`,
      );
    }

    // Assemble the requested slice across the returned blocks.
    const out = new Uint8Array(clampedLength);
    let written = 0;
    for (let b = firstBlock; b <= lastBlock; b++) {
      const block = blocks[b - firstBlock];
      const blockStart = b * BLOCK;
      // Requested byte range intersected with this block's byte range.
      const sliceStart = Math.max(0, clampedOffset - blockStart);
      const sliceEnd = Math.min(
        block.length,
        clampedOffset + clampedLength - blockStart,
      );
      if (sliceEnd <= sliceStart) continue;
      const piece = block.subarray(sliceStart, sliceEnd);
      out.set(piece, written);
      written += piece.length;
    }

    // Top up the prefetch window if it's run low. Fire-and-forget —
    // the stream just fills the cache in the background. Use actual
    // bytes written (may be short at EOF) so prefetch doesn't aim
    // past the end of the file. The cursor itself was already snapped
    // to the requested range above, before the await.
    const readEnd = clampedOffset + written;
    this.maybePrefetch(readEnd);

    // If the tail fell off the end of file, shrink the output buffer
    // down to the bytes we actually produced.
    return written === clampedLength
      ? out.buffer
      : out.slice(0, written).buffer;
  }

  /**
   * Keep a continuous window of cached/inflight blocks ahead of the
   * latest read. When the contiguous run drops below PREFETCH_LOW_WATER,
   * fetchBlock() at the gap kicks off a new stream (which itself grabs
   * READAHEAD_BLOCKS), refilling up to PREFETCH_HIGH_WATER.
   */
  private maybePrefetch(highWater: number): void {
    // Once an auth failure has fired, there's no point kicking off more
    // streams — they'll all 401/403 and fire the callback again. The
    // foreground read() will hit the same wall and surface the error
    // through its own promise chain.
    if (this._authFailed) return;

    const BLOCK = EncryptedHttpSource.BLOCK_SIZE;
    if (this._knownFileSize > 0 && highWater >= this._knownFileSize) return;

    const currentBlock = Math.floor(highWater / BLOCK);
    const maxBlock =
      this._knownFileSize > 0
        ? Math.floor((this._knownFileSize - 1) / BLOCK)
        : currentBlock + this._prefetchHighWater;

    // Loop: fire multiple streams in one pass until either
    //   (a) the contiguous cached-or-inflight window meets LOW_WATER, or
    //   (b) we've hit the concurrent-stream cap, or
    //   (c) we've scanned all the way out to HIGH_WATER with no gaps.
    //
    // Firing ONE prefetch per read (the old behavior) topped out at
    // ~1 stream's worth of lead beyond playback — HttpSource maintains
    // ~250 MB via its long-lived range GET, so encrypted mode needs
    // to open several streams in parallel to visually match.
    for (;;) {
      if (this._activeStreams.size >= EncryptedHttpSource.MAX_CONCURRENT_STREAMS) return;

      const limit = Math.min(
        maxBlock,
        currentBlock + this._prefetchHighWater,
      );
      let firstGap = -1;
      for (let b = currentBlock; b <= limit; b++) {
        if (!this._blockCache.has(b) && !this._blockInflight.has(b)) {
          firstGap = b;
          break;
        }
      }
      if (firstGap < 0) return; // fully topped up within HIGH_WATER

      const contiguous = firstGap - currentBlock;
      if (contiguous >= this._prefetchLowWater) return;

      // fetchBlock() registers inflight entries synchronously, so the
      // next loop iteration sees the new range and advances firstGap
      // past it — giving us a sequence of overlapping streams that
      // together satisfy HIGH_WATER.
      this.fetchBlock(firstGap).catch(() => {
        /* background prefetch failures are non-fatal */
      });
    }
  }

  /**
   * Report the furthest byte offset currently cached as a contiguous
   * run from the START of the file. HttpSource exposes the same method
   * so the player UI's buffer bar can reflect both modes uniformly.
   *
   * Only count blocks reachable linearly from block 0 without a gap.
   * Blocks cached by a tail-of-file probe (MKV Cues / MP4 moov at end)
   * are intentionally ignored here — if we counted them, a demuxer
   * metadata pass would show "100% buffered" while 95% of the file is
   * actually not cached and every seek would round-trip. The player
   * UI's seek-is-instant hint relies on this being honest.
   */
  getBufferedEnd(): number {
    const BLOCK = EncryptedHttpSource.BLOCK_SIZE;
    // Report the end of the contiguous cached-or-inflight run containing
    // the current read cursor. Scanning from block 0 doesn't work here:
    // demuxers probe the end of the file for MKV Cues / MP4 moov, which
    // leaves cache gaps between the file head and the tail. A from-zero
    // walk would stop at the first gap and under-report everything the
    // prefetch has actually buffered ahead of playback.
    //
    // Inflight blocks count as "buffered" for display purposes — they'll
    // land in the cache shortly and the UI should reflect the full
    // download window the user has already waited for, not just the
    // slice that's finished decrypting at this exact moment. Without
    // this, the buffer bar shows only ~1 stream's worth of lead after
    // a seek (the current stream's cached portion) and hides the
    // prefetch stream that's already flying behind it.
    const cursorBlock = Math.floor(this._lastReadEnd / BLOCK);
    const isBuffered = (b: number) =>
      this._blockCache.has(b) || this._blockInflight.has(b);

    // Anchor: prefer the cursor block itself. If it's uncached (happens
    // right after crossing a block boundary while the next block is
    // still pending, or briefly during an end-of-file probe), fall back
    // to the nearest buffered block behind it. Without this fallback
    // the UI buffer bar would flicker to zero every time playback
    // crossed a 2 MB boundary.
    let anchor = cursorBlock;
    if (!isBuffered(anchor)) {
      anchor = -1;
      const lookback = Math.max(0, cursorBlock - 3);
      for (let b = cursorBlock - 1; b >= lookback; b--) {
        if (isBuffered(b)) {
          anchor = b;
          break;
        }
      }
      if (anchor < 0) return 0;
    }

    let last = anchor;
    for (let b = anchor + 1; isBuffered(b); b++) last = b;

    const candidate = (last + 1) * BLOCK;
    return this._knownFileSize > 0
      ? Math.min(candidate, this._knownFileSize)
      : candidate;
  }

  /**
   * Override prefetch depth and cache cap at runtime. `megabytes` is the
   * target "buffer ahead of playback" window the caller wants the
   * player to maintain — encrypted mode translates that to an
   * equivalent number of 2 MB blocks for HIGH_WATER, sets LOW_WATER to
   * roughly half (so refill kicks in before we burn through what's
   * buffered), and grows the cache cap to comfortably hold the target
   * plus a bit of eviction headroom.
   *
   * Ignored if the requested size is non-positive. Takes effect on the
   * NEXT maybePrefetch() call (typically the next read), no re-init
   * needed. MoviElement wires this up through its `buffersize`
   * attribute so a consumer can tune deployment-specific memory /
   * responsiveness trade-offs without forking.
   */
  setMaxBufferSize(megabytes: number): void {
    if (!(megabytes > 0)) return;
    const BLOCK_MB = EncryptedHttpSource.BLOCK_SIZE / (1024 * 1024); // 2
    const highWaterBlocks = Math.max(4, Math.floor(megabytes / BLOCK_MB));
    this._prefetchHighWater = highWaterBlocks;
    this._prefetchLowWater = Math.max(2, Math.floor(highWaterBlocks / 2));
    // Cache cap needs to hold the target buffer plus some room for
    // recently-played blocks (helpful for small backward scrubs). 1.5x
    // of the target window is a reasonable default.
    this._maxCachedBlocks = Math.max(
      EncryptedHttpSource.MAX_CACHED_BLOCKS,
      Math.floor(highWaterBlocks * 1.5),
    );
  }

  /**
   * Fetch one BLOCK_SIZE-aligned plaintext window. If it isn't already
   * cached or inflight, open a *streaming* fetch that spans this block
   * plus several look-ahead blocks — the worker emits one AES-GCM frame
   * per block back-to-back, and the reader below decrypts each frame as
   * it arrives, filling the cache progressively. This mirrors the way
   * HttpSource holds one long range GET open instead of starting a new
   * request per read.
   */
  private async fetchBlock(blockIndex: number): Promise<Uint8Array> {
    const cached = this._blockCache.get(blockIndex);
    if (cached) return cached;
    const existing = this._blockInflight.get(blockIndex);
    if (existing) {
      console.log(`[EncSrc] fetchBlock(${blockIndex}) awaiting existing inflight`);
      return existing;
    }

    // Start a streaming fetch covering [blockIndex, blockIndex + READAHEAD].
    // All blocks in that window that aren't already cached/inflight get
    // a shared promise resolved as their frame is decrypted.
    const firstBlock = blockIndex;
    let lastBlock = blockIndex + EncryptedHttpSource.READAHEAD_BLOCKS;
    if (this._knownFileSize > 0) {
      const maxBlock = Math.floor(
        (this._knownFileSize - 1) / EncryptedHttpSource.BLOCK_SIZE,
      );
      if (lastBlock > maxBlock) lastBlock = maxBlock;
    }

    console.log(
      `[EncSrc] fetchBlock(${blockIndex}) → NEW stream [${firstBlock}..${lastBlock}] (cache=${this._blockCache.size}, inflight=${this._blockInflight.size}, activeStreams=${this._activeStreams.size})`,
    );

    // Cancel any in-flight stream whose range is far enough from this
    // new block that a user-visible seek must have happened AND which
    // has no remaining consumers. A stream with undelivered resolvers
    // has someone awaiting its blocks (thumbnail hover, demuxer read
    // across blocks); aborting it rejects their await with AbortError.
    // The stale-window heuristic only judges by range distance, which
    // is wrong for legitimate reads at far offsets — previously, a
    // hover thumbnail read at block 413 would get aborted the moment
    // playback prefetched block 21 because 413 fell outside playback's
    // keep window. Skip those; only retire streams whose blocks are
    // all delivered (no one awaiting, free to cancel the leftover body).
    const keepWindowStart = firstBlock - 8;
    const keepWindowEnd = lastBlock + EncryptedHttpSource.PREFETCH_HIGH_WATER;
    for (const active of this._activeStreams) {
      if (
        active.lastBlock < keepWindowStart ||
        active.firstBlock > keepWindowEnd
      ) {
        if (active.resolvers.size > 0) {
          // Someone is still awaiting blocks here — leave it alone.
          continue;
        }
        console.log(
          `[EncSrc] Aborting stale stream [${active.firstBlock}..${active.lastBlock}] — outside [${keepWindowStart}..${keepWindowEnd}]`,
        );
        try { active.abortCtrl.abort(); } catch { /* noop */ }
      }
    }

    // Hard concurrency cap: the upstream server truncates responses when
    // too many token-signed streams are open on the same session. If the
    // stale-window abort above didn't get us under the cap, evict the
    // oldest surviving stream — but only if its resolvers are empty
    // (already delivered everything). Evicting a stream with pending
    // awaiters would break those reads. If every active stream still
    // has consumers, accept the temporary over-cap rather than cause
    // cascading read failures.
    if (
      this._activeStreams.size >= EncryptedHttpSource.MAX_CONCURRENT_STREAMS
    ) {
      for (const s of this._activeStreams) {
        if (s.resolvers.size !== 0) continue;
        console.log(
          `[EncSrc] Evicting active stream [${s.firstBlock}..${s.lastBlock}] to stay under concurrent cap`,
        );
        try { s.abortCtrl.abort(); } catch { /* noop */ }
        this._activeStreams.delete(s);
        if (this._activeStreams.size < EncryptedHttpSource.MAX_CONCURRENT_STREAMS) break;
      }
    }

    const resolvers = new Map<number, {
      resolve: (v: Uint8Array) => void;
      reject: (e: unknown) => void;
    }>();
    for (let b = firstBlock; b <= lastBlock; b++) {
      if (this._blockCache.has(b) || this._blockInflight.has(b)) continue;
      const p = new Promise<Uint8Array>((resolve, reject) => {
        resolvers.set(b, { resolve, reject });
      });
      // Silence "unhandled rejection" for prefetch blocks that nothing
      // ends up awaiting — they reject en masse whenever a seek aborts
      // an in-flight stream, which was flooding DevTools. Real awaiters
      // (read() caller for their own block, or a dedupe hit on the same
      // promise) still see the rejection through their own chain.
      p.catch(() => { /* prefetch rejection — owner handles its own */ });
      this._blockInflight.set(b, p);
    }

    // Kick off the background pump. Don't await — subscribers await their
    // individual per-block promises below.
    this.streamBlocks(firstBlock, lastBlock, resolvers).catch((err) => {
      for (const [b, r] of resolvers) {
        r.reject(err);
        this._blockInflight.delete(b);
      }
    });

    // Inflight map now has the promise for blockIndex; hand it back.
    return this._blockInflight.get(blockIndex) ?? Promise.reject(
      new Error("block was neither cached nor inflight"),
    );
  }

  /**
   * Open one token-signed /api/video GET spanning the full block range,
   * read the framed AES-GCM response body, decrypt each frame into the
   * cache, and resolve the per-block inflight promises as they land.
   */
  private async streamBlocks(
    firstBlock: number,
    lastBlock: number,
    resolvers: Map<number, {
      resolve: (v: Uint8Array) => void;
      reject: (e: unknown) => void;
    }>,
  ): Promise<void> {
    const streamId = Math.floor(Math.random() * 10000);
    const tStreamStart = performance.now();
    console.log(`[EncSrc] stream#${streamId} START [${firstBlock}..${lastBlock}] ensuring token...`);

    // Per-stream AbortController chained to the master close() signal.
    // Using a dedicated controller lets fetchBlock cancel this stream
    // individually when the user seeks away from its range, while still
    // honoring close() at the instance level.
    const streamAbort = new AbortController();
    const masterAbort = this._abortCtrl;
    const onMasterAbort = () => streamAbort.abort();
    if (masterAbort.signal.aborted) streamAbort.abort();
    else masterAbort.signal.addEventListener("abort", onMasterAbort);
    const streamCtx = { firstBlock, lastBlock, abortCtrl: streamAbort, resolvers };
    this._activeStreams.add(streamCtx);

    await this.ensureValidToken();
    if (!this._masterKey || !this._hmacKey) {
      this._activeStreams.delete(streamCtx);
      masterAbort.signal.removeEventListener("abort", onMasterAbort);
      throw new Error("Session keys unavailable");
    }

    // Snapshot the session keys + token at stream start. A token refresh
    // mid-stream will swap this._masterKey / this._hmacKey to a fresh ECDH
    // derivation, but the server is still encrypting this stream's frames
    // with the pre-refresh key. Decrypting those frames with the new
    // key would fail and show as periodic buffering. Keeping our own
    // snapshot isolates in-flight streams from refresh churn.
    const streamMasterKey = this._masterKey;
    const streamToken = this._token;
    const streamHmacKey = this._hmacKey;

    const BLOCK = EncryptedHttpSource.BLOCK_SIZE;
    const start = firstBlock * BLOCK;
    let end = (lastBlock + 1) * BLOCK - 1;
    if (this._knownFileSize > 0) {
      end = Math.min(end, this._knownFileSize - 1);
    }
    const length = end - start + 1;
    console.log(`[EncSrc] stream#${streamId} token ready (${(performance.now() - tStreamStart).toFixed(0)}ms), range=${start}-${end} (${(length / 1024 / 1024).toFixed(1)} MB)`);

    const nonce = this.generateNonce();
    const timestamp = Date.now();
    // Method is part of the signed message (server binds to `request.method`)
    // — this pins the signature to GET specifically so a captured tuple
    // can't be replayed as HEAD (or vice-versa).
    const method = "GET";
    const message = `${method}:${streamToken}:${nonce}:${timestamp}:${start}:${length}`;
    const sigBytes = new Uint8Array(
      await crypto.subtle.sign(
        "HMAC",
        streamHmacKey,
        new TextEncoder().encode(message),
      ),
    );

    const tFetchStart = performance.now();
    const response = await fetch(this._encConfig.videoUrl, {
      method: "GET",
      headers: {
        Range: `bytes=${start}-${end}`,
        "X-Token": streamToken,
        "X-Fingerprint": this._encConfig.fingerprint,
        "X-Nonce": nonce,
        "X-Timestamp": String(timestamp),
        "X-Signature": bytesToHex(sigBytes),
        ...this._encConfig.headers,
      },
      credentials: "include",
      signal: streamAbort.signal,
    });
    console.log(`[EncSrc] stream#${streamId} fetch() returned ${response.status} in ${(performance.now() - tFetchStart).toFixed(0)}ms`);

    if (response.status === 401 || response.status === 403) {
      this._token = "";
      this._expiresAt = 0;
      this._authFailed = true;
      this._encConfig.onAuthFailed?.(`Auth failed: ${response.status}`);
      throw new Error(`Auth failed: ${response.status}`);
    }
    if ((!response.ok && response.status !== 206) || !response.body) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    // Rolling buffer of bytes we've read but not yet parsed into frames.
    let buf = new Uint8Array(0);
    let currentBlock = firstBlock;

    const commitBlock = (plain: Uint8Array) => {
      const tCommit = performance.now();
      this._blockCache.set(currentBlock, plain);
      if (this._blockCache.size > this._maxCachedBlocks) {
        const oldest = this._blockCache.keys().next().value;
        if (oldest !== undefined) this._blockCache.delete(oldest);
      }
      const r = resolvers.get(currentBlock);
      const hadResolver = !!r;
      if (r) {
        r.resolve(plain);
        resolvers.delete(currentBlock);
      }
      this._blockInflight.delete(currentBlock);
      console.log(
        `[EncSrc] stream#${streamId} commit block=${currentBlock}${hadResolver ? " (resolver fired)" : ""} @ ${(tCommit - tStreamStart).toFixed(0)}ms since stream start`,
      );
      currentBlock++;
    };

    // Chained-commit pipeline. Each parsed frame kicks an AES-GCM decrypt
    // immediately (no await), while commits are serialized through a
    // promise chain so blocks land in the cache in the same order the
    // worker emitted them. The prior design only committed a frame when
    // the NEXT frame showed up to trigger a drain, which bit hard on
    // seek: the seek-target block would sit in the pipeline finished-
    // but-uncommitted for the entire duration of the following frame's
    // network read. Chained commits fire as soon as each decrypt
    // resolves, independent of whether more frames are still arriving.
    const MAX_IN_FLIGHT = 2;
    let inFlightCount = 0;
    let commitChain: Promise<void> = Promise.resolve();

    const kickFrame = (iv: Uint8Array<ArrayBuffer>, ctTag: Uint8Array<ArrayBuffer>) => {
      // Use the snapshotted stream key — not this._masterKey, which may
      // have been rotated by a mid-stream token refresh.
      const decrypt = crypto.subtle
        .decrypt({ name: "AES-GCM", iv }, streamMasterKey, ctTag)
        .then((pt) => new Uint8Array(pt));
      inFlightCount++;
      commitChain = commitChain.then(async () => {
        const plain = await decrypt;
        commitBlock(plain);
        inFlightCount--;
      });
    };

    let firstByteLogged = false;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (value && value.length > 0) {
          if (!firstByteLogged) {
            console.log(`[EncSrc] stream#${streamId} first bytes (${value.length}B) @ ${(performance.now() - tStreamStart).toFixed(0)}ms since start`);
            firstByteLogged = true;
          }
          const merged = new Uint8Array(buf.length + value.length);
          merged.set(buf, 0);
          merged.set(value, buf.length);
          buf = merged;
        }

        while (buf.length >= 4) {
          const frameLen = new DataView(
            buf.buffer,
            buf.byteOffset,
            4,
          ).getUint32(0, false);
          if (buf.length < 4 + frameLen) break;
          // Copy IV/CT out of `buf` — the chained decrypt may outlive
          // the next buf = buf.slice(...) reassignment, so we want
          // owned memory rather than views into the rolling buffer.
          // Allocate explicit ArrayBuffers so the Uint8Arrays satisfy
          // Web Crypto's BufferSource<ArrayBuffer> overload under
          // strict DOM types (buf.slice() loses the specificity).
          const iv = new Uint8Array(new ArrayBuffer(12));
          iv.set(buf.subarray(4, 16));
          const ctLen = frameLen - 12;
          const ctTag = new Uint8Array(new ArrayBuffer(ctLen));
          ctTag.set(buf.subarray(16, 4 + frameLen));
          buf = buf.slice(4 + frameLen);

          // Backpressure BEFORE kicking the next frame so in-flight
          // plaintext memory stays bounded to MAX_IN_FLIGHT * 2 MB.
          // Awaiting the chain tip yields until at least one prior
          // commit has landed, which drops inFlightCount by one.
          while (inFlightCount >= MAX_IN_FLIGHT) {
            await commitChain;
          }
          kickFrame(iv, ctTag);
        }

        if (done) break;
      }
      // Make sure every kicked commit has landed before we declare the
      // stream done — stragglers below reject any blocks the worker
      // didn't actually deliver.
      await commitChain;
      console.log(`[EncSrc] stream#${streamId} END total=${(performance.now() - tStreamStart).toFixed(0)}ms, delivered [${firstBlock}..${currentBlock - 1}]`);
    } finally {
      try { reader.releaseLock(); } catch { /* noop */ }
      this._activeStreams.delete(streamCtx);
      masterAbort.signal.removeEventListener("abort", onMasterAbort);
    }

    // Reject anyone still waiting — the stream ended without producing
    // their frame (shouldn't happen unless the server truncates).
    for (const [b, r] of resolvers) {
      r.reject(new Error(`Stream ended before block ${b}`));
      this._blockInflight.delete(b);
    }
  }

  getKey(): string {
    return `encrypted:${this._encConfig.videoId}`;
  }

  /**
   * Expose the upstream Content-Disposition filename the worker
   * captured during token issuance. HttpSource's version reads from its
   * own HEAD-populated field which we never fill in encrypted mode, so
   * we override to return the token-issued value.
   */
  getContentDispositionFilename(): string | null {
    return this._encContentDispositionFilename;
  }

  close(): void {
    // Cancel any in-flight streams/token refreshes. Without this, a
    // long-running range GET would keep reading from the server after
    // the player is disposed — wasted bandwidth on both sides.
    try { this._abortCtrl.abort(); } catch { /* noop */ }
    // Drop all CryptoKey references so browser can GC them. The keys are
    // non-extractable so there's no raw-bytes cleanup to do on our side.
    this._token = "";
    this._expiresAt = 0;
    this._masterKey = null;
    this._hmacKey = null;
    this._clientPrivKey = null;
    this._usedNonces.clear();
    this._blockCache.clear();
    this._blockInflight.clear();
    // Let HttpSource release its (unused) stream/buffer state.
    super.close();
    Logger.info(TAG, "Closed");
  }

  // ─── Token refresh + ECDH derivation ────────────────────────────

  private async ensureValidToken(): Promise<void> {
    const safetyMs = 500;
    if (this._token && Date.now() + safetyMs < this._expiresAt) return;

    if (!this._tokenRefresh) {
      this._tokenRefresh = this.refreshToken().finally(() => {
        this._tokenRefresh = null;
      });
    }
    await this._tokenRefresh;
  }

  private async refreshToken(): Promise<void> {
    await this._cryptoReady;
    if (!this._clientPrivKey || !this._clientPubB64) {
      throw new Error("Client ECDH keypair not ready");
    }

    const response = await fetch(this._encConfig.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this._encConfig.sessionToken}`,
        ...this._encConfig.headers,
      },
      body: JSON.stringify({
        url: this._encConfig.videoId,
        videoId: this._encConfig.videoId,
        fingerprint: this._encConfig.fingerprint,
        clientPubKey: this._clientPubB64,
      }),
      credentials: "include",
      signal: this._abortCtrl.signal,
    });

    if (!response.ok) {
      const reason = `Token request failed: ${response.status}`;
      Logger.error(TAG, reason);
      this._encConfig.onAuthFailed?.(reason);
      throw new Error(reason);
    }

    const data = (await response.json()) as TokenResponse;
    this._token = data.token;
    this._expiresAt = data.expiresAt;
    if (this._knownFileSize < 0 && typeof data.fileSize === "number") {
      this._knownFileSize = data.fileSize;
    }
    if (
      !this._encContentDispositionFilename &&
      typeof data.contentDispositionFilename === "string" &&
      data.contentDispositionFilename
    ) {
      this._encContentDispositionFilename = data.contentDispositionFilename;
    }

    // Derive shared secret from the server's ephemeral public key, then
    // HKDF-expand it into two domain-separated sub-keys. Both end up as
    // non-extractable CryptoKey handles.
    const serverPubKey = await crypto.subtle.importKey(
      "raw",
      b64Decode(data.serverPubKey),
      { name: "ECDH", namedCurve: "P-256" },
      false,
      [],
    );

    const sharedBits = await crypto.subtle.deriveBits(
      { name: "ECDH", public: serverPubKey },
      this._clientPrivKey,
      256,
    );

    const sharedKey = await crypto.subtle.importKey(
      "raw",
      sharedBits,
      { name: "HKDF" },
      false,
      ["deriveBits"],
    );

    // Use deriveBits (not deriveKey) so the output length matches the
    // server's HKDF expansion exactly — 256 bits. deriveKey with an HMAC
    // target defaults to the hash's block size (512 bits for SHA-256),
    // which would silently derive a different key material and every
    // request signature would fail to verify server-side.
    //
    // Salt is a random 32-byte value the server picked per-token and
    // embedded in the signed token payload (also sent to us in the JSON
    // response). Falls back to a zero salt for older tokens that predate
    // the field — HKDF treats zero-salt as "no salt", which is what the
    // original protocol used.
    const hkdfSalt = data.hkdfSalt
      ? b64Decode(data.hkdfSalt)
      : new Uint8Array(32);
    const masterBits = await crypto.subtle.deriveBits(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: hkdfSalt,
        info: new TextEncoder().encode("enc:master-aes"),
      },
      sharedKey,
      256,
    );
    this._masterKey = await crypto.subtle.importKey(
      "raw",
      masterBits,
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );

    const hmacBits = await crypto.subtle.deriveBits(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: hkdfSalt,
        info: new TextEncoder().encode("enc:req-hmac"),
      },
      sharedKey,
      256,
    );
    this._hmacKey = await crypto.subtle.importKey(
      "raw",
      hmacBits,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    // Fresh session = nonces from prior token are no longer replayable
    // by definition (the HMAC key itself changed), but keeping the set
    // bounded is still cheap insurance.
    this._usedNonces.clear();

    Logger.debug(
      TAG,
      `Token refreshed, expires in ${data.expiresAt - Date.now()}ms`,
    );
  }

  // ─── Nonce generation ──────────────────────────────────────────

  private generateNonce(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const nonce = bytesToHex(bytes);
    if (this._usedNonces.has(nonce)) return this.generateNonce();
    this._usedNonces.add(nonce);
    if (this._usedNonces.size > 1000) {
      const arr = Array.from(this._usedNonces);
      this._usedNonces.clear();
      for (const n of arr.slice(-500)) this._usedNonces.add(n);
    }
    return nonce;
  }
}
