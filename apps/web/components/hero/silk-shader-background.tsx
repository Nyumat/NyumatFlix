"use client";

import { cn } from "@/lib/utils";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

type SilkShaderBackgroundProps = {
  className?: string;
};

const VERTEX_SHADER = `
attribute vec2 a_position;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;

const vec3 COLOR_0 = vec3(0.035, 0.027, 0.039);
const vec3 COLOR_1 = vec3(0.839, 0.235, 0.812);
const vec3 COLOR_2 = vec3(0.545, 0.121, 0.522);
const vec3 COLOR_3 = vec3(0.145, 0.035, 0.137);
const float U_INTENSITY = 0.58;
const float U_SEED = 31.95;

mat2 rotate2d(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat2(c, -s, s, c);
}

float grain(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

vec3 palette(float value) {
  value = clamp(value, 0.0, 1.0);

  vec3 low = mix(COLOR_0, COLOR_3, smoothstep(0.0, 0.45, value));
  vec3 high = mix(COLOR_2, COLOR_1, smoothstep(0.45, 1.0, value));

  return mix(low, high, smoothstep(0.2, 0.9, value));
}

vec3 shade(vec2 uv, vec2 p, float t) {
  vec2 q = p * 1.6;
  float amp = 0.25 + U_INTENSITY * 0.85;

  for (float i = 1.0; i < 5.0; i += 1.0) {
    q.x += amp / i * cos(i * 2.4 * q.y + t * 0.8 + U_SEED);
    q.y += amp / i * cos(i * 1.7 * q.x + t * 0.6);
  }

  return palette(0.5 + 0.5 * sin(q.x + q.y + uv.x * 0.25));
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution.xy) /
    min(u_resolution.x, u_resolution.y);

  p *= 1.82;
  p += vec2(-0.10, 0.02);
  p = rotate2d(4.32842) * p;

  float t = u_time * 0.52;
  vec3 color = shade(uv, p, t);

  float vignette = smoothstep(1.55, 0.15, length(p * vec2(0.72, 0.58)));
  color = mix(vec3(0.018), color, 0.66 + vignette * 0.34);
  color = (color - 0.5) * 1.58 + 0.5;
  color += (grain(gl_FragCoord.xy + u_time * 12.0) - 0.5) * 0.016;

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`;

const FULLSCREEN_TRIANGLE = new Float32Array([-1, -1, 3, -1, -1, 3]);
const MAX_DPR = 2;
const VIDEO_FALLBACK_START_DELAY_MS = 2000;

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
) {
  const shader = gl.createShader(type);

  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function createProgram(gl: WebGLRenderingContext) {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);

  if (!vertexShader || !fragmentShader) {
    if (vertexShader) gl.deleteShader(vertexShader);
    if (fragmentShader) gl.deleteShader(fragmentShader);
    return null;
  }

  const program = gl.createProgram();

  if (!program) {
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return null;
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

export function SilkShaderBackground({ className }: SilkShaderBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [useVideoFallback, setUseVideoFallback] = useState(false);
  const [loadVideoFallback, setLoadVideoFallback] = useState(false);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      powerPreference: "low-power",
      premultipliedAlpha: false,
      stencil: false,
    });

    if (!gl) {
      setUseVideoFallback(true);
      return;
    }

    const program = createProgram(gl);
    if (!program) {
      setUseVideoFallback(true);
      return;
    }

    const buffer = gl.createBuffer();
    const positionLocation = gl.getAttribLocation(program, "a_position");
    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
    const timeLocation = gl.getUniformLocation(program, "u_time");

    if (!buffer || positionLocation < 0) {
      gl.deleteProgram(program);
      return;
    }

    setUseVideoFallback(false);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, FULLSCREEN_TRIANGLE, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    let frame = 0;
    let isVisible = true;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const startedAt = performance.now();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const cssWidth = canvas.clientWidth || rect.width;
      const cssHeight = canvas.clientHeight || rect.height;
      const width = Math.max(1, Math.floor(cssWidth * dpr));
      const height = Math.max(1, Math.floor(cssHeight * dpr));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    };

    const shouldAnimate = () =>
      isVisible &&
      document.visibilityState === "visible" &&
      !reducedMotion.matches;

    const cancel = () => {
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    };

    const draw = (now = performance.now()) => {
      frame = 0;
      resize();

      const elapsed = reducedMotion.matches ? 0 : (now - startedAt) / 1000;

      gl.useProgram(program);
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      gl.uniform1f(timeLocation, elapsed);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      if (shouldAnimate()) {
        frame = requestAnimationFrame(draw);
      }
    };

    const requestDraw = () => {
      if (!frame) {
        frame = requestAnimationFrame(draw);
      }
    };

    const handleMotionPreference = (event: MediaQueryListEvent) => {
      if (event.matches) {
        cancel();
        draw();
        return;
      }

      requestDraw();
    };

    const handleVisibility = () => {
      if (shouldAnimate()) {
        requestDraw();
        return;
      }

      cancel();
      draw();
    };

    const resizeObserver = new ResizeObserver(requestDraw);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      isVisible = entry?.isIntersecting ?? true;
      handleVisibility();
    });

    resizeObserver.observe(canvas);
    intersectionObserver.observe(canvas);
    document.addEventListener("visibilitychange", handleVisibility);
    reducedMotion.addEventListener("change", handleMotionPreference);

    draw();

    return () => {
      cancel();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      reducedMotion.removeEventListener("change", handleMotionPreference);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, []);

  useEffect(() => {
    if (!useVideoFallback) {
      setLoadVideoFallback(false);
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let startDelayId: number | null = null;
    let idleId: number | null = null;

    const enableVideoFallback = () => {
      setLoadVideoFallback(true);
    };

    startDelayId = window.setTimeout(() => {
      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(enableVideoFallback, {
          timeout: 1500,
        });
        return;
      }

      enableVideoFallback();
    }, VIDEO_FALLBACK_START_DELAY_MS);

    return () => {
      if (startDelayId !== null) window.clearTimeout(startDelayId);
      if (idleId !== null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [useVideoFallback]);

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden bg-black",
        className,
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(214,60,207,0.32),transparent_32%),linear-gradient(135deg,#09070a,#D63CCF_46%,#09070a)]" />
      {useVideoFallback ? (
        <video
          aria-hidden="true"
          autoPlay
          loop
          muted
          playsInline
          poster="/movie-banner.webp"
          preload={loadVideoFallback ? "auto" : "none"}
          src={loadVideoFallback ? "/ascii-art-21st.webm" : undefined}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
      <canvas
        ref={canvasRef}
        data-silk-shader-canvas="true"
        className={cn(
          "absolute inset-0 h-full w-full",
          useVideoFallback && "hidden",
        )}
      />
    </div>
  );
}
