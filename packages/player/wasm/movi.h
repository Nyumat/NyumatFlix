#ifndef MOVI_H
#define MOVI_H

#include <emscripten.h>
#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>
#include <libavformat/avio.h>
#include <libavutil/avutil.h>
#include <libavutil/display.h>
#include <libavutil/pixdesc.h>
#include <libavutil/spherical.h>
#include <libswresample/swresample.h>
#include <libswscale/swscale.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>



// Stream types matching TypeScript
typedef enum {
  STREAM_TYPE_VIDEO = 0,
  STREAM_TYPE_AUDIO = 1,
  STREAM_TYPE_SUBTITLE = 2,
  STREAM_TYPE_UNKNOWN = 3
} StreamType;

// Stream info struct - matches TypeScript
typedef struct {
  int index;
  int type;
  int codec_id;
  char codec_name[32];
  int width;
  int height;
  double frame_rate;
  int channels;
  int sample_rate;
  double duration;
  int64_t bit_rate;
  int extradata_size;
  int profile;
  int level;
  char language[8]; // ISO 639-2/B language code (3 chars + null terminator)
  char label[64];   // Track label/title from metadata
  int rotation;     // Rotation in degrees (e.g. 0, 90, 180, 270)
  char color_primaries[32];
  char color_transfer[32];
  char color_matrix[32];
  char pixel_format[32];
  char color_range[32];
  // 360° spherical projection, stored as AVSphericalProjection + 1 so that a
  // zero-initialised struct (i.e. an older WASM that predates this field) reads
  // as 0 = "no spherical metadata" rather than 0 = equirectangular.
  //   0 = none/not spherical
  //   1 = equirectangular, 2 = cubemap, 3 = equirectangular-tile,
  //   4 = half-equirectangular (180°), …
  int projection;
} StreamInfo;

// Packet info struct
typedef struct {
  int stream_index;
  int keyframe;
  double timestamp;
  double dts;
  double duration;
  int size;
  // 1 only for a TRUE random-access keyframe the HW decoder will accept as a
  // `key` chunk: IDR/BLA in HEVC, IDR in H.264, key+no-show-existing in AV1.
  // 0 for CRA / open-GOP sync frames that AVPacket flags as a keyframe but
  // whose leading (RASL) pictures reference the previous GOP — sending those
  // as `key` makes WebCodecs reject them ("wasn't a key frame"). JS sends
  // is_idr=0 keyframes as `delta` mid-stream so the HW decoder keeps running.
  // Occupies the 4 bytes the compiler already pads after `size`.
  int is_idr;
  // 1 for an HEVC RASL leading picture (NAL type 8=RASL_N / 9=RASL_R). RASL
  // pictures follow a CRA in decode order but reference the PRE-CRA GOP. When a
  // CRA is used as a random-access point (post-seek, references flushed) its
  // RASL pictures are non-decodable and the spec discards them
  // (NoRaslOutputFlag=1). Chrome's decoder drops them internally; Safari's
  // VideoToolbox throws a hard EncodingError instead. JS uses this to skip RASL
  // after resuming on a CRA. Always 0 for keyframes and non-HEVC codecs.
  // Growing the struct here bumps sizeof(PacketInfo) 40 -> 48 (double alignment
  // pads the trailing 44 to 48); PACKET_INFO_SIZE in types.ts must match.
  int is_rasl;
} PacketInfo;

// Prefetched subtitle cue (populated by movi_prefetch_subtitle_cues).
// Used for negative subtitle delay where the renderer needs cues from
// future stream positions before the demuxer would naturally deliver them.
typedef struct {
  double start_sec;
  double end_sec;
  char *text; // null-terminated, malloc-owned
} PrefetchedSubCue;

// Demuxer context with custom AVIO
typedef struct {
  AVFormatContext *fmt_ctx;
  AVPacket *pkt;
  AVIOContext *avio_ctx;
  uint8_t *avio_buffer;
  int64_t position;  // Current read position
  int64_t file_size; // Total file size
  int avio_buffer_size;

  // Decoding support
  AVCodecContext **decoders;
  SwrContext **resamplers;
  AVFrame *frame;
  AVFrame *resampled_frame;
  AVSubtitle *subtitle;                 // For subtitle decoding
  double last_subtitle_packet_duration; // Store packet duration for fallback
  int downmix_to_stereo;
  
  // RGB conversion support (for 10-bit HDR to 8-bit RGBA)
  struct SwsContext *sws_ctx;
  AVFrame *rgb_frame;
  uint8_t *rgb_buffer;
  int rgb_buffer_size;

  // Prefetched subtitle cues (lazy — populated on demand for non-zero
  // subtitle delay). Owned by the context; freed in movi_destroy.
  PrefetchedSubCue *prefetched_cues;
  int prefetched_cue_count;
  int prefetched_cue_capacity;
} MoviContext;

EMSCRIPTEN_KEEPALIVE double movi_get_start_time(MoviContext *ctx);
EMSCRIPTEN_KEEPALIVE int movi_get_format_name(MoviContext *ctx, char *buffer, int buffer_size);
EMSCRIPTEN_KEEPALIVE int movi_get_metadata_title(MoviContext *ctx, char *buffer, int buffer_size);

// JS-WASM Bridge (defined in movi.c or other files with EM_JS)
extern int js_read_async(uint8_t *buffer, int offset_low, int offset_high,
                         int size);
extern int64_t js_seek_async(int offset_low, int offset_high, int whence);
extern int64_t js_get_file_size(void);

// Remuxer context (forward declaration)
typedef struct MoviRemuxContext MoviRemuxContext;

// Thumbnail context (forward declaration)
typedef struct MoviThumbnailContext MoviThumbnailContext;

#endif // MOVI_H
