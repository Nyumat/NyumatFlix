/**
 * movi_thumbnail.c - Fast thumbnail extraction (demux only)
 *
 * Uses callback pattern to bypass Asyncify return value issues.
 */

#include "movi.h"
#include <libswscale/swscale.h>
#include <libavutil/imgutils.h>

// Thumbnail context
struct MoviThumbnailContext {
  AVFormatContext *fmt_ctx;
  AVIOContext *avio_ctx;
  uint8_t *avio_buffer;
  int64_t position;
  int64_t file_size;
  int avio_buffer_size;

  int video_stream_index;
  AVPacket *pkt;
  
  // Decoding support (Software fallback)
  AVCodecContext *dec_ctx;
  AVFrame *frame;
  AVFrame *rgb_frame;
  struct SwsContext *sws_ctx;
  uint8_t *rgb_buffer;
  int rgb_buffer_size;

  // Result storage
  int last_packet_size;
  double last_packet_pts;
};

extern int js_read_async(uint8_t *buffer, int offset_low, int offset_high,
                         int size);
extern int64_t js_seek_async(int offset_low, int offset_high, int whence);

// JS callback declaration
extern void js_thumbnail_packet_ready(int size, double pts);

static int thumbnail_avio_read(void *opaque, uint8_t *buf, int buf_size) {
  struct MoviThumbnailContext *ctx = (struct MoviThumbnailContext *)opaque;
  uint32_t position_low = (uint32_t)(ctx->position & 0xFFFFFFFF);
  uint32_t position_high = (uint32_t)(ctx->position >> 32);

  int bytes_read =
      js_read_async(buf, (int)position_low, (int)position_high, buf_size);
  if (bytes_read > 0) {
    ctx->position += (int64_t)bytes_read;
  } else if (bytes_read == 0) {
    return AVERROR_EOF;
  }
  return bytes_read;
}

static int64_t thumbnail_avio_seek(void *opaque, int64_t offset, int whence) {
  struct MoviThumbnailContext *ctx = (struct MoviThumbnailContext *)opaque;

  if (whence == AVSEEK_SIZE)
    return ctx->file_size;

  int64_t new_pos;
  switch (whence) {
  case SEEK_SET:
    new_pos = offset;
    break;
  case SEEK_CUR:
    new_pos = ctx->position + offset;
    break;
  case SEEK_END:
    new_pos = ctx->file_size + offset;
    break;
  default:
    return -1;
  }

  if (new_pos < 0 || new_pos > ctx->file_size)
    return -1;

  ctx->position = new_pos;
  return new_pos;
}

EMSCRIPTEN_KEEPALIVE
struct MoviThumbnailContext *movi_thumbnail_create(int file_size_low,
                                                   int file_size_high) {
  struct MoviThumbnailContext *ctx = (struct MoviThumbnailContext *)calloc(
      1, sizeof(struct MoviThumbnailContext));
  if (!ctx)
    return NULL;

  ctx->file_size = (int64_t)((uint32_t)file_size_low) +
                   (((int64_t)((uint32_t)file_size_high)) << 32);
  ctx->avio_buffer_size = 32768;
  ctx->video_stream_index = -1;
  ctx->pkt = av_packet_alloc();
  ctx->last_packet_size = 0;
  ctx->last_packet_pts = 0.0;

  return ctx;
}

// Force software pixel format callback
static enum AVPixelFormat get_format(AVCodecContext *s, const enum AVPixelFormat *fmt) {
    const enum AVPixelFormat *p;
    for (p = fmt; *p != -1; p++) {
        const AVPixFmtDescriptor *desc = av_pix_fmt_desc_get(*p);
        
        av_log(NULL, AV_LOG_DEBUG, "[THUMB] get_format checking: %s (hwaccel: %llu)\n",
               desc->name, (unsigned long long)(desc->flags & AV_PIX_FMT_FLAG_HWACCEL));

        if (!(desc->flags & AV_PIX_FMT_FLAG_HWACCEL)) {
            // Found a software format
            av_log(NULL, AV_LOG_DEBUG, "[THUMB] get_format selected: %s\n", desc->name);
            
            // EXPERIMENTAL: Force set pix_fmt to bypass potential validation issues
            if (s->pix_fmt != *p) {
                 s->pix_fmt = *p;
            }
            return *p;
        }
    }
    return AV_PIX_FMT_NONE;
}

