/**
 * Bindings - High-level TypeScript bindings for WASM functions with Asyncify
 *
 * Uses async I/O callbacks instead of WORKERFS.
 */

import type { MoviWasmModule, StreamInfo, PacketInfo } from "./types";
import {
  STREAM_INFO_SIZE,
  STREAM_INFO_OFFSETS,
  PACKET_INFO_SIZE,
  PACKET_INFO_OFFSETS,
} from "./types";
import { Logger, LogLevel } from "../utils/Logger";

const TAG = "Bindings";

/**
 * FFmpeg log level constants
 * Values match libavutil/log.h
 */
const AV_LOG_QUIET = -8;
const AV_LOG_ERROR = 16;
const AV_LOG_WARNING = 24;
const AV_LOG_INFO = 32;
const AV_LOG_DEBUG = 48;
const AV_LOG_TRACE = 56;

/**
 * Convert MoviPlayer LogLevel to FFmpeg log level
 */
function logLevelToFFmpeg(level: LogLevel): number {
  switch (level) {
    case LogLevel.SILENT:
      return AV_LOG_QUIET;
    case LogLevel.ERROR:
      return AV_LOG_ERROR;
    case LogLevel.WARN:
      return AV_LOG_WARNING;
    case LogLevel.INFO:
      return AV_LOG_INFO;
    case LogLevel.DEBUG:
      return AV_LOG_DEBUG;
    case LogLevel.TRACE:
      return AV_LOG_TRACE;
    default:
      return AV_LOG_WARNING;
  }
}

/**
 * Registry of active WasmBindings instances for log level updates
 */
const activeBindings = new Set<WasmBindings>();

/**
 * Data source interface for async I/O
 */
export interface DataSource {
  /** Get total file size */
  getSize(): Promise<number>;

  /** Read data at offset */
  read(offset: number, size: number): Promise<Uint8Array>;
}

/**
 * Parse StreamInfo from WASM memory
 */
function parseStreamInfo(module: MoviWasmModule, ptr: number): StreamInfo {
  const view = new DataView(module.HEAPU8.buffer, ptr, STREAM_INFO_SIZE);

  // Read codec name (32 bytes starting at offset 12)
  const codecNameBytes = module.HEAPU8.subarray(
    ptr + STREAM_INFO_OFFSETS.codecName,
    ptr + STREAM_INFO_OFFSETS.codecName + 32,
  );
  // .slice() (a copy), not .subarray() (a view): module.HEAPU8 is backed by a
  // resizable ArrayBuffer under -sALLOW_MEMORY_GROWTH, and TextDecoder.decode()
  // throws "The provided ArrayBuffer value must not be resizable" on a view of
  // one. Copying into a fresh, fixed-size buffer sidesteps it. Applies to every
  // TextDecoder.decode() of a heap view below. (Newer Emscripten toolchains hit
  // this; reported as issue #11.)
  const codecName = new TextDecoder().decode(
    codecNameBytes.slice(0, codecNameBytes.indexOf(0)),
  );

  // Read language (8 bytes starting at offset 100)
  const languageBytes = module.HEAPU8.subarray(
    ptr + STREAM_INFO_OFFSETS.language,
    ptr + STREAM_INFO_OFFSETS.language + 8,
  );
  const language = new TextDecoder().decode(
    languageBytes.slice(0, languageBytes.indexOf(0)),
  );

  // Read label (64 bytes starting at offset 112)
  const labelBytes = module.HEAPU8.subarray(
    ptr + STREAM_INFO_OFFSETS.label,
    ptr + STREAM_INFO_OFFSETS.label + 64,
  );
  const label = new TextDecoder().decode(
    labelBytes.slice(0, labelBytes.indexOf(0)),
  );

  return {
    index: view.getInt32(STREAM_INFO_OFFSETS.index, true),
    type: view.getInt32(STREAM_INFO_OFFSETS.type, true),
    codecId: view.getInt32(STREAM_INFO_OFFSETS.codecId, true),
    codecName,
    width: view.getInt32(STREAM_INFO_OFFSETS.width, true),
    height: view.getInt32(STREAM_INFO_OFFSETS.height, true),
    frameRate: view.getFloat64(STREAM_INFO_OFFSETS.frameRate, true),
    channels: view.getInt32(STREAM_INFO_OFFSETS.channels, true),
    sampleRate: view.getInt32(STREAM_INFO_OFFSETS.sampleRate, true),
    duration: view.getFloat64(STREAM_INFO_OFFSETS.duration, true),
    bitRate: Number(view.getBigInt64(STREAM_INFO_OFFSETS.bitRate, true)),
    extradataSize: view.getInt32(STREAM_INFO_OFFSETS.extradataSize, true),
    profile: view.getInt32(STREAM_INFO_OFFSETS.profile, true),
    level: view.getInt32(STREAM_INFO_OFFSETS.level, true),
    language: language || "",
    label: label || "",
    rotation: view.getInt32(STREAM_INFO_OFFSETS.rotation, true),
    colorPrimaries: readString(
      module,
      ptr + STREAM_INFO_OFFSETS.colorPrimaries,
      32,
    ),
    colorTransfer: readString(
      module,
      ptr + STREAM_INFO_OFFSETS.colorTransfer,
      32,
    ),
    colorMatrix: readString(module, ptr + STREAM_INFO_OFFSETS.colorMatrix, 32),
    pixelFormat: readString(module, ptr + STREAM_INFO_OFFSETS.pixelFormat, 32),
    colorRange: readString(module, ptr + STREAM_INFO_OFFSETS.colorRange, 32),
    projection: view.getInt32(STREAM_INFO_OFFSETS.projection, true),
    isAttachedPic:
      view.getInt32(STREAM_INFO_OFFSETS.isAttachedPic, true) !== 0,
  };
}

/**
 * Helper to read a string from a fixed-size buffer in WASM memory
 */
function readString(
  module: MoviWasmModule,
  ptr: number,
  maxLength: number,
): string {
  const bytes = module.HEAPU8.subarray(ptr, ptr + maxLength);
  const nullIndex = bytes.indexOf(0);
  // .slice() copies out of the resizable HEAP buffer — TextDecoder rejects a
  // view of a resizable ArrayBuffer (see parseStreamInfo note).
  return new TextDecoder().decode(
    bytes.slice(0, nullIndex >= 0 ? nullIndex : maxLength),
  );
}

/**
 * Parse PacketInfo from WASM memory
 */
