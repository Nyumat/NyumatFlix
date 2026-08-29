/**
 * CanvasRenderer - Renders VideoFrames to canvas with frame-perfect timing
 * Uses a frame queue and presentation loop for smooth 60Hz playback
 */

import { Logger } from "../utils/Logger";
import type { SubtitleCue } from "../types";

const TAG = "CanvasRenderer";

/**
 * A snapshot of the live 360° camera + projection, enough to reproject an
 * equirectangular frame to exactly what the user currently sees. Consumed by
 * the thumbnail/preview renderer so seek-bar previews match the on-screen view.
 */
export interface VRView {
  yaw: number; // radians, look left/right (current, post-spring)
  pitch: number; // radians, look up/down
  fov: number; // vertical field of view (radians)
  aspect: number; // player viewport width / height (frames the preview to match)
  half: boolean; // VR180 (front hemisphere)
  fisheye: boolean; // equidistant fisheye
  sbs: boolean; // side-by-side stereo (left eye)
  stereographic: boolean; // little-planet
  texAspect: number; // source frame width / height
}

export class CanvasRenderer {
  private canvas: HTMLCanvasElement | OffscreenCanvas;
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private texture: WebGLTexture | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private width: number = 0;
  private height: number = 0;
  private colorSpace: string = "srgb"; // Default to sRGB
  private hasNativeHDRSupport: boolean = false; // Native HDR support detection (Chromium)

  // Frame queue for presentation timing
  private frameQueue: VideoFrame[] = [];
  // Increased for 4K 60fps: need ~1.5-2s buffering = 90-120 frames at 60fps
  // Base size of 120 provides ~2s at 60fps, ~4s at 30fps
  private static readonly MAX_FRAME_QUEUE = 120;

  private hdrEnabled: boolean = true;
  private isHDRSource: boolean = false;
  private isHighBitDepth: boolean = false; // 12-bit+ content needs RGBA16F texture
  private _loggedFrameFormat: boolean = false;

  // Ambient mode mini-render: a 16×16 RGBA8 framebuffer that mirrors each
  // drawn frame. Lets MoviElement sample average color via a 256-pixel
  // readPixels (sync, ~microseconds) instead of an 8K canvas readback
  // (~100ms GPU stall). Created lazily when ambient mode turns on.
  private static readonly AMBIENT_SIZE = 16;
  private ambientFbo: WebGLFramebuffer | null = null;
  private ambientTex: WebGLTexture | null = null;
  private ambientEnabled: boolean = false;
  private ambientPixels: Uint8Array | null = null;

  // Presentation loop
  private rafId: number | null = null;
  private isPlaying: boolean = false;
  // Set once configure() runs, which only happens when a real video track is
  // active. Audio-only sources (incl. cover-art "video" streams that
  // TrackManager classifies as attached-pic) never configure the renderer, so
  // this stays false and the presentation loop is skipped — no point spinning a
  // 60fps rAF + A/V sync against frames that never arrive.
  private isVideoConfigured: boolean = false;

  // Adaptive DPR — measure first second of playback at full 2x DPR. If
  // average paint takes more than ~half a frame at 60Hz, the device is
  // GPU-bound and a 2x backbuffer is the difference between smooth and
  // stuttering. Drop to 1x DPR (quarter the pixels) and trigger a
  // resize so the change takes effect. Measurement is one-shot: once
  // we've decided, no more sampling overhead. Beats `deviceMemory` /
  // `hardwareConcurrency` heuristics — those misclassify weak-GPU /
  // strong-RAM phones and undercount iOS where deviceMemory is absent.
  private _maxDpr: number = 2;
  private _paintSamples: number[] = [];
  private _adaptDprChecked: boolean = false;
  private static readonly PAINT_SAMPLE_COUNT = 60; // ~1 second @ 60Hz
  private static readonly PAINT_THRESHOLD_MS = 8; // >50% of 16.67ms frame budget

  // Audio time provider for A/V sync
  private getAudioTime: (() => number) | null = null;
  private _isAudioHealthy: (() => boolean) | null = null;

  // Presentation timing
  private presentationStartTime: number = 0;
  private presentationStartPts: number = 0;
  private lastPresentedPts: number = -1;
  private syncedToAudio: boolean = false;
  private lastKnownAudioTime: number = -1;
  private playbackRate: number = 1.0;
  private justSeeked: boolean = false; // Track if we just seeked (for post-seek frame handling)
  private framesPresented: number = 0; // Track number of frames presented (for initial sync)

  // Current time tracking
  private currentTime: number = 0;

  // Frame rate for timing calculations
  private videoFrameRate: number = 60; // Default to 60fps

  // Rotation (degrees: 0, 90, 180, 270) - total = metadata + manual
  private rotation: number = 0;
  private metadataRotation: number = 0; // From video metadata
  private manualRotation: number = 0;   // User-applied rotation
  private containerWidth: number = 0;   // Original container width (before any rotation)
  private containerHeight: number = 0;  // Original container height

  // Fit mode for canvas rendering
  private fitMode: "contain" | "cover" | "fill" | "zoom" | "control" =
    "contain"; // Default to contain (maintain aspect ratio)
  private letterboxColor: [number, number, number] = [0, 0, 0]; // Current smoothed RGB (0-255)
  private letterboxTarget: [number, number, number] = [0, 0, 0]; // Target RGB from ambient sampling

  // 360° VR (equirectangular) projection. When enabled, drawFrame renders the
  // frame as the inside of a sphere viewed from its centre, via a per-fragment
  // equirectangular raycast, instead of the flat scaled/letterboxed quad. The
  // same fullscreen-quad VAO and texture upload are reused — only the program
  // and a handful of camera uniforms differ. The VR program is compiled lazily
  // the first time 360 mode is switched on (initVRProgram), so the 99% of
  // playback that is flat 2D pays nothing.
  private vr360Enabled: boolean = false;
  private vrProgram: WebGLProgram | null = null;
  private vrLocs: {
    image: WebGLUniformLocation | null;
    yaw: WebGLUniformLocation | null;
    pitch: WebGLUniformLocation | null;
    fov: WebGLUniformLocation | null;
    aspect: WebGLUniformLocation | null;
    lonDiv: WebGLUniformLocation | null;
    latDiv: WebGLUniformLocation | null;
    proj: WebGLUniformLocation | null;
    fishFov: WebGLUniformLocation | null;
    uScale: WebGLUniformLocation | null;
    uOffset: WebGLUniformLocation | null;
    planetScale: WebGLUniformLocation | null;
    srcAspect: WebGLUniformLocation | null;
  } | null = null;
  // VR180 (half-equirectangular): the frame covers only the front hemisphere.
  // The longitude span halves (π instead of 2π). false = full 360°.
  private vrHalf: boolean = false;
  // Fisheye projection (equidistant) instead of equirectangular — common in
  // VR180 camera captures (circular lens image with black corners).
  private vrFisheye: boolean = false;
  // Stereo side-by-side: the frame holds two eyes; sample only the left one.
  private vrStereoSbs: boolean = false;
  // Stereographic "little planet" projection (tiny-planet 360 clips).
  private vrStereographic: boolean = false;
  // Fisheye lens coverage (radians); 180° lenses → π.
  private static readonly VR_FISHEYE_FOV = Math.PI;
  // Stereographic horizon radius in image half-height units (tuned so a typical
  // tiny-planet's horizon sits sensibly; the camera reaches the rim/zenith).
  private static readonly VR_PLANET_SCALE = 0.5;
  // Source pixel aspect (width/height), used to derive the latitude span and to
  // clamp the VR180 camera so the viewport never exits the content (no black).
  private vrTexAspect: number = 2;
  // The camera is animated: input updates the *target*, and a light spring
  // eases the rendered (current) value toward it each frame — slightly
  // underdamped so it settles with a soft, YouTube-like glide/bounce instead
  // of snapping. drawVRFrame reads the current values; the targets are what
  // nudge/zoom/reset move.
  private vrYaw: number = 0; // current rendered yaw (radians)
  private vrPitch: number = 0; // current rendered pitch (radians)
  private vrFov: number = 1.2217; // current rendered FOV (radians, ~70°)
  private vrYawTarget: number = 0;
  private vrPitchTarget: number = 0;
  private vrFovTarget: number = 1.2217;
  private vrYawVel: number = 0; // spring velocity (rad/s)
  private vrPitchVel: number = 0;
  private vrAnimRaf: number | null = null;
  // Spring constants. DAMPING < 2·√STIFFNESS → underdamped. ζ ≈ 0.6 here
  // (DAMPING / 2·√STIFFNESS) gives a clear-but-tasteful ~9% overshoot — the
  // soft "bounce" YouTube has on release — while staying tight enough during
  // a drag not to feel laggy.
  private static readonly VR_STIFFNESS = 210;
  private static readonly VR_DAMPING = 17;
  private static readonly VR_FOV_LERP = 0.22; // zoom eases linearly, no bounce
  private static readonly VR_DEFAULT_FOV = 1.2217;
  private static readonly VR_MIN_FOV = 0.5236; // 30° — most zoomed-in
  private static readonly VR_MAX_FOV = 2.0944; // 120° — most zoomed-out


  // Subtitle rendering
  private activeSubtitleCue: SubtitleCue | null = null;
  // Cached text/cue used in the last innerHTML write. renderSubtitles() runs
  // every animation frame; without this guard we re-write innerHTML 60×/sec
  // even when the cue text hasn't changed, restarting the fade-in animation
  // each time and leaving the subtitle perpetually invisible during playback.
  private _lastRenderedSubtitleKey: string = "";
  // Plain text of what's currently on screen — used to find the suffix
  // delta of the next karaoke cue so only the new word fades in, instead
  // of the whole line re-animating each tick.
  private _lastRenderedSubtitlePlain: string = "";
  // Canvas + cached font string used to measure a karaoke cue's full
  // final-sentence width so the line can hold a stable min-width
  // anchor. The font cache is keyed by viewport width because the
  // subtitle font-size uses clamp() against vw.
  private _subtitleMeasureCanvas: HTMLCanvasElement | null = null;
  private _subtitleFontCache: { viewport: number; font: string } | null =
    null;
  // rAF handle that coalesces resize-driven subtitle re-renders. A
  // window drag fires ResizeObserver ~60×/s — running the full layout
  // pass (probe getComputedStyle, canvas measureText, innerHTML rewrite)
  // on every tick burns the main thread enough to stall the
  // presentation loop. One re-render per frame is plenty.
  private _subtitleRerenderRafId: number | null = null;
  private subtitleCues: SubtitleCue[] = [];
  private subtitleOverlay: HTMLElement | null = null;
  private subtitleControlsPadding: number = 0; // Extra padding when controls visible
  // Subtitle delay in seconds. VLC/mpv convention: positive = subs appear
  // later, negative = earlier. Applied at the active-cue check so it works
  // uniformly for text and image subtitles and can be adjusted live without
  // invalidating buffered cues.
  private subtitleDelay: number = 0;

  // Animation state for object-fit transitions
  private currentScaleX: number = 0;
  private currentScaleY: number = 0;
  private lastTargetScaleX: number = 0;
  private lastTargetScaleY: number = 0;
  private fitAnimRafId: number | null = null;

  // Persist last rendered frame for redrawing on resize during pause
  /**
   * We must retain a clone of the last rendered frame because:
   * 1. resizing the canvas clears it (black screen)
   * 2. if paused, frameQueue is likely empty, so we have nothing to redraw
   * 3. we need to redraw the *current* image to restore the view
   */
  private lastRenderedFrame: VideoFrame | null = null;

  constructor(
    canvas: HTMLCanvasElement | OffscreenCanvas,
    subtitleOverlay?: HTMLElement,
  ) {
    this.canvas = canvas;

    // Defer context creation to configure() so we can set the correct color space (sRGB vs P3)
    // Creating it here would lock it to sRGB in most browsers

    // Store subtitle overlay element if provided
    if (subtitleOverlay) {
      this.subtitleOverlay = subtitleOverlay;
    }

    Logger.debug(TAG, "Created");
  }

  private detectHDRColorSpace(
    colorPrimaries?: string,
    colorTransfer?: string,
  ): string {
    // HDR content typically uses BT.2020 primaries with PQ or HLG transfer
    const primaries = (colorPrimaries || "").toLowerCase();
    const transfer = (colorTransfer || "").toLowerCase();

    // Check for HDR indicators
    const isHDRTransfer =
      transfer.includes("pq") || // Perceptual Quantizer (HDR10/Dolby Vision)
      transfer.includes("hlg") || // Hybrid Log-Gamma
      transfer.includes("smpte2084") || // Legacy/FFmpeg PQ
      transfer.includes("arib-std-b67"); // Legacy/FFmpeg HLG

    const isBT2020 =
      primaries.includes("bt2020") || primaries.includes("rec2020");

    if (!this.hdrEnabled) {
      return "srgb";
    }

    if (isHDRTransfer || isBT2020) {
      Logger.info(
        TAG,
        `HDR/BT.2020 content detected (primaries: ${colorPrimaries}, transfer: ${colorTransfer}). Using display-p3 color space (if supported) for HDR.`,
      );
      return "display-p3";
    }

    if (primaries.includes("p3") || primaries.includes("display-p3")) {
      Logger.info(
        TAG,
        `Wide Gamut (P3) content detected. Using display-p3 color space.`,
      );
      return "display-p3";
    }

    return "srgb";
  }

  /**
   * Configure renderer dimensions and color space for HDR support
   */
  configure(
    width: number,
    height: number,
    colorPrimaries?: string,
    colorTransfer?: string,
    frameRate?: number,
    rotation?: number,
    isHDR?: boolean,
    pixelFormat?: string,
  ): void {
    this.isVideoConfigured = true;
    // Detect high bit-depth (12-bit+) content that needs RGBA16F textures
    const pf = (pixelFormat || "").toLowerCase();
    this.isHighBitDepth = pf.includes("12") || pf.includes("14") || pf.includes("16");
    if (this.isHighBitDepth) {
      Logger.info(TAG, `High bit-depth content detected (${pixelFormat}), using RGBA16F texture`);
    }
    // Note: We don't overwrite this.width/height if they've already been set by resize()
    if (this.width === 0 || this.height === 0) {
      this.width = width;
      this.height = height;
      this.canvas.width = width;
      this.canvas.height = height;
    }

    // Set video frame rate
    if (frameRate && frameRate > 0) {
      this.videoFrameRate = frameRate;
      Logger.debug(TAG, `Video frame rate: ${frameRate}fps (target: 60fps)`);
    } else {
      this.videoFrameRate = 60;
    }

    // Set rotation from metadata
    if (rotation !== undefined) {
      this.metadataRotation = rotation;
      this.rotation = (this.metadataRotation + this.manualRotation) % 360;
      if (this.canvas instanceof HTMLCanvasElement) {
        this.canvas.style.transform = `rotate(${this.rotation}deg)`;
        this.canvas.style.transformOrigin = "center center";
      }
      Logger.debug(TAG, `Rotation set to: ${this.rotation}° (metadata: ${this.metadataRotation}°, manual: ${this.manualRotation}°)`);
    }

    // Capture metadata for potential re-config (HDR toggle)
    this.lastPrimaries = colorPrimaries;
    this.lastTransfer = colorTransfer;

    // Evaluate if source is HDR (regardless of current toggle state)
    if (isHDR !== undefined) {
      this.isHDRSource = isHDR;
    } else {
      const primaries = (colorPrimaries || "").toLowerCase();
      const transfer = (colorTransfer || "").toLowerCase();

      Logger.debug(
        TAG,
        `Checking HDR support - Primaries: '${primaries}', Transfer: '${transfer}'`,
      );

      const isHDRTransfer =
        transfer.includes("pq") ||
        transfer.includes("hlg") ||
        transfer.includes("smpte2084") ||
        transfer.includes("arib-std-b67");
      const isBT2020 =
        primaries.includes("bt2020") || primaries.includes("rec2020");
      this.isHDRSource = isHDRTransfer || isBT2020;
    }

    // Detect HDR and get appropriate color space
    const detectedColorSpace = this.detectHDRColorSpace(
      colorPrimaries,
      colorTransfer,
    );

    // Initialize WebGL
    try {
      const contextOptions: WebGLContextAttributes = {
        alpha: false,
        desynchronized: false, // Disabled to prevent flickering on low-end devices
        antialias: false,
        depth: false,
        preserveDrawingBuffer: true, // Might be needed for some HDR scenarios
      };

      this.gl = this.canvas.getContext(
        "webgl2",
        contextOptions,
      ) as WebGL2RenderingContext;

      if (!this.gl) {
        Logger.error(TAG, "WebGL2 not supported");
        return;
      }

      // Configure color space on the GL context (Chrome 104+, Safari 17+).
      // For HDR PQ/HLG sources on Chromium, tag the canvas with
      // rec2100-pq/hlg — Chrome's compositor then sends the buffer to the
      // HDR display at full peak brightness. display-p3 alone is wide-gamut
      // SDR (~100 nits) and tone-maps PQ highlights down, making HDR look
      // dim. The HDR Canvas spec's RGBA16F float buffer (drawingBufferStorage)
      // is NOT required for this — the colorspace tag is independent of the
      // buffer's bit depth. 8-bit PQ has some quantization banding but
      // unlocks the full HDR brightness range, which Ujjwal prefers.
      try {
        const isChromium = !!(window as any).chrome;
        const transferLc = (colorTransfer || "").toLowerCase();
        const isHLGSource =
          transferLc.includes("hlg") || transferLc.includes("arib-std-b67");
        const isHDRPath =
          this.isHDRSource && this.hdrEnabled && isChromium;
        const hdrSpace = isHLGSource ? "rec2100-hlg" : "rec2100-pq";

        // @ts-ignore
        if (this.gl.drawingBufferColorSpace !== undefined) {
          let targetSpace: string;
          if (isHDRPath) {
            targetSpace = hdrSpace;
          } else if (detectedColorSpace !== "srgb") {
            // Wide-gamut SDR or HDR-disabled fallback
            const supportedSpaces = ["srgb", "display-p3"];
            targetSpace = supportedSpaces.includes(detectedColorSpace)
              ? detectedColorSpace
              : "srgb";
          } else {
            targetSpace = "srgb";
          }

          if (targetSpace !== "srgb") {
            // rec2100-pq/hlg is a Chromium extension behind
            // chrome://flags#enable-experimental-web-platform-features
            // (and Chrome version dependent). In practice Chromium does
            // not silently ignore unsupported values — the setter throws.
            // Try the HDR space first; on throw or readback mismatch,
            // fall back to display-p3 (wide-gamut SDR) instead of leaving
            // the canvas on srgb.
            let applied: string | null = null;
            try {
              // @ts-ignore
              this.gl.drawingBufferColorSpace = targetSpace;
              // @ts-ignore
              if (this.gl.drawingBufferColorSpace === targetSpace) {
                applied = targetSpace;
              }
            } catch (_e) {
              // setter threw — flag likely off, fall through to fallback
            }

            if (!applied && isHDRPath) {
              Logger.warn(
                TAG,
                `Browser rejected ${targetSpace}. HDR canvas flag likely disabled — falling back to display-p3.`,
              );
              try {
                // @ts-ignore
                this.gl.drawingBufferColorSpace = "display-p3";
                applied = "display-p3";
              } catch (_e2) {
                applied = null;
              }
            }

            if (applied) {
              // @ts-ignore
              this.gl.unpackColorSpace = applied;
              Logger.info(
                TAG,
                `WebGL drawing buffer color space set to: ${applied} (requested: ${detectedColorSpace}, HDR path: ${isHDRPath})`,
              );
            }
          }
        }
      } catch (e) {
        Logger.warn(
          TAG,
          "Failed to set drawingBufferColorSpace on GL context",
          e,
        );
      }

      this.initWebGL();
      // If 360° was requested before the context existed (e.g. the `vr`
      // attribute), compile the VR program now so the first/poster frame
      // paints in 360 rather than flat.
      if (this.vr360Enabled && !this.vrProgram) {
        this.initVRProgram();
      }
      this.colorSpace = detectedColorSpace;
      Logger.info(
        TAG,
        `Configured WebGL2: ${width}x${height} (colorSpace: ${this.colorSpace})`,
      );
    } catch (error) {
      Logger.error(TAG, "Error configuring WebGL", error);
    }
  }

