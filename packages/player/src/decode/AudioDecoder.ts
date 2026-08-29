import type { AudioTrack } from "../types";
import { Logger } from "../utils/Logger";
import { SoftwareAudioDecoder, type PCMFrame } from "./SoftwareAudioDecoder";
import { WasmBindings } from "../wasm/bindings";

const TAG = "AudioDecoder";

export class MoviAudioDecoder {
  private decoder: AudioDecoder | null = null;
  private swDecoder: SoftwareAudioDecoder | null = null;
  private bindings: WasmBindings | null = null;
  private useSoftware: boolean = false;

  private pendingData: AudioData[] = [];
  private pendingPCM: PCMFrame[] = [];
  private pendingChunks: Array<{
    data: Uint8Array;
    timestamp: number;
    keyframe: boolean;
  }> = [];
  private isConfigured: boolean = false;
  private onData: ((data: AudioData) => void) | null = null;
  private onPCM: ((frame: PCMFrame) => void) | null = null;
  private onError: ((error: Error) => void) | null = null;
  private currentTrack: AudioTrack | null = null;
  private hasTriedSoftwareFallback: boolean = false; // Track if we've already tried software fallback
  private hasDescription: boolean = false; // Whether decoder was configured with description (AudioSpecificConfig)
  // Stereo downmix policy for the software path (truehd, dca, ac3,
  // eac3, …). Defaults to stereo so headphones / laptop speakers
  // sound right; flipped off by setDownmix() when the player has
  // confirmed the output destination supports the source's full
  // channel count. WebCodecs path is unaffected — the browser
  // delivers AudioData at the source channel count and the AudioRenderer
  // either passes it through (if destination.channelCount matches)
  // or lets Web Audio do its own downmix.
  private _downmix = true;

  constructor() {
    Logger.debug(TAG, "Created");
  }

  setDownmix(downmix: boolean): void {
    this._downmix = downmix;
    if (this.swDecoder) this.swDecoder.setDownmix(downmix);
  }

  setBindings(bindings: WasmBindings) {
    this.bindings = bindings;
  }

  /** True when audio runs through the WASM software decoder (TrueHD/DTS/AC-3/
   *  Opus/FLAC/…) rather than WebCodecs. The software path decodes sub-realtime
   *  on a cold start, so callers can gate cold-start mitigations on this. */
  get usesSoftware(): boolean {
    return this.useSoftware;
  }