function parsePacketInfo(module: MoviWasmModule, ptr: number): PacketInfo {
  const view = new DataView(module.HEAPU8.buffer, ptr, PACKET_INFO_SIZE);

  return {
    streamIndex: view.getInt32(PACKET_INFO_OFFSETS.streamIndex, true),
    keyframe: view.getInt32(PACKET_INFO_OFFSETS.keyframe, true) !== 0,
    pts: view.getFloat64(PACKET_INFO_OFFSETS.timestamp, true),
    dts: view.getFloat64(PACKET_INFO_OFFSETS.dts, true),
    duration: view.getFloat64(PACKET_INFO_OFFSETS.duration, true),
    size: view.getInt32(PACKET_INFO_OFFSETS.size, true),
    isIdr: view.getInt32(PACKET_INFO_OFFSETS.isIdr, true) !== 0,
    isRasl: view.getInt32(PACKET_INFO_OFFSETS.isRasl, true) !== 0,
  };
}

/**
 * WasmBindings - High-level interface to WASM functions with Asyncify
 */
export class WasmBindings {
  private module: MoviWasmModule;
  private contextPtr: number = 0;
  private packetBuffer: number = 0;
  private packetBufferSize: number = 0;

  private dataSource: DataSource | null = null;
  private fileSize: number = 0;
  private lastError: string | null = null; // Store last I/O error for better error messages

  constructor(module: MoviWasmModule) {
    this.module = module;
    this.setupAsyncHandlers();

    // Register this instance for log level updates
    activeBindings.add(this);

    // Apply preferred log level if set, otherwise fallback to Logger level
    // Apply preferred log level if set, otherwise fallback to Logger level
    const levelToApply =
      preferredWasmLogLevel !== null
        ? preferredWasmLogLevel
        : Logger.getLevel();
    this.setLogLevel(logLevelToFFmpeg(levelToApply));
  }

  /**
   * Map FFmpeg AVERROR codes to user-friendly messages
   */
  private getHumanReadableError(code: number): string {
    // FFmpeg FFERRTAG: negate and read as 4-char ASCII
    const tag = (-code >>> 0);
    const a = String.fromCharCode(tag & 0xFF);
    const b = String.fromCharCode((tag >> 8) & 0xFF);
    const c = String.fromCharCode((tag >> 16) & 0xFF);
    const d = String.fromCharCode((tag >> 24) & 0xFF);
    const fftag = `${a}${b}${c}${d}`;

    const messages: Record<string, string> = {
      "INDA": ": File is corrupted or in an unsupported format",
      "FEND": ": Unexpected end of file",
      "NDPA": ": Cannot detect file format — file may be corrupted or incomplete",
      "NFED": ": Could not find a suitable decoder for this file",
      "NFMX": ": Could not find a suitable demuxer for this file",
      "EXIT": ": Operation was interrupted",
    };

    if (messages[fftag]) {
      return messages[fftag];
    }

    // POSIX errno (small negative numbers)
    if (code > -100) {
      const posix: Record<number, string> = {
        [-2]: ": File not found",
        [-13]: ": Permission denied",
        [-12]: ": Not enough memory to process this file",
        [-5]: ": Read error — file may be incomplete or inaccessible",
      };
      if (posix[code]) return posix[code];
    }

    Logger.debug(TAG, `Unknown FFmpeg error: code=${code}, tag=${fftag}`);
    return ": Unable to open this file";
  }

  /**
   * Setup async I/O handlers for Asyncify callbacks
   */
  private setupAsyncHandlers(): void {
    const self = this;

    // Handle read requests from WASM
    // IMPORTANT: offset may be a BigInt for files >= 2GB, convert to number safely
    (this.module as any).onReadRequest = async (
      offset: number | bigint,
      size: number,
    ) => {
      try {
        if (!self.dataSource) {
          Logger.error(TAG, "No data source set for read request");
          self.fulfillRead(new Uint8Array(0), -1);
          return;
        }

        // Convert BigInt to number for offset (safe up to 2^53, but BigInt handles larger values)
        // For files >= 2GB, we need to ensure proper conversion
        const offsetNum = typeof offset === "bigint" ? Number(offset) : offset;
        if (offsetNum > Number.MAX_SAFE_INTEGER) {
          Logger.warn(
            TAG,
            `Read offset ${offset} exceeds MAX_SAFE_INTEGER, precision may be lost`,
          );
        }

        const data = await self.dataSource.read(offsetNum, size);
        self.fulfillRead(new Uint8Array(data), data.byteLength);
      } catch (error) {
        // Store error message for better error reporting
        self.lastError = (error as any).message || String(error);
        Logger.error(TAG, "Read request failed", error);
        self.fulfillRead(new Uint8Array(0), -1);
      }
    };

    // Handle seek requests from WASM
    // IMPORTANT: offset may be a BigInt for files >= 2GB
    // This is especially important for large files (>= 2GB) where position tracking
    // needs to be accurate to avoid sequential reads
    (this.module as any).onSeekRequest = async (
      offset: number | bigint,
      _whence: number,
    ) => {
      // Convert BigInt to number for offset (safe up to 2^53, but BigInt handles larger values)
      const offsetNum = typeof offset === "bigint" ? Number(offset) : offset;
      if (offsetNum > Number.MAX_SAFE_INTEGER) {
        Logger.warn(
          TAG,
          `Seek offset ${offset} exceeds MAX_SAFE_INTEGER, precision may be lost`,
        );
      }

      // Update source position when seeking to ensure it's in sync
      if (
        self.dataSource &&
        typeof (self.dataSource as any).seek === "function"
      ) {
        try {
          (self.dataSource as any).seek(offsetNum);
        } catch (e) {
          Logger.warn(TAG, "Source seek failed, continuing anyway", e);
        }
      }
      // Return as BigInt to maintain precision for large offsets
      const resultOffset =
        typeof offset === "bigint" ? offset : BigInt(Math.floor(offsetNum));
      self.fulfillSeek(resultOffset);
    };
  }

  /**
   * Fulfill a pending read request
   */
  private fulfillRead(data: Uint8Array, bytesRead: number): void {
    const pending = (this.module as any)._pendingRead;
    if (!pending) {
      Logger.warn(TAG, "No pending read to fulfill");
      return;
    }

    if (bytesRead > 0 && data.byteLength > 0) {
      // Copy data to WASM memory
      this.module.HEAPU8.set(data.subarray(0, bytesRead), pending.buffer);
    }

    pending.resolve(bytesRead);
    (this.module as any)._pendingRead = null;
  }

  /**
   * Fulfill a pending seek request
   * newPosition must be a BigInt for files >= 2GB to maintain precision
   */
  private fulfillSeek(newPosition: number | bigint): void {
    const pending = (this.module as any)._pendingSeek;
    if (!pending) {
      Logger.warn(TAG, "No pending seek to fulfill");
      return;
    }

    // Ensure we pass BigInt to maintain precision for large offsets
    const pos =
      typeof newPosition === "bigint"
        ? newPosition
        : BigInt(Math.floor(newPosition));
    pending.resolve(pos);
    (this.module as any)._pendingSeek = null;
  }