  private initWebGL() {
    if (!this.gl) return;

    // Detect if browser supports native HDR (drawingBufferColorSpace)
    // Only Chromium-based browsers (Chrome, Edge, Opera, Brave) have working native HDR
    // Use same detection as MoviElement for consistency
    const isChromium = !!(window as any).chrome;

    // For Chromium browsers, we trust the native HDR handling via drawingBufferColorSpace
    // This provides the best quality and color accuracy
    this.hasNativeHDRSupport = isChromium;

    Logger.info(
      TAG,
      `Browser detection: isChromium=${isChromium}, drawingBufferColorSpace=${this.gl.drawingBufferColorSpace !== undefined}, hasNativeHDRSupport=${this.hasNativeHDRSupport}, isHDRSource=${this.isHDRSource}`,
    );

    // Choose initialization based on browser capability:
    // - Chromium browsers: ALWAYS use simple passthrough (native HDR handling via color space)
    // - Non-Chromium with HDR content: use shader-based tone mapping (required for PQ decoding)
    const needsShaderToneMapping =
      !this.hasNativeHDRSupport && this.isHDRSource;

    if (needsShaderToneMapping) {
      Logger.info(
        TAG,
        `Initializing WebGL with shader-based HDR tone mapping (non-Chromium)`,
      );
      this.initWebGLWithHDR();
    } else {
      Logger.info(
        TAG,
        `Initializing WebGL with simple passthrough (Chromium native HDR)`,
      );
      this.initWebGLSimple();
    }
  }

