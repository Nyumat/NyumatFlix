/**
 * QoE (Quality of Experience) analytics — a small, versioned event stream with
 * pluggable sinks. Because movi decodes itself, it can measure things a
 * <video>-based player cannot: hardware-vs-software decode fallback and per-codec
 * decode timing, alongside the usual startup time, rebuffering and errors.
 *
 * Wire a sink (or listen to the element's `movi-qoe` CustomEvent) and forward to
 * Mux / GA4 / Amplitude / your own endpoint. Cookieless and self-host friendly.
 */

/** Bump when the event shape changes so downstream consumers can branch. */
export const QOE_SCHEMA_VERSION = 1;

export type QoEEvent =
  | { type: "session_start"; ts: number; src: string }
  /** Time from load/play intent to the first presented frame. */
  | { type: "startup"; ts: number; startupMs: number }
  /** One rebuffer (stall) that has just ended. */
  | { type: "rebuffer"; ts: number; durationMs: number; count: number }
  /** Rendition/quality changed (premuxed height or HLS/DASH level). */
  | { type: "bitrate_switch"; ts: number; height: number | null; label: string | null }
  /** Decode dropped from hardware (WebCodecs) to software (FFmpeg-WASM). */
  | { type: "decode_fallback"; ts: number; codec: string }
  | { type: "error"; ts: number; message: string; fatal: boolean }
  /** Periodic health sample while playing. */
  | {
      type: "heartbeat";
      ts: number;
      position: number;
      watchedMs: number;
      droppedFrames: number;
      decoder: string;
      rebufferRatio: number;
    }
  | { type: "ended"; ts: number; watchedMs: number };

export type QoESink = (event: QoEEvent) => void;

/** A rolled-up snapshot of the whole session. */
export interface QoESession {
  schemaVersion: number;
  src: string;
  startupMs: number | null;
  rebufferCount: number;
  rebufferMs: number;
  rebufferRatio: number;
  watchedMs: number;
  droppedFrames: number;
  bitrateSwitches: number;
  errors: number;
  decoder: string;
}

/**
 * Collects QoE signals and fans typed events out to registered sinks. Fed by
 * MoviElement from the player's existing event surface; framework-agnostic and
 * dependency-free.
 */
export class QoECollector {
  private sinks = new Set<QoESink>();
  private startAt = 0; // performance.now() at session start / play intent
  private firstFrameSent = false;
  private startupMsValue: number | null = null;
  private bufferingStart = 0;
  private rebufferCount = 0;
  private rebufferMs = 0;
  private watchAccumMs = 0;
  private lastPlayingAt = 0; // performance.now() when playback last (re)started
  private isPlaying = false;
  private bitrateSwitches = 0;
  private errors = 0;
  private droppedFrames = 0;
  private decoder = "unknown";
  private src = "";
  private nowFn: () => number;

  constructor(now: () => number = () => performance.now()) {
    this.nowFn = now;
  }

  addSink(sink: QoESink): void {
    this.sinks.add(sink);
  }
  removeSink(sink: QoESink): void {
    this.sinks.delete(sink);
  }

  private emit(event: QoEEvent): void {
    for (const sink of this.sinks) {
      try {
        sink(event);
      } catch {
        // a broken sink must never disrupt playback
      }
    }
  }

  private stamp() {
    return Date.now();
  }

  /** New source loaded — resets the session and starts the startup timer. */
  sessionStart(src: string): void {
    this.startAt = this.nowFn();
    this.firstFrameSent = false;
    this.startupMsValue = null;
    this.bufferingStart = 0;
    this.rebufferCount = 0;
    this.rebufferMs = 0;
    this.watchAccumMs = 0;
    this.lastPlayingAt = 0;
    this.isPlaying = false;
    this.bitrateSwitches = 0;
    this.errors = 0;
    this.droppedFrames = 0;
    this.src = src;
    this.emit({ type: "session_start", ts: this.stamp(), src });
  }

