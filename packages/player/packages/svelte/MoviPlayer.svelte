<!--
  @movi-player/svelte — a thin Svelte wrapper around the <movi-player> web
  component. Svelte forwards attributes and events to custom elements natively,
  so this mostly registers the element, binds a ref, and re-forwards events.

    <script>
      import MoviPlayer from "@movi-player/svelte";
    </script>
    <MoviPlayer src="video.mkv" controls autoplay on:movi-qoe={(e) => console.log(e.detail)} />
-->
<script lang="ts">
  import "movi-player/element"; // registers <movi-player> (side effect)
  import type { MoviElement } from "movi-player/element";

  /** The underlying element instance (bind:element to reach the player API). */
  export let element: MoviElement | null = null;
</script>

<movi-player
  bind:this={element}
  {...$$restProps}
  on:timeupdate
  on:play
  on:pause
  on:ended
  on:error
  on:movi-qoe
/>
