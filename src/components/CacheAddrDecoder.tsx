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
  SignalValue,
  SimpleSignal,
  ColorSignal,
  all,
  createEffect,
  tween,
  easeInOutCubic,
  Reference,
  Color,
  chain,
  waitFor,
} from "@motion-canvas/core";

export interface CacheAddrDecoderProps extends RectProps {
  address?: SignalValue<number>;
  offsetBits?: SignalValue<number>;
  setBits?: SignalValue<number>;
  tagColor?: SignalValue<string>;
  setColor?: SignalValue<string>;
  offsetColor?: SignalValue<string>;
  highlightTagColor?: SignalValue<string>;
  highlightSetColor?: SignalValue<string>;
  highlightOffsetColor?: SignalValue<string>;
}

export class CacheAddrDecoder extends Rect {
  @initial(0)
  @signal()
  declare public readonly address: SimpleSignal<number, this>;

  @initial(2)
  @signal()
  declare public readonly offsetBits: SimpleSignal<number, this>;

  @initial(2)
  @signal()
  declare public readonly setBits: SimpleSignal<number, this>;

  @initial("#1B60DB")
  @signal()
  declare public readonly tagColor: ColorSignal<this>;

  @initial("#db3069")
  @signal()
  declare public readonly setColor: ColorSignal<this>;

  @initial("#DBBF40")
  @signal()
  declare public readonly offsetColor: ColorSignal<this>;

  @initial("#4A8EFF")
  @signal()
  declare public readonly highlightTagColor: ColorSignal<this>;

  @initial("#FF5C94")
  @signal()
  declare public readonly highlightSetColor: ColorSignal<this>;

  @initial("#FFD966")
  @signal()
  declare public readonly highlightOffsetColor: ColorSignal<this>;

  private readonly tagRectRef = createRef<Rect>();
  private readonly setRectRef = createRef<Rect>();
  private readonly offsetRectRef = createRef<Rect>();

  private readonly bitWidth = 70;
  private readonly labelFontSize = 64;
  private readonly bitFontSize = 80;

  public constructor(props: CacheAddrDecoderProps) {
    super({
      layout: true,
      direction: "column",
      gap: 20,
      alignItems: "center",
      ...props,
    });

    this.add(
      <>
        {/* Main Decoder Row */}
        <Layout direction="row" gap={20} alignItems="end">
          {this.renderSection(
            "Tag",
            this.tagColor,
            this.highlightTagColor,
            () => this.getTagBits(),
            () =>
              this.getBinaryPart(
                this.address(),
                this.getTagBits(),
                this.setBits() + this.offsetBits(),
              ),
            this.tagRectRef,
          )}

          {this.renderSection(
            "Set",
            this.setColor,
            this.highlightSetColor,
            this.setBits,
            () =>
              this.getBinaryPart(
                this.address(),
                this.setBits(),
                this.offsetBits(),
              ),
            this.setRectRef,
          )}

          {this.renderSection(
            "Offset",
            this.offsetColor,
            this.highlightOffsetColor,
            this.offsetBits,
            () => this.getBinaryPart(this.address(), this.offsetBits(), 0),
            this.offsetRectRef,
          )}
        </Layout>

        {/* Address Value (Hex) */}
        <Txt
          text={() =>
            `Addr: 0x${(this.address() & 0xff).toString(16).toUpperCase().padStart(2, "0")}`
          }
          fontSize={48}
          fill="#FFF"
          opacity={0.8}
          fontWeight={700}
        />
      </>,
    );
  }

  /**
   * Helper to render a decoder section (Tag/Set/Offset).
   * Uses pure Flex layout for the container, but fixed width for the colored rect.
   * @param label - The label of the section (e.g., "Tag", "Set", "Offset").
   * @param color - The color signal for the section.
   * @param highlightColor - The highlight color signal for the section.
   * @param bitsSignal - A function to get the number of bits for the section.
   * @param textSignal - A function to get the binary text representation for the section.
   * @param rectRef - A reference to the rectangle component for animations.
   */
  private renderSection(
    label: string,
    color: ColorSignal<this>,
    highlightColor: ColorSignal<this>,
    bitsSignal: () => number,
    textSignal: () => string,
    rectRef: Reference<Rect>,
  ) {
    return (
      <Layout
        direction="column"
        gap={10}
        alignItems="center"
        opacity={() => (bitsSignal() > 0 ? 1 : 0)}
        width={() => (bitsSignal() > 0 ? null : 0)}
        scale={() => (bitsSignal() > 0 ? 1 : 0)}
        clip
      >
        {/* Label: Not constrained by bitWidth, freely expands container */}
        <Txt
          text={label}
          fontSize={this.labelFontSize}
          fill={color}
          textAlign="center"
          fontWeight={700}
        />

        {/* Colored Box: Width determined by bits, reflects physical meaning */}
        <Rect
          ref={rectRef}
          fill={color}
          radius={12}
          height={100}
          width={() => Math.max(bitsSignal() * this.bitWidth, 0)}
          alignItems="center"
          justifyContent="center"
          clip
        >
          <Txt
            text={textSignal}
            fontSize={this.bitFontSize}
            fill="#222"
            textAlign="center"
            width="100%"
            fontWeight={700}
          />
        </Rect>
      </Layout>
    );
  }

  /**
   * Calculate the number of tag bits based on the total address bits (8) minus set and offset bits.
   * @returns The number of tag bits.
   */
  private getTagBits(): number {
    return Math.max(0, 8 - this.setBits() - this.offsetBits());
  }

