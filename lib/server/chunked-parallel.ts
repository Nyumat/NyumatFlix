import "server-only";

const DEFAULT_CHUNK_SIZE = 10;

export async function runInChunks<T, R>(
  items: readonly T[],
  worker: (item: T) => Promise<R>,
  chunkSize = DEFAULT_CHUNK_SIZE,
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += chunkSize) {
    const batch = items.slice(i, i + chunkSize);
    const batchResults = await Promise.all(batch.map(worker));
    results.push(...batchResults);
  }

  return results;
}
