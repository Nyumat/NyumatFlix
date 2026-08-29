/**
 * VideoDecoder - WebCodecs-based video decoder
 */

import type { VideoTrack, VideoDecoderConfig } from "../types";
import { Logger } from "../utils/Logger";
import { SoftwareVideoDecoder } from "./SoftwareVideoDecoder";
import { WasmBindings } from "../wasm/bindings";

import { CodecParser } from "./CodecParser";

const TAG = "VideoDecoder";

export class MoviVideoDecoder {
  private decoder: VideoDecoder | null = null;
  private swDecoder: SoftwareVideoDecoder | null = null;
  private bindings: WasmBindings | null = null;
  private useSoftware: boolean = false;

  private pendingFrames: VideoFrame[] = [];
  private pendingChunks: Array<{
    data: Uint8Array;
    timestamp: number;
    keyframe: boolean;
  }> = [];
  // ... (fields same) ...
  private isConfigured: boolean = false;
  private onFrame: ((frame: VideoFrame) => void) | null = null;
  private onError: ((error: Error) => void) | null = null;
  private waitingForKeyframe: boolean = false;
  // Optional listener: notified whenever the decoder enters or exits its
  // "skip non-keyframes" recovery window. MoviPlayer uses this to flip into
  // buffering state during playback so audio + clock pause instead of running
  // through the silent video gap (an Open-GOP IDR rejection on .ts files can
  // produce 2+ seconds of "audio plays, video frozen" if we don't).
  public onKeyframeWaitChange: ((waiting: boolean) => void) | null = null;
  private errorCount: number = 0;
  private static MAX_ERRORS = 5; // Max consecutive errors before giving up
  private lastConfig: VideoDecoderConfig | null = null;
  private currentProfile: number | undefined;
  private currentTrack: VideoTrack | null = null;
  private lastErrorTime: number = 0;
  private openGopErrorCount: number = 0;
  private hardwareRetryCount: number = 0;
  private lastHardwareRetryTime: number = 0;
  private isResurrecting: boolean = false;
  private forceSoftware: boolean = false;
  private requiresSoftware: boolean = false; // True for 4:2:2/4:4:4 content that HW can't decode
  private targetFps: number = 0;
  private isRecovering: boolean = false;
  private lastRecreateTime: number = 0; // perf.now() of last decoder recreate
  private isAnnexBSource: boolean = false;
  private _loggedConversion: number = 0;
  private skippedWhileWaiting: number = 0;
  // True between a flush (seek) and the next successfully-decoded frame. Some
  // HW decoders reject the first keyframe after a flush for certain streams
  // (observed: 10-bit BT.2020/PQ HDR HEVC). If the post-flush keyframe keeps
  // getting rejected, we fall back to software quickly instead of stalling the
  // whole seek waiting for the (impossible) HW recovery.
  private justFlushed: boolean = false;
  // Latched when we resume (post-flush) on an IRAP keyframe: the RASL leading
  // pictures that may trail a CRA/BLA random-access point reference the absent
  // pre-RAP GOP, so they must be dropped (NoRaslOutputFlag=1). Chrome discards
  // them internally; Safari/VideoToolbox throws a hard EncodingError. We latch
  // on ANY post-flush keyframe and let the per-packet isRasl flag do the actual
  // dropping — after an IDR (no RASL) the latch is a harmless no-op that the
  // first trailing picture clears. Only mid-stream RAPs reached during
  // continuous playback (references present, not post-flush) keep their RASL.
  private skipRaslAfterResume: boolean = false;
  private postFlushKeyframeRejects: number = 0;
  // After this many consecutive keyframe rejections immediately following a
  // flush, give up on HW for this stream and switch to software decoding.
  private static POST_FLUSH_REJECT_LIMIT = 2;
  // Mid-stream open-GOP (HEVC CRA frames the HW decoder keeps rejecting): no
  // JS-only recovery keeps this on HW — every rejection drops the decoder into
  // a configure-like state where only a true IDR is accepted, so the next
  // CRA is rejected too. Switch to software after just a few rejections so the
  // user sees ~1s of recovery instead of ~11s of per-GOP stutter. (The old
  // limit was 15; lowered because the HW path never actually recovers here.)
  private static MID_STREAM_OPENGOP_REJECT_LIMIT = 3;
  // When true, open-GOP keyframe rejections never fall back to software — the
  // decoder keeps reset+retrying on hardware. With the poster generated off the
  // main decoder (isolated thumbnail pipeline) and HEVC seeks recreating the
  // decoder into a fresh state, the HW path recovers on its own, so the SW
  // fallback (which dropped 4K/120fps HDR HEVC to throttled software) is no
  // longer needed and hurt more than it helped.
  private static DISABLE_OPENGOP_SW_FALLBACK = true;

  constructor(forceSoftware: boolean = false) {
    this.forceSoftware = forceSoftware;
    Logger.debug(TAG, `Created (forceSoftware: ${forceSoftware})`);
  }

  setBindings(bindings: WasmBindings) {
    this.bindings = bindings;
  }

  private setWaitingForKeyframe(waiting: boolean): void {
    // Restart the tiny-packet drop window whenever we begin waiting for a
    // keyframe — that marks a fresh (re)configure/flush, the only phase where
    // the corrupt sub-4-byte packets appear.
    if (waiting) this.chunksSinceKeyframeWait = 0;
    if (this.waitingForKeyframe === waiting) return;
    this.waitingForKeyframe = waiting;
    if (this.onKeyframeWaitChange) {
      try {
        this.onKeyframeWaitChange(waiting);
      } catch {
        // listener errors must not break the decoder pipeline
      }
    }
  }