  /**
   * Original simple WebGL initialization for Chromium (native HDR support)
   * This is the exact original configuration that works best for Chromium browsers
   */
  private initWebGLSimple() {
    if (!this.gl) return;
    const gl = this.gl;

    const vsSource = `#version 300 es
    layout(location = 0) in vec2 a_position;
    layout(location = 1) in vec2 a_texCoord;
    out vec2 v_texCoord;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
      v_texCoord = a_texCoord;
    }`;

    const fsSource = `#version 300 es
    precision highp float;
    uniform sampler2D u_image;
    in vec2 v_texCoord;
    out vec4 outColor;
    void main() {
      outColor = texture(u_image, v_texCoord);
    }`;

    // Create Program
    const createShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        Logger.error(TAG, "Shader compile error:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vert = createShader(gl.VERTEX_SHADER, vsSource);
    const frag = createShader(gl.FRAGMENT_SHADER, fsSource);
    if (!vert || !frag) return;

    this.program = gl.createProgram();
    if (!this.program) return;
    gl.attachShader(this.program, vert);
    gl.attachShader(this.program, frag);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      Logger.error(
        TAG,
        "Program link error:",
        gl.getProgramInfoLog(this.program),
      );
      return;
    }

    // Quad mapping:
    // Vertices: (-1,1)=TL, (-1,-1)=BL, (1,1)=TR, (1,-1)=BR
    // UVs: (0,0)=TL, (0,1)=BL, (1,0)=TR, (1,1)=BR
    // This assumes video texture is uploaded with row 0 at top (standard)
    const vertices = new Float32Array([
      -1.0, 1.0, 0.0, 0.0, -1.0, -1.0, 0.0, 1.0, 1.0, 1.0, 1.0, 0.0, 1.0, -1.0,
      1.0, 1.0,
    ]);

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 4 * 4, 0);

    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 4 * 4, 2 * 4);

    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    if (!this.program) return;
    const uImage = gl.getUniformLocation(this.program, "u_image");
    if (uImage && this.program) {
      gl.useProgram(this.program);
      gl.uniform1i(uImage, 0);
    }

  }

  /**
   * WebGL initialization with HDR tone mapping shader for non-Chromium browsers
   * Safari/Firefox need explicit PQ decoding and tone mapping
   */
  private initWebGLWithHDR() {
    if (!this.gl) return;
    const gl = this.gl;

    const vsSource = `#version 300 es
    layout(location = 0) in vec2 a_position;
    layout(location = 1) in vec2 a_texCoord;
    out vec2 v_texCoord;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
      v_texCoord = a_texCoord;
    }`;

    const fsSource = `#version 300 es
    precision highp float;
    uniform sampler2D u_image;
    uniform float u_hdrEnabled; // 0.0 = disabled, 1.0 = enabled
    in vec2 v_texCoord;
    out vec4 outColor;

    // PQ (SMPTE 2084) EOTF constants
    const float m1 = 2610.0 / 16384.0;
    const float m2 = 2523.0 / 4096.0 * 128.0;
    const float c1 = 3424.0 / 4096.0;
    const float c2 = 2413.0 / 4096.0 * 32.0;
    const float c3 = 2392.0 / 4096.0 * 32.0;

    vec3 PQtoLinear(vec3 pq) {
      vec3 colToPow = pow(pq, vec3(1.0 / m2));
      vec3 num = max(colToPow - c1, vec3(0.0));
      vec3 den = c2 - c3 * colToPow;
      return pow(num / den, vec3(1.0 / m1));
    }

    vec3 toneMapReinhard(vec3 hdr, float exposure) {
      vec3 mapped = hdr * exposure;
      return mapped / (1.0 + mapped);
    }

    vec3 adjustSaturation(vec3 color, float saturation) {
      float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
      vec3 gray = vec3(luminance);
      return mix(gray, color, saturation);
    }

    void main() {
      vec4 color = texture(u_image, v_texCoord);

      // Apply PQ EOTF to get linear light
      vec3 linear = PQtoLinear(color.rgb);

      // Tone map to SDR range.
      // Reinhard's x/(1+x) curve gets steep fast — every extra unit of
      // exposure pushes mid-tones harder toward white, which reads as
      // crushed highlights + boosted contrast on most SDR displays.
      // The HDR-on path used to push exposure to 35.0 to "match Chrome
      // native HDR vibrance"; in practice that overshot native, with
      // visible extra contrast vs the <video> tag on the compare page.
      // 26.0 keeps the HDR path noticeably punchier than HDR-off (22.0)
      // without crushing highlights past where Chrome's compositor
      // lands.
      float exposure = mix(22.0, 26.0, u_hdrEnabled);
      vec3 sdr = toneMapReinhard(linear, exposure);

      // Saturation boost. 1.5 read as oversaturated next to native;
      // 1.25 keeps the wide-gamut feel without the cartoonish punch.
      float saturation = mix(1.1, 1.25, u_hdrEnabled);
      sdr = adjustSaturation(sdr, saturation);

      // Apply gamma (2.2 for accurate color reproduction)
      vec3 display = pow(sdr, vec3(1.0/2.2));

      outColor = vec4(display, color.a);
    }`;

    // Create Program
    const createShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        Logger.error(TAG, "Shader compile error:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vert = createShader(gl.VERTEX_SHADER, vsSource);
    const frag = createShader(gl.FRAGMENT_SHADER, fsSource);
    if (!vert || !frag) return;

    this.program = gl.createProgram();
    if (!this.program) return;
    gl.attachShader(this.program, vert);
    gl.attachShader(this.program, frag);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      Logger.error(
        TAG,
        "Program link error:",
        gl.getProgramInfoLog(this.program),
      );
      return;
    }

    // Quad mapping
    const vertices = new Float32Array([
      -1.0, 1.0, 0.0, 0.0, -1.0, -1.0, 0.0, 1.0, 1.0, 1.0, 1.0, 0.0, 1.0, -1.0,
      1.0, 1.0,
    ]);

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 4 * 4, 0);

    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 4 * 4, 2 * 4);

    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    if (!this.program) return;
    gl.useProgram(this.program);

    // Set u_image uniform
    const uImage = gl.getUniformLocation(this.program, "u_image");
    if (uImage) {
      gl.uniform1i(uImage, 0);
    }

    // Set u_hdrEnabled uniform
    const uHdrEnabled = gl.getUniformLocation(this.program, "u_hdrEnabled");
    if (uHdrEnabled) {
      gl.uniform1f(uHdrEnabled, this.hdrEnabled ? 1.0 : 0.0);
      Logger.debug(
        TAG,
        `Set u_hdrEnabled uniform to: ${this.hdrEnabled ? 1.0 : 0.0}`,
      );
    }

  }

  /**
   * Compile the 360° VR program lazily on first use. Reuses the existing
   * fullscreen-quad VAO (location 0 = a_position spans the clip-space quad)
   * and the existing video texture; only this program + its camera uniforms
   * are new. The fragment shader reconstructs a view ray per pixel from the
   * NDC position + camera yaw/pitch/fov, then maps that direction to an
   * equirectangular (longitude/latitude) texture coordinate.
   */
  private initVRProgram(): boolean {
    if (this.vrProgram) return true;
    if (!this.gl) return false;
    const gl = this.gl;

    const vsSource = `#version 300 es
    layout(location = 0) in vec2 a_position;
    out vec2 v_ndc;
    void main() {
      v_ndc = a_position;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }`;

    const fsSource = `#version 300 es
    precision highp float;
    uniform sampler2D u_image;
    uniform float u_yaw;     // radians, look left/right
    uniform float u_pitch;   // radians, look up/down
    uniform float u_fov;     // vertical field of view (radians)
    uniform float u_aspect;  // viewport width / height
    uniform float u_lonDiv;  // longitude span (radians): 2π for 360, π for VR180
    uniform float u_latDiv;  // latitude span (radians), derived from source aspect
    uniform float u_proj;    // 0 = equirectangular, 1 = fisheye, 2 = stereographic
    uniform float u_fishFov; // fisheye coverage (radians), e.g. π for a 180° lens
    uniform float u_uScale;  // eye selection: 1 = full width, 0.5 = one SBS eye
    uniform float u_uOffset; // 0 = left eye, 0.5 = right eye
    uniform float u_planetScale; // stereographic: image radius of the horizon
    uniform float u_srcAspect;   // source frame width/height (keeps the disc round)
    in vec2 v_ndc;
    out vec4 outColor;

    const float PI = 3.14159265358979323846;

    void main() {
      // Camera-space ray: -z forward, scaled by the half-FOV tangent so the
      // vertical FOV matches u_fov and the horizontal FOV follows the aspect.
      float t = tan(u_fov * 0.5);
      vec3 dir = normalize(vec3(v_ndc.x * t * u_aspect, v_ndc.y * t, -1.0));

      // Rotate the ray by pitch (about X), then yaw (about Y).
      float cp = cos(u_pitch), sp = sin(u_pitch);
      dir = vec3(dir.x, cp * dir.y - sp * dir.z, sp * dir.y + cp * dir.z);
      float cy = cos(u_yaw), sy = sin(u_yaw);
      dir = vec3(cy * dir.x + sy * dir.z, dir.y, -sy * dir.x + cy * dir.z);

      // Map the ray to a position inside ONE eye's 0..1 square.
      vec2 eye;
      if (u_proj < 0.5) {
        // Equirectangular: longitude across X, latitude up Y. Spans come from
        // the source so pixels stay square (a 2:1 frame → 180° vertical, etc.).
        float lon = atan(dir.x, -dir.z);
        float lat = asin(clamp(dir.y, -1.0, 1.0));
        eye = vec2(lon / u_lonDiv + 0.5, 0.5 - lat / u_latDiv);
      } else if (u_proj < 1.5) {
        // Equidistant fisheye: angle θ from the forward axis maps to a radius,
        // azimuth φ to the angle around the circle inscribed in the square.
        float theta = acos(clamp(-dir.z, -1.0, 1.0));
        float phi = atan(dir.y, dir.x);
        float r = theta / (u_fishFov * 0.5); // 0 at centre, 1 at the lens edge
        eye = vec2(0.5 + 0.5 * r * cos(phi), 0.5 - 0.5 * r * sin(phi));
      } else {
        // Stereographic "little planet": nadir (straight down) sits at the disc
        // centre, the horizon on a circle and the zenith out toward the rim.
        // Inverse-project: angle a from nadir → image radius r = tan(a/2),
        // azimuth around the vertical axis. Divide x by the source aspect so a
        // disc that's circular in pixels stays circular here.
        float a = acos(clamp(-dir.y, -1.0, 1.0)); // 0 down → π up
        float az = atan(dir.z, dir.x);
        float r = tan(a * 0.5) * u_planetScale;
        // +sin so tilting up samples toward the image top (where the zenith/sky
        // sits in a tiny-planet), keeping the scene right-side up.
        eye = vec2(0.5 + r * cos(az) / u_srcAspect, 0.5 + r * sin(az));
      }

      // Pick the eye half for side-by-side stereo (full width when mono). The
      // camera is clamped to the content and S/T wrap is CLAMP_TO_EDGE, so the
      // edge never shows a black void.
      vec2 uv = vec2(eye.x * u_uScale + u_uOffset, eye.y);
      outColor = texture(u_image, uv);
    }`;

    const createShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        Logger.error(TAG, "VR shader compile error:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vert = createShader(gl.VERTEX_SHADER, vsSource);
    const frag = createShader(gl.FRAGMENT_SHADER, fsSource);
    if (!vert || !frag) return false;

    const program = gl.createProgram();
    if (!program) return false;
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      Logger.error(TAG, "VR program link error:", gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return false;
    }

    this.vrProgram = program;
    this.vrLocs = {
      image: gl.getUniformLocation(program, "u_image"),
      yaw: gl.getUniformLocation(program, "u_yaw"),
      pitch: gl.getUniformLocation(program, "u_pitch"),
      fov: gl.getUniformLocation(program, "u_fov"),
      aspect: gl.getUniformLocation(program, "u_aspect"),
      lonDiv: gl.getUniformLocation(program, "u_lonDiv"),
      latDiv: gl.getUniformLocation(program, "u_latDiv"),
      proj: gl.getUniformLocation(program, "u_proj"),
      fishFov: gl.getUniformLocation(program, "u_fishFov"),
      uScale: gl.getUniformLocation(program, "u_uScale"),
      uOffset: gl.getUniformLocation(program, "u_uOffset"),
      planetScale: gl.getUniformLocation(program, "u_planetScale"),
      srcAspect: gl.getUniformLocation(program, "u_srcAspect"),
    };
    gl.useProgram(program);
    if (this.vrLocs.image) gl.uniform1i(this.vrLocs.image, 0);
    Logger.info(TAG, "VR 360° equirectangular program compiled");
    return true;
  }

  /**
   * Render one frame as a viewed sphere. The texture has already been bound +
   * uploaded by drawFrame; here we only set the full-canvas viewport, switch
   * to the VR program, push the camera uniforms and draw the fullscreen quad.
   * Full 360° wraps horizontally (WRAP_S = REPEAT for a seamless ±180° seam);
   * VR180 covers a single front hemisphere, so it clamps and clips to black.
   */
  private drawVRFrame(gl: WebGL2RenderingContext, frame: VideoFrame): void {
    gl.viewport(0, 0, this.width, this.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Only full 360° equirect wraps horizontally; VR180, fisheye and
    // stereographic all clamp at the edge.
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_WRAP_S,
      this.vrHalf || this.vrStereographic ? gl.CLAMP_TO_EDGE : gl.REPEAT,
    );

    if (frame.displayHeight > 0) {
      this.vrTexAspect = frame.displayWidth / frame.displayHeight;
    }
    // For side-by-side stereo each eye is half the frame width, so the per-eye
    // aspect (what the projection maps) halves.
    const eyeAspect = this.vrStereoSbs
      ? this.vrTexAspect / 2
      : this.vrTexAspect;
    // Equirect: longitude span fixed by coverage (full turn vs hemisphere),
    // latitude span follows the per-eye aspect so pixels stay square.
    const lonDiv = this.vrHalf ? Math.PI : 2 * Math.PI;
    const latDiv = Math.min(Math.PI, lonDiv / eyeAspect);

    gl.useProgram(this.vrProgram);
    gl.bindVertexArray(this.vao);
    const locs = this.vrLocs!;
    if (locs.yaw) gl.uniform1f(locs.yaw, this.vrYaw);
    if (locs.pitch) gl.uniform1f(locs.pitch, this.vrPitch);
    if (locs.fov) gl.uniform1f(locs.fov, this.vrFov);
    if (locs.aspect)
      gl.uniform1f(locs.aspect, this.height > 0 ? this.width / this.height : 1);
    if (locs.lonDiv) gl.uniform1f(locs.lonDiv, lonDiv);
    if (locs.latDiv) gl.uniform1f(locs.latDiv, latDiv);
    const projMode = this.vrStereographic ? 2 : this.vrFisheye ? 1 : 0;
    if (locs.proj) gl.uniform1f(locs.proj, projMode);
    if (locs.fishFov) gl.uniform1f(locs.fishFov, CanvasRenderer.VR_FISHEYE_FOV);
    // Left eye for SBS (scale 0.5, offset 0); full width for mono.
    if (locs.uScale) gl.uniform1f(locs.uScale, this.vrStereoSbs ? 0.5 : 1);
    if (locs.uOffset) gl.uniform1f(locs.uOffset, 0);
    if (locs.planetScale)
      gl.uniform1f(locs.planetScale, CanvasRenderer.VR_PLANET_SCALE);
    if (locs.srcAspect) gl.uniform1f(locs.srcAspect, this.vrTexAspect || 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /**
   * Shared adaptive-DPR paint sampling. Called from both the flat and VR draw
   * paths so 360 playback also benefits from the 2x→1x backbuffer downgrade on
   * GPU-bound devices (360 raycasting is fragment-heavy at 4K).
   */
  private sampleAdaptiveDpr(paintStart: number): void {
    if (this._adaptDprChecked || paintStart <= 0) return;
    const paintDuration = performance.now() - paintStart;
    this._paintSamples.push(paintDuration);
    if (this._paintSamples.length >= CanvasRenderer.PAINT_SAMPLE_COUNT) {
      const sum = this._paintSamples.reduce((a, b) => a + b, 0);
      const avg = sum / this._paintSamples.length;
      if (
        avg > CanvasRenderer.PAINT_THRESHOLD_MS &&
        this._maxDpr > 1 &&
        this.containerWidth > 0 &&
        this.containerHeight > 0
      ) {
        Logger.info(
          TAG,
          `Adaptive DPR: avg paint ${avg.toFixed(1)}ms over ${this._paintSamples.length} frames > ${CanvasRenderer.PAINT_THRESHOLD_MS}ms threshold — capping DPR to 1x`,
        );
        this._maxDpr = 1;
        this.resize(this.containerWidth, this.containerHeight);
      }
      this._adaptDprChecked = true;
      this._paintSamples = [];
    }
  }

  // ───────────────────────── 360° VR public API ─────────────────────────

  /** Turn equirectangular 360° rendering on/off. The intent is stored
   *  unconditionally; the VR program is compiled when GL is ready — which may
   *  be NOW (toggled during playback) or later (the `vr` attribute requests 360
   *  before the first frame/poster has configured the context). configure() and
   *  drawFrame both compile lazily, so an early enable still paints the poster
   *  in 360. Repaints immediately when paused so the toggle is visible. */
  setVR360(enabled: boolean): void {
    if (this.vr360Enabled === enabled) return;
    this.vr360Enabled = enabled;
    if (enabled) {
      // Best-effort compile now; harmless no-op if GL isn't configured yet.
      if (this.gl) this.initVRProgram();
      // Sync targets to current so toggling on never kicks off a stray spring.
      this.vrYawTarget = this.vrYaw;
      this.vrPitchTarget = this.vrPitch;
      this.vrFovTarget = this.vrFov;
      this.vrYawVel = 0;
      this.vrPitchVel = 0;
    } else if (this.gl && this.texture) {
      // Restore CLAMP_TO_EDGE for the flat path when leaving VR.
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
      this.gl.texParameteri(
        this.gl.TEXTURE_2D,
        this.gl.TEXTURE_WRAP_S,
        this.gl.CLAMP_TO_EDGE,
      );
    }
    this.redrawForVR();
    Logger.info(TAG, `360° VR ${enabled ? "enabled" : "disabled"}`);
  }

  isVR360Enabled(): boolean {
    return this.vr360Enabled;
  }

  /**
   * The currently-displayed decoded VideoFrame (or null). Used as a fallback
   * capture source when reading the WebGL canvas back via toDataURL comes out
   * blank — some GPUs return an all-black buffer for hardware-decoded frames
   * even with preserveDrawingBuffer. The frame is owned by the renderer and may
   * be closed on the next present, so consume it synchronously.
   */
  getCurrentFrame(): VideoFrame | null {
    return this.lastRenderedFrame;
  }

  /**
   * Snapshot the live 360° camera + projection so a thumbnail/preview can be
   * reprojected to exactly what the user currently sees. Returns the CURRENT
   * (rendered, post-spring) yaw/pitch/fov — i.e. the on-screen view, not the
   * drag target. Null when 360 is off.
   */
  getVRView(): VRView | null {
    if (!this.vr360Enabled) return null;
    return {
      yaw: this.vrYaw,
      pitch: this.vrPitch,
      fov: this.vrFov,
      aspect: this.height > 0 ? this.width / this.height : 16 / 9,
      half: this.vrHalf,
      fisheye: this.vrFisheye,
      sbs: this.vrStereoSbs,
      stereographic: this.vrStereographic,
      texAspect: this.vrTexAspect,
    };
  }

  /** Choose the VR projection/layout:
   *  - half: false = full 360° equirectangular, true = front-hemisphere (VR180).
   *  - fisheye: true = equidistant fisheye instead of equirectangular.
   *  - stereoSbs: true = side-by-side stereo (render the left eye only).
   *  drawVRFrame reads these. */
  setVRProjection(
    half: boolean,
    fisheye = false,
    stereoSbs = false,
    stereographic = false,
  ): void {
    if (
      this.vrHalf === half &&
      this.vrFisheye === fisheye &&
      this.vrStereoSbs === stereoSbs &&
      this.vrStereographic === stereographic
    ) {
      return;
    }
    const enteringPlanet = stereographic && !this.vrStereographic;
    this.vrHalf = half;
    this.vrFisheye = fisheye;
    this.vrStereoSbs = stereoSbs;
    this.vrStereographic = stereographic;
    if (enteringPlanet) {
      // Open looking down at the planet — the recognisable tiny-planet view.
      // Tilt up to "unwrap" toward the horizon; spin yaw to rotate the world.
      this.vrPitch = this.vrPitchTarget = -1.35; // ~ -77°, mostly down
      this.vrYaw = this.vrYawTarget = 0;
      this.vrPitchVel = this.vrYawVel = 0;
    }
    this.clampVRCamera();
    this.redrawForVR();
  }

  /**
   * Keep the VR180 camera inside the content so no black void is ever shown.
   * The viewport's half-FOV (vertical from u_fov, horizontal via the canvas
   * aspect) is subtracted from the content's angular half-extents to get the
   * yaw/pitch limits, and zoom-out is capped so the viewport can't grow past
   * the content vertically. No-op for full 360° (it covers everything).
   */
  private clampVRCamera(): void {
    if (!this.vrHalf) return;
    // Per-eye aspect (SBS halves the width). Fisheye lenses are a circle in a
    // square eye, so treat them as 1:1 (180° both axes).
    const eyeAspect = this.vrStereoSbs
      ? this.vrTexAspect / 2
      : this.vrTexAspect;
    const lonSpan = Math.PI; // VR180 horizontal coverage = 180°
    const latSpan = this.vrFisheye
      ? Math.PI // fisheye covers ~180° vertically too
      : Math.min(Math.PI, lonSpan / eyeAspect);

    // Cap zoom-out so the vertical FOV never exceeds the content's vertical span.
    const maxFov = Math.min(CanvasRenderer.VR_MAX_FOV, latSpan);
    if (this.vrFovTarget > maxFov) this.vrFovTarget = maxFov;
    if (this.vrFov > maxFov) this.vrFov = maxFov;

    const vpAspect = this.height > 0 ? this.width / this.height : 16 / 9;
    const vHalf = this.vrFov * 0.5;
    const hHalf = Math.atan(Math.tan(vHalf) * vpAspect);
    const maxYaw = Math.max(0, lonSpan * 0.5 - hHalf);
    const maxPitch = Math.max(0, latSpan * 0.5 - vHalf);

    const clampAxis = (
      cur: number,
      tgt: number,
      lim: number,
    ): [number, number, boolean] => {
      const t = Math.max(-lim, Math.min(lim, tgt));
      let c = cur,
        hitEdge = false;
      if (c > lim) {
        c = lim;
        hitEdge = true;
      } else if (c < -lim) {
        c = -lim;
        hitEdge = true;
      }
      return [c, t, hitEdge];
    };

    let hitY: boolean, hitP: boolean;
    [this.vrYaw, this.vrYawTarget, hitY] = clampAxis(
      this.vrYaw,
      this.vrYawTarget,
      maxYaw,
    );
    [this.vrPitch, this.vrPitchTarget, hitP] = clampAxis(
      this.vrPitch,
      this.vrPitchTarget,
      maxPitch,
    );
    if (hitY) this.vrYawVel = 0; // stop the spring overshooting into the void
    if (hitP) this.vrPitchVel = 0;
  }

  /** Pan the camera by a pointer drag. dx/dy are CSS pixels; viewportPx is the
   *  canvas CSS height, so pan speed scales with the current zoom (FOV). Moves
   *  the *target* — the spring eases the rendered view toward it. */
  nudgeVR360(dx: number, dy: number, viewportPx: number): void {
    if (!this.vr360Enabled) return;
    // "Grab the world" convention (YouTube / Street View): dragging right pans
    // the scene right, so the camera rotates left; dragging down reveals the
    // sky, so the camera pitches up. Hence += on both.
    const radPerPx = this.vrFov / Math.max(1, viewportPx);
    this.vrYawTarget += dx * radPerPx;
    this.vrPitchTarget += dy * radPerPx;
    const lim = Math.PI / 2 - 0.01;
    this.vrPitchTarget = Math.max(-lim, Math.min(lim, this.vrPitchTarget));
    this.clampVRCamera();
    this.ensureVRAnimating();
  }

  /** Zoom by adjusting FOV. delta>0 zooms out (e.g. wheel deltaY). Eases. */
  zoomVR360(delta: number): void {
    if (!this.vr360Enabled) return;
    this.vrFovTarget = Math.max(
      CanvasRenderer.VR_MIN_FOV,
      Math.min(CanvasRenderer.VR_MAX_FOV, this.vrFovTarget + delta * 0.0015),
    );
    this.clampVRCamera(); // re-clamp look range — a wider FOV shrinks it
    this.ensureVRAnimating();
  }

  /** Recentre the camera (yaw/pitch 0, default FOV) — animated, not a snap. */
  resetVRView(): void {
    this.vrYawTarget = 0;
    this.vrPitchTarget = 0;
    this.vrFovTarget = CanvasRenderer.VR_DEFAULT_FOV;
    this.clampVRCamera();
    this.ensureVRAnimating();
  }

  /**
   * Advance the camera one tick toward its target: an underdamped spring for
   * yaw/pitch (soft settle/bounce) and a linear ease for FOV. Returns true once
   * everything has effectively converged.
   */
  private stepVRCamera(dt: number): boolean {
    const k = CanvasRenderer.VR_STIFFNESS;
    const c = CanvasRenderer.VR_DAMPING;

    // Yaw spring
    const yawForce = k * (this.vrYawTarget - this.vrYaw) - c * this.vrYawVel;
    this.vrYawVel += yawForce * dt;
    this.vrYaw += this.vrYawVel * dt;

    // Pitch spring
    const pitchForce =
      k * (this.vrPitchTarget - this.vrPitch) - c * this.vrPitchVel;
    this.vrPitchVel += pitchForce * dt;
    this.vrPitch += this.vrPitchVel * dt;

    // FOV — simple linear ease, no overshoot.
    this.vrFov += (this.vrFovTarget - this.vrFov) * CanvasRenderer.VR_FOV_LERP;

    // Keep within the VR180 content (clamps spring overshoot at the edges).
    this.clampVRCamera();

    const settled =
      Math.abs(this.vrYawTarget - this.vrYaw) < 1e-4 &&
      Math.abs(this.vrPitchTarget - this.vrPitch) < 1e-4 &&
      Math.abs(this.vrYawVel) < 1e-3 &&
      Math.abs(this.vrPitchVel) < 1e-3 &&
      Math.abs(this.vrFovTarget - this.vrFov) < 1e-4;
    if (settled) {
      this.vrYaw = this.vrYawTarget;
      this.vrPitch = this.vrPitchTarget;
      this.vrFov = this.vrFovTarget;
      this.vrYawVel = 0;
      this.vrPitchVel = 0;
    }
    return settled;
  }

  /**
   * Drive the camera spring on its own rAF loop while it's unsettled. Steps at
   * a fixed 60Hz dt so the feel is frame-rate independent. During playback the
   * presentation loop already repaints each frame (reading the stepped current
   * values), so this loop only repaints when paused — it never double-draws.
   */
  private ensureVRAnimating(): void {
    if (this.vrAnimRaf !== null) return;
    const tick = () => {
      this.vrAnimRaf = null;
      if (!this.vr360Enabled) return;
      const settled = this.stepVRCamera(1 / 60);
      if (!this.isPlaying && this.lastRenderedFrame) {
        try {
          this.drawFrame(this.lastRenderedFrame, true);
        } catch (e) {
          Logger.debug(TAG, "VR spring redraw skipped", e);
        }
      }
      if (!settled) this.vrAnimRaf = requestAnimationFrame(tick);
    };
    this.vrAnimRaf = requestAnimationFrame(tick);
  }

  /** Repaint the retained frame once (e.g. on toggle) so the change is visible
   *  immediately even while paused. Continuous animation goes through the
   *  spring loop (ensureVRAnimating). */
  private redrawForVR(): void {
    if (this.lastRenderedFrame) {
      try {
        this.drawFrame(this.lastRenderedFrame, true);
      } catch (e) {
        Logger.debug(TAG, "VR redraw skipped", e);
      }
    }
  }

  /**
   * Draw a still image (custom or postertime-generated poster) to the canvas
   * through the normal frame path, so 360° mode projects it like a video frame.
   * A `poster` URL makes the player skip the initial decode, so without this the
   * canvas stays blank in 360 and only the flat <img> overlay shows. Retained as
   * lastRenderedFrame so resize and camera nudges repaint it.
   */
  renderPosterImage(image: CanvasImageSource): void {
    if (!this.gl || !this.program || !this.texture) return;
    let frame: VideoFrame;
    try {
      frame = new VideoFrame(image, { timestamp: 0 });
    } catch (e) {
      Logger.warn(TAG, "Failed to wrap poster image as VideoFrame", e);
      return;
    }
    try {
      this.render(frame);
    } finally {
      frame.close();
    }
  }

  private lastPrimaries?: string;
  private lastTransfer?: string;

  /**
   * Set HDR enabled state
   */
  setHDREnabled(enabled: boolean): void {
    if (this.hdrEnabled === enabled) return;
    this.hdrEnabled = enabled;
    Logger.info(TAG, `HDR manual override set to: ${enabled}`);

    // Re-detect and re-apply color space if gl exists.
    // Mirror configure(): upgrade HDR sources on Chromium to rec2100-pq/hlg so
    // the compositor sends full peak brightness. detectHDRColorSpace() only
    // returns display-p3 (wide-gamut SDR), which would dim the picture.
    const detectedColorSpace = this.detectHDRColorSpace(
      this.lastPrimaries,
      this.lastTransfer,
    );

    if (this.gl && this.gl.drawingBufferColorSpace !== undefined) {
      try {
        const isChromium = !!(window as any).chrome;
        const transferLc = (this.lastTransfer || "").toLowerCase();
        const isHLGSource =
          transferLc.includes("hlg") || transferLc.includes("arib-std-b67");
        const isHDRPath = this.isHDRSource && this.hdrEnabled && isChromium;
        const hdrSpace = isHLGSource ? "rec2100-hlg" : "rec2100-pq";

        let targetSpace: string;
        if (isHDRPath) {
          targetSpace = hdrSpace;
        } else if (detectedColorSpace !== "srgb") {
          const supportedSpaces = ["srgb", "display-p3"];
          targetSpace = supportedSpaces.includes(detectedColorSpace)
            ? detectedColorSpace
            : "srgb";
        } else {
          targetSpace = "srgb";
        }

        // Chromium throws (not silent-ignore) on unsupported rec2100-pq/hlg
        // when the HDR canvas flag is off. Try first, fall back to display-p3.
        let applied: string | null = null;
        try {
          // @ts-ignore
          this.gl.drawingBufferColorSpace = targetSpace;
          // @ts-ignore
          if (this.gl.drawingBufferColorSpace === targetSpace) {
            applied = targetSpace;
          }
        } catch (_e) {
          // setter threw — flag likely off
        }

        if (!applied && isHDRPath) {
          Logger.warn(
            TAG,
            `Browser rejected ${targetSpace} on toggle. HDR canvas flag likely disabled — falling back to display-p3.`,
          );
          try {
            // @ts-ignore
            this.gl.drawingBufferColorSpace = "display-p3";
            applied = "display-p3";
          } catch (_e2) {
            applied = null;
          }
        }

        if (applied) {
          // @ts-ignore
          this.gl.unpackColorSpace = applied;
          this.colorSpace = applied === targetSpace ? detectedColorSpace : applied;
          Logger.info(
            TAG,
            `Updated WebGL color space to ${applied} (detected: ${detectedColorSpace}, HDR path: ${isHDRPath}) following HDR toggle`,
          );
        }
      } catch (e) {
        Logger.warn(TAG, "Failed to update drawingBufferColorSpace on the fly");
      }
    }

    // Update u_hdrEnabled uniform for shader-based tone mapping (non-Chromium browsers)
    if (
      this.gl &&
      this.program &&
      !this.hasNativeHDRSupport &&
      this.isHDRSource
    ) {
      const uHdrEnabled = this.gl.getUniformLocation(
        this.program,
        "u_hdrEnabled",
      );
      if (uHdrEnabled) {
        this.gl.useProgram(this.program);
        this.gl.uniform1f(uHdrEnabled, enabled ? 1.0 : 0.0);
        Logger.debug(
          TAG,
          `Updated u_hdrEnabled uniform to: ${enabled ? 1.0 : 0.0}`,
        );
      }
    }

    // Trigger immediate redraw if paused
    if (!this.isPlaying && this.lastRenderedFrame) {
      this.drawFrame(this.lastRenderedFrame, true);
    }
  }

  /**
   * Check if the current video source supports HDR
   */
  isHDRSupported(): boolean {
    return this.isHDRSource;
  }

  resize(width: number, height: number, fromRotate: boolean = false): void {
    if (width > 0 && height > 0) {
      // Store original container dimensions (only from external resize, not from rotate)
      if (!fromRotate) {
        this.containerWidth = width;
        this.containerHeight = height;
      }

      Logger.debug(
        TAG,
        `Resizing to: ${width}x${height} (Rotation: ${this.rotation}°)`,
      );

      const isRotated90 = this.rotation % 180 !== 0;

      // If rotated 90/270, we swap dimensions
      // The container is WxH. We want the Visual result to be WxH.
      // So the Canvas (pre-rotation) must be HxW.
      // Then rotate(90) turns HxW -> WxH.
      const targetWidth = isRotated90 ? height : width;
      const targetHeight = isRotated90 ? width : height;

      // Backbuffer scales with devicePixelRatio so we don't lose detail
      // when downsampling high-resolution sources (4K/8K). Starts at 2x
      // and adapts down to 1x at runtime if the paint loop measures
      // slow on the actual device — `deviceMemory` and `hardwareConcurrency`
      // are too coarse / unreliable as a-priori signals (rounded to
      // powers of 2, absent on iOS, weak GPU often paired with healthy
      // RAM), so the only honest answer is to measure the device under
      // load. See `_adaptDprIfSlow` in the presentation loop.
      const dpr = Math.min(
        typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
        this._maxDpr,
      );
      const bufferWidth = Math.round(targetWidth * dpr);
      const bufferHeight = Math.round(targetHeight * dpr);

      // Track whether the drawing-buffer actually changed. When the caller
      // resizes with the same dims (e.g. the fit-mode toggle's pre-flip
      // refresh in MoviElement.updateFitMode), we must NOT reset the
      // smoothing state — doing so makes drawFrame snap to the new fit's
      // target on the very first tick, which kills the fit animation.
      const bufferChanged =
        this.width !== bufferWidth || this.height !== bufferHeight;

      this.width = bufferWidth;
      this.height = bufferHeight;
      this.canvas.width = bufferWidth;
      this.canvas.height = bufferHeight;

      // Apply CSS sizing
      if (this.canvas instanceof HTMLCanvasElement) {
        if (isRotated90) {
          // Explicit pixel size is needed to override percentage stretching
          // so the buffer aspect ratio (HxW) is preserved in layout before rotation
          // We use !important to ensure this overrides any fullscreen CSS that forces 100vw/100vh
          // CSS uses logical pixels (targetWidth/Height); backbuffer is dpr-scaled.
          this.canvas.style.setProperty(
            "width",
            `${targetWidth}px`,
            "important",
          );
          this.canvas.style.setProperty(
            "height",
            `${targetHeight}px`,
            "important",
          );

          // Center the rotated element absolutely
          this.canvas.style.position = "absolute";
          this.canvas.style.top = "50%";
          this.canvas.style.left = "50%";
          this.canvas.style.margin = "0";

          // Override conflicting global CSS max-dimensions (like 100vh in fullscreen)
          // When rotated, width/height are swapped, so 'height' might need to exceed '100vh' (to become 100vw visual)
          // BUT only do this for non-contain modes (Cover/Fill/Zoom).
          // If 'contain', we respect the limits to ensure it fits within viewport without overflow logic issues
          if (this.fitMode === "contain") {
            this.canvas.style.setProperty("max-width", "none", "important");
            this.canvas.style.setProperty("max-height", "none", "important");
          }

          // Rotate around center
          this.canvas.style.transform = `translate(-50%, -50%) rotate(${this.rotation}deg)`;
          this.canvas.style.transformOrigin = "center center";
        } else {
          // Restore standard sizing (0° and 180°)
          this.canvas.style.position = "relative";
          this.canvas.style.top = "";
          this.canvas.style.left = "";
          this.canvas.style.margin = "";
          this.canvas.style.setProperty("width", "100%", "important");
          this.canvas.style.setProperty("height", "100%", "important");
          this.canvas.style.setProperty("max-width", "none", "important");
          this.canvas.style.setProperty("max-height", "none", "important");
          this.canvas.style.transformOrigin = "center center";
          this.canvas.style.transform = this.rotation === 180 ? "rotate(180deg)" : "none";
        }
      }

      // Recreate context only if not exists (usually resize just updates viewport in WebGL,
      // but if canvas was reset we might need to check gl)
      // WebGL contexts are robust to resize usually.
      if (!this.gl) {
        // Try to init if missing
        const opts = { alpha: false, desynchronized: false };
        this.gl = this.canvas.getContext(
          "webgl2",
          opts,
        ) as WebGL2RenderingContext;
        this.initWebGL();
      } else {
        // Just need to update viewport during draw
        // Trigger a redraw
      }

      // Immediately redraw without smoothing to avoid black flicker, but
      // only force-snap when the buffer dims genuinely changed. Same-size
      // resizes (fit-mode pre-flip refresh) must keep the existing scale
      // so the next drawFrame can lerp toward the new fit's target.
      try {
        if (bufferChanged) {
          // Reset smoothing state so it doesn't interpolate from old dimensions
          this.currentScaleX = 0;
          this.currentScaleY = 0;

          if (this.frameQueue.length > 0) {
            this.drawFrame(this.frameQueue[0], true);
          } else if (this.lastRenderedFrame) {
            this.drawFrame(this.lastRenderedFrame, true);
          }
        }
      } catch (error) {
        Logger.error(TAG, "Error redrawing frame after resize", error);
      }

      // Update overlay dimensions
      if (this.subtitleOverlay) {
        // The overlay lives in the video's own (pre-rotation) coordinate space
        // and is then rotated to match the video, so captions ride the video's
        // bottom edge and turn with it. For 90°/270° the box is swapped (H×W)
        // and centred in the container so that, once rotated around its centre,
        // it maps back onto the video area.
        const rot = (((this.rotation ?? 0) % 360) + 360) % 360;
        const swapped = rot === 90 || rot === 270;
        const overlayWidth = swapped ? height : width;
        const overlayHeight = swapped ? width : height;

        // Responsive bottom padding is relative to the video's visual height
        // in its own frame (overlayHeight), not the container.
        const bottomPadding =
          CanvasRenderer.computeSubtitleBottomPadding(overlayHeight);

        // Reset overlay positioning to ensure it stays aligned with canvas
        this.subtitleOverlay.style.position = "absolute";
        this.subtitleOverlay.style.right = "auto";
        this.subtitleOverlay.style.bottom = "auto";
        this.subtitleOverlay.style.width = `${overlayWidth}px`;
        this.subtitleOverlay.style.height = `${overlayHeight}px`;
        this.subtitleOverlay.style.left = `${(width - overlayWidth) / 2}px`;
        this.subtitleOverlay.style.top = `${(height - overlayHeight) / 2}px`;
        this.subtitleOverlay.style.margin = "0";
        this.subtitleOverlay.style.padding = "0";
        const effectivePadding = this.subtitleControlsPadding > 0 ? this.subtitleControlsPadding : bottomPadding;
        this.subtitleOverlay.style.paddingBottom = `${effectivePadding}px`;
        this.subtitleOverlay.style.display = "flex";
        this.subtitleOverlay.style.flexDirection = "column";
        this.subtitleOverlay.style.justifyContent = "flex-end";
        this.subtitleOverlay.style.alignItems = "center";
        this.subtitleOverlay.style.transformOrigin = "center center";
        this.subtitleOverlay.style.transform = rot ? `rotate(${rot}deg)` : "none";
        this.subtitleOverlay.style.boxSizing = "border-box";

        // Schedule a re-render so the on-screen subtitle picks up the
        // new dimensions. Coalesce via rAF — a window drag bursts
        // resize events, and re-running the full subtitle layout each
        // tick blocks the main thread long enough to stall the
        // presentation loop (player ends up "stuck" with a running
        // timer once the burst settles).
        if (this.activeSubtitleCue && bufferChanged) {
          this.scheduleSubtitleRerender();
        }
      }
    }
  }

  /**
   * Set letterbox/pillarbox color (for ambient background effect).
   * Color is applied on the next frame draw via clearColor.
   */
  setLetterboxColor(r: number, g: number, b: number): void {
    this.letterboxTarget = [r, g, b];
  }

  /**
   * Set fit mode for canvas rendering
   * - 'contain': Scale to fit while maintaining aspect ratio (default)
   * - 'cover': Scale to cover entire canvas while maintaining aspect ratio (may crop)
   * - 'fill': Stretch to fill entire canvas (may distort aspect ratio)
   */
  setFitMode(mode: "contain" | "cover" | "fill" | "zoom" | "control"): void {
    this.fitMode = mode;
    Logger.debug(TAG, `Fit mode set to: ${mode}`);

    // Update rotation CSS overrides based on new fit mode
    if (this.rotation % 180 !== 0 && this.canvas instanceof HTMLCanvasElement) {
      if (mode === "contain") {
        this.canvas.style.setProperty("max-width", "none", "important");
        this.canvas.style.setProperty("max-height", "none", "important");
      }
    }

    // Re-render last frame to show fit mode change immediately. Cannot gate on
    // !isPlaying — after a seek-to-paused, the presentation loop is still
    // running but no new frames arrive, so the loop alone won't repaint.
    // Drive an RAF loop so drawFrame runs without `force`, letting the scale
    // interpolation animate toward the new target.
    if (this.lastRenderedFrame) {
      this.startFitAnimation();
    }
  }

  private startFitAnimation(): void {
    if (this.fitAnimRafId !== null) return;
    const tick = () => {
      this.fitAnimRafId = null;
      if (!this.lastRenderedFrame) return;
      this.drawFrame(this.lastRenderedFrame, false);
      // Stop once scale has effectively converged (drawFrame snaps within 1e-4)
      const settled =
        Math.abs(this.currentScaleX - this.lastTargetScaleX) < 1e-4 &&
        Math.abs(this.currentScaleY - this.lastTargetScaleY) < 1e-4;
      if (!settled) {
        this.fitAnimRafId = requestAnimationFrame(tick);
      }
    };
    this.fitAnimRafId = requestAnimationFrame(tick);
  }

  /**
   * Set audio time provider for A/V sync
   * Pass null to disable A/V sync and run video independently
   */
  setAudioTimeProvider(
    getAudioTime: (() => number) | null,
    isAudioHealthy?: (() => boolean) | null,
  ): void {
    this.getAudioTime = getAudioTime;
    this._isAudioHealthy = isAudioHealthy || null;
    if (getAudioTime) {
      Logger.debug(TAG, "Audio time provider set");
    } else {
      Logger.debug(
        TAG,
        "Audio time provider disabled - video running independently",
      );
      // Reset sync state when disabling audio
      this.syncedToAudio = false;
    }
  }

  /**
   * Queue a VideoFrame for presentation (instead of immediate render)
   */
  queueFrame(frame: VideoFrame): void {
    // Emergency limit - drop if queue is too full (10x normal size)
    if (this.frameQueue.length >= CanvasRenderer.MAX_FRAME_QUEUE * 10) {
      frame.close();
      Logger.warn(
        TAG,
        `Frame queue overflow, dropping frame. Queue size: ${this.frameQueue.length}`,
      );
      return;
    }

    // For large queues, use binary search insertion for better performance
    const frameTime = frame.timestamp;
    if (this.frameQueue.length > 0) {
      const lastTime = this.frameQueue[this.frameQueue.length - 1].timestamp;
      if (frameTime >= lastTime) {
        // Fast path: frames are usually in order
        this.frameQueue.push(frame);
      } else {
        // Need to insert in order - use binary search for O(log n) insertion
        let left = 0;
        let right = this.frameQueue.length;
        while (left < right) {
          const mid = Math.floor((left + right) / 2);
          if (this.frameQueue[mid].timestamp <= frameTime) {
            left = mid + 1;
          } else {
            right = mid;
          }
        }
        this.frameQueue.splice(left, 0, frame);
      }
    } else {
      this.frameQueue.push(frame);
    }
  }

  /**
   * Render a VideoFrame immediately (for simple cases)
   */
  render(frame: VideoFrame): void {
    this.drawFrame(frame);
    // Retain a clone so paused redraws (resize, fit-mode change via
    // startFitAnimation) have a frame to lerp against. The presentation-
    // loop path stores this on every present; this direct-render path
    // (used by HLSPlayerWrapper) was missing the clone, leaving the
    // fit-mode animation as a hard snap on HLS streams.
    if (this.lastRenderedFrame) this.lastRenderedFrame.close();
    try {
      this.lastRenderedFrame = frame.clone();
    } catch {
      this.lastRenderedFrame = null;
    }
  }

  /**
   * Start the presentation loop for smooth playback
   */
  startPresentationLoop(): void {
    // Audio-only source (no video track configured): nothing to present, and
    // running A/V sync against a non-existent video stream is meaningless. The
    // cover art, if any, is drawn separately via the overlay canvas.
    if (!this.isVideoConfigured) return;
    if (this.rafId !== null) return;

    this.isPlaying = true;
    this.presentationStartTime = performance.now();

    // Only reset timing if we don't have frames (fresh start/seek)
    // If we have queue, we are resuming, so keep last known PTS to avoid jumps
    if (this.frameQueue.length === 0) {
      this.lastPresentedPts = -1;
      this.framesPresented = 0; // Reset frame counter for fresh start
      // Keep presentationStartPts as-is when frameQueue is empty
      // It will sync to audio or first frame time when available
      this.syncedToAudio = false;
    } else {
      // Resuming with frames: reset anchor to last presented time to prevent restart from 0
      if (this.lastPresentedPts >= 0) {
        this.presentationStartPts = this.lastPresentedPts;
      } else {
        this.presentationStartPts = this.frameQueue[0].timestamp / 1_000_000;
      }
      this.syncedToAudio = false;
    }

    this.presentationLoop();
    Logger.debug(TAG, "Presentation loop started");
  }

  /**
   * Stop the presentation loop
   */
  stopPresentationLoop(): void {
    this.isPlaying = false;

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    // NOTE: We do NOT clear the frame queue here anymore.
    // This allows resuming playback instantly without re-buffering.
    // The queue is cleared explicitly via clearQueue() during seek or destroy.

    // Do NOT clear lastRenderedFrame here - we need it for resize during pause

    Logger.debug(TAG, "Presentation loop stopped");
  }

  /**
   * RAF-based presentation loop - presents frames at VSync-aligned times
   * For true 60fps, we present exactly one frame per RAF call when available
   */
  private presentationLoop = (): void => {
    if (!this.isPlaying) {
      this.rafId = null;
      return;
    }

    // Schedule next frame first (ensures consistent timing)
    // This ensures RAF timing is consistent and VSync-aligned
    this.rafId = requestAnimationFrame(this.presentationLoop);

    // Get current playback time with high precision
    let currentPlaybackTime = this.getCurrentPlaybackTime();

    // Startup fix: If we have frames but no time reference, show first frame
    if (
      currentPlaybackTime < 0 &&
      this.lastPresentedPts < 0 &&
      this.frameQueue.length > 0
    ) {
      currentPlaybackTime = 0;
    }

    // For true 60fps, always try to present a frame if available
    // This ensures we maintain frame rate even if timing is slightly off
    if (this.frameQueue.length === 0) {
      // Even if no frames, still update subtitles based on current playback time
      this.updateActiveSubtitle();
      this.renderSubtitles();
      return; // No frames available, wait for next cycle
    }

    // Select the best frame to present
    const frameToPresent = this.selectFrameForPresentation(currentPlaybackTime);

    // For 60fps videos, always present a frame if available to maintain smooth playback
    // If no frame was selected but we have frames, use the first one
    if (
      !frameToPresent &&
      this.videoFrameRate >= 60 &&
      this.frameQueue.length > 0
    ) {
      // For 60fps, present the first available frame to maintain cadence
      const firstFrame = this.frameQueue[0];
      const frameTime = firstFrame.timestamp / 1_000_000;
      const frameInterval = 1.0 / this.videoFrameRate;
      // Reject frames that are too far ahead OR too far behind. Without the
      // upper cap, hardware decoders that emit 8K frames in bursts queue
      // many future-PTS frames; on >60Hz displays this fallback then drains
      // them faster than wall-clock, advancing currentTime past the audio
      // clock and tripping the audio-desync resync seek loop.
      const ahead = frameTime - currentPlaybackTime;
      const behind = currentPlaybackTime - frameTime;
      if (ahead <= frameInterval && behind <= frameInterval * 2) {
        this.drawFrame(firstFrame);

        // Retain for resize redraws
        if (this.lastRenderedFrame) this.lastRenderedFrame.close();
        try {
          this.lastRenderedFrame = firstFrame.clone();
        } catch (e) {
          // Frame closed, ignore
          this.lastRenderedFrame = null;
        }

        firstFrame.close();
        this.frameQueue.shift();
        this.lastPresentedPts = frameTime;
        this.currentTime = frameTime;
        this.framesPresented++;
        return;
      }
    }

    if (frameToPresent) {
      // Draw and close the frame (drawFrame will update currentTime)
      this.drawFrame(frameToPresent);

      // Retain for resize redraws
      if (this.lastRenderedFrame) this.lastRenderedFrame.close();
      try {
        this.lastRenderedFrame = frameToPresent.clone();
      } catch (e) {
        // Frame closed, ignore
        this.lastRenderedFrame = null;
      }

      frameToPresent.close();

      // Remove the frame from queue (it was already selected and kept for drawing)
      const frameIndex = this.frameQueue.findIndex((f) => f === frameToPresent);
      if (frameIndex >= 0) {
        this.frameQueue.splice(frameIndex, 1);
      }
    }

    // Always update and render subtitles based on current playback time
    // This ensures subtitles appear/disappear at the right time even if no new frame is drawn
    this.updateActiveSubtitle();
    this.renderSubtitles();
    // If no new frame is due, keep showing the last frame (canvas holds the image)
    // This is how YouTube handles all frame rates - smooth and natural
  };

  /**
   * Get current playback time using wall clock with loose A/V sync
   * Video runs smoothly on wall clock, with periodic drift correction from audio
   * This ensures smooth 60fps video playback while maintaining A/V sync
   */
  private getCurrentPlaybackTime(): number {
    // When the presentation loop is stopped (player paused), the
    // wall-clock formula below would advance time forever — but no one
    // is consuming frames, so updateActiveSubtitle (called from
    // setSubtitleCues during prefetch / track switches while paused)
    // would pick increasingly-out-of-sync cues and the in-video
    // subtitle would silently swap underneath the user. Return the last
    // actually-presented PTS (or, before the first frame, the anchor
    // pts) so the active cue stays pinned to the visible frame.
    if (!this.isPlaying) {
      if (this.lastPresentedPts >= 0) return this.lastPresentedPts;
      if (this.presentationStartPts > 0) return this.presentationStartPts;
      return -1;
    }
    // Always use wall clock for video timing (smooth 60fps)
    let videoTime = -1;
    if (this.presentationStartTime > 0) {
      const elapsed = (performance.now() - this.presentationStartTime) / 1000;
      videoTime = this.presentationStartPts + elapsed * this.playbackRate;
    }

    // Check audio for drift correction (but don't block video)
    if (this.getAudioTime) {
      const audioTime = this.getAudioTime();
      const isHealthy = this._isAudioHealthy ? this._isAudioHealthy() : true;

      // Track last known audio time for capping video when audio drops out
      if (audioTime >= 0) {
        this.lastKnownAudioTime = audioTime;
      }

      if (audioTime >= 0 && isHealthy) {
        // First sync - initialize wall clock to match audio
        if (!this.syncedToAudio) {
          const drift = videoTime >= 0 ? Math.abs(videoTime - audioTime) : 0;
          const isVeryEarlyPlayback = this.framesPresented <= 3;

          // Reset presentation anchors if:
          // 1. Video hasn't started yet (videoTime < 0), OR
          // 2. Very early playback (≤3 frames) AND drift is significant (>30ms)
          //    This gives Bluetooth audio time to stabilize before hard sync
          // 3. Drift is very large (> 400ms) - critical desync recovery
          if (videoTime < 0 || (isVeryEarlyPlayback && drift > 0.03) || drift > 0.4) {
            this.presentationStartTime = performance.now();
            this.presentationStartPts = audioTime;
            this.syncedToAudio = true;
            Logger.debug(TAG, `Initial A/V sync: audioTime=${audioTime.toFixed(3)}s, framesPresented=${this.framesPresented}, drift=${(drift * 1000).toFixed(0)}ms, early=${isVeryEarlyPlayback}`);
            return audioTime;
          } else {
            // We're already playing, just mark as synced without resetting
            // This prevents stuttering when Bluetooth latency causes audio clock fluctuations
            this.syncedToAudio = true;
            Logger.debug(TAG, `Soft A/V sync (no reset): videoTime=${videoTime.toFixed(3)}s, audioTime=${audioTime.toFixed(3)}s, framesPresented=${this.framesPresented}, drift=${(drift * 1000).toFixed(0)}ms`);
          }
        }

        // High-FPS (≥50fps) at slow speed: aggressive drift correction to prevent
        // video racing ahead of audio due to backpressure-induced audio gaps.
        const isSlowHighFps = this.playbackRate < 0.99 && this.videoFrameRate >= 50;

        if (videoTime >= 0 && this.framesPresented > 30) {
          const drift = videoTime - audioTime;
          const threshold = isSlowHighFps ? 0.05 : 0.15;
          const strength = isSlowHighFps ? 0.5 : 0.25;

          if (Math.abs(drift) > threshold) {
            this.presentationStartPts -= drift * strength;
          }
        }

        const elapsed = (performance.now() - this.presentationStartTime) / 1000;
        return this.presentationStartPts + elapsed * this.playbackRate;
      }
    }

    // High-FPS slow playback: cap video to last known audio time when audio drops
    const isSlowHighFps = this.playbackRate < 0.99 && this.videoFrameRate >= 50;
    if (isSlowHighFps && videoTime >= 0 && this.lastKnownAudioTime >= 0 && this.syncedToAudio) {
      return Math.min(videoTime, this.lastKnownAudioTime + 0.15);
    }
    return videoTime >= 0 ? videoTime : -1;
  }

  /**
   * Select the best frame to present for the current time
   * Uses timestamp-based presentation (like YouTube) - no forced frame repetition
   * Works smoothly for ALL frame rates: 24fps, 30fps, 50fps, 60fps, etc.
   */
  private selectFrameForPresentation(currentTime: number): VideoFrame | null {
    if (this.frameQueue.length === 0) {
      return null;
    }

    const frameInterval = 1.0 / this.videoFrameRate;

    // First frame special case - present immediately.
    if (this.lastPresentedPts < 0 && this.frameQueue.length > 0) {
      // Open-GOP recovery after seek can leave the decoder backing up to an
      // earlier reference frame (e.g. seek to 1067s but the decoder's first
      // usable frame is the GOP keyframe at 1066s). Presenting that as-is
      // makes video play 1-2s behind audio for several seconds. If audio
      // is already ahead, skip stale frames so the first-presented frame
      // is near the current playback position.
      if (this.getAudioTime) {
        const audioTime = this.getAudioTime();
        if (audioTime >= 0) {
          const tolerance = 0.2; // 200ms — beyond this and the lag is visible
          while (this.frameQueue.length > 1) {
            const head = this.frameQueue[0];
            const headSec = head.timestamp / 1_000_000;
            if (headSec < audioTime - tolerance) {
              head.close();
              this.frameQueue.shift();
            } else {
              break;
            }
          }
        }
      }

      const firstFrame = this.frameQueue.shift()!;
      this.lastPresentedPts = firstFrame.timestamp / 1_000_000;
      this.currentTime = this.lastPresentedPts;
      this.framesPresented = 1; // First frame presented

      // Initialize presentation timing
      this.presentationStartTime = performance.now();
      this.presentationStartPts = this.lastPresentedPts;
      this.syncedToAudio = false;

      Logger.debug(
        TAG,
        `First frame: pts=${this.lastPresentedPts.toFixed(3)}s`,
      );
      return firstFrame;
    }

    // FPS Throttling & Memory Optimization
    // If configured FrameRate is low (e.g. < 20fps), we enforce throttling
    // and aggressively drop intermediate frames to save memory (crucial for 4K software decoding)
    if (this.videoFrameRate < 20 && this.lastPresentedPts >= 0) {
      const nextTargetTime = this.lastPresentedPts + frameInterval;

      // If we haven't reached the next target presentation time (with small tolerance)
      if (currentTime < nextTargetTime - 0.05) {
        // Prune the queue: Discard frames that are definitely too early to be useful
        // We only keep frames close to the target time (e.g. within 200ms)
        // This prevents buffering 1GB+ of 4K frames in memory while waiting for the next second
        const keepThreshold = nextTargetTime - 0.2;

        while (this.frameQueue.length > 0) {
          const first = this.frameQueue[0];
          const firstTime = first.timestamp / 1_000_000;

          if (firstTime >= keepThreshold) break;

          // Drop useless frame
          this.frameQueue.shift()?.close();
        }

        // Not time to present yet
        return null;
      }
    }

    // Timestamp-based frame selection (like YouTube)
    // Find the best frame for currentTime - works for ALL frame rates
    let bestFrame: VideoFrame | null = null;
    let bestIndex = -1;

    // After seek, be more permissive to prevent stuttering
    const maxLookAhead = this.justSeeked
      ? frameInterval * 3.0
      : frameInterval * 1.5;

    // Find the latest frame that's due (timestamp <= currentTime + small tolerance)
    // This naturally handles all frame rates without forced repetition
    for (let i = 0; i < this.frameQueue.length; i++) {
      const frame = this.frameQueue[i];
      const frameTime = frame.timestamp / 1_000_000;

      // Frame is due if its timestamp is at or before currentTime (with small tolerance)
      if (frameTime <= currentTime + 0.005) {
        // 5ms tolerance
        bestFrame = frame;
        bestIndex = i;
      } else if (frameTime > currentTime + maxLookAhead) {
        // Stop searching - frames are too far in future
        break;
      }
    }

    // If no frame is due yet, check if we should present an early frame
    // This handles the case where we're slightly behind
    if (!bestFrame && this.frameQueue.length > 0) {
      const firstFrame = this.frameQueue[0];
      const firstFrameTime = firstFrame.timestamp / 1_000_000;

      // If first frame is coming up soon (within one frame interval), present it
      if (firstFrameTime <= currentTime + frameInterval) {
        bestFrame = firstFrame;
        bestIndex = 0;
      }
    }

    // Clear justSeeked flag after we've found a frame
    if (bestFrame) {
      this.justSeeked = false;
    }

    // Drop old frames that are too far behind (more than 2 frame intervals)
    // BUT do not drop the best frame we just found!
    const maxBehind = Math.max(2.0, frameInterval * 2);
    while (this.frameQueue.length > 0) {
      const oldestFrame = this.frameQueue[0];
      const oldestFrameTime = oldestFrame.timestamp / 1_000_000;

      // If this is the frame we want to present, do not prune it
      if (oldestFrame === bestFrame) break;

      if (currentTime - oldestFrameTime > maxBehind) {
        this.frameQueue.shift()?.close();
      } else {
        break;
      }
    }

    // If we found a frame, update tracking and remove old frames
    if (bestFrame && bestIndex >= 0) {
      // Remove all frames up to (but not including) the best one
      if (bestIndex > 0) {
        const removed = this.frameQueue.splice(0, bestIndex);
        for (const f of removed) {
          f.close();
        }
      }

      // Update tracking
      this.lastPresentedPts = bestFrame.timestamp / 1_000_000;
      this.currentTime = this.lastPresentedPts;
      this.framesPresented++;

      return bestFrame;
    }

    // No frame due - just keep showing the last frame (natural hold)
    // This is how YouTube handles it - no forced repetition, just timestamp-based
    return null;
  }

  /**
   * Upload a decoded VideoFrame into the currently-bound 2D texture. Tries
   * RGBA16F for high bit-depth content and falls back to RGBA8 on GL error or
   * exception. Shared by the flat and 360° draw paths.
   */
  private uploadFrameTexture(gl: WebGL2RenderingContext, frame: VideoFrame): void {
    try {
      if (this.isHighBitDepth) {
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA16F,
          gl.RGBA,
          gl.HALF_FLOAT,
          frame,
        );
        // Check for GL error — some VideoFrame formats don't work with RGBA16F
        const err = gl.getError();
        if (err !== gl.NO_ERROR) {
          Logger.warn(TAG, `RGBA16F texImage2D failed (GL error ${err}), falling back to RGBA8`);
          this.isHighBitDepth = false; // Disable for future frames
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame);
        }
      } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame);
      }
    } catch (texError) {
      // If RGBA16F throws, fall back to standard
      Logger.warn(TAG, `texImage2D failed, retrying with RGBA8:`, texError);
      this.isHighBitDepth = false;
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame);
    }
  }

  /**
   * Draw a frame to the canvas
   */
  private drawFrame(frame: VideoFrame, force: boolean = false): void {
    if (!this.gl || !this.program || !this.texture) return;
    const gl = this.gl;
    const paintStart = this._adaptDprChecked ? 0 : performance.now();

    try {
      // Update current time
      this.currentTime = frame.timestamp / 1_000_000;

      // Check if frame is valid (width/height > 0)
      // Attempting to draw a closed frame causes "WebGL: INVALID_OPERATION: texImage2D: can't texture a closed VideoFrame"
      // Explicitly check display dimensions which are 0 on closed frames
      if (frame.displayWidth === 0 || frame.displayHeight === 0) {
        return; // Silently skip closed/invalid frames (normal at EOF)
      }

      const contentWidth = frame.displayWidth;
      const contentHeight = frame.displayHeight;

      // 360° VR fast-path: bind + upload the frame, then render it as a
      // viewed sphere instead of the flat fit/letterbox quad. Compile the VR
      // program here if it wasn't ready when 360 was first requested (e.g. the
      // `vr` attribute enabled it before the context was configured) — drawFrame
      // only runs once GL/program/texture exist, so this compile always lands,
      // and the very first (poster) frame paints in 360.
      if (this.vr360Enabled) {
        if (!this.vrProgram) this.initVRProgram();
        if (this.vrProgram && this.vrLocs) {
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, this.texture);
          this.uploadFrameTexture(gl, frame);
          this.drawVRFrame(gl, frame);
          this.sampleAdaptiveDpr(paintStart);
          return;
        }
      }

      let targetScaleX: number;
      let targetScaleY: number;

      if (this.fitMode === "fill") {
        targetScaleX = this.width / contentWidth;
        targetScaleY = this.height / contentHeight;
      } else {
        let scale: number;
        const containerW = this.width;
        const containerH =
          this.fitMode === "control"
            ? Math.max(0, this.height - 72)
            : this.height;

        if (this.fitMode === "contain" || this.fitMode === "control") {
          scale = Math.min(
            containerW / contentWidth,
            containerH / contentHeight,
          );
        } else if (this.fitMode === "cover") {
          scale = Math.max(
            containerW / contentWidth,
            containerH / contentHeight,
          );
        } else if (this.fitMode === "zoom") {
          scale =
            Math.max(containerW / contentWidth, containerH / contentHeight) *
            1.25;
        } else {
          scale = Math.min(
            containerW / contentWidth,
            containerH / contentHeight,
          );
        }
        targetScaleX = scale;
        targetScaleY = scale;
      }

      this.lastTargetScaleX = targetScaleX;
      this.lastTargetScaleY = targetScaleY;

      if (this.currentScaleX === 0 || this.currentScaleY === 0 || force) {
        this.currentScaleX = targetScaleX;
        this.currentScaleY = targetScaleY;
      } else {
        const factor = 0.15;
        if (Math.abs(targetScaleX - this.currentScaleX) < 0.0001)
          this.currentScaleX = targetScaleX;
        else this.currentScaleX += (targetScaleX - this.currentScaleX) * factor;

        if (Math.abs(targetScaleY - this.currentScaleY) < 0.0001)
          this.currentScaleY = targetScaleY;
        else this.currentScaleY += (targetScaleY - this.currentScaleY) * factor;
      }

      const scaledWidth = contentWidth * this.currentScaleX;
      const scaledHeight = contentHeight * this.currentScaleY;

      const x = (this.width - scaledWidth) / 2;
      const y = (this.height - scaledHeight) / 2;

      // GL Draw steps:
      gl.viewport(0, 0, this.width, this.height);
      // Smooth letterbox color transition (lerp toward target every frame for ~60fps smooth)
      const f = 0.08;
      this.letterboxColor[0] += (this.letterboxTarget[0] - this.letterboxColor[0]) * f;
      this.letterboxColor[1] += (this.letterboxTarget[1] - this.letterboxColor[1]) * f;
      this.letterboxColor[2] += (this.letterboxTarget[2] - this.letterboxColor[2]) * f;
      gl.clearColor(this.letterboxColor[0] / 255, this.letterboxColor[1] / 255, this.letterboxColor[2] / 255, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      // WebGL viewport needs y from bottom
      // CSS y is from top.
      const viewportY = this.height - (y + scaledHeight);
      gl.viewport(x, viewportY, scaledWidth, scaledHeight);

      // Bind texture
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);

      // Log frame format once to diagnose high bit-depth rendering issues
      if (this.isHighBitDepth && !this._loggedFrameFormat) {
        this._loggedFrameFormat = true;
        Logger.info(TAG, `VideoFrame format: ${frame.format}, ${frame.codedWidth}x${frame.codedHeight}, colorSpace: ${JSON.stringify(frame.colorSpace)}`);

        // Diagnostic: check if VideoFrame actually has pixel data by drawing to 2D canvas
        try {
          const testCanvas = new OffscreenCanvas(16, 16);
          const ctx2d = testCanvas.getContext("2d")!;
          ctx2d.drawImage(frame, 0, 0, 16, 16);
          const pixels = ctx2d.getImageData(0, 0, 4, 4).data;
          const nonZero = pixels.some((v: number) => v > 0);
          Logger.info(TAG, `VideoFrame pixel test: ${nonZero ? "HAS DATA" : "ALL BLACK"} (sample: R=${pixels[0]} G=${pixels[1]} B=${pixels[2]} A=${pixels[3]})`);
        } catch (e) {
          Logger.warn(TAG, `VideoFrame pixel test failed:`, e);
        }
      }

      // Upload frame — try RGBA16F for high bit-depth, fallback to RGBA8
      this.uploadFrameTexture(gl, frame);

      gl.useProgram(this.program);
      gl.bindVertexArray(this.vao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // Mirror the just-drawn frame into a 16×16 framebuffer so ambient mode
      // can read average color cheaply. Only the extra draw runs here; the
      // sync readback is deferred until MoviElement asks via readAmbientPixels().
      if (this.ambientEnabled) {
        this._renderAmbientThumbnail();
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "InvalidStateError") {
        return;
      }
      Logger.error(TAG, "WebGL Draw error", error);
    }

    // Adaptive DPR — sample paint duration for the first N frames after
    // playback starts. If the device can't keep paint under ~half a frame
    // budget at 2x DPR, drop to 1x and resize. One-shot.
    this.sampleAdaptiveDpr(paintStart);
  }

  /**
   * Enable the 16×16 ambient mirror render. Cheap: ~256 fragment shader
   * invocations per drawn frame on top of the main draw. Call once when
   * ambient mode turns on; the matching `readAmbientPixels()` returns the
   * latest 16×16 RGBA buffer synchronously and effectively for free.
   */
  enableAmbientMirror(): void {
    if (this.ambientEnabled) return;
    if (!this.gl) return;
    const gl = this.gl;
    const size = CanvasRenderer.AMBIENT_SIZE;

    this.ambientTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.ambientTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    this.ambientFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.ambientFbo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.ambientTex,
      0,
    );
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      Logger.warn(TAG, `Ambient FBO incomplete (0x${status.toString(16)}); ambient mode will see no updates`);
      if (this.ambientTex) gl.deleteTexture(this.ambientTex);
      if (this.ambientFbo) gl.deleteFramebuffer(this.ambientFbo);
      this.ambientTex = null;
      this.ambientFbo = null;
      return;
    }

    this.ambientPixels = new Uint8Array(size * size * 4);
    this.ambientEnabled = true;
  }

  disableAmbientMirror(): void {
    if (!this.ambientEnabled) return;
    const gl = this.gl;
    if (gl) {
      if (this.ambientTex) gl.deleteTexture(this.ambientTex);
      if (this.ambientFbo) gl.deleteFramebuffer(this.ambientFbo);
    }
    this.ambientTex = null;
    this.ambientFbo = null;
    this.ambientPixels = null;
    this.ambientEnabled = false;
  }

  /**
   * Read the latest mirrored frame as a 16×16 RGBA buffer. Synchronous and
   * cheap (256-pixel readPixels). Returns null if ambient mirror isn't
   * enabled or no frame has been drawn yet.
   */
  readAmbientPixels(): Uint8Array | null {
    if (!this.ambientEnabled || !this.gl || !this.ambientFbo || !this.ambientPixels) {
      return null;
    }
    const gl = this.gl;
    const size = CanvasRenderer.AMBIENT_SIZE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.ambientFbo);
    gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, this.ambientPixels);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return this.ambientPixels;
  }

  private _renderAmbientThumbnail(): void {
    if (!this.gl || !this.program || !this.texture || !this.ambientFbo) return;
    const gl = this.gl;
    const size = CanvasRenderer.AMBIENT_SIZE;

    // Re-bind to mirror FBO and redraw the same textured quad full-viewport.
    // GPU downscales 8K → 16×16 in one pass; cost is dominated by the 256
    // fragment shader invocations, not the texture sample. program/vao/
    // texture are still bound from the main drawArrays above this call.
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.ambientFbo);
    gl.viewport(0, 0, size, size);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    // Restore main viewport for any subsequent GL work this tick.
    gl.viewport(0, 0, this.width, this.height);
  }

  /**
   * Set subtitle overlay element (HTML element for better performance)
   */
  setSubtitleOverlay(overlay: HTMLElement | null): void {
    this.subtitleOverlay = overlay;
    Logger.debug(TAG, `Subtitle overlay ${overlay ? "set" : "cleared"}`);
  }

  /**
   * Tag the subtitle overlay with the source format. The styled black
   * backdrop is opt-in and only painted for WebVTT cues — that's the
   * karaoke-paced format from our YouTube proxy where the box reads as
   * a stable anchor for word-by-word reveal.
   *
   * All other formats render plain (text + shadow only):
   *   - Text-based: srt / ass / ssa / ttml — traditional movie subs;
   *     a backdrop reads as noise here.
   *   - Image-based: pgs / dvd / dvb (vobsub, hdmv, dvb_subtitle) —
   *     rendered through the cue.image path, untouched by this class.
   */
  setSubtitleFormat(
    format:
      | "vtt"
      | "srt"
      | "ass"
      | "ssa"
      | "ttml"
      | "pgs"
      | "dvd"
      | "dvb"
      | string
      | null,
  ): void {
    if (!this.subtitleOverlay) return;
    this.subtitleOverlay.classList.toggle(
      "movi-subtitle-format-vtt",
      format === "vtt",
    );
  }

  /**
   * Rotate video by 90 degrees clockwise
   */
  rotate90(): number {
    this.manualRotation = (this.manualRotation + 90) % 360;
    this.rotation = (this.metadataRotation + this.manualRotation) % 360;
    Logger.debug(TAG, `Rotation: ${this.rotation}° (metadata: ${this.metadataRotation}°, manual: ${this.manualRotation}°)`);

    if (this.containerWidth > 0 && this.containerHeight > 0) {
      this.resize(this.containerWidth, this.containerHeight, true);
    }

    return this.manualRotation;
  }

  /**
   * Get manual rotation (user-applied, not metadata)
   */
  getRotation(): number {
    return this.manualRotation;
  }

  /**
   * Set manual rotation to a specific value (for save/restore in PiP)
   */
  setManualRotation(deg: number): void {
    this.manualRotation = deg % 360;
    this.rotation = (this.metadataRotation + this.manualRotation) % 360;
    if (this.containerWidth > 0 && this.containerHeight > 0) {
      this.resize(this.containerWidth, this.containerHeight, true);
    }
  }

  /**
   * Set extra bottom padding for subtitles when controls are visible
   * 0 = use default padding, >0 = use this value instead
   */
  setSubtitleControlsPadding(padding: number): void {
    this.subtitleControlsPadding = padding;
    // Apply immediately if overlay exists
    if (this.subtitleOverlay) {
      if (padding > 0) {
        this.subtitleOverlay.style.paddingBottom = `${padding}px`;
      } else {
        // containerHeight is CSS pixels; this.height is the dpr-scaled
        // backbuffer and would inflate the padding 2× on retina.
        const h = this.containerHeight || 672;
        this.subtitleOverlay.style.paddingBottom =
          `${CanvasRenderer.computeSubtitleBottomPadding(h)}px`;
      }
    }
  }

  /**
   * Set subtitle cues for rendering
   * If cues array is provided, it replaces the current list
   * If a single cue is provided, it's added to the list (maintaining active cues)
   */
  setSubtitleCues(cues: SubtitleCue[]): void {
    Logger.debug(TAG, `Setting subtitle cues: ${cues.length} cue(s)`);
    cues.forEach((cue, i) => {
      if (cue.image) {
        Logger.debug(
          TAG,
          `  Cue ${i}: [IMAGE] ${cue.image.width}x${cue.image.height} at (${cue.position?.x ?? "?"}, ${cue.position?.y ?? "?"}) (${cue.start.toFixed(2)}s - ${cue.end.toFixed(2)}s)`,
        );
      } else {
        Logger.debug(
          TAG,
          `  Cue ${i}: "${cue.text?.substring(0, 50)}..." (${cue.start.toFixed(2)}s - ${cue.end.toFixed(2)}s)`,
        );
      }
    });

    // If multiple cues provided, replace the list (for batch updates)
    // If single cue provided, add it to the list (for incremental updates)
    if (cues.length > 1) {
      // Replace entire list
      this.subtitleCues = [...cues];
    } else if (cues.length === 1) {
      // Add single cue to list, but remove old cues that have already ended
      const newCue = cues[0];
      // Match the offset semantics in updateActiveSubtitle so a positive
      // subtitleDelay doesn't prematurely evict cues whose display window is
      // still in the future.
      const adjustedTime = this.getCurrentPlaybackTime() - this.subtitleDelay;

      // Remove cues that have ended (with some tolerance)
      this.subtitleCues = this.subtitleCues.filter((cue) => {
        // Keep cues that haven't ended yet (with 500ms tolerance for safety)
        return adjustedTime <= cue.end + 0.5;
      });

      // Check if this cue already exists (same start time)
      const existingIndex = this.subtitleCues.findIndex(
        (cue) => Math.abs(cue.start - newCue.start) < 0.01,
      );

      if (existingIndex >= 0) {
        // Replace existing cue with same start time
        this.subtitleCues[existingIndex] = newCue;
      } else {
        // Add new cue
        this.subtitleCues.push(newCue);
      }

      // Sort by start time to ensure correct order
      this.subtitleCues.sort((a, b) => a.start - b.start);
    } else {
      // Empty array - clear all
      this.subtitleCues = [];
    }

    // Update active subtitle immediately
    this.updateActiveSubtitle();
    // Also trigger render to update display
    this.renderSubtitles();
  }

  /**
   * Set subtitle delay in seconds (VLC/mpv convention).
   * Positive value: subtitles appear later than their original timing.
   * Negative value: subtitles appear earlier.
   */
  setSubtitleDelay(seconds: number): void {
    if (!Number.isFinite(seconds)) return;
    if (seconds === this.subtitleDelay) return;
    this.subtitleDelay = seconds;
    Logger.debug(TAG, `Subtitle delay set to ${seconds.toFixed(3)}s`);
    // Re-evaluate the active cue against the new offset and repaint so the
    // user sees the change immediately even when paused.
    this.updateActiveSubtitle();
    this.renderSubtitles();
  }

  /** Get current subtitle delay in seconds. */
  getSubtitleDelay(): number {
    return this.subtitleDelay;
  }

  /**
   * Snapshot every cue currently in the cache as a plain array. Used by
   * the all-cues browser UI; we strip image cues since the browser is
   * text-only.
   */
  getAllCues(): { start: number; end: number; text: string }[] {
    const out: { start: number; end: number; text: string }[] = [];
    for (const cue of this.subtitleCues) {
      const text = cue.text;
      if (typeof text === "string" && text.length > 0) {
        out.push({ start: cue.start, end: cue.end, text });
      }
    }
    return out;
  }

  /**
   * Render image subtitle in HTML overlay
   */
  private renderImageSubtitleInOverlay(cue: SubtitleCue): void {
    if (!this.subtitleOverlay || !cue.image) {
      return;
    }

    try {
      // Create a temporary canvas to convert ImageBitmap to data URL
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = cue.image.width;
      tempCanvas.height = cue.image.height;
      const tempCtx = tempCanvas.getContext("2d");

      if (!tempCtx) {
        Logger.warn(
          TAG,
          "Failed to create temporary canvas context for image subtitle",
        );
        return;
      }

      // Draw ImageBitmap to temporary canvas
      tempCtx.drawImage(cue.image, 0, 0);

      // Convert to data URL
      const dataUrl = tempCanvas.toDataURL("image/png");

      // Use CSS-pixel dimensions of the visible canvas, not the dpr-scaled
      // backbuffer. this.width/height live in buffer space (target × dpr) and
      // sizing the overlay with those values blows it up to 2× on retina,
      // pushing the bottom-anchored flex child off-screen below the canvas.
      // Mirrors the rect-based sizing the text-subtitle path already uses.
      const canvasEl =
        this.canvas instanceof HTMLCanvasElement ? this.canvas : null;
      const rect = canvasEl?.getBoundingClientRect();
      const canvasWidth =
        rect?.width || this.containerWidth || this.width;
      const canvasHeight =
        rect?.height || this.containerHeight || this.height;

      // Scale position based on video dimensions vs subtitle dimensions
      // PGS subtitle positions are typically relative to video resolution (1920x1080, etc.)
      const subtitleVideoWidth = 1920; // Standard PGS subtitle resolution
      const subtitleVideoHeight = 1080;
      const scaleX = canvasWidth / subtitleVideoWidth;
      const scaleY = canvasHeight / subtitleVideoHeight;

      // Honour the user's font-size multiplier from the customize panel.
      // Text subs read --movi-sub-size-mult via CSS; image subs are sized
      // in JS, so we pick the same var off the host's computed style and
      // bake it into the bitmap scale so 150% means a visibly larger cue.
      let userSizeMult = 1;
      if (typeof window !== "undefined" && this.subtitleOverlay) {
        const raw = window
          .getComputedStyle(this.subtitleOverlay)
          .getPropertyValue("--movi-sub-size-mult")
          .trim();
        const parsed = parseFloat(raw);
        if (Number.isFinite(parsed) && parsed > 0) userSizeMult = parsed;
      }

      // baseScale is the geometric mapping from PGS source space (1920x1080)
      // into canvas pixels — this is what positions belong in. uniformScale
      // additionally bakes in the user's font-size multiplier so the bitmap
      // grows/shrinks. Mixing the two would let sizeMult drift the cue's
      // anchor (PGS x is the LEFT edge, so scaling it up shoves the bitmap
      // right of its original centre); keep them separate.
      //
      // PGS bitmaps are authored larger than the corresponding text
      // cue would render at the same player size (BluRay subs target
      // a reading distance / TV viewing context, not the boxed-in
      // browser player). 0.85 dials the rendered bitmap down to
      // visually match the CSS-driven text-subtitle size so toggling
      // between an SRT and a PGS track doesn't make the line jump in
      // size. Only the *display* scale shrinks — positions stay on
      // baseScale, so the cue still lands where the author put it.
      const IMAGE_SUB_DISPLAY_SHRINK = 0.85;
      const baseScale = Math.min(scaleX, scaleY);
      const uniformScale = baseScale * userSizeMult * IMAGE_SUB_DISPLAY_SHRINK;

      // Calculate scaled dimensions preserving aspect ratio
      const scaledWidth = cue.image.width * uniformScale;
      const scaledHeight = cue.image.height * uniformScale;

      // The video content is rendered "contain"-fit inside the canvas, so on
      // an ultrawide window with a 16:9 source the video sits in a centred
      // band with pillarbox bars on the sides (and vice versa for letterbox).
      // PGS coordinates live in the 1920x1080 presentation space — i.e.
      // relative to the video band, not the canvas — so positioned cues
      // need this offset added to land where the author put them. Without
      // it, a centred-in-PGS cue gets glued to the canvas's left third on
      // ultrawide displays.
      const videoOffsetX =
        (canvasWidth - subtitleVideoWidth * baseScale) / 2;
      const videoOffsetY =
        (canvasHeight - subtitleVideoHeight * baseScale) / 2;

      const bottomPadding =
        CanvasRenderer.computeSubtitleBottomPadding(canvasHeight);

      // Position at bottom center (above controls), similar to text subtitles
      // For image subtitles, always position at bottom if no explicit position.
      // When an explicit PGS position is given, anchor on the cue's *centre*
      // in source space so growing the bitmap stays visually centred there.
      let x: number;
      if (cue.position?.x !== undefined) {
        const sourceCentreX =
          (cue.position.x + cue.image.width / 2) * baseScale;
        x = videoOffsetX + sourceCentreX - scaledWidth / 2;
      } else {
        x = (canvasWidth - scaledWidth) / 2;
      }
      let y: number;

      if (cue.position?.y) {
        // Use explicit Y position (anchored on source centre, see x above)
        // but ensure it doesn't go above top.
        const sourceCentreY =
          (cue.position.y + cue.image.height / 2) * baseScale;
        y = videoOffsetY + sourceCentreY - scaledHeight / 2;
        y = Math.max(0, Math.min(y, canvasHeight - scaledHeight));
      } else {
        // Default: Position at bottom with padding above controls (same as text subtitles)
        // Calculate bottom position
        const calculatedBottomY = canvasHeight - scaledHeight - bottomPadding;

        // If image + padding is larger than canvas, position at bottom edge (with minimal padding)
        if (calculatedBottomY < 0) {
          // Image is too large for canvas, position at bottom with minimal 10px padding
          y = Math.max(0, canvasHeight - scaledHeight - 10);
        } else {
          // Normal case: position with proper bottom padding
          y = calculatedBottomY;
        }

        // Final clamp to ensure it's within bounds
        y = Math.max(0, Math.min(y, canvasHeight - scaledHeight));
      }

      // Clamp X position to ensure subtitle stays within canvas bounds
      x = Math.max(0, Math.min(x, canvasWidth - scaledWidth));

      // Set overlay container size to match canvas for proper positioning
      // Override CSS defaults that might interfere
      // The overlay should cover the entire canvas area and not overflow
      // Position overlay at bottom center (above controls), same as text subtitles
      // Rotate the overlay to match the video (same approach as text captions),
      // swapping to the video's own frame dimensions for 90°/270° and centring
      // so it maps back onto the video once rotated.
      const rotImg = (((this.rotation ?? 0) % 360) + 360) % 360;
      const swappedImg = rotImg === 90 || rotImg === 270;
      const ovW = swappedImg ? canvasHeight : canvasWidth;
      const ovH = swappedImg ? canvasWidth : canvasHeight;
      this.subtitleOverlay.style.position = "absolute";
      this.subtitleOverlay.style.right = "auto";
      this.subtitleOverlay.style.bottom = "auto";
      this.subtitleOverlay.style.width = `${ovW}px`;
      this.subtitleOverlay.style.height = `${ovH}px`;
      this.subtitleOverlay.style.left = `${(canvasWidth - ovW) / 2}px`;
      this.subtitleOverlay.style.top = `${(canvasHeight - ovH) / 2}px`;
      this.subtitleOverlay.style.pointerEvents = "none";
      // zIndex controlled by CSS (.movi-subtitle-overlay)
      this.subtitleOverlay.style.transformOrigin = "center center";
      this.subtitleOverlay.style.transform = rotImg ? `rotate(${rotImg}deg)` : "none";
      this.subtitleOverlay.style.display = "flex";
      this.subtitleOverlay.style.flexDirection = "column";
      this.subtitleOverlay.style.justifyContent = "flex-end";
      this.subtitleOverlay.style.alignItems = "center";
      this.subtitleOverlay.style.overflow = "hidden"; // Prevent overflow outside canvas
      this.subtitleOverlay.style.padding = "0";
      const bottomPaddingImg =
        CanvasRenderer.computeSubtitleBottomPadding(ovH);
      const effectivePaddingImg = this.subtitleControlsPadding > 0 ? this.subtitleControlsPadding : bottomPaddingImg;
      this.subtitleOverlay.style.paddingBottom = `${effectivePaddingImg}px`;
      this.subtitleOverlay.style.textAlign = "center";
      this.subtitleOverlay.style.boxSizing = "border-box";
      this.subtitleOverlay.style.margin = "0";

      // Create or update image element (single image element - replace on each update)
      let imgElement = this.subtitleOverlay.querySelector(
        "img.movi-subtitle-image",
      ) as HTMLImageElement;

      Logger.debug(
        TAG,
        `Rendering image subtitle in overlay: ${imgElement ? "img exists" : "creating img"}, x=${x.toFixed(0)}, y=${y.toFixed(0)}, width=${(cue.image.width * scaleX).toFixed(0)}, height=${(cue.image.height * scaleY).toFixed(0)}`,
      );

      if (!imgElement) {
        imgElement = document.createElement("img");
        imgElement.className = "movi-subtitle-image";
        imgElement.style.display = "block";
        imgElement.style.position = "relative"; // Use relative to respect flexbox
        imgElement.style.margin = "0";
        imgElement.style.padding = "0";
        imgElement.style.border = "none";
        imgElement.style.outline = "none";
        this.subtitleOverlay.innerHTML = ""; // Clear any old content
        this.subtitleOverlay.appendChild(imgElement);
      }

      // Don't use absolute positioning - let flexbox handle vertical positioning
      // Flexbox justify-content: flex-end will position it at bottom, paddingBottom will create space above controls
      // For horizontal positioning: use margin or transform
      if (cue.position?.x) {
        // If explicit x position is provided, use margin to offset
        const offsetX = x - (canvasWidth - scaledWidth) / 2;
        imgElement.style.marginLeft = `${offsetX}px`;
        imgElement.style.marginRight = "0";
      } else {
        // Center horizontally
        imgElement.style.marginLeft = "auto";
        imgElement.style.marginRight = "auto";
      }

      // Always update src, dimensions and position
      // Preserve aspect ratio to prevent stretching
      imgElement.src = dataUrl;
      imgElement.style.width = `${scaledWidth}px`;
      imgElement.style.height = `${scaledHeight}px`;
      imgElement.style.maxWidth = `${ovW}px`; // Ensure image doesn't exceed the (rotated) video frame width
      imgElement.style.maxHeight = `${ovH}px`; // Ensure image doesn't exceed the (rotated) video frame height
      imgElement.style.objectFit = "contain"; // Preserve aspect ratio
      imgElement.style.display = "block";
      imgElement.style.visibility = "visible";
      imgElement.style.opacity = "1";

      Logger.debug(
        TAG,
        `Image subtitle rendered: src set, dimensions=${(cue.image.width * scaleX).toFixed(0)}x${(cue.image.height * scaleY).toFixed(0)}, position=(${x.toFixed(0)}, ${y.toFixed(0)})`,
      );
    } catch (error) {
      Logger.error(TAG, "Failed to render image subtitle in overlay", error);
      // Fallback: Render image on canvas if no overlay using BUFFER dimensions
      // Not supported in WebGL mode
      // if (!this.ctx) { ... }
    }
  }

  /**
   * Clear all subtitle cues
   */
  clearSubtitles(): void {
    this.subtitleCues = [];
    this.activeSubtitleCue = null;
    this._lastRenderedSubtitleKey = "";
    this._lastRenderedSubtitlePlain = "";
    // Clear all subtitle elements from overlay if it exists
    if (this.subtitleOverlay) {
      this.subtitleOverlay.innerHTML = "";
    }
  }

  /**
   * Default bottom padding for the subtitle overlay, in CSS pixels. The
   * 60px floor we used to carry was a desktop-era guess at "above the
   * controls bar"; on a 250-pixel-tall embed it pinned the cue 24% up
   * the frame and made small-screen subtitles look like they were
   * floating mid-screen. Scale primarily with overlay height (≈ 8%),
   * cap at 80px on large players, and only floor at a low value so
   * tiny embeds still keep a few pixels of breathing room from the
   * very edge.
   */
  private static computeSubtitleBottomPadding(overlayHeight: number): number {
    if (!Number.isFinite(overlayHeight) || overlayHeight <= 0) return 24;
    return Math.max(Math.min(80, overlayHeight * 0.08), 24);
  }

  /**
   * Coalesce subtitle re-render requests onto a single rAF tick. Used
   * by resize() so a window drag (which bursts ResizeObserver at
   * monitor-refresh rate) re-lays out the on-screen cue at most once
   * per frame instead of dozens of times.
   */
  private scheduleSubtitleRerender(): void {
    if (this._subtitleRerenderRafId !== null) return;
    this._subtitleRerenderRafId = requestAnimationFrame(() => {
      this._subtitleRerenderRafId = null;
      if (!this.activeSubtitleCue) return;
      this._lastRenderedSubtitleKey = "";
      this._subtitleFontCache = null;
      this.renderSubtitles();
    });
  }

  /**
   * Update active subtitle based on current time
   */
  private updateActiveSubtitle(): void {
    // Use getCurrentPlaybackTime() instead of this.currentTime to ensure accurate timing
    // this.currentTime is only updated when frames are drawn, but subtitles need real-time updates
    const currentTime = this.getCurrentPlaybackTime();
    // Apply subtitle delay by shifting the comparison time. Positive delay
    // means subs should appear later, so we match cues against an earlier
    // adjusted time. Cues retain their original PTS in subtitleCues so the
    // offset can be changed mid-playback without re-decoding.
    const adjustedTime = currentTime - this.subtitleDelay;
    const previousCue = this.activeSubtitleCue;
    this.activeSubtitleCue = null;

    // Increased tolerance for subtitle matching:
    // - Start tolerance: 100ms (show subtitle slightly early)
    // - End tolerance: 200ms (keep subtitle visible slightly longer to prevent quick disappearance)
    const startTolerance = 0.1; // 100ms
    const endTolerance = 0.2; // 200ms

    // Find the best matching subtitle (prefer exact match, then closest)
    let bestCue: SubtitleCue | null = null;
    let bestScore = Infinity;

    for (const cue of this.subtitleCues) {
      // Check if current time is within the subtitle's time range (with tolerance)
      const isInRange =
        adjustedTime >= cue.start - startTolerance &&
        adjustedTime <= cue.end + endTolerance;

      if (isInRange) {
        // Calculate a score - prefer cues that are more centered in their time range
        const cueCenter = (cue.start + cue.end) / 2;
        const distanceFromCenter = Math.abs(adjustedTime - cueCenter);
        const score = distanceFromCenter;

        // If this cue is better (closer to center), use it
        if (score < bestScore) {
          bestScore = score;
          bestCue = cue;
        }
      }
    }

    // If we found a matching cue, use it
    if (bestCue) {
      this.activeSubtitleCue = bestCue;
      if (previousCue !== bestCue) {
        if (bestCue.image) {
          Logger.debug(
            TAG,
            `Active subtitle changed at ${currentTime.toFixed(2)}s: [IMAGE] ${bestCue.image.width}x${bestCue.image.height} (${bestCue.start.toFixed(2)}s - ${bestCue.end.toFixed(2)}s)`,
          );
        } else {
          Logger.debug(
            TAG,
            `Active subtitle changed at ${currentTime.toFixed(2)}s: "${bestCue.text?.substring(0, 30)}..." (${bestCue.start.toFixed(2)}s - ${bestCue.end.toFixed(2)}s)`,
          );
        }
      }
    } else if (previousCue) {
      // If no cue matches but we had one before, check if we should keep showing it
      // Keep showing previous cue if we're still within extended tolerance
      const extendedEndTolerance = 0.3; // 300ms extended tolerance
      if (
        adjustedTime >= previousCue.start - startTolerance &&
        adjustedTime <= previousCue.end + extendedEndTolerance
      ) {
        // Keep showing previous cue a bit longer
        this.activeSubtitleCue = previousCue;
      } else {
        if (previousCue.image) {
          Logger.debug(
            TAG,
            `Subtitle cleared at ${currentTime.toFixed(2)}s (was: [IMAGE] ${previousCue.image.width}x${previousCue.image.height} at ${previousCue.start.toFixed(2)}s - ${previousCue.end.toFixed(2)}s)`,
          );
        } else {
          Logger.debug(
            TAG,
            `Subtitle cleared at ${currentTime.toFixed(2)}s (was: "${previousCue.text?.substring(0, 30)}..." at ${previousCue.start.toFixed(2)}s - ${previousCue.end.toFixed(2)}s)`,
          );
        }
      }
    }
  }

  /**
   * Render active subtitle in HTML overlay (preferred) or on canvas (fallback)
   * Note: updateActiveSubtitle() should be called before this method
   */
  private renderSubtitles(): void {
    // Get actual display dimensions (not buffer dimensions) for overlay
    // If rotated 90/270, the buffer dimensions (this.width/height) are swapped relative to the screen
    // Subtitles overlaid via HTML should match the SCREEN/CONTAINER orientation
    const isRotated90 = this.rotation % 180 !== 0;
    const displayWidth = isRotated90 ? this.height : this.width;
    const displayHeight = isRotated90 ? this.width : this.height;

    // Canvas fallback uses the Internal Buffer dimensions (rotated)
    // const bufferWidth = this.width;
    // const bufferHeight = this.height;

    if (!this.activeSubtitleCue) {
      // Clear overlay if no active cue
      if (this.subtitleOverlay) {
        if (this._lastRenderedSubtitleKey !== "") {
          this.subtitleOverlay.textContent = "";
          this.subtitleOverlay.innerHTML = ""; // Clear any image elements too
          this._lastRenderedSubtitleKey = "";
          this._lastRenderedSubtitlePlain = "";
        }
        this.subtitleOverlay.style.display = "none";
      }
      return;
    }

    const cue = this.activeSubtitleCue;

    // Image subtitles: Try HTML overlay first, fallback to canvas
    if (cue.image) {
      if (this.subtitleOverlay) {
        // Render image subtitle in HTML overlay using DISPLAY dimensions
        this.renderImageSubtitleInOverlay(cue);
        return;
      }

      // Fallback: Render image on canvas if no overlay using BUFFER dimensions
      // WebGL 2 does not support drawImage 2D fallback
      return;
    }

    // Text subtitles: Use HTML overlay if available
    if (this.subtitleOverlay) {
      if (!cue.text) {
        this.subtitleOverlay.textContent = "";
        this.subtitleOverlay.style.display = "none";
        return;
      }

      // Size the overlay to the visible canvas rect (CSS pixels), not the
      // internal buffer dimensions. For 4K/8K content the buffer is much
      // larger than the rendered area, and pinning the overlay to buffer
      // pixels parks the subtitle thousands of pixels below the viewport
      // (where the host's overflow:hidden swallows it).
      const canvasEl =
        this.canvas instanceof HTMLCanvasElement ? this.canvas : null;
      const rect = canvasEl?.getBoundingClientRect();
      const overlayW = rect?.width || displayWidth;
      const overlayH = rect?.height || displayHeight;
      // Rotate the caption overlay to ride the video: swap to the video's own
      // frame box for 90°/270° and centre it so, once rotated around its centre,
      // it lands back over the video (see resize() for the same approach). This
      // render path runs ~60×/s and previously forced transform:none, undoing
      // the rotation set on rotate — so the rotation has to be re-applied here.
      const rotTxt = (((this.rotation ?? 0) % 360) + 360) % 360;
      const swappedTxt = rotTxt === 90 || rotTxt === 270;
      const ovTxtW = swappedTxt ? overlayH : overlayW;
      const ovTxtH = swappedTxt ? overlayW : overlayH;
      const bottomPadding =
        CanvasRenderer.computeSubtitleBottomPadding(ovTxtH);

      this.subtitleOverlay.style.position = "absolute";
      this.subtitleOverlay.style.right = "auto";
      this.subtitleOverlay.style.bottom = "auto";
      this.subtitleOverlay.style.width = `${ovTxtW}px`;
      this.subtitleOverlay.style.height = `${ovTxtH}px`;
      this.subtitleOverlay.style.left = `${(overlayW - ovTxtW) / 2}px`;
      this.subtitleOverlay.style.top = `${(overlayH - ovTxtH) / 2}px`;
      this.subtitleOverlay.style.margin = "0";
      this.subtitleOverlay.style.padding = "0";
      const effectivePad = this.subtitleControlsPadding > 0 ? this.subtitleControlsPadding : bottomPadding;
      this.subtitleOverlay.style.paddingBottom = `${effectivePad}px`;
      this.subtitleOverlay.style.transformOrigin = "center center";
      this.subtitleOverlay.style.transform = rotTxt ? `rotate(${rotTxt}deg)` : "none";
      this.subtitleOverlay.style.boxSizing = "border-box";
      this.subtitleOverlay.style.display = "flex";
      this.subtitleOverlay.style.flexDirection = "column";
      this.subtitleOverlay.style.justifyContent = "flex-end";
      // Block stays horizontally centred in the player; text inside the
      // line block flows left → right so the karaoke type-out reads
      // naturally. Existing words don't re-animate (see word-static
      // class) so the gentle re-center as a new word appends is barely
      // perceptible.
      this.subtitleOverlay.style.alignItems = "center";
      this.subtitleOverlay.style.textAlign = "left";
      this.subtitleOverlay.style.pointerEvents = "none";
      // zIndex controlled by CSS (.movi-subtitle-overlay)

      // Skip re-rendering if the same cue text is already on screen — the
      // presentation loop calls renderSubtitles() ~60×/sec, and overwriting
      // innerHTML each tick recreates DOM nodes (restarting the
      // movi-subtitle-fade keyframes in a tight loop). Result: subtitle
      // never finishes fading in during playback and only becomes visible
      // when the loop pauses.
      const renderKey = `${cue.start.toFixed(3)}|${cue.text}`;
      if (renderKey === this._lastRenderedSubtitleKey) {
        return;
      }
      this._lastRenderedSubtitleKey = renderKey;

      // Karaoke cues from the proxy embed the FULL final sentence after
      // a `⟨⟨GHOST⟩⟩` delimiter. Only the *visible* portion goes into
      // the DOM — the full sentence's width is measured offscreen via a
      // 2D canvas and applied as `min-width` on the line. This anchors
      // the box at full-sentence width from cue #1 without putting any
      // ghost text into the DOM where it could leak through.
      const KARAOKE_DELIM = "⟨⟨GHOST⟩⟩";
      const delimIdx = cue.text.indexOf(KARAOKE_DELIM);
      const visibleText =
        delimIdx >= 0 ? cue.text.slice(0, delimIdx) : cue.text;
      const renderText =
        delimIdx >= 0
          ? cue.text.slice(delimIdx + KARAOKE_DELIM.length)
          : cue.text;

      // Resolve the line's actual font (clamp() depends on viewport)
      // by reading computed style off a temporary probe in the shadow
      // root. Cached per-render-pass via `_subtitleFontCache`.
      const fontSig = (() => {
        const cached = this._subtitleFontCache;
        if (cached && cached.viewport === window.innerWidth) {
          return cached.font;
        }
        const probe = document.createElement("div");
        probe.className = "movi-subtitle-line";
        probe.style.position = "absolute";
        probe.style.left = "-99999px";
        probe.style.top = "-99999px";
        probe.style.visibility = "hidden";
        probe.textContent = "M";
        this.subtitleOverlay.parentNode?.appendChild(probe);
        const cs = window.getComputedStyle(probe);
        const f = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        probe.remove();
        this._subtitleFontCache = {
          viewport: window.innerWidth,
          font: f,
        };
        return f;
      })();

      // Walk forward through the cue list to find the longest cumulative
      // extension of the current cue's text — covers normal WebVTT
      // karaoke streams (no GHOST delimiter) where each subsequent cue
      // simply adds more words. Without this lookahead the box would
      // grow with every word reveal; with it, the box is sized to the
      // final sentence from cue #1.
      const stripGhost = (t: string) => {
        const idx = t.indexOf(KARAOKE_DELIM);
        return idx >= 0 ? t.slice(0, idx) : t;
      };
      let ultimateText = renderText;
      const activeIndex = this.subtitleCues.indexOf(this.activeSubtitleCue);
      if (activeIndex >= 0) {
        let chainTail = visibleText;
        for (let i = activeIndex + 1; i < this.subtitleCues.length; i++) {
          const next = this.subtitleCues[i];
          if (!next?.text) break;
          const nextVisible = stripGhost(next.text);
          if (
            nextVisible.length > chainTail.length &&
            nextVisible.startsWith(chainTail)
          ) {
            chainTail = nextVisible;
            // Prefer the GHOST-resolved variant if the next cue carries
            // its own GHOST tail (longer than the visible portion).
            ultimateText =
              next.text.length > nextVisible.length ? next.text : nextVisible;
          } else if (!nextVisible.startsWith(chainTail)) {
            break; // chain ended — different sentence starts here
          }
        }
      }

      // Measure the FULL final sentence's width once (per ultimateText),
      // so the line can be sized to it from the very first cue. Strip
      // any HTML formatting tags first — they don't affect width
      // meaningfully for sans-serif at this size.
      // For multi-line SRT cues we take the WIDEST line, not the
      // joined-line width. Joining "You've turned this house\ninto a
      // tomb of her memorial." into one line measures ~600px and
      // calibrates the anchor padding-left for that imaginary single
      // line — but the actual block hugs the widest *real* line
      // (~330px), so the block ends up left-shifted in the player.
      // Per-line max gives the correct anchor offset; karaoke cues
      // (typically no \n) collapse to the same single measurement.
      const plainFull = stripGhost(ultimateText).replace(/<[^>]*>/g, "");
      const measureCanvas = (this._subtitleMeasureCanvas ||=
        document.createElement("canvas"));
      const mctx = measureCanvas.getContext("2d");
      let fullWidth = 0;
      if (mctx) {
        mctx.font = fontSig;
        for (const ln of plainFull.split("\n")) {
          const w = Math.ceil(mctx.measureText(ln).width);
          if (w > fullWidth) fullWidth = w;
        }
      }

      // Update HTML overlay with subtitle text
      // Split full (renderable) text into lines and create HTML
      const lines = visibleText.split("\n");
      // Word index across all lines of this cue; drives staggered
      // typing-style reveal via per-word animation-delay.
      let wordIdx = 0;
      // Word-count split point: the first N tokens of the new cue match
      // what's already on screen (karaoke cumulative growth). Render those
      // statically and animate only the suffix — otherwise the whole line
      // re-fades on every word and looks flickery.
      const previousPlain = this._lastRenderedSubtitlePlain;
      const isCumulativeGrowth =
        !!previousPlain &&
        visibleText.startsWith(previousPlain) &&
        visibleText.length > previousPlain.length;
      const staticWordCount = isCumulativeGrowth
        ? previousPlain.split(/\s+/).filter(Boolean).length
        : 0;
      this._lastRenderedSubtitlePlain = visibleText;
      let cumulativeWordCount = 0;
      const linesHtml = lines
        .map((line) => {
          // Allow safe HTML formatting tags (<i>, <b>, <u>, <font>) while escaping other content
          // First, protect safe formatting tags by replacing them with placeholders
          const placeholders: string[] = [];
          // YouTube's WebVTT for auto-captions often arrives with text
          // chars already entity-encoded (e.g. ">>" written as the
          // literal "&gt;&gt;" speaker-change indicator). Without
          // decoding first, our own escape pass below would double-
          // encode the leading "&" to "&amp;", and the browser would
          // render the entity name as text instead of the character.
          let textWithPlaceholders = line
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#0?39;/g, "'")
            .replace(/&#x27;/g, "'")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&"); // amp last so the rest don't double-decode

          // Protect <i> tags
          textWithPlaceholders = textWithPlaceholders.replace(
            /<(\/?)i>/gi,
            (matched) => {
              const id = placeholders.length;
              placeholders.push(matched);
              return `__PLACEHOLDER_${id}__`;
            },
          );

          // Protect <b> tags
          textWithPlaceholders = textWithPlaceholders.replace(
            /<(\/?)b>/gi,
            (match) => {
              const id = placeholders.length;
              placeholders.push(match);
              return `__PLACEHOLDER_${id}__`;
            },
          );

          // Protect <u> tags
          textWithPlaceholders = textWithPlaceholders.replace(
            /<(\/?)u>/gi,
            (match) => {
              const id = placeholders.length;
              placeholders.push(match);
              return `__PLACEHOLDER_${id}__`;
            },
          );

          // Protect <font color="..."> tags
          textWithPlaceholders = textWithPlaceholders.replace(
            /<font\s+color=["']?([^"']+)["']?>/gi,
            (_match, color) => {
              const id = placeholders.length;
              placeholders.push(`<font color="${color}">`);
              return `__PLACEHOLDER_${id}__`;
            },
          );

          // Protect </font> tags
          textWithPlaceholders = textWithPlaceholders.replace(
            /<\/font>/gi,
            () => {
              const id = placeholders.length;
              placeholders.push("</font>");
              return `__PLACEHOLDER_${id}__`;
            },
          );

          // Now escape all remaining HTML
          let escaped = textWithPlaceholders
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

          // Restore protected formatting tags
          placeholders.forEach((placeholder, index) => {
            escaped = escaped.replace(`__PLACEHOLDER_${index}__`, placeholder);
          });

          // Tokenize on whitespace. YouTube auto-CC sprinkles formatting
          // tags (`<i>`, `<b>`, `<font>`) around words; after escaping
          // these survive in some tokens. Tokens that contain ONLY tags
          // (no real text) shouldn't get their own `<span>` — that would
          // render an empty inline-block which still triggers the
          // surrounding inter-element whitespace, producing visible gaps
          // between adjacent words. We fold tag-only tokens into the
          // adjacent real-word token so the styling is preserved without
          // creating an empty span between words.
          const rawTokens = escaped.split(/(\s+)/).filter(Boolean);
          const isWhitespace = (t: string) => /^\s+$/.test(t);
          const isTagOnly = (t: string) =>
            !!t && !t.replace(/<[^>]*>/g, "").trim();

          // Forward-merge orphan opening tags into the next real word.
          // Walk the tokens once, accumulate any tag-only token seen,
          // attach it as a prefix to the next real word.
          type Tok = { kind: "word" | "ws"; text: string };
          const merged: Tok[] = [];
          let pendingPrefix = "";
          for (const t of rawTokens) {
            if (isWhitespace(t)) {
              if (pendingPrefix) {
                // Whitespace between pending opening-tag glob and the
                // next word — drop it; the tag should hug the word it
                // styles, not introduce its own gap.
                continue;
              }
              merged.push({ kind: "ws", text: t });
              continue;
            }
            if (isTagOnly(t)) {
              pendingPrefix += t;
              continue;
            }
            merged.push({ kind: "word", text: pendingPrefix + t });
            pendingPrefix = "";
          }
          // Trailing closing tags glue onto the last word so styling
          // wraps correctly.
          if (pendingPrefix && merged.length) {
            const last = merged[merged.length - 1];
            if (last.kind === "word") last.text = last.text + pendingPrefix;
          }

          // Split tokens into 2 inline groups: STATIC (already on screen
          // from the previous cue) and NEW (the diff this cue introduces).
          // No ghost span — the line's width is locked via `min-width`
          // computed from a canvas measurement of the full sentence, so
          // there is *no* trailing text in the DOM that could leak out.
          const staticParts: string[] = [];
          const newParts: string[] = [];
          for (const tok of merged) {
            const groupForCount = (count: number) =>
              count < staticWordCount ? staticParts : newParts;
            if (tok.kind === "ws") {
              const target = groupForCount(cumulativeWordCount);
              if (
                target === staticParts &&
                staticParts.length === 0 &&
                cumulativeWordCount === 0
              ) {
                continue;
              }
              target.push(tok.text);
              continue;
            }
            const target = groupForCount(cumulativeWordCount);
            if (
              target === newParts &&
              newParts.length === 0 &&
              staticParts.length > 0
            ) {
              const lastStatic = staticParts[staticParts.length - 1];
              if (!/\s$/.test(lastStatic)) staticParts.push(" ");
            }
            target.push(tok.text);
            cumulativeWordCount += 1;
          }

          wordIdx += 1;

          const staticHtml = staticParts.join("").replace(/\s+$/, " ");
          const newHtml = newParts.join("");

          // The min-width anchor lives on the outer .movi-subtitle-block
          // wrapper now, so individual lines just hug their content (and
          // expand to the wrapper's width because they're block-level).
          const lineParts: string[] = [
            `<div class="movi-subtitle-line">`,
          ];
          if (staticHtml)
            lineParts.push(
              `<span class="movi-subtitle-static">${staticHtml}</span>`,
            );
          if (newHtml)
            lineParts.push(
              `<span class="movi-subtitle-new">${newHtml}</span>`,
            );
          lineParts.push(`</div>`);
          return lineParts.join("");
        })
        .join("");

      // Layout:
      //   .anchor  — full-width container.
      //              When the full sentence FITS in the player's usable
      //              width (≤ 92% of overlay), we left-anchor it via
      //              padding-left so karaoke types in from a stable
      //              left edge. When the sentence is WIDER than the
      //              player (large user font, narrow embed), we fall
      //              back to text-align:center so the block stays
      //              centred and doesn't clip the right edge.
      //   .block   — inline-block backdrop (single rounded rectangle)
      //              that hugs the widest visible line.
      //   .line    — plain text row, no own background.
      const overlayPxW = parseFloat(this.subtitleOverlay.style.width) || 0;
      const usableW = overlayPxW * 0.92; // matches .movi-subtitle-block max-width
      const fitsInPlayer =
        overlayPxW > 0 && fullWidth > 0 && fullWidth <= usableW;
      const leftPad = fitsInPlayer
        ? Math.max(0, Math.floor((overlayPxW - fullWidth) / 2))
        : 0;
      const anchorStyle = fitsInPlayer
        ? leftPad > 0
          ? ` style="padding-left:${leftPad}px"`
          : ""
        : ` style="text-align:center"`;
      this.subtitleOverlay.innerHTML =
        `<div class="movi-subtitle-anchor"${anchorStyle}>` +
        `<div class="movi-subtitle-block">${linesHtml}</div>` +
        `</div>`;

      return;
    }

    // Fallback to canvas rendering for text if no overlay element
    // Not supported in WebGL mode without texture atlas or overlay
    // The preferred method is HTML overlay managed above
    return;
  }

  /**
   * Set playback rate
   */
  setPlaybackRate(rate: number): void {
    const currentTime = this.getCurrentPlaybackTime();
    this.playbackRate = Math.max(0.25, Math.min(4, rate));

    // Always update presentation anchors when playback rate changes
    // This ensures video timing is recalculated with the new rate
    if (this.presentationStartTime > 0) {
      this.presentationStartTime = performance.now();
      this.presentationStartPts = currentTime;
    }

    // Mark as not synced so we can re-sync to audio with new rate
    this.syncedToAudio = false;
  }

  /**
   * Get current time
   */
  getCurrentTime(): number {
    return this.currentTime;
  }

  /**
   * Check if frames are queued
   */
  hasQueuedFrames(): boolean {
    return this.frameQueue.length > 0;
  }

  /**
   * Get frame queue size
   */
  getQueueSize(): number {
    return this.frameQueue.length;
  }

  /**
   * Timestamp (seconds) of the oldest frame still queued for presentation,
   * or -1 when the queue is empty. Used at EOF to tell whether the residual
   * frames are an unpresentable tail (PTS past the audio playout head, which
   * caps the clock) vs. frames that are still genuinely due.
   */
  getHeadFrameTime(): number {
    if (this.frameQueue.length === 0) return -1;
    return this.frameQueue[0].timestamp / 1_000_000;
  }

  /**
   * Get video rendering stats for nerd stats overlay
   */
  getStats(): { framesPresented: number; frameQueueSize: number; colorSpace: string; resolution: string; syncedToAudio: boolean } {
    return {
      framesPresented: this.framesPresented,
      frameQueueSize: this.frameQueue.length,
      colorSpace: this.colorSpace,
      resolution: this.width > 0 ? `${this.width}x${this.height}` : "N/A",
      syncedToAudio: this.syncedToAudio,
    };
  }

  /**
   * Drop frames whose pts is more than `toleranceSec` behind `targetTimeSec`.
   * Used on resume from pause to discard frames that became stale while the
   * audio clock advanced (e.g. mid-decode-warmup when the user fullscreens or
   * toggles tracks, causing the queue to retain pre-resume frames).
   * Returns the number of frames dropped.
   */
  dropStaleFrames(targetTimeSec: number, toleranceSec: number = 0.2): number {
    let dropped = 0;
    while (this.frameQueue.length > 0) {
      const frame = this.frameQueue[0];
      const frameTime = frame.timestamp / 1_000_000;
      if (frameTime < targetTimeSec - toleranceSec) {
        frame.close();
        this.frameQueue.shift();
        dropped++;
      } else {
        break;
      }
    }
    if (dropped > 0) {
      // Reset presentation anchors so the next surviving frame starts cleanly
      // against the new clock position.
      this.presentationStartTime = 0;
      this.presentationStartPts = 0;
      this.lastPresentedPts = -1;
      this.syncedToAudio = false;
      Logger.debug(
        TAG,
        `Dropped ${dropped} stale frames before ${targetTimeSec.toFixed(3)}s (tolerance ${toleranceSec.toFixed(2)}s)`,
      );
    }
    return dropped;
  }

  /**
   * Clear frame queue (useful for seek operations)
   * Resets all presentation timing to prevent stuttering after seek
   */
  clearQueue(): void {
    for (const frame of this.frameQueue) {
      frame.close();
    }
    this.frameQueue = [];
    this.lastPresentedPts = -1;
    this.syncedToAudio = false;
    this.lastKnownAudioTime = -1;
    this.framesPresented = 0; // Reset frame counter

    // Reset presentation timing to prevent stuttering after seek
    // This ensures the next frame after seek starts with fresh timing
    this.presentationStartTime = 0;
    this.presentationStartPts = 0;

    // Mark that we just seeked - this will make frame selection more forgiving
    this.justSeeked = true;

    Logger.debug(TAG, "Frame queue cleared and presentation timing reset");
  }

  /**
   * Render an ImageBitmap
   */
  renderBitmap(_bitmap: ImageBitmap): void {
    // Not implemented for WebGL adapter yet
    // Could upload as texture if needed
  }

  /**
   * Clear the canvas
   */
  clear(): void {
    if (!this.gl) return;
    this.gl.clearColor(0, 0, 0, 1);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  /**
   * Fill with black
   */
  fillBlack(): void {
    this.clear();
  }

  /**
   * Get canvas element
   */
  getCanvas(): HTMLCanvasElement | OffscreenCanvas {
    return this.canvas;
  }

  /**
   * Destroy renderer
   */
  destroy(): void {
    this.stopPresentationLoop();
    if (this.vrAnimRaf !== null) {
      cancelAnimationFrame(this.vrAnimRaf);
      this.vrAnimRaf = null;
    }

    // Clear retained frame on destroy
    if (this.lastRenderedFrame) {
      this.lastRenderedFrame.close();
      this.lastRenderedFrame = null;
    }

    this.clear();
    if (this.gl) {
      if (this.texture) this.gl.deleteTexture(this.texture);
      if (this.program) this.gl.deleteProgram(this.program);
      if (this.vrProgram) this.gl.deleteProgram(this.vrProgram);
      // Extensions etc
      // WebGL2 contexts are garbage collected but good to delete resources
    }
    this.gl = null;
    Logger.debug(TAG, "Destroyed");
  }
}