  /**
   * Extract a binary part from the address.
   * @param addr - The address to extract from.
   * @param bits - The number of bits to extract.
   * @param shift - The number of bits to shift right.
   * @returns A string representing the binary part.
   */
  private getBinaryPart(addr: number, bits: number, shift: number): string {
    if (bits <= 0) return "";
    const val = (addr >> shift) & ((1 << bits) - 1);
    return val.toString(2).padStart(bits, "0");
  }

  /**
   * Animate a pulsing effect on rectangles when the address changes.
   * @param duration - The duration of the pulse animation in seconds.
   */
  public *pulseRects(duration: number = 0.3) {
    const rects = [
      { ref: this.tagRectRef, visible: this.getTagBits() > 0 },
      { ref: this.setRectRef, visible: this.setBits() > 0 },
      { ref: this.offsetRectRef, visible: this.offsetBits() > 0 },
    ];

    const visibleRects = rects.filter(({ ref, visible }) => visible && ref());

    yield* all(
      ...visibleRects.map(({ ref }) =>
        chain(
          tween(duration / 2, (value) => {
            ref().scale(1 + 0.1 * easeInOutCubic(value));
          }),
          tween(duration / 2, (value) => {
            ref().scale(1.1 - 0.1 * easeInOutCubic(value));
          }),
        ),
      ),
    );
  }

  /**
   * Animate a flashing effect on rectangles when bit configuration changes.
   * @param duration - The duration of the flash animation in seconds.
   */
  public *flashRects(duration: number = 0.4) {
    const rects = [this.tagRectRef, this.setRectRef, this.offsetRectRef];
    const visibleRects = rects.filter((ref) => ref());

    yield* all(
      ...visibleRects.map((ref) =>
        chain(
          tween(duration / 2, (value) => {
            ref().opacity(1 - 0.5 * easeInOutCubic(value));
          }),
          tween(duration / 2, (value) => {
            ref().opacity(0.5 + 0.5 * easeInOutCubic(value));
          }),
        ),
      ),
    );
  }

  /**
   * Animate the transition to a new address over a specified duration with highlight effect.
   * The background color of all sections will brighten during the animation using linear dodge effect.
   * @param newAddress - The new address to animate to.
   * @param duration - The duration of the animation in seconds.
   */
  public *animateToAddress(newAddress: number, duration: number = 0.5) {
    const startAddress = this.address();

    const sections = [
      {
        ref: this.tagRectRef,
        normalColor: this.tagColor,
        highlightColor: this.highlightTagColor,
        visible: () => this.getTagBits() > 0,
      },
      {
        ref: this.setRectRef,
        normalColor: this.setColor,
        highlightColor: this.highlightSetColor,
        visible: () => this.setBits() > 0,
      },
      {
        ref: this.offsetRectRef,
        normalColor: this.offsetColor,
        highlightColor: this.highlightOffsetColor,
        visible: () => this.offsetBits() > 0,
      },
    ];

    yield* tween(duration, (value) => {
      const progress = easeInOutCubic(value);
      const current = Math.round(
        startAddress + (newAddress - startAddress) * progress,
      );
      this.address(current & 0xff);

      // Linear dodge highlight effect: fade from normal to highlight and back
      const highlightProgress = Math.sin(value * Math.PI);

      sections.forEach(({ ref, normalColor, highlightColor, visible }) => {
        if (visible() && ref()) {
          const normal = new Color(normalColor());
          const highlight = new Color(highlightColor());

          const interpolated = Color.lerp(normal, highlight, highlightProgress);
          ref().fill(interpolated);
        }
      });
    });

    // Reset colors to normal after animation
    sections.forEach(({ ref, normalColor, visible }) => {
      if (visible() && ref()) {
        ref().fill(normalColor());
      }
    });
  }

  /**
   * Animate the transition to a new bit configuration for offset and set bits.
   * @param offsetBits - The new number of offset bits.
   * @param setBits - The new number of set bits.
   * @param duration - The duration of the animation in seconds.
   */
  public *animateToBitConfig(
    offsetBits: number,
    setBits: number,
    duration: number = 0.5,
  ) {
    const startOffset = this.offsetBits();
    const startSet = this.setBits();

    yield* tween(duration, (value) => {
      const progress = easeInOutCubic(value);
      this.offsetBits(
        Math.round(startOffset + (offsetBits - startOffset) * progress),
      );
      this.setBits(Math.round(startSet + (setBits - startSet) * progress));
    });
  }

  /**
   * Animate the transition to a new address with a highlight effect on a specified field.
   * @param newAddress - The new address to animate to.
   * @param highlightField - The field to highlight ('tag', 'set', or 'offset').
   * @param duration - The duration of the animation in seconds.
   */
  public *animateAddressWithHighlight(
    newAddress: number,
    highlightField: "tag" | "set" | "offset",
    duration: number = 0.5,
  ) {
    const refMap = {
      tag: this.tagRectRef,
      set: this.setRectRef,
      offset: this.offsetRectRef,
    };

    const targetRef = refMap[highlightField];

    yield* all(
      this.animateToAddress(newAddress, duration),
      tween(duration, (value) => {
        if (targetRef()) {
          const pulse = Math.sin(value * Math.PI * 2) * 0.1 + 1;
          targetRef().scale(pulse);
        }
      }),
    );

    if (targetRef()) {
      yield* targetRef().scale(1, 0.1);
    }
  }
}
