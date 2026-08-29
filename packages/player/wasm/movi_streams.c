#include "movi.h"

EMSCRIPTEN_KEEPALIVE
double movi_get_duration(MoviContext *ctx) {
  if (!ctx || !ctx->fmt_ctx)
    return 0.0;
  if (ctx->fmt_ctx->duration != AV_NOPTS_VALUE)
    return (double)ctx->fmt_ctx->duration / AV_TIME_BASE;
  return 0.0;
}

EMSCRIPTEN_KEEPALIVE
double movi_get_start_time(MoviContext *ctx) {
  if (!ctx || !ctx->fmt_ctx)
    return 0.0;
  if (ctx->fmt_ctx->start_time != AV_NOPTS_VALUE) {
    return (double)ctx->fmt_ctx->start_time / AV_TIME_BASE;
  }
  return 0.0;
}

EMSCRIPTEN_KEEPALIVE
int movi_get_stream_count(MoviContext *ctx) {
  return (ctx && ctx->fmt_ctx) ? ctx->fmt_ctx->nb_streams : 0;
}

EMSCRIPTEN_KEEPALIVE
int movi_get_stream_info(MoviContext *ctx, int stream_index, StreamInfo *info) {
  if (!ctx || !ctx->fmt_ctx || !info || stream_index < 0 ||
      stream_index >= (int)ctx->fmt_ctx->nb_streams)
    return -1;
  AVStream *stream = ctx->fmt_ctx->streams[stream_index];
  AVCodecParameters *codecpar = stream->codecpar;
  memset(info, 0, sizeof(StreamInfo));
  info->index = stream_index;
  info->codec_id = codecpar->codec_id;
  info->profile = codecpar->profile;
  info->level = codecpar->level;
  const AVCodecDescriptor *desc = avcodec_descriptor_get(codecpar->codec_id);
  if (desc && desc->name)
    strncpy(info->codec_name, desc->name, sizeof(info->codec_name) - 1);
  switch (codecpar->codec_type) {
  case AVMEDIA_TYPE_VIDEO:
    info->type = STREAM_TYPE_VIDEO;
    info->width = codecpar->width;
    info->height = codecpar->height;
    if (stream->avg_frame_rate.den > 0)
      info->frame_rate = av_q2d(stream->avg_frame_rate);
    
    // Color Metadata for HDR
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
    break;
  case AVMEDIA_TYPE_AUDIO:
    info->type = STREAM_TYPE_AUDIO;
    info->channels = codecpar->ch_layout.nb_channels;
    info->sample_rate = codecpar->sample_rate;
    break;
  case AVMEDIA_TYPE_SUBTITLE:
    info->type = STREAM_TYPE_SUBTITLE;
    break;
  default:
    info->type = STREAM_TYPE_UNKNOWN;
  }
  info->bit_rate = codecpar->bit_rate;
  info->extradata_size = codecpar->extradata_size;
  if (stream->duration != AV_NOPTS_VALUE)
    info->duration = stream->duration * av_q2d(stream->time_base);
  else if (ctx->fmt_ctx->duration != AV_NOPTS_VALUE)
    info->duration = (double)ctx->fmt_ctx->duration / AV_TIME_BASE;

  // Extract language from metadata
  AVDictionaryEntry *lang_tag =
      av_dict_get(stream->metadata, "language", NULL, 0);
  if (lang_tag && lang_tag->value) {
    strncpy(info->language, lang_tag->value, sizeof(info->language) - 1);
    info->language[sizeof(info->language) - 1] = '\0';
  } else {
    info->language[0] = '\0';
  }

  // Extract label from metadata (try "title" first, then "handler_name")
  AVDictionaryEntry *label_tag =
      av_dict_get(stream->metadata, "title", NULL, 0);
  if (!label_tag || !label_tag->value) {
    label_tag = av_dict_get(stream->metadata, "handler_name", NULL, 0);
  }
  if (label_tag && label_tag->value) {
    strncpy(info->label, label_tag->value, sizeof(info->label) - 1);
    info->label[sizeof(info->label) - 1] = '\0';
  } else {
    info->label[0] = '\0';
  }

  // Extract rotation from display matrix side data
  // Use av_packet_side_data_get to iterate stream side data
  int32_t *display_matrix = NULL;
  
  const AVPacketSideData *sd = av_packet_side_data_get(codecpar->coded_side_data, codecpar->nb_coded_side_data, AV_PKT_DATA_DISPLAYMATRIX);
  if (sd && sd->size >= 9 * 4) {
      display_matrix = (int32_t *)sd->data;
  }
  
  if (display_matrix) {
      double rotation = -av_display_rotation_get(display_matrix);
      // Normalize rotation (e.g. -90 becomes 270)
      if (rotation < 0) rotation += 360;
      info->rotation = (int)round(rotation) % 360;
  } else {
      info->rotation = 0;
  }

  // Extract 360° spherical projection from side data (MP4 sv3d/st3d, Matroska
  // ProjectionType — the Google Spherical Video metadata). Stored as
  // projection+1 so 0 unambiguously means "no spherical metadata".
  const AVPacketSideData *spherical = av_packet_side_data_get(
      codecpar->coded_side_data, codecpar->nb_coded_side_data,
      AV_PKT_DATA_SPHERICAL);
  if (spherical && spherical->data &&
      spherical->size >= sizeof(AVSphericalMapping)) {
      const AVSphericalMapping *mapping =
          (const AVSphericalMapping *)spherical->data;
      info->projection = (int)mapping->projection + 1;
  } else {
      info->projection = 0;
  }

  return 0;
}

