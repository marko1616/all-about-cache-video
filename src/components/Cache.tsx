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
  waitFor,
  Reference,
  ColorSignal,
  SignalValue,
  SimpleSignal,
  Random,
  all,
} from "@motion-canvas/core";

import { DataBus } from "./DataBus";
import { BusSlaveHandler, Payload } from "../schemes/DataBusScheme";
import {
  LineReadRequest,
  LineWriteRequest,
  LineReadResponse,
  LineWriteResponse,
  RequestPacket,
  ResponsePacket,
  ReadRequest,
  WriteRequest,
  ReadResponse,
  WriteResponse,
  InvalidateRequest,
  InvalidateResponse,
  CleanRequest,
  CleanResponse,
  FlushRequest,
  FlushResponse,
  ZeroRequest,
  ZeroResponse,
  PrefetchRequest,
  PrefetchResponse,
} from "../schemes/PacketScheme";

import { ReplacementPolicy, CacheLine } from "../schemes/Cache";

import {
  applyWriteMask,
  formatWriteMask,
  isLineReadRequest,
  isLineWriteRequest,
  isReadResponse,
  isWriteRequest,
  formatAddr,
  formatMultiByteValue,
  getSizeSuffix,
  getSizeInBytes,
  maskToSize,
  toBigInt,
  isInvalRequest,
  isCleanRequest,
  isFlushRequest,
  isZeroRequest,
  isPrefetchRequest,
} from "../utils/PacketUtils";

import { MotionGenerator } from "../schemes/UtilScheme";

import { CacheAddrDecoder } from "./CacheAddrDecoder";
import { CacheData } from "./CacheData";

