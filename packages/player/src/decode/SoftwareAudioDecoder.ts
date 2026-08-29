import { WasmBindings } from "../wasm/bindings";
import { AudioTrack } from "../types";
import { Logger } from "../utils/Logger";

const TAG = "SoftwareAudioDecoder";

/**
 * Browser-agnostic PCM frame. Avoids the WebCodecs AudioData constructor,
 * which Firefox on Android does not implement.
 */
export interface PCMFrame {
  planes: Float32Array[];
  numberOfFrames: number;
  numberOfChannels: number;
  sampleRate: number;
  timestamp: number; // micro-seconds, matches AudioData semantics
}

export class SoftwareAudioDecoder {
  private bindings: WasmBindings;
  private onData: ((frame: PCMFrame) => void) | null = null;
  private onError: ((error: Error) => void) | null = null;
  private isConfigured = false;
  private trackIndex = -1;
  // Default: downmix to stereo. AudioDecoder flips this off via
  // setDownmix(false) when the player has confirmed the output
  // device supports the source's full channel count.
  private _downmix = true;

  // Some files trigger a sendPacket failure on every audio packet —
  // typically a codec-mismatch (e.g. Atmos extensions inside EAC3) or a
  // genuine ENOMEM that won't recover. Without a circuit-breaker we
  // flood the console with hundreds of identical warnings per second
  // and, worse, keep poking the FFmpeg allocator until its shared heap
  // corrupts the demuxer. After this many consecutive failures we mute
  // the decoder for the rest of the session; video continues, audio
  // goes silent — a strictly better failure mode than a hard crash.
  private consecutiveFailures = 0;
  private isBroken = false;
  private static readonly MAX_CONSECUTIVE_FAILURES = 50;

  // TrueHD/MLP and DTS decode to tiny frames — one access unit per packet, e.g.
  // 40 samples (~0.83ms) at 48kHz — ~1200 per second. The AudioRenderer
  // schedules one AudioBufferSourceNode per frame, and at that granularity
  // (especially when the AudioContext sample rate differs from the source, so
  // every buffer is resampled in isolation) the buffer boundaries click —
  // audible "pit-pit". AC-3/E-AC-3 avoid it with ~1536-sample (~32ms) frames.
  // Coalesce consecutive small frames into ~30ms buffers so every software
  // codec reaches the renderer at AC-3-like granularity. Dropped on flush/seek
  // (stale post-seek), so at most ~30ms is lost at a seek/EOF.
  private coalesceTarget = 0; // samples; derived from the frame sample rate
  private pending: PCMFrame[] = [];
  private pendingSamples = 0;

  constructor(bindings: WasmBindings) {
    this.bindings = bindings;
  }

  setDownmix(downmix: boolean): void {
    this._downmix = downmix;
    if (this.isConfigured) {
      this.bindings.enableAudioDownmix(downmix);
    }
  }

  setOnData(callback: (frame: PCMFrame) => void): void {
    this.onData = callback;
  }

  setOnError(callback: (error: Error) => void): void {
    this.onError = callback;
  }

  async configure(track: AudioTrack): Promise<boolean> {
    this.trackIndex = track.id;

    // Enable decoder in WASM
    const ret = this.bindings.enableDecoder(this.trackIndex);
    if (ret < 0) {
      Logger.error(
        TAG,
        `Failed to enable software decoder for stream ${this.trackIndex}: ${ret}`,
      );
      return false;
    }

    // Enable stereo downmixing by default — most users have stereo
    // output and FFmpeg's downmix is higher quality than Web Audio's
    // automatic one. setDownmix() below flips it off when the player
    // detects the device can actually drive >2 discrete channels.
    this.bindings.enableAudioDownmix(this._downmix);

    this.isConfigured = true;
    Logger.info(
      TAG,
      `Configured software decoder for stream ${this.trackIndex}`,
    );
    return true;
  }

  async flush(): Promise<void> {
    // Reset the WASM decoder (avcodec_flush_buffers) so it restarts cleanly on
    // the next major-sync after a seek/replay. Without this, TrueHD/DTS carry
    // stale state across the seek and reject every packet (sendPacket →
    // AVERROR_INVALIDDATA) until the next major-sync arrives — an audible buzz
    // on replay and after every seek. Also clear the failure circuit-breaker so
    // a fresh run isn't muted by pre-seek failures.
    if (this.isConfigured) {
      this.bindings.flushDecoder(this.trackIndex);
    }
    this.consecutiveFailures = 0;
    this.isBroken = false;
    this.pending = [];
    this.pendingSamples = 0;
  }

  reset(): void {
    this.consecutiveFailures = 0;
    this.pending = [];
    this.pendingSamples = 0;
  }

  close(): void {
    this.isConfigured = false;
    this.pending = [];
    this.pendingSamples = 0;
  }