  /**
   * Configure the decoder for a specific track
   */
  async configure(
    track: VideoTrack,
    extradata?: Uint8Array,
    targetFps: number = 0,
  ): Promise<boolean> {
    this.currentTrack = track;
    this.targetFps = targetFps;
    this.currentProfile = track.profile;

    // Reset fallback state on new configuration
    this.useSoftware = false;
    this.requiresSoftware = false;
    this.isAnnexBSource = false;
    this.openGopErrorCount = 0;
    this.hardwareRetryCount = 0;
    this.lastHardwareRetryTime = 0;
    if (this.swDecoder) {
      this.swDecoder.close();
      this.swDecoder = null;
    }

    // If forceSoftware is enabled, skip WebCodecs and use WASM software decoder
    if (this.forceSoftware) {
      Logger.info(TAG, "Force software decoding enabled, using WASM decoder");
      this.useSoftware = true;
      return this.initSoftwareDecoder();
    }


    if (!("VideoDecoder" in window)) {
      // No WebCodecs (e.g. Firefox, esp. mobile) — fall back to the WASM
      // software decoder instead of failing (which left video stuck buffering
      // while audio fell back on its own).
      Logger.warn(
        TAG,
        "WebCodecs VideoDecoder not supported — falling back to software decoder",
      );
      this.useSoftware = true;
      return this.initSoftwareDecoder();
    }

    // Use codec string from CodecParser if extradata is available
    let codecString = CodecParser.getCodecString(track.codec, track.extradata);

    // Fallback if parser returns null or empty
    if (!codecString) {
      Logger.debug(
        TAG,
        "CodecParser returned null, falling back to manual mapping",
      );
      codecString = this.mapCodecToWebCodecs(
        track.codec,
        track.width,
        track.height,
        track.profile,
        track.level,
      );
    }

    // const codecString = this.mapCodecToWebCodecs(track.codec, track.width, track.height, track.profile, track.level);
    if (!codecString) {
      Logger.error(TAG, `Unsupported codec: ${track.codec}`);
      return false;
    }


    // Build config object
    const config: VideoDecoderConfig = {
      codec: codecString,
      codedWidth: track.width,
      codedHeight: track.height,
      hardwareAcceleration: "prefer-hardware",
    };

    // Add color space if available
    if (track.colorPrimaries || track.colorTransfer || track.colorSpace) {
      config.colorSpace = {
        primaries: track.colorPrimaries as VideoColorPrimaries,
        transfer: track.colorTransfer as VideoTransferCharacteristics,
        matrix: track.colorSpace as VideoMatrixCoefficients,
      };
      Logger.info(
        TAG,
        `Decoder color space: primaries=${track.colorPrimaries}, transfer=${track.colorTransfer}, matrix=${track.colorSpace}`,
      );
    }

    // Add description (extradata) if available - required for some codecs
    let description = extradata || track.extradata;

    // Check if description is Annex B (starts with 00 00 01 or 00 00 00 01)
    if (description && description.length > 4) {
      const isAnnexB =
        (description[0] === 0 &&
          description[1] === 0 &&
          description[2] === 1) ||
        (description[0] === 0 &&
          description[1] === 0 &&
          description[2] === 0 &&
          description[3] === 1);

      if (isAnnexB) {
        // Annex B extradata means packets are also Annex B (MPEG-TS, raw streams).
        // WebCodecs handles raw Annex B packets with inline parameter sets (VPS/SPS/PPS in keyframes).
        // Providing hvcC/avcC description while feeding Annex B packets causes format mismatch → decode errors.
        // Strip description and let decoder work from inline parameter sets — same as v0.1.5 behavior.
        Logger.warn(
          TAG,
          "Extradata is Annex B — stripping description (decoder will use inline parameter sets from keyframes).",
        );
        description = undefined;
      }
    }

    if (description && description.length > 0) {
      config.description = description;
    }

    // Check if codec is supported
    try {
      let support: VideoDecoderSupport;
      try {
        support = await VideoDecoder.isConfigSupported(config);
      } catch (e) {
        // If it throws (e.g. TypeError for invalid enum), treat as not supported
        // and let the color stripping logic below retry
        support = { supported: false, config: config };
      }

      // If the hardware-preferred config wasn't supported, retry without the
      // preference — some browsers report unsupported when hw decode is
      // unavailable instead of silently falling back to software.
      if (!support.supported && config.hardwareAcceleration === "prefer-hardware") {
        const configNoHw = { ...config };
        delete configNoHw.hardwareAcceleration;
        const supportNoHw = await VideoDecoder.isConfigSupported(configNoHw).catch(
          () => ({ supported: false, config: configNoHw }) as VideoDecoderSupport,
        );
        if (supportNoHw.supported) {
          Logger.info(TAG, `Hardware decode unavailable for ${config.codec}; using no-preference.`);
          delete config.hardwareAcceleration;
          support = supportNoHw;
        }
      }

      // If failed and we have color space info, try removing it as it might be causing validation issues
      // while the codec itself is supported. The decoder often detects color space from bitstream anyway.
      if (!support.supported && config.colorSpace) {
        Logger.info(
          TAG,
          `Codec config failed with color space. Retrying without explicit color metadata.`,
        );
        const configNoColor = { ...config };
        delete configNoColor.colorSpace;

        const supportNoColor =
          await VideoDecoder.isConfigSupported(configNoColor);
        if (supportNoColor.supported) {
          Logger.info(
            TAG,
            `Codec supported WITHOUT explicit color metadata. Using stripped config.`,
          );
          // Use the config without color space for the decoder,
          // but 'track' still has the info for the renderer to use!
          delete config.colorSpace;
          support = supportNoColor;
        }
      }

      if (!support.supported) {
        Logger.warn(TAG, `Codec config not supported: ${config.codec}`);

        // Try fallback to manual mapping if generic/parser string failed
        // This handles cases where the container/extradata specifies a very high/specific profile (e.g. H153)
        // that the browser rejects, but a generic compatible profile (L93) might work.

        // Special fallback for HEVC Rext (Profile 4): many 8-bit/10-bit files are
        // tagged Rext by FFmpeg but actually decode fine as Main10 or Main profile.
        // Try Main10 first (profile 2) with the actual level, then Main (profile 1).
        if (codecString && codecString.startsWith("hvc1.4")) {
          const levelStr = track.level ? `L${track.level}` : "L120";
          // Try profile-4 strings first (Chrome accepts these for Rext content),
          // then Main10 (profile 2) with extradata patching as last resort.
          const rextFallbacks = [
            `hvc1.4.10.${levelStr}.B0`,  // Rext with actual level (best match)
            "hvc1.4.10.L93.B0",          // Rext with safe low level
            `hvc1.2.4.${levelStr}.B0`,   // Main10 with actual level (needs extradata patch)
          ];
          for (const fallback of rextFallbacks) {
            if (fallback === codecString) continue;
            Logger.info(TAG, `HEVC Rext: trying fallback ${fallback}`);
            const rextConfig = { ...config, codec: fallback };
            if (rextConfig.colorSpace) delete rextConfig.colorSpace;

            // If switching to Main10 (profile 2), patch extradata to match —
            // hardware decoders cross-check codec string vs hvcC header.
            if (fallback.startsWith("hvc1.2") && rextConfig.description) {
              const descBytes = rextConfig.description instanceof Uint8Array
                ? rextConfig.description
                : new Uint8Array(rextConfig.description as ArrayBuffer);
              if (descBytes.length > 5 && (descBytes[1] & 0x1f) === 4) {
                const patched = new Uint8Array(descBytes);
                patched[1] = (patched[1] & 0xe0) | 2; // Profile IDC 4 → 2
                rextConfig.description = patched;
                Logger.info(TAG, `Patched extradata: Profile IDC 4 → 2 (Main10)`);
              }
            }

            const rextSupport = await VideoDecoder.isConfigSupported(rextConfig);
            if (rextSupport.supported) {
              Logger.info(TAG, `HEVC Rext fallback ${fallback} IS supported. Switching.`);
              config.codec = fallback;
              config.description = rextConfig.description;
              if (config.colorSpace) delete config.colorSpace;
              codecString = fallback;
              support = rextSupport;
              break;
            }
          }
        }

        const manualCodec = this.mapCodecToWebCodecs(
          track.codec,
          track.width,
          track.height,
          track.profile,
          track.level,
        );

        if (manualCodec && manualCodec !== codecString) {
          Logger.info(TAG, `Retrying with manual codec string: ${manualCodec}`);
          const manualConfig = { ...config, codec: manualCodec };
          if (manualConfig.colorSpace) delete manualConfig.colorSpace; // Also strip color for fallback

          const manualSupport =
            await VideoDecoder.isConfigSupported(manualConfig);

          if (manualSupport.supported) {
            Logger.info(
              TAG,
              `Manual codec string IS supported. Using ${manualCodec} instead of ${codecString}`,
            );
            config.codec = manualCodec;
            if (config.colorSpace) delete config.colorSpace;
            codecString = manualCodec;
            support = manualSupport;
          }
        }

        if (!support.supported) {
          Logger.warn(
            TAG,
            `Codec not supported by hardware: ${codecString}. Trying software.`,
          );
          return this.initSoftwareDecoder();
        }
      }
    } catch (error) {
      Logger.warn(TAG, `Codec config check failed: ${codecString}`, error);

      // Retry without color space on error
      if (config.colorSpace) {
        try {
          Logger.info(
            TAG,
            "Retrying config check without color space after error",
          );
          delete config.colorSpace;
          const support = await VideoDecoder.isConfigSupported(config);
          if (support.supported) {
            Logger.info(
              TAG,
              "Codec check passed after removing color space. Proceeding.",
            );
            // Continue to creation
          } else {
            return this.initSoftwareDecoder();
          }
        } catch (e) {
          return this.initSoftwareDecoder();
        }
      } else {
        // Fallback to software?
        return this.initSoftwareDecoder();
      }
    }

    // Create decoder
    this.decoder = new VideoDecoder({
      output: (frame) => {
        this.openGopErrorCount = 0;
        this.errorCount = 0;
        this.isResurrecting = false; // Success!
        this.justFlushed = false; // a frame decoded — HW is fine post-flush
        this.postFlushKeyframeRejects = 0;
        if (this.onFrame) {
          this.onFrame(frame);
        } else {
          this.pendingFrames.push(frame);
        }
      },
      error: (error) => {
        Logger.error(TAG, "Decoder error", error);
        // Try to recover by recovering
        this.recoverFromError(error);
      },
    });

    // Configure decoder (reuse config from isConfigSupported check)
    this.lastConfig = config;
    try {
      this.decoder.configure(config);
      this.isConfigured = true;
      Logger.info(
        TAG,
        `Configured: ${codecString} ${track.width}x${track.height} hwAccel=${config.hardwareAcceleration ?? "no-preference"}`,
      );
      return true;
    } catch (error) {
      Logger.error(TAG, "Failed to configure decoder", error);
      return this.initSoftwareDecoder();
    }
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

    // Close HW
    if (this.decoder) {
      try {
        this.decoder.close();
      } catch (e) {}
      this.decoder = null;
    }

    this.swDecoder = new SoftwareVideoDecoder(this.bindings);
    this.swDecoder.setOnFrame((frame) => {
      if (this.onFrame) this.onFrame(frame);
      else {
        this.pendingFrames.push(frame);
      }
    });
    this.swDecoder.setOnError((e) => {
      Logger.error(TAG, "Software decoder error", e);
      if (this.onError) this.onError(e);
    });

    // For high-FPS content (>60fps), cap software decode at 60fps to prevent
    // main thread blocking that starves the audio pipeline.
    // The presentation loop already targets 60fps — extra frames are wasted CPU.
    const swTargetFps = this.targetFps > 0
      ? this.targetFps
      : (this.currentTrack.frameRate > 60 ? 60 : 0);
    const success = await this.swDecoder.configure(
      this.currentTrack,
      swTargetFps,
    );
    if (swTargetFps > 0 && this.currentTrack.frameRate > swTargetFps) {
      Logger.info(TAG, `Software decoder FPS capped: ${this.currentTrack.frameRate}fps → ${swTargetFps}fps`);
    }
    if (success) {
      this.isConfigured = true;
      this.setWaitingForKeyframe(true); // Wait for keyframe on new decoder

      // Process pending chunks
      if (this.pendingChunks.length > 0) {
        Logger.info(
          TAG,
          `Processing ${this.pendingChunks.length} pending chunks for software decoder`,
        );
        const chunks = [...this.pendingChunks];
        this.pendingChunks = []; // Clear first to avoid duplicates if decode requeues

        for (const chunk of chunks) {
          this.decode(chunk.data, chunk.timestamp, chunk.keyframe);
        }
      }

      return true;
    }
    return false;
  }

