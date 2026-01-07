import {
  Layout,
  RectProps,
  Rect,
  Txt,
  initial,
  signal,
} from "@motion-canvas/2d";
import {
  createRef,
  Reference,
  ColorSignal,
  SignalValue,
  SimpleSignal,
  Random,
  all,
} from "@motion-canvas/core";
import { DataBus } from "../DataBus";
import { BusSlaveHandler, Payload } from "../../schemes/DataBusScheme";
import { RequestPacket, ResponsePacket } from "../../schemes/PacketScheme";
import { ReplacementPolicy, CacheLine, CacheField } from "../../schemes/Cache";
import { MotionGenerator } from "../../schemes/UtilScheme";
import { CacheAddrDecoder } from "./CacheAddrDecoder";
import { CacheData } from "./CacheData";
import { CacheLogic } from "./CacheLogic";
import { CacheAnimator } from "./CacheAnimator";
import { SimpleAnimator } from "./SimpleAnimator";
import { DetailedAnimator } from "./DetailedAnimator";
import { CacheRequestHandler } from "./CacheRequestHandler";

/**
 * Factory function to create a random replacement policy.
 */
export const createRandomPolicy = (random: Random): ReplacementPolicy => {
  return (ways: CacheLine[]) => {
    return random.nextInt(0, ways.length);
  };
};

/**
 * LRU replacement policy.
 */
export const LRU_POLICY: ReplacementPolicy = (ways: CacheLine[]) => {
  let minLru = Infinity;
  let victim = 0;
  for (let i = 0; i < ways.length; i++) {
    if (!ways[i].valid) return i;
    if (ways[i].replaceState < minLru) {
      minLru = ways[i].replaceState;
      victim = i;
    }
  }
  return victim;
};

/**
 * Props for the Cache component.
 */
export interface CacheProps extends RectProps {
  bus: Reference<DataBus>;
  titlePrefix?: SignalValue<string>;
  backgroundFill?: SignalValue<string>;
  contentFill?: SignalValue<string>;
  offsetBits?: number;
  setBits?: number;
  numWays?: number;
  replacementPolicy?: ReplacementPolicy;
}

/**
 * Cache component that coordinates logic, animation, and request handling.
 * Acts as the main orchestrator and Motion Canvas component.
 */
export class Cache extends Rect {
  @initial(null)
  @signal()
  declare public readonly backgroundFill: ColorSignal<this>;

  @initial("#FFF")
  @signal()
  declare public readonly contentFill: ColorSignal<this>;

  @initial("L1")
  @signal()
  declare public readonly titlePrefix: SimpleSignal<string>;

  // ==========================================================================
  // Internal References
  // ==========================================================================

  private readonly bus: Reference<DataBus>;
  private readonly titleRef = createRef<Txt>();
  private readonly labelRef = createRef<Txt>();
  private readonly containerRef = createRef<Rect>();

  private readonly detailContainerRef = createRef<Rect>();
  private readonly detailLayoutRef = createRef<Layout>();
  private readonly overlayRef = createRef<Rect>();

  private readonly addrDecoderRef = createRef<CacheAddrDecoder>();
  private readonly cacheDataRef = createRef<CacheData>();
  private readonly cacheDataWrapperRef = createRef<Layout>();

  // ==========================================================================
  // Core Modules
  // ==========================================================================

  private readonly logic: CacheLogic;
  private readonly simpleAnimator: SimpleAnimator;
  private readonly detailedAnimator: DetailedAnimator;
  private readonly requestHandler: CacheRequestHandler;

  private isDetailedMode = false;

  public constructor(props: CacheProps) {
    const {
      bus,
      titlePrefix,
      backgroundFill,
      contentFill,
      offsetBits = 2,
      setBits = 2,
      numWays = 2,
      replacementPolicy = LRU_POLICY,
      ...layoutProps
    } = props;

    super({
      ...layoutProps,
      layout: true,
      direction: "column",
      alignItems: "center",
      justifyContent: "center",
      radius: 24,
      lineWidth: 20,
      stroke: backgroundFill,
    });

    if (backgroundFill !== undefined) this.backgroundFill(backgroundFill);
    if (contentFill !== undefined) this.contentFill(contentFill);
    if (titlePrefix !== undefined) this.titlePrefix(titlePrefix);

    this.fill(this.backgroundFill);
    this.bus = bus;

    // Initialize logic layer
    this.logic = new CacheLogic(
      offsetBits,
      setBits,
      numWays,
      replacementPolicy,
    );

    // Build UI structure first (refs needed for animators)
    this.buildUI(offsetBits, setBits, numWays);

    // Initialize animators (after refs are available)
    this.simpleAnimator = new SimpleAnimator(this.containerRef, this.labelRef);
    this.detailedAnimator = new DetailedAnimator(
      this.addrDecoderRef,
      this.cacheDataRef,
    );

    // Initialize request handler
    this.requestHandler = new CacheRequestHandler(
      this.logic,
      () => this.getCurrentAnimator(),
      this.bus,
    );
  }

