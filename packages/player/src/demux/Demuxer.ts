/**
 * Demuxer - FFmpeg-based demuxer using Asyncify for async I/O
 */

//hvc1.4.10.L93.B0

//hvc1.4.10.H153.8.9d

import type { SourceAdapter } from "../source/SourceAdapter";
import type {
  Track,
  VideoTrack,
  AudioTrack,
  SubtitleTrack,
  MediaInfo,
  Packet,
} from "../types";
import {
  WasmBindings,
  ThumbnailBindings,
  loadWasmModule,
  loadWasmModuleNew,
  type MoviWasmModule,
  type StreamInfo,
  type DataSource,
} from "../wasm";
import { CodecParser } from "../decode/CodecParser";
import { Logger } from "../utils/Logger";

const TAG = "Demuxer";

/**
 * Adapter to convert SourceAdapter to DataSource interface
 */
class SourceDataAdapter implements DataSource {
  private source: SourceAdapter;
  private fileSize: number = 0;

  constructor(source: SourceAdapter) {
    this.source = source;
  }

  async getSize(): Promise<number> {
    if (this.fileSize === 0) {
      this.fileSize = await this.source.getSize();
    }
    return this.fileSize;
  }

  async read(offset: number, size: number): Promise<Uint8Array> {
    const buffer = await this.source.read(offset, size);
    return new Uint8Array(buffer);
  }
}

export class Demuxer {
  private source: SourceAdapter;
  private module: MoviWasmModule | null = null;
  private bindings: WasmBindings | null = null;
  private tracks: Track[] = [];
  private duration: number = 0;
  private isOpened: boolean = false;
  private wasmBinary?: Uint8Array;
  private useNewWasmInstance: boolean = false;

  /**
   * @param source - Data source adapter
   * @param wasmBinary - Optional WASM binary
   * @param useNewWasmInstance - If true, creates isolated WASM instance (for preview pipeline)
   */
  constructor(
    source: SourceAdapter,
    wasmBinary?: Uint8Array,
    useNewWasmInstance: boolean = false,
  ) {
    this.source = source;
    this.wasmBinary = wasmBinary;
    this.useNewWasmInstance = useNewWasmInstance;
  }

  /**
   * Open the media file and parse metadata
   */
  async open(): Promise<MediaInfo> {
    Logger.info(TAG, "Opening media...");

    // Load WASM module - use isolated instance for preview to avoid memory conflicts
    if (this.useNewWasmInstance) {
      Logger.debug(TAG, "Using isolated WASM instance");
      this.module = await loadWasmModuleNew({ wasmBinary: this.wasmBinary });
    } else {
      this.module = await loadWasmModule({ wasmBinary: this.wasmBinary });
    }
    this.bindings = new WasmBindings(this.module);

    // Create context
    if (!this.bindings.create()) {
      throw new Error("Failed to create demuxer context");
    }

    // Set up data source adapter for async I/O
    const dataSource = new SourceDataAdapter(this.source);
    this.bindings.setDataSource(dataSource);

    // Open media (async - uses Asyncify for I/O)
    const streamCount = await this.bindings.open();
    Logger.info(TAG, `Opened with ${streamCount} streams`);

    this.isOpened = true;

    // Get duration and start time
    this.duration = this.bindings.getDuration();
    const startTime = this.bindings.getStartTime();

    // Enumerate streams
    this.tracks = this.enumerateTracks();

    Logger.info(
      TAG,
      `Media info: duration=${this.duration}s, start=${startTime}s, tracks=${this.tracks.length}`,
    );

    // Get title from metadata
    const title = this.bindings.getMetadataTitle();
    const metadata: Record<string, string> = {};
    if (title) metadata.title = title;

    // Get chapters
    const chapters = this.bindings.getChapters();
    if (chapters.length > 0) {
      Logger.info(TAG, `Found ${chapters.length} chapters`);
    }

    return {
      formatName: this.bindings.getFormatName(),
      duration: this.duration,
      bitRate: 0, // TODO
      startTime: startTime,
      tracks: this.tracks,
      chapters: chapters,
      metadata: metadata,
    };
  }

