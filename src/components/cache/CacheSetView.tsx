import { Layout, Rect, RectProps, Txt } from "@motion-canvas/2d";
import { createRef, Reference, all } from "@motion-canvas/core";
import { CacheLineView } from "./CacheLineView";
import { CacheField } from "../../schemes/Cache";

/**
 * Represents a specific Set containing multiple Ways (Lines).
 */
export class CacheSetView extends Rect {
  public readonly wayRefs: Reference<CacheLineView>[] = [];

  constructor(
    props: RectProps & {
      setIndex: number;
      numWays: number;
      lineSize: number;
      tagBits: number;
      setBits: number;
    },
  ) {
    super({
      layout: true,
      direction: "column",
      gap: 10,
      padding: 20,
      radius: 16,
      fill: "#cfc7b2",
      stroke: "#dad2bc",
      lineWidth: 20,
      ...props,
    });

    this.add(
      <Layout direction="row" justifyContent="space-between" marginBottom={10}>
        <Txt
          text={`Set ${props.setIndex}`}
          fill="#242424"
          fontSize={36}
          fontWeight={700}
        />
        <Txt
          text={`Idx: ${props.setIndex.toString(2).padStart(props.setBits, "0")}`}
          fill="#242424"
          fontSize={32}
          fontWeight={700}
        />
      </Layout>,
    );

    for (let w = 0; w < props.numWays; w++) {
      const lineRef = createRef<CacheLineView>();
      this.wayRefs.push(lineRef);
      this.add(
        <CacheLineView
          ref={lineRef}
          setIndex={props.setIndex}
          wayIndex={w}
          lineSize={props.lineSize}
          tagBits={props.tagBits}
          width="100%"
        />,
      );
    }
  }

  /**
   * Performs the Check Hit animation on all ways in this set simultaneously.
   * This will trigger the overlay wipe and tag comparison logic for every line.
   *
   * @param lookupTag The tag from the memory request to compare against.
   */
  public *checkHit(lookupTag: number) {
    yield* all(...this.wayRefs.map((ref) => ref().checkHit(lookupTag)));
  }

  /**
   * Highlights a specific field across all cache lines in this set.
   * Scales up the specified field to draw attention to it.
   *
   * @param field - The cache field to highlight (valid, dirty, tag, or data)
   * @param scale - The scale factor to apply (default: 1.3)
   * @param duration - Animation duration in seconds (default: 0.4)
   */
  public *introCacheField(
    field: CacheField,
    scale: number = 1.3,
    duration: number = 0.4,
  ) {
    yield* all(
      ...this.wayRefs.map((ref) =>
        ref().highlightField(field, scale, duration),
      ),
    );
  }

  /**
   * Resets the field highlight for all cache lines in this set.
   *
   * @param field - The cache field to reset
   * @param duration - Animation duration in seconds (default: 0.3)
   */
  public *resetFieldIntro(field: CacheField, duration: number = 0.3) {
    yield* all(
      ...this.wayRefs.map((ref) => ref().resetFieldHighlight(field, duration)),
    );
  }
}
