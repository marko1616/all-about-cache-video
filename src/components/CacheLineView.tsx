import { Rect, RectProps, Txt, initial, signal } from "@motion-canvas/2d";
import { createRef, SimpleSignal, all, Reference } from "@motion-canvas/core";
import { CacheLine } from "../schemes/Cache";
import { formatMultiByteValue } from "../utils/PacketUtils";

/**
 * Props for a single Cache Line visualization.
 */
export interface CacheLineViewProps extends RectProps {
  setIndex: number;
  wayIndex: number;
  lineSize: number;
  tagBits: number;
}

/**
 * Visual representation of a single Cache Line.
 * Layout: [V] [D] [Tag] [Data]
 */
export class CacheLineView extends Rect {
  @initial(false)
  @signal()
  declare public readonly valid: SimpleSignal<boolean, this>;

  @initial(false)
  @signal()
  declare public readonly dirty: SimpleSignal<boolean, this>;

  @initial(0)
  @signal()
  declare public readonly tag: SimpleSignal<number, this>;

  @initial(BigInt(0))
  @signal()
  declare public readonly data: SimpleSignal<bigint, this>;

  @initial(0)
  @signal()
  declare public readonly replaceState: SimpleSignal<number, this>;

  private readonly validBox = createRef<Rect>();
  private readonly dirtyBox = createRef<Rect>();
  private readonly tagTxt = createRef<Txt>();
  private readonly dataTxt = createRef<Txt>();

  private readonly lineSize: number;
  private readonly tagBits: number;

  constructor(props: CacheLineViewProps) {
    super({
      layout: true,
      direction: "row",
      gap: 20,
      alignItems: "center",
      padding: 16,
      radius: 12,
      fill: "#dad2bc",
      ...props,
    });

    this.lineSize = props.lineSize;
    this.tagBits = props.tagBits;

    this.add(
      <>
        {/* Valid Bit */}
        {this.createBitBox("V", this.valid, "#4caf50", this.validBox)}

        {/* Dirty Bit */}
        {this.createBitBox("D", this.dirty, "#ff9800", this.dirtyBox)}

        {/* Tag */}
        <Rect
          fill="#2196f3"
          radius={8}
          padding={[8, 16]}
          minWidth={100}
          alignItems="center"
          justifyContent="center"
        >
          <Txt
            ref={this.tagTxt}
            text={() => this.formatTag(this.tag())}
            fill="#f5f1ed"
            fontSize={40}
            fontWeight={700}
          />
        </Rect>

        {/* Data */}
        <Rect
          fill="#444444"
          radius={8}
          padding={[8, 16]}
          grow={1}
          alignItems="center"
          justifyContent="center"
          clip={true}
        >
          <Txt
            ref={this.dataTxt}
            text={() =>
              formatMultiByteValue(this.data(), Math.log2(this.lineSize))
            }
            fill="#f5f1ed"
            fontSize={40}
            fontWeight={700}
          />
        </Rect>
      </>,
    );
  }

  private createBitBox(
    label: string,
    stateSignal: SimpleSignal<boolean, this>,
    activeColor: string,
    ref: Reference<Rect>,
  ) {
    return (
      <Rect
        ref={ref}
        width={60}
        height={60}
        radius={8}
        fill={() => (stateSignal() ? activeColor : "#444")}
        alignItems="center"
        justifyContent="center"
      >
        <Txt
          text={label}
          fill={() => (stateSignal() ? "#f5f1ed" : "#888")}
          fontSize={32}
          fontWeight={700}
        />
      </Rect>
    );
  }

  private formatTag(tagVal: number): string {
    const hexDigits = Math.ceil(this.tagBits / 4);
    return "0x" + tagVal.toString(16).toUpperCase().padStart(hexDigits, "0");
  }

  /**
   * Updates the visual state of the cache line with animation.
   */
  public *updateState(line: CacheLine) {
    yield* this.fill("#F5F1ED", 0.2);

    this.valid(line.valid);
    this.dirty(line.dirty);
    this.tag(line.tag);
    this.data(line.data);
    this.replaceState(line.replaceState);

    yield* this.scale(1.01, 0.1);
    yield* this.scale(1.0, 0.2);

    yield* this.fill("#dad2bc", 0.3);
  }

  /**
   * Highlights this line to indicate a Hit or Access.
   */
  public *highlight(color: string = "#4caf50") {
    const originalStroke = this.stroke();
    const originalWidth = this.lineWidth();

    yield* all(
      this.stroke(color, 0.2),
      this.lineWidth(4, 0.2),
      this.scale(1.02, 0.2),
    );

    yield* this.scale(1.0, 0.2);
    yield* all(
      this.stroke(originalStroke, 0.3),
      this.lineWidth(originalWidth, 0.3),
    );
  }
}