  /**
   * Set the data source for async I/O
   */
  setDataSource(source: DataSource): void {
    this.dataSource = source;
  }

  /**
   * Set file size (required before open for proper seeking)
   * @param size File size in bytes
   */
  setFileSize(size: number): void {
    if (!this.contextPtr) {
      Logger.warn(TAG, "Cannot set file size: context not created");
      return;
    }

    // Split into low and high 32-bit parts for 64-bit support
    const sizeLow = size & 0xffffffff;
    const sizeHigh = Math.floor(size / 0x100000000);

    this.module._movi_set_file_size(this.contextPtr, sizeLow, sizeHigh);
    Logger.debug(TAG, `File size set: ${size} bytes`);
  }

  /**
   * Create a new demuxer context
   */
  create(): boolean {
    if (this.contextPtr) {
      Logger.warn(TAG, "Context already exists, destroying old context");
      this.destroy();
    }

    this.contextPtr = this.module._movi_create();
    if (!this.contextPtr) {
      Logger.error(TAG, "Failed to create movi context");
      return false;
    }

    // Allocate packet buffer (10MB for 4K support)
    this.packetBufferSize = 10 * 1024 * 1024;
    this.packetBuffer = this.module._malloc(this.packetBufferSize);

    Logger.debug(TAG, "Context created");
    return true;
  }

  /**
   * Destroy the demuxer context
   */
  destroy(): void {
    // Unregister this instance
    activeBindings.delete(this);

    if (this.packetBuffer) {
      this.module._free(this.packetBuffer);
      this.packetBuffer = 0;
    }

    if (this.contextPtr) {
      this.module._movi_destroy(this.contextPtr);
      this.contextPtr = 0;
    }

    this.dataSource = null;
    this.fileSize = 0;

    Logger.debug(TAG, "Context destroyed");
  }

  /**
   * Open media from data source (async due to Asyncify)
   * Returns the number of streams found
   */
  async open(): Promise<number> {
    if (!this.contextPtr) {
      throw new Error("Context not created");
    }

    if (!this.dataSource) {
      throw new Error("Data source not set");
    }

    // Get file size (may be > 2GB)
    this.fileSize = await this.dataSource.getSize();
    // Store as BigInt to maintain precision for large files
    (this.module as any)._fileSize = BigInt(Math.floor(this.fileSize));

    // Set file size in C context (split into low/high 32-bit parts)
    // Use BigInt arithmetic to ensure correct handling of files >= 2GB
    const fileSizeBigInt = BigInt(Math.floor(this.fileSize));
    const sizeLow = Number(fileSizeBigInt & 0xffffffffn);
    const sizeHigh = Number(fileSizeBigInt >> 32n);
    this.module._movi_set_file_size(this.contextPtr, sizeLow, sizeHigh);

    // Open (this will trigger async reads via AVIO callbacks)
    // IMPORTANT: Use ccall with async:true for Asyncify to work correctly
    // Clear any previous error
    this.lastError = null;

    const ret = (await this.module.ccall(
      "movi_open",
      "number",
      ["number"],
      [this.contextPtr],
      { async: true },
    )) as number;

    if (ret < 0) {
      // Include last I/O error if available (e.g., CORS, network errors)
      let errorDetail: string;
      if (this.lastError) {
        errorDetail = `: ${this.lastError}`;
      } else {
        errorDetail = this.getHumanReadableError(ret);
      }
      throw new Error(`Failed to open media${errorDetail}`);
    }

    Logger.debug(TAG, `Media opened with ${ret} streams`);
    return ret;
  }

  /**
   * Get media duration in seconds
   */
  getDuration(): number {
    if (!this.contextPtr) return 0;
    return this.module._movi_get_duration(this.contextPtr);
  }

  /**
   * Get Media Time(PTS) start time in seconds
   */
  getStartTime(): number {
    if (!this.contextPtr) return 0;
    return this.module._movi_get_start_time(this.contextPtr);
  }

  /**
   * Get container format name (e.g., "mov,mp4,m4a,3gp,3g2,mj2")
   */
  getFormatName(): string {
    if (!this.contextPtr) return "UNKNOWN";

    const bufferSize = 64;
    const buffer = this.module._malloc(bufferSize);
    try {
      const ret = this.module._movi_get_format_name(
        this.contextPtr,
        buffer,
        bufferSize,
      );
      if (ret > 0) {
        return this.module.UTF8ToString(buffer);
      }
      return "UNKNOWN";
    } catch (e) {
      return "UNKNOWN";
    } finally {
      this.module._free(buffer);
    }
  }

  /**
   * Get title from metadata
   */
  getMetadataTitle(): string {
    if (!this.contextPtr) return "";

    // Titles can be long, give it some space
    const bufferSize = 256;
    const buffer = this.module._malloc(bufferSize);
    try {
      const ret = this.module._movi_get_metadata_title(
        this.contextPtr,
        buffer,
        bufferSize,
      );
      if (ret > 0) {
        return this.module.UTF8ToString(buffer);
      }
      return "";
    } catch (e) {
      return "";
    } finally {
      this.module._free(buffer);
    }
  }

  /**
   * Get number of streams
   */
  getStreamCount(): number {
    if (!this.contextPtr) return 0;
    return this.module._movi_get_stream_count(this.contextPtr);
  }

  /**
   * Get stream info
   */
  getStreamInfo(streamIndex: number): StreamInfo | null {
    if (!this.contextPtr) return null;

    const infoPtr = this.module._malloc(STREAM_INFO_SIZE);
    // Zero the buffer before the C side writes into it. The C struct
    // grew (added is_attached_pic at offset 336); if the user is running
    // against an unrebuilt WASM that still emits the old layout, the new
    // trailing bytes would otherwise hold whatever leftover heap memory
    // _malloc handed us — non-zero garbage parsed as a true flag would
    // cause every real video track to be filtered out as cover art.
    this.module.HEAPU8.fill(0, infoPtr, infoPtr + STREAM_INFO_SIZE);
    try {
      const ret = this.module._movi_get_stream_info(
        this.contextPtr,
        streamIndex,
        infoPtr,
      );
      if (ret !== 0) {
        return null;
      }
      return parseStreamInfo(this.module, infoPtr);
    } finally {
      this.module._free(infoPtr);
    }
  }

