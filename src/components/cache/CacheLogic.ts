import { CacheLine, ReplacementPolicy } from "../../schemes/Cache";

/**
 * Result of a cache lookup operation.
 */
export interface LookupResult {
  hit: boolean;
  wayIndex: number;
  line: CacheLine | null;
}

/**
 * Result of a line allocation operation.
 */
export interface AllocationResult {
  victimIndex: number;
  victim: CacheLine;
  needsWriteback: boolean;
  writebackAddr: number;
}

/**
 * Parsed address components.
 */
export interface AddressParts {
  tag: number;
  setIndex: number;
  offset: number;
}

/**
 * Pure logic layer for cache operations.
 * Contains no animation or UI dependencies.
 */
export class CacheLogic {
  private readonly offsetBits: number;
  private readonly setBits: number;
  private readonly numWays: number;
  private readonly numSets: number;
  private readonly lineSize: number;
  private readonly tagBits: number;
  private readonly replacementPolicy: ReplacementPolicy;

  private readonly cacheData: CacheLine[][];
  private lruCounter: number = 0;

  constructor(
    offsetBits: number,
    setBits: number,
    numWays: number,
    replacementPolicy: ReplacementPolicy,
  ) {
    this.offsetBits = offsetBits;
    this.setBits = setBits;
    this.numWays = numWays;
    this.numSets = setBits > 0 ? 1 << setBits : 1;
    this.lineSize = 1 << offsetBits;
    this.tagBits = 8 - offsetBits - setBits;
    this.replacementPolicy = replacementPolicy;

    this.cacheData = [];
    for (let s = 0; s < this.numSets; s++) {
      const set: CacheLine[] = [];
      for (let w = 0; w < this.numWays; w++) {
        set.push({
          valid: false,
          dirty: false,
          tag: 0,
          data: BigInt(0),
          replaceState: 0,
        });
      }
      this.cacheData.push(set);
    }
  }

  // ==========================================================================
  // Getters
  // ==========================================================================

  public getLineSize(): number {
    return this.lineSize;
  }

  public getNumSets(): number {
    return this.numSets;
  }

  public getNumWays(): number {
    return this.numWays;
  }

  public getTagBits(): number {
    return this.tagBits;
  }

  public getOffsetBits(): number {
    return this.offsetBits;
  }

  public getSetBits(): number {
    return this.setBits;
  }

  public getCacheData(): CacheLine[][] {
    return this.cacheData;
  }

  // ==========================================================================
  // Address Parsing
  // ==========================================================================

  /**
   * Parse an address into tag, set index, and offset components.
   */
  public parseAddress(addr: number): AddressParts {
    const safeAddr = addr & 0xff;
    const offset = safeAddr & ((1 << this.offsetBits) - 1);
    const setIndex =
      this.setBits > 0
        ? (safeAddr >> this.offsetBits) & ((1 << this.setBits) - 1)
        : 0;
    const tag = safeAddr >> (this.offsetBits + this.setBits);
    return { tag, setIndex, offset };
  }

  /**
   * Compute the base address for a cache line given tag and set index.
   */
  public getLineBaseAddress(tag: number, setIndex: number): number {
    return (
      (tag << (this.offsetBits + this.setBits)) | (setIndex << this.offsetBits)
    );
  }

  // ==========================================================================
  // Lookup & Allocation
  // ==========================================================================

  /**
   * Look up a cache line by set index and tag.
   * Returns hit status, way index, and the line if found.
   */
  public lookup(setIndex: number, tag: number): LookupResult {
    const set = this.cacheData[setIndex];
    for (let i = 0; i < set.length; i++) {
      if (set[i].valid && set[i].tag === tag) {
        return { hit: true, wayIndex: i, line: set[i] };
      }
    }
    return { hit: false, wayIndex: -1, line: null };
  }

  /**
   * Find a victim line for replacement using the configured policy.
   * Returns allocation info including whether writeback is needed.
   */
  public allocate(setIndex: number, newTag: number): AllocationResult {
    const set = this.cacheData[setIndex];
    const victimIdx = this.replacementPolicy(set);
    const victim = set[victimIdx];

    const needsWriteback = victim.valid && victim.dirty;
    const writebackAddr = needsWriteback
      ? this.getLineBaseAddress(victim.tag, setIndex)
      : 0;

    return {
      victimIndex: victimIdx,
      victim,
      needsWriteback,
      writebackAddr,
    };
  }