  /**
   * Recreate the decoder after a fatal error
   */
  private recreateDecoder(): boolean {
    if (this.useSoftware) return false;
    if (!this.lastConfig) return false;

    this.lastRecreateTime = performance.now();
    Logger.warn(TAG, "Recreating decoder to recover from error");

    // Close existing
    try {
      this.decoder?.close();
    } catch (e) {}

    // Create new
    this.decoder = new VideoDecoder({
      output: (frame) => {
        this.openGopErrorCount = 0;
        this.errorCount = 0;
        this.isResurrecting = false; // Success!
        this.justFlushed = false; // a frame decoded — HW is fine post-flush
        this.postFlushKeyframeRejects = 0;
        if (this.onFrame) {
          this.onFrame(frame);
        } else {
          this.pendingFrames.push(frame);
        }
      },
      error: (error) => {
        Logger.error(TAG, "Decoder error", error);
        // Try to recover by recreating
        this.recoverFromError(error);
      },
    });

    // Configure
    try {
      this.decoder.configure(this.lastConfig);
      this.isConfigured = true;

      // A recreated decoder holds no reference frames, so the keyframe it resumes
      // on must be sent as `key`. For an open-GOP CRA (isIdr=false) that means NOT
      // down-grading it to `delta` (craAsDelta = isOpenGopKey && !justFlushed) —
      // a fresh decoder rejects a CRA-as-delta ("key frame required after
      // configure") but accepts a CRA-as-key as the random-access restart it is.
      // Without this, a CRA-opening / CRA-only stream can never resume on hardware.
      this.justFlushed = true;

      // Wait for next keyframe to resync — don't re-feed cached keyframe
      // as subsequent non-keyframes may fail on certain content (DoVi P8 etc.)
      // causing a recreate→re-feed→fail loop that triggers software fallback.
      this.setWaitingForKeyframe(true);
      return true;
    } catch (error) {
      Logger.error(TAG, "Failed to recreate decoder", error);
      return false;
    }
  }

  private lastChunkInfo: {
    timestamp: number;
    keyframe: boolean;
    size: number;
    // True if the last submitted chunk was a true IDR/BLA sent as `key` while
    // the decoder was waiting for a clean GOP start (post-flush/post-error). If
    // THAT gets rejected, the HW decoder is refusing a genuine random-access
    // point — characteristic of 10-bit DoVi/HDR HEVC — and no amount of
    // reset+retry recovers it, so we must fall back to software fast.
    wasIdrWhileWaiting: boolean;
  } | null = null;

  /**
   * Decode an encoded video chunk
   */
  // Non-keyframe packets at or below this byte size are treated as corrupt and
  // dropped before reaching the decoder. Observed on some AV1 sources: 3-byte
  // delta packets that throw EncodingError and close the HW decoder, forcing a
  // recreate→skip-non-keyframes recovery (frozen/garbage video for a second+).
  // A real AV1 inter frame carries an OBU header + frame header + tile data and
  // is always larger; the only sub-handful-of-bytes payloads are malformed or
  // show_existing_frame OBUs that the HW decoder mishandles here. Dropping one
  // at most skips a single repeated frame — far cheaper than the crash+recover.
  private static MIN_DELTA_PACKET_BYTES = 4;

  // The tiny-packet drop only matters in the startup window: the corrupt
  // sub-4-byte delta packets that crash the HW decoder cluster right after a
  // (re)configure/flush, at the head of the first GOP. In steady state the
  // stream is past that point, so we stop screening — a stray tiny packet
  // there is far more likely legitimate than corrupt, and screening every
  // chunk forever risks dropping valid frames. Counts chunks fed since the
  // last setWaitingForKeyframe(true); reset on every (re)configure/flush.
  private static TINY_PACKET_DROP_WINDOW = 120;
  private chunksSinceKeyframeWait = 0;

  // Current playback rate, mirrored from the player. At 1x the HW decoder
  // handles AV1 show_existing_frame (sub-4-byte) packets fine, so we must NOT
  // drop them there — dropping breaks the reference chain and a later keyframe
  // ends up rejected (EncodingError → buffering freeze). Only at non-1x, where
  // feeding these packets itself crashes the decoder, do we screen them out.
  private playbackRate = 1;

  setPlaybackRate(rate: number): void {
    this.playbackRate = rate;
  }