/**
 * Factory function to create a random replacement policy.
 * @param random - The random number generator instance
 * @returns A replacement policy that randomly selects a cache line to replace
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
 * Represents a Cache Unit with configurable geometry and replacement policy.
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

  private readonly bus: Reference<DataBus>;
  private readonly titleRef = createRef<Txt>();
  private readonly labelRef = createRef<Txt>();
  private readonly containerRef = createRef<Rect>();

  private readonly detailContainerRef = createRef<Rect>();
  private readonly detailLayoutRef = createRef<Layout>();
  private readonly overlayRef = createRef<Rect>();

  private readonly addrDecoderRef = createRef<CacheAddrDecoder>();
  private readonly cacheDataRef = createRef<CacheData>();
  private readonly cacheDataWrapperRef = createRef<CacheData>();

  private readonly offsetBits: number;
  private readonly setBits: number;
  private readonly numWays: number;
  private readonly numSets: number;
  private readonly lineSize: number;
  private readonly _tagBits: number;
  private readonly replacementPolicy: ReplacementPolicy;

  private readonly cacheData: CacheLine[][];
  private lruCounter: number = 0;
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

    this.offsetBits = offsetBits;
    this.setBits = setBits;
    this.numWays = numWays;
    this.numSets = setBits > 0 ? 1 << setBits : 1;
    this.lineSize = 1 << offsetBits;
    this._tagBits = 8 - offsetBits - setBits;
    this.replacementPolicy = replacementPolicy;

    this.cacheData = [];
    for (let s = 0; s < this.numSets; s++) {
      const set: CacheLine[] = [];
      for (let w = 0; w < this.numWays; w++) {
        set.push({
          valid: false,
          dirty: false,
          tag: 0,
          data: BigInt(0),
          replaceState: 0,
        });
      }
      this.cacheData.push(set);
    }

    this.add(
      <>
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
              offsetBits={this.offsetBits}
              setBits={this.setBits}
              width="100%"
              margin={[20, 0]}
            />
            <Layout ref={this.cacheDataWrapperRef} grow={1} width={"100%"}>
              <CacheData
                ref={this.cacheDataRef}
                numSets={this.numSets}
                numWays={this.numWays}
                lineSize={this.lineSize}
                tagBits={this._tagBits}
                offsetBits={this.offsetBits}
                setBits={this.setBits}
                stackOffset={80}
                width={() => this.cacheDataWrapperRef().width() - 40}
                containerHeight={() => this.cacheDataWrapperRef().height()}
              />
            </Layout>
          </Layout>
        </Rect>
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

  public getLineSize(): number {
    return this.lineSize;
  }

  public getDetailLayout(): Layout {
    return this.detailLayoutRef();
  }

  // ==========================================================================
  // Animation Routers & Helpers
  // ==========================================================================

  /**
   * Animates the start of a request.
   * Routes to detailed or simple animation based on mode.
   */
  private *animateRequestStart(
    addr: number | undefined,
    label: string,
  ): MotionGenerator<void> {
    if (this.isDetailedMode) {
      if (addr !== undefined) {
        // In detailed mode, update the address decoder
        yield* this.addrDecoderRef().animateToAddress(addr, 1);

        // Also focus the relevant set if we can calculate it
        const { setIndex } = this.parseAddress(addr);
        yield* this.cacheDataRef().focusSet(setIndex);
      }
    } else {
      // In simple mode, update label and scale container
      this.labelRef().text(label);
      yield* this.containerRef().scale(1.03, 0.2);
    }
  }

  /**
   * Animates a Cache Hit.
   */
  private *animateHit(
    setIndex?: number,
    wayIndex?: number,
  ): MotionGenerator<void> {
    if (this.isDetailedMode) {
      // Detailed: Highlight the Tag/Set match
      const currentAddr = this.addrDecoderRef().address();

      // Ensure the set is focused (in case it wasn't already)
      if (setIndex !== undefined) {
        yield* this.cacheDataRef().focusSet(setIndex);
      }

      yield* all(
        this.addrDecoderRef().animateAddressWithHighlight(
          currentAddr,
          "tag",
          1,
        ),
        // Highlight the specific line if indices are provided
        setIndex !== undefined && wayIndex !== undefined
          ? this.cacheDataRef().highlightLine(setIndex, wayIndex)
          : waitFor(0.1),
      );
    } else {
      this.labelRef().text("HIT");
    }
  }

  /**
   * Animates a Cache Miss.
   */
  private *animateMiss(): MotionGenerator<void> {
    if (this.isDetailedMode) {
      yield* waitFor(0.3);
    } else {
      this.labelRef().text("MISS");
      yield* waitFor(0.3);
    }
  }

  /**
   * Animates the start of a Fetch operation.
   */
  private *animateFetchStart(addr: number): MotionGenerator<void> {
    if (this.isDetailedMode) {
      // Ensure set is focused for the incoming line
      const { setIndex } = this.parseAddress(addr);
      yield* this.cacheDataRef().focusSet(setIndex);
    } else {
      this.labelRef().text("FETCH...");
    }
    yield* waitFor(0.1);
  }

  /**
   * Animates the start of a Write Back operation.
   */
  private *animateWriteBackStart(addr: number): MotionGenerator<void> {
    if (this.isDetailedMode) {
      const { setIndex } = this.parseAddress(addr);
      yield* this.cacheDataRef().focusSet(setIndex);
    } else {
      // Simple mode logic
    }
    yield* waitFor(0.1);
  }

  /**
   * Animates the completion of a request.
   */
  private *animateRequestEnd(finalLabel: string): MotionGenerator<void> {
    if (this.isDetailedMode) {
      // Detailed cleanup
    } else {
      this.labelRef().text(finalLabel);
      yield* this.containerRef().scale(1.0, 0.2);
      yield* waitFor(0.3);
      this.labelRef().text("IDLE");
    }
  }

  /**
   * Helper to update visual state of a line in detailed mode
   */
  private *animateLineUpdate(
    setIndex: number,
    wayIndex: number,
    line: CacheLine,
  ): MotionGenerator<void> {
    if (this.isDetailedMode) {
      yield* this.cacheDataRef().updateLine(setIndex, wayIndex, line);
    }
  }

  // ==========================================================================
  // Mode Transformations
  // ==========================================================================

  public *transformDetailed(
    width: number,
    height: number,
  ): MotionGenerator<void> {
    this.isDetailedMode = true;
    this.cacheDataRef().setInitialState(this.cacheData);

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

  // ==========================================================================
  // Core Logic
  // ==========================================================================

  private parseAddress(addr: number): {
    tag: number;
    setIndex: number;
    offset: number;
  } {
    const safeAddr = addr & 0xff;
    const offset = safeAddr & ((1 << this.offsetBits) - 1);
    const setIndex =
      this.setBits > 0
        ? (safeAddr >> this.offsetBits) & ((1 << this.setBits) - 1)
        : 0;
    const tag = safeAddr >> (this.offsetBits + this.setBits);
    return { tag, setIndex, offset };
  }

  private getLineBaseAddress(tag: number, setIndex: number): number {
    return (
      (tag << (this.offsetBits + this.setBits)) | (setIndex << this.offsetBits)
    );
  }

  private findLine(setIndex: number, tag: number): number {
    const set = this.cacheData[setIndex];
    for (let i = 0; i < set.length; i++) {
      if (set[i].valid && set[i].tag === tag) {
        return i;
      }
    }
    return -1;
  }

  private updateReplaceState(line: CacheLine): void {
    line.replaceState = ++this.lruCounter;
  }

  private readByteFromLine(line: CacheLine, offset: number): number {
    return Number((line.data >> BigInt(offset * 8)) & BigInt(0xff));
  }

  private writeByteToLine(
    line: CacheLine,
    offset: number,
    value: number,
  ): void {
    const shift = BigInt(offset * 8);
    const mask = BigInt(0xff) << shift;
    line.data = (line.data & ~mask) | (BigInt(value & 0xff) << shift);
  }

  private readBytesFromLine(
    line: CacheLine,
    offset: number,
    byteCount: number,
  ): bigint {
    let result = BigInt(0);
    for (let i = 0; i < byteCount; i++) {
      const byteVal = this.readByteFromLine(line, offset + i);
      result |= BigInt(byteVal) << BigInt(i * 8);
    }
    return result;
  }

  private writeBytesToLine(
    line: CacheLine,
    offset: number,
    value: bigint,
    byteCount: number,
  ): void {
    for (let i = 0; i < byteCount; i++) {
      const byteVal = Number((value >> BigInt(i * 8)) & BigInt(0xff));
      this.writeByteToLine(line, offset + i, byteVal);
    }
  }

  private *fetchLine(
    setIndex: number,
    tag: number,
  ): MotionGenerator<CacheLine> {
    const set = this.cacheData[setIndex];
    const victimIdx = this.replacementPolicy(set);
    const victim = set[victimIdx];

    yield* this.writeBackLine(victim, setIndex);

    const baseAddr = this.getLineBaseAddress(tag, setIndex);

    yield* this.animateFetchStart(baseAddr);

    const readReq: ReadRequest = {
      type: "read",
      addr: baseAddr,
      size: this.offsetBits,
    };
    const payload: Payload<RequestPacket> = {
      id: "",
      display: `FETCH ${formatAddr(baseAddr)}`,
      content: readReq,
    };
    const response = yield* this.bus().performTransaction(payload);

    let lineData = BigInt(0);
    if (isReadResponse(response.content)) {
      lineData = response.content.value;
    }

    victim.valid = true;
    victim.dirty = false;
    victim.tag = tag;
    victim.data = lineData;
    this.updateReplaceState(victim);

    // 4b. Update State on Fetch
    yield* this.animateLineUpdate(setIndex, victimIdx, victim);

    return victim;
  }

  private *writeBackLine(
    line: CacheLine,
    setIndex: number,
  ): MotionGenerator<void> {
    if (!line.valid || !line.dirty) return;

    const baseAddr = this.getLineBaseAddress(line.tag, setIndex);

    yield* this.animateWriteBackStart(baseAddr);

    const writeReq: WriteRequest = {
      type: "write",
      addr: baseAddr,
      size: this.offsetBits,
      value: line.data,
    };
    const payload: Payload<RequestPacket> = {
      id: "",
      display: `WB ${formatAddr(baseAddr)}`,
      content: writeReq,
    };
    yield* this.bus().performTransaction(payload);

    line.dirty = false;
  }

  /**
   * Invalidate cache line(s) - discard without writeback.
   */
  private *handleInvalidate(
    id: string,
    req: InvalidateRequest,
  ): MotionGenerator<Payload<ResponsePacket>> {
    const safeAddr = req.addr !== undefined ? req.addr & 0xff : undefined;
    yield* this.animateRequestStart(safeAddr, "INVALIDATING...");

    let resultText = "";

    if (req.global || req.addr === undefined) {
      // Invalidate all cache lines
      for (let s = 0; s < this.numSets; s++) {
        for (let w = 0; w < this.numWays; w++) {
          this.cacheData[s][w].valid = false;
          this.cacheData[s][w].dirty = false;
          yield* this.animateLineUpdate(s, w, this.cacheData[s][w]);
        }
      }
      resultText = "ALL INVALIDATED";
    } else {
      // Invalidate specific address
      const { tag, setIndex } = this.parseAddress(req.addr);
      const wayIdx = this.findLine(setIndex, tag);

      if (wayIdx >= 0) {
        yield* this.animateHit(setIndex, wayIdx);
        this.cacheData[setIndex][wayIdx].valid = false;
        this.cacheData[setIndex][wayIdx].dirty = false;
        yield* this.animateLineUpdate(
          setIndex,
          wayIdx,
          this.cacheData[setIndex][wayIdx],
        );
        resultText = `INVAL ${formatAddr(req.addr)}`;
      } else {
        yield* this.animateMiss();
        resultText = `INVAL MISS`;
      }
    }

    yield* this.animateRequestEnd(resultText);

    const response: InvalidateResponse = {
      type: "inval",
      success: true,
    };

    return {
      id: id,
      display: req.global ? "INVAL ALL" : `INVAL ${formatAddr(req.addr!)}`,
      content: response,
    };
  }

  /**
   * Clean cache line(s) - writeback dirty data, keep valid.
   */
  private *handleClean(
    id: string,
    req: CleanRequest,
  ): MotionGenerator<Payload<ResponsePacket>> {
    const safeAddr = req.addr !== undefined ? req.addr & 0xff : undefined;
    yield* this.animateRequestStart(safeAddr, "CLEANING...");

    let resultText = "";

    if (req.global || req.addr === undefined) {
      // Clean all cache lines
      for (let s = 0; s < this.numSets; s++) {
        for (let w = 0; w < this.numWays; w++) {
          yield* this.writeBackLine(this.cacheData[s][w], s);
          yield* this.animateLineUpdate(s, w, this.cacheData[s][w]); // Update dirty bit visual
        }
      }
      resultText = "ALL CLEANED";
    } else {
      // Clean specific address
      const { tag, setIndex } = this.parseAddress(req.addr);
      const wayIdx = this.findLine(setIndex, tag);

      if (wayIdx >= 0) {
        yield* this.animateHit(setIndex, wayIdx);
        yield* this.writeBackLine(this.cacheData[setIndex][wayIdx], setIndex);
        yield* this.animateLineUpdate(
          setIndex,
          wayIdx,
          this.cacheData[setIndex][wayIdx],
        );
        resultText = `CLEAN ${formatAddr(req.addr)}`;
      } else {
        yield* this.animateMiss();
        resultText = `CLEAN MISS`;
      }
    }

    yield* this.animateRequestEnd(resultText);

    const response: CleanResponse = {
      type: "clean",
      success: true,
    };

    return {
      id: id,
      display: req.global ? "CLEAN ALL" : `CLEAN ${formatAddr(req.addr!)}`,
      content: response,
    };
  }

  /**
   * Flush cache line(s) - writeback dirty data and invalidate.
   */
  private *handleFlush(
    id: string,
    req: FlushRequest,
  ): MotionGenerator<Payload<ResponsePacket>> {
    const safeAddr = req.addr !== undefined ? req.addr & 0xff : undefined;
    yield* this.animateRequestStart(safeAddr, "FLUSHING...");

    let resultText = "";

    if (req.global || req.addr === undefined) {
      // Flush all cache lines
      for (let s = 0; s < this.numSets; s++) {
        for (let w = 0; w < this.numWays; w++) {
          yield* this.writeBackLine(this.cacheData[s][w], s);
          this.cacheData[s][w].valid = false;
          this.cacheData[s][w].dirty = false;
          yield* this.animateLineUpdate(s, w, this.cacheData[s][w]);
        }
      }
      resultText = "ALL FLUSHED";
    } else {
      // Flush specific address
      const { tag, setIndex } = this.parseAddress(req.addr);
      const wayIdx = this.findLine(setIndex, tag);

      if (wayIdx >= 0) {
        yield* this.animateHit(setIndex, wayIdx);
        yield* this.writeBackLine(this.cacheData[setIndex][wayIdx], setIndex);
        this.cacheData[setIndex][wayIdx].valid = false;
        this.cacheData[setIndex][wayIdx].dirty = false;
        yield* this.animateLineUpdate(
          setIndex,
          wayIdx,
          this.cacheData[setIndex][wayIdx],
        );
        resultText = `FLUSH ${formatAddr(req.addr)}`;
      } else {
        yield* this.animateMiss();
        resultText = `FLUSH MISS`;
      }
    }

    yield* this.animateRequestEnd(resultText);

    const response: FlushResponse = {
      type: "flush",
      success: true,
    };

    return {
      id: id,
      display: req.global ? "FLUSH ALL" : `FLUSH ${formatAddr(req.addr!)}`,
      content: response,
    };
  }

  /**
   * Zero cache line - allocate and zero without fetch.
   */
  private *handleZero(
    id: string,
    req: ZeroRequest,
  ): MotionGenerator<Payload<ResponsePacket>> {
    const { addr } = req;
    const safeAddr = addr & 0xff;
    const { tag, setIndex } = this.parseAddress(safeAddr);

    yield* this.animateRequestStart(safeAddr, "ZEROING...");

    let wayIdx = this.findLine(setIndex, tag);
    let line: CacheLine;

    if (wayIdx >= 0) {
      yield* this.animateHit(setIndex, wayIdx);
      // Line exists, zero it
      line = this.cacheData[setIndex][wayIdx];
    } else {
      yield* this.animateMiss();
      // Allocate new line
      const set = this.cacheData[setIndex];
      const victimIdx = this.replacementPolicy(set);
      line = set[victimIdx];
      wayIdx = victimIdx;

      // Write back old data if dirty
      yield* this.writeBackLine(line, setIndex);

      line.tag = tag;
      line.valid = true;
    }

    // Zero the line data and mark as dirty
    line.data = BigInt(0);
    line.dirty = true;
    this.updateReplaceState(line);

    // Update visual
    yield* this.animateLineUpdate(setIndex, wayIdx, line);

    yield* this.animateRequestEnd(`ZERO ${formatAddr(safeAddr)}`);

    const response: ZeroResponse = {
      type: "zero",
      addr: safeAddr,
      success: true,
    };

    return {
      id: id,
      display: `ZERO ${formatAddr(safeAddr)}`,
      content: response,
    };
  }

  /**
   * Prefetch cache line - fetch into cache without returning data.
   */
  private *handlePrefetch(
    id: string,
    req: PrefetchRequest,
  ): MotionGenerator<Payload<ResponsePacket>> {
    const { addr } = req;
    const safeAddr = addr & 0xff;
    const { tag, setIndex } = this.parseAddress(safeAddr);

    yield* this.animateRequestStart(safeAddr, "PREFETCHING...");

    const wayIdx = this.findLine(setIndex, tag);
    let resultText = "";

    if (wayIdx >= 0) {
      // Line already in cache, just update replacement state
      yield* this.animateHit(setIndex, wayIdx);
      resultText = "PREFETCH HIT";
      const line = this.cacheData[setIndex][wayIdx];
      this.updateReplaceState(line);
      yield* this.animateLineUpdate(setIndex, wayIdx, line); // Update replacement state visual
    } else {
      // Line not in cache, fetch it
      yield* this.animateMiss();
      yield* this.fetchLine(setIndex, tag); // fetchLine handles visual update
      resultText = `PREFETCH ${formatAddr(safeAddr)}`;
    }

    yield* this.animateRequestEnd(resultText);

    const response: PrefetchResponse = {
      type: "prefetch",
      addr: safeAddr,
      success: true,
    };

    return {
      id: id,
      display: `PREFETCH ${formatAddr(safeAddr)}`,
      content: response,
    };
  }

  /**
   * Initiates a read/write request through the cache.
   */
  public *sendRequest(
    addr: number,
    data: bigint | number | null = null,
    size: number = 0,
  ): MotionGenerator<Payload<ResponsePacket>> {
    const safeAddr = addr & 0xff;
    const { tag, setIndex, offset } = this.parseAddress(safeAddr);
    const byteCount = getSizeInBytes(size);
    const sizeSuffix = getSizeSuffix(size);
    const addrHex = formatAddr(safeAddr);

    let displayStr = "";
    if (data !== null) {
      const safeData = maskToSize(toBigInt(data), size);
      const dataHex = formatMultiByteValue(safeData, size);
      displayStr = `WR${sizeSuffix} ${addrHex} ${dataHex}`;
    } else {
      displayStr = `RD${sizeSuffix} ${addrHex}`;
    }

    yield* this.animateRequestStart(safeAddr, "ACCESS...");

    let wayIdx = this.findLine(setIndex, tag);
    let line: CacheLine;

    if (wayIdx >= 0) {
      yield* this.animateHit(setIndex, wayIdx);
      line = this.cacheData[setIndex][wayIdx];
      this.updateReplaceState(line);
    } else {
      yield* this.animateMiss();
      // fetchLine handles visual update for the new line
      line = yield* this.fetchLine(setIndex, tag);
      // Re-find index since it might have changed or been allocated
      wayIdx = this.findLine(setIndex, tag);
    }

    let responseContent: ResponsePacket;
    let responseDisplay = "";
    let endLabel = "";

    if (data !== null) {
      const safeData = maskToSize(toBigInt(data), size);
      this.writeBytesToLine(line, offset, safeData, byteCount);
      line.dirty = true;

      // Update visual after write
      yield* this.animateLineUpdate(setIndex, wayIdx, line);

      const writeResponse: WriteResponse = {
        type: "write",
        addr: safeAddr,
        size: size,
        value: safeData,
      };
      responseContent = writeResponse;
      responseDisplay = `WR${sizeSuffix} OK`;
      endLabel = "WROTE";
    } else {
      const value = this.readBytesFromLine(line, offset, byteCount);

      // Update visual for read (LRU update)
      yield* this.animateLineUpdate(setIndex, wayIdx, line);

      const readResponse: ReadResponse = {
        type: "read",
        addr: safeAddr,
        size: size,
        value: value,
      };
      responseContent = readResponse;
      const valHex = formatMultiByteValue(value, size);
      responseDisplay = `RD${sizeSuffix}=${valHex}`;
      endLabel = `GOT: ${valHex}`;
    }

    yield* this.animateRequestEnd(endLabel);

    return {
      id: "",
      display: responseDisplay,
      content: responseContent,
    };
  }

  /**
   * Returns a handler for the cache to act as a bus slave.
   */
  public getHandler(): BusSlaveHandler<RequestPacket, ResponsePacket> {
    return (payload: Payload<RequestPacket>) =>
      this.processTransaction(payload);
  }

  /**
   * Process incoming transaction from upstream.
   */
  private *processTransaction(
    payload: Payload<RequestPacket>,
  ): MotionGenerator<Payload<ResponsePacket>> {
    const content = payload.content;

    // Handle cache management operations
    if (isInvalRequest(content)) {
      return yield* this.handleInvalidate(payload.id, content);
    }

    if (isCleanRequest(content)) {
      return yield* this.handleClean(payload.id, content);
    }

    if (isFlushRequest(content)) {
      return yield* this.handleFlush(payload.id, content);
    }

    if (isZeroRequest(content)) {
      return yield* this.handleZero(payload.id, content);
    }

    // Handle line operations
    if (isLineReadRequest(content)) {
      return yield* this.handleLineRead(payload.id, content);
    }

    if (isLineWriteRequest(content)) {
      return yield* this.handleLineWrite(payload.id, content);
    }

    if (isPrefetchRequest(content)) {
      return yield* this.handlePrefetch(payload.id, content);
    }

    // Handle regular read/write operations
    const { addr, size } = content;
    const safeAddr = addr & 0xff;
    const byteCount = getSizeInBytes(size ?? 0);
    const { tag, setIndex, offset } = this.parseAddress(safeAddr);
    const sizeSuffix = getSizeSuffix(size ?? 0);

    yield* this.animateRequestStart(safeAddr, "ACCESS...");

    let wayIdx = this.findLine(setIndex, tag);
    let line: CacheLine;

    if (wayIdx >= 0) {
      yield* this.animateHit(setIndex, wayIdx);
      line = this.cacheData[setIndex][wayIdx];
      this.updateReplaceState(line);
    } else {
      yield* this.animateMiss();
      line = yield* this.fetchLine(setIndex, tag);
      wayIdx = this.findLine(setIndex, tag);
    }

    let responseContent: ResponsePacket;
    let responseDisplay = "";
    let endLabel = "";

    if (isWriteRequest(content)) {
      const value = content.value;
      this.writeBytesToLine(line, offset, value, byteCount);
      line.dirty = true;

      yield* this.animateLineUpdate(setIndex, wayIdx, line);

      const writeResponse: WriteResponse = {
        type: "write",
        addr: safeAddr,
        size: size ?? 0,
        value: value,
      };
      responseContent = writeResponse;
      responseDisplay = `WR${sizeSuffix} OK`;
      endLabel = "WROTE";
    } else {
      const value = this.readBytesFromLine(line, offset, byteCount);

      yield* this.animateLineUpdate(setIndex, wayIdx, line);

      const readResponse: ReadResponse = {
        type: "read",
        addr: safeAddr,
        size: size ?? 0,
        value: value,
      };
      responseContent = readResponse;
      const valHex = formatMultiByteValue(value, size ?? 0);
      responseDisplay = `RD${sizeSuffix}=${valHex}`;
      endLabel = `GOT: ${valHex}`;
    }

    yield* this.animateRequestEnd(endLabel);

    return {
      id: payload.id,
      display: responseDisplay,
      content: responseContent,
    };
  }

  /**
   * Handle read cacheline
   */
  private *handleLineRead(
    id: string,
    req: LineReadRequest,
  ): MotionGenerator<Payload<ResponsePacket>> {
    const { addr, lineSize } = req;
    const safeAddr = addr & 0xff;
    const { tag, setIndex } = this.parseAddress(safeAddr);

    yield* this.animateRequestStart(safeAddr, "LINE ACCESS...");

    const wayIdx = this.findLine(setIndex, tag);
    let line: CacheLine;

    if (wayIdx >= 0) {
      yield* this.animateHit(setIndex, wayIdx);
      line = this.cacheData[setIndex][wayIdx];
      this.updateReplaceState(line);
      yield* this.animateLineUpdate(setIndex, wayIdx, line);
    } else {
      yield* this.animateMiss();
      line = yield* this.fetchLine(setIndex, tag);
      // fetchLine handles visual update
    }

    const lineData = line.data;
    const dataHex = formatMultiByteValue(lineData, Math.log2(lineSize));

    yield* this.animateRequestEnd(`LINE=${dataHex}`);

    const response: LineReadResponse = {
      type: "line_read",
      addr: safeAddr,
      lineSize: lineSize,
      data: lineData,
    };

    return {
      id: id,
      display: `LINE RD ${formatAddr(safeAddr)} = ${dataHex}`,
      content: response,
    };
  }

  /**
   * Handle write cache line
   */
  private *handleLineWrite(
    id: string,
    req: LineWriteRequest,
  ): MotionGenerator<Payload<ResponsePacket>> {
    const { addr, lineSize, data, writeMask } = req;
    const safeAddr = addr & 0xff;
    const { tag, setIndex } = this.parseAddress(safeAddr);

    yield* this.animateRequestStart(safeAddr, "LINE WRITE...");

    let wayIdx = this.findLine(setIndex, tag);
    let line: CacheLine;

    if (wayIdx >= 0) {
      yield* this.animateHit(setIndex, wayIdx);
      line = this.cacheData[setIndex][wayIdx];
      this.updateReplaceState(line);
    } else {
      yield* this.animateMiss();
      line = yield* this.fetchLine(setIndex, tag);
      wayIdx = this.findLine(setIndex, tag);
    }

    line.data = applyWriteMask(line.data, data, writeMask, lineSize);
    line.dirty = true;

    yield* this.animateLineUpdate(setIndex, wayIdx, line);

    const dataHex = formatMultiByteValue(line.data, Math.log2(lineSize));
    yield* this.animateRequestEnd(`LINE=${dataHex}`);

    const response: LineWriteResponse = {
      type: "line_write",
      addr: safeAddr,
      success: true,
    };

    return {
      id: id,
      display: `LINE WR ${formatAddr(safeAddr)} M=${formatWriteMask(writeMask, lineSize)}`,
      content: response,
    };
  }
}