EMSCRIPTEN_KEEPALIVE
int movi_get_extradata(MoviContext *ctx, int stream_index, uint8_t *buffer,
                       int buffer_size) {
  if (!ctx || !ctx->fmt_ctx || !buffer || stream_index < 0 ||
      stream_index >= (int)ctx->fmt_ctx->nb_streams)
    return -1;
  AVCodecParameters *codecpar = ctx->fmt_ctx->streams[stream_index]->codecpar;
  if (!codecpar->extradata || codecpar->extradata_size <= 0)
    return 0;
  int copy_size = codecpar->extradata_size;
  if (copy_size > buffer_size)
    copy_size = buffer_size;
  memcpy(buffer, codecpar->extradata, copy_size);
  return copy_size;
}

EMSCRIPTEN_KEEPALIVE
int movi_seek_to(MoviContext *ctx, double timestamp, int stream_index,
                 int flags) {
  if (!ctx || !ctx->fmt_ctx)
    return -1;

  // Flush AVIO buffer before seeking to ensure clean state
  // This is critical for large files (>= 2GB) to prevent sequential reads
  // Without flushing, FFmpeg might read from cached buffer instead of seeking
  if (ctx->avio_ctx) {
    avio_flush(ctx->avio_ctx);
  }

  // Ensure we seek to keyframe (BACKWARD flag) to avoid decoder errors
  // This is especially important for Matroska/WebM formats
  int seek_flags = flags;
  if (!(seek_flags & AVSEEK_FLAG_ANY)) {
    // If not explicitly requesting ANY frame, ensure we seek to keyframe
    seek_flags |= AVSEEK_FLAG_BACKWARD;
  }

  int64_t seek_target = (int64_t)(timestamp * AV_TIME_BASE);
  // Use INT64_MAX for max_ts to allow FFmpeg to find the nearest keyframe
  // The BACKWARD flag ensures we prefer positions at or before seek_target
  // Using seek_target as max_ts was too restrictive and caused seeks to fail
  // or jump to EOF when no keyframe exactly matched the target position
  int ret = avformat_seek_file(ctx->fmt_ctx, -1, INT64_MIN, seek_target,
                               INT64_MAX, seek_flags);
  if (ret < 0) {
    // Fallback to av_seek_frame if avformat_seek_file fails
    ret = av_seek_frame(ctx->fmt_ctx, -1, seek_target, seek_flags);
  }

  // After seek, clear stale EOF state.
  //
  // Do NOT avio_flush() here. On a *read* context, avio_flush() discards the
  // AVIO buffer WITHOUT rewinding s->pos (see FFmpeg aviobuf.c: seekback is
  // forced to 0 for read). After avformat_seek_file, the raw-audio demuxer has
  // already read ahead to resync to the next sync frame; that data lives in the
  // AVIO buffer waiting to be parsed into the first post-seek packets. Flushing
  // it throws the read-ahead away, so the stream silently jumps forward by the
  // buffered amount and hits EOF early — duration appears to shrink and seeks
  // near the end of audio-only (eac3/ac3/mp3) files end prematurely. Indexed
  // video seeks don't trip this because they don't do byte-estimate resync.
  if (ret >= 0) {
    // CRITICAL: Clear AVIO eof_reached flag after successful seek.
    // Without this, a prior EOF (e.g. from poster-frame reads reaching end
    // of a short file) causes av_read_frame to immediately return EOF even
    // though we just seeked back to a valid position.
    if (ctx->fmt_ctx->pb) {
      ctx->fmt_ctx->pb->eof_reached = 0;
    }

    // For Matroska/WebM format, we need to ensure resync position is set
    // This helps avoid EBML parsing errors after seek
    const char *format_name =
        ctx->fmt_ctx->iformat ? ctx->fmt_ctx->iformat->name : NULL;
    if (format_name && (strcmp(format_name, "matroska,webm") == 0 ||
                        strcmp(format_name, "webm") == 0 ||
                        strcmp(format_name, "matroska") == 0)) {
      // Reset internal format state by flushing and ensuring clean position
      // The format demuxer will handle resync on next read
      // IMPORTANT: Use int64_t for position to handle files >= 2GB
      if (ctx->fmt_ctx->pb) {
        int64_t current_pos = avio_tell(ctx->fmt_ctx->pb);
        // Ensure position tracking uses 64-bit arithmetic for large files
        ctx->position = current_pos;
        // Small backward seek to ensure we're at a valid EBML boundary
        // This helps Matroska resync properly after seek for large files
        if (current_pos > 0 && current_pos < ctx->file_size) {
          avio_seek(ctx->fmt_ctx->pb, current_pos, SEEK_SET);
        }
      }
    }
    // For non-Matroska formats, do NOT overwrite ctx->position here.
    // ctx->position is the source-side *physical* read cursor; FFmpeg already
    // keeps it in sync via avio_seek_callback / avio_read_callback during the
    // seek. avio_tell() returns the *logical consume* position, which trails
    // the physical cursor by whatever the demuxer read ahead to resync to the
    // next sync frame (raw eac3/ac3/mp3 etc.). Clobbering the cursor with that
    // smaller value makes the source replay buffered bytes and hit EOF early
    // by ~the read-ahead amount — duration appears to shrink near the end.
  }

  return ret;
}