  /**
   * Configure the decoder for a specific track
   */
  async configure(track: AudioTrack, extradata?: Uint8Array): Promise<boolean> {
    this.currentTrack = track;
    this.useSoftware = false;
    this.hasTriedSoftwareFallback = false; // Reset fallback flag on new configuration

    if (this.swDecoder) {
      this.swDecoder.close();
      this.swDecoder = null;
    }

    // Check if we should force software decoding for this codec
    if (this.needsSoftwareDecoding(track.codec)) {
      Logger.info(TAG, `Forcing software decoding for codec: ${track.codec}`);
      return this.initSoftwareDecoder();
    }

    // Force software decoding for multi-channel audio (> 2 channels)
    // Safari and some browsers have issues with > 2 channels WebCodecs decoding
    if (track.channels > 2) {
      Logger.info(
        TAG,
        `Forcing software decoding for multi-channel audio: ${track.channels} channels`,
      );
      return this.initSoftwareDecoder();
    }

    if (!("AudioDecoder" in window)) {
      Logger.error(TAG, "WebCodecs AudioDecoder not supported");
      return this.initSoftwareDecoder();
    }

    // Map codec names to WebCodecs codec strings
    const codecString = this.mapCodecToWebCodecs(track.codec);
    if (!codecString) {
      Logger.warn(
        TAG,
        `Codec ${track.codec} not natively supported, trying software.`,
      );
      return this.initSoftwareDecoder();
    }

    // Build config object
    const config: AudioDecoderConfig = {
      codec: codecString,
      sampleRate: track.sampleRate,
      numberOfChannels: track.channels,
    };

    // Add description (extradata) if available
    this.hasDescription = false;
    if (extradata && extradata.length > 0) {
      config.description = extradata;
      this.hasDescription = true;
    }

    // Check if codec is supported
    try {
      const support = await AudioDecoder.isConfigSupported(config);

      if (!support.supported) {
        Logger.warn(
          TAG,
          `Codec not supported by hardware: ${codecString}. Trying software.`,
        );
        return this.initSoftwareDecoder();
      }
    } catch (error) {
      Logger.warn(TAG, `Codec config check failed: ${codecString}`, error);
      return this.initSoftwareDecoder();
    }

    // Create decoder
    this.decoder = new AudioDecoder({
      output: (data) => {
        if (this.onData) {
          this.onData(data);
        } else {
          this.pendingData.push(data);
        }
      },
      error: async (error) => {
        Logger.error(TAG, "Decoder error", error);

        // Automatically fallback to software decoder if not already using it
        if (
          !this.useSoftware &&
          !this.hasTriedSoftwareFallback &&
          this.currentTrack
        ) {
          Logger.warn(
            TAG,
            "Hardware decoder error detected, automatically switching to software decoder",
          );
          this.hasTriedSoftwareFallback = true;

          // Try to switch to software decoder
          const switched = await this.initSoftwareDecoder();
          if (switched) {
            Logger.info(
              TAG,
              "Successfully switched to software decoder after hardware error",
            );
            // Don't call onError if we successfully switched - the error is handled
            return;
          } else {
            Logger.error(
              TAG,
              "Failed to switch to software decoder, error will be propagated",
            );
          }
        }

        // Call error callback if we couldn't switch or already using software
        if (this.onError) {
          this.onError(error);
        }
      },
    });

    // Configure decoder
    try {
      this.decoder.configure(config);
      this.isConfigured = true;
      Logger.info(
        TAG,
        `Configured: ${codecString} ${track.sampleRate}Hz ${track.channels}ch`,
      );
      return true;
    } catch (error) {
      Logger.error(TAG, "Failed to configure decoder", error);
      return this.initSoftwareDecoder();
    }
  }

  private needsSoftwareDecoding(codec: string): boolean {
    const transcodingCodecs = [
      "eac3",
      "ac3",
      "dts",
      "dca",
      "truehd",
      "mlp",
      "opus",
      // FLAC's WebCodecs path reliably throws "EncodingError: Decoding error"
      // (the FLAC STREAMINFO description it wants is finicky / browser-specific).
      // The error→software fallback recovers in some browsers but not others, so
      // decode FLAC in software from the start — like opus. (FFmpeg WASM handles
      // it fine; verified producing samples.)
      "flac",
    ];
    return transcodingCodecs.includes(codec.toLowerCase());
  }

  private async initSoftwareDecoder(): Promise<boolean> {
    if (!this.currentTrack) return false;
    if (!this.bindings) {
      Logger.error(
        TAG,
        "Cannot switch to software decoder: bindings not available",
      );
      return false;
    }

    Logger.info(TAG, "Initializing software decoder fallback");
    this.useSoftware = true;

    if (this.decoder) {
      try {
        this.decoder.close();
      } catch (e) {}
      this.decoder = null;
    }

    this.swDecoder = new SoftwareAudioDecoder(this.bindings);
    // Carry forward the player-set downmix policy so a fresh swDecoder
    // (e.g. an audio-track switch) doesn't snap back to stereo while
    // the renderer is still wired for multi-channel output.
    this.swDecoder.setDownmix(this._downmix);
    this.swDecoder.setOnData((frame) => {
      if (this.onPCM) this.onPCM(frame);
      else this.pendingPCM.push(frame);
    });
    this.swDecoder.setOnError((e) => {
      Logger.error(TAG, "Software decoder error", e);
      if (this.onError) this.onError(e);
    });

    const success = await this.swDecoder.configure(this.currentTrack);
    if (success) {
      this.isConfigured = true;

      // Process pending chunks
      if (this.pendingChunks.length > 0) {
        const chunks = [...this.pendingChunks];
        this.pendingChunks = [];
        for (const chunk of chunks) {
          this.decode(chunk.data, chunk.timestamp, chunk.keyframe);
        }
      }
      return true;
    }
    return false;
  }