  /**
   * Enumerate all tracks
   */
  private enumerateTracks(): Track[] {
    if (!this.bindings) return [];

    const tracks: Track[] = [];
    const count = this.bindings.getStreamCount();

    for (let i = 0; i < count; i++) {
      const info = this.bindings.getStreamInfo(i);
      if (!info) continue;

      const track = this.convertStreamInfo(info);
      if (track) {
        tracks.push(track);
      }
    }

    return tracks;
  }

  /**
   * Convert StreamInfo to Track
   */
  /**
   * Convert StreamInfo to Track
   */
  private convertStreamInfo(info: StreamInfo): Track | null {
    let track: Track | null = null;

    // Fetch extradata first if available (needed for color space extraction)
    let extradata: Uint8Array | null = null;
    if (this.bindings && info.extradataSize > 0) {
      extradata = this.bindings.getExtradata(info.index);
    }

    switch (info.type) {
      case 0: // Video
        track = {
          id: info.index,
          type: "video",
          codec: info.codecName,
          width: info.width,
          height: info.height,
          frameRate: info.frameRate,
          bitRate: info.bitRate,
          profile: info.profile,
          level: info.level,
          language: info.language ? info.language : undefined,
          label: info.label ? info.label : undefined,
          rotation: info.rotation,
          pixelFormat: info.pixelFormat,
          colorRange: info.colorRange,
          projection: info.projection || undefined,
          isAttachedPic: info.isAttachedPic || undefined,
        } as VideoTrack;

        // Store extradata on track
        if (extradata) {
          track.extradata = extradata;
        }

        const videoTrack = track as VideoTrack;

        // Use color metadata directly from FFmpeg/WASM if available and valid
        // NOTE: FFmpeg often returns 'unknown', 'reserved' or 'bt709' even for HDR content if it's not strictly flagged.
        // We will trust it if it explicitly says BT.2020 or SMPTE2084/HLG.
        if (
          info.colorPrimaries &&
          info.colorPrimaries !== "unknown" &&
          info.colorPrimaries !== "reserved"
        ) {
          videoTrack.colorPrimaries = this.normalizeColorPrimaries(
            info.colorPrimaries,
          );
        }
        if (
          info.colorTransfer &&
          info.colorTransfer !== "unknown" &&
          info.colorTransfer !== "reserved"
        ) {
          videoTrack.colorTransfer = this.normalizeColorTransfer(
            info.colorTransfer,
          );
        }
        if (
          info.colorMatrix &&
          info.colorMatrix !== "unknown" &&
          info.colorMatrix !== "reserved"
        ) {
          videoTrack.colorSpace = this.normalizeColorMatrix(info.colorMatrix);
        }

        // HDR Detection
        const primaries = (videoTrack.colorPrimaries || "").toLowerCase();
        const transfer = (videoTrack.colorTransfer || "").toLowerCase();
        const isHDRTransfer =
          transfer.includes("pq") ||
          transfer.includes("hlg") ||
          transfer.includes("smpte2084") ||
          transfer.includes("arib-std-b67");
        const isBT2020 =
          primaries.includes("bt2020") || primaries.includes("rec2020");

        videoTrack.isHDR = isHDRTransfer || isBT2020;

        // HEURISTIC: If we have 4K content but metadata says "bt709" or is missing,
        // it is extremely likely to be HDR. We should trust the parser heuristic in this case.
        // Many containers (MP4/MKV) don't carry the VUI in a way FFmpeg exposes easily without full parse.
        const isLikelyHDRResolution =
          videoTrack.width >= 3840 && videoTrack.height >= 2160;
        const currentPrimaries = videoTrack.colorPrimaries || "";
        const currentTransfer = videoTrack.colorTransfer || "";

        // If explicitly missing or "suspiciously SDR" for 4K, try heuristic
        if (
          !videoTrack.colorPrimaries ||
          !videoTrack.colorTransfer ||
          (isLikelyHDRResolution &&
            (currentPrimaries === "bt709" || currentTransfer === "bt709"))
        ) {
          const colorInfo = CodecParser.getColorSpaceInfo(
            info.codecName,
            extradata ?? undefined,
            info.width,
            info.height,
          );
          if (colorInfo) {
            if (colorInfo.colorPrimaries)
              videoTrack.colorPrimaries = colorInfo.colorPrimaries;
            if (colorInfo.colorTransfer)
              videoTrack.colorTransfer = colorInfo.colorTransfer;
            if (colorInfo.colorSpace)
              videoTrack.colorSpace = colorInfo.colorSpace;

            Logger.info(
              TAG,
              `Overriding/Filling Color Metadata via Heuristic: ${videoTrack.colorPrimaries}/${videoTrack.colorTransfer}`,
            );
          }
        }

        // Fallback for 10-bit profiles if metadata is still missing
        // If we know it's 10-bit HEVC but have no color info, default to HDR10
        if (
          (!videoTrack.colorPrimaries || !videoTrack.colorTransfer) &&
          videoTrack.codec.toLowerCase().startsWith("hvc1")
        ) {
          if (info.profile & 2 /* Main 10 */) {
            videoTrack.colorPrimaries = "bt2020";
            videoTrack.colorTransfer = "smpte2084";
            videoTrack.colorSpace = "bt2020-ncl";
            Logger.info(
              TAG,
              `Fallback: Assuming HDR10 for HEVC Main 10 profile without metadata`,
            );
          }
        }

        Logger.info(
          TAG,
          `Video Track Metadata: codec=${videoTrack.codec}, primaries=${videoTrack.colorPrimaries}, transfer=${videoTrack.colorTransfer}, matrix=${videoTrack.colorSpace}`,
        );
        break;

      case 1: // Audio
        track = {
          id: info.index,
          type: "audio",
          codec: info.codecName,
          channels: info.channels,
          sampleRate: info.sampleRate,
          bitRate: info.bitRate,
          language: info.language ? info.language : undefined,
          label: info.label ? info.label : undefined,
        } as AudioTrack;
        break;

      case 2: // Subtitle
        track = {
          id: info.index,
          type: "subtitle",
          codec: info.codecName,
          subtitleType: this.isImageSubtitle(info.codecName) ? "image" : "text",
          language: info.language ? info.language : undefined,
          label: info.label ? info.label : undefined,
        } as SubtitleTrack;
        break;
    }

    // Extradata is already fetched and set above for video tracks
    // For audio/subtitle tracks, set extradata if available
    if (track && track.type !== "video" && extradata) {
      track.extradata = extradata;
    }

    return track;
  }

