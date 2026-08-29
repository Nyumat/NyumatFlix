/**
 * ThumbnailRenderer - WebGL2-based thumbnail rendering with HDR support
 * Uses browser-specific rendering paths for optimal quality:
 * - Chromium: Native HDR via drawingBufferColorSpace
 * - Non-Chromium: Shader-based PQ tone mapping
 */

import { CodecParser } from "../decode/CodecParser";
import { MoviVideoDecoder } from "../decode/VideoDecoder";
import { Logger } from "./Logger";
import type { VRView } from "../render/CanvasRenderer";

const TAG = "ThumbnailRenderer";

export interface ThumbnailRenderOptions {
  width: number;
  height: number;
  rotation?: number;
  colorPrimaries?: string;
  colorTransfer?: string;
  hdrEnabled?: boolean;
}

export class ThumbnailRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private texture: WebGLTexture | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private rotation: number = 0;

  // 360° preview reprojection. When _vrView is set, draw() reprojects the
  // equirectangular texture to the current viewing angle (mirrors
  // CanvasRenderer's VR shader) instead of the flat passthrough. Its own
  // program + unrotated fullscreen quad; compiled lazily on first 360 preview.
  private vrProgram: WebGLProgram | null = null;
  private vrVao: WebGLVertexArrayObject | null = null;
  private vrLocs: Record<string, WebGLUniformLocation | null> | null = null;
  private vrView: VRView | null = null;
  // The flat (source-sized) canvas dimensions from initialize(), restored when
  // a preview flips back to the flat path after a 360 draw resized the canvas.
  private flatWidth: number = 0;
  private flatHeight: number = 0;
  private static readonly VR_PREVIEW_HEIGHT = 256;
  private static readonly VR_FISHEYE_FOV = Math.PI;
  private static readonly VR_PLANET_SCALE = 0.5;

  // WebCodecs support
  private decoder: VideoDecoder | null = null;
  private pendingDecodeResolve: ((success: boolean) => void) | null = null;
  // Last successful decoder config args, kept so a dead/closed WebCodecs
  // decoder can be recreated on the fly instead of disabling thumbnails for
  // the rest of the session (configureDecoder is only ever called once, from
  // initPreviewPipeline, which early-returns on a second source).
  private lastDecoderConfig: {
    codec: string;
    extradata: Uint8Array | null;
    width: number;
    height: number;
    profile?: number;
    level?: number;
  } | null = null;
  // True after we recreate a dead decoder but before any decode has succeeded
  // on the new instance. Blocks a second recreate so a single permanently-bad
  // packet (decode → die → recreate → same packet → die …) can't spin the
  // decoder forever. Cleared on the first successful decode; the next dead
  // event (a different packet, or this one once it's no longer being retried)
  // is then free to recreate again.
  private decoderRevivedUnproven: boolean = false;

  private hasNativeHDRSupport: boolean = false;
  private isHDRSource: boolean = false;
  private isAnnexBSource: boolean = false;
  private hdrEnabled: boolean = true;
  private lastColorPrimaries?: string;
  private lastColorTransfer?: string;

  constructor() {
    this.canvas = document.createElement("canvas");
  }

  /**
   * Detect if browser supports native HDR (Chromium-based)
   */
  private detectChromium(): boolean {
    return !!(window as any).chrome;
  }

  /**
   * Detect HDR color space from metadata
   */
  private detectHDRColorSpace(
    colorPrimaries?: string,
    colorTransfer?: string,
  ): string {
    const primaries = (colorPrimaries || "").toLowerCase();
    const transfer = (colorTransfer || "").toLowerCase();

    if (!this.hdrEnabled) {
      return "srgb";
    }

    const isHDRTransfer =
      transfer.includes("pq") ||
      transfer.includes("hlg") ||
      transfer.includes("smpte2084") ||
      transfer.includes("arib-std-b67");

    const isBT2020 =
      primaries.includes("bt2020") || primaries.includes("rec2020");

    if (isHDRTransfer || isBT2020) {
      Logger.debug(
        TAG,
        `HDR content detected (primaries: ${colorPrimaries}, transfer: ${colorTransfer}). Using display-p3.`,
      );
      return "display-p3";
    }

    if (primaries.includes("p3") || primaries.includes("display-p3")) {
      Logger.debug(TAG, `P3 content detected. Using display-p3.`);
      return "display-p3";
    }

    return "srgb";
  }

  /**
   * Initialize WebGL2 context with appropriate shader for browser
   */
  initialize(options: ThumbnailRenderOptions): void {
    const {
      width,
      height,
      rotation = 0,
      colorPrimaries,
      colorTransfer,
      hdrEnabled = true,
    } = options;

    this.hdrEnabled = hdrEnabled;
    this.lastColorPrimaries = colorPrimaries;
    this.lastColorTransfer = colorTransfer;
    this.rotation = rotation;

    const isRotated = rotation % 180 !== 0;
    this.canvas.width = isRotated ? height : width;
    this.canvas.height = isRotated ? width : height;
    // Remember the flat render size so the VR path can resize the shared canvas
    // for a preview-shaped view and the flat path can restore it afterwards.
    this.flatWidth = this.canvas.width;
    this.flatHeight = this.canvas.height;

    // Detect if source is HDR
    const primaries = (colorPrimaries || "").toLowerCase();
    const transfer = (colorTransfer || "").toLowerCase();
    const isHDRTransfer =
      transfer.includes("pq") ||
      transfer.includes("hlg") ||
      transfer.includes("smpte2084") ||
      transfer.includes("arib-std-b67");
    const isBT2020 =
      primaries.includes("bt2020") || primaries.includes("rec2020");
    this.isHDRSource = isHDRTransfer || isBT2020;

    // Detect HDR and get appropriate color space
    const detectedColorSpace = this.detectHDRColorSpace(
      colorPrimaries,
      colorTransfer,
    );

    // Initialize WebGL2
    const contextOptions: WebGLContextAttributes = {
      alpha: false,
      antialias: false,
      depth: false,
      preserveDrawingBuffer: true,
    };

    this.gl = this.canvas.getContext(
      "webgl2",
      contextOptions,
    ) as WebGL2RenderingContext;

    if (!this.gl) {
      throw new Error("WebGL2 not supported");
    }

    // Configure color space (Chromium 104+, Safari 17+)
    try {
      // @ts-ignore
      if (
        detectedColorSpace !== "srgb" &&
        this.gl.drawingBufferColorSpace !== undefined
      ) {
        // @ts-ignore
        this.gl.drawingBufferColorSpace = detectedColorSpace;
        // @ts-ignore
        this.gl.unpackColorSpace = detectedColorSpace;
        Logger.debug(TAG, `WebGL color space set to: ${detectedColorSpace}`);
      }
    } catch (e) {
      Logger.warn(TAG, "Failed to set drawingBufferColorSpace", e);
    }

    // Detect browser and choose rendering path
    const isChromium = this.detectChromium();
    this.hasNativeHDRSupport = isChromium;

    const needsShaderToneMapping =
      !this.hasNativeHDRSupport && this.isHDRSource;

    if (needsShaderToneMapping) {
      Logger.debug(TAG, "Using shader-based HDR tone mapping (non-Chromium)");
      this.initWebGLWithHDR();
    } else {
      Logger.debug(TAG, "Using simple passthrough (Chromium native HDR)");
      this.initWebGLSimple();
    }

    Logger.info(
      TAG,
      `Initialized: ${width}x${height}, isChromium=${isChromium}, isHDR=${this.isHDRSource}, colorSpace=${detectedColorSpace}`,
    );
  }

  /**
   * Simple WebGL initialization for Chromium (native HDR support)
   */
  private initWebGLSimple(): void {
    if (!this.gl) return;

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

    const shader = this.createProgram(vsSource, fsSource);
    if (!shader) {
      throw new Error("Failed to create shader program");
    }
    this.program = shader;

    this.setupGeometry();
    this.setupTexture();
  }

  /**
   * WebGL initialization with HDR tone mapping for non-Chromium browsers
   */
  private initWebGLWithHDR(): void {
    if (!this.gl) return;

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
    uniform float u_hdrEnabled;
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

      // Tone map to SDR range
      float exposure = mix(22.0, 35.0, u_hdrEnabled);
      vec3 sdr = toneMapReinhard(linear, exposure);

      // Saturation boost
      float saturation = mix(1.1, 1.5, u_hdrEnabled);
      sdr = adjustSaturation(sdr, saturation);

      // Apply gamma
      vec3 display = pow(sdr, vec3(1.0/2.2));

      outColor = vec4(display, color.a);
    }`;

    const shader = this.createProgram(vsSource, fsSource);
    if (!shader) {
      throw new Error("Failed to create shader program");
    }
    this.program = shader;

    this.setupGeometry();
    this.setupTexture();

    // Set HDR uniform
    if (!this.gl || !this.program) return;
    this.gl.useProgram(this.program);
    const uHdrEnabled = this.gl.getUniformLocation(
      this.program,
      "u_hdrEnabled",
    );
    if (uHdrEnabled) {
      this.gl.uniform1f(uHdrEnabled, this.hdrEnabled ? 1.0 : 0.0);
    }
  }

  /**
   * Create and compile shader program
   */
  private createProgram(
    vsSource: string,
    fsSource: string,
  ): WebGLProgram | null {
    if (!this.gl) return null;

    const createShader = (type: number, source: string) => {
      if (!this.gl) return null;
      const shader = this.gl.createShader(type);
      if (!shader) return null;
      this.gl.shaderSource(shader, source);
      this.gl.compileShader(shader);
      if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
        Logger.error(
          TAG,
          "Shader compile error:",
          this.gl.getShaderInfoLog(shader),
        );
        this.gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vert = createShader(this.gl.VERTEX_SHADER, vsSource);
    const frag = createShader(this.gl.FRAGMENT_SHADER, fsSource);
    if (!vert || !frag) return null;

    const program = this.gl.createProgram();
    if (!program) return null;
    this.gl.attachShader(program, vert);
    this.gl.attachShader(program, frag);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      Logger.error(
        TAG,
        "Program link error:",
        this.gl.getProgramInfoLog(program),
      );
      return null;
    }

    return program;
  }

  /**
   * Setup geometry (fullscreen quad)
   */
  private setupGeometry(): void {
    if (!this.gl || !this.program) return;
    const gl = this.gl;

    // Standard quad: TL, BL, TR, BR
    // Mapping Screen Top (Y=1) to UV 0 (Bottom of texture)
    // because top-down pixel data (ffmpeg) normally puts the top row at index 0,
    // which WebGL places at the bottom of the texture.
    let vertices = [
      -1.0,
      1.0,
      0.0,
      0.0, // TL
      -1.0,
      -1.0,
      0.0,
      1.0, // BL
      1.0,
      1.0,
      1.0,
      0.0, // TR
      1.0,
      -1.0,
      1.0,
      1.0, // BR
    ];

    // Apply rotation to vertex positions
    // FFmpeg rotation metadata is clockwise, so we negate it for CCW math
    if (this.rotation !== 0) {
      const angle = (-this.rotation * Math.PI) / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      for (let i = 0; i < vertices.length; i += 4) {
        const x = vertices[i];
        const y = vertices[i + 1];
        vertices[i] = x * cos - y * sin;
        vertices[i + 1] = x * sin + y * cos;
      }
    }

    const vertexData = new Float32Array(vertices);

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);

    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 4 * 4, 0);

    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 4 * 4, 2 * 4);
  }

  /**
   * Configure WebCodecs VideoDecoder
   */
  async configureDecoder(
    codec: string,
    extradata: Uint8Array | null,
    width: number,
    height: number,
    profile?: number,
    level?: number,
  ): Promise<boolean> {
    if (!("VideoDecoder" in window)) {
      Logger.warn(TAG, "WebCodecs not supported in this browser");
      return false;
    }

    // Remember the args so we can transparently recreate the decoder if
    // WebCodecs later kills it (error callback / flush throw).
    this.lastDecoderConfig = { codec, extradata, width, height, profile, level };

    // Reset existing decoder if any
    if (this.decoder) {
      if (this.decoder.state !== "closed") {
        this.decoder.close();
      }
      this.decoder = null;
    }

    // Build codec string first (outside Promise)
    let codecString: string | null = null;

    if (profile !== undefined) {
      codecString = this.mapCodecToWebCodecs(
        codec,
        width,
        height,
        profile,
        level,
      );
    }

    if (!codecString) {
      codecString = CodecParser.getCodecString(
        codec,
        extradata ?? undefined,
        width,
        height,
      );
    }

    if (!codecString) {
      codecString = codec;
      Logger.warn(
        TAG,
        "Failed to resolve codec string, using generic:",
        codecString,
      );
    } else {
      Logger.debug(TAG, "Resolved codec string:", codecString);
    }

    // Check if codec is supported before creating decoder
    try {
      const checkConfig: VideoDecoderConfig = {
        codec: codecString,
        codedWidth: width,
        codedHeight: height,
        hardwareAcceleration: "prefer-hardware",
      };

      const support = await VideoDecoder.isConfigSupported(checkConfig);
      if (!support.supported) {
        Logger.warn(TAG, `Codec not supported by WebCodecs: ${codecString}`);
        return false;
      }
    } catch (e) {
      Logger.warn(TAG, `Failed to check codec support: ${codecString}`, e);
      return false;
    }

    // Store codecString for use in Promise
    const finalCodecString = codecString;

    return new Promise((resolve) => {
      try {
        this.decoder = new VideoDecoder({
          output: (frame) => {
            // Render the frame immediately when decoded
            this.renderVideoFrame(frame);
            frame.close(); // Important: release frame
            if (this.pendingDecodeResolve) {
              this.pendingDecodeResolve(true);
              this.pendingDecodeResolve = null;
            }
          },
          error: (e) => {
            Logger.error(TAG, "VideoDecoder error:", e);
            if (this.pendingDecodeResolve) {
              this.pendingDecodeResolve(false);
              this.pendingDecodeResolve = null;
            }
          },
        });

        const config: VideoDecoderConfig = {
          codec: finalCodecString,
          codedWidth: width,
          codedHeight: height,
          hardwareAcceleration: "prefer-hardware",
          optimizeForLatency: true,
        };

        // For VP9, WebCodecs often works best WITHOUT description if we have the full codec string (e.g. vp09.02...)
        // For H.264/H.265, description (avcC/hvcC) IS important.
        // Annex B extradata (from .ts containers) is converted to proper box format.
        const isAnnexB =
          extradata &&
          ((extradata.length > 3 &&
            extradata[0] === 0 &&
            extradata[1] === 0 &&
            extradata[2] === 1) ||
            (extradata.length > 4 &&
              extradata[0] === 0 &&
              extradata[1] === 0 &&
              extradata[2] === 0 &&
              extradata[3] === 1));

        let description: Uint8Array | undefined = extradata ?? undefined;
        if (isAnnexB && extradata) {
          const isHevc = codecString.startsWith("hvc1") || codecString.startsWith("hev1");
          const isAvc = codecString.startsWith("avc1") || codecString.startsWith("avc3");
          if (isHevc) {
            description = MoviVideoDecoder.annexBToHvcC(extradata) ?? undefined;
            if (description) {
              this.isAnnexBSource = true;
              Logger.debug(TAG, `Converted Annex B to hvcC for thumbnails (${description.length}B)`);
            }
          } else if (isAvc) {
            description = MoviVideoDecoder.annexBToAvcC(extradata) ?? undefined;
            if (description) {
              this.isAnnexBSource = true;
              Logger.debug(TAG, `Converted Annex B to avcC for thumbnails (${description.length}B)`);
            }
          } else {
            description = undefined;
          }
        }

        if (
          description &&
          !codecString.startsWith("vp09") &&
          !codecString.startsWith("vp8")
        ) {
          config.description = description;
        } else if (!description && !isAnnexB) {
          Logger.debug(
            TAG,
            "Skipping description (extradata) for VPx codec or missing data",
          );
        }

        this.decoder.configure(config);
        resolve(true);
      } catch (e) {
        Logger.error(TAG, "Failed to configure VideoDecoder:", e);
        this.decoder = null;
        resolve(false);
      }
    });
  }

  /**
   * Map FFmpeg codec names to WebCodecs codec strings
   * (Copied from MoviVideoDecoder for consistency)
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
      return "avc1.640028"; // High profile, level 4.0
    }

    // H.265 / HEVC
    if (
      codecLower === "hevc" ||
      codecLower === "h265" ||
      codecLower === "hvc1"
    ) {
      // Main 10 Profile (Profile 2)
      if (profile === 2) {
        const levelStr = _level ? `L${_level}` : "L153";
        return `hvc1.2.4.${levelStr}.B0`;
      }
      // Main Profile (Profile 1)
      if (profile === 1) {
        const levelStr = _level ? `L${_level}` : "L120";
        return `hvc1.1.6.${levelStr}.B0`;
      }
      // Rext Profile 4
      if (profile === 4) {
        return "hvc1.4.10.L93.B0";
      }
      return "hvc1.1.6.L93.B0";
    }

    // VP9
    if (codecLower === "vp9") {
      // Profile 2 (10-bit HDR)
      if (profile === 2) {
        Logger.info(
          TAG,
          "Mapping VP9 Profile 2 to vp09.02.51.10.01.09.16.09.00 (HDR)",
        );
        return "vp09.02.51.10.01.09.16.09.00";
      }
      // Profile 3
      if (profile === 3) {
        return "vp09.03.51.10.01.09.16.09.00";
      }
      // Default Profile 0
      return "vp09.00.41.08.01.01.01.01.00";
    }

    // AV1
    if (codecLower === "av1") {
      return "av01.0.01M.08";
    }

    // Legacy
    if (codecLower === "vp8") return "vp8";

    return null;
  }

  /**
   * Decode and render a packet using WebCodecs
   */
  async decodeAndRender(
    packetData: Uint8Array,
    pts: number,
    duration?: number,
  ): Promise<boolean> {
    let decoder = this.decoder;
    if (!decoder || decoder.state === "closed") {
      // Decoder died (WebCodecs error / flush throw). Recreate it from the
      // saved config so thumbnails resume instead of staying dead for the
      // rest of the session — but only if the *last* recreate has since
      // proven itself with a successful decode. Otherwise a permanently-bad
      // packet would loop: decode → die → recreate → same packet → die …
      if (this.decoderRevivedUnproven) {
        Logger.debug(
          TAG,
          "Decoder dead again before any successful decode — skipping recreate to avoid a loop",
        );
        return false;
      }
      const revived = await this.recreateDecoder();
      if (!revived) {
        return false;
      }
      this.decoderRevivedUnproven = true;
      decoder = this.decoder;
      if (!decoder || decoder.state === "closed") {
        return false;
      }
    }

    return new Promise((resolve) => {
      this.pendingDecodeResolve = (success: boolean) => {
        // Any successful decode proves the current decoder is healthy and
        // re-arms the recreate budget for a future death.
        if (success) this.decoderRevivedUnproven = false;
        resolve(success);
      };

      try {
        // Convert Annex B packet data to length-prefixed for WebCodecs
        let data = packetData;
        if (this.isAnnexBSource) {
          data = MoviVideoDecoder.annexBToLengthPrefixed(packetData);
        } else {
          // Length-prefixed (hvcC) HEVC: the thumbnail decoder flushes after
          // every frame, so each keyframe is decoded in a post-flush state. As
          // in the playback path, an Access Unit Delimiter NAL leading the
          // keyframe makes the HW decoder reject it ("wasn't a key frame") on
          // 10-bit DoVi/HDR HEVC. Strip the AUD so the keyframe is accepted.
          data = MoviVideoDecoder.stripAudLengthPrefixed(data);
        }

        const chunk = new EncodedVideoChunk({
          type: "key", // Thumbnails are always keyframes in this context
          timestamp: pts * 1_000_000,
          duration: duration,
          data: data,
        });

        decoder.decode(chunk);
        decoder.flush().catch((e) => {
          Logger.error(TAG, "Decoder flush error:", e);
          if (this.pendingDecodeResolve) {
            this.pendingDecodeResolve(false);
            this.pendingDecodeResolve = null;
          }
        });
      } catch (e) {
        Logger.error(TAG, "Decode error:", e);
        if (this.pendingDecodeResolve) {
          this.pendingDecodeResolve(false);
          this.pendingDecodeResolve = null;
        }
      }
    });
  }

  /**
   * Recreate the WebCodecs decoder from the last-used config. Called when the
   * decoder has died (closed / errored) so a single decode failure doesn't
   * disable thumbnails for the whole session. Returns false if there is no
   * saved config or reconfiguration fails.
   */
  private async recreateDecoder(): Promise<boolean> {
    const cfg = this.lastDecoderConfig;
    if (!cfg) return false;

    // Drop any half-dead instance and reset Annex B detection so
    // configureDecoder re-derives it from extradata.
    if (this.decoder) {
      try {
        if (this.decoder.state !== "closed") this.decoder.close();
      } catch {
        /* already closed */
      }
      this.decoder = null;
    }
    this.isAnnexBSource = false;

    Logger.debug(TAG, "Recreating dead thumbnail decoder");
    return this.configureDecoder(
      cfg.codec,
      cfg.extradata,
      cfg.width,
      cfg.height,
      cfg.profile,
      cfg.level,
    );
  }

  /**
   * Render RGBA data to canvas
   */
  render(rgbaData: Uint8Array, width: number, height: number): void {
    if (!this.gl || !this.program || !this.texture || !this.vao) {
      throw new Error("ThumbnailRenderer not initialized");
    }

    const gl = this.gl;

    // Upload texture
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      rgbaData,
    );

    this.draw();
  }

  /**
   * Render VideoFrame to canvas
   */
  renderVideoFrame(frame: VideoFrame): void {
    if (!this.gl || !this.program || !this.texture || !this.vao) {
      return;
    }

    const gl = this.gl;

    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame);

    this.draw();
  }

  /**
   * Set (or clear) the 360° reprojection view. When non-null, the next draw()
   * reprojects the equirectangular texture to this camera angle; null restores
   * the flat passthrough. Must be set BEFORE render()/decodeAndRender(), since
   * draw() runs synchronously inside those.
   */
  setProjection(view: VRView | null): void {
    this.vrView = view;
  }

  /**
   * Lazily compile the equirect/fisheye/stereographic raycast program (ported
   * verbatim from CanvasRenderer.initVRProgram) plus its own unrotated
   * fullscreen quad feeding v_ndc. Returns true when ready.
   */
  private initVRProgram(): boolean {
    if (this.vrProgram && this.vrVao) return true;
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
    uniform float u_yaw;
    uniform float u_pitch;
    uniform float u_fov;
    uniform float u_aspect;
    uniform float u_lonDiv;
    uniform float u_latDiv;
    uniform float u_proj;
    uniform float u_fishFov;
    uniform float u_uScale;
    uniform float u_uOffset;
    uniform float u_planetScale;
    uniform float u_srcAspect;
    in vec2 v_ndc;
    out vec4 outColor;
    const float PI = 3.14159265358979323846;
    void main() {
      float t = tan(u_fov * 0.5);
      vec3 dir = normalize(vec3(v_ndc.x * t * u_aspect, v_ndc.y * t, -1.0));
      float cp = cos(u_pitch), sp = sin(u_pitch);
      dir = vec3(dir.x, cp * dir.y - sp * dir.z, sp * dir.y + cp * dir.z);
      float cy = cos(u_yaw), sy = sin(u_yaw);
      dir = vec3(cy * dir.x + sy * dir.z, dir.y, -sy * dir.x + cy * dir.z);
      vec2 eye;
      if (u_proj < 0.5) {
        float lon = atan(dir.x, -dir.z);
        float lat = asin(clamp(dir.y, -1.0, 1.0));
        eye = vec2(lon / u_lonDiv + 0.5, 0.5 - lat / u_latDiv);
      } else if (u_proj < 1.5) {
        float theta = acos(clamp(-dir.z, -1.0, 1.0));
        float phi = atan(dir.y, dir.x);
        float r = theta / (u_fishFov * 0.5);
        eye = vec2(0.5 + 0.5 * r * cos(phi), 0.5 - 0.5 * r * sin(phi));
      } else {
        float a = acos(clamp(-dir.y, -1.0, 1.0));
        float az = atan(dir.z, dir.x);
        float r = tan(a * 0.5) * u_planetScale;
        eye = vec2(0.5 + r * cos(az) / u_srcAspect, 0.5 + r * sin(az));
      }
      vec2 uv = vec2(eye.x * u_uScale + u_uOffset, eye.y);
      outColor = texture(u_image, uv);
    }`;

    const program = this.createProgram(vsSource, fsSource);
    if (!program) {
      Logger.warn(TAG, "Failed to compile VR preview program");
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

    // Unrotated fullscreen quad (position only at location 0) → v_ndc.
    this.vrVao = gl.createVertexArray();
    gl.bindVertexArray(this.vrVao);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return true;
  }

  /** Reproject the bound equirect texture to the current 360 view. */
  private drawVR(gl: WebGL2RenderingContext, view: VRView): void {
    // Size the preview to the player's aspect so the framing matches on-screen.
    const aspect = view.aspect > 0 ? view.aspect : 16 / 9;
    const H = ThumbnailRenderer.VR_PREVIEW_HEIGHT;
    const W = Math.max(64, Math.min(768, Math.round(H * aspect)));
    if (this.canvas.width !== W || this.canvas.height !== H) {
      this.canvas.width = W;
      this.canvas.height = H;
    }

    // Full 360° equirect wraps horizontally; VR180 / little-planet clamp.
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_WRAP_S,
      view.half || view.stereographic ? gl.CLAMP_TO_EDGE : gl.REPEAT,
    );

    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.vrProgram);
    gl.bindVertexArray(this.vrVao);

    const locs = this.vrLocs!;
    const eyeAspect = view.sbs ? view.texAspect / 2 : view.texAspect;
    const lonDiv = view.half ? Math.PI : 2 * Math.PI;
    const latDiv = Math.min(Math.PI, lonDiv / (eyeAspect || 2));
    const projMode = view.stereographic ? 2 : view.fisheye ? 1 : 0;
    if (locs.yaw) gl.uniform1f(locs.yaw, view.yaw);
    if (locs.pitch) gl.uniform1f(locs.pitch, view.pitch);
    if (locs.fov) gl.uniform1f(locs.fov, view.fov);
    if (locs.aspect) gl.uniform1f(locs.aspect, W / H);
    if (locs.lonDiv) gl.uniform1f(locs.lonDiv, lonDiv);
    if (locs.latDiv) gl.uniform1f(locs.latDiv, latDiv);
    if (locs.proj) gl.uniform1f(locs.proj, projMode);
    if (locs.fishFov)
      gl.uniform1f(locs.fishFov, ThumbnailRenderer.VR_FISHEYE_FOV);
    if (locs.uScale) gl.uniform1f(locs.uScale, view.sbs ? 0.5 : 1);
    if (locs.uOffset) gl.uniform1f(locs.uOffset, 0);
    if (locs.planetScale)
      gl.uniform1f(locs.planetScale, ThumbnailRenderer.VR_PLANET_SCALE);
    if (locs.srcAspect) gl.uniform1f(locs.srcAspect, view.texAspect || 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private draw(): void {
    if (!this.gl || !this.vao) return;
    const gl = this.gl;

    // 360° preview: reproject the equirect texture to the current view.
    if (this.vrView && this.initVRProgram()) {
      this.drawVR(gl, this.vrView);
      return;
    }

    if (!this.program) return;
    // Restore the flat (source-sized) canvas if a prior 360 draw resized it.
    if (this.flatWidth && this.canvas.width !== this.flatWidth) {
      this.canvas.width = this.flatWidth;
      this.canvas.height = this.flatHeight;
    }
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /**
   * Setup texture
   */
  private setupTexture(): void {
    if (!this.gl || !this.program) return;
    const gl = this.gl;

    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    gl.useProgram(this.program);
    const uImage = gl.getUniformLocation(this.program, "u_image");
    if (uImage) {
      gl.uniform1i(uImage, 0);
    }
  }

  /**
   * Set HDR enabled state
   */
  setHDREnabled(enabled: boolean): void {
    if (this.hdrEnabled === enabled) return;
    this.hdrEnabled = enabled;

    const detectedColorSpace = this.detectHDRColorSpace(
      this.lastColorPrimaries,
      this.lastColorTransfer,
    );

    if (this.gl && this.gl.drawingBufferColorSpace !== undefined) {
      try {
        // @ts-ignore
        this.gl.drawingBufferColorSpace = detectedColorSpace;
        // @ts-ignore
        this.gl.unpackColorSpace = detectedColorSpace;
        Logger.info(
          TAG,
          `Updated WebGL color space to ${detectedColorSpace} following HDR toggle`,
        );
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
        this.gl.uniform1f(uHdrEnabled, this.hdrEnabled ? 1.0 : 0.0);
      }
    }
  }

  /**
   * Get the rendered canvas
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * Destroy WebGL resources
   */
  destroy(): void {
    if (this.gl) {
      if (this.texture) {
        this.gl.deleteTexture(this.texture);
        this.texture = null;
      }
      if (this.vao) {
        this.gl.deleteVertexArray(this.vao);
        this.vao = null;
      }
      if (this.program) {
        this.gl.deleteProgram(this.program);
        this.program = null;
      }
      if (this.vrVao) {
        this.gl.deleteVertexArray(this.vrVao);
        this.vrVao = null;
      }
      if (this.vrProgram) {
        this.gl.deleteProgram(this.vrProgram);
        this.vrProgram = null;
      }
    }
    this.gl = null;

    if (this.decoder) {
      if (this.decoder.state !== "closed") {
        this.decoder.close();
      }
      this.decoder = null;
    }
  }
}
