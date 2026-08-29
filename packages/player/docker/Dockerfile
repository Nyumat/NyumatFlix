# syntax=docker/dockerfile:1
FROM --platform=linux/arm64 emscripten/emsdk:latest

LABEL maintainer="movi"
LABEL description="FFmpeg WASM build environment for movi"

# Install build dependencies (including meson/ninja for dav1d)
RUN apt-get update && apt-get install -y \
    git \
    make \
    pkg-config \
    meson \
    ninja-build \
    nasm \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src

# Clone dav1d AV1 decoder (software, works great in WASM)
ARG DAV1D_VERSION=1.5.3
RUN git clone --depth 1 --branch ${DAV1D_VERSION} https://code.videolan.org/videolan/dav1d.git /opt/dav1d

# Clone FFmpeg (will be mounted from host for dev, or cloned for CI)
ARG FFMPEG_VERSION=n8.1.2
RUN git clone --depth 1 --branch ${FFMPEG_VERSION} https://github.com/FFmpeg/FFmpeg.git /opt/FFmpeg

# Build script
COPY build-ffmpeg.sh /opt/build-ffmpeg.sh
RUN chmod +x /opt/build-ffmpeg.sh

ENV FFMPEG_SRC=/opt/FFmpeg

CMD ["/opt/build-ffmpeg.sh"]