// Find the first VCL slice NAL in a (possibly multi-NAL) packet and return its
// raw nal_unit_type — HEVC: (byte0 >> 1) & 0x3F (VCL = 0..31); H.264: byte0 &
// 0x1F (VCL = 1..5). Returns -1 if no VCL slice is found, the packet is too
// small, or the codec isn't H.264/HEVC.
//
// CRITICAL: a packet is NOT just one NAL. In MKV/MP4 a keyframe is typically
// [AUD][VPS][SPS][PPS][SEI…][slice…]. Reading only the first NAL (an AUD/PS)
// always misclassifies — we must walk every NAL and inspect the first VCL one.
// Packets may be Annex B (00 00 01 start codes) or length-prefixed (4-byte
// big-endian, hvcC/avcC). We detect which by probing for a leading start code.
static int movi_first_vcl_nal_type(enum AVCodecID codec_id, const uint8_t *data,
                                   int size) {
  if (!data || size < 5)
    return -1; // too small to inspect

  if (codec_id != AV_CODEC_ID_HEVC && codec_id != AV_CODEC_ID_H264)
    return -1; // only H.264/HEVC carry the NAL types we classify

  // Detect format: Annex B if the packet starts with a 3- or 4-byte start code.
  int is_annexb = (data[0] == 0 && data[1] == 0 &&
                   (data[2] == 1 || (data[2] == 0 && data[3] == 1)));

  int i = 0;
  if (is_annexb) {
    // Walk NAL units delimited by 00 00 01 / 00 00 00 01 start codes.
    while (i + 3 < size) {
      // Find next start code.
      if (data[i] == 0 && data[i + 1] == 0 && data[i + 2] == 1) {
        int nal_off = i + 3;
        if (nal_off >= size)
          break;
        int hdr = data[nal_off];
        int t = (codec_id == AV_CODEC_ID_HEVC) ? ((hdr >> 1) & 0x3F)
                                               : (hdr & 0x1F);
        int is_vcl = (codec_id == AV_CODEC_ID_HEVC) ? (t >= 0 && t <= 31)
                                                    : (t >= 1 && t <= 5);
        if (is_vcl)
          return t; // first VCL slice decides
        i = nal_off + 1;
      } else {
        i++;
      }
    }
  } else {
    // Length-prefixed (4-byte big-endian length before each NAL).
    while (i + 4 < size) {
      uint32_t nal_len = ((uint32_t)data[i] << 24) | ((uint32_t)data[i + 1] << 16) |
                         ((uint32_t)data[i + 2] << 8) | (uint32_t)data[i + 3];
      int nal_off = i + 4;
      if (nal_len == 0 || nal_off >= size)
        break;
      int hdr = data[nal_off];
      int t = (codec_id == AV_CODEC_ID_HEVC) ? ((hdr >> 1) & 0x3F)
                                             : (hdr & 0x1F);
      int is_vcl = (codec_id == AV_CODEC_ID_HEVC) ? (t >= 0 && t <= 31)
                                                  : (t >= 1 && t <= 5);
      if (is_vcl)
        return t;
      i = nal_off + (int)nal_len; // advance past this NAL
    }
  }

  return -1; // no VCL slice found
}

