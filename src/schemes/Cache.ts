/**
 * Cache line structure.
 */
export interface CacheLine {
  valid: boolean;
  dirty: boolean;
  tag: number;
  data: bigint;
  replaceState: any;
}

/**
 * Available fields that can be highlighted in a cache line.
 */
export type CacheField = "valid" | "dirty" | "tag" | "data";

/**
 * Replacement policy function type.
 * Takes array of cache lines (ways) in a set, returns index to replace.
 */
export type ReplacementPolicy = (ways: CacheLine[]) => number;