  /**
   * Build the UI structure for the cache component.
   */
  private buildUI(offsetBits: number, setBits: number, numWays: number): void {
    const numSets = this.logic.getNumSets();
    const lineSize = this.logic.getLineSize();
    const tagBits = this.logic.getTagBits();

    this.add(
      <>
        {/* Simple Mode Container */}
        <Rect
          ref={this.containerRef}
          width={"100%"}
          height={"100%"}
          layout={true}
          direction={"column"}
          alignItems={"center"}
          justifyContent={"center"}
          padding={20}
          gap={10}
        >
          <Txt
            ref={this.titleRef}
            fill={this.contentFill}
            fontSize={80}
            fontWeight={700}
            text={() => `${this.titlePrefix()} Cache`}
          />
          <Txt
            ref={this.labelRef}
            fill={this.contentFill}
            fontSize={48}
            fontWeight={700}
            text={"IDLE"}
          />
        </Rect>

        {/* Detailed Mode Container */}
        <Rect
          ref={this.detailContainerRef}
          width={() => this.width()}
          height={() => this.height()}
          layout={false}
          opacity={0}
        >
          <Layout
            ref={this.detailLayoutRef}
            width={() => this.detailContainerRef().width()}
            height={() => this.detailContainerRef().height()}
            layout={true}
            direction={"column"}
            alignItems={"center"}
            justifyContent={"start"}
            padding={20}
            clip
          >
            <CacheAddrDecoder
              ref={this.addrDecoderRef}
              offsetBits={offsetBits}
              setBits={setBits}
              width="100%"
              margin={[20, 0]}
            />
            <Layout ref={this.cacheDataWrapperRef} grow={1} width={"100%"}>
              <CacheData
                ref={this.cacheDataRef}
                numSets={numSets}
                numWays={numWays}
                lineSize={lineSize}
                tagBits={tagBits}
                offsetBits={offsetBits}
                setBits={setBits}
                stackOffset={80}
                width={() => this.cacheDataWrapperRef().width() - 40}
                containerHeight={() => this.cacheDataWrapperRef().height()}
              />
            </Layout>
          </Layout>
        </Rect>

        {/* Transition Overlay */}
        <Rect
          ref={this.overlayRef}
          width={() => this.width() + 20}
          y={() => this.height() / 2 + 10}
          height={0}
          fill={this.contentFill}
          layout={false}
          radius={this.radius}
        />
      </>,
    );
  }

  /**
   * Get the current animator based on mode.
   */
  private getCurrentAnimator(): CacheAnimator {
    return this.isDetailedMode ? this.detailedAnimator : this.simpleAnimator;
  }

  // ==========================================================================
  // Public API - Properties
  // ==========================================================================

  /**
   * Get the cache line size in bytes.
   */
  public getLineSize(): number {
    return this.logic.getLineSize();
  }

  /**
   * Get the detail layout reference for external positioning.
   */
  public getDetailLayout(): Layout {
    return this.detailLayoutRef();
  }

  // ==========================================================================
  // Public API - Mode Transformations
  // ==========================================================================

  /**
   * Transform to detailed visualization mode.
   */
  public *transformDetailed(
    width: number,
    height: number,
  ): MotionGenerator<void> {
    this.isDetailedMode = true;
    this.cacheDataRef().setInitialState(this.logic.getCacheData());

    yield* all(
      this.overlayRef().height(this.height() + 20, 1.0),
      this.overlayRef().y(0, 1.0),
    );

    yield* all(
      this.size([width, height], 1.0),
      this.overlayRef().height(height + 20, 1.0),
    );

    this.fill("#00000000");
    this.containerRef().opacity(0);
    this.detailContainerRef().opacity(1);

    yield* all(
      this.overlayRef().height(0, 1.0),
      this.overlayRef().y(height / 2 + 10, 1.0),
    );
  }

