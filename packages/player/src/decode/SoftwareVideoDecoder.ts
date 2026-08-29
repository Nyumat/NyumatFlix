import { WasmBindings } from "../wasm/bindings";
import { VideoTrack } from "../types";
import { Logger } from "../utils/Logger";

const TAG = "SoftwareVideoDecoder";

export class SoftwareVideoDecoder {
  private bindings: WasmBindings;
  private onFrame: ((frame: VideoFrame) => void) | null = null;
  private onError: ((error: Error) => void) | null = null;
  private isConfigured = false;
  private trackIndex = -1;

  private targetFps: number = 0;
  private lastProcessedTimestamp: number = -1;

  constructor(bindings: WasmBindings) {
    this.bindings = bindings;
  }

  setOnFrame(callback: (frame: VideoFrame) => void): void {
    this.onFrame = callback;
  }

  setOnError(callback: (error: Error) => void): void {
    this.onError = callback;
  }

  async configure(track: VideoTrack, targetFps: number = 0): Promise<boolean> {
    this.trackIndex = track.id;
    this.targetFps = targetFps;

    // Reset timestamp tracking on re-configure
    this.lastProcessedTimestamp = -1;

    // Enable decoder in WASM
    const ret = this.bindings.enableDecoder(this.trackIndex);
    if (ret < 0) {
      Logger.error(
        TAG,
        `Failed to enable software decoder for stream ${this.trackIndex}: ${ret}`,
      );
      return false;
    }

    this.isConfigured = true;

    // Optimize CPU usage for low frame rates (e.g. ambient mode / thumbnails)
    if (this.targetFps > 0 && this.targetFps < 10) {
      // Skip non-reference frames (B-frames) to reduce decoding load
      // This is safe and preserves video flow but drops unnecessary frames
      this.bindings.setSkipFrame(this.trackIndex, 1); // 1 = AVDISCARD_NONREF
      Logger.info(
        TAG,
        "Enabled AVDISCARD_NONREF skipping for low FPS playback",
      );
    } else {
      this.bindings.setSkipFrame(this.trackIndex, 0); // 0 = AVDISCARD_NONE
    }

    Logger.info(
      TAG,
      `Configured software decoder for stream ${this.trackIndex} (TargetFPS: ${targetFps})`,
    );
    return true;
  }

  async flush(): Promise<void> {
    this.packetQueue = [];
    if (this.isConfigured && this.trackIndex >= 0) {
      this.bindings.flushDecoder(this.trackIndex);
    }
  }

  reset(): void {
    this.packetQueue = [];
    if (this.isConfigured && this.trackIndex >= 0) {
      this.bindings.flushDecoder(this.trackIndex);
    }
    this.lastProcessedTimestamp = -1;
  }

  close(): void {
    this.isConfigured = false;
  }

  private packetQueue: Array<{
    data: Uint8Array;
    pts: number;
    dts: number;
    keyframe: boolean;
  }> = [];
  private isProcessingQueue = false;

  decode(data: Uint8Array, pts: number, dts: number, keyframe: boolean): void {
    if (!this.isConfigured) return;

    // Queue the packet for processing
    this.packetQueue.push({ data, pts, dts, keyframe });

    // Trigger processing if not already running
    this.processQueue();
  }

  private async processQueue() {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    try {
      let lastYieldTime = performance.now();

      // Use MessageChannel for zero-latency yielding (faster than setTimeout)
      const channel = new MessageChannel();
      const yieldPromise = () =>
        new Promise((resolve) => {
          channel.port1.onmessage = () => resolve(null);
          channel.port2.postMessage(null);
        });

      while (this.packetQueue.length > 0) {
        // Yield to event loop frequently in software mode
        // Audio playback requires the main thread to be responsive
        const now = performance.now();
        if (now - lastYieldTime > 8) {
          await yieldPromise();
          lastYieldTime = performance.now();
        }

        const packet = this.packetQueue.shift();
        if (packet) {
          this.decodeInternal(packet);
        }
      }
    } catch (e) {
      Logger.error(TAG, "Queue processing error", e);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  private decodeInternal(packet: {
    data: Uint8Array;
    pts: number;
    dts: number;
    keyframe: boolean;
  }): void {
    if (!this.isConfigured) return;

    const ret = this.bindings.sendPacket(
      this.trackIndex,
      packet.data,
      packet.pts,
      packet.dts,
      packet.keyframe,
    );

    if (ret < 0) {
      Logger.warn(TAG, `sendPacket failed: ${ret}`);
      return;
    }

    // Receive loop
    while (true) {
      const ret = this.bindings.receiveFrame(this.trackIndex);
      if (ret !== 0) break;

      // CRITICAL: Get the actual PTS of the decoded frame from WASM
      // Using chunk.timestamp (packet timestamp) is incorrect for videos with B-frames
      // where frames may be output in a different order than strictly sequential.
      const framePts = this.bindings.getFramePts(this.trackIndex);
      const actualTimestamp =
        framePts >= 0 ? framePts * 1_000_000 : packet.pts * 1_000_000;

      this.processDecodedFrame(actualTimestamp);
    }
  }

  private processDecodedFrame(timestamp: number) {
    if (!this.onFrame) return;

    // Skip decoding/conversion if we are throttling FPS
    // This saves MASSIVE CPU by avoiding the expensive sws_scale RGBA conversion
    if (this.targetFps > 0 && this.lastProcessedTimestamp >= 0) {
      const interval = 1_000_000 / this.targetFps; // interval in microseconds

      // If this frame is too close to the last one we processed, skip it
      // We allow a small tolerance (10%) to ensure we don't miss frames that are slightly early
      if (timestamp < this.lastProcessedTimestamp + interval * 0.9) {
        return;
      }
    }

    let width = this.bindings.getFrameWidth();
    let height = this.bindings.getFrameHeight();

    // PERFORMANCE OPTIMIZATION: Cap software decoding resolution
    // 4K AV1 software decoding is extremely expensive and will block the main thread for >50ms
    // By capping at 1080p (1920px) or downscaling, we reduce load by ~4x while maintaining good quality
    if (width > 1920) {
      const scale = 1920 / width;
      width = 1920;
      height = Math.floor(height * scale);
    }

    try {
      // Use RGBA conversion for proper handling of all formats including 10-bit HDR
      // WASM's sws_scale converts any pixel format (YUV420P10LE, etc.) to RGBA
      // We pass the potentially downscaled dimensions here
      const rgbaData = this.bindings.getFrameRGBA(width, height);

      if (!rgbaData) {
        Logger.error(TAG, "Failed to get RGBA frame data");
        return;
      }

      const frameInit: VideoFrameBufferInit = {
        format: "RGBA",
        codedWidth: width,
        codedHeight: height,
        timestamp: timestamp,
      };

      // Note: For RGBA format, we don't need to set colorSpace
      // The WASM sws_scale handles the color conversion internally
      // For HDR content, the canvas renderer handles display-side tonemapping

      const frame = new VideoFrame(rgbaData, frameInit);

      this.onFrame(frame);
      // Ownership transferred to caller

      this.lastProcessedTimestamp = timestamp;
    } catch (e) {
      Logger.error(TAG, "Frame creation failed", e);
      if (this.onError) this.onError(e as Error);
    }
  }

  get configured(): boolean {
    return this.isConfigured;
  }

  get queueSize(): number {
    return this.packetQueue.length;
  }
}
