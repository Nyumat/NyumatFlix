<!-- Minimal Vue 3 example for @movi-player/vue.
     Run inside any Vite Vue app:  npm i movi-player @movi-player/vue -->
<script setup lang="ts">
import { ref } from "vue";
import { MoviPlayer, type MoviElement, type QoEEvent } from "@movi-player/vue";

const player = ref<{ element: MoviElement | null }>();
const qoe = ref<QoEEvent[]>([]);

function onQoe(e: QoEEvent) {
  qoe.value = [e, ...qoe.value].slice(0, 8);
}
function boost() {
  if (player.value?.element) player.value.element.volume = 2;
}
</script>

<template>
  <div style="max-width: 900px; margin: 2rem auto; font-family: system-ui">
    <h1>movi-player · Vue</h1>

    <MoviPlayer
      ref="player"
      src="https://moviplayer.com/sample.mkv"
      controls
      autoplay
      muted
      theme="dark"
      style="width: 100%; aspect-ratio: 16 / 9; border-radius: 12px"
      @qoe="onQoe"
      @ready="(el) => console.log('ready — duration:', el.duration)"
    />

    <div style="margin-top: 12px; display: flex; gap: 8px">
      <button @click="player?.element?.play()">Play</button>
      <button @click="player?.element?.pause()">Pause</button>
      <button @click="boost">Boost 200%</button>
      <button @click="console.log(player?.element?.getQoeSession())">
        Log QoE session
      </button>
    </div>

    <h3>QoE stream</h3>
    <ul>
      <li v-for="(e, i) in qoe" :key="i"><code>{{ JSON.stringify(e) }}</code></li>
    </ul>
  </div>
</template>
