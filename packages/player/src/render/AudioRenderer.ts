/**
 * AudioRenderer - Web Audio API based audio playback with precise clock synchronization
 * Uses AudioContext as the master clock for A/V sync (60Hz smooth playback)
 */

import { Logger } from "../utils/Logger";
import {
  createSignalsmithStretcher,
  loadSignalsmith,
  type SignalsmithStretcher,
} from "../utils/signalsmith";
import type { PCMFrame } from "../decode/SoftwareAudioDecoder";

const TAG = "AudioRenderer";

export class AudioRenderer {
  private audioContext: AudioContext | null = null;
  // Fixed fan-in bus: every decoded source connects here. Keeping the input
  // separate from the volume node lets us reorder the compressor/gain chain
  // (stable-audio toggle) without re-touching the live sources.
  private inputNode: GainNode | null = null;
  private gainNode: GainNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private scheduledTime: number = 0;
  private isPlaying: boolean = false;
  private volume: number = 1.0;
  private _playbackRate: number = 1.0;
  private activeSources: AudioBufferSourceNode[] = [];
  private _muted: boolean = false;

  // Audio clock tracking for A/V sync
  private firstBufferScheduledAt: number = 0;
  private firstBufferMediaTime: number = 0;
  private hasFirstBuffer: boolean = false;
  private currentMediaTime: number = 0;
  private maxScheduledMediaTime: number = 0; // Track the furthest media time we've scheduled

  // Buffer health monitoring
  private lastDecodeTime: number = 0;
  private scheduledCount: number = 0;

  // Playback rate change rebuffering flag
  private isRebufferingForRateChange: boolean = false;

  // Pitch preservation via Signalsmith Stretch (MIT), compiled into the same
  // movi WASM module as FFmpeg/dav1d. Loads asynchronously on first need;
  // until then we fall back to scaling source.playbackRate (which shifts
  // pitch but keeps audio playing).
  private preservePitch: boolean = true;
  private signalsmith: SignalsmithStretcher | null = null;
  private signalsmithLoading: boolean = false;
  private signalsmithSampleRate: number = 0;

  // Stable audio: master toggle (off by default, opt-in via element attribute)
  private _stableAudio: boolean = false;

  // Audio output device (AudioContext.setSinkId). "" = system default.
  // Remembered here so it survives AudioContext re-creation (init runs again
  // on source change / device loss); re-applied at the end of init().
  private _sinkId: string = "";

  // Stable audio: gain ramp duration for smooth transitions (prevents clicks/pops)
  private static readonly GAIN_RAMP_TIME = 0.015; // 15ms ramp
  private static readonly FADE_OUT_TIME = 0.03; // 30ms fade-out before seek/reset

  // Stable audio: AudioContext state monitoring & auto-recovery
  private contextStateHandler: (() => void) | null = null;
  private recoveryAttempts: number = 0;
  private static readonly MAX_RECOVERY_ATTEMPTS = 3;

  // Stable audio: starvation detection
  private starvationStartTime: number = 0;
  private isStarved: boolean = false;
  private static readonly STARVATION_THRESHOLD = 2000; // ms without new audio data before considered starved

  // Bluetooth keepalive: silent <audio> element played during pause to hold the
  // OS audio session so A2DP devices don't drop and re-pair. AudioContext.suspend()
  // alone releases the output route on iOS/Android; an HTMLMediaElement keeps
  // the session claimed without affecting our scheduled buffers.
  private keepaliveEl: HTMLAudioElement | null = null;
  private keepaliveUrl: string | null = null;

  constructor() {
    Logger.debug(TAG, "Created");
  }

  /**
   * Lazily create a near-silent looping <audio> element used to keep the
   * OS audio session alive while AudioContext is suspended. Uses a tiny
   * generated WAV blob so resume from pause stays seamless and Bluetooth
   * speakers/headphones don't drop the connection.
   */
  private ensureKeepalive(): HTMLAudioElement | null {
    if (this.keepaliveEl) return this.keepaliveEl;
    try {
      // 5s of 8kHz mono 8-bit silence (~40KB including 44-byte WAV header).
      // Duration matters: Chrome grants FULL audio focus — the state that
      // actually surfaces the OS media session (macOS Now Playing, Windows
      // SMTC, Linux MPRIS) — only for media ≥5s. A shorter anchor gets merely
      // transient focus, so the OS controls may never appear even though the
      // navigator.mediaSession metadata/handlers are all set correctly.
      const sampleRate = 8000;
      const numSamples = sampleRate * 5;
      const buf = new ArrayBuffer(44 + numSamples);
      const view = new DataView(buf);
      const writeStr = (off: number, s: string) => {
        for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
      };
      writeStr(0, "RIFF");
      view.setUint32(4, 36 + numSamples, true);
      writeStr(8, "WAVE");
      writeStr(12, "fmt ");
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);          // PCM
      view.setUint16(22, 1, true);          // mono
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate, true); // byte rate (8-bit mono)
      view.setUint16(32, 1, true);          // block align
      view.setUint16(34, 8, true);          // bits per sample
      writeStr(36, "data");
      view.setUint32(40, numSamples, true);
      // 8-bit unsigned PCM silence is 0x80
      const samples = new Uint8Array(buf, 44, numSamples);
      samples.fill(0x80);

