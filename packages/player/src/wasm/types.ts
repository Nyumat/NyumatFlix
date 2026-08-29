/**
 * WASM Types - Type definitions for WASM module with Asyncify
 */

// Emscripten FS interface
export interface EmscriptenFS {
  mkdir: (path: string) => void;
  rmdir: (path: string) => void;
  mount: (type: unknown, opts: { files?: File[] }, mountpoint: string) => void;
  unmount: (mountpoint: string) => void;
  writeFile: (path: string, data: Uint8Array) => void;
  unlink: (path: string) => void;
  filesystems: {
    WORKERFS: unknown;
  };
}

export interface MoviWasmModule {
  // Memory
  HEAPU8: Uint8Array;
  HEAP32: Int32Array;
  HEAPU32: Uint32Array;
  HEAPF32: Float32Array;
  HEAPF64: Float64Array;

  // Memory allocation
  _malloc: (size: number) => number;
  _free: (ptr: number) => void;

  // String utils
  stringToNewUTF8: (str: string) => number;
  UTF8ToString: (ptr: number) => string;

  // Filesystem
  FS: EmscriptenFS;

  // Core API - async functions due to Asyncify
  _movi_create: () => number;
  _movi_destroy: (ctx: number) => void;
  _movi_set_file_size: (ctx: number, sizeLow: number, sizeHigh: number) => void;
  _movi_open: (ctx: number) => Promise<number>; // Now async (no filename param)
  _movi_get_duration: (ctx: number) => number;
  _movi_get_start_time: (ctx: number) => number;
  _movi_get_stream_count: (ctx: number) => number;
  _movi_get_chapter_count: (ctx: number) => number;
  _movi_get_chapter_start: (ctx: number, index: number) => number;
  _movi_get_chapter_end: (ctx: number, index: number) => number;
  _movi_get_chapter_title: (ctx: number, index: number, buffer: number, bufferSize: number) => number;
  _movi_get_stream_info: (
    ctx: number,
    streamIndex: number,
    infoPtr: number,
  ) => number;
  _movi_get_extradata: (
    ctx: number,
    streamIndex: number,
    buffer: number,
    bufferSize: number,
  ) => number;
  _movi_get_attached_pic_data: (
    ctx: number,
    streamIndex: number,
    buffer: number,
    bufferSize: number,
  ) => number;
  _movi_seek_to: (
    ctx: number,
    timestamp: number,
    streamIndex: number,
    flags: number,
  ) => Promise<number>; // Now async
  _movi_read_frame: (
    ctx: number,
    infoPtr: number,
    buffer: number,
    bufferSize: number,
  ) => Promise<number>; // Now async
  _movi_set_log_level: (level: number) => void;
  _movi_get_format_name: (ctx: number, buffer: number, size: number) => number;
  _movi_get_metadata_title: (
    ctx: number,
    buffer: number,
    size: number,
  ) => number;

  // Decoding
  _movi_enable_decoder: (ctx: number, stream_index: number, extradata: number, extradata_size: number) => number;
  _movi_send_packet: (
    ctx: number,
    stream_index: number,
    data: number,
    size: number,
    pts: number,
    dts: number,
    keyframe: number,
  ) => number;
  _movi_receive_frame: (ctx: number, stream_index: number) => number;
  _movi_get_frame_width: (ctx: number) => number;
  _movi_get_frame_height: (ctx: number) => number;
  _movi_get_frame_format(ctx: number): number;
  _movi_get_frame_data(ctx: number, plane: number): number;
  _movi_get_frame_linesize(ctx: number, plane: number): number;
  _movi_get_frame_samples(ctx: number): number;
  _movi_get_frame_channels(ctx: number): number;
  _movi_get_frame_sample_rate(ctx: number): number;
  _movi_enable_audio_downmix(ctx: number, enable: number): void;
  _movi_get_frame_pts(ctx: number, streamIndex: number): number;
  _movi_flush_decoder(ctx: number, streamIndex: number): void;

  // RGBA conversion for software decoding
  _movi_get_frame_rgba(
    ctx: number,
    targetWidth: number,
    targetHeight: number,
  ): number;
  _movi_get_frame_rgba_size(ctx: number): number;
  _movi_get_frame_rgba_linesize(ctx: number): number;
  _movi_set_skip_frame(ctx: number, streamIndex: number, skip: number): void;

  // Thumbnail API (demux only)
  _movi_thumbnail_create: (fileSizeLow: number, fileSizeHigh: number) => number;
  _movi_thumbnail_open: (ctx: number) => Promise<number>;
  _movi_thumbnail_read_keyframe: (ctx: number, timestamp: number) => void; // Callback pattern
  _movi_thumbnail_get_packet_data: (ctx: number) => number;
  _movi_thumbnail_get_packet_pts: (ctx: number) => number;
  _movi_thumbnail_get_stream_info: (ctx: number, infoPtr: number) => number;
  _movi_thumbnail_get_extradata: (
    ctx: number,
    buffer: number,
    bufferSize: number,
  ) => number;
  _movi_thumbnail_decode_frame_yuv: (ctx: number) => number;
  _movi_thumbnail_get_plane_data: (ctx: number, plane: number) => number;
  _movi_thumbnail_get_plane_linesize: (ctx: number, plane: number) => number;
  _movi_thumbnail_get_frame_width: (ctx: number) => number;
  _movi_thumbnail_get_frame_height: (ctx: number) => number;
  _movi_thumbnail_destroy: (ctx: number) => void;

