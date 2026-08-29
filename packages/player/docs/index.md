---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "Movi-Player"
  text: "Modern Video Player for the Web"
  tagline: WebCodecs + FFmpeg WASM powered. HDR, ambient mode, PiP, encrypted playback. No server processing.
  image:
    src: /logo.svg
    alt: Movi-Player
  actions:
    - theme: brand
      text: Get Started →
      link: /guide/getting-started
    - theme: alt
      text: Live Demo
      link: https://movi-player-examples.vercel.app/
    - theme: alt
      text: View on GitHub
      link: https://github.com/MrUjjwalG/movi-player

features:
  - icon: ⚡
    title: Hardware-First Decoding
    details: WebCodecs API with automatic FFmpeg WASM fallback for universal browser support.
  - icon: 🌈
    title: HDR Support
    details: Full HDR10, HLG, BT.2020 metadata extraction and Display-P3 rendering.
  - icon: 🎯
    title: Modular Design
    details: Use only what you need — demuxer (45KB), player (180KB), or full element (410KB).
  - icon: 🚀
    title: No Server Required
    details: All video parsing, demuxing, and decoding happens entirely in the browser.
  - icon: 📦
    title: Universal Format Support
    details: MP4, MKV, WebM, MOV, MPEG-TS, and more via FFmpeg WASM.
  - icon: 🔄
    title: Multi-Track Support
    details: Multiple audio and subtitle tracks without any conversion or processing.
  - icon: 🎨
    title: Ambient Mode
    details: Dynamic letterbox glow that samples video colors in real-time with smooth 60fps transitions.
  - icon: 🖼️
    title: Picture-in-Picture
    details: Document PiP with full controls — play/pause, seek, mute, progress bar. Press P.
  - icon: 🔒
    title: Content Protection
    details: AES-256-GCM encrypted playback, DRM via Widevine/FairPlay, canvas-based rendering.
---

<div style="margin-top: 60px; display: flex; flex-direction: column; align-items: center;">
  <h2 style="font-size: 32px; font-weight: 700; margin-bottom: 8px; text-align: center;">Professional UI Out of the Box</h2>
  <p style="opacity: .7; margin-bottom: 24px; text-align: center; max-width: 620px;">A real <code>&lt;movi-player&gt;</code> element, decoding an MKV right here in your browser — no plugins, no server. It plays HEVC, AV1 and HDR the same way.</p>
  <iframe
    src="/movi-player/demo-embed.html"
    title="Live Movi-Player demo"
    loading="lazy"
    allow="fullscreen; picture-in-picture; autoplay"
    allowfullscreen
    style="width: 100%; max-width: 900px; aspect-ratio: 16/9; border-radius: 12px; box-shadow: 0 20px 50px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); background: #000;"
  ></iframe>
</div>

<style>
:root {
  --vp-home-hero-name-color: transparent;
  --vp-home-hero-name-background: -webkit-linear-gradient(120deg, #6c5dd3 30%, #4a3bba);
  --vp-home-hero-image-background-image: linear-gradient(-45deg, #6c5dd350 50%, #4a3bba50 50%);
  --vp-home-hero-image-filter: blur(44px);
}

@media (min-width: 640px) {
  :root {
    --vp-home-hero-image-filter: blur(56px);
  }
}

@media (min-width: 960px) {
  :root {
    --vp-home-hero-image-filter: blur(68px);
  }
}
</style>
