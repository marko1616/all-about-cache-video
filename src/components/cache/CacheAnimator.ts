import { MotionGenerator } from "../../schemes/UtilScheme";
import { CacheLine, CacheField } from "../../schemes/Cache";

/**
 * Abstract interface for cache animation strategies.
 * Implementations handle either simple or detailed visualization modes.
 */
export interface CacheAnimator {
  /**
   * Animate the start of a cache request.
   */
  animateRequestStart(
    addr: number | undefined,
    label: string,
    setIndex?: number,
  ): MotionGenerator<void>;

  /**
   * Animate the tag comparison / hit check phase.
   */
  animateCheckHit(setIndex?: number, lookupTag?: number): MotionGenerator<void>;

  /**
   * Animate a cache hit indication.
   */
  animateHit(): MotionGenerator<void>;

  /**
   * Animate a cache miss indication.
   */
  animateMiss(): MotionGenerator<void>;

  /**
   * Animate the start of a fetch operation.
   */
  animateFetchStart(addr: number, setIndex: number): MotionGenerator<void>;

  /**
   * Animate the start of a writeback operation.
   */
  animateWriteBackStart(addr: number, setIndex: number): MotionGenerator<void>;

  /**
   * Animate the end of a request.
   */
  animateRequestEnd(finalLabel: string): MotionGenerator<void>;

  /**
   * Update the visual state of a cache line.
   */
  animateLineUpdate(
    setIndex: number,
    wayIndex: number,
    line: CacheLine,
  ): MotionGenerator<void>;

  /**
   * Highlight a specific cache field for educational purposes.
   */
  introCacheField?(
    field: CacheField,
    scale?: number,
    duration?: number,
  ): MotionGenerator<void>;

  /**
   * Reset cache field highlight.
   */
  resetFieldIntro?(field: CacheField, duration?: number): MotionGenerator<void>;
}