  /**
   * Check if subtitle codec is image-based
   */
  private isImageSubtitle(codec: string): boolean {
    const imageCodecs = ["hdmv_pgs_subtitle", "dvd_subtitle", "dvb_subtitle"];
    return imageCodecs.includes(codec.toLowerCase());
  }

  /**
   * Normalize FFmpeg color primaries to WebCodecs enum values
   */
  private normalizeColorPrimaries(primaries: string): string {
    switch (primaries.toLowerCase()) {
      case "bt2020":
        return "bt2020";
      case "bt709":
        return "bt709";
      case "bt470bg":
        return "bt470bg";
      case "smpte170m":
        return "smpte170m";
      default:
        return primaries;
    }
  }

  /**
   * Normalize FFmpeg color transfer to WebCodecs enum values
   */
  private normalizeColorTransfer(transfer: string): string {
    switch (transfer.toLowerCase()) {
      case "smpte2084":
        return "smpte2084"; // PQ
      case "arib-std-b67":
        return "arib-std-b67"; // HLG
      case "bt709":
        return "bt709";
      case "smpte170m":
        return "smpte170m";
      case "linear":
        return "linear";
      case "iec61966-2-1":
        return "iec61966-2-1"; // sRGB
      default:
        return transfer;
    }
  }

  /**
   * Normalize FFmpeg color matrix names to WebCodecs enum values
   */
  private normalizeColorMatrix(matrix: string): string {
    switch (matrix.toLowerCase()) {
      case "bt2020nc":
        return "bt2020-ncl";
      case "bt2020c":
        return "bt2020-cl";
      case "smpte170m":
        return "smpte170m"; // Ensure this stays as is
      case "bt709":
        return "bt709";
      case "bt470bg":
        return "bt470bg";
      default:
        return matrix;
    }
  }

