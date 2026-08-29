#include "movi.h"

EMSCRIPTEN_KEEPALIVE
int movi_get_frame_width(MoviContext *ctx) {
  return ctx->frame ? ctx->frame->width : 0;
}
EMSCRIPTEN_KEEPALIVE
int movi_get_frame_height(MoviContext *ctx) {
  return ctx->frame ? ctx->frame->height : 0;
}
EMSCRIPTEN_KEEPALIVE
int movi_get_frame_format(MoviContext *ctx) {
  return ctx->frame ? ctx->frame->format : 0;
}

EMSCRIPTEN_KEEPALIVE
uint8_t *movi_get_frame_data(MoviContext *ctx, int plane) {
  return (ctx->frame && plane >= 0 && plane < AV_NUM_DATA_POINTERS)
             ? ctx->frame->data[plane]
             : NULL;
}

EMSCRIPTEN_KEEPALIVE
int movi_get_frame_linesize(MoviContext *ctx, int plane) {
  return (ctx->frame && plane >= 0 && plane < AV_NUM_DATA_POINTERS)
             ? ctx->frame->linesize[plane]
             : 0;
}

EMSCRIPTEN_KEEPALIVE
int movi_get_frame_samples(MoviContext *ctx) {
  return ctx->frame ? ctx->frame->nb_samples : 0;
}
EMSCRIPTEN_KEEPALIVE
int movi_get_frame_channels(MoviContext *ctx) {
  return ctx->frame ? ctx->frame->ch_layout.nb_channels : 0;
}
EMSCRIPTEN_KEEPALIVE
int movi_get_frame_sample_rate(MoviContext *ctx) {
  return ctx->frame ? ctx->frame->sample_rate : 0;
}