  /**
   * Immediately switch to detailed visualization mode without animation.
   * Useful for initial setup or when animation is not needed.
   */
  public setDetailedImmediate(width: number, height: number): void {
    this.isDetailedMode = true;
    this.cacheDataRef().setInitialState(this.logic.getCacheData());

    // Set final size
    this.size([width, height]);

    // Set overlay to hidden state
    this.overlayRef().height(0);
    this.overlayRef().y(height / 2 + 10);

    // Set visual state for detailed mode
    this.fill("#00000000");
    this.containerRef().opacity(0);
    this.detailContainerRef().opacity(1);
  }

  /**
   * Transform back to simple visualization mode.
   */
  public *transformSimple(
    width: number,
    height: number,
  ): MotionGenerator<void> {
    this.isDetailedMode = false;

    yield* all(
      this.overlayRef().height(this.height() + 20, 1.0),
      this.overlayRef().y(0, 1.0),
    );

    this.fill("#00000000");
    this.detailContainerRef().opacity(0);
    this.containerRef().opacity(1);
    this.lineWidth(0);

    yield* all(
      this.size([width, height], 1.0),
      this.overlayRef().height(height + 20, 1.0),
    );

    this.fill(this.backgroundFill);

    yield* all(
      this.overlayRef().height(0, 1.0),
      this.overlayRef().y(height / 2 + 10, 1.0),
    );
  }

  /**
   * Immediately switch to simple visualization mode without animation.
   * Useful for initial setup or when animation is not needed.
   */
  public setSimpleImmediate(width: number, height: number): void {
    this.isDetailedMode = false;

    // Set final size
    this.size([width, height]);

    // Set overlay to hidden state
    this.overlayRef().height(0);
    this.overlayRef().y(height / 2 + 10);

    // Set visual state for simple mode
    this.fill(this.backgroundFill);
    this.lineWidth(20);
    this.detailContainerRef().opacity(0);
    this.containerRef().opacity(1);
  }

  // ==========================================================================
  // Public API - Request Operations
  // ==========================================================================

  /**
   * Send a read or write request through the cache.
   */
  public *sendRequest(
    addr: number,
    data: bigint | number | null = null,
    size: number = 0,
  ): MotionGenerator<Payload<ResponsePacket>> {
    return yield* this.requestHandler.sendRequest(addr, data, size);
  }

  /**
   * Get the bus slave handler for registration with DataBus.
   */
  public getHandler(): BusSlaveHandler<RequestPacket, ResponsePacket> {
    return this.requestHandler.getHandler();
  }

  // ==========================================================================
  // Public API - Educational Animations
  // ==========================================================================

  /**
   * Highlight a specific cache field for educational purposes.
   * Only effective in detailed mode.
   */
  public *introCacheField(
    field: CacheField,
    scale: number = 1.3,
    duration: number = 0.4,
  ): MotionGenerator<void> {
    if (!this.isDetailedMode) {
      return;
    }
    const animator = this.getCurrentAnimator();
    if (animator.introCacheField) {
      yield* animator.introCacheField(field, scale, duration);
    }
  }

  /**
   * Reset the field highlight.
   * Only effective in detailed mode.
   */
  public *resetFieldIntro(
    field: CacheField,
    duration: number = 0.3,
  ): MotionGenerator<void> {
    if (!this.isDetailedMode) {
      return;
    }
    const animator = this.getCurrentAnimator();
    if (animator.resetFieldIntro) {
      yield* animator.resetFieldIntro(field, duration);
    }
  }

  /**
   * Animate swapping the Tag and Set fields to demonstrate high-order set indexing.
   * This animation visually exchanges the positions of Tag and Set sections,
   * illustrating why placing Set bits in the high-order position violates
   * spatial locality principles in cache design.
   *
   * @param duration - The total duration of the swap animation in seconds.
   * @returns A generator that yields the animation sequence.
   */
  public *animateSwapTagAndSet(duration: number = 0.8) {
    yield* this.addrDecoderRef().animateSwapTagAndSet(duration);
  }

  /**
   * Animate restoring the Tag and Set fields to their original positions.
   * This reverses the swap animation, returning the decoder to the standard
   * cache addressing scheme where Set bits are in the middle position.
   *
   * @param duration - The total duration of the restore animation in seconds.
   * @returns A generator that yields the animation sequence.
   */
  public *animateRestoreTagAndSet(duration: number = 0.8) {
    yield* this.addrDecoderRef().animateRestoreTagAndSet(duration);
  }
}
