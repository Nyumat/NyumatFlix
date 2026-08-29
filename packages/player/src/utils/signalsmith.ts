/**
 * Signalsmith Stretch wrapper — pitch-preserving time-stretch backed by the
 * MIT-licensed Signalsmith library, compiled into the same movi WASM module
 * as FFmpeg/dav1d.
 *
 * Signalsmith's native model is a single sync `process(in, nIn, out, nOut)`
 * call where the input/output sample-count ratio determines the time-stretch
 * factor (1:1 unity, 1:2 half-speed, 2:1 double-speed). We expose a
 * "putSamples → process → frameCount → receiveSamples" shape: stash the
 * incoming chunk on the JS side, run process() on demand, present the
 * exact-frame output as `frameCount`.
 */
import { Logger } from "./Logger";
import { loadWasmModule } from "../wasm/FFmpegLoader";
import type { MoviWasmModule } from "../wasm/types";

const TAG = "Signalsmith";

let modulePromise: Promise<MoviWasmModule | null> | null = null;

/**
 * Ensure the movi WASM module is loaded. Single-flight, shared with the
 * FFmpeg pipeline. Returns null if loading fails so the caller can fall back
 * to a different stretcher.
 */
export function loadSignalsmith(): Promise<MoviWasmModule | null> {
  if (!modulePromise) {
    modulePromise = loadWasmModule()
      .then((mod) => {
        Logger.info(TAG, "Signalsmith Stretch ready (shared movi WASM)");
        return mod;
      })
      .catch((err) => {
        Logger.warn(TAG, "movi WASM not available — falling back", err);
        modulePromise = null;
        return null;
      });
  }
  return modulePromise;
}

/**
 * SoundTouch-shaped facade around movi's Signalsmith Stretch API.
 * Stereo only — AudioRenderer always upmixes to interleaved 2-channel before
 * calling, matching the SoundTouch / Rubberband paths.
 */
export class SignalsmithStretcher {
  private mod: MoviWasmModule;
  private handle: number;
  private channels: number;
  private inPtr: number = 0;
  private outPtr: number = 0;
  private inCapacityFrames: number = 0;
  private outCapacityFrames: number = 0;

  // Stash for the SoundTouch-style two-step (putSamples → process → receive).
  private pendingInput: Float32Array | null = null;
  private pendingInputFrames: number = 0;
  private lastOutputFrames: number = 0;

  private _tempo = 1.0;
  private _pitch = 1.0;

  readonly inputBuffer: {
    putSamples: (samples: Float32Array, position?: number, numFrames?: number) => void;
  };
  readonly outputBuffer: {
    readonly frameCount: number;
    receiveSamples: (output: Float32Array, numFrames: number) => void;
  };

  constructor(mod: MoviWasmModule, sampleRate: number, channels: number = 2) {
    this.mod = mod;
    this.channels = channels;
    this.handle = mod._movi_stretch_new(channels, sampleRate);
    if (!this.handle) {
      throw new Error("movi_stretch_new returned 0");
    }

    // Wire the SoundTouch-style facade.
    const self = this;
    this.inputBuffer = {
      putSamples: (samples, position = 0, numFrames = 0) => {
        self.stashInput(samples, position, numFrames);
      },
    };
    this.outputBuffer = {
      get frameCount() {
        return self.lastOutputFrames;
      },
      receiveSamples: (output, numFrames) => self.runProcessIfNeeded(output, numFrames),
    };
  }

  set tempo(t: number) {
    this._tempo = t;
  }
  get tempo(): number {
    return this._tempo;
  }

  set pitch(p: number) {
    if (p === this._pitch) return;
    this._pitch = p;
    // Convert pitch ratio → semitones. 1.0 → 0 semitones (no shift).
    const semitones = p === 1.0 ? 0 : 12 * Math.log2(p);
    this.mod._movi_stretch_set_transpose_semitones(this.handle, semitones);
  }
  get pitch(): number {
    return this._pitch;
  }