EMSCRIPTEN_KEEPALIVE
int movi_thumbnail_open(struct MoviThumbnailContext *ctx) {
  if (!ctx || !ctx->pkt)
    return -1;

  ctx->avio_buffer = av_malloc(ctx->avio_buffer_size);
  if (!ctx->avio_buffer)
    return -2;

  ctx->avio_ctx =
      avio_alloc_context(ctx->avio_buffer, ctx->avio_buffer_size, 0, ctx,
                         thumbnail_avio_read, NULL, thumbnail_avio_seek);
  if (!ctx->avio_ctx) {
    av_free(ctx->avio_buffer);
    return -3;
  }
  ctx->avio_ctx->seekable = AVIO_SEEKABLE_NORMAL;

  ctx->fmt_ctx = avformat_alloc_context();
  if (!ctx->fmt_ctx) {
    av_freep(&ctx->avio_ctx->buffer);
    avio_context_free(&ctx->avio_ctx);
    return -4;
  }
  ctx->fmt_ctx->pb = ctx->avio_ctx;


  if (avformat_open_input(&ctx->fmt_ctx, NULL, NULL, NULL) < 0)
    return -5;
  if (avformat_find_stream_info(ctx->fmt_ctx, NULL) < 0)
    return -6;

  for (unsigned int i = 0; i < ctx->fmt_ctx->nb_streams; i++) {
    if (ctx->fmt_ctx->streams[i]->codecpar->codec_type == AVMEDIA_TYPE_VIDEO) {
      if (ctx->video_stream_index < 0) ctx->video_stream_index = i;
    }
  }


  if (ctx->video_stream_index < 0)
    return -7;

  // Initialize software decoder for fallback
  AVStream *st = ctx->fmt_ctx->streams[ctx->video_stream_index];
  const AVCodec *codec = NULL;
  
  // For AV1, prefer libdav1d (pure software decoder that works in WASM)
  // The native av1 decoder has hardware acceleration issues in WASM
  if (st->codecpar->codec_id == AV_CODEC_ID_AV1) {
      codec = avcodec_find_decoder_by_name("libdav1d");
      if (codec) {
          av_log(NULL, AV_LOG_DEBUG, "[THUMB] Using libdav1d for AV1 decoding\n");
      } else {
          av_log(NULL, AV_LOG_WARNING, "[THUMB] libdav1d not found, falling back to native av1\n");
      }
  }
  
  // Fallback to default decoder if no specific one found
  if (!codec) {
      codec = avcodec_find_decoder(st->codecpar->codec_id);
  }
  
  if (codec) {
      ctx->dec_ctx = avcodec_alloc_context3(codec);
      if (ctx->dec_ctx) {
          if (avcodec_parameters_to_context(ctx->dec_ctx, st->codecpar) >= 0) {
              ctx->dec_ctx->thread_count = 1; // Single thread for WASM
              ctx->dec_ctx->strict_std_compliance = FF_COMPLIANCE_EXPERIMENTAL; // Enable experimental features
              
              // Force software decoding by disabling HW device types
              // (Though they shouldn't be present in WASM build anyway)
              ctx->dec_ctx->get_format = get_format; // Register helper

              if (avcodec_open2(ctx->dec_ctx, codec, NULL) < 0) {
                   av_log(NULL, AV_LOG_ERROR, "[THUMB] Failed to open software decoder: %s\n", codec->name);
                   avcodec_free_context(&ctx->dec_ctx);
              } else {
                  av_log(NULL, AV_LOG_DEBUG, "[THUMB] Software decoder initialized: %s\n", codec->name);
              }
          } else {
             av_log(NULL, AV_LOG_ERROR, "[THUMB] Failed to copy codec parameters\n");
             avcodec_free_context(&ctx->dec_ctx);
          }
      } else {
          av_log(NULL, AV_LOG_ERROR, "[THUMB] Failed to alloc codec context\n");
      }
  } else {
      av_log(NULL, AV_LOG_ERROR, "[THUMB] No decoder found for codec_id %d\n", st->codecpar->codec_id);
  }
  
  ctx->frame = av_frame_alloc();
  ctx->rgb_frame = av_frame_alloc();
  
  if (!ctx->frame || !ctx->rgb_frame) {
      av_log(NULL, AV_LOG_ERROR, "[THUMB] Failed to alloc frames\n");
      return -8;
  }

  return 0;
}

