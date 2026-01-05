import {
  Layout,
  Rect,
  RectProps,
  Txt,
  initial,
  signal,
} from "@motion-canvas/2d";
import {
  createRef,
  SimpleSignal,
  all,
  Reference,
  createSignal,
  SignalValue,
} from "@motion-canvas/core";
import { CacheLine } from "../schemes/Cache";
import { CacheLineView } from "./CacheLineView";
import { CacheSetView } from "./CacheSetView";

/**
 * Props for the CacheData container.
 */
export interface CacheDataProps extends RectProps {
  numSets: number;
  numWays: number;
  lineSize: number;
  tagBits: number;
  offsetBits: number;
  setBits: number;
  stackOffset?: number;
  containerHeight?: SignalValue<number>;
}

/**
 * A detailed view of the entire Cache State.
 * Implements a Split Layout:
 * - Left Side: Store/Stack Area (Inactive Sets)
 * - Right Side: Work Area (Active Set)
 */
export class CacheData extends Rect {
  private readonly numSets: number;
  private readonly numWays: number;
  private readonly setRefs: Reference<CacheSetView>[] = [];
  private readonly stackOffset: number;

  private readonly workAreaX: SimpleSignal<number>;
  private readonly stackAreaX: SimpleSignal<number>;

  @initial(0)
  @signal()
  private readonly containerHeight: SimpleSignal<number>;

  constructor(props: CacheDataProps) {
    super({
      layout: false,
      ...props,
    });

    this.containerHeight(props.containerHeight);
    this.height(props.containerHeight);
    this.numSets = props.numSets;
    this.numWays = props.numWays;
    this.stackOffset = props.stackOffset ?? 15;

    this.stackAreaX = createSignal(() => -this.width() * 0.25);
    this.workAreaX = createSignal(() => this.width() * 0.25);

    this.add(
      <Layout
        direction="column"
        alignItems="center"
        gap={8}
        x={() => this.stackAreaX()}
        y={0}
        width={() => this.width() * 0.47}
        height={() => this.height() * 0.85}
        layout
      >
        <Txt text="Storage Space" fill="#d7d7d7" fontSize={32} fontWeight={700} />
        <Rect
          stroke="#d7d7d7"
          grow={1}
          width={"100%"}
          lineWidth={10}
          lineDash={[64, 16]}
          radius={4}
        />
      </Layout>,
    );

    this.add(
      <Layout
        direction="column"
        alignItems="center"
        gap={8}
        x={() => this.workAreaX()}
        y={() => 0}
        width={() => this.width() * 0.495}
        height={() => this.height() * 0.85}
        layout
      >
        <Txt text="Work Space" fill="#d7d7d7" fontSize={32} fontWeight={700} />
        <Rect
          stroke="#d7d7d7"
          grow={1}
          width={"100%"}
          lineWidth={10}
          lineDash={[64, 16]}
          radius={4}
        />
      </Layout>,
    );

    this.add(
      <Rect
        x={() => this.workAreaX()}
        width={() => this.width() * 0.45}
        height={() => this.height()}
        stroke={"rgba(255, 255, 255, 0)"}
        zIndex={-10}
      />,
    );

    for (let s = 0; s < this.numSets; s++) {
      const setRef = createRef<CacheSetView>();
      this.setRefs.push(setRef);
      const initialY = (s - (this.numSets - 1) / 2) * this.stackOffset;

      this.add(
        <CacheSetView
          ref={setRef}
          setIndex={s}
          numWays={this.numWays}
          lineSize={props.lineSize}
          tagBits={props.tagBits}
          setBits={props.setBits}
          width={() => this.width() * 0.45}
          x={() => this.stackAreaX()}
          y={initialY}
          scale={1}
          zIndex={s}
        />,
      );
    }
  }

  /**
   * Focuses a specific Set by moving it to the Work Area (Right).
   * Other sets retreat to the Stack Area (Left).
   */
  public *focusSet(setIndex: number) {
    yield* all(
      ...this.setRefs.map((setRef, idx) => {
        const view = setRef();
        const isTarget = idx === setIndex;

        if (isTarget) {
          return all(
            view.x(this.workAreaX(), 0.5),
            view.y(0, 0.5),
            view.scale(1.05, 0.5),
          );
        } else {
          const visualIndex = idx > setIndex ? idx - 1 : idx;
          const stackSize = setIndex >= 0 ? this.numSets - 1 : this.numSets;
          const centeredY =
            (visualIndex - (stackSize - 1) / 2) * this.stackOffset;

          return all(
            view.x(this.stackAreaX(), 0.5),
            view.y(centeredY, 0.5),
            view.scale(0.95, 0.5),
          );
        }
      }),
    );

    this.setRefs.forEach((setRef, idx) => {
      const view = setRef();
      if (idx === setIndex) {
        view.x(() => this.workAreaX());
      } else {
        view.x(() => this.stackAreaX());
      }
    });
  }

  /**
   * Updates a specific cache line visualization.
   */
  public *updateLine(setIndex: number, wayIndex: number, line: CacheLine) {
    const view = this.getLineView(setIndex, wayIndex);
    if (view) {
      yield* view.updateState(line);
    }
  }

  /**
   * Highlights a specific cache line (e.g., on HIT).
   */
  public *highlightLine(setIndex: number, wayIndex: number, color?: string) {
    const view = this.getLineView(setIndex, wayIndex);
    if (view) {
      yield* view.highlight(color);
    }
  }

  /**
   * Helper to safely get a line view ref.
   */
  private getLineView(set: number, way: number): CacheLineView | null {
    if (
      set >= 0 &&
      set < this.numSets &&
      way >= 0 &&
      way < this.numWays &&
      this.setRefs[set]
    ) {
      const setView = this.setRefs[set]();
      if (setView.wayRefs[way]) {
        return setView.wayRefs[way]();
      }
    }
    return null;
  }

  /**
   * Initialize the view with current data without animation (for setup).
   */
  public setInitialState(data: CacheLine[][]) {
    for (let s = 0; s < this.numSets; s++) {
      for (let w = 0; w < this.numWays; w++) {
        const view = this.getLineView(s, w);
        if (view && data[s] && data[s][w]) {
          const line = data[s][w];
          view.valid(line.valid);
          view.dirty(line.dirty);
          view.tag(line.tag);
          view.data(line.data);
          view.replaceState(line.replaceState);
        }
      }
    }

    this.setRefs.forEach((ref, s) => {
      const view = ref();
      const initialY = (s - (this.numSets - 1) / 2) * this.stackOffset;

      view.x(() => this.stackAreaX());
      view.y(initialY);
      view.scale(1);
      view.zIndex(s);
    });
  }
}