  /**
   * Get all tracks
   */
  getTracks(): Track[] {
    return [...this.tracks];
  }

  /**
   * Get video tracks
   */
  getVideoTracks(): VideoTrack[] {
    return this.tracks.filter((t): t is VideoTrack => t.type === "video");
  }

  /**
   * Get audio tracks
   */
  getAudioTracks(): AudioTrack[] {
    return this.tracks.filter((t): t is AudioTrack => t.type === "audio");
  }

  /**
   * Get subtitle tracks
   */
  getSubtitleTracks(): SubtitleTrack[] {
    return this.tracks.filter((t): t is SubtitleTrack => t.type === "subtitle");
  }

  /**
   * Get extradata for a track
   */
  getExtradata(trackId: number): Uint8Array | null {
    return this.bindings?.getExtradata(trackId) ?? null;
  }

  /**
   * Seek to timestamp (async due to Asyncify)
   */
  async seek(timestamp: number, flags: number = 1): Promise<void> {
    if (!this.bindings || !this.isOpened) {
      throw new Error("Demuxer not opened");
    }

    await this.bindings.seek(timestamp, -1, flags);
  }

  /**
   * Read next packet (async due to Asyncify)
   */
  async readPacket(): Promise<Packet | null> {
    if (!this.bindings || !this.isOpened) {
      throw new Error("Demuxer not opened");
    }

    const result = await this.bindings.readFrame();
    if (!result) return null;

    return {
      streamIndex: result.info.streamIndex,
      keyframe: result.info.keyframe,
      timestamp: result.info.pts,
      dts: result.info.dts,
      duration: result.info.duration,
      data: result.data,
      isIdr: result.info.isIdr,
      isRasl: result.info.isRasl,
    };
  }

  /**
   * Get duration
   */
  getDuration(): number {
    return this.duration;
  }

  /**
   * Close and cleanup
   */
  close(): void {
    if (this.bindings) {
      this.bindings.destroy();
      this.bindings = null;
    }

    this.isOpened = false;
    this.tracks = [];

    Logger.info(TAG, "Demuxer closed");
  }

  /**
   * Extract embedded cover art (attached_pic) as the raw encoded image
   * bytes (jpeg / png), or null if the source has none.
   *
   * Runs in a short-lived, isolated WASM context — NOT the live playback
   * demuxer — so reading the artwork packet never moves the main read
   * position and can't disturb playback or seeking. The cover art is the
   * single keyframe of the still-image "video" stream, so readKeyframe(0)
   * returns its packet directly; no decode pass and no extra C exports
   * are needed (a dedicated movi_get_attached_pic_data export would shift
   * the WASM layout and trip a latent FFmpeg audio overflow — see project
   * memory "Album Art Crashes WASM"). Caller owns MIME-typing and decode
   * into an ImageBitmap. Best-effort: any failure resolves to null.
   */
  static async extractAttachedPicture(
    source: SourceAdapter,
    fileSize: number,
    wasmBinary?: Uint8Array,
  ): Promise<Uint8Array | null> {
    if (fileSize <= 0) return null;
    let bindings: ThumbnailBindings | null = null;
    try {
      const module = await loadWasmModuleNew({ wasmBinary });
      bindings = new ThumbnailBindings(module);
      bindings.setDataSource({
        read: async (offset: number, size: number): Promise<Uint8Array> =>
          new Uint8Array(await source.read(offset, size)),
        getSize: async (): Promise<number> => fileSize,
      });
      if (!(await bindings.create(fileSize))) return null;
      if (!(await bindings.open())) return null;
      const size = await bindings.readKeyframe(0);
      if (size <= 0) return null;
      return bindings.getPacketDataCopy(size);
    } catch (e) {
      Logger.warn(TAG, "Attached-picture extraction failed", e);
      return null;
    } finally {
      // Tear the isolated context down immediately — one frame is all we
      // need; keeping a second WASM heap alive for a static image is waste.
      bindings?.destroy();
    }
  }

  getBindings(): WasmBindings | null {
    return this.bindings;
  }

  getModule(): MoviWasmModule | null {
    return this.module;
  }
}