// Classify whether a keyframe packet is a TRUE random-access point that a
// hardware WebCodecs decoder will accept as a `key` chunk.
//
// FFmpeg flags both closed-GOP IDR and open-GOP CRA pictures as AV_PKT_FLAG_KEY,
// but WebCodecs rejects a CRA sent as `key` ("wasn't a key frame") because its
// leading RASL pictures reference the previous GOP. We tell them apart by the
// first VCL slice NAL type:
//   HEVC: 19/20 = IDR, 16-18 = BLA (true RAP). 21 = CRA (open-GOP) — not a key.
//   H.264: 5 = IDR (true key).
//
// Returns 1 if the keyframe is a true IDR/BLA random-access point, 0 otherwise.
// Falls back to 1 (safe default: assume true key) when no VCL slice is found or
// the codec isn't H.264/HEVC, so we never wedge waiting for an IDR we failed to
// recognize.
static int movi_packet_is_idr(enum AVCodecID codec_id, const uint8_t *data,
                              int size) {
  if (codec_id != AV_CODEC_ID_HEVC && codec_id != AV_CODEC_ID_H264)
    return 1; // other codecs: honor container keyframe flag

  int t = movi_first_vcl_nal_type(codec_id, data, size);
  if (t < 0)
    return 1; // too small / no VCL slice — assume true key (safe default)

  if (codec_id == AV_CODEC_ID_HEVC)
    return (t == 19 || t == 20 || t == 16 || t == 17 || t == 18) ? 1 : 0;
  return (t == 5) ? 1 : 0; // H.264 IDR
}

// Classify whether a packet is an HEVC RASL leading picture (NAL type 8=RASL_N
// / 9=RASL_R). RASL pictures trail a CRA in decode order but reference the
// pre-CRA GOP; when the CRA is a random-access resume (references flushed) they
// are orphaned and must be discarded (NoRaslOutputFlag=1). Chrome drops them
// internally; Safari/VideoToolbox throws a hard EncodingError — so JS skips
// them after a CRA resume. HEVC only; 0 for every other codec and NAL type.
static int movi_packet_is_rasl(enum AVCodecID codec_id, const uint8_t *data,
                               int size) {
  if (codec_id != AV_CODEC_ID_HEVC)
    return 0;
  int t = movi_first_vcl_nal_type(codec_id, data, size);
  return (t == 8 || t == 9) ? 1 : 0;
}