  decode(
    data: Uint8Array,
    timestamp: number,
    keyframe: boolean,
    dts?: number,
    // True IDR/BLA random-access keyframe (HW accepts as `key`). When a packet
    // is flagged keyframe but isIdr is false it's an open-GOP CRA — sent as
    // `delta` mid-stream so the HW decoder keeps running. Defaults to true so
    // callers that don't pass it (and non-keyframes) behave as before.
    isIdr: boolean = true,
    // True for an HEVC RASL leading picture (NAL 8/9). Dropped after a
    // random-access resume (see skipRaslAfterResume). Defaults to false.
    isRasl: boolean = false,
  ): void {
    // A keyframe is only a real random-access point if the demuxer classified
    // it as IDR/BLA. Open-GOP CRA frames arrive flagged keyframe but isIdr
    // false — track that so the chunk-build path can down-grade them to delta.
    const isOpenGopKey = keyframe && !isIdr;
    this.lastChunkInfo = {
      timestamp,
      keyframe,
      size: data.byteLength,
      // A true IDR fed as `key` while still waiting for a clean GOP start. If
      // the decoder rejects this, it's refusing a genuine random-access point.
      wasIdrWhileWaiting: keyframe && !isOpenGopKey && this.waitingForKeyframe,
    };

    if (!this.isConfigured) return;

    this.chunksSinceKeyframeWait++;

    // Drop tiny corrupt non-keyframe packets before they crash the decoder —
    // but ONLY at non-1x rates and within the startup window after a
    // (re)configure/flush. At 1x these sub-4-byte show_existing_frame packets
    // decode fine; dropping them there breaks the reference chain and trips a
    // later keyframe reject. Keyframes are never dropped — losing one breaks
    // the whole GOP.
    if (
      this.playbackRate !== 1 &&
      !keyframe &&
      data.byteLength < MoviVideoDecoder.MIN_DELTA_PACKET_BYTES &&
      this.chunksSinceKeyframeWait <= MoviVideoDecoder.TINY_PACKET_DROP_WINDOW
    ) {
      Logger.debug(
        TAG,
        `Dropping ${data.byteLength}-byte non-keyframe packet at ${timestamp.toFixed(3)}s (corrupt/too small, startup window at ${this.playbackRate}x)`,
      );
      return;
    }

    if (this.useSoftware && this.swDecoder) {
      // RESURRECTION LOGIC: Periodically try to switch back to hardware only on a TRUE IDR keyframe
      // DISABLED if software is explicitly forced or content needs software (4:2:2/4:4:4)
      if (keyframe && !this.forceSoftware && !this.requiresSoftware && this.shouldRetryHardware(data)) {
        Logger.info(
          TAG,
          `Found a sync frame! Attempting hardware resurrection (Attempt ${this.hardwareRetryCount + 1})...`,
        );
        this.lastHardwareRetryTime = performance.now();
        this.hardwareRetryCount++;

        // Temporarily switch back to HW path
        this.useSoftware = false;
        this.openGopErrorCount = 0;
        this.isResurrecting = true;

        if (!this.recreateDecoder()) {
          // If HW recreation failed immediately, go back to safety of software
          this.useSoftware = true;
          this.isResurrecting = false;
        } else {
          // Try decoding this chunk with hardware.
          // If it fails, recoverFromError will trigger software fallback again.
        }
      }

      if (this.useSoftware) {
        // Software decoder logic...
        if (!this.swDecoder.configured) {
          this.pendingChunks.push({ data, timestamp, keyframe });
          return;
        }

        // Strict keyframe check for software decoder too!
        if (this.waitingForKeyframe && !keyframe) {
          return;
        }
        if (keyframe) {
          this.setWaitingForKeyframe(false);
        }

        this.swDecoder.decode(data, timestamp, dts ?? timestamp, keyframe);
        return;
      }
    }

    if (!this.decoder) {
      return; // Silently skip when not configured
    }

    // Check if decoder is in a valid state
    if (this.decoder.state === "closed") {
      // Async error callback may have already triggered recovery — don't double-recover
      if (!this.isRecovering) {
        this.recoverFromError(new Error("Decoder closed unexpectedly"));
      }
      return;
    }

    // If we're waiting for a keyframe after a seek/error, skip non-keyframes —
    // the decoder has no reference frames, so a delta can't restart a GOP.
    // A keyframe (IDR or CRA) DOES restart it: a CRA is a clean random-access
    // point, so on the first keyframe post-flush we resume on it even if it's a
    // CRA. (Streams seeked into an all-CRA region — e.g. a DoVi P8 .ts whose
    // only IDR is back at the file start — would otherwise never resume and
    // stay black. The CRA's RASL leading pictures may not decode; that's
    // handled by skipping until the next decodable frame.) The chunk-build
    // path below sends a post-flush CRA as `key` (not delta) so the decoder
    // treats it as the random-access restart it is.
    if (this.waitingForKeyframe && !keyframe) {
      this.skippedWhileWaiting++;
      return;
    }
    if (keyframe && this.waitingForKeyframe) {
      if (this.skippedWhileWaiting > 0) {
        Logger.debug(TAG, `Skipped ${this.skippedWhileWaiting} non-keyframes while waiting for keyframe`);
        this.skippedWhileWaiting = 0;
      }
    }

    // Drop orphaned RASL leading pictures after a random-access resume. A
    // CRA/BLA used as a seek target has NoRaslOutputFlag=1: its trailing RASL
    // pictures reference the flushed pre-RAP GOP and are non-decodable. Chrome
    // discards them internally; Safari/VideoToolbox throws a hard EncodingError
    // that wedges the seek (recreate → wait-for-IDR → seek timeout → stuck). The
    // RASL also have PTS < the RAP, so the seek-target frame filter would drop
    // their output anyway — skipping here is free and correct on every browser.
    if (this.skipRaslAfterResume && !keyframe) {
      if (isRasl) {
        return; // orphaned leading picture — discard
      }
      // First non-leading picture (trailing/RADL): references are valid from
      // the RAP onward, so stop skipping and resume normal decode.
      this.skipRaslAfterResume = false;
    }

    // Pass packet data as-is — Chrome's WebCodecs handles both Annex B and
    // length-prefixed formats natively. Converting Annex B → length-prefixed
    // was causing decode errors on DoVi P8 non-keyframes.
    let chunkData = data;

    // Post-flush IDR rejection workaround: the FIRST true keyframe after a
    // flush (still waitingForKeyframe) on a length-prefixed HEVC stream gets
    // rejected by the HW decoder ("wasn't a key frame") when it leads with an
    // Access Unit Delimiter NAL — observed on 10-bit DoVi/HDR HEVC, where the
    // very same packet decodes fine at startup but is refused right after a
    // seek-flush. Stripping the AUD makes the decoder accept the IDR and keeps
    // the stream on hardware instead of falling back to software. Only the
    // first post-flush keyframe is touched; mid-stream packets pass through
    // untouched (no per-frame cost, no reference-chain risk).
    if (keyframe && !isOpenGopKey && this.waitingForKeyframe) {
      const stripped = MoviVideoDecoder.stripAudLengthPrefixed(data);
      if (stripped !== data) {
        chunkData = stripped;
      }
    }

    // Diagnostic for Annex B conversion — log first keyframe + first non-keyframe
    if (this.isAnnexBSource && (this._loggedConversion < 2)) {
      if ((keyframe && this._loggedConversion === 0) || (!keyframe && this._loggedConversion === 1)) {
        this._loggedConversion++;
        const nalUnits = MoviVideoDecoder.splitAnnexBNalUnits(data);
        const nalTypes = nalUnits.map(n => (n[0] >> 1) & 0x3f);
        const filtered = nalTypes.filter(t => t < 62);
        // Check first bytes of packet to verify Annex B format
        const head = Array.from(data.subarray(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' ');
        Logger.info(TAG, `Annex B ${keyframe ? 'KEY' : 'DELTA'}: ${data.length}B → ${chunkData.length}B, NALs: [${nalTypes}], kept: [${filtered}], head: ${head}`);
      }
    }

    // Reached here only on a real frame to feed: an IDR, a CRA, or a delta.
    // Clear the wait state on ANY keyframe — both IDR and CRA are random-access
    // points the decoder can restart on (we now resume on a post-flush CRA when
    // no IDR is available; see the keyframe-wait skip above).
    if (keyframe) {
      // Post-flush resume on an IRAP: arm RASL-dropping for any leading
      // pictures that trail this CRA/BLA (their pre-RAP refs were flushed, so
      // they're orphaned). A mid-stream RAP reached during continuous playback
      // (not waiting) keeps its RASL — references are present. Latch on ANY
      // post-flush keyframe; after a true IDR (no RASL) it's a harmless no-op
      // the first trailing picture clears.
      this.skipRaslAfterResume = this.waitingForKeyframe;
      this.setWaitingForKeyframe(false);
      // Cache converted keyframe for instant recovery after decoder recreation
    }

    // Check if we've exceeded max errors
    if (this.errorCount >= MoviVideoDecoder.MAX_ERRORS) {
      return; // Give up after too many errors
    }

    // Open-GOP CRA mid-stream: the decoder still holds the previous GOP's
    // reference frames, so feed the CRA (and its RASL leading pictures that
    // follow) as `delta`. Sending it as `key` would make WebCodecs reject it
    // ("wasn't a key frame"). We only get here for a CRA when NOT waiting for a
    // keyframe (line above skips CRA while waiting) — i.e. references are
    // present — so delta is valid. The extra !justFlushed guard is belt-and-
    // suspenders: a CRA fed as delta right after a flush (before any frame has
    // decoded) fails with "key frame required after configure", so if we somehow
    // reach here still flushed, send it as `key` (it'll be rejected as open-GOP
    // and trigger the proper wait-for-IDR path rather than corrupting decode).
    const craAsDelta = isOpenGopKey && !this.justFlushed;
    const chunkType: EncodedVideoChunkType = craAsDelta
      ? "delta"
      : keyframe
      ? "key"
      : "delta";

    const chunk = new EncodedVideoChunk({
      type: chunkType,
      timestamp: timestamp * 1_000_000, // Convert to microseconds
      data: chunkData,
    });

    try {
      this.decoder.decode(chunk);
    } catch (error) {
      // Use shared recovery logic
      this.recoverFromError(error as Error);

      // Handle fallback to software immediately for this chunk
      if (this.useSoftware) {
        Logger.warn(
          TAG,
          "Hardware decode failed, queuing chunk for software decoder",
        );
        this.pendingChunks.push({ data, timestamp, keyframe });
      }
    }
  }

  private recoverFromError(error: Error) {
    // Guard against double-recovery (async error callback + synchronous closed detection)
    if (this.isRecovering) return;
    this.isRecovering = true;

    try {
      this._doRecover(error);
    } finally {
      this.isRecovering = false;
    }
  }

  private _doRecover(error: Error) {
    const isKeyFrameError =
      error.message &&
      (error.message.includes("wasn't a key frame") ||
        error.message.includes("key frame is required"));

    // Check time since last error to distinguish between sporadic and continuous errors
    // BUT IGNORE Open GOP errors for count increment
    const now = performance.now();

    if (!isKeyFrameError) {
      // Use 30 second window. If errors happen more frequently than once every 30s, they accumulate.
      // If we have > 30s of clean playback, we reset to 1.
      if (now - this.lastErrorTime > 30000) {
        this.errorCount = 1;
      } else {
        this.errorCount++;
      }
      this.lastErrorTime = now;
    }

    // Detailed Debug Logging
    const errorInfo = {
      message: error.message,
      name: error.name,
      lastChunk: this.lastChunkInfo,
      queueSize: this.decoder?.decodeQueueSize,
      state: this.decoder?.state,
      codec: this.lastConfig?.codec,
      errorCount: this.errorCount,
      isUnsupportedProfile: false,
    };

    if (isKeyFrameError) {
      // If we were just trying to switch back to hardware, and it failed on frame 1,
      // then don't even bother with the retry cycle. Just go back to software.
      if (this.isResurrecting) {
        Logger.warn(
          TAG,
          "Hardware resurrection failed on sync frame. Returning to software decoder.",
        );
        this.isResurrecting = false;
        this.initSoftwareDecoder();
        return;
      }

      this.openGopErrorCount++;
      Logger.warn(
        TAG,
        `Decoding warning: Frame was marked as keyframe but decoder rejected it (Open GOP?). Timestamp: ${this.lastChunkInfo?.timestamp}. Count (OpenGOP): ${this.openGopErrorCount}`,
      );

      // Post-flush keyframe rejection: some HW decoders refuse the first keyframe
      // after a seek-flush for certain streams (10-bit BT.2020/PQ HDR HEVC has
      // been observed to reject genuine, well-formed IDRs). HW reset+retry never
      // recovers in that case, so the seek would stall until timeout. Detect it
      // by counting rejections that happen before any frame decodes post-flush,
      // and switch to the software decoder quickly. (Mid-stream Open-GOP on .ts
      // files still uses the reset+retry path below — justFlushed is false there
      // because frames have been decoding.)
      //
      // Restrict to HEVC: this was only ever observed on HDR HEVC. H.264/AVC
      // genuine Open-GOP keyframes get rejected on some seeks too, but the
      // reset+retry path recovers fine — dropping them to the software decoder
      // just throttles 1080p below realtime and triggers a desync/stall loop.
      const codec = this.lastConfig?.codec ?? "";
      const isHevc = codec.startsWith("hvc1.") || codec.startsWith("hev1.");
      // Treat as a post-flush rejection if EITHER we're still in the flush
      // window (justFlushed) OR the rejected frame was a genuine IDR we fed
      // while waiting for a clean GOP start. The latter matters because a 3s
      // seek-timeout + forced completion can decode a stray frame and clear
      // justFlushed before the IDR rejections cluster — yet a rejected true IDR
      // is the definitive sign the HW decoder won't take this stream's
      // random-access points (10-bit DoVi/HDR HEVC), so reset+retry is hopeless.
      const idrRejected = this.lastChunkInfo?.wasIdrWhileWaiting === true;
      if (
        !MoviVideoDecoder.DISABLE_OPENGOP_SW_FALLBACK &&
        (this.justFlushed || idrRejected) &&
        isHevc &&
        !this.forceSoftware &&
        !this.useSoftware
      ) {
        this.postFlushKeyframeRejects++;
        if (
          this.postFlushKeyframeRejects >=
          MoviVideoDecoder.POST_FLUSH_REJECT_LIMIT
        ) {
          Logger.error(
            TAG,
            `Hardware rejected ${this.postFlushKeyframeRejects} ${idrRejected ? "genuine IDR" : "post-flush"} keyframes — falling back to software decoder for this stream.`,
          );
          this.initSoftwareDecoder();
          return;
        }
      }

      // Mid-stream open-GOP on HEVC: the rejected "keyframe" is a CRA sync
      // frame, not an IDR. Once the HW decoder rejects it, it drops into a
      // configure/flush-like state where ONLY a true IDR is accepted — a
      // re-fed delta fails with "key frame required after configure", and
      // sending the next GOP's CRA as `key` just gets rejected again. So the
      // reset→skip-RASL→recover loop repeats every GOP (~1s of video freeze
      // each) and only escapes after 15 rounds (~11s of stutter) by switching
      // to software anyway. There is no JS-only way to keep this stream on the
      // HW decoder — the proper fix is C-side: surface is_idr so seeks land on
      // a true IDR and mid-stream CRA is classified, not guessed. Until then,
      // switch to software FAST (after a few rejections) so we trade ~11s of
      // per-GOP stutter for ~1s. Software decodes this content at realtime.
      const codecForFallback = this.lastConfig?.codec ?? "";
      const isHevcMidStream =
        (codecForFallback.startsWith("hvc1.") ||
          codecForFallback.startsWith("hev1.")) &&
        !this.justFlushed;
      const openGopFallbackLimit = isHevcMidStream
        ? MoviVideoDecoder.MID_STREAM_OPENGOP_REJECT_LIMIT
        : 15;

      // If we keep hitting these, hardware decoder is too strict. Fallback to software.
      if (
        !MoviVideoDecoder.DISABLE_OPENGOP_SW_FALLBACK &&
        this.openGopErrorCount > openGopFallbackLimit
      ) {
        Logger.error(
          TAG,
          `Persistent Open GOP errors detected (${this.openGopErrorCount} > ${openGopFallbackLimit}). Switching to software decoder.`,
        );
        this.initSoftwareDecoder();
        return;
      }

      // CRITICAL FIX: We MUST reset the decoder to clear the error state even for Open GOP warnings.
      // If we don't reset, the VideoDecoder remains in an errored state and rejects all subsequent chunks.
      if (this.decoder && this.decoder.state !== "closed") {
        try {
          this.decoder.reset();
          this.decoder.configure(this.lastConfig!);
          this.setWaitingForKeyframe(true);
          return;
        } catch (e) {
          Logger.warn(
            TAG,
            "Fast reset failed during Open GOP recovery, proceeding to full recreation",
          );
        }
      }
    } else {
      Logger.error(
        TAG,
        `Decoding error details: ${JSON.stringify(errorInfo)}. Count: ${this.errorCount}`,
      );
    }

    if (this.errorCount >= MoviVideoDecoder.MAX_ERRORS) {
      Logger.error(
        TAG,
        `Max errors (${MoviVideoDecoder.MAX_ERRORS}) exceeded within short duration. Emitting fatal error.`,
      );
      if (this.onError) this.onError(error);
      return;
    }

    // Treat error as fatal if using HEVC Rext profile (4) which is often unsupported
    // But per user request, we DO NOT switch to software mid-stream.
    // We will attempt to reset/reconfigure the hardware decoder instead.
    if (
      this.currentProfile === 4 &&
      this.lastConfig?.codec.startsWith("hvc1.")
    ) {
      Logger.warn(TAG, "HEVC Rext profile error.");

      // Use Rext (profile 4) with actual level from the track
      const levelStr = this.currentTrack?.level ? `L${this.currentTrack.level}` : "L120";
      const fallbackStr = `hvc1.4.10.${levelStr}.B0`;
      // If we aren't already using the fallback string, try switching to it
      if (this.lastConfig.codec !== fallbackStr) {
        Logger.info(
          TAG,
          `Attempting recovery by switching to Rext fallback: ${fallbackStr}`,
        );

        this.lastConfig.codec = fallbackStr;
        // No extradata patching needed — staying on profile 4 (Rext)

        this.openGopErrorCount = 0;
        // Reconfigure with new string
        try {
          if (this.decoder && this.decoder.state !== "closed") {
            this.decoder.configure(this.lastConfig);
            this.setWaitingForKeyframe(true);
            this.errorCount = 0; // Reset error count as we are trying a new config/hack
            return;
          } else {
            // Decoder closed, try full recreate with new config
            if (this.recreateDecoder()) {
              this.errorCount = 0;
              return;
            }
          }
        } catch (e) {
          Logger.error(TAG, "Fallback configuration failed", e);
        }
      } else {
        Logger.warn(
          TAG,
          "HEVC Rext fallback string also failed. Attempting reset/recreation.",
        );
      }
    }

    // FAST RECOVERY: Try reset() first if decoder is not closed
    if (this.decoder && this.decoder.state !== "closed") {
      try {
        Logger.warn(TAG, "Attempting fast reset recovery");
        this.decoder.reset();
        this.decoder.configure(this.lastConfig!);

        this.setWaitingForKeyframe(true);
        return;
      } catch (e) {
        Logger.warn(TAG, "Fast reset failed, trying full recreation");
      }
    }

    // FULL RECOVERY: Recreate decoder
    this.recreateDecoder();
  }

  /**
   * Map FFmpeg codec names to WebCodecs codec strings
   */
  private mapCodecToWebCodecs(
    codec: string,
    _width: number,
    _height: number,
    profile?: number,
    _level?: number,
  ): string | null {
    const codecLower = codec.toLowerCase();

    // H.264 / AVC
    if (codecLower === "h264" || codecLower === "avc1") {
      // Use a common profile/level - will be overridden by extradata
      return "avc1.640028"; // High profile, level 4.0
    }

    // H.265 / HEVC
    if (
      codecLower === "hevc" ||
      codecLower === "h265" ||
      codecLower === "hvc1"
    ) {
      // Handle HEVC profiles
      if (profile === 4) {
        // FF_PROFILE_HEVC_REXT — Chrome accepts hvc1.4 codec strings for Rext.
        // Use actual level from the stream for correct resolution/fps support.
        const levelStr = _level ? `L${_level}` : "L120";
        Logger.info(
          TAG,
          `Detected HEVC Rext profile. Using hvc1.4.10.${levelStr}.B0`,
        );
        return `hvc1.4.10.${levelStr}.B0`;
      }

      // Main 10 Profile (Profile 2)
      if (profile === 2) {
        // If level is provided use it, otherwise default to Level 5.1 (153) for 4K support
        // Note: WebCodecs is picky about level matching the content.
        // L153 = 5.1, supports up to 4K@60
        // L120 = 4.0, supports up to 1080p@30 / 4K@bad
        const levelStr = _level ? `L${_level}` : "L153";
        Logger.info(
          TAG,
          `Mapping HEVC Main 10 profile (2) to hvc1.2.4.${levelStr}.B0`,
        );
        return `hvc1.2.4.${levelStr}.B0`;
      }

      // Main Profile (Profile 1)
      if (profile === 1) {
        const levelStr = _level ? `L${_level}` : "L120"; // Default to 4.0
        return `hvc1.1.6.${levelStr}.B0`;
      }

      // Default fallback
      return "hvc1.1.6.L93.B0"; // Main profile, Level 3.1
    }

    // VP8
    if (codecLower === "vp8") {
      return "vp8";
    }

    // VP9
    // vp09.{profile}.{level}.{bitDepth}.{chromaSub}.{primaries}.{transfer}.{matrix}.{range}
    // Chroma: 00=4:4:4, 01=4:2:0, 02=4:2:2, 03=4:2:0 colocated
    if (codecLower === "vp9") {
      // Determine level from resolution: 4K→51, 1080p→41, 720p→31
      const level = _width && _width > 1920 ? 51 : _width && _width > 1280 ? 41 : 31;
      const levelStr = level.toString().padStart(2, "0");

      // Profile 1: 8-bit 4:2:2/4:4:4
      if (profile === 1) {
        // Chroma: 02 for 4:2:2 (most common for Profile 1)
        Logger.info(TAG, `Mapping VP9 Profile 1 to vp09.01.${levelStr}.08.02 (4:2:2 8-bit)`);
        return `vp09.01.${levelStr}.08.02.01.01.01.00`;
      }

      // Profile 2: 10-bit 4:2:0 (HDR)
      if (profile === 2) {
        Logger.info(TAG, `Mapping VP9 Profile 2 to vp09.02.${levelStr}.10 (HDR)`);
        return `vp09.02.${levelStr}.10.01.09.16.09.00`;
      }

      // Profile 3: 10/12-bit 4:2:2/4:4:4 (HDR)
      if (profile === 3) {
        return `vp09.03.${levelStr}.10.02.09.16.09.00`;
      }

      // Profile 0: 8-bit 4:2:0 (default)
      return `vp09.00.${levelStr}.08.01.01.01.01.00`;
    }

    // AV1
    if (codecLower === "av1") {
      return "av01.0.01M.08"; // Main profile, level 2.1, 8-bit
    }

    // VVC / H.266
    if (codecLower === "vvc" || codecLower === "vvc1" || codecLower === "vvi1") {
      return "vvc1.1.L51"; // Main profile, Level 5.1
    }

    // H.263 (legacy codec - browser support varies)
    if (codecLower === "h263" || codecLower === "h263p") {
      return "h263"; // May not be supported by most browsers
    }

    // MPEG-4 Part 2 (legacy)
    if (codecLower === "mpeg4" || codecLower === "mp4v") {
      return "mp4v.20.9"; // Simple profile
    }

    return null;
  }

  /**
   * Set frame output callback
   */
  setOnFrame(callback: (frame: VideoFrame) => void): void {
    this.onFrame = callback;

    if (this.swDecoder) {
      this.swDecoder.setOnFrame(callback);
    }

    // Flush any pending frames
    while (this.pendingFrames.length > 0) {
      const frame = this.pendingFrames.shift()!;
      callback(frame);
    }
  }

  /**
   * Set error callback
   */
  setOnError(callback: (error: Error) => void): void {
    this.onError = callback;
    if (this.swDecoder) {
      this.swDecoder.setOnError(callback);
    }
  }

  /**
   * Flush the decoder
   */
  async flush(): Promise<void> {
    this.openGopErrorCount = 0;
    this.justFlushed = true;
    this.postFlushKeyframeRejects = 0;
    // Re-derived on the next keyframe (post-flush resume re-latches it); clear
    // here so a half-finished RASL skip from the prior position can't leak.
    this.skipRaslAfterResume = false;
    this.pendingChunks = []; // Clear pending inputs
    // After a flush the decoder has NO reference frames, so it must restart on
    // a true IDR/BLA. Force the keyframe-wait so open-GOP CRA frames (and
    // non-keyframes) that arrive before the first real IDR are skipped instead
    // of fed as `delta` — a CRA-as-delta here fails with "key frame required
    // after configure" and corrupts the next true IDR's decode too. This is the
    // authoritative "references missing" signal; the decode() path keys its
    // CRA→delta downgrade off NOT being in this state.
    this.setWaitingForKeyframe(true);
    if (this.swDecoder) {
      return this.swDecoder.flush();
    }
    if (!this.decoder) return;

    // Open-GOP HEVC restart: a decoder that has already decoded frames refuses
    // an open-GOP CRA sent as `key` after a plain flush() ("Open GOP?"), yet a
    // freshly configure()'d decoder accepts the very same CRA (the first CRA
    // after a seek is accepted at startup but rejected on replay of the same
    // position). For streams whose seek target may land on a CRA (no nearby
    // IDR — e.g. 4K DoVi P8 .ts), recreate the decoder on flush instead of
    // flush()ing it, so the post-seek decoder is in the same fresh state as
    // startup. Recreate is ~tens of ms; only on seeks (flush), not per frame.
    const codec = this.lastConfig?.codec ?? "";
    const isHevc = codec.startsWith("hvc1.") || codec.startsWith("hev1.");
    if (isHevc && !this.forceSoftware && !this.useSoftware) {
      if (this.recreateDecoder()) {
        return; // fresh decoder is configured and waiting for a keyframe
      }
      // recreate failed — fall through to a normal flush
    }

    try {
      // Timeout flush — WebCodecs flush() can hang on slow devices
      await Promise.race([
        this.decoder.flush(),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error("flush timeout")), 1000)
        ),
      ]);
    } catch (error) {
      Logger.warn(TAG, "Flush timeout or error, resetting decoder", error);
      try {
        this.decoder.reset();
        // Reconfigure after reset
        if (this.lastConfig) {
          this.decoder.configure(this.lastConfig);
        }
      } catch (e) {
        Logger.error(TAG, "Reset after flush timeout failed", e);
      }
    }
  }

  /**
   * Reset the decoder
   */
  reset(): void {
    this.openGopErrorCount = 0;
    if (this.swDecoder) {
      this.swDecoder.reset();
    }
    if (this.decoder) {
      try {
        this.decoder.reset();
      } catch (error) {
        Logger.error(TAG, "Reset error", error);
      }
    }

    // Close pending frames
    for (const frame of this.pendingFrames) {
      frame.close();
    }
    this.pendingFrames = [];
    this.pendingChunks = [];
  }

  /**
   * Close the decoder
   */
  close(): void {
    this.reset();

    if (this.swDecoder) {
      this.swDecoder.close();
      this.swDecoder = null;
    }

    if (this.decoder) {
      try {
        this.decoder.close();
      } catch (error) {
        // Ignore close errors
      }
      this.decoder = null;
    }

    this.isConfigured = false;
    this.onFrame = null;
    this.onError = null;
    this.useSoftware = false;

    Logger.debug(TAG, "Closed");
  }
  /**
   * Check if decoder is configured
   */
  get configured(): boolean {
    return this.isConfigured;
  }

  /**
   * Helper to check if we should try switching back to hardware
   */
  private shouldRetryHardware(data: Uint8Array): boolean {
    if (!this.useSoftware || !this.currentTrack) return false;

    // Safety: Don't retry too many times if it keeps failing
    if (this.hardwareRetryCount >= 10) return false;

    // CRITICAL: Only retry hardware if this keyframe is actually an IDR/Sync frame.
    // Hardware decoders will reject non-IDR keyframes as start points after a seek/flush.
    if (!this.isLikelySyncFrame(data)) {
      return false;
    }

    const now = performance.now();
    // Cooldown logic: First retry after 10s, subsequent every 30s
    const cooldown = this.hardwareRetryCount === 0 ? 10000 : 30000;

    return now - this.lastHardwareRetryTime > cooldown;
  }

  /**
   * Bitwise NAL unit inspection to detect true Sync/IDR frames
   */
  private isLikelySyncFrame(data: Uint8Array): boolean {
    if (!this.lastConfig) return true;
    const codec = this.lastConfig.codec.toLowerCase();

    try {
      let headerPos = -1;
      // Search for NAL start code (0001 or 001) or assume AVCC 4-byte size
      if (data[0] === 0 && data[1] === 0 && data[2] === 1) headerPos = 3;
      else if (data[0] === 0 && data[1] === 0 && data[2] === 0 && data[3] === 1)
        headerPos = 4;
      else if (data.length > 4) headerPos = 4; // Most MP4/MKV hardware chunks are AVCC

      if (headerPos === -1 || headerPos >= data.length) return false;

      const header = data[headerPos];

      // H.264 (AVC)
      if (codec.includes("avc1") || codec.includes("h264")) {
        const type = header & 0x1f;
        return type === 5; // IDR Slice
      }

      // H.265 (HEVC)
      if (
        codec.includes("hvc1") ||
        codec.includes("hev1") ||
        codec.includes("h265")
      ) {
        const type = (header >> 1) & 0x3f;
        // Types 16-21 are IRAP (Intra Random Access Point)
        // 19/20 are IDR, 21 is CRA (Clean Random Access)
        return type >= 16 && type <= 21;
      }

      // H.266 (VVC) — 2-byte NAL header
      // Byte 1: nal_unit_type(5) | nuh_temporal_id_plus1(3)
      // IDR_W_RADL=7, IDR_N_LP=8, CRA=9, GDR=10
      if (codec.includes("vvc1") || codec.includes("vvi1")) {
        if (headerPos + 1 < data.length) {
          const type = (data[headerPos + 1] >> 3) & 0x1f;
          return type >= 7 && type <= 9;
        }
      }
    } catch (e) {}

    return true; // Default to true if parsing fails or codec unknown
  }

  /**
   * Get queue size
   */
  get queueSize(): number {
    return (
      (this.swDecoder?.queueSize ?? 0) + (this.decoder?.decodeQueueSize ?? 0)
    );
  }

  /**
   * Check if software decoder is being used
   */
  get isSoftware(): boolean {
    return this.useSoftware;
  }

  get isWaitingForKeyframe(): boolean {
    return this.waitingForKeyframe;
  }

  // True while the decoder is recovering from a decode error (recreate +
  // wait-for-keyframe), or within `graceMs` after the last recreate. During
  // this window an empty video queue is EXPECTED — the GOP is being rebuilt —
  // so the player should not treat it as a playback stall. Some HW decoders
  // (observed: high-bitrate 1080p H.264) throw a transient EncodingError on
  // each IDR; recreate recovers within ~1 GOP, but the brief empty queue would
  // otherwise trip stall detection into a buffering loop.
  isRecentlyRecovering(graceMs: number = 1200): boolean {
    if (this.waitingForKeyframe) return true;
    if (this.lastRecreateTime === 0) return false;
    return performance.now() - this.lastRecreateTime < graceMs;
  }

  /**
   * Get decoder stats for nerd stats overlay
   */
  getStats(): { decoderType: string; queueSize: number; errorCount: number } {
    return {
      decoderType: this.useSoftware ? "Software (FFmpeg)" : "Hardware (WebCodecs)",
      queueSize: this.queueSize,
      errorCount: this.errorCount,
    };
  }

  // ─── Annex B ↔ MP4 box format conversion utilities ──────────────

  /**
   * Split Annex B byte stream into individual NAL units.
   * Handles both 3-byte (00 00 01) and 4-byte (00 00 00 01) start codes.
   */
  private static splitAnnexBNalUnits(data: Uint8Array): Uint8Array[] {
    const nalUnits: Uint8Array[] = [];
    let i = 0;
    const len = data.length;

    while (i < len) {
      // Find start code
      let startCodeLen = 0;
      if (i + 3 <= len && data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 1) {
        startCodeLen = 3;
      } else if (i + 4 <= len && data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0 && data[i + 3] === 1) {
        startCodeLen = 4;
      } else {
        i++;
        continue;
      }

      const nalStart = i + startCodeLen;

      // Find next start code or end
      let nalEnd = len;
      for (let j = nalStart + 1; j < len - 2; j++) {
        if (data[j] === 0 && data[j + 1] === 0 &&
            (data[j + 2] === 1 || (j + 3 < len && data[j + 2] === 0 && data[j + 3] === 1))) {
          nalEnd = j;
          break;
        }
      }

      if (nalEnd > nalStart) {
        nalUnits.push(data.subarray(nalStart, nalEnd));
      }
      i = nalEnd;
    }

    return nalUnits;
  }

  /**
   * Remove Annex B emulation prevention bytes (00 00 03 → 00 00).
   * Required for parsing NAL unit content (profile_tier_level etc.)
   */
  private static removeEpb(data: Uint8Array): Uint8Array {
    const output: number[] = [];
    let i = 0;
    while (i < data.length) {
      if (i + 2 < data.length && data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 3) {
        output.push(0, 0);
        i += 3; // Skip the 03 prevention byte
      } else {
        output.push(data[i]);
        i++;
      }
    }
    return new Uint8Array(output);
  }

  /**
   * Convert Annex B extradata to hvcC (HEVC Decoder Configuration Record).
   * Extracts VPS, SPS, PPS NAL units and packages them into ISO 14496-15 format.
   * Uses track metadata for reliable profile/tier/level (Annex B NALs have EPB that corrupt offsets).
   */
  static annexBToHvcC(annexB: Uint8Array, track?: { profile?: number; level?: number }): Uint8Array | null {
    const nalUnits = this.splitAnnexBNalUnits(annexB);
    if (nalUnits.length === 0) return null;

    // Classify NAL units by type
    const vpsUnits: Uint8Array[] = [];
    const spsUnits: Uint8Array[] = [];
    const ppsUnits: Uint8Array[] = [];

    for (const nal of nalUnits) {
      if (nal.length < 2) continue;
      const nalType = (nal[0] >> 1) & 0x3f;
      if (nalType === 32) vpsUnits.push(nal);       // VPS
      else if (nalType === 33) spsUnits.push(nal);   // SPS
      else if (nalType === 34) ppsUnits.push(nal);   // PPS
    }

    if (spsUnits.length === 0) {
      Logger.warn(TAG, "No SPS found in Annex B extradata");
      return null;
    }

    // Parse profile_tier_level from VPS or SPS (with EPB removal for correct offsets)
    const ptlNalRaw = vpsUnits[0] || spsUnits[0];
    const ptlNal = this.removeEpb(ptlNalRaw);
    const ptlNalType = (ptlNal[0] >> 1) & 0x3f;
    const ptlOffset = ptlNalType === 32 ? 6 : 3; // VPS: 6, SPS: 3

    let generalProfileIdc = track?.profile ?? 2; // Default Main 10
    let generalTierFlag = 0;
    let profileCompatFlags = new Uint8Array([0x20, 0x00, 0x00, 0x00]);
    let constraintBytes = new Uint8Array(6);
    let generalLevelIdc = track?.level ?? 153; // Default Level 5.1

    if (ptlNal.length >= ptlOffset + 12) {
      const profileByte = ptlNal[ptlOffset];
      generalProfileIdc = profileByte & 0x1f;
      generalTierFlag = (profileByte >> 5) & 1;
      profileCompatFlags = ptlNal.slice(ptlOffset + 1, ptlOffset + 5);
      constraintBytes = ptlNal.slice(ptlOffset + 5, ptlOffset + 11);
      generalLevelIdc = ptlNal[ptlOffset + 11];
      Logger.debug(TAG, `hvcC from NAL: profile=${generalProfileIdc}, tier=${generalTierFlag}, level=${generalLevelIdc}`);
    } else if (track?.profile != null || track?.level != null) {
      Logger.debug(TAG, `hvcC from track metadata: profile=${generalProfileIdc}, level=${generalLevelIdc}`);
    }

    // Build hvcC record
    const arrays: Array<{ type: number; nalus: Uint8Array[] }> = [];
    if (vpsUnits.length > 0) arrays.push({ type: 32, nalus: vpsUnits });
    if (spsUnits.length > 0) arrays.push({ type: 33, nalus: spsUnits });
    if (ppsUnits.length > 0) arrays.push({ type: 34, nalus: ppsUnits });

    // Calculate total size
    let totalSize = 23; // Fixed header size
    for (const arr of arrays) {
      totalSize += 3; // array header
      for (const nalu of arr.nalus) {
        totalSize += 2 + nalu.length;
      }
    }

    const hvcC = new Uint8Array(totalSize);
    const view = new DataView(hvcC.buffer);
    let pos = 0;

    // configurationVersion = 1
    hvcC[pos++] = 1;
    // general_profile_space(2) | general_tier_flag(1) | general_profile_idc(5)
    hvcC[pos++] = (generalTierFlag << 5) | (generalProfileIdc & 0x1f);
    // general_profile_compatibility_flags (32 bits)
    hvcC[pos++] = profileCompatFlags[0];
    hvcC[pos++] = profileCompatFlags[1];
    hvcC[pos++] = profileCompatFlags[2];
    hvcC[pos++] = profileCompatFlags[3];
    // general_constraint_indicator_flags (48 bits)
    for (let i = 0; i < 6; i++) hvcC[pos++] = constraintBytes[i];
    // general_level_idc
    hvcC[pos++] = generalLevelIdc;
    // min_spatial_segmentation_idc = 0 with reserved bits
    view.setUint16(pos, 0xf000);
    pos += 2;
    // parallelismType = 0 with reserved bits
    hvcC[pos++] = 0xfc;
    // chromaFormat = 1 (4:2:0) with reserved bits
    hvcC[pos++] = 0xfd;
    // bitDepthLuma = 10 (minus 8 = 2) with reserved bits
    hvcC[pos++] = 0xfa;
    // bitDepthChroma = 10 (minus 8 = 2) with reserved bits
    hvcC[pos++] = 0xfa;
    // avgFrameRate = 0 (unknown)
    view.setUint16(pos, 0);
    pos += 2;
    // constantFrameRate(2)=0 | numTemporalLayers(3)=1 | temporalIdNested(1)=1 | lengthSizeMinusOne(2)=3
    hvcC[pos++] = 0x0f;
    // numOfArrays
    hvcC[pos++] = arrays.length;

    // NAL unit arrays (store original NAL data with EPBs intact — hvcC stores raw NAL bytes)
    for (const arr of arrays) {
      hvcC[pos++] = 0x80 | (arr.type & 0x3f);
      view.setUint16(pos, arr.nalus.length);
      pos += 2;
      for (const nalu of arr.nalus) {
        view.setUint16(pos, nalu.length);
        pos += 2;
        hvcC.set(nalu, pos);
        pos += nalu.length;
      }
    }

    return hvcC;
  }

  /**
   * Convert Annex B extradata to avcC (AVC Decoder Configuration Record).
   * Extracts SPS and PPS NAL units.
   */
  static annexBToAvcC(annexB: Uint8Array): Uint8Array | null {
    const nalUnits = this.splitAnnexBNalUnits(annexB);
    if (nalUnits.length === 0) return null;

    const spsUnits: Uint8Array[] = [];
    const ppsUnits: Uint8Array[] = [];

    for (const nal of nalUnits) {
      if (nal.length < 1) continue;
      const nalType = nal[0] & 0x1f;
      if (nalType === 7) spsUnits.push(nal);  // SPS
      else if (nalType === 8) ppsUnits.push(nal);  // PPS
    }

    if (spsUnits.length === 0) {
      Logger.warn(TAG, "No SPS found in Annex B extradata for AVC");
      return null;
    }

    const sps = spsUnits[0];
    // avcC header: 6 bytes + SPS entries + PPS entries
    let totalSize = 6;
    totalSize += 1; // numSPS
    for (const s of spsUnits) totalSize += 2 + s.length;
    totalSize += 1; // numPPS
    for (const p of ppsUnits) totalSize += 2 + p.length;

    const avcC = new Uint8Array(totalSize);
    const view = new DataView(avcC.buffer);
    let pos = 0;

    avcC[pos++] = 1; // configurationVersion
    avcC[pos++] = sps[1]; // AVCProfileIndication
    avcC[pos++] = sps[2]; // profile_compatibility
    avcC[pos++] = sps[3]; // AVCLevelIndication
    avcC[pos++] = 0xff;   // lengthSizeMinusOne = 3 (4 bytes), with 6 reserved 1-bits
    avcC[pos++] = 0xe0 | spsUnits.length; // numSPS with 3 reserved 1-bits

    for (const s of spsUnits) {
      view.setUint16(pos, s.length);
      pos += 2;
      avcC.set(s, pos);
      pos += s.length;
    }

    avcC[pos++] = ppsUnits.length;
    for (const p of ppsUnits) {
      view.setUint16(pos, p.length);
      pos += 2;
      avcC.set(p, pos);
      pos += p.length;
    }

    return avcC;
  }

  /**
   * Check if an HEVC NAL unit type should be stripped before feeding to WebCodecs.
   * Dolby Vision RPU (type 62), UNSPEC63 (type 63), and other non-standard
   * NAL types cause hardware decoder errors.
   */
  private static isUnsupportedHevcNalType(nalData: Uint8Array): boolean {
    if (nalData.length < 2) return false;
    const nalType = (nalData[0] >> 1) & 0x3f;
    // HEVC NAL types 62-63 are UNSPEC62/63, used by Dolby Vision for RPU data.
    // NAL types 48-61 are also unspecified but less common.
    // WebCodecs hardware decoders choke on these.
    return nalType >= 62;
  }

  /**
   * Convert Annex B packet data to 4-byte length-prefixed format.
   * Replaces start codes (00 00 01 or 00 00 00 01) with 4-byte NAL unit lengths.
   * Strips Dolby Vision RPU and other unsupported NAL unit types.
   */
  static annexBToLengthPrefixed(data: Uint8Array): Uint8Array {
    const nalUnits = this.splitAnnexBNalUnits(data);
    if (nalUnits.length === 0) return data; // Fallback: return as-is

    // Filter out unsupported NAL types (DoVi RPU etc.) and calculate total size
    const filtered: Uint8Array[] = [];
    let totalSize = 0;
    for (const nal of nalUnits) {
      if (this.isUnsupportedHevcNalType(nal)) continue;
      filtered.push(nal);
      totalSize += 4 + nal.length;
    }

    if (filtered.length === 0) return data;

    const output = new Uint8Array(totalSize);
    const view = new DataView(output.buffer);
    let pos = 0;

    for (const nal of filtered) {
      view.setUint32(pos, nal.length);
      pos += 4;
      output.set(nal, pos);
      pos += nal.length;
    }

    return output;
  }

  // Strip Access Unit Delimiter (HEVC NAL type 35) NALs from a length-prefixed
  // (hvcC, 4-byte big-endian length) packet. Some hardware WebCodecs decoders
  // reject the FIRST keyframe after a flush when it leads with an AUD —
  // observed on 10-bit DoVi/HDR HEVC where the same packet decodes fine at
  // startup but is refused ("wasn't a key frame") right after a seek-flush.
  // Returns the packet unchanged if no AUD is present or the data isn't
  // recognizably length-prefixed.
  static stripAudLengthPrefixed(data: Uint8Array): Uint8Array {
    if (data.length < 5) return data;
    // Bail if it looks like Annex B (start code) — this only handles hvcC.
    if (
      data[0] === 0 &&
      data[1] === 0 &&
      (data[2] === 1 || (data[2] === 0 && data[3] === 1))
    ) {
      return data;
    }
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const kept: Array<{ off: number; len: number }> = [];
    let i = 0;
    let removed = 0;
    while (i + 4 <= data.length) {
      const len = view.getUint32(i);
      const nalOff = i + 4;
      if (len <= 0 || nalOff + len > data.length) {
        // Malformed length — don't risk corrupting the packet, return as-is.
        return data;
      }
      const nalType = (data[nalOff] >> 1) & 0x3f;
      if (nalType === 35) {
        removed++;
      } else {
        kept.push({ off: nalOff, len });
      }
      i = nalOff + len;
    }
    if (removed === 0 || kept.length === 0) return data;

    let total = 0;
    for (const k of kept) total += 4 + k.len;
    const out = new Uint8Array(total);
    const outView = new DataView(out.buffer);
    let pos = 0;
    for (const k of kept) {
      outView.setUint32(pos, k.len);
      pos += 4;
      out.set(data.subarray(k.off, k.off + k.len), pos);
      pos += k.len;
    }
    return out;
  }
}
