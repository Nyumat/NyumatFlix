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

    const onReadyRef = React.useRef(props.onReady);
    const onQoeRef = React.useRef(props.onQoe);
    const onTimeUpdateRef = React.useRef(props.onTimeUpdate);
    const onPlayRef = React.useRef(props.onPlay);
    const onPauseRef = React.useRef(props.onPause);
    const onEndedRef = React.useRef(props.onEnded);
    const onErrorRef = React.useRef(props.onError);
    onReadyRef.current = props.onReady;
    onQoeRef.current = props.onQoe;
    onTimeUpdateRef.current = props.onTimeUpdate;
    onPlayRef.current = props.onPlay;
    onPauseRef.current = props.onPause;
    onEndedRef.current = props.onEnded;
    onErrorRef.current = props.onError;

    // Reflect declarative attributes onto the element every render. Booleans
    // become presence/absence; everything else becomes a string attribute.
    React.useEffect(() => {
      const el = elRef.current;
      if (!el) return;
      for (const [key, value] of Object.entries(props)) {
        if (EVENT_PROPS.has(key) || value === undefined || value === null)
          continue;
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
      const add = (name: string, fn?: (detail: unknown) => void) => {
        if (!fn) return;
        const l: EventListener = (e) => fn((e as CustomEvent).detail);
        el.addEventListener(name, l);
        listeners.push([name, l]);
      };
      add("movi-qoe", (detail) => onQoeRef.current?.(detail as QoEEvent));
      add("timeupdate", (detail) =>
        onTimeUpdateRef.current?.(detail as number),
      );
      add("play", () => onPlayRef.current?.());
      add("pause", () => onPauseRef.current?.());
      add("ended", () => onEndedRef.current?.());
      add("error", (detail) => onErrorRef.current?.(detail));
      onReadyRef.current?.(el);
      return () => listeners.forEach(([n, l]) => el.removeEventListener(n, l));
    }, []);

    // createElement avoids needing a JSX.IntrinsicElements augmentation for the
    // custom tag; React passes unknown props straight through as attributes.
    return React.createElement("movi-player", {
      ref: elRef,
      className: props.className,
      style: props.style,
    });
  },
);
