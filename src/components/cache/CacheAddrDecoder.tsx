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
  tween,
  easeInOutCubic,
  Color,
  chain,
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

  @initial(false)
  @signal()
  declare public readonly swapped: SimpleSignal<boolean, this>;

  private readonly tagRectRef = createRef<Rect>();
  private readonly setRectRef = createRef<Rect>();
  private readonly offsetRectRef = createRef<Rect>();

  private readonly tagLayoutRef = createRef<Layout>();
  private readonly setLayoutRef = createRef<Layout>();
  private readonly padLayoutRef = createRef<Layout>();

  private readonly bitWidth = 70;
  private readonly labelFontSize = 64;
  private readonly bitFontSize = 80;
  private readonly sectionGap = 20;

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
        {/* Main Decoder Row (Manual Layout) */}
        <Layout layout={false} width={() => this.getTotalWidth()} height={180}>
          {this.renderTagSection()}
          {this.renderSetSection()}
          {this.renderOffsetSection()}
        </Layout>

        <Layout
          ref={this.padLayoutRef}
          width={() => this.getTotalWidth()}
          height={180 + 80}
        />

        {/* Address Value (Hex) */}
        <Txt
          text={() =>
            `Addr: 0x${(this.address() & 0xff)
              .toString(16)
              .toUpperCase()
              .padStart(2, "0")}`
          }
          fontSize={48}
          fill="#FFF"
          opacity={0.8}
          fontWeight={700}
        />
      </>,
    );
  }

  // --- Layout Helpers ---

  private getTagWidth(): number {
    return this.getTagBits() > 0 ? this.getTagBits() * this.bitWidth : 0;
  }

  private getSetWidth(): number {
    return this.setBits() > 0 ? this.setBits() * this.bitWidth : 0;
  }

  private getOffsetWidth(): number {
    return this.offsetBits() > 0 ? this.offsetBits() * this.bitWidth : 0;
  }

  private getTotalWidth(): number {
    const widths = [
      this.getTagWidth(),
      this.getSetWidth(),
      this.getOffsetWidth(),
    ].filter((w) => w > 0);
    const gaps = Math.max(0, widths.length - 1) * this.sectionGap;
    return widths.reduce((a, b) => a + b, 0) + gaps;
  }

  private getSectionX(section: "tag" | "set" | "offset"): number {
    const tagW = this.getTagWidth();
    const setW = this.getSetWidth();
    const offsetW = this.getOffsetWidth();
    const totalW = this.getTotalWidth();
    const startX = -totalW / 2;
    const gap = this.sectionGap;

    // Define the visual order based on swapped state
    // Standard: Tag | Set | Offset
    // Swapped:  Set | Tag | Offset
    const isSwapped = this.swapped();

    let pos = startX;

    if (section === "offset") {
      // Offset is always last
      const prevWidths = isSwapped ? setW + tagW : tagW + setW;
      const prevGaps =
        (tagW > 0 ? 1 : 0) + (setW > 0 ? 1 : 0) > 0 ? gap * 2 : gap; // simplified gap logic approximation
      // More accurate accumulation:
      let x = startX;
      if (isSwapped) {
        if (setW > 0) x += setW + gap;
        if (tagW > 0) x += tagW + gap;
      } else {
        if (tagW > 0) x += tagW + gap;
        if (setW > 0) x += setW + gap;
      }
      return x + offsetW / 2;
    }

    if (section === "tag") {
      if (isSwapped) {
        // Positioned second (after Set)
        let x = startX;
        if (setW > 0) x += setW + gap;
        return x + tagW / 2;
      } else {
        // Positioned first
        return startX + tagW / 2;
      }
    }

    if (section === "set") {
      if (isSwapped) {
        // Positioned first
        return startX + setW / 2;
      } else {
        // Positioned second (after Tag)
        let x = startX;
        if (tagW > 0) x += tagW + gap;
        return x + setW / 2;
      }
    }

    return 0;
  }

  // --- Render Sections ---

  private renderTagSection() {
    return (
      <Layout
        layout={true}
        ref={this.tagLayoutRef}
        direction="column"
        gap={10}
        alignItems="center"
        x={() => this.getSectionX("tag")}
        opacity={() => (this.getTagBits() > 0 ? 1 : 0)}
        scale={() => (this.getTagBits() > 0 ? 1 : 0)}
      >
        <Txt
          text="Tag"
          fontSize={this.labelFontSize}
          fill={this.tagColor}
          textAlign="center"
          fontWeight={700}
        />
        <Rect
          ref={this.tagRectRef}
          fill={this.tagColor}
          radius={12}
          height={100}
          width={() => Math.max(this.getTagWidth(), 0)}
          alignItems="center"
          justifyContent="center"
          clip
        >
          <Txt
            text={() => {
              // If swapped, Tag is in the middle (lower order than Set)
              // Shift = offsetBits
              // If not swapped, Tag is MSB
              // Shift = setBits + offsetBits
              const shift = this.swapped()
                ? this.offsetBits()
                : this.setBits() + this.offsetBits();
              return this.getBinaryPart(
                this.address(),
                this.getTagBits(),
                shift,
              );
            }}
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

  private renderSetSection() {
    return (
      <Layout
        layout={true}
        ref={this.setLayoutRef}
        direction="column"
        gap={10}
        alignItems="center"
        x={() => this.getSectionX("set")}
        opacity={() => (this.setBits() > 0 ? 1 : 0)}
        scale={() => (this.setBits() > 0 ? 1 : 0)}
      >
        <Txt
          text="Set"
          fontSize={this.labelFontSize}
          fill={this.setColor}
          textAlign="center"
          fontWeight={700}
        />
        <Rect
          ref={this.setRectRef}
          fill={this.setColor}
          radius={12}
          height={100}
          width={() => Math.max(this.getSetWidth(), 0)}
          alignItems="center"
          justifyContent="center"
          clip
        >
          <Txt
            text={() => {
              // If swapped, Set is MSB
              // Shift = tagBits + offsetBits
              // If not swapped, Set is Middle
              // Shift = offsetBits
              const shift = this.swapped()
                ? this.getTagBits() + this.offsetBits()
                : this.offsetBits();
              return this.getBinaryPart(this.address(), this.setBits(), shift);
            }}
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

  private renderOffsetSection() {
    return (
      <Layout
        layout={true}
        direction="column"
        gap={10}
        alignItems="center"
        x={() => this.getSectionX("offset")}
        opacity={() => (this.offsetBits() > 0 ? 1 : 0)}
        scale={() => (this.offsetBits() > 0 ? 1 : 0)}
      >
        <Txt
          text="Offset"
          fontSize={this.labelFontSize}
          fill={this.offsetColor}
          textAlign="center"
          fontWeight={700}
        />
        <Rect
          ref={this.offsetRectRef}
          fill={this.offsetColor}
          radius={12}
          height={100}
          width={() => Math.max(this.getOffsetWidth(), 0)}
          alignItems="center"
          justifyContent="center"
          clip
        >
          <Txt
            text={() =>
              this.getBinaryPart(this.address(), this.offsetBits(), 0)
            }
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
   */
  private getTagBits(): number {
    return Math.max(0, 8 - this.setBits() - this.offsetBits());
  }

  /**
   * Extract a binary part from the address.
   */
  private getBinaryPart(addr: number, bits: number, shift: number): string {
    if (bits <= 0) return "";
    const val = (addr >> shift) & ((1 << bits) - 1);
    return val.toString(2).padStart(bits, "0");
  }

  // --- Animations ---

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

    sections.forEach(({ ref, normalColor, visible }) => {
      if (visible() && ref()) {
        ref().fill(normalColor());
      }
    });
  }

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

  /**
   * Animate swapping the Tag and Set fields.
   * This physically moves the blocks and swaps their bit interpretations.
   */
  public *animateSwapTagAndSet(duration: number = 0.8) {
    if (this.swapped()) return;

    const tagLayout = this.tagLayoutRef();
    const setLayout = this.setLayoutRef();
    if (!tagLayout || !setLayout) return;

    const tagStartX = this.getSectionX("tag");
    const setStartX = this.getSectionX("set");

    const gap = this.sectionGap;
    const tagW = this.getTagWidth();
    const setW = this.getSetWidth();
    const totalW = this.getTotalWidth();
    const startX = -totalW / 2;

    const setTargetX = startX + setW / 2;
    const tagTargetX = startX + setW + gap + tagW / 2;

    yield* all(
      tween(duration * 0.15, (v) => {
        const s = 1 - 0.1 * easeInOutCubic(v);
        tagLayout.scale(s);
        setLayout.scale(s);
      }),
    );

    yield* all(
      tween(duration * 0.7, (v) => {
        const p = easeInOutCubic(v);
        const lift = Math.sin(p * Math.PI) * 60;

        tagLayout.x(tagStartX + (tagTargetX - tagStartX) * p);
        tagLayout.y(-lift);

        setLayout.x(setStartX + (setTargetX - setStartX) * p);
        setLayout.y(lift * 0.5);
      }),
    );

    this.swapped(true);

    tagLayout.x(this.getSectionX("tag"));
    setLayout.x(this.getSectionX("set"));

    yield* all(
      tween(duration * 0.15, (v) => {
        const s = 0.9 + 0.1 * easeInOutCubic(v);
        tagLayout.scale(s);
        setLayout.scale(s);
      }),
    );

    tagLayout.y(0);
    setLayout.y(0);
  }

  /**
   * Animate restoring the Tag and Set fields to their original positions.
   */
  public *animateRestoreTagAndSet(duration: number = 0.8) {
    if (!this.swapped()) return;

    const tagLayout = this.tagLayoutRef();
    const setLayout = this.setLayoutRef();
    if (!tagLayout || !setLayout) return;

    const tagStartX = this.getSectionX("tag");
    const setStartX = this.getSectionX("set");

    const gap = this.sectionGap;
    const tagW = this.getTagWidth();
    const setW = this.getSetWidth();
    const totalW = this.getTotalWidth();
    const startX = -totalW / 2;

    const tagTargetX = startX + tagW / 2;
    const setTargetX = startX + tagW + gap + setW / 2;

    yield* all(
      tween(duration * 0.15, (v) => {
        const s = 1 - 0.1 * easeInOutCubic(v);
        tagLayout.scale(s);
        setLayout.scale(s);
      }),
    );

    yield* all(
      tween(duration * 0.7, (v) => {
        const p = easeInOutCubic(v);
        const lift = Math.sin(p * Math.PI) * 60;

        tagLayout.x(tagStartX + (tagTargetX - tagStartX) * p);
        tagLayout.y(-lift);

        setLayout.x(setStartX + (setTargetX - setStartX) * p);
        setLayout.y(lift * 0.5);
      }),
    );

    this.swapped(false);

    tagLayout.x(this.getSectionX("tag"));
    setLayout.x(this.getSectionX("set"));

    yield* all(
      tween(duration * 0.15, (v) => {
        const s = 0.9 + 0.1 * easeInOutCubic(v);
        tagLayout.scale(s);
        setLayout.scale(s);
      }),
    );

    tagLayout.y(0);
    setLayout.y(0);
  }
}
