/**
 * @movi-player/react — a thin, typed React wrapper around the <movi-player>
 * web component. Reflects props → attributes/properties, wires the player's
 * events to React callbacks, and forwards a ref to the underlying element.
 *
 *   import { MoviPlayer } from "@movi-player/react";
 *   <MoviPlayer src="video.mkv" controls autoplay onQoe={console.log} />
 */
import * as React from "react";
import "movi-player/element"; // registers <movi-player> (side effect)
import type {
  MoviElement,
  MoviPlayerAttributes,
  QoEEvent,
} from "movi-player/element";

export type { MoviElement, QoEEvent };

export interface MoviPlayerProps extends MoviPlayerAttributes {
  className?: string;
  style?: React.CSSProperties;
  /** Fires once the element is mounted, with the element instance. */
  onReady?: (el: MoviElement) => void;
  onQoe?: (event: QoEEvent) => void;
  onTimeUpdate?: (time: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onError?: (error: unknown) => void;
}

const EVENT_PROPS = new Set([
  "onReady",
  "onQoe",
  "onTimeUpdate",
  "onPlay",
  "onPause",
  "onEnded",
  "onError",
  "className",
  "style",
]);

export const MoviPlayer = React.forwardRef<MoviElement, MoviPlayerProps>(
  function MoviPlayer(props, ref) {
    const elRef = React.useRef<MoviElement | null>(null);
    React.useImperativeHandle(ref, () => elRef.current as MoviElement, []);

    // Reflect declarative attributes onto the element every render. Booleans
    // become presence/absence; everything else becomes a string attribute.
    React.useEffect(() => {
      const el = elRef.current;
      if (!el) return;
      for (const [key, value] of Object.entries(props)) {
        if (EVENT_PROPS.has(key) || value === undefined || value === null) continue;
        const attr = key.toLowerCase();
        if (typeof value === "boolean") {
          if (value) el.setAttribute(attr, "");
          else el.removeAttribute(attr);
        } else {
          el.setAttribute(attr, String(value));
        }
      }
    });

    // Bridge web-component events to React callbacks.
    React.useEffect(() => {
      const el = elRef.current;
      if (!el) return;
      const listeners: Array<[string, EventListener]> = [];
      const add = (name: string, fn?: (detail: any) => void) => {
        if (!fn) return;
        const l: EventListener = (e) => fn((e as CustomEvent).detail);
        el.addEventListener(name, l);
        listeners.push([name, l]);
      };
      add("movi-qoe", props.onQoe);
      add("timeupdate", props.onTimeUpdate);
      if (props.onPlay) add("play", () => props.onPlay!());
      if (props.onPause) add("pause", () => props.onPause!());
      if (props.onEnded) add("ended", () => props.onEnded!());
      add("error", props.onError);
      props.onReady?.(el);
      return () => listeners.forEach(([n, l]) => el.removeEventListener(n, l));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      props.onQoe,
      props.onTimeUpdate,
      props.onPlay,
      props.onPause,
      props.onEnded,
      props.onError,
      props.onReady,
    ]);

    // createElement avoids needing a JSX.IntrinsicElements augmentation for the
    // custom tag; React passes unknown props straight through as attributes.
    return React.createElement("movi-player", {
      ref: elRef,
      className: props.className,
      style: props.style,
    });
  },
);