  /**
   * Get extradata for a stream
   */
  getExtradata(streamIndex: number): Uint8Array | null {
    if (!this.contextPtr) return null;

    const info = this.getStreamInfo(streamIndex);
    if (!info || info.extradataSize === 0) return null;

    const bufferPtr = this.module._malloc(info.extradataSize);
    try {
      const size = this.module._movi_get_extradata(
        this.contextPtr,
        streamIndex,
        bufferPtr,
        info.extradataSize,
      );

      if (size <= 0) return null;

      // Copy data out of WASM memory
      const result = new Uint8Array(size);
      result.set(this.module.HEAPU8.subarray(bufferPtr, bufferPtr + size));
      return result;
    } finally {
      this.module._free(bufferPtr);
    }
  }

  /**
   * Read the cached attached_pic data for a stream — typically a full
   * PNG/JPEG file extracted from ID3v2 APIC, FLAC PICTURE, MP4 covr atom
   * or Matroska attachment. Returns null when the stream has no attached
   * picture (i.e. it's a real video stream, not embedded cover art).
   *
   * Size is read from StreamInfo.bitRate of the synthetic attached_pic
   * stream — FFmpeg stores it via codecpar->bit_rate when populating the
   * picture, but to keep the JS side oblivious of that detail we use a
   * growing buffer: start at 1 MB (covers ~all real cover art), grow on
   * ENOBUFS up to a sane cap.
   */
  getAttachedPicData(streamIndex: number): Uint8Array | null {
    if (!this.contextPtr) return null;
    const MAX_PIC_SIZE = 16 * 1024 * 1024; // 16 MB ceiling — generous.
    let bufferSize = 1024 * 1024; // 1 MB initial.
    while (bufferSize <= MAX_PIC_SIZE) {
      const bufferPtr = this.module._malloc(bufferSize);
      try {
        const ret = this.module._movi_get_attached_pic_data(
          this.contextPtr,
          streamIndex,
          bufferPtr,
          bufferSize,
        );
        if (ret === 0) return null; // No attached_pic on this stream.
        if (ret < 0) {
          // ENOBUFS (-EAGAIN-ish): grow and retry.
          bufferSize *= 2;
          continue;
        }
        const result = new Uint8Array(ret);
        result.set(this.module.HEAPU8.subarray(bufferPtr, bufferPtr + ret));
        return result;
      } finally {
        this.module._free(bufferPtr);
      }
    }
    return null;
  }

  /**
   * Get number of chapters in the media
   */
  getChapterCount(): number {
    if (!this.contextPtr) return 0;
    return this.module._movi_get_chapter_count(this.contextPtr);
  }

  /**
   * Get all chapters from the media
   */
  getChapters(): Array<{ title: string; start: number; end: number }> {
    if (!this.contextPtr) return [];
    const count = this.getChapterCount();
    if (count <= 0) return [];

    const chapters: Array<{ title: string; start: number; end: number }> = [];
    const titleBufPtr = this.module._malloc(256);

    try {
      for (let i = 0; i < count; i++) {
        const start = this.module._movi_get_chapter_start(this.contextPtr, i);
        const end = this.module._movi_get_chapter_end(this.contextPtr, i);

        // Get title
        this.module.HEAPU8.fill(0, titleBufPtr, titleBufPtr + 256);
        this.module._movi_get_chapter_title(this.contextPtr, i, titleBufPtr, 256);
        const titleBytes = this.module.HEAPU8.subarray(titleBufPtr, titleBufPtr + 256);
        const nullIdx = titleBytes.indexOf(0);
        const title = new TextDecoder().decode(titleBytes.slice(0, nullIdx > 0 ? nullIdx : 256));

        chapters.push({
          title: title || `Chapter ${i + 1}`,
          start: start >= 0 ? start : 0,
          end: end >= 0 ? end : 0,
        });
      }
    } finally {
      this.module._free(titleBufPtr);
    }

    return chapters;
  }

  /**
   * Seek to timestamp (async due to Asyncify)
   */
  async seek(
    timestamp: number,
    streamIndex: number = -1,
    flags: number = 1,
  ): Promise<void> {
    if (!this.contextPtr) {
      throw new Error("Context not created");
    }

    // Use ccall with async:true for Asyncify
    const ret = (await this.module.ccall(
      "movi_seek_to",
      "number",
      ["number", "number", "number", "number"],
      [this.contextPtr, timestamp, streamIndex, flags],
      { async: true },
    )) as number;

    if (ret < 0) {
      throw new Error(`Seek failed: error ${ret}`);
    }

    Logger.debug(TAG, `Seeked to ${timestamp}s`);
  }

  /**
   * Read next frame/packet (async due to Asyncify)
   */
  async readFrame(): Promise<{ info: PacketInfo; data: Uint8Array } | null> {
    if (!this.contextPtr) return null;

    const infoPtr = this.module._malloc(PACKET_INFO_SIZE);
    try {
      // Use ccall with async:true for Asyncify
      let ret = (await this.module.ccall(
        "movi_read_frame",
        "number",
        ["number", "number", "number", "number"],
        [this.contextPtr, infoPtr, this.packetBuffer, this.packetBufferSize],
        { async: true },
      )) as number;

      // Handle buffer too small (ENOBUFS is defined as -105 in many systems,
      // but FFmpeg's AVERROR(ENOBUFS) is platform dependent.
      // For now, check if ret is a large negative indicating truncation.
      // In movi_streams.c we specifically returned AVERROR(ENOBUFS).
      if (ret < 0 && ret !== -1 /* EOF check is handled by 0 above */) {
        // Log detail and try to handle or propagate
        Logger.error(
          TAG,
          `Read frame failed: error ${ret}. This might be due to a packet larger than ${this.packetBufferSize} bytes.`,
        );
        throw new Error(`Read frame failed: error ${ret}`);
      }

      if (ret === 0) {
        // EOF
        return null;
      }

      const info = parsePacketInfo(this.module, infoPtr);

      // Validate packet size to prevent corrupted state from creating invalid arrays
      // Near EOF, FFmpeg's demuxer may produce corrupted packets from stale internal buffer data — treat as EOF
      if (info.size < 0 || info.size > this.packetBufferSize) {
        Logger.warn(
          TAG,
          `Invalid packet size: ${info.size} (buffer size: ${this.packetBufferSize}), treating as EOF`,
        );
        return null;
      }

      // Copy packet data
      const data = new Uint8Array(info.size);
      data.set(
        this.module.HEAPU8.subarray(
          this.packetBuffer,
          this.packetBuffer + info.size,
        ),
      );

      return { info, data };
    } finally {
      this.module._free(infoPtr);
    }
  }

  /**
   * Set log level (FFmpeg log level constant)
   */
  setLogLevel(level: number): void {
    this.module._movi_set_log_level(level);
  }