  /** First presented frame — emits startup time once per session. */
  firstFrame(): void {
    if (this.firstFrameSent || this.startAt === 0) return;
    this.firstFrameSent = true;
    this.startupMsValue = Math.round(this.nowFn() - this.startAt);
    this.emit({ type: "startup", ts: this.stamp(), startupMs: this.startupMsValue });
  }

  playing(): void {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.lastPlayingAt = this.nowFn();
  }

  paused(): void {
    if (this.isPlaying) {
      this.watchAccumMs += this.nowFn() - this.lastPlayingAt;
    }
    this.isPlaying = false;
  }

  bufferingStartNow(): void {
    if (this.bufferingStart) return;
    this.paused(); // stalled time isn't watch time
    this.bufferingStart = this.nowFn();
  }

  bufferingEndNow(): void {
    if (!this.bufferingStart) return;
    const durationMs = Math.round(this.nowFn() - this.bufferingStart);
    this.bufferingStart = 0;
    // The startup stall isn't a rebuffer — only count stalls after first frame.
    if (this.firstFrameSent) {
      this.rebufferCount++;
      this.rebufferMs += durationMs;
      this.emit({
        type: "rebuffer",
        ts: this.stamp(),
        durationMs,
        count: this.rebufferCount,
      });
    }
  }

  bitrateSwitch(height: number | null, label: string | null): void {
    this.bitrateSwitches++;
    this.emit({ type: "bitrate_switch", ts: this.stamp(), height, label });
  }

  decodeFallback(codec: string): void {
    this.emit({ type: "decode_fallback", ts: this.stamp(), codec });
  }

  error(message: string, fatal: boolean): void {
    this.errors++;
    this.emit({ type: "error", ts: this.stamp(), message, fatal });
  }

  /** Periodic sample. `droppedFrames` and `decoder` come from the player. */
  heartbeat(position: number, droppedFrames: number, decoder: string): void {
    this.droppedFrames = droppedFrames;
    this.decoder = decoder;
    const watched = this.watchedMs();
    this.emit({
      type: "heartbeat",
      ts: this.stamp(),
      position,
      watchedMs: watched,
      droppedFrames,
      decoder,
      rebufferRatio: this.ratio(watched),
    });
  }

  ended(): void {
    this.paused();
    this.emit({ type: "ended", ts: this.stamp(), watchedMs: this.watchedMs() });
  }

  private watchedMs(): number {
    return Math.round(
      this.watchAccumMs +
        (this.isPlaying ? this.nowFn() - this.lastPlayingAt : 0),
    );
  }

  private ratio(watched: number): number {
    const total = watched + this.rebufferMs;
    return total > 0 ? +(this.rebufferMs / total).toFixed(4) : 0;
  }

  /** A rolled-up snapshot of the session so far. */
  getSession(): QoESession {
    const watched = this.watchedMs();
    return {
      schemaVersion: QOE_SCHEMA_VERSION,
      src: this.src,
      startupMs: this.startupMsValue,
      rebufferCount: this.rebufferCount,
      rebufferMs: this.rebufferMs,
      rebufferRatio: this.ratio(watched),
      watchedMs: watched,
      droppedFrames: this.droppedFrames,
      bitrateSwitches: this.bitrateSwitches,
      errors: this.errors,
      decoder: this.decoder,
    };
  }
}

/** Built-in sink: POST each event to `url` via sendBeacon (falls back to fetch
 *  keepalive). Non-blocking and cookieless. Batching is left to the endpoint. */
export function beaconSink(url: string): QoESink {
  return (event) => {
    const body = JSON.stringify({ v: QOE_SCHEMA_VERSION, ...event });
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(url, body)) return;
    } catch {
      /* fall through */
    }
    try {
      void fetch(url, { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } });
    } catch {
      /* best-effort */
    }
  };
}