/**
 * Seek and read keyframe - uses callback pattern
 * Reads frames until we get close to target timestamp
 */
EMSCRIPTEN_KEEPALIVE
void movi_thumbnail_read_keyframe(struct MoviThumbnailContext *ctx,
                                  double timestamp) {
  av_log(NULL, AV_LOG_DEBUG, "[THUMB] readKeyframe called: ts=%.2f\n", timestamp);

  if (!ctx || !ctx->fmt_ctx || !ctx->pkt) {
    av_log(NULL, AV_LOG_ERROR, "[THUMB] ERROR: null context\n");
    js_thumbnail_packet_ready(-1, 0.0);
    return;
  }
  if (ctx->video_stream_index < 0) {
    av_log(NULL, AV_LOG_ERROR, "[THUMB] ERROR: video_stream_index=%d\n",
            ctx->video_stream_index);
    js_thumbnail_packet_ready(-2, 0.0);
    return;
  }

  AVStream *st = ctx->fmt_ctx->streams[ctx->video_stream_index];
  int64_t target_ts = (int64_t)(timestamp * (double)st->time_base.den /
                                (double)st->time_base.num);
  
  // Adjust for stream start time (MPEG-TS, etc.)
  if (st->start_time != AV_NOPTS_VALUE) {
      target_ts += st->start_time;
  }

  int64_t seek_target = (int64_t)(timestamp * AV_TIME_BASE);
  // Adjust avformat_seek_file target for start_time
  if (ctx->fmt_ctx->start_time != AV_NOPTS_VALUE) {
      seek_target += ctx->fmt_ctx->start_time;
  }

  av_log(NULL, AV_LOG_DEBUG, "[THUMB] Seeking to ts=%lld (AV_TIME_BASE=%lld)\n", 
         (long long)target_ts, (long long)seek_target);

  // Flush AVIO buffer before seeking to ensure clean state
  if (ctx->avio_ctx) {
    avio_flush(ctx->avio_ctx);
  }

  // Use avformat_seek_file like the main player does - it's more robust
  int ret = avformat_seek_file(ctx->fmt_ctx, -1, INT64_MIN, seek_target,
                               seek_target, AVSEEK_FLAG_BACKWARD);
  
  if (ret < 0) {
    av_log(NULL, AV_LOG_WARNING, "[THUMB] avformat_seek_file failed, trying av_seek_frame\n");
    ret = av_seek_frame(ctx->fmt_ctx, ctx->video_stream_index, target_ts,
                        AVSEEK_FLAG_BACKWARD);
  }

  if (ret < 0) {
    av_log(NULL, AV_LOG_ERROR, "[THUMB] ERROR: seek failed\n");
    js_thumbnail_packet_ready(-3, 0.0);
    return;
  }

  // Flush after seek to clear internal buffers
  if (ctx->avio_ctx) {
    avio_flush(ctx->avio_ctx);
  }
  
  // Reset position from AVIO context
  if (ctx->fmt_ctx->pb) {
      int64_t current_pos = avio_tell(ctx->fmt_ctx->pb);
      ctx->position = current_pos;
  }

  av_log(NULL, AV_LOG_DEBUG,
          "[THUMB] Seek OK, reading packets to find closest keyframe...\n");

  // Allocate a packet to hold the best keyframe found
  AVPacket *best_pkt = av_packet_alloc();
  if (!best_pkt) {
      av_log(NULL, AV_LOG_ERROR, "[THUMB] ERROR: OOM for best_pkt\n");
      js_thumbnail_packet_ready(-4, 0.0);
      return;
  }

  // AVSEEK_FLAG_BACKWARD lands us on the keyframe at-or-before target_ts, so
  // the FIRST keyframe av_read_frame yields IS the closest one we want.
  //
  // The old loop kept scanning past it until current_pts > target_ts, hunting
  // for a "closer" keyframe. On 4K HDR HEVC the GOP is long (5-10s between
  // keyframes) and each frame is large, so that scan dragged the demuxer
  // through a whole GOP of packets — several MB of sequential 512KB range
  // fetches per hover (~5766MB→5770MB in the logs). That extra data is never
  // even used: we only ever render the single keyframe packet. Forward
  // keyframes are also strictly farther from target than the backward one,
  // so the scan couldn't improve the result either. Take the first keyframe
  // and stop — this is the bulk of the hover-vs-seek latency gap.
  int max_packets = 2000;
  int found_keyframe = 0;

  while (max_packets-- > 0) {
    int ret = av_read_frame(ctx->fmt_ctx, ctx->pkt);

    if (ret < 0) {
      av_log(NULL, AV_LOG_DEBUG, "[THUMB] EOF/error ret=%d, halting search\n", ret);
      break;
    }

    if (ctx->pkt->stream_index == ctx->video_stream_index) {
      // Check for keyframe
      if ((ctx->pkt->flags & AV_PKT_FLAG_KEY) && ctx->pkt->size > 0) {

        // Use PTS if available, otherwise DTS
        int64_t current_pts = (ctx->pkt->pts != AV_NOPTS_VALUE) ? ctx->pkt->pts : ctx->pkt->dts;

        av_log(NULL, AV_LOG_DEBUG,
                "[THUMB] Keyframe at pts=%lld (target=%lld) — taking it\n",
                (long long)current_pts, (long long)target_ts);

        // First keyframe after a BACKWARD seek is the closest-at-or-before
        // target. Save it and stop scanning.
        av_packet_unref(best_pkt);
        av_packet_ref(best_pkt, ctx->pkt);
        found_keyframe = 1;
        av_packet_unref(ctx->pkt);
        break;
      }
    }

    av_packet_unref(ctx->pkt);
  }

  // Use the best packet we found
  if (found_keyframe) {
    // Move ref from best_pkt to ctx->pkt (where get_packet_data expects it)
    av_packet_unref(ctx->pkt);
    av_packet_move_ref(ctx->pkt, best_pkt);
    
    // Calculate timestamp for callback
    double pts = 0.0;
    if (ctx->pkt->pts != AV_NOPTS_VALUE)
        pts = ctx->pkt->pts * av_q2d(st->time_base);
    else if (ctx->pkt->dts != AV_NOPTS_VALUE)
        pts = ctx->pkt->dts * av_q2d(st->time_base);
        
    ctx->last_packet_size = ctx->pkt->size;
    ctx->last_packet_pts = pts;

    av_log(NULL, AV_LOG_DEBUG,
            "[THUMB] SUCCESS: returning keyframe size=%d, pts=%.2f\n",
            ctx->pkt->size, pts);
            
    js_thumbnail_packet_ready(ctx->pkt->size, pts);
  } else {
      av_log(NULL, AV_LOG_ERROR, "[THUMB] No valid keyframe found after search\n");
      js_thumbnail_packet_ready(-6, 0.0);
  }

  av_packet_free(&best_pkt);
}