  /**
   * Set log level from MoviPlayer LogLevel enum
   */
  setLogLevelFromMovi(level: LogLevel): void {
    const ffmpegLevel = logLevelToFFmpeg(level);
    this.setLogLevel(ffmpegLevel);
  }

  // Decoding support
  enableDecoder(streamIndex: number, extradata?: Uint8Array): number {
    if (!this.contextPtr) return -1;
    if (!extradata || extradata.length === 0) {
      return this.module._movi_enable_decoder(this.contextPtr, streamIndex, 0, 0);
    }
    const ptr = this.module._malloc(extradata.length);
    if (!ptr) return -1;
    try {
      this.module.HEAPU8.set(extradata, ptr);
      return this.module._movi_enable_decoder(this.contextPtr, streamIndex, ptr, extradata.length);
    } finally {
      this.module._free(ptr);
    }
  }

  /**
   * Persistently discard (or re-enable) a stream at the demuxer level. With
   * discard=true, av_read_frame skips that stream's packets internally and never
   * returns them — used to drop unused audio/subtitle tracks from the read path
   * so the JS demux loop isn't flooded with packets it throws away (issue #11:
   * a 2nd unused TrueHD track doubled the read load and starved audio on Safari).
   */
  setStreamDiscard(streamIndex: number, discard: boolean): void {
    if (!this.contextPtr) return;
    const fn = (this.module as any)._movi_set_stream_discard;
    if (typeof fn !== "function") return; // older WASM without the export
    fn(this.contextPtr, streamIndex, discard ? 1 : 0);
  }

  sendPacket(
    streamIndex: number,
    data: Uint8Array,
    pts: number,
    dts: number,
    keyframe: boolean,
  ): number {
    if (!this.contextPtr) return -1;

    // Alloc temp buffer for data. _malloc returns 0 on OOM — without the
    // guard, HEAPU8.set(data, 0) would silently write packet bytes over
    // the start of the WASM heap (allocator state, stack, etc.) and the
    // corruption surfaces hundreds of packets later as a demuxer
    // "memory access out of bounds" in av_read_frame. Bail out as -6
    // (ENOMEM) so the caller drops the packet instead of corrupting.
    const ptr = this.module._malloc(data.byteLength);
    if (!ptr) return -6;
    this.module.HEAPU8.set(data, ptr);

    try {
      return this.module._movi_send_packet(
        this.contextPtr,
        streamIndex,
        ptr,
        data.byteLength,
        pts,
        dts,
        keyframe ? 1 : 0,
      );
    } finally {
      this.module._free(ptr);
    }
  }

  receiveFrame(streamIndex: number): number {
    if (!this.contextPtr) return -1;
    return this.module._movi_receive_frame(this.contextPtr, streamIndex);
  }

  /**
   * Decode a subtitle packet
   */
  async decodeSubtitle(
    streamIndex: number,
    data: Uint8Array,
    timestamp: number,
    duration?: number,
  ): Promise<number> {
    if (!this.contextPtr) {
      throw new Error("Context not created");
    }

    // Allocate WASM memory for packet data
    const dataPtr = this.module._malloc(data.length);
    if (!dataPtr) {
      Logger.error(TAG, "Failed to allocate memory for subtitle packet");
      return -1;
    }

    try {
      // Copy packet data to WASM memory
      this.module.HEAPU8.set(data, dataPtr);

      // Use packet duration if available (from demuxer, e.g., SRT file timestamps)
      const packetDuration = duration ?? 0;

      // Decode subtitle using ccall with async
      const result = (await this.module.ccall(
        "movi_decode_subtitle",
        "number",
        ["number", "number", "number", "number", "number", "number"],
        [
          this.contextPtr,
          streamIndex,
          dataPtr,
          data.length,
          timestamp,
          packetDuration,
        ],
        { async: true },
      )) as number;

      return result;
    } finally {
      // Free packet memory
      this.module._free(dataPtr);
    }
  }

  /**
   * Get decoded subtitle text
   */
  async getSubtitleText(): Promise<string | null> {
    if (!this.contextPtr) {
      Logger.debug(TAG, "getSubtitleText: context not created");
      return null;
    }

    // Allocate buffer for text (4KB should be enough for most subtitles)
    const bufferSize = 4096;
    const bufferPtr = this.module._malloc(bufferSize);
    if (!bufferPtr) {
      Logger.error(TAG, "getSubtitleText: failed to allocate buffer");
      return null;
    }

    try {
      Logger.debug(TAG, "getSubtitleText: calling movi_get_subtitle_text");
      const result = this.module.ccall(
        "movi_get_subtitle_text",
        "number",
        ["number", "number", "number"],
        [this.contextPtr, bufferPtr, bufferSize],
        { async: false },
      ) as number;

      Logger.debug(TAG, `getSubtitleText: C function returned ${result}`);

      if (result < 0) {
        Logger.warn(
          TAG,
          `getSubtitleText: C function returned error ${result}`,
        );
        return null;
      }

      if (result === 0) {
        Logger.debug(
          TAG,
          "getSubtitleText: No text extracted (result=0) - might be empty subtitle or no rectangles",
        );
        return null;
      }

      // Read text from WASM memory
      const textBytes = this.module.HEAPU8.subarray(
        bufferPtr,
        bufferPtr + result,
      );
      // .slice() — TextDecoder rejects a view of the resizable HEAP buffer.
      const text = new TextDecoder().decode(textBytes.slice());

      // Trim whitespace and check if empty
      const trimmedText = text?.trim();
      if (!trimmedText || trimmedText.length === 0) {
        Logger.debug(
          TAG,
          `getSubtitleText: Extracted text is empty after trimming (raw length=${result})`,
        );
        return null;
      }

      Logger.debug(
        TAG,
        `getSubtitleText: Extracted text length=${result}, trimmed length=${trimmedText.length}, text="${trimmedText.substring(0, 50)}..."`,
      );
      return trimmedText;
    } finally {
      this.module._free(bufferPtr);
    }
  }

  /**
   * Get subtitle start and end times
   */
  async getSubtitleTimes(): Promise<{ start: number; end: number } | null> {
    if (!this.contextPtr) {
      return null;
    }

    // Allocate memory for two doubles
    const timesPtr = this.module._malloc(16); // 2 * 8 bytes for doubles
    if (!timesPtr) {
      return null;
    }

    try {
      const result = this.module.ccall(
        "movi_get_subtitle_times",
        "number",
        ["number", "number", "number"],
        [this.contextPtr, timesPtr, timesPtr + 8],
        { async: false },
      ) as number;

      if (result < 0) {
        return null;
      }

      // Read doubles from WASM memory
      const view = new DataView(this.module.HEAPU8.buffer, timesPtr, 16);
      const start = view.getFloat64(0, true);
      const end = view.getFloat64(8, true);

      return { start, end };
    } finally {
      this.module._free(timesPtr);
    }
  }

