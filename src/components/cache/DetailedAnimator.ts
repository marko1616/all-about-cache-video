import { Reference, all, waitFor } from "@motion-canvas/core";
import { CacheAnimator } from "./CacheAnimator";
import { MotionGenerator } from "../../schemes/UtilScheme";
import { CacheLine, CacheField } from "../../schemes/Cache";
import { CacheAddrDecoder } from "./CacheAddrDecoder";
import { CacheData } from "./CacheData";

/**
 * Detailed mode animator.
 * Provides rich visualization including address decoding,
 * tag comparison, and per-line state updates.
 */
export class DetailedAnimator implements CacheAnimator {
  constructor(
    private readonly addrDecoderRef: Reference<CacheAddrDecoder>,
    private readonly cacheDataRef: Reference<CacheData>,
  ) {}

  public *animateRequestStart(
    addr: number | undefined,
    _label: string,
    setIndex?: number,
  ): MotionGenerator<void> {
    if (addr !== undefined) {
      yield* this.addrDecoderRef().animateToAddress(addr, 1);

      if (setIndex !== undefined) {
        yield* this.cacheDataRef().focusSet(setIndex);
      }
    }
  }

  public *animateCheckHit(
    setIndex?: number,
    lookupTag?: number,
  ): MotionGenerator<void> {
    const currentAddr = this.addrDecoderRef().address();

    if (setIndex !== undefined) {
      yield* this.cacheDataRef().focusSet(setIndex);
    }

    yield* all(
      this.addrDecoderRef().animateAddressWithHighlight(currentAddr, "tag", 1),
      this.cacheDataRef().checkHit(lookupTag),
    );
  }

  public *animateHit(): MotionGenerator<void> {
    // Hit indication handled by checkHit animation result
  }

  public *animateMiss(): MotionGenerator<void> {
    yield* waitFor(0.3);
  }

  public *animateFetchStart(
    _addr: number,
    setIndex: number,
  ): MotionGenerator<void> {
    yield* this.cacheDataRef().focusSet(setIndex);
    yield* waitFor(0.1);
  }

  public *animateWriteBackStart(
    _addr: number,
    setIndex: number,
  ): MotionGenerator<void> {
    yield* this.cacheDataRef().focusSet(setIndex);
    yield* waitFor(0.1);
  }

  public *animateRequestEnd(_finalLabel: string): MotionGenerator<void> {
    // Cleanup if needed in detailed mode
  }

  public *animateLineUpdate(
    setIndex: number,
    wayIndex: number,
    line: CacheLine,
  ): MotionGenerator<void> {
    yield* this.cacheDataRef().updateLine(setIndex, wayIndex, line);
  }

  public *introCacheField(
    field: CacheField,
    scale: number = 1.3,
    duration: number = 0.4,
  ): MotionGenerator<void> {
    yield* this.cacheDataRef().introCacheField(field, scale, duration);
  }

  public *resetFieldIntro(
    field: CacheField,
    duration: number = 0.3,
  ): MotionGenerator<void> {
    yield* this.cacheDataRef().resetFieldIntro(field, duration);
  }
}
