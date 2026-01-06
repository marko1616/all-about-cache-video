import {
  Layout,
  Rect,
  RectProps,
  Txt,
  initial,
  signal,
} from "@motion-canvas/2d";
import {
  waitFor,
  createRef,
  SimpleSignal,
  all,
  Reference,
} from "@motion-canvas/core";
import { CacheLine } from "../../schemes/Cache";
import { formatMultiByteValue } from "../../utils/PacketUtils";

import { CacheField } from "../../schemes/Cache";

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

  // Add these new refs in the constructor, after the existing refs:
  private readonly validContainer = createRef<Rect>();
  private readonly dirtyContainer = createRef<Rect>();
  private readonly tagContainer = createRef<Rect>();
  private readonly dataContainer = createRef<Rect>();

  private readonly dataLayoutContainer = createRef<Layout>();
  private readonly logicLayoutContainer = createRef<Layout>();
  private readonly overlayRect = createRef<Rect>();

  private readonly tagTxt = createRef<Txt>();
  private readonly dataTxt = createRef<Txt>();

  private readonly logicValidTxt = createRef<Txt>();
  private readonly logicTagTxt = createRef<Txt>();
  private readonly logicLookupTxt = createRef<Txt>();
  private readonly logicEqTxt = createRef<Txt>();

  private readonly lineSize: number;
  private readonly tagBits: number;

  constructor(props: CacheLineViewProps) {
    super({
      layout: true,
      padding: 16,
      radius: 12,
      height: 76,
      fill: "#dad2bc",
      ...props,
    });

    this.lineSize = props.lineSize;
    this.tagBits = props.tagBits;

    this.add(
      <Layout layout={false}>
        <Layout
          layout
          ref={this.dataLayoutContainer}
          direction={"row"}
          gap={20}
          alignItems={"center"}
          height={() => this.height() - 16}
          width={() => this.width() - 16}
        >
          {/* Valid Bit */}
          {this.createBitBox("V", this.valid, "#4caf50", this.validContainer)}

          {/* Dirty Bit */}
          {this.createBitBox("D", this.dirty, "#ff9800", this.dirtyContainer)}

          {/* Tag */}
          <Rect
            ref={this.tagContainer}
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
            ref={this.dataContainer}
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
        </Layout>
      </Layout>,
    );

    this.add(
      <Layout layout={false}>
        <Layout
          ref={this.logicLayoutContainer}
          layout
          direction="row"
          gap={15}
          alignItems="center"
          justifyContent="center"
          height={() => this.height() - 16}
          width={() => this.width() - 16}
          opacity={0}
        >
          <Txt
            ref={this.logicValidTxt}
            text="1"
            fill="#4caf50"
            fontSize={40}
            fontWeight={700}
          />
          <Txt text="&&" fill="#555" fontSize={32} fontWeight={700} />
          <Txt
            ref={this.logicTagTxt}
            text="TAG"
            fill="#2196f3"
            fontSize={40}
            fontWeight={700}
          />
          <Txt
            text="=="
            fill="#555"
            fontSize={32}
            fontWeight={700}
            ref={this.logicEqTxt}
          />
          <Txt
            ref={this.logicLookupTxt}
            text="REQ"
            fill="#2196f3"
            fontSize={40}
            fontWeight={700}
          />
        </Layout>
      </Layout>,
    );

    this.add(
      <Rect
        layout={false}
        x={() => this.x() - this.width() / 2}
        ref={this.overlayRect}
        width={0}
        height={this.height}
        radius={12}
        fill="#242424"
        zIndex={100}
      />,
    );
  }

  /**
   * Performs the "Check Hit" animation.
   * 1. Wipes screen with overlay.
   * 2. Shows comparison logic (Valid && Tag == Lookup).
   * 3. Wipes screen back to data.
   * 4. Highlights if hit.
   */
  public *checkHit(lookupTag: number) {
    const currentTagStr = this.formatTag(this.tag());
    const lookupTagStr = this.formatTag(lookupTag);
    const validStr = this.valid() ? "1" : "0";
    const validColor = this.valid() ? "#4caf50" : "#db3069";
    const eqColor = this.tag() == lookupTag ? "#4caf50" : "#db3069";

    this.logicValidTxt().text("Valid");
    this.logicValidTxt().fill("#555555");
    this.logicTagTxt().text("Tag");
    this.logicLookupTxt().text("lookupTag");
    (this.logicEqTxt().fill("#555555"),
      yield* all(
        this.overlayRect().width(this.width(), 0.6),
        this.overlayRect().x(this.x(), 0.6),
      ));

    this.dataLayoutContainer().opacity(0);
    this.logicLayoutContainer().opacity(1);

    yield* all(
      this.overlayRect().width(0, 0.6),
      this.overlayRect().x(this.x() - this.width() / 2, 0.6),
    );

    yield* waitFor(0.5);

    yield* all(
      this.logicValidTxt().text(validStr, 0.6),
      this.logicValidTxt().fill(validColor, 0.6),
      this.logicTagTxt().text(currentTagStr, 0.6),
      this.logicLookupTxt().text(lookupTagStr, 0.6),
      this.logicEqTxt().fill(eqColor, 0.6),
    );

    yield* waitFor(0.5);

    yield* all(
      this.overlayRect().width(this.width(), 0.6),
      this.overlayRect().x(this.x(), 0.6),
    );

    this.logicLayoutContainer().opacity(0);
    this.dataLayoutContainer().opacity(1);

    yield* all(
      this.overlayRect().width(0, 0.6),
      this.overlayRect().x(this.x() - this.width() / 2, 0.6),
    );
    this.overlayRect().x(() => this.x() - this.width() / 2);
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
    const maxVal = Math.pow(2, this.tagBits);
    const unsignedVal = tagVal < 0 ? tagVal + maxVal : tagVal;

    return (
      "0x" + unsignedVal.toString(16).toUpperCase().padStart(hexDigits, "0")
    );
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

    yield* this.fill("#dad2bc", 0.6);
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
      this.stroke(originalStroke, 0.6),
      this.lineWidth(originalWidth, 0.6),
    );
  }

  /**
   * Gets the container reference for a specific cache field.
   * @param field - The field to get the container for
   * @returns The Rect reference for the specified field
   */
  public getFieldContainer(field: CacheField): Reference<Rect> {
    switch (field) {
      case "valid":
        return this.validContainer;
      case "dirty":
        return this.dirtyContainer;
      case "tag":
        return this.tagContainer;
      case "data":
        return this.dataContainer;
    }
  }

  /**
   * Animates highlighting a specific field by scaling it up.
   * @param field - The field to highlight
   * @param scale - The scale factor to apply (default: 1.3)
   * @param duration - Animation duration in seconds (default: 0.4)
   */
  public *highlightField(
    field: CacheField,
    scale: number = 1.05,
    duration: number = 0.4,
  ) {
    const container = this.getFieldContainer(field)();
    yield* container.scale(scale, duration);
  }

  /**
   * Resets a field's scale back to normal.
   * @param field - The field to reset
   * @param duration - Animation duration in seconds (default: 0.3)
   */
  public *resetFieldHighlight(field: CacheField, duration: number = 0.3) {
    const container = this.getFieldContainer(field)();
    yield* container.scale(1, duration);
  }
}
  