  /**
   * Scan the entire subtitle stream and return every cue at once. Used to
   * support negative subtitle delay, where the renderer needs cues from
   * stream positions ahead of the demuxer's natural read cursor. Leaves
   * the demuxer at EOF — the caller must seek back to playback position.
   * Returns the array of cues, or null on failure.
   */
  async prefetchSubtitleCues(
    streamIndex: number,
  ): Promise<{ start: number; end: number; text: string }[] | null> {
    if (!this.contextPtr) return null;

    const count = (await this.module.ccall(
      "movi_prefetch_subtitle_cues",
      "number",
      ["number", "number"],
      [this.contextPtr, streamIndex],
      { async: true },
    )) as number;

    if (count < 0) {
      Logger.warn(TAG, `prefetchSubtitleCues: failed (${count})`);
      return null;
    }

    const cues: { start: number; end: number; text: string }[] = [];
    if (count === 0) return cues;

    const startPtr = this.module._malloc(8);
    const endPtr = this.module._malloc(8);
    const textBufSize = 8192;
    const textPtr = this.module._malloc(textBufSize);
    if (!startPtr || !endPtr || !textPtr) {
      if (startPtr) this.module._free(startPtr);
      if (endPtr) this.module._free(endPtr);
      if (textPtr) this.module._free(textPtr);
      return null;
    }

    try {
      for (let i = 0; i < count; i++) {
        const len = this.module.ccall(
          "movi_get_prefetched_cue",
          "number",
          ["number", "number", "number", "number", "number", "number"],
          [this.contextPtr, i, startPtr, endPtr, textPtr, textBufSize],
          { async: false },
        ) as number;
        if (len < 0) continue;
        const start = new DataView(this.module.HEAPU8.buffer, startPtr, 8).getFloat64(0, true);
        const end = new DataView(this.module.HEAPU8.buffer, endPtr, 8).getFloat64(0, true);
        const textBytes = this.module.HEAPU8.subarray(textPtr, textPtr + len);
        const text = new TextDecoder().decode(textBytes.slice()).trim();
        if (text) cues.push({ start, end, text });
      }
    } finally {
      this.module._free(startPtr);
      this.module._free(endPtr);
      this.module._free(textPtr);
      // Drop the C-side cache now that we've copied everything across.
      this.module.ccall(
        "movi_clear_prefetched_cues",
        "void",
        ["number"],
        [this.contextPtr],
        { async: false },
      );
    }

    return cues;
  }

  /**
   * Get subtitle image info (for bitmap/image subtitles like PGS)
   * Returns { width, height, x, y } or null if not an image subtitle
   */
  async getSubtitleImageInfo(): Promise<{
    width: number;
    height: number;
    x: number;
    y: number;
  } | null> {
    if (!this.contextPtr) {
      return null;
    }

    // Allocate memory for 4 integers (width, height, x, y)
    const infoPtr = this.module._malloc(16); // 4 * 4 bytes for ints
    if (!infoPtr) {
      return null;
    }

    try {
      const result = this.module.ccall(
        "movi_get_subtitle_image_info",
        "number",
        ["number", "number", "number", "number", "number"],
        [this.contextPtr, infoPtr, infoPtr + 4, infoPtr + 8, infoPtr + 12],
        { async: false },
      ) as number;

      if (result < 0) {
        return null; // Not an image subtitle or error
      }

      // Read integers from WASM memory
      const view = new DataView(this.module.HEAPU8.buffer, infoPtr, 16);
      const width = view.getInt32(0, true);
      const height = view.getInt32(4, true);
      const x = view.getInt32(8, true);
      const y = view.getInt32(12, true);

      return { width, height, x, y };
    } finally {
      this.module._free(infoPtr);
    }
  }

  /**
   * Get subtitle image data as RGBA (for bitmap/image subtitles like PGS)
   * Returns Uint8Array with RGBA data or null if not an image subtitle
   */
  async getSubtitleImageData(): Promise<Uint8Array | null> {
    if (!this.contextPtr) {
      return null;
    }

    // First get image info to determine buffer size
    const info = await this.getSubtitleImageInfo();
    if (!info) {
      return null; // Not an image subtitle
    }

    const bufferSize = info.width * info.height * 4; // RGBA = 4 bytes per pixel
    const bufferPtr = this.module._malloc(bufferSize);
    if (!bufferPtr) {
      return null;
    }

    try {
      const result = this.module.ccall(
        "movi_get_subtitle_image_data",
        "number",
        ["number", "number", "number"],
        [this.contextPtr, bufferPtr, bufferSize],
        { async: false },
      ) as number;

      if (result < 0) {
        return null; // Error extracting image data
      }

      // Copy RGBA data from WASM memory
      const imageData = new Uint8Array(bufferSize);
      imageData.set(
        this.module.HEAPU8.subarray(bufferPtr, bufferPtr + bufferSize),
      );

      return imageData;
    } finally {
      this.module._free(bufferPtr);
    }
  }

  /**
   * Free decoded subtitle
   */
  async freeSubtitle(): Promise<void> {
    if (!this.contextPtr) {
      return;
    }

    this.module.ccall(
      "movi_free_subtitle",
      "void",
      ["number"],
      [this.contextPtr],
      { async: false },
    );
  }

  getFrameWidth(): number {
    return this.module._movi_get_frame_width(this.contextPtr);
  }
  getFrameHeight(): number {
    return this.module._movi_get_frame_height(this.contextPtr);
  }
  getFrameFormat(): number {
    return this.module._movi_get_frame_format(this.contextPtr);
  }
  getFrameLinesize(plane: number): number {
    return this.module._movi_get_frame_linesize(this.contextPtr, plane);
  }

  getFrameSamples(): number {
    return this.module._movi_get_frame_samples(this.contextPtr);
  }
  getFrameChannels(): number {
    return this.module._movi_get_frame_channels(this.contextPtr);
  }
  getFrameSampleRate(): number {
    return this.module._movi_get_frame_sample_rate(this.contextPtr);
  }

  getFrameDataPointer(plane: number): number {
    return this.module._movi_get_frame_data(this.contextPtr, plane);
  }

  enableAudioDownmix(enable: boolean): void {
    if (!this.contextPtr) return;
    this.module._movi_enable_audio_downmix(this.contextPtr, enable ? 1 : 0);
  }

  /**
   * Get the context pointer (for remuxer)
   */
  getContextPtr(): number {
    return this.contextPtr;
  }

