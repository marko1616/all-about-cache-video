import { Rect, Txt } from "@motion-canvas/2d";
import { Reference, waitFor } from "@motion-canvas/core";
import { CacheAnimator } from "./CacheAnimator";
import { MotionGenerator } from "../../schemes/UtilScheme";
import { CacheLine } from "../../schemes/Cache";

/**
 * Simple mode animator.
 * Shows basic cache state through label updates and container scaling.
 */
export class SimpleAnimator implements CacheAnimator {
  constructor(
    private readonly containerRef: Reference<Rect>,
    private readonly labelRef: Reference<Txt>,
  ) {}

  public *animateRequestStart(
    _addr: number | undefined,
    label: string,
  ): MotionGenerator<void> {
    this.labelRef().text(label);
    yield* this.containerRef().scale(1.03, 0.2);
  }

  public *animateCheckHit(): MotionGenerator<void> {
    // No visual feedback in simple mode for check phase
  }

  public *animateHit(): MotionGenerator<void> {
    this.labelRef().text("HIT");
  }

  public *animateMiss(): MotionGenerator<void> {
    this.labelRef().text("MISS");
    yield* waitFor(0.3);
  }

  public *animateFetchStart(_addr: number): MotionGenerator<void> {
    this.labelRef().text("FETCH...");
    yield* waitFor(0.1);
  }

  public *animateWriteBackStart(_addr: number): MotionGenerator<void> {
    yield* waitFor(0.1);
  }

  public *animateRequestEnd(finalLabel: string): MotionGenerator<void> {
    this.labelRef().text(finalLabel);
    yield* this.containerRef().scale(1.0, 0.2);
    yield* waitFor(0.3);
    this.labelRef().text("IDLE");
  }

  public *animateLineUpdate(
    _setIndex: number,
    _wayIndex: number,
    _line: CacheLine,
  ): MotionGenerator<void> {
    // No line-level visualization in simple mode
  }
}