  /**
   * SoundTouch's `process()` is a no-op trigger. We defer the actual WASM
   * call to receiveSamples() so we know the requested output size, which
   * Signalsmith needs upfront (it doesn't auto-buffer like SoundTouch).
   * Setting lastOutputFrames here gives the caller's frameCount check the
   * correct value before they call receiveSamples.
   */
  process(): void {
    if (!this.pendingInput || this.pendingInputFrames === 0) {
      this.lastOutputFrames = 0;
      return;
    }
    this.lastOutputFrames = Math.max(1, Math.ceil(this.pendingInputFrames / this._tempo));
  }

  clear(): void {
    this.pendingInput = null;
    this.pendingInputFrames = 0;
    this.lastOutputFrames = 0;
    this.mod._movi_stretch_reset(this.handle);
  }

  destroy(): void {
    if (!this.handle) return;
    if (this.inPtr) this.mod._free(this.inPtr);
    if (this.outPtr) this.mod._free(this.outPtr);
    this.mod._movi_stretch_delete(this.handle);
    this.handle = 0;
    this.inPtr = 0;
    this.outPtr = 0;
  }

  private stashInput(samples: Float32Array, position: number, numFrames: number): void {
    if (!numFrames || numFrames <= 0) {
      numFrames = (samples.length - position * this.channels) / this.channels;
    }
    const totalSamples = numFrames * this.channels;
    if (position === 0 && samples.length === totalSamples) {
      this.pendingInput = samples;
    } else {
      const start = position * this.channels;
      this.pendingInput = samples.subarray(start, start + totalSamples);
    }
    this.pendingInputFrames = numFrames;
  }

  /**
   * Lazily allocate / regrow a WASM heap buffer for `frames * channels`
   * float samples. Returns the pointer.
   */
  private ensureBuffer(which: "in" | "out", frames: number): number {
    const ptrField = which === "in" ? "inPtr" : "outPtr";
    const capField = which === "in" ? "inCapacityFrames" : "outCapacityFrames";
    if (this[capField] >= frames && this[ptrField]) return this[ptrField];
    if (this[ptrField]) this.mod._free(this[ptrField]);
    const bytes = frames * this.channels * 4;
    this[ptrField] = this.mod._malloc(bytes);
    this[capField] = frames;
    return this[ptrField];
  }

  private runProcessIfNeeded(output: Float32Array, numFrames: number): void {
    if (!this.pendingInput || this.pendingInputFrames === 0 || numFrames <= 0) {
      return;
    }

    const inFrames = this.pendingInputFrames;
    const outFrames = numFrames;

    const inPtr = this.ensureBuffer("in", inFrames);
    const outPtr = this.ensureBuffer("out", outFrames);

    // movi.wasm only exports HEAPU8 to JS (EXPORTED_RUNTIME_METHODS), so we
    // build a Float32 view over the shared ArrayBuffer ourselves. Re-create
    // it each call because ALLOW_MEMORY_GROWTH=1 lets the heap detach if a
    // _malloc grows the buffer (which would invalidate any cached view).
    const heapF32 = new Float32Array(this.mod.HEAPU8.buffer);
    const inOffset = inPtr >> 2;
    const inLen = inFrames * this.channels;
    heapF32.set(this.pendingInput.subarray(0, inLen), inOffset);

    this.mod._movi_stretch_process(this.handle, inPtr, inFrames, outPtr, outFrames);

    const outOffset = outPtr >> 2;
    const outLen = outFrames * this.channels;
    output.set(heapF32.subarray(outOffset, outOffset + outLen));

    // Consume the pending input — same chunk shouldn't be processed twice.
    this.pendingInput = null;
    this.pendingInputFrames = 0;
  }
}

/**
 * Convenience: load the WASM module + construct a stretcher in one call.
 */
export async function createSignalsmithStretcher(
  sampleRate: number,
  channels: number = 2,
): Promise<SignalsmithStretcher | null> {
  const mod = await loadSignalsmith();
  if (!mod) return null;
  return new SignalsmithStretcher(mod, sampleRate, channels);
}