int movi_read_frame(MoviContext *ctx, PacketInfo *info, uint8_t *buffer,
                    int buffer_size) {
  if (!ctx || !ctx->fmt_ctx || !ctx->pkt || !info || !buffer)
    return -1;
  av_packet_unref(ctx->pkt);
  int ret = av_read_frame(ctx->fmt_ctx, ctx->pkt);
  if (ret < 0)
    return (ret == AVERROR_EOF) ? 0 : ret;
  if (ctx->pkt->stream_index < 0 ||
      ctx->pkt->stream_index >= (int)ctx->fmt_ctx->nb_streams)
    return 0;
  AVStream *stream = ctx->fmt_ctx->streams[ctx->pkt->stream_index];
  info->stream_index = ctx->pkt->stream_index;
  info->keyframe = (ctx->pkt->flags & AV_PKT_FLAG_KEY) != 0;
  // Distinguish true IDR/BLA random-access keyframes from open-GOP CRA frames
  // so JS can send CRA as `delta` and keep the hardware decoder running. Only
  // meaningful for keyframes; non-keyframes carry is_idr = 0.
  if (info->keyframe)
    info->is_idr =
        movi_packet_is_idr(stream->codecpar->codec_id, ctx->pkt->data,
                           ctx->pkt->size);
  else
    info->is_idr = 0;
  // Flag HEVC RASL leading pictures so JS can drop the orphaned ones after a
  // CRA/BLA random-access resume (Safari hard-errors on them). Keyframes are
  // never RASL; non-HEVC codecs always carry is_rasl = 0.
  info->is_rasl =
      info->keyframe
          ? 0
          : movi_packet_is_rasl(stream->codecpar->codec_id, ctx->pkt->data,
                                ctx->pkt->size);
  if (ctx->pkt->pts != AV_NOPTS_VALUE)
    info->timestamp = ctx->pkt->pts * av_q2d(stream->time_base);
  else if (ctx->pkt->dts != AV_NOPTS_VALUE)
    info->timestamp = ctx->pkt->dts * av_q2d(stream->time_base);
  else
    info->timestamp = 0.0;

  if (ctx->pkt->dts != AV_NOPTS_VALUE)
    info->dts = ctx->pkt->dts * av_q2d(stream->time_base);
  else
    info->dts = info->timestamp;

  if (ctx->pkt->duration > 0)
    info->duration = ctx->pkt->duration * av_q2d(stream->time_base);
  else if (stream->avg_frame_rate.num > 0 && stream->avg_frame_rate.den > 0)
    info->duration = 1.0 / av_q2d(stream->avg_frame_rate);
  else
    info->duration = 0.0;

  // AV1 Temporal Delimiter prepend: MP4/ISOBMFF stores one temporal unit per
  // sample and strips the Temporal Delimiter OBU, but the WebCodecs low-overhead
  // bitstream format (per the AV1 codec registration / ISOBMFF binding) expects
  // each chunk to be a complete temporal unit. Prepend a TD OBU (0x12 0x00 =
  // type TEMPORAL_DELIMITER, has_size=1, payload size 0) when the packet doesn't
  // already start with one, so every chunk is a well-formed temporal unit.
  // NOTE: this is for spec-compliant packaging; it does NOT cure the separate,
  // non-deterministic HW-decoder crash on bare show_existing_frame OBUs (~3-byte
  // re-display frames) — that originates inside Chrome's AV1 decoder and still
  // recovers via decoder recreate. Harmless to keep: all frames decode with it.
  int td_prepend = 0;
  if (stream->codecpar->codec_id == AV_CODEC_ID_AV1 && ctx->pkt->size >= 1) {
    int obu_type = (ctx->pkt->data[0] >> 3) & 0x0f;
    if (obu_type != 2) // 2 = OBU_TEMPORAL_DELIMITER; only add if missing
      td_prepend = 1;
  }

  int copy_size = ctx->pkt->size + (td_prepend ? 2 : 0);
  if (copy_size > buffer_size) {
    // Log error or return specific code to signal buffer too small
    return AVERROR(ENOBUFS);
  }
  if (td_prepend) {
    buffer[0] = 0x12; // TD OBU header: obu_type=2, obu_has_size_field=1
    buffer[1] = 0x00; // leb128 payload size = 0
    memcpy(buffer + 2, ctx->pkt->data, ctx->pkt->size);
  } else {
    memcpy(buffer, ctx->pkt->data, ctx->pkt->size);
  }
  // info->size must reflect the actual emitted byte count (incl. any prepended
  // TD), because JS slices the packet buffer by info->size — not by this
  // return value.
  info->size = copy_size;
  return copy_size;
}

// Chapter support
EMSCRIPTEN_KEEPALIVE
int movi_get_chapter_count(MoviContext *ctx) {
  if (!ctx || !ctx->fmt_ctx)
    return 0;
  return (int)ctx->fmt_ctx->nb_chapters;
}

EMSCRIPTEN_KEEPALIVE
double movi_get_chapter_start(MoviContext *ctx, int index) {
  if (!ctx || !ctx->fmt_ctx || index < 0 || index >= (int)ctx->fmt_ctx->nb_chapters)
    return -1.0;
  AVChapter *ch = ctx->fmt_ctx->chapters[index];
  return ch->start * av_q2d(ch->time_base);
}

EMSCRIPTEN_KEEPALIVE
double movi_get_chapter_end(MoviContext *ctx, int index) {
  if (!ctx || !ctx->fmt_ctx || index < 0 || index >= (int)ctx->fmt_ctx->nb_chapters)
    return -1.0;
  AVChapter *ch = ctx->fmt_ctx->chapters[index];
  return ch->end * av_q2d(ch->time_base);
}

EMSCRIPTEN_KEEPALIVE
int movi_get_chapter_title(MoviContext *ctx, int index, char *buffer, int buffer_size) {
  if (!ctx || !ctx->fmt_ctx || !buffer || buffer_size <= 0 ||
      index < 0 || index >= (int)ctx->fmt_ctx->nb_chapters)
    return 0;
  AVChapter *ch = ctx->fmt_ctx->chapters[index];
  const AVDictionaryEntry *entry = av_dict_get(ch->metadata, "title", NULL, 0);
  if (entry && entry->value) {
    strncpy(buffer, entry->value, buffer_size - 1);
    buffer[buffer_size - 1] = '\0';
    return (int)strlen(buffer);
  }
  buffer[0] = '\0';
  return 0;
}
