export type RaceFirstOkOptions = {
  signal?: AbortSignal;
};

const mergeRaceSignals = (
  raceSignal: AbortSignal,
  parentSignal?: AbortSignal,
): AbortSignal => {
  if (!parentSignal) {
    return raceSignal;
  }

  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([raceSignal, parentSignal]);
  }

  const merged = new AbortController();
  const abort = () => merged.abort();
  if (raceSignal.aborted || parentSignal.aborted) {
    merged.abort();
    return merged.signal;
  }
  raceSignal.addEventListener("abort", abort, { once: true });
  parentSignal.addEventListener("abort", abort, { once: true });
  return merged.signal;
};

export const raceFirstOk = async <T, R>(
  items: readonly T[],
  probe: (item: T, signal: AbortSignal) => Promise<R | null>,
  options: RaceFirstOkOptions = {},
): Promise<{ item: T; value: R } | null> => {
  if (items.length === 0) {
    return null;
  }

  if (options.signal?.aborted) {
    return null;
  }

  const raceAbort = new AbortController();
  const probeSignal = mergeRaceSignals(raceAbort.signal, options.signal);

  return await new Promise((resolve) => {
    let pending = items.length;
    let settled = false;

    const finish = (result: { item: T; value: R } | null) => {
      if (settled) {
        return;
      }
      settled = true;
      if (!raceAbort.signal.aborted) {
        raceAbort.abort();
      }
      resolve(result);
    };

    for (const item of items) {
      if (probeSignal.aborted) {
        pending -= 1;
        if (pending === 0) {
          finish(null);
        }
        continue;
      }

      void Promise.resolve()
        .then(() => probe(item, probeSignal))
        .then((value) => {
          if (probeSignal.aborted) {
            pending -= 1;
            if (pending === 0) {
              finish(null);
            }
            return;
          }

          if (value !== null) {
            finish({ item, value });
            return;
          }
          pending -= 1;
          if (pending === 0) {
            finish(null);
          }
        })
        .catch(() => {
          pending -= 1;
          if (pending === 0) {
            finish(null);
          }
        });
    }
  });
};

export const firstOkInBatches = async <T, R>(
  items: readonly T[],
  probe: (item: T, signal: AbortSignal) => Promise<R | null>,
  batchSize: number,
  options: RaceFirstOkOptions = {},
): Promise<{ item: T; value: R } | null> => {
  const size = Math.max(1, batchSize);
  for (let index = 0; index < items.length; index += size) {
    if (options.signal?.aborted) {
      return null;
    }

    const batch = items.slice(index, index + size);
    const winner = await raceFirstOk(batch, probe, options);
    if (winner) {
      return winner;
    }
  }
  return null;
};