  // Signalsmith Stretch — pitch-preserving time-stretch (sync API).
  _movi_stretch_new: (channels: number, sampleRate: number) => number;
  _movi_stretch_delete: (handle: number) => void;
  _movi_stretch_reset: (handle: number) => void;
  _movi_stretch_set_transpose_semitones: (handle: number, semitones: number) => void;
  _movi_stretch_input_latency: (handle: number) => number;
  _movi_stretch_output_latency: (handle: number) => number;
  _movi_stretch_process: (
    handle: number,
    inPtr: number,
    inFrames: number,
    outPtr: number,
    outFrames: number,
  ) => void;

  // Emscripten utilities
  ccall: (
    name: string,
    returnType: string,
    argTypes: string[],
    args: unknown[],
    opts?: { async?: boolean },
  ) => unknown | Promise<unknown>;
  cwrap: (
    name: string,
    returnType: string,
    argTypes: string[],
  ) => (...args: unknown[]) => unknown;
  addFunction: (func: Function, sig: string) => number;
}

export interface StreamInfo {
  index: number;
  type: number; // 0=video, 1=audio, 2=subtitle
  codecId: number;
  codecName: string;
  width: number;
  height: number;
  frameRate: number;
  channels: number;
  sampleRate: number;
  duration: number;
  bitRate: number;
  extradataSize: number;
  profile: number;
  level: number;
  language: string; // Empty string if not available
  label: string; // Empty string if not available
  rotation: number;
  colorPrimaries: string;
  colorTransfer: string;
  colorMatrix: string;
  pixelFormat: string;
  colorRange: string;
  // 360° spherical projection: 0 = none, else AVSphericalProjection+1
  // (1=equirectangular, 2=cubemap, 3=equirectangular-tile, 4=half-equirectangular).
  projection: number;
  // True when AV_DISPOSITION_ATTACHED_PIC is set on the stream. Audio
  // files with embedded cover art (ID3v2 APIC, FLAC PICTURE, MP4 covr,
  // Matroska attachments) expose a video-codec stream that carries a
  // single cached picture instead of a real packet stream. Consumers
  // should skip these when picking the active video track and read the
  // image via getAttachedPicData() instead.
  isAttachedPic: boolean;
}

export interface PacketInfo {
  streamIndex: number;
  keyframe: boolean;
  pts: number;
  dts: number;
  duration: number;
  size: number;
  // True only for a real IDR/BLA random-access keyframe the HW decoder accepts
  // as a `key` chunk. False for open-GOP CRA sync frames that are flagged as
  // keyframes but must be sent as `delta` mid-stream (see VideoDecoder). Always
  // false for non-keyframes.
  isIdr: boolean;
  // True for an HEVC RASL leading picture (NAL 8/9). RASL trail a CRA/BLA in
  // decode order but reference the pre-RAP GOP; orphaned after a random-access
  // resume, so JS skips them (see VideoDecoder). Always false for keyframes and
  // non-HEVC codecs.
  isRasl: boolean;
}

// StreamInfo struct layout (matches C struct)
// 336 = end of color_range; +4 projection (336) +4 is_attached_pic placeholder
// (340); padded to 8-byte alignment (int64 bit_rate) → 344. Keep in sync with
// sizeof(StreamInfo) in movi.h after any field change, and clear
// node_modules/.vite after build:wasm so the new layout is picked up.
export const STREAM_INFO_SIZE = 344;
export const STREAM_INFO_OFFSETS = {
  index: 0,
  type: 4,
  codecId: 8,
  codecName: 12, // 32 bytes
  width: 44,
  height: 48,
  frameRate: 56, // double
  channels: 64,
  sampleRate: 68,
  duration: 72, // double
  bitRate: 80, // int64
  extradataSize: 88,
  profile: 92,
  level: 96,
  language: 100, // 8 bytes (char[8])
  label: 108, // 64 bytes (char[64])
  rotation: 172, // 4 bytes (int)
  colorPrimaries: 176, // 32 bytes
  colorTransfer: 208, // 32 bytes
  colorMatrix: 240, // 32 bytes
  pixelFormat: 272, // 32 bytes
  colorRange: 304, // 32 bytes
  projection: 336, // 4 bytes (int) — AVSphericalProjection+1, 0 = none
  isAttachedPic: 340, // 4 bytes (int)
};

// PacketInfo struct layout. Contains doubles (8-byte alignment), so the trailing
// is_idr(36)+is_rasl(40) ints pad the struct from 44 up to 48 bytes — keep this
// in sync with sizeof(PacketInfo) in movi.h.
export const PACKET_INFO_SIZE = 48;
export const PACKET_INFO_OFFSETS = {
  streamIndex: 0,
  keyframe: 4,
  timestamp: 8, // double
  dts: 16, // double
  duration: 24, // double
  size: 32,
  isIdr: 36, // int — occupies the padding after `size`
  isRasl: 40, // int
};