  getFramePts(streamIndex: number): number {
    if (!this.contextPtr) return -1;
    return this.module._movi_get_frame_pts(this.contextPtr, streamIndex);
  }

  flushDecoder(streamIndex: number): void {
    if (!this.contextPtr) return;
    this.module._movi_flush_decoder(this.contextPtr, streamIndex);
  }

  /**
   * Get decoded frame as RGBA data (converts any format including 10-bit HDR)
   * This is useful for software decoding where YUV output is in non-standard formats
   */
  getFrameRGBA(
    targetWidth: number = 0,
    targetHeight: number = 0,
  ): Uint8Array | null {
    if (!this.contextPtr) return null;

    const rgbaPtr = this.module._movi_get_frame_rgba(
      this.contextPtr,
      targetWidth,
      targetHeight,
    );
    if (!rgbaPtr) return null;

    const size = this.module._movi_get_frame_rgba_size(this.contextPtr);
    if (size <= 0) return null;

    // Return a view of the WASM heap (avoids one full-frame copy)
    // The VideoFrame constructor will copy this data once into its own memory.
    return this.module.HEAPU8.subarray(rgbaPtr, rgbaPtr + size);
  }

  /**
   * Set frames to skip during decoding
   * 0: None, 1: NonRef, 2: Bidir, 3: NonKey, 4: All
   */
  setSkipFrame(trackIndex: number, skip: number): void {
    if (!this.contextPtr) return;
    this.module._movi_set_skip_frame(this.contextPtr, trackIndex, skip);
  }
}

/**
 * Preferred log level for new WasmBindings instances
 */
let preferredWasmLogLevel: LogLevel | null = LogLevel.SILENT;

/**
 * Update FFmpeg log level for all active WasmBindings instances
 * This is called when MoviPlayer.setLogLevel() is invoked
 */
export function updateAllBindingsLogLevel(level: LogLevel): void {
  preferredWasmLogLevel = level;
  const ffmpegLevel = logLevelToFFmpeg(level);
  for (const bindings of activeBindings) {
    bindings.setLogLevel(ffmpegLevel);
  }
}

/**
 * ThumbnailBindings - Fast thumbnail generation using FFmpeg software decoding
 * Separate from main playback, uses its own demuxer and decoder context.
 */
export class ThumbnailBindings {
  private module: MoviWasmModule;
  private contextPtr: number = 0;
  private dataSource: DataSource | null = null;
  private isOpened: boolean = false;
  private lastPacketPts: number = 0; // Store from callback

  constructor(module: MoviWasmModule) {
    this.module = module;
    // Default to silent, can be changed via setLogLevel
    this.module._movi_set_log_level(AV_LOG_QUIET);
    this.setupAsyncHandlers();
  }

  /**
   * Set FFmpeg log level
   * @param level FFmpeg log level constant (e.g. AV_LOG_DEBUG)
   */
  setLogLevel(level: number): void {
    this.module._movi_set_log_level(level);
  }

  /**
   * Set log level from MoviPlayer LogLevel enum
   */
  setLogLevelFromMovi(level: LogLevel): void {
    const ffmpegLevel = logLevelToFFmpeg(level);
    this.setLogLevel(ffmpegLevel);
  }

  /**
   * Setup async I/O handlers for thumbnail context
   */
  private setupAsyncHandlers(): void {
    const self = this;

    // Handle read requests from WASM
    (this.module as any).onReadRequest = function (
      offset: number | bigint,
      size: number,
    ) {
      if (self.dataSource) {
        const offsetNum = typeof offset === "bigint" ? Number(offset) : offset;
        self.dataSource.read(offsetNum, size).then((data) => {
          const view = data instanceof Uint8Array ? data : new Uint8Array(data);
          self.fulfillRead(view, view.byteLength);
        }).catch((err) => {
          // Source read failed (e.g. encrypted stream truncated → rejected
          // with "Stream ended before block N"). Without this catch the
          // pending WASM read never resolves, wedging the thumbnail demuxer
          // and leaving every subsequent hover/timeline request stuck.
          // Fulfill with -1 (matches main bindings' convention) — WASM
          // surfaces this as a read failure, distinct from 0 (EOF). That
          // lets FFmpeg's own retry loop kick in rather than treating the
          // file as ended mid-frame.
          console.warn(`[ThumbnailBindings] read(${offsetNum}, ${size}) failed:`, err);
          self.fulfillRead(new Uint8Array(0), -1);
        });
      }
    };

    // Handle seek requests from WASM
    (this.module as any).onSeekRequest = function (offset: number | bigint) {
      const offsetNum = typeof offset === "bigint" ? Number(offset) : offset;
      const resultOffset =
        typeof offset === "bigint" ? offset : BigInt(Math.floor(offsetNum));
      self.fulfillSeek(resultOffset);
    };
  }

  private fulfillRead(data: Uint8Array, bytesRead: number): void {
    const pending = (this.module as any)._pendingRead;
    if (!pending) return;

    if (bytesRead > 0 && data.byteLength > 0) {
      this.module.HEAPU8.set(data.subarray(0, bytesRead), pending.buffer);
    }

    pending.resolve(bytesRead);
    (this.module as any)._pendingRead = null;
  }

  private fulfillSeek(newPosition: number | bigint): void {
    const pending = (this.module as any)._pendingSeek;
    if (!pending) return;

    pending.resolve(newPosition);
    (this.module as any)._pendingSeek = null;
  }

  setDataSource(dataSource: DataSource): void {
    this.dataSource = dataSource;
  }

  async create(fileSize: number): Promise<boolean> {
    const sizeLow = fileSize & 0xffffffff;
    const sizeHigh = (fileSize / 0x100000000) >>> 0;

    this.contextPtr = this.module._movi_thumbnail_create(sizeLow, sizeHigh);
    return this.contextPtr !== 0;
  }

  async open(): Promise<boolean> {
    if (!this.contextPtr) return false;

    // Use ccall with async:true to handle Asyncify correctly
    const result = (await this.module.ccall(
      "movi_thumbnail_open",
      "number",
      ["number"],
      [this.contextPtr],
      { async: true },
    )) as number;

    this.isOpened = result === 0;
    return this.isOpened;
  }