  /**
   * Update replacement state (LRU counter) for a line.
   */
  public updateReplaceState(line: CacheLine): void {
    line.replaceState = ++this.lruCounter;
  }

  // ==========================================================================
  // Data Operations
  // ==========================================================================

  /**
   * Read a single byte from a cache line at the given offset.
   */
  public readByteFromLine(line: CacheLine, offset: number): number {
    return Number((line.data >> BigInt(offset * 8)) & BigInt(0xff));
  }

  /**
   * Write a single byte to a cache line at the given offset.
   */
  public writeByteToLine(
    line: CacheLine,
    offset: number,
    value: number,
  ): void {
    const shift = BigInt(offset * 8);
    const mask = BigInt(0xff) << shift;
    line.data = (line.data & ~mask) | (BigInt(value & 0xff) << shift);
  }

  /**
   * Read multiple bytes from a cache line starting at offset.
   */
  public readBytesFromLine(
    line: CacheLine,
    offset: number,
    byteCount: number,
  ): bigint {
    let result = BigInt(0);
    for (let i = 0; i < byteCount; i++) {
      const byteVal = this.readByteFromLine(line, offset + i);
      result |= BigInt(byteVal) << BigInt(i * 8);
    }
    return result;
  }

  /**
   * Write multiple bytes to a cache line starting at offset.
   */
  public writeBytesToLine(
    line: CacheLine,
    offset: number,
    value: bigint,
    byteCount: number,
  ): void {
    for (let i = 0; i < byteCount; i++) {
      const byteVal = Number((value >> BigInt(i * 8)) & BigInt(0xff));
      this.writeByteToLine(line, offset + i, byteVal);
    }
  }

  // ==========================================================================
  // Line State Modifications
  // ==========================================================================

  /**
   * Install a fetched line into the cache.
   */
  public installLine(
    setIndex: number,
    wayIndex: number,
    tag: number,
    data: bigint,
  ): CacheLine {
    const line = this.cacheData[setIndex][wayIndex];
    line.valid = true;
    line.dirty = false;
    line.tag = tag;
    line.data = data;
    this.updateReplaceState(line);
    return line;
  }

  /**
   * Mark a line as clean (after writeback).
   */
  public markClean(line: CacheLine): void {
    line.dirty = false;
  }

  /**
   * Invalidate a line.
   */
  public invalidateLine(line: CacheLine): void {
    line.valid = false;
    line.dirty = false;
  }

  /**
   * Zero a line's data and mark it dirty.
   */
  public zeroLine(line: CacheLine, tag: number): void {
    line.valid = true;
    line.dirty = true;
    line.tag = tag;
    line.data = BigInt(0);
    this.updateReplaceState(line);
  }

  /**
   * Get a line by set and way index.
   */
  public getLine(setIndex: number, wayIndex: number): CacheLine {
    return this.cacheData[setIndex][wayIndex];
  }

  // ==========================================================================
  // Bulk Operations
  // ==========================================================================

  /**
   * Invalidate all cache lines.
   * Returns list of lines that need visual update.
   */
  public invalidateAll(): Array<{ setIndex: number; wayIndex: number }> {
    const updated: Array<{ setIndex: number; wayIndex: number }> = [];
    for (let s = 0; s < this.numSets; s++) {
      for (let w = 0; w < this.numWays; w++) {
        this.cacheData[s][w].valid = false;
        this.cacheData[s][w].dirty = false;
        updated.push({ setIndex: s, wayIndex: w });
      }
    }
    return updated;
  }

  /**
   * Get all dirty lines for flush/clean operations.
   */
  public getDirtyLines(): Array<{
    setIndex: number;
    wayIndex: number;
    line: CacheLine;
    addr: number;
  }> {
    const dirty: Array<{
      setIndex: number;
      wayIndex: number;
      line: CacheLine;
      addr: number;
    }> = [];
    for (let s = 0; s < this.numSets; s++) {
      for (let w = 0; w < this.numWays; w++) {
        const line = this.cacheData[s][w];
        if (line.valid && line.dirty) {
          dirty.push({
            setIndex: s,
            wayIndex: w,
            line,
            addr: this.getLineBaseAddress(line.tag, s),
          });
        }
      }
    }
    return dirty;
  }
}
