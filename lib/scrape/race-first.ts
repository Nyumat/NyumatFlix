export const raceFirstOk = async <T, R>(
  items: readonly T[],
  probe: (item: T) => Promise<R | null>,
): Promise<{ item: T; value: R } | null> => {
  if (items.length === 0) {
    return null;
  }

  return await new Promise((resolve) => {
    let pending = items.length;
    let settled = false;

    const finish = (result: { item: T; value: R } | null) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(result);
    };

    for (const item of items) {
      void Promise.resolve()
        .then(() => probe(item))
        .then((value) => {
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
  probe: (item: T) => Promise<R | null>,
  batchSize: number,
): Promise<{ item: T; value: R } | null> => {
  const size = Math.max(1, batchSize);
  for (let index = 0; index < items.length; index += size) {
    const batch = items.slice(index, index + size);
    const winner = await raceFirstOk(batch, probe);
    if (winner) {
      return winner;
    }
  }
  return null;
};