  /**
   * Map FFmpeg codec names to WebCodecs codec strings
   */
  private mapCodecToWebCodecs(codec: string): string | null {
    const codecLower = codec.toLowerCase();

    // AAC
    if (codecLower === "aac" || codecLower === "aac_latm") {
      return "mp4a.40.2"; // AAC-LC
    }

    // MP3
    if (codecLower === "mp3") {
      return "mp3";
    }

    // Opus - although in transcoding list, some browsers might support it natively
    if (codecLower === "opus") {
      return "opus";
    }

    // Vorbis
    if (codecLower === "vorbis") {
      return "vorbis";
    }

    // FLAC
    if (codecLower === "flac") {
      return "flac";
    }

    // AMR-NB
    if (codecLower === "amr_nb" || codecLower === "amrnb") {
      return "samr";
    }

    // AMR-WB
    if (codecLower === "amr_wb" || codecLower === "amrwb") {
      return "sawb";
    }

    // AC3 / E-AC3
    if (codecLower === "ac3") {
      return "ac-3";
    }
    if (codecLower === "eac3" || codecLower === "ec3") {
      return "ec-3";
    }

    return null;
  }

  /**
   * Decode an encoded audio chunk
   */
  decode(data: Uint8Array, timestamp: number, keyframe: boolean): void {
    if (!this.isConfigured) {
      this.pendingChunks.push({ data, timestamp, keyframe });
      return;
    }

    if (this.useSoftware && this.swDecoder) {
      this.swDecoder.decode(data, timestamp, keyframe);
      return;
    }

    if (!this.decoder) {
      Logger.warn(TAG, "Decoder not configured");
      return;
    }

    // Check if decoder is in a valid state
    if (this.decoder.state === "closed") {
      Logger.warn(TAG, "Decoder is closed, cannot decode");
      return;
    }

    // Strip ADTS header if present and decoder has description (AudioSpecificConfig).
    // MPEG-TS containers deliver AAC as ADTS frames, but when WebCodecs has description
    // it expects raw AAC frames without ADTS headers.
    const chunkData = this.hasDescription
      ? MoviAudioDecoder.stripAdtsHeader(data)
      : data;

    const chunk = new EncodedAudioChunk({
      type: keyframe ? "key" : "delta",
      timestamp: timestamp * 1_000_000, // Convert to microseconds
      data: chunkData,
    });

    try {
      this.decoder.decode(chunk);
    } catch (error) {
      Logger.error(TAG, "Decode error", error);

      // Automatically fallback to software decoder if not already using it
      if (
        !this.useSoftware &&
        !this.hasTriedSoftwareFallback &&
        this.currentTrack
      ) {
        Logger.warn(
          TAG,
          "Decode exception detected, automatically switching to software decoder",
        );
        this.hasTriedSoftwareFallback = true;

        // Add current chunk to pending chunks so it gets processed after switch
        this.pendingChunks.push({ data, timestamp, keyframe });

        // Try to switch to software decoder
        this.initSoftwareDecoder()
          .then((switched) => {
            if (switched) {
              Logger.info(
                TAG,
                "Successfully switched to software decoder after decode exception",
              );
              // Pending chunks will be processed by initSoftwareDecoder
            } else {
              Logger.error(TAG, "Failed to switch to software decoder");
              // Mark as not configured to stop further decode attempts
              this.isConfigured = false;
            }
          })
          .catch((err) => {
            Logger.error(TAG, "Error during software decoder fallback", err);
            this.isConfigured = false;
          });
        return;
      }

      // Mark as not configured to stop further decode attempts
      this.isConfigured = false;
    }
  }