EMSCRIPTEN_KEEPALIVE
uint8_t *movi_thumbnail_get_packet_data(struct MoviThumbnailContext *ctx) {
  return (ctx && ctx->pkt) ? ctx->pkt->data : NULL;
}

/**
 * Get stream info with HDR metadata (like main pipeline)
 */
EMSCRIPTEN_KEEPALIVE
int movi_thumbnail_get_stream_info(struct MoviThumbnailContext *ctx, StreamInfo *info) {
  if (!ctx || !ctx->fmt_ctx || !info || ctx->video_stream_index < 0)
    return -1;

  AVStream *stream = ctx->fmt_ctx->streams[ctx->video_stream_index];
  AVCodecParameters *codecpar = stream->codecpar;

  memset(info, 0, sizeof(StreamInfo));
  info->index = ctx->video_stream_index;
  info->codec_id = codecpar->codec_id;
  info->profile = codecpar->profile;
  info->level = codecpar->level;

  const AVCodecDescriptor *desc = avcodec_descriptor_get(codecpar->codec_id);
  if (desc && desc->name)
    strncpy(info->codec_name, desc->name, sizeof(info->codec_name) - 1);

  info->type = STREAM_TYPE_VIDEO;
  info->width = codecpar->width;
  info->height = codecpar->height;
  if (stream->avg_frame_rate.den > 0)
    info->frame_rate = av_q2d(stream->avg_frame_rate);

  // HDR Color Metadata
  const char *prim = av_color_primaries_name(codecpar->color_primaries);
  if (prim) strncpy(info->color_primaries, prim, sizeof(info->color_primaries) - 1);

  const char *trc = av_color_transfer_name(codecpar->color_trc);
  if (trc) strncpy(info->color_transfer, trc, sizeof(info->color_transfer) - 1);

  const char *mtx = av_color_space_name(codecpar->color_space);
  if (mtx) strncpy(info->color_matrix, mtx, sizeof(info->color_matrix) - 1);

  // Pixel Format
  const char *pix = av_get_pix_fmt_name((enum AVPixelFormat)codecpar->format);
  if (pix) strncpy(info->pixel_format, pix, sizeof(info->pixel_format) - 1);

  // Color Range
  const char *range = av_color_range_name(codecpar->color_range);
  if (range) strncpy(info->color_range, range, sizeof(info->color_range) - 1);

  info->bit_rate = codecpar->bit_rate;
  info->extradata_size = codecpar->extradata_size;

  if (stream->duration != AV_NOPTS_VALUE)
    info->duration = stream->duration * av_q2d(stream->time_base);
  else if (ctx->fmt_ctx->duration != AV_NOPTS_VALUE)
    info->duration = (double)ctx->fmt_ctx->duration / AV_TIME_BASE;

  return 0;
}

