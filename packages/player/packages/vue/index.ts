/**
 * @movi-player/vue — a thin, typed Vue 3 wrapper around the <movi-player> web
 * component. Reflects props → attributes, wires the player's events to Vue
 * emits, and exposes the underlying element via a template ref.
 *
 *   import { MoviPlayer } from "@movi-player/vue";
 *   <MoviPlayer src="video.mkv" controls autoplay @qoe="onQoe" />
 *
 * Note: register `movi-player` as a custom element in your Vue build so it
 * isn't treated as a component, e.g.
 *   app.config.compilerOptions.isCustomElement = (t) => t === "movi-player";
 * (or the equivalent `@vitejs/plugin-vue` option). This wrapper renders it via
 * a render function, so the flag is only needed if you also use the raw tag.
 */
import {
  defineComponent,
  h,
  ref,
  onMounted,
  onBeforeUnmount,
  watchEffect,
  type PropType,
} from "vue";
import "movi-player/element";
import type { MoviElement, QoEEvent } from "movi-player/element";

export const MoviPlayer = defineComponent({
  name: "MoviPlayer",
  inheritAttrs: false,
  props: {
    src: String,
    poster: String,
    theme: String as PropType<"dark" | "light">,
    themecolor: String,
    volume: [Number, String],
    playbackrate: [Number, String],
    controls: { type: Boolean, default: undefined },
    autoplay: { type: Boolean, default: undefined },
    loop: { type: Boolean, default: undefined },
    muted: { type: Boolean, default: undefined },
    playsinline: { type: Boolean, default: undefined },
  },
  emits: ["ready", "qoe", "timeupdate", "play", "pause", "ended", "error"],
  setup(props, { attrs, emit, expose }) {
    const elRef = ref<MoviElement | null>(null);
    expose({ element: elRef });

    // Reflect props + passthrough attrs onto the element.
    watchEffect(() => {
      const el = elRef.value;
      if (!el) return;
      const all: Record<string, unknown> = { ...attrs, ...props };
      for (const [key, value] of Object.entries(all)) {
        if (value === undefined || value === null) continue;
        const attr = key.toLowerCase();
        if (typeof value === "boolean") {
          if (value) el.setAttribute(attr, "");
          else el.removeAttribute(attr);
        } else {
          el.setAttribute(attr, String(value));
        }
      }
    });

    const listeners: Array<[string, EventListener]> = [];
    onMounted(() => {
      const el = elRef.value;
      if (!el) return;
      const bridge = (dom: string, vue: string) => {
        const l: EventListener = (e) => emit(vue as any, (e as CustomEvent).detail);
        el.addEventListener(dom, l);
        listeners.push([dom, l]);
      };
      bridge("movi-qoe", "qoe");
      bridge("timeupdate", "timeupdate");
      bridge("play", "play");
      bridge("pause", "pause");
      bridge("ended", "ended");
      bridge("error", "error");
      emit("ready", el);
    });
    onBeforeUnmount(() => {
      const el = elRef.value;
      listeners.forEach(([n, l]) => el?.removeEventListener(n, l));
    });

    return () => h("movi-player", { ref: elRef });
  },
});

export type { MoviElement, QoEEvent };
