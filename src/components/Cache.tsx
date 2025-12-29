import { RectProps, Rect, Txt, initial, signal } from "@motion-canvas/2d";

import {
  createRef,
  waitFor,
  Reference,
  ColorSignal,
  SignalValue,
  SimpleSignal,
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

/**
 * Cache line structure.
 */
export interface CacheLine {
  valid: boolean;
  dirty: boolean;
  tag: number;
  data: bigint;
  replaceState: any;
}

/**
 * Replacement policy function type.
 * Takes array of cache lines (ways) in a set, returns index to replace.
 */
export type ReplacementPolicy = (ways: CacheLine[]) => number;

/**
 * Default LRU replacement policy.
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

  private readonly offsetBits: number;
  private readonly setBits: number;
  private readonly numWays: number;
  private readonly numSets: number;
  private readonly lineSize: number;
  private readonly tagBits: number;
  private readonly replacementPolicy: ReplacementPolicy;

  private readonly cacheData: CacheLine[][];
  private lruCounter: number = 0;

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
      clip: true,
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
    this.tagBits = 8 - offsetBits - setBits;
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
      </>,
    );
  }

  public getLineSize(): number {
    return this.lineSize;
  }

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

    return victim;
  }

  private *writeBackLine(
    line: CacheLine,
    setIndex: number,
  ): MotionGenerator<void> {
    if (!line.valid || !line.dirty) return;

    const baseAddr = this.getLineBaseAddress(line.tag, setIndex);

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
    this.labelRef().text("INVALIDATING...");
    yield* this.containerRef().scale(1.03, 0.2);

    if (req.global || req.addr === undefined) {
      // Invalidate all cache lines
      for (let s = 0; s < this.numSets; s++) {
        for (let w = 0; w < this.numWays; w++) {
          this.cacheData[s][w].valid = false;
          this.cacheData[s][w].dirty = false;
        }
      }
      this.labelRef().text("ALL INVALIDATED");
    } else {
      // Invalidate specific address
      const { tag, setIndex } = this.parseAddress(req.addr);
      const wayIdx = this.findLine(setIndex, tag);
      
      if (wayIdx >= 0) {
        this.cacheData[setIndex][wayIdx].valid = false;
        this.cacheData[setIndex][wayIdx].dirty = false;
        this.labelRef().text(`INVAL ${formatAddr(req.addr)}`);
      } else {
        this.labelRef().text(`INVAL MISS`);
      }
    }

    yield* this.containerRef().scale(1.0, 0.2);
    yield* waitFor(0.3);
    this.labelRef().text("IDLE");

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
    this.labelRef().text("CLEANING...");
    yield* this.containerRef().scale(1.03, 0.2);

    if (req.global || req.addr === undefined) {
      // Clean all cache lines
      for (let s = 0; s < this.numSets; s++) {
        for (let w = 0; w < this.numWays; w++) {
          yield* this.writeBackLine(this.cacheData[s][w], s);
        }
      }
      this.labelRef().text("ALL CLEANED");
    } else {
      // Clean specific address
      const { tag, setIndex } = this.parseAddress(req.addr);
      const wayIdx = this.findLine(setIndex, tag);
      
      if (wayIdx >= 0) {
        yield* this.writeBackLine(this.cacheData[setIndex][wayIdx], setIndex);
        this.labelRef().text(`CLEAN ${formatAddr(req.addr)}`);
      } else {
        this.labelRef().text(`CLEAN MISS`);
      }
    }

    yield* this.containerRef().scale(1.0, 0.2);
    yield* waitFor(0.3);
    this.labelRef().text("IDLE");

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
    this.labelRef().text("FLUSHING...");
    yield* this.containerRef().scale(1.03, 0.2);

    if (req.global || req.addr === undefined) {
      // Flush all cache lines
      for (let s = 0; s < this.numSets; s++) {
        for (let w = 0; w < this.numWays; w++) {
          yield* this.writeBackLine(this.cacheData[s][w], s);
          this.cacheData[s][w].valid = false;
          this.cacheData[s][w].dirty = false;
        }
      }
      this.labelRef().text("ALL FLUSHED");
    } else {
      // Flush specific address
      const { tag, setIndex } = this.parseAddress(req.addr);
      const wayIdx = this.findLine(setIndex, tag);
      
      if (wayIdx >= 0) {
        yield* this.writeBackLine(this.cacheData[setIndex][wayIdx], setIndex);
        this.cacheData[setIndex][wayIdx].valid = false;
        this.cacheData[setIndex][wayIdx].dirty = false;
        this.labelRef().text(`FLUSH ${formatAddr(req.addr)}`);
      } else {
        this.labelRef().text(`FLUSH MISS`);
      }
    }

    yield* this.containerRef().scale(1.0, 0.2);
    yield* waitFor(0.3);
    this.labelRef().text("IDLE");

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

    this.labelRef().text("ZEROING...");
    yield* this.containerRef().scale(1.03, 0.2);

    const wayIdx = this.findLine(setIndex, tag);
    let line: CacheLine;

    if (wayIdx >= 0) {
      // Line exists, zero it
      line = this.cacheData[setIndex][wayIdx];
    } else {
      // Allocate new line
      const set = this.cacheData[setIndex];
      const victimIdx = this.replacementPolicy(set);
      line = set[victimIdx];
      
      // Write back old data if dirty
      yield* this.writeBackLine(line, setIndex);
      
      line.tag = tag;
      line.valid = true;
    }

    // Zero the line data and mark as dirty
    line.data = BigInt(0);
    line.dirty = true;
    this.updateReplaceState(line);

    this.labelRef().text(`ZERO ${formatAddr(safeAddr)}`);

    yield* this.containerRef().scale(1.0, 0.2);
    yield* waitFor(0.3);
    this.labelRef().text("IDLE");

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

    this.labelRef().text("PREFETCHING...");
    yield* this.containerRef().scale(1.03, 0.2);

    const wayIdx = this.findLine(setIndex, tag);

    if (wayIdx >= 0) {
      // Line already in cache, just update replacement state
      this.labelRef().text("PREFETCH HIT");
      const line = this.cacheData[setIndex][wayIdx];
      this.updateReplaceState(line);
    } else {
      // Line not in cache, fetch it
      this.labelRef().text("PREFETCH MISS");
      yield* waitFor(0.3);
      this.labelRef().text("FETCHING...");
      yield* this.fetchLine(setIndex, tag);
      this.labelRef().text(`PREFETCH ${formatAddr(safeAddr)}`);
    }

    yield* this.containerRef().scale(1.0, 0.2);
    yield* waitFor(0.3);
    this.labelRef().text("IDLE");

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

    this.labelRef().text("ACCESS...");
    yield* this.containerRef().scale(1.03, 0.2);

    const wayIdx = this.findLine(setIndex, tag);
    let line: CacheLine;

    if (wayIdx >= 0) {
      this.labelRef().text("HIT");
      line = this.cacheData[setIndex][wayIdx];
      this.updateReplaceState(line);
    } else {
      this.labelRef().text("MISS");
      yield* waitFor(0.3);
      this.labelRef().text("FETCH...");
      line = yield* this.fetchLine(setIndex, tag);
    }

    let responseContent: ResponsePacket;
    let responseDisplay = "";

    if (data !== null) {
      const safeData = maskToSize(toBigInt(data), size);
      this.writeBytesToLine(line, offset, safeData, byteCount);
      line.dirty = true;

      const writeResponse: WriteResponse = {
        type: "write",
        addr: safeAddr,
        size: size,
        value: safeData,
      };
      responseContent = writeResponse;
      responseDisplay = `WR${sizeSuffix} OK`;
      this.labelRef().text("WROTE");
    } else {
      const value = this.readBytesFromLine(line, offset, byteCount);

      const readResponse: ReadResponse = {
        type: "read",
        addr: safeAddr,
        size: size,
        value: value,
      };
      responseContent = readResponse;
      const valHex = formatMultiByteValue(value, size);
      responseDisplay = `RD${sizeSuffix}=${valHex}`;
      this.labelRef().text(`GOT: ${valHex}`);
    }

    yield* this.containerRef().scale(1.0, 0.2);
    yield* waitFor(0.5);
    this.labelRef().text("IDLE");

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

    this.labelRef().text("ACCESS...");
    yield* this.containerRef().scale(1.03, 0.2);

    const wayIdx = this.findLine(setIndex, tag);
    let line: CacheLine;

    if (wayIdx >= 0) {
      this.labelRef().text("HIT");
      line = this.cacheData[setIndex][wayIdx];
      this.updateReplaceState(line);
    } else {
      this.labelRef().text("MISS");
      yield* waitFor(0.3);
      this.labelRef().text("FETCH...");
      line = yield* this.fetchLine(setIndex, tag);
    }

    let responseContent: ResponsePacket;
    let responseDisplay = "";

    if (isWriteRequest(content)) {
      const value = content.value;
      this.writeBytesToLine(line, offset, value, byteCount);
      line.dirty = true;

      const writeResponse: WriteResponse = {
        type: "write",
        addr: safeAddr,
        size: size ?? 0,
        value: value,
      };
      responseContent = writeResponse;
      responseDisplay = `WR${sizeSuffix} OK`;
      this.labelRef().text("WROTE");
    } else {
      const value = this.readBytesFromLine(line, offset, byteCount);

      const readResponse: ReadResponse = {
        type: "read",
        addr: safeAddr,
        size: size ?? 0,
        value: value,
      };
      responseContent = readResponse;
      const valHex = formatMultiByteValue(value, size ?? 0);
      responseDisplay = `RD${sizeSuffix}=${valHex}`;
      this.labelRef().text(`GOT: ${valHex}`);
    }

    yield* this.containerRef().scale(1.0, 0.2);
    yield* waitFor(0.3);
    this.labelRef().text("IDLE");

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

    this.labelRef().text("LINE ACCESS...");
    yield* this.containerRef().scale(1.03, 0.2);

    const wayIdx = this.findLine(setIndex, tag);
    let line: CacheLine;

    if (wayIdx >= 0) {
      this.labelRef().text("LINE HIT");
      line = this.cacheData[setIndex][wayIdx];
      this.updateReplaceState(line);
    } else {
      this.labelRef().text("LINE MISS");
      yield* waitFor(0.3);
      this.labelRef().text("FETCH LINE...");
      line = yield* this.fetchLine(setIndex, tag);
    }

    const lineData = line.data;
    const dataHex = formatMultiByteValue(lineData, Math.log2(lineSize));
    this.labelRef().text(`LINE=${dataHex}`);

    yield* this.containerRef().scale(1.0, 0.2);
    yield* waitFor(0.3);
    this.labelRef().text("IDLE");

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

    this.labelRef().text("LINE WRITE...");
    yield* this.containerRef().scale(1.03, 0.2);

    const wayIdx = this.findLine(setIndex, tag);
    let line: CacheLine;

    if (wayIdx >= 0) {
      this.labelRef().text("LINE HIT");
      line = this.cacheData[setIndex][wayIdx];
      this.updateReplaceState(line);
    } else {
      this.labelRef().text("LINE MISS");
      yield* waitFor(0.3);
      this.labelRef().text("ALLOCATE LINE...");
      line = yield* this.fetchLine(setIndex, tag);
    }

    line.data = applyWriteMask(line.data, data, writeMask, lineSize);
    line.dirty = true;

    const dataHex = formatMultiByteValue(line.data, Math.log2(lineSize));
    this.labelRef().text(`LINE=${dataHex}`);

    yield* this.containerRef().scale(1.0, 0.2);
    yield* waitFor(0.3);
    this.labelRef().text("IDLE");

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