  /**
   * Set data output callback
   */
  setOnData(callback: (data: AudioData) => void): void {
    this.onData = callback;

    // Flush any pending data
    while (this.pendingData.length > 0) {
      const data = this.pendingData.shift()!;
      callback(data);
    }
  }

  /**
   * Set PCM frame output callback (used by the software decoder path).
   */
  setOnPCM(callback: (frame: PCMFrame) => void): void {
    this.onPCM = callback;

    while (this.pendingPCM.length > 0) {
      const frame = this.pendingPCM.shift()!;
      callback(frame);
    }
  }

  /**
   * Set error callback
   */
  setOnError(callback: (error: Error) => void): void {
    this.onError = callback;
  }

  /**
   * Flush the decoder
   */
  async flush(): Promise<void> {
    // Software path (TrueHD/DTS/Opus/FLAC/…): the WebCodecs `decoder` is null,
    // so flush the WASM decoder instead. Skipping this leaves stale decoder
    // state across a seek/replay — TrueHD then rejects packets (sendPacket →
    // AVERROR_INVALIDDATA) until the next major-sync, an audible buzz/dropout.
    if (this.useSoftware && this.swDecoder) {
      await this.swDecoder.flush();
      return;
    }
    if (!this.decoder) return;

    try {
      await this.decoder.flush();
    } catch (error) {
      Logger.error(TAG, "Flush error", error);
    }
  }

  /**
   * Reset the decoder
   */
  reset(): void {
    if (this.decoder) {
      try {
        this.decoder.reset();
      } catch (error) {
        Logger.error(TAG, "Reset error", error);
      }
    }

    // Close pending data
    for (const data of this.pendingData) {
      data.close();
    }
    this.pendingData = [];
    this.pendingPCM = [];
  }

  /**
   * Close the decoder
   */
  close(): void {
    this.reset();

    if (this.decoder) {
      try {
        this.decoder.close();
      } catch (error) {
        // Ignore close errors
      }
      this.decoder = null;
    }

    this.isConfigured = false;
    this.onData = null;
    this.onError = null;

    Logger.debug(TAG, "Closed");
  }

  /**
   * Check if decoder is configured
   */
  get configured(): boolean {
    return this.isConfigured;
  }

  /**
   * Get queue size
   */
  get queueSize(): number {
    // Note: swDecoder is currently synchronous so its queue is effectively 0
    return this.decoder?.decodeQueueSize ?? 0;
  }

  /**
   * Get decoder stats for nerd stats overlay
   */
  getStats(): { decoderType: string; queueSize: number } {
    return {
      decoderType: this.useSoftware ? "Software (FFmpeg)" : "Hardware (WebCodecs)",
      queueSize: this.queueSize,
    };
  }

  /**
   * Strip ADTS header from AAC packet data if present.
   * ADTS header is 7 bytes (without CRC) or 9 bytes (with CRC).
   * Sync word: 0xFFF (12 bits).
   */
  private static stripAdtsHeader(data: Uint8Array): Uint8Array {
    if (data.length < 7) return data;

    // Check ADTS sync word (0xFFF = 12 bits)
    if (data[0] !== 0xff || (data[1] & 0xf0) !== 0xf0) {
      return data; // Not ADTS, return as-is
    }

    // protection_absent flag (bit 0 of byte 1): 1 = no CRC, 0 = CRC present
    const protectionAbsent = data[1] & 0x01;
    const headerSize = protectionAbsent ? 7 : 9;

    // ADTS frame length is in bits 30-42 (13 bits) spanning bytes 3-5
    const frameLength =
      ((data[3] & 0x03) << 11) | (data[4] << 3) | ((data[5] & 0xe0) >> 5);

    // Sanity check: frame length should match data length (or be close)
    if (frameLength > 0 && frameLength <= data.length && headerSize < data.length) {
      return data.subarray(headerSize, frameLength);
    }

    // If frame length doesn't match, just strip the header
    if (headerSize < data.length) {
      return data.subarray(headerSize);
    }

    return data;
  }
}