  decode(data: Uint8Array, timestamp: number, keyframe: boolean): void {
    if (!this.isConfigured || this.isBroken) return;

    const ret = this.bindings.sendPacket(
      this.trackIndex,
      data,
      timestamp,
      timestamp,
      keyframe,
    );

    if (ret < 0) {
      this.consecutiveFailures++;
      if (this.consecutiveFailures === 1) {
        Logger.warn(TAG, `sendPacket failed: ${ret}`);
      }
      if (
        this.consecutiveFailures >=
        SoftwareAudioDecoder.MAX_CONSECUTIVE_FAILURES
      ) {
        this.isBroken = true;
        Logger.error(
          TAG,
          `Audio decoder disabled after ${this.consecutiveFailures} consecutive sendPacket failures (last: ${ret}). Playback continues without audio.`,
        );
      }
      return;
    }

    this.consecutiveFailures = 0;

    // Receive loop
    while (true) {
      const ret = this.bindings.receiveFrame(this.trackIndex);
      if (ret !== 0) break;

      this.processDecodedFrame(timestamp);
    }
  }

  private processDecodedFrame(timestamp: number) {
    if (!this.onData) return;

    const numberOfFrames = this.bindings.getFrameSamples();
    const numberOfChannels = this.bindings.getFrameChannels();
    const sampleRate = this.bindings.getFrameSampleRate();

    // FFmpeg outputs planar float (AV_SAMPLE_FMT_FLTP) for most decoders.
    // We copy each plane out of the WASM heap into its own Float32Array so the
    // heap can be reused for the next frame.
    try {
      const heap = (this.bindings as any).module.HEAPU8 as Uint8Array;
      const planes: Float32Array[] = new Array(numberOfChannels);
      for (let i = 0; i < numberOfChannels; i++) {
        const ptr = this.bindings.getFrameDataPointer(i);
        const view = new Float32Array(heap.buffer, ptr, numberOfFrames);
        planes[i] = new Float32Array(view); // copy out of heap
      }

      const frame: PCMFrame = {
        planes,
        numberOfFrames,
        numberOfChannels,
        sampleRate,
        timestamp: timestamp * 1_000_000, // micro-seconds
      };

      if (Math.random() < 0.01) {
        Logger.debug(
          TAG,
          `Audio data: ${numberOfChannels}ch, ${numberOfFrames} frames`,
        );
      }

      this.enqueueFrame(frame);
    } catch (e) {
      Logger.error(TAG, "PCM frame extraction failed", e);
      if (this.onError) this.onError(e as Error);
    }
  }

  /**
   * Coalesce tiny decoded frames (TrueHD/DTS emit ~40 samples each) into ~30ms
   * buffers before handing them to the renderer, so its per-frame scheduler
   * doesn't click on every boundary. Frames already at/above the target (AC-3,
   * E-AC-3, AAC in software) pass straight through with no added latency.
   */
  private enqueueFrame(frame: PCMFrame): void {
    if (this.coalesceTarget === 0) {
      this.coalesceTarget = Math.max(1024, Math.round(frame.sampleRate * 0.03));
    }

    // Big enough on its own — flush anything buffered, then emit as-is.
    if (
      frame.numberOfFrames >= this.coalesceTarget &&
      this.pendingSamples === 0
    ) {
      if (this.onData) this.onData(frame);
      return;
    }

    // A channel-count / sample-rate change can't be merged into the current
    // run — emit what we have first so the two formats stay separate.
    const head = this.pending[0];
    if (
      head &&
      (head.numberOfChannels !== frame.numberOfChannels ||
        head.sampleRate !== frame.sampleRate)
    ) {
      this.flushPending();
    }

    this.pending.push(frame);
    this.pendingSamples += frame.numberOfFrames;
    if (this.pendingSamples >= this.coalesceTarget) this.flushPending();
  }

  private flushPending(): void {
    if (this.pending.length === 0) return;
    const merged =
      this.pending.length === 1 ? this.pending[0] : this.mergePending();
    this.pending = [];
    this.pendingSamples = 0;
    if (this.onData) this.onData(merged);
  }

  private mergePending(): PCMFrame {
    const first = this.pending[0];
    const channels = first.numberOfChannels;
    const total = this.pendingSamples;
    const planes: Float32Array[] = new Array(channels);
    for (let c = 0; c < channels; c++) {
      const out = new Float32Array(total);
      let offset = 0;
      for (const f of this.pending) {
        out.set(f.planes[c], offset);
        offset += f.numberOfFrames;
      }
      planes[c] = out;
    }
    return {
      planes,
      numberOfFrames: total,
      numberOfChannels: channels,
      sampleRate: first.sampleRate,
      timestamp: first.timestamp, // start of the first accumulated frame
    };
  }

  get configured(): boolean {
    return this.isConfigured;
  }
}
