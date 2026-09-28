import stepPatchData from "./animekai-step-patches.json";

export type KaiStepPatch = { extend: number; writes: Array<[number, number]> };

const patches = (
  stepPatchData as unknown as { patches: Record<string, KaiStepPatch> }
).patches;

export function stepPatchKey(
  plainLen: number,
  prefix: string,
  pos: number,
  ch: string,
): string {
  return `${plainLen}\n${prefix}\n${pos}\n${ch}`;
}

export function getStepPatch(
  plainLen: number,
  prefix: string,
  pos: number,
  ch: string,
): KaiStepPatch | undefined {
  return patches[stepPatchKey(plainLen, prefix, pos, ch)];
}

export function applyStepPatch(
  body: Uint8Array,
  patch: KaiStepPatch,
): Uint8Array {
  const nextLen = body.length + patch.extend;
  const out =
    nextLen === body.length
      ? body
      : (() => {
          const grown = new Uint8Array(nextLen);
          grown.set(body);
          return grown;
        })();
  for (const [index, value] of patch.writes) {
    out[index] = value;
  }
  return out;
}
