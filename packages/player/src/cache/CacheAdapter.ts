/**
 * CacheAdapter - Interface for cache backends
 */

export interface CacheAdapter {
  get(key: string, offset: number, length: number): ArrayBuffer | null;
  set(key: string, offset: number, length: number, data: ArrayBuffer): void;
  clear(): void;
  getSize(): number;
}