  /**
   * Seek and read keyframe at timestamp
   * Uses callback pattern - C calls JS when packet is ready
   */
  async readKeyframe(timestamp: number): Promise<number> {
    if (!this.contextPtr || !this.isOpened) return -1;

    Logger.debug(
      TAG,
      `JS calling _movi_thumbnail_read_keyframe(${this.contextPtr}, ${timestamp.toFixed(2)})`,
    );

    // We use a shared result object to capture callback data
    let packetSize = -1;
    let packetPts = -1;

    // Setup callback that C will call
    (this.module as any)._pendingThumbnail = {
      resolve: (result: { size: number; pts: number }) => {
        Logger.debug(
          TAG,
          `JS callback received: size=${result.size}, pts=${result.pts}`,
        );
        packetSize = result.size;
        packetPts = result.pts;
      },
    };

    try {
      // Call C function using ccall with async:true
      // This ensures we wait for the entire async operation to complete
      await this.module.ccall(
        "movi_thumbnail_read_keyframe",
        "void",
        ["number", "number"],
        [this.contextPtr, timestamp],
        { async: true },
      );

      // After ccall completes, the callback should have populated our variables
      if (packetSize > 0) {
        this.lastPacketPts = packetPts;
      }
      return packetSize;
    } catch (e) {
      Logger.error(TAG, "readKeyframe error", e);
      return -1;
    } finally {
      (this.module as any)._pendingThumbnail = null;
    }
  }

  /**
   * Get packet data pointer
   */
  getPacketData(): number {
    return this.module._movi_thumbnail_get_packet_data(this.contextPtr);
  }

  /**
   * Get a copy of the packet data from THIS module's memory
   * This is important because ThumbnailBindings uses an isolated WASM module
   */
  getPacketDataCopy(size: number): Uint8Array | null {
    const ptr = this.getPacketData();
    if (!ptr || size <= 0) return null;

    // Copy from THIS module's HEAPU8, not the main module
    return new Uint8Array(this.module.HEAPU8.subarray(ptr, ptr + size).slice());
  }

  /**
   * Get last packet PTS (from callback)
   */
  getPacketPts(): number {
    return this.lastPacketPts;
  }

  /**
   * Get stream info with HDR metadata (like main pipeline)
   */
  getStreamInfo(): StreamInfo | null {
    if (!this.contextPtr) return null;

    const infoPtr = this.module._malloc(STREAM_INFO_SIZE);
    // Zero-init — see WasmBindings.getStreamInfo for the why (defends
    // against unrebuilt WASM emitting a shorter struct than JS expects).
    this.module.HEAPU8.fill(0, infoPtr, infoPtr + STREAM_INFO_SIZE);
    try {
      const ret = (this.module as any)._movi_thumbnail_get_stream_info(
        this.contextPtr,
        infoPtr,
      );
      if (ret !== 0) {
        return null;
      }
      return parseStreamInfo(this.module, infoPtr);
    } finally {
      this.module._free(infoPtr);
    }
  }

  /**
   * Get extradata for the video stream
   */
  getExtradata(): Uint8Array | null {
    if (!this.contextPtr) return null;

    const info = this.getStreamInfo();
    if (!info || info.extradataSize === 0) return null;

    const bufferPtr = this.module._malloc(info.extradataSize);
    try {
      const size = (this.module as any)._movi_thumbnail_get_extradata(
        this.contextPtr,
        bufferPtr,
        info.extradataSize,
      );

      if (size <= 0) return null;

      // Copy data out of WASM memory
      const result = new Uint8Array(size);
      result.set(this.module.HEAPU8.subarray(bufferPtr, bufferPtr + size));
      return result;
    } finally {
      this.module._free(bufferPtr);
    }
  }

  /**
   * Decode current packet to YUV (preserves HDR)
   */
  decodeCurrentPacketYUV(): {
    width: number;
    height: number;
    yPlane: Uint8Array;
    uPlane: Uint8Array;
    vPlane: Uint8Array;
    yStride: number;
    uStride: number;
    vStride: number;
  } | null {
    if (!this.contextPtr) return null;

    const ret = (this.module as any)._movi_thumbnail_decode_frame_yuv(
      this.contextPtr,
    );
    if (ret < 0) return null;

    const width = (this.module as any)._movi_thumbnail_get_frame_width(
      this.contextPtr,
    );
    const height = (this.module as any)._movi_thumbnail_get_frame_height(
      this.contextPtr,
    );

    const yPtr = (this.module as any)._movi_thumbnail_get_plane_data(
      this.contextPtr,
      0,
    );
    const uPtr = (this.module as any)._movi_thumbnail_get_plane_data(
      this.contextPtr,
      1,
    );
    const vPtr = (this.module as any)._movi_thumbnail_get_plane_data(
      this.contextPtr,
      2,
    );

    const yStride = (this.module as any)._movi_thumbnail_get_plane_linesize(
      this.contextPtr,
      0,
    );
    const uStride = (this.module as any)._movi_thumbnail_get_plane_linesize(
      this.contextPtr,
      1,
    );
    const vStride = (this.module as any)._movi_thumbnail_get_plane_linesize(
      this.contextPtr,
      2,
    );

    if (!yPtr || !uPtr || !vPtr) return null;

    // Copy plane data (YUV420 subsampling)
    const ySize = yStride * height;
    const uvHeight = Math.ceil(height / 2);
    const uSize = uStride * uvHeight;
    const vSize = vStride * uvHeight;

    const yPlane = new Uint8Array(
      this.module.HEAPU8.subarray(yPtr, yPtr + ySize).slice(),
    );
    const uPlane = new Uint8Array(
      this.module.HEAPU8.subarray(uPtr, uPtr + uSize).slice(),
    );
    const vPlane = new Uint8Array(
      this.module.HEAPU8.subarray(vPtr, vPtr + vSize).slice(),
    );

    return {
      width,
      height,
      yPlane,
      uPlane,
      vPlane,
      yStride,
      uStride,
      vStride,
    };
  }

  /**
   * Decode current packet (software fallback - SDR RGBA)
   */
  decodeCurrentPacket(width: number, height: number): Uint8Array | null {
    if (!this.contextPtr) return null;
    // Note: _movi_thumbnail_decode_frame returns pointer to RGBA buffer
    const ptr = (this.module as any)._movi_thumbnail_decode_frame(
      this.contextPtr,
      width,
      height,
    );
    if (!ptr) return null;

    const size = width * height * 4;
    return new Uint8Array(this.module.HEAPU8.subarray(ptr, ptr + size).slice());
  }

  /**
   * Clear RGB buffer to free memory after thumbnail is copied
   * Call this after creating the ImageData/Blob to release memory
   */
  clearBuffer(): void {
    if (!this.contextPtr) return;
    (this.module as any)._movi_thumbnail_clear_buffer(this.contextPtr);
  }

  /**
   * Destroy thumbnail context
   */
  destroy(): void {
    if (this.contextPtr) {
      this.module._movi_thumbnail_destroy(this.contextPtr);
      this.contextPtr = 0;
      this.isOpened = false;
      Logger.debug(TAG, "Thumbnail context destroyed");
    }
  }
}