/**
 * Get extradata for the video stream (codec configuration)
 */
EMSCRIPTEN_KEEPALIVE
int movi_thumbnail_get_extradata(struct MoviThumbnailContext *ctx, uint8_t *buffer, int buffer_size) {
  if (!ctx || !ctx->fmt_ctx || !buffer || ctx->video_stream_index < 0)
    return -1;

  AVCodecParameters *codecpar = ctx->fmt_ctx->streams[ctx->video_stream_index]->codecpar;
  if (!codecpar->extradata || codecpar->extradata_size <= 0)
    return 0;

  int copy_size = codecpar->extradata_size;
  if (copy_size > buffer_size)
    copy_size = buffer_size;

  memcpy(buffer, codecpar->extradata, copy_size);
  return copy_size;
}

/**
 * Decode frame and keep in YUV format (preserves HDR)
 * Returns 0 on success, negative on error
 */
EMSCRIPTEN_KEEPALIVE
int movi_thumbnail_decode_frame_yuv(struct MoviThumbnailContext *ctx) {
    if (!ctx || !ctx->dec_ctx || !ctx->pkt || ctx->pkt->size == 0) return -1;

    // CRITICAL: Flush decoder before sending new random-access packet
    // avcodec_flush_buffers(ctx->dec_ctx); // DISABLED: AV1 native decoder reset issue?

    // Decode
    int ret = avcodec_send_packet(ctx->dec_ctx, ctx->pkt);
    if (ret < 0) {
        av_log(NULL, AV_LOG_ERROR, "[THUMB] Decode send packet error: %d\n", ret);
        return ret;
    }

    ret = avcodec_receive_frame(ctx->dec_ctx, ctx->frame);

    // If decoder needs more data (EAGAIN), flush/drain
    if (ret == AVERROR(EAGAIN)) {
         avcodec_send_packet(ctx->dec_ctx, NULL);
         ret = avcodec_receive_frame(ctx->dec_ctx, ctx->frame);
    }

    if (ret < 0) {
         if (ret != AVERROR_EOF)
            av_log(NULL, AV_LOG_ERROR, "[THUMB] Decode receive frame error: %d\n", ret);
         return ret;
    }

    return 0;
}

/**
 * Get YUV plane data pointer (after successful decode)
 */
EMSCRIPTEN_KEEPALIVE
uint8_t *movi_thumbnail_get_plane_data(struct MoviThumbnailContext *ctx, int plane) {
    if (!ctx || !ctx->frame || plane < 0 || plane >= AV_NUM_DATA_POINTERS)
        return NULL;
    return ctx->frame->data[plane];
}

/**
 * Get YUV plane linesize
 */
EMSCRIPTEN_KEEPALIVE
int movi_thumbnail_get_plane_linesize(struct MoviThumbnailContext *ctx, int plane) {
    if (!ctx || !ctx->frame || plane < 0 || plane >= AV_NUM_DATA_POINTERS)
        return 0;
    return ctx->frame->linesize[plane];
}

/**
 * Get decoded frame dimensions
 */
EMSCRIPTEN_KEEPALIVE
int movi_thumbnail_get_frame_width(struct MoviThumbnailContext *ctx) {
    return (ctx && ctx->frame) ? ctx->frame->width : 0;
}

EMSCRIPTEN_KEEPALIVE
int movi_thumbnail_get_frame_height(struct MoviThumbnailContext *ctx) {
    return (ctx && ctx->frame) ? ctx->frame->height : 0;
}

