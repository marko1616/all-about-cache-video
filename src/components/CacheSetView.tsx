import { Layout, Rect, RectProps, Txt } from "@motion-canvas/2d";
import { createRef, Reference } from "@motion-canvas/core";
import { CacheLineView } from "./CacheLineView";

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
}