      const blob = new Blob([buf], { type: "audio/wav" });
      this.keepaliveUrl = URL.createObjectURL(blob);
      const el = new Audio();
      el.src = this.keepaliveUrl;
      el.loop = true;
      el.preload = "auto";
      el.volume = 0.0001; // inaudible but enough to hold the audio session
      this.keepaliveEl = el;
    } catch (err) {
      Logger.warn(TAG, "Failed to create BT keepalive element", err);
      return null;
    }
    return this.keepaliveEl;
  }

  private startKeepalive(): void {
    const el = this.ensureKeepalive();
    if (!el) return;
    el.play().catch(() => {
      // Autoplay policies may block this without a user gesture; harmless —
      // the user already interacted to start playback before they paused.
    });
  }

  private stopKeepalive(): void {
    if (this.keepaliveEl) {
      try {
        this.keepaliveEl.pause();
        this.keepaliveEl.currentTime = 0;
      } catch {
        /* noop */
      }
    }
  }

  /**
   * Initialize audio context
   */
  async init(): Promise<boolean> {
    try {
      this.audioContext = new AudioContext({
        // "interactive" gives Chromium's audio thread a shorter read-ahead
        // (~30–50ms vs ~150ms with "playback"). Without this, Chromium starves
        // when setPlaybackRate stops active sources and resets scheduledTime
        // to `now` — Safari/Firefox tolerate it because their read-ahead is
        // already short. Trade-off is a smaller output buffer cushion against
        // main-thread spikes; the audio decoder + Stable Audio gap-fill
        // already handle that case.
        latencyHint: "interactive",
      });
      this.inputNode = this.audioContext.createGain();
      // Volume / mute / makeup gain — ALWAYS the last node before destination.
      // A >100% boost lives here, applied AFTER the limiter, so stable audio's
      // compressor can't cancel it (a gain *before* the limiter would be
      // crushed straight back down — ~+6dB becomes ~+0.6dB).
      this.gainNode = this.audioContext.createGain();

      // Create compressor for stable audio (loudness normalization).
      // Tuned as a peak-limiter, not a heavy compressor: a wide soft knee
      // + low ratio (the WebAudio default-ish) flattens the whole signal
      // and the average RMS rises — perceptually that makes loud passages
      // feel *louder*, not stabler. Instead we let dialogue / mid-level
      // content pass untouched and clamp only true peaks.
      this.compressorNode = this.audioContext.createDynamicsCompressor();
      this.compressorNode.threshold.value = -18;  // only peaks > -18dB engage
      this.compressorNode.knee.value = 6;         // sharp transition, no mid-range squash
      this.compressorNode.ratio.value = 20;       // near-limiter on peaks
      this.compressorNode.attack.value = 0.001;   // 1ms — catch transients before they hit the ear
      this.compressorNode.release.value = 0.15;   // 150ms — quick recovery, no pumping

      this.wireGraph();

      // Apply muted state if set before initialization
      this.gainNode.gain.value = this._muted ? 0 : this.perceptualGain(this.volume);

      // Re-apply the chosen output device to the freshly-created context.
      // Non-blocking: a stale/removed deviceId just falls back to default.
      if (this._sinkId) {
        this.applySinkId(this._sinkId).catch(() => {});
      }

      // Don't resume here — play() handles resume when user clicks play.
      // Pre-init creates AudioContext during load for fast startup;
      // resuming here would cause poster-seek audio to leak.

      // Stable audio: monitor AudioContext state for auto-recovery
      if (this._stableAudio) {
        this.setupContextStateMonitoring();
      }

      Logger.info(
        TAG,
        `Initialized: sampleRate=${this.audioContext.sampleRate}, muted=${this._muted}, state=${this.audioContext.state}`,
      );

      // Warm the Signalsmith WASM module so the first rate change isn't
      // gated on a fetch. The stretcher instance is constructed lazily on
      // the first audio chunk so we use the decoded sample rate (not
      // AudioContext's, which often differs for Opus).
      loadSignalsmith();
      return true;
    } catch (error) {
      Logger.error(TAG, "Failed to initialize", error);
      return false;
    }
  }

  /**
   * Route audio to a specific output device via AudioContext.setSinkId
   * (Chromium 110+). `deviceId` "" → the system default. Stored so it
   * survives the AudioContext re-creation in init(). Returns false when
   * unsupported or the device can't be selected (e.g. unplugged).
   */
  async setSinkId(deviceId: string): Promise<boolean> {
    this._sinkId = deviceId || "";
    return this.applySinkId(this._sinkId);
  }

  /** Current output device id ("" = system default). */
  getSinkId(): string {
    const live = (this.audioContext as unknown as { sinkId?: string } | null)
      ?.sinkId;
    return typeof live === "string" ? live : this._sinkId;
  }

  /** True when the running engine can route output to a chosen device. */
  static isSinkSelectionSupported(): boolean {
    return (
      typeof AudioContext !== "undefined" &&
      typeof (AudioContext.prototype as unknown as { setSinkId?: unknown })
        .setSinkId === "function"
    );
  }

  private async applySinkId(deviceId: string): Promise<boolean> {
    const ctx = this.audioContext as unknown as {
      setSinkId?: (id: string) => Promise<void>;
    } | null;
    if (!ctx || typeof ctx.setSinkId !== "function") return false;
    try {
      await ctx.setSinkId(deviceId || "");
      Logger.info(TAG, `Output device set: ${deviceId || "(default)"}`);
      return true;
    } catch (e) {
      Logger.warn(TAG, `setSinkId failed for "${deviceId}"`, e);
      return false;
    }
  }

  /**
   * Configure audio format (logs only, format is taken from AudioData)
   */
  configure(sampleRate: number, channels: number): void {
    Logger.info(TAG, `Configured: ${sampleRate}Hz, ${channels}ch`);
  }

  /**
   * Maximum number of output channels the user's audio device + browser
   * combination supports. 2 (stereo) for typical laptop/phone setups,
   * 6 for a 5.1 receiver, 8 for 7.1. Returns 2 when the AudioContext
   * hasn't been created yet.
   */
  getMaxChannelCount(): number {
    return this.audioContext?.destination.maxChannelCount ?? 2;
  }

  /**
   * Ask the AudioContext destination to accept `n` discrete channels
   * instead of Web Audio's default 2. `channelCountMode: "explicit"` +
   * `channelInterpretation: "discrete"` together suppress the
   * automatic speaker-layout downmix the API would otherwise apply,
   * so a 7.1 AudioBuffer reaches the device with all 8 planes intact.
   * Caller is responsible for ensuring the OS / hardware actually has
   * that many output channels — read getMaxChannelCount() first and
   * clamp accordingly.
   */
  setOutputChannelCount(n: number): void {
    if (!this.audioContext) return;
    const dest = this.audioContext.destination;
    const clamped = Math.min(Math.max(1, Math.floor(n)), dest.maxChannelCount);
    try {
      dest.channelCount = clamped;
      dest.channelCountMode = "explicit";
      dest.channelInterpretation = "discrete";
      // GainNode defaults to channelCountMode:"max", which already
      // promotes its output to match the input — so multichannel
      // audio flows through it untouched even with channelCount=2.
      // Setting it here is a defensive no-op; documenting the
      // intent for readers chasing the same channel question. The
      // compressor (when stable audio is on) uses "clamped-max"
      // which DOES respect channelCount, so we promote it
      // explicitly — otherwise a 5.1 source would lose its
      // surround when piped through stable-audio compression.
      if (this.inputNode) {
        this.inputNode.channelCount = clamped;
      }
      if (this.gainNode) {
        this.gainNode.channelCount = clamped;
      }
      if (this.compressorNode) {
        this.compressorNode.channelCount = clamped;
      }
      Logger.info(TAG, `Destination channelCount → ${clamped} (max ${dest.maxChannelCount})`);
    } catch (e) {
      Logger.warn(TAG, "Failed to set destination channelCount", e);
    }
  }

  /**
   * Render AudioData with precise timing
   */
  render(audioData: AudioData): void {
    if (!this.audioContext || !this.gainNode) {
      audioData.close();
      return;
    }

    if (!this.isPlaying) {
      audioData.close();
      return;
    }

    // If muted and context is suspended (autoplay muted), just drop the audio
    // Audio will start playing once user unmutes (which resumes the context)
    if (this._muted && this.audioContext.state === "suspended") {
      audioData.close();
      return;
    }

    try {
      const numberOfFrames = audioData.numberOfFrames;
      const numberOfChannels = audioData.numberOfChannels;
      const sampleRate = audioData.sampleRate;
      const audioTime = audioData.timestamp / 1_000_000; // Convert to seconds

      const audioBuffer = this.audioContext.createBuffer(
        numberOfChannels,
        numberOfFrames,
        sampleRate,
      );

      for (let channel = 0; channel < numberOfChannels; channel++) {
        const channelData = new Float32Array(numberOfFrames);
        audioData.copyTo(channelData, {
          planeIndex: channel,
          format: "f32-planar",
        });
        audioBuffer.copyToChannel(channelData, channel);
      }

      this.scheduleAudioBuffer(audioBuffer, audioTime);
    } catch (error) {
      Logger.error(TAG, "Render error", error);
    } finally {
      audioData.close();
    }
  }

  /**
   * Render a raw PCM frame (browser-agnostic path used by the software
   * decoder). Avoids constructing a WebCodecs AudioData, which Firefox on
   * Android does not implement.
   */
  renderPCM(frame: PCMFrame): void {
    if (!this.audioContext || !this.gainNode) return;
    if (!this.isPlaying) return;
    if (this._muted && this.audioContext.state === "suspended") return;

    try {
      const audioTime = frame.timestamp / 1_000_000;
      const audioBuffer = this.audioContext.createBuffer(
        frame.numberOfChannels,
        frame.numberOfFrames,
        frame.sampleRate,
      );

      for (let channel = 0; channel < frame.numberOfChannels; channel++) {
        audioBuffer.copyToChannel(
          frame.planes[channel] as Float32Array<ArrayBuffer>,
          channel,
        );
      }

      this.scheduleAudioBuffer(audioBuffer, audioTime);
    } catch (error) {
      Logger.error(TAG, "RenderPCM error", error);
    }
  }

  /**
   * Schedule a populated AudioBuffer through the stretcher + A/V sync
   * pipeline. Shared by render() and renderPCM().
   */
  private scheduleAudioBuffer(audioBuffer: AudioBuffer, audioTime: number): void {
    if (!this.audioContext || !this.gainNode) return;

    // Track when we receive decoded audio
    this.lastDecodeTime = performance.now();

    // Stable audio: recover from starvation state
    if (this._stableAudio && this.isStarved) {
      this.isStarved = false;
      this.starvationStartTime = 0;
      Logger.debug(TAG, "Recovered from audio starvation");
    }

    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;

    // Clear rebuffering flag as soon as audio data arrives (decoder is producing).
    // Don't wait for successful scheduling — the stretcher may swallow a few
    // buffers while warming up, but the flag should clear immediately.
    if (this.isRebufferingForRateChange) {
      this.isRebufferingForRateChange = false;
      Logger.debug(TAG, "Rebuffering complete after playback rate change");
    }

    // Apply pitch preservation via Signalsmith if enabled and playback rate
    // is not 1.0. If the stretcher isn't ready yet (WASM still loading) we
    // schedule expected-duration silence instead of falling back to scaling
    // source.playbackRate — that fallback shifts pitch (chipmunk audio) for
    // the ~1s of startup before the WASM stretcher kicks in. A brief silent
    // gap at the start is preferable to an audible pitch-shifted blip.
    let processedBuffer = audioBuffer;
    let usedStretcher = false;
    if (this.preservePitch && Math.abs(this._playbackRate - 1.0) > 0.01) {
      const stOutput = this.processStretch(audioBuffer, this._playbackRate);
      if (stOutput && stOutput.length > 1) {
        processedBuffer = stOutput;
        usedStretcher = true;
      } else {
        // Stretcher ready-but-warming OR not loaded yet — schedule
        // expected-duration silence so timing stays correct. Brief gap,
        // no pitch shift (no chipmunk).
        const expectedDuration = audioBuffer.duration / this._playbackRate;
        const silenceFrames = Math.max(1, Math.ceil(expectedDuration * sampleRate));
        processedBuffer = this.audioContext.createBuffer(numberOfChannels, silenceFrames, sampleRate);
        usedStretcher = true;
      }
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = processedBuffer;
    source.connect(this.inputNode ?? this.gainNode);
    source.playbackRate.value = usedStretcher ? 1.0 : this._playbackRate;

    const now = this.audioContext.currentTime;
    const minTime = now + 0.005; // Small buffer to prevent glitches

    // Detect buffer underrun
    if (this.scheduledTime < now) {
      // Stable audio: fill the gap with a short silence buffer to prevent pops
      if (this._stableAudio && this.hasFirstBuffer && this.audioContext) {
        const gapDuration = now - this.scheduledTime;
        if (gapDuration > 0.005 && gapDuration < 1.0) {
          try {
            const silenceFrames = Math.ceil(gapDuration * sampleRate);
            const silenceBuffer = this.audioContext.createBuffer(
              numberOfChannels, silenceFrames, sampleRate
            );
            const silenceSource = this.audioContext.createBufferSource();
            silenceSource.buffer = silenceBuffer;
            silenceSource.connect(this.inputNode ?? this.gainNode);
            silenceSource.start(this.scheduledTime);
            silenceSource.onended = () => {
              try { silenceSource.disconnect(); } catch { /* ignore */ }
            };
            Logger.debug(TAG, `Gap filled: ${(gapDuration * 1000).toFixed(1)}ms silence`);
          } catch {
            // Ignore gap fill errors
          }
        }
      }

      this.scheduledTime = minTime;

      if (this.hasFirstBuffer) {
        // Pivot global clock if we underrun (resync)
        this.firstBufferScheduledAt = minTime;
        this.firstBufferMediaTime = audioTime;
      }
    }

    // Calculate expected playback time based on timestamp
    let targetScheduleTime = this.scheduledTime;

    if (this.hasFirstBuffer) {
      const expectedTime =
        this.firstBufferScheduledAt +
        (audioTime - this.firstBufferMediaTime) / this._playbackRate;

      const drift = expectedTime - this.scheduledTime;
      // Tighter drift tolerance (20ms) for better sync
      if (Math.abs(drift) > 0.02) {
        targetScheduleTime = expectedTime;
      }
    }

    const when = Math.max(targetScheduleTime, minTime);
    source.start(when);

    if (!this.hasFirstBuffer) {
      this.firstBufferScheduledAt = when;
      this.firstBufferMediaTime = audioTime;
      this.hasFirstBuffer = true;
      Logger.debug(
        TAG,
        `First buffer scheduled at ${when.toFixed(3)}s, mediaTime=${audioTime.toFixed(3)}s`,
      );
    }

    this.activeSources.push(source);
    this.scheduledTime = when + (usedStretcher
      ? processedBuffer.duration
      : audioBuffer.duration / this._playbackRate);
    this.currentMediaTime = audioTime;
    this.scheduledCount++;

    const endMediaTime = audioTime + audioBuffer.duration;
    if (endMediaTime > this.maxScheduledMediaTime) {
      this.maxScheduledMediaTime = endMediaTime;
    }

    source.onended = () => {
      const idx = this.activeSources.indexOf(source);
      if (idx !== -1) {
        this.activeSources.splice(idx, 1);
      }
      try {
        source.disconnect();
      } catch {
        // Ignore
      }
    };
  }

  /**
   * Render raw PCM samples
   */
  renderSamples(samples: Float32Array[], sampleRate: number): void {
    if (!this.audioContext || !this.gainNode) return;
    if (!this.isPlaying) return;

    try {
      const numberOfChannels = samples.length;
      const numberOfFrames = samples[0].length;

      const audioBuffer = this.audioContext.createBuffer(
        numberOfChannels,
        numberOfFrames,
        sampleRate,
      );

      for (let channel = 0; channel < numberOfChannels; channel++) {
        audioBuffer.copyToChannel(
          samples[channel] as Float32Array<ArrayBuffer>,
          channel,
        );
      }

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.inputNode ?? this.gainNode);
      source.playbackRate.value = this._playbackRate;

      const currentTime = this.audioContext.currentTime;
      const startTime = Math.max(currentTime, this.scheduledTime);

      source.start(startTime);
      this.scheduledTime =
        startTime + audioBuffer.duration / this._playbackRate;
    } catch (error) {
      Logger.error(TAG, "Render samples error", error);
    }
  }

  /**
   * Start playback
   */
  async play(): Promise<void> {
    // Flip isPlaying up front, BEFORE any await. The resume branch in the
    // player's notifySeekCompletion calls play() fire-and-forget and then
    // immediately decodes the first post-seek audio packets. If we only set
    // isPlaying after awaiting audioContext.resume() (which on replay can take
    // tens of ms while the context wakes from suspended), every frame decoded
    // during that window — the 0s frame and the next ~1s of audio — hits
    // render()'s `!isPlaying` guard and gets dropped. The first surviving
    // frame is then ~1s in, so replay starts playing ahead of 0. Setting the
    // flag synchronously here lets those early frames schedule; they sit in
    // the AudioContext queue and play once it resumes.
    this.isPlaying = true;
    this.intentionalSuspend = false;

    // Don't initialize AudioContext during muted autoplay (browser policy)
    // It will be initialized when user unmutes (user gesture)
    if (!this.audioContext && !this._muted) {
      await this.init();
    }

    // Eager stretcher warmup when starting playback already at a non-1x rate
    // (saved preference, or rate set while paused). Kicks WASM construction
    // off now so it's ready before the first decoded chunk needs stretching,
    // avoiding the opening silence gap the chunk-time lazy init would leave.
    if (
      this.preservePitch &&
      this.audioContext &&
      !this.signalsmith &&
      Math.abs(this._playbackRate - 1.0) > 0.01
    ) {
      this.maybeInitSignalsmith(this.audioContext.sampleRate);
    }

    // Resume the AudioContext when either (a) we're not muted so audio
    // can actually play, OR (b) we suspended it ourselves via pause()
    // and need to wake it back up. The original `!_muted` gate was a
    // browser-autoplay-policy safety net for the very first play before
    // any user gesture had unlocked audio — but a resume-after-pause
    // has already crossed that gate (pause() only suspends a running
    // context, which only reached running via a prior gesture). Without
    // the second branch, a muted pause→play leaves the context stuck
    // suspended, audio time stops advancing, and the canvas renderer's
    // audio-synced presentation loop wedges on its last frame even
    // though the Clock keeps ticking via fallback time.
    if (
      this.audioContext?.state === "suspended" &&
      (!this._muted || this.intentionalSuspend)
    ) {
      try {
        await this.audioContext.resume();
      } catch (err) {
        Logger.warn(
          TAG,
          "Failed to resume AudioContext (user gesture may be required)",
          err,
        );
      }
    }

    // Play the silent anchor <audio> for the duration of playback. WebCodecs +
    // Web Audio never request Android Audio Focus on their own, so without a
    // real playing media element the OS Media Session notification never
    // appears / can't be controlled. This element is the anchor; it is PAUSED
    // again in pause() so the notification's play/pause state mirrors the real
    // player (Chrome derives that state from the element, not from
    // navigator.mediaSession.playbackState, on many platforms).
    this.startKeepalive();

    // Warmup context (Safari fix) - only if not muted
    if (!this._muted && this.audioContext) {
      this.warmupContext();
    }

    // Reset last decode time to prevent false unhealthy buffer detection after long pause
    this.lastDecodeTime = performance.now();

    // isPlaying / intentionalSuspend already set synchronously at the top of
    // play() so no decoded frames are dropped during the async resume window.

    // NOTE: We do NOT reset scheduledTime or sync anchors here.
    // If we are resuming from pause (suspend), the buffer is preserved
    // and we want to continue exactly where we left off.
    // If this is a fresh start or seek, reset() would have been called previously.

    Logger.debug(
      TAG,
      `Playing (muted: ${this._muted}, audioContext: ${this.audioContext ? "initialized" : "deferred"}, state: ${this.audioContext?.state || "N/A"})`,
    );
  }

  /**
   * Kick off Signalsmith stretcher construction. Single-flight; idempotent.
   * The movi WASM module is shared with FFmpeg, so this is fast once the
   * player has loaded — just an instance allocation.
   */
  private maybeInitSignalsmith(sampleRate: number): void {
    if (this.signalsmith || this.signalsmithLoading) return;
    this.signalsmithLoading = true;
    this.signalsmithSampleRate = sampleRate;
    createSignalsmithStretcher(sampleRate, 2)
      .then((s) => {
        this.signalsmithLoading = false;
        if (!s) return;
        s.tempo = this._playbackRate;
        s.pitch = 1.0;
        this.signalsmith = s;
        Logger.info(TAG, `Signalsmith ready @ ${sampleRate}Hz`);
      })
      .catch((err) => {
        this.signalsmithLoading = false;
        Logger.warn(TAG, "Signalsmith init failed", err);
      });
  }

  /**
   * Pitch-preserving time stretch through Signalsmith. Returns the stretched
   * AudioBuffer, or null if the stretcher isn't ready yet (caller falls back
   * to source.playbackRate scaling, which shifts pitch but keeps audio playing).
   */
  private processStretch(
    inputBuffer: AudioBuffer,
    playbackRate: number,
  ): AudioBuffer | null {
    if (!this.audioContext) return null;

    const numChannels = inputBuffer.numberOfChannels;
    const sampleRate = inputBuffer.sampleRate;
    const inputFrames = inputBuffer.length;

    // Drop + rebuild the stretcher if the decoded sample rate changed —
    // Signalsmith is fixed-rate per instance.
    if (this.signalsmith && this.signalsmithSampleRate !== sampleRate) {
      this.signalsmith.destroy();
      this.signalsmith = null;
    }
    this.maybeInitSignalsmith(sampleRate);

    if (!this.signalsmith) return null; // still loading — caller falls back

    const stretcher = this.signalsmith;
    stretcher.tempo = this._playbackRate;
    stretcher.pitch = 1.0;

    // Convert planar AudioBuffer → interleaved stereo for the WASM API.
    const interleavedInput = new Float32Array(inputFrames * 2);
    const leftChannel = inputBuffer.getChannelData(0);
    const rightChannel = numChannels > 1 ? inputBuffer.getChannelData(1) : leftChannel;
    for (let i = 0; i < inputFrames; i++) {
      interleavedInput[i * 2] = leftChannel[i];
      interleavedInput[i * 2 + 1] = rightChannel[i];
    }

    stretcher.inputBuffer.putSamples(interleavedInput, 0, inputFrames);
    stretcher.process();

    const expectedFrames = Math.ceil(inputFrames / playbackRate);
    const availableFrames = stretcher.outputBuffer.frameCount;
    const framesToExtract = Math.min(expectedFrames, availableFrames);

    if (framesToExtract === 0) {
      // Stretcher is still warming up — caller should skip scheduling.
      return null;
    }

    const interleavedOutput = new Float32Array(framesToExtract * 2);
    stretcher.outputBuffer.receiveSamples(interleavedOutput, framesToExtract);

    const outputBuffer = this.audioContext.createBuffer(
      numChannels,
      framesToExtract,
      sampleRate,
    );
    const outputLeft = outputBuffer.getChannelData(0);
    const outputRight = numChannels > 1 ? outputBuffer.getChannelData(1) : null;
    for (let i = 0; i < framesToExtract; i++) {
      outputLeft[i] = interleavedOutput[i * 2];
      if (outputRight) outputRight[i] = interleavedOutput[i * 2 + 1];
    }

    return outputBuffer;
  }

  /**
   * Warmup AudioContext (Safari fix)
   */
  private warmupContext(): void {
    if (!this.audioContext) return;
    try {
      const emptyBuffer = this.audioContext.createBuffer(1, 1, 22050);
      const source = this.audioContext.createBufferSource();
      source.buffer = emptyBuffer;
      source.connect(this.audioContext.destination);
      source.start();
    } catch {
      // Ignore
    }
  }

  /**
   * Pause playback
   */
  // Flag to prevent auto-recovery when we intentionally suspend during buffering
  private intentionalSuspend: boolean = false;

  pause(): void {
    this.isPlaying = false;

    // Pause the silent media-session anchor <audio> so the OS notification's
    // play/pause state mirrors the real player. On many platforms Chrome drives
    // the lock-screen state from the media element's own play/paused state, NOT
    // from navigator.mediaSession.playbackState — so a continuously-playing
    // anchor leaves the notification frozen on "playing". Mirroring it (play on
    // play, pause on pause) is what makes the OS UI actually update on each
    // action. Trade-off: A2DP Bluetooth may re-negotiate on resume; a correct
    // lock-screen state is worth more than avoiding that.
    this.stopKeepalive();

    // Don't stop sources or clear buffers!
    // Just suspend the context to pause time.
    // This preserves the audio buffer (scheduled nodes) so we resume exactly where we left off.
    // If we clear sources, we lose the buffered audio (e.g. 2 seconds worth), causing the
    // player to jump forward by that amount on resume.
    if (this.audioContext && this.audioContext.state === "running") {
      this.intentionalSuspend = true;
      this.audioContext.suspend().catch((err) => {
        Logger.error(TAG, "Failed to suspend audio context", err);
      });
    }

    // We do NOT reset clock tracking here.
    // Since we are suspending the context, the relationship between
    // AudioContext.currentTime and media time is preserved.

    Logger.debug(TAG, "Paused");
  }

  /**
   * Suspend audio output for buffering without stopping data acceptance.
   * Keeps isPlaying=true so render() still accepts AudioData and buffers fill up.
   * Suppresses auto-recovery so the context stays suspended until resumeFromBuffering().
   */
  suspendForBuffering(): void {
    this.intentionalSuspend = true;
    if (this.audioContext && this.audioContext.state === "running") {
      this.audioContext.suspend().catch((err) => {
        Logger.error(TAG, "Failed to suspend audio context for buffering", err);
      });
    }
    Logger.debug(TAG, "Suspended for buffering (isPlaying still true)");
  }

  /**
   * Prepare for the first-play / replay audio prime: mark the renderer playing
   * so render() accepts decoded audio and the buffer fills, but hold the
   * AudioContext suspended so nothing drains until resumeFromBuffering().
   *
   * Unlike play() + suspendForBuffering(), this NEVER issues an async resume().
   * That pair raced on replay: after `ended`, pause() leaves the context
   * suspended; the prime's fire-and-forget play() then kicks off an async
   * resume(), and the immediately-following suspendForBuffering() sees the
   * context still "suspended" (resume in flight) so its state===running guard
   * skips the suspend — the late resume then wins and the context stays
   * running for the whole prime, draining the primed audio and underrunning
   * the sub-realtime software decoder into a flood of gap-fills. Priming
   * without ever resuming removes the race entirely.
   */
  primeForBuffering(): void {
    this.isPlaying = true;
    this.intentionalSuspend = true;
    if (!this.audioContext && !this._muted) {
      // Context deferred (never created yet) — bring it up, then hold it
      // suspended. Any audio decoded before init resolves has nowhere to
      // schedule, but by the prime path the context already exists in every
      // observed flow (first play created it during the poster seek); this is
      // just a safety net.
      this.init()
        .then(() => {
          if (this.intentionalSuspend && this.audioContext?.state === "running") {
            this.audioContext.suspend().catch(() => {});
          }
        })
        .catch(() => {});
    } else if (this.audioContext && this.audioContext.state === "running") {
      this.audioContext.suspend().catch((err) => {
        Logger.error(TAG, "Failed to suspend audio context for prime", err);
      });
    }
    this.lastDecodeTime = performance.now();
    Logger.debug(TAG, "Primed for buffering (context held suspended)");
  }

  /**
   * Resume audio after buffering. Clears the intentional suspend flag.
   */
  resumeFromBuffering(): void {
    this.intentionalSuspend = false;
    if (this.audioContext && this.audioContext.state === "suspended") {
      this.audioContext.resume().catch((err) => {
        Logger.error(TAG, "Failed to resume audio context from buffering", err);
      });
    }
    Logger.debug(TAG, "Resumed from buffering");
  }

  /**
   * Set volume (0-1) with smooth ramping to prevent clicks/pops
   */
  setVolume(volume: number): void {
    // 0–2: values above 1 boost up to 200% (VLC-style).
    this.volume = Math.max(0, Math.min(2, volume));
    if (this.gainNode && !this._muted) {
      const g = this.perceptualGain(this.volume);
      if (this._stableAudio) {
        this.rampGain(g);
      } else {
        this.gainNode.gain.value = g;
      }
    }
    Logger.debug(TAG, `Volume: ${this.volume} (muted: ${this._muted})`);
  }

  /**
   * Get volume
   */
  getVolume(): number {
    return this.volume;
  }

  /**
   * Set playback rate
   */
  setPlaybackRate(rate: number): void {
    const newRate = Math.max(0.25, Math.min(4, rate));
    if (this._playbackRate === newRate) return;

    const oldRate = this._playbackRate;

    // Clear stretcher state when rate changes.
    if (this.preservePitch && this.signalsmith) {
      this.signalsmith.tempo = newRate;
      this.signalsmith.clear();
    } else if (
      this.preservePitch &&
      Math.abs(newRate - 1.0) > 0.01 &&
      this.audioContext
    ) {
      // Eager warmup: kick off WASM stretcher construction the moment a
      // non-1x rate is chosen, BEFORE the first audio chunk arrives. Without
      // this the stretcher only starts loading inside processStretch() on the
      // first chunk, leaving the opening ~1s with no stretcher — which falls
      // through to the silence path (no chipmunk, but a brief audio gap).
      // Warming it ahead of the chunks closes that gap in the common case.
      // sampleRate matches the AudioContext; processStretch rebuilds the
      // instance if a decoded chunk ever arrives at a different rate.
      this.maybeInitSignalsmith(this.audioContext.sampleRate);
    }

    // Re-anchor the audio→media clock at the CURRENT play position, then drop
    // the stale old-rate audio that's still scheduled ahead of `now` so the
    // rate change is heard immediately instead of after a multi-second tail.
    //
    // The scheduled read-ahead (each chunk queued at `scheduledTime`, which
    // runs up to ~maxAudioBuffered seconds past `now`) is all old-rate audio.
    // If we leave it playing (the old "do nothing" path) the audible rate
    // change lags video by that whole span. So we stop the active sources and
    // pull scheduledTime back to `now` — the next decoded chunk then plays at
    // `now` at the new rate.
    //
    // Crucially we do NOT clear firstBufferMediaTime / hasFirstBuffer the way
    // reset() does. Keeping the anchor (mapped through the OLD rate up to now)
    // means the next chunk schedules via expectedTime against the current
    // playhead — so the audio clock does NOT leap to the demuxer's read-ahead
    // mediaTime, and the video does not hard-snap forward. That leap was the
    // "jumps 1–3s ahead on rate change" regression.
    if (
      this.audioContext &&
      this.audioContext.state === "running" &&
      this.hasFirstBuffer
    ) {
      const now = this.audioContext.currentTime;
      const currentMediaTime =
        this.firstBufferMediaTime +
        (now - this.firstBufferScheduledAt) * oldRate;
      this.firstBufferScheduledAt = now;
      this.firstBufferMediaTime = currentMediaTime;

      // Stop the stale old-rate sources scheduled ahead of now. Fade the gain
      // briefly first (stable audio) to avoid a click at the cut.
      if (this._stableAudio && this.gainNode && this.activeSources.length > 0) {
        try {
          this.gainNode.gain.cancelScheduledValues(now);
          this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
          this.gainNode.gain.linearRampToValueAtTime(
            0,
            now + AudioRenderer.FADE_OUT_TIME,
          );
        } catch {
          /* ignore ramp errors */
        }
      }
      for (const source of this.activeSources) {
        try {
          source.stop();
          source.disconnect();
        } catch {
          /* ignore */
        }
      }
      this.activeSources = [];
      // Next chunk schedules from now (its expectedTime, via the preserved
      // anchor, lands just after now — the small forward gap is the buffered
      // span we just discarded, not a clock leap). Stretcher ring already
      // cleared above.
      this.scheduledTime = now;

      // Restore gain after the fade-out for the new-rate sources.
      if (this._stableAudio && this.gainNode) {
        try {
          const restoreTime = now + AudioRenderer.FADE_OUT_TIME + 0.005;
          this.gainNode.gain.linearRampToValueAtTime(
            this._muted ? 0 : this.perceptualGain(this.volume),
            restoreTime,
          );
        } catch {
          this.gainNode.gain.value = this._muted
            ? 0
            : this.perceptualGain(this.volume);
        }
      }
    }

    this._playbackRate = newRate;
  }

  /**
   * Get playback rate
   */
  getPlaybackRate(): number {
    return this._playbackRate;
  }

  /**
   * Set pitch preservation mode
   */
  setPreservePitch(preserve: boolean): void {
    this.preservePitch = preserve;
    Logger.debug(TAG, `Pitch preservation: ${preserve}`);
  }

  /**
   * Get pitch preservation mode
   */
  getPreservePitch(): boolean {
    return this.preservePitch;
  }

  /**
   * Check if audio is rebuffering due to playback rate change
   */
  isRebuffering(): boolean {
    return this.isRebufferingForRateChange;
  }

  /**
   * Mute with smooth fade to prevent clicks/pops
   */
  mute(): void {
    this._muted = true;
    if (this.gainNode) {
      if (this._stableAudio) {
        this.rampGain(0);
      } else {
        this.gainNode.gain.value = 0;
      }
    }
    Logger.debug(TAG, "Muted");
  }

  /**
   * Unmute with smooth fade to prevent clicks/pops
   */
  async unmute(): Promise<void> {
    this._muted = false;

    // Initialize AudioContext on unmute if not already initialized (user gesture)
    // This happens during autoplay muted -> unmute transition
    if (!this.audioContext && this.isPlaying) {
      await this.init();
    }

    if (this.gainNode) {
      const g = this.perceptualGain(this.volume);
      if (this._stableAudio) {
        this.rampGain(g);
      } else {
        this.gainNode.gain.value = g;
      }
    }

    // Resume AudioContext on unmute (user gesture) if it was suspended
    if (this.audioContext && this.audioContext.state === "suspended") {
      this.audioContext
        .resume()
        .then(() => {
          Logger.debug(TAG, "AudioContext resumed on unmute");
        })
        .catch((err) => {
          Logger.warn(TAG, "Failed to resume AudioContext on unmute", err);
        });
    }

    Logger.debug(TAG, "Unmuted");
  }

  /**
   * Reset timing and stop all scheduled audio with smooth fade-out
   */
  reset(): void {
    // Stable audio: fade out before stopping to prevent clicks
    if (this._stableAudio && this.audioContext && this.gainNode && this.activeSources.length > 0) {
      try {
        const now = this.audioContext.currentTime;
        this.gainNode.gain.cancelScheduledValues(now);
        this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
        this.gainNode.gain.linearRampToValueAtTime(0, now + AudioRenderer.FADE_OUT_TIME);
      } catch {
        // Ignore ramp errors
      }
    }

    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Ignore
      }
    }
    this.activeSources = [];
    this.scheduledTime = this.audioContext?.currentTime ?? 0;

    // Reset clock tracking
    this.hasFirstBuffer = false;
    this.firstBufferScheduledAt = 0;
    this.firstBufferMediaTime = 0;
    this.scheduledCount = 0;
    this.maxScheduledMediaTime = 0;

    // Reset starvation tracking
    this.isStarved = false;
    this.starvationStartTime = 0;

    // Clear stretcher state
    if (this.signalsmith) this.signalsmith.clear();

    // Restore gain after fade-out (for next playback)
    if (this._stableAudio && this.gainNode && this.audioContext) {
      try {
        const restoreTime = this.audioContext.currentTime + AudioRenderer.FADE_OUT_TIME + 0.005;
        this.gainNode.gain.linearRampToValueAtTime(
          this._muted ? 0 : this.perceptualGain(this.volume),
          restoreTime
        );
      } catch {
        // Fallback: set directly
        this.gainNode.gain.value = this._muted ? 0 : this.perceptualGain(this.volume);
      }
    }
  }

  /**
   * Get current audio context time
   */
  getCurrentTime(): number {
    // Use accurate audio clock during playback
    if (
      this.isPlaying &&
      this.audioContext &&
      this.audioContext.state === "running" &&
      this.hasFirstBuffer
    ) {
      const elapsed =
        this.audioContext.currentTime - this.firstBufferScheduledAt;
      let computedTime =
        this.firstBufferMediaTime + Math.max(0, elapsed * this._playbackRate);

      const latency =
        (this.audioContext as any).outputLatency ||
        (this.audioContext as any).baseLatency ||
        0;
      if (latency > 0) {
        computedTime -= latency * this._playbackRate;
        // Prevent time from going below the first buffer time (Bluetooth high latency fix)
        computedTime = Math.max(computedTime, this.firstBufferMediaTime);
      }

      return computedTime;
    }
    return this.currentMediaTime;
  }

  /**
   * Get the audio clock - THE MASTER TIME SOURCE FOR A/V SYNC
   * Returns accurate time based on when audio actually started playing
   * Returns -1 if audio hasn't started yet
   * Clamps to maxScheduledMediaTime when audio has ended
   */
  getAudioClock(): number {
    if (
      this.audioContext &&
      this.audioContext.state === "running" &&
      this.hasFirstBuffer
    ) {
      const elapsed =
        this.audioContext.currentTime - this.firstBufferScheduledAt;
      let computedTime =
        this.firstBufferMediaTime + Math.max(0, elapsed * this._playbackRate);

      // Adjust for output latency if available (Critical for Android/Bluetooth sync)
      // outputLatency represents the delay between the audio hardware and the speakers
      // Subtracting this ensures the video syncs to what is actually HEARD, not just scheduled
      const latency =
        (this.audioContext as any).outputLatency ||
        (this.audioContext as any).baseLatency ||
        0;
      if (latency > 0) {
        computedTime -= latency * this._playbackRate;
        // Prevent audio clock from going below the first buffer time
        // This is critical for Bluetooth devices with high latency (100-300ms)
        // to prevent video stalling at playback start
        computedTime = Math.max(computedTime, this.firstBufferMediaTime);
      }

      // Clamp to the maximum scheduled media time to prevent clock runaway
      if (this.maxScheduledMediaTime > 0) {
        return Math.min(computedTime, this.maxScheduledMediaTime);
      }
      return computedTime;
    }
    return -1;
  }

  /**
   * True when an AudioContext exists but the browser is keeping it suspended
   * despite us asking to play unmuted — i.e. autoplay-with-sound was blocked
   * because no user gesture has unlocked audio yet. resume() resolves without
   * throwing in this case (Chromium silently leaves the context suspended),
   * so callers can't detect the block from play()'s promise; they poll this
   * instead. Returns false when muted (we intentionally don't resume) or when
   * the context is genuinely running.
   */
  isBlockedSuspended(): boolean {
    return (
      !!this.audioContext &&
      this.audioContext.state === "suspended" &&
      !this._muted &&
      !this.intentionalSuspend
    );
  }

  /**
   * Check if audio has healthy buffers (not in underrun state)
   * Used by video renderer to decide whether to sync to audio
   */
  hasHealthyBuffer(): boolean {
    if (!this.audioContext || !this.hasFirstBuffer) return false;

    // Context must be running
    if (this.audioContext.state !== "running") return false;

    // Stable audio: if starved, buffer is not healthy
    if (this._stableAudio && this.isStarved) return false;

    // Check if decoder has stopped outputting
    const timeSinceLastDecode = performance.now() - this.lastDecodeTime;
    if (this.lastDecodeTime > 0 && timeSinceLastDecode > 500) return false;

    // Compute buffer ahead time
    const realBufferAhead = this.scheduledTime - this.audioContext.currentTime;
    const hasScheduledAudio =
      this.activeSources.length > 0 || realBufferAhead > 0;

    // For initial sync stability (especially with Bluetooth), require more buffer
    // First few chunks need larger buffer to ensure stable clock
    const minBufferThreshold = this.scheduledCount < 5 ? 0.1 : 0.02;

    return hasScheduledAudio && realBufferAhead > minBufferThreshold;
  }

  /**
   * Check if audio is actively playing
   */
  isAudioPlaying(): boolean {
    return (
      this.isPlaying &&
      this.audioContext?.state === "running" &&
      this.hasFirstBuffer
    );
  }

  /**
   * Get filtered buffered duration (seconds ahead of current time)
   */
  getBufferedDuration(): number {
    if (!this.audioContext) return 0;
    return Math.max(0, this.scheduledTime - this.audioContext.currentTime);
  }

  /**
   * Get the furthest media time (seconds) already scheduled in Web Audio.
   */
  getMaxScheduledMediaTime(): number {
    return this.maxScheduledMediaTime;
  }

  // ─── Stable Audio Methods ────────────────────────────────────────────

  /**
   * (Re)connect the audio graph for the current stable-audio state.
   *   stable ON : sources → input → compressor → gain(makeup) → destination
   *   stable OFF: sources → input → gain(volume)  → destination
   *
   * The volume/makeup gainNode is ALWAYS the final node before destination, so
   * a >100% boost is applied *after* the limiter instead of being cancelled by
   * it. Measured: with the old gain-before-limiter order, 100%→200% yielded
   * only ~+0.6dB; with gain after the limiter it's the full ~+6dB. Because the
   * limiter has already tamed peaks to ≈-15dBFS, a 2× makeup still lands well
   * under 0dBFS, so it does not re-introduce clipping.
   */
  private wireGraph(): void {
    if (
      !this.audioContext ||
      !this.inputNode ||
      !this.gainNode ||
      !this.compressorNode
    )
      return;
    try {
      // Bare disconnect() is a safe no-op when nothing is connected yet.
      this.inputNode.disconnect();
      this.compressorNode.disconnect();
      this.gainNode.disconnect();
      if (this._stableAudio) {
        this.inputNode.connect(this.compressorNode);
        this.compressorNode.connect(this.gainNode);
        this.gainNode.connect(this.audioContext.destination);
      } else {
        this.inputNode.connect(this.gainNode);
        this.gainNode.connect(this.audioContext.destination);
      }
    } catch {
      Logger.warn(TAG, "Failed to (re)wire audio chain");
    }
  }

  /**
   * Enable/disable stable audio mode (dynamic range compression / loudness normalization)
   */
  setStableAudio(enabled: boolean): void {
    this._stableAudio = enabled;
    Logger.info(TAG, `Stable audio: ${enabled ? "enabled" : "disabled"}`);

    // Rewire for the new state (live sources stay attached to inputNode).
    this.wireGraph();
    Logger.debug(TAG, `Audio chain rewired: compressor ${enabled ? "active" : "bypassed"}`);

    if (enabled && this.audioContext) {
      this.setupContextStateMonitoring();
    } else if (!enabled && this.audioContext && this.contextStateHandler) {
      this.audioContext.removeEventListener("statechange", this.contextStateHandler);
      this.contextStateHandler = null;
    }
  }

  /**
   * Get stable audio mode state
   */
  getStableAudio(): boolean {
    return this._stableAudio;
  }

  /**
   * Smoothly ramp gain to target value to prevent clicks/pops
   */
  /**
   * Convert a linear slider value (0-1) to a perceptual gain value.
   *
   * Human loudness perception is logarithmic, so a linear gain feels like
   * "almost everything happens in the first 10%" and the top 90% feels flat.
   * We map the slider through an exponential (dB-based) curve so that equal
   * slider movement produces a roughly equal perceived loudness change across
   * the whole range. 0 -> silence, 1 -> unity gain.
   */
  private perceptualGain(v: number): number {
    if (v <= 0) return 0;
    // Above 100% we boost LINEARLY (VLC-style, up to 200% = 2x gain). Unity at
    // v=1. Loud content near 0 dBFS can clip when boosted — enabling stable
    // audio inserts the limiter that tames it.
    if (v >= 1) return v;
    // ~60 dB usable range: gain = (e^(k*v) - 1) / (e^k - 1), k tuned for feel.
    const k = 6.908; // ln(1000) -> ~60 dB dynamic range
    return (Math.exp(k * v) - 1) / (Math.exp(k) - 1);
  }

  private rampGain(targetValue: number): void {
    if (!this.gainNode || !this.audioContext) {
      return;
    }
    try {
      const now = this.audioContext.currentTime;
      this.gainNode.gain.cancelScheduledValues(now);
      this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
      this.gainNode.gain.linearRampToValueAtTime(
        targetValue,
        now + AudioRenderer.GAIN_RAMP_TIME
      );
    } catch {
      // Fallback: set directly if ramping fails
      this.gainNode.gain.value = targetValue;
    }
  }

  /**
   * Monitor AudioContext state changes and auto-recover from interruptions
   * Handles cases like: phone calls, other audio sources, OS-level interruptions
   */
  private setupContextStateMonitoring(): void {
    if (!this.audioContext) return;

    // Remove old handler if any
    if (this.contextStateHandler) {
      this.audioContext.removeEventListener("statechange", this.contextStateHandler);
    }

    this.contextStateHandler = () => {
      if (!this.audioContext) return;
      const state = this.audioContext.state;

      if (state === "interrupted" || (state === "suspended" && this.isPlaying && !this._muted && !this.intentionalSuspend)) {
        Logger.warn(TAG, `AudioContext ${state} unexpectedly during playback, attempting recovery`);
        this.attemptContextRecovery();
      } else if (state === "running") {
        // Successfully recovered
        this.recoveryAttempts = 0;
        Logger.debug(TAG, "AudioContext recovered to running state");
      }
    };

    this.audioContext.addEventListener("statechange", this.contextStateHandler);
  }

  /**
   * Attempt to recover AudioContext from interrupted/suspended state
   */
  private attemptContextRecovery(): void {
    if (!this.audioContext || !this.isPlaying) return;
    if (this.recoveryAttempts >= AudioRenderer.MAX_RECOVERY_ATTEMPTS) {
      Logger.error(TAG, `AudioContext recovery failed after ${AudioRenderer.MAX_RECOVERY_ATTEMPTS} attempts`);
      this.recoveryAttempts = 0;
      return;
    }

    this.recoveryAttempts++;
    Logger.debug(TAG, `AudioContext recovery attempt ${this.recoveryAttempts}/${AudioRenderer.MAX_RECOVERY_ATTEMPTS}`);

    this.audioContext.resume().then(() => {
      if (this.audioContext?.state === "running") {
        Logger.info(TAG, "AudioContext recovered successfully");
        this.recoveryAttempts = 0;
      }
    }).catch((err) => {
      Logger.warn(TAG, "AudioContext recovery failed", err);
      // Retry with exponential backoff
      const delay = Math.min(1000 * Math.pow(2, this.recoveryAttempts - 1), 5000);
      setTimeout(() => this.attemptContextRecovery(), delay);
    });
  }

  /**
   * Check if audio is in starvation state (no new data for extended period)
   * Used by Clock/MoviPlayer to decide whether audio clock is reliable
   */
  isAudioStarved(): boolean {
    if (!this.isPlaying || !this.hasFirstBuffer) return false;

    // Only starve if buffer is actually empty (not just no new decodes)
    const bufferAhead = this.getBufferedDuration();
    if (bufferAhead > 0.05) return false; // NYUMATFLIX: lower starved buffer bar

    const timeSinceLastDecode = performance.now() - this.lastDecodeTime;
    if (this.lastDecodeTime > 0 && timeSinceLastDecode > AudioRenderer.STARVATION_THRESHOLD) {
      if (!this.isStarved) {
        this.isStarved = true;
        this.starvationStartTime = performance.now();
        Logger.warn(TAG, `Audio starvation detected: ${timeSinceLastDecode.toFixed(0)}ms since last decode`);
      }
      return true;
    }

    return false;
  }

  /**
   * Get duration of current starvation period in ms (0 if not starved)
   */
  getStarvationDuration(): number {
    if (!this.isStarved || this.starvationStartTime === 0) return 0;
    return performance.now() - this.starvationStartTime;
  }

  /**
   * Destroy renderer
   */
  async destroy(): Promise<void> {
    this.isPlaying = false;
    this.reset();

    // Tear down BT keepalive
    this.stopKeepalive();
    if (this.keepaliveEl) {
      try {
        this.keepaliveEl.src = "";
      } catch {
        /* noop */
      }
      this.keepaliveEl = null;
    }
    if (this.keepaliveUrl) {
      URL.revokeObjectURL(this.keepaliveUrl);
      this.keepaliveUrl = null;
    }

    // Clean up context state monitoring
    if (this.audioContext && this.contextStateHandler) {
      this.audioContext.removeEventListener("statechange", this.contextStateHandler);
      this.contextStateHandler = null;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    this.inputNode = null;
    this.gainNode = null;
    this.compressorNode = null;
    if (this.signalsmith) {
      this.signalsmith.destroy();
      this.signalsmith = null;
    }
    this.recoveryAttempts = 0;
    Logger.debug(TAG, "Destroyed");
  }
}