/**
 * Legacy RGBA decode (for fallback)
 */
EMSCRIPTEN_KEEPALIVE
uint8_t *movi_thumbnail_decode_frame(struct MoviThumbnailContext *ctx, int width, int height) {
    if (!ctx || !ctx->pkt || ctx->pkt->size == 0) return NULL;
    
    if (!ctx->dec_ctx) {
        av_log(NULL, AV_LOG_ERROR, "[THUMB] Cannot decode: decoder not initialized\n");
        return NULL;
    }

    // Resize buffer if needed (RGBA = 4 bytes per pixel)
    int num_bytes = width * height * 4;

    if (ctx->rgb_buffer_size < num_bytes) {
        av_free(ctx->rgb_buffer);
        ctx->rgb_buffer = av_malloc(num_bytes);
        ctx->rgb_buffer_size = num_bytes;
    }

    // CRITICAL: Flush decoder before sending new random-access packet
    avcodec_flush_buffers(ctx->dec_ctx);

    // Decode
    int ret = avcodec_send_packet(ctx->dec_ctx, ctx->pkt);
    if (ret < 0) {
        av_log(NULL, AV_LOG_ERROR, "[THUMB] Decode send packet error: %d\n", ret);
        return NULL;
    }

    ret = avcodec_receive_frame(ctx->dec_ctx, ctx->frame);

    if (ret == AVERROR(EAGAIN)) {
         avcodec_send_packet(ctx->dec_ctx, NULL);
         ret = avcodec_receive_frame(ctx->dec_ctx, ctx->frame);
    }

    if (ret < 0) {
         if (ret != AVERROR_EOF)
            av_log(NULL, AV_LOG_ERROR, "[THUMB] Decode receive frame error: %d\n", ret);
         return NULL;
    }

    // SwsContext
    ctx->sws_ctx = sws_getCachedContext(ctx->sws_ctx,
        ctx->frame->width, ctx->frame->height, ctx->frame->format,
        width, height, AV_PIX_FMT_RGBA,
        SWS_BILINEAR, NULL, NULL, NULL);

    if (!ctx->sws_ctx) {
        av_log(NULL, AV_LOG_ERROR, "[THUMB] Failed to create SwsContext for format %d, size %dx%d\n", 
           ctx->frame->format, ctx->frame->width, ctx->frame->height);
        return NULL;
    }

    // Setup wrapper frame for buffer
    av_image_fill_arrays(ctx->rgb_frame->data, ctx->rgb_frame->linesize,
                         ctx->rgb_buffer, AV_PIX_FMT_RGBA, width, height, 1);

    sws_scale(ctx->sws_ctx, (const uint8_t *const *)ctx->frame->data,
              ctx->frame->linesize, 0, ctx->frame->height,
              ctx->rgb_frame->data, ctx->rgb_frame->linesize);

    return ctx->rgb_buffer;
}

/**
 * Clear RGB buffer to free memory after thumbnail generation
 * Call this from JS after copying the thumbnail data
 */
EMSCRIPTEN_KEEPALIVE
void movi_thumbnail_clear_buffer(struct MoviThumbnailContext *ctx) {
  if (!ctx) return;

  if (ctx->rgb_buffer) {
    av_free(ctx->rgb_buffer);
    ctx->rgb_buffer = NULL;
    ctx->rgb_buffer_size = 0;
    av_log(NULL, AV_LOG_DEBUG, "[THUMB] RGB buffer cleared\n");
  }
}

EMSCRIPTEN_KEEPALIVE
void movi_thumbnail_destroy(struct MoviThumbnailContext *ctx) {
  if (!ctx)
    return;

  if (ctx->dec_ctx) avcodec_free_context(&ctx->dec_ctx);
  if (ctx->frame) av_frame_free(&ctx->frame);
  if (ctx->rgb_frame) av_frame_free(&ctx->rgb_frame);
  if (ctx->sws_ctx) sws_freeContext(ctx->sws_ctx);
  if (ctx->rgb_buffer) av_free(ctx->rgb_buffer);

  if (ctx->pkt)
    av_packet_free(&ctx->pkt);
  if (ctx->fmt_ctx)
    avformat_close_input(&ctx->fmt_ctx);
  if (ctx->avio_ctx) {
    av_freep(&ctx->avio_ctx->buffer);
    avio_context_free(&ctx->avio_ctx);
  }

  free(ctx);
}
