import { Reference } from "@motion-canvas/core";
import { DataBus } from "../DataBus";
import { BusSlaveHandler, Payload } from "../../schemes/DataBusScheme";
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
} from "../../schemes/PacketScheme";
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
} from "../../utils/PacketUtils";
import { MotionGenerator } from "../../schemes/UtilScheme";
import { CacheLogic } from "./CacheLogic";
import { CacheAnimator } from "./CacheAnimator";
import { CacheLine } from "../../schemes/Cache";

/**
 * Handles cache request routing, protocol parsing, and response building.
 * Coordinates between CacheLogic and CacheAnimator.
 */
export class CacheRequestHandler {
  constructor(
    private readonly logic: CacheLogic,
    private readonly getAnimator: () => CacheAnimator,
    private readonly bus: Reference<DataBus>,
  ) {}

  /**
   * Returns a handler function for bus slave registration.
   */
  public getHandler(): BusSlaveHandler<RequestPacket, ResponsePacket> {
    return (payload: Payload<RequestPacket>) =>
      this.processTransaction(payload);
  }

  /**
   * Main entry point for processing incoming transactions.
   */
  public *processTransaction(
    payload: Payload<RequestPacket>,
  ): MotionGenerator<Payload<ResponsePacket>> {
    const content = payload.content;

    // Route to appropriate handler based on request type
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

    if (isPrefetchRequest(content)) {
      return yield* this.handlePrefetch(payload.id, content);
    }

    if (isLineReadRequest(content)) {
      return yield* this.handleLineRead(payload.id, content);
    }

    if (isLineWriteRequest(content)) {
      return yield* this.handleLineWrite(payload.id, content);
    }

    // Handle regular read/write operations
    return yield* this.handleReadWrite(payload as Payload<ReadRequest | WriteRequest>);
  }

  /**
   * Public API for initiating a read/write request.
   */
  public *sendRequest(
    addr: number,
    data: bigint | number | null = null,
    size: number = 0,
  ): MotionGenerator<Payload<ResponsePacket>> {
    const safeAddr = addr & 0xff;
    const { tag, setIndex, offset } = this.logic.parseAddress(safeAddr);
    const byteCount = getSizeInBytes(size);
    const sizeSuffix = getSizeSuffix(size);
    const addrHex = formatAddr(safeAddr);
    const animator = this.getAnimator();

    let displayStr = "";
    if (data !== null) {
      const safeData = maskToSize(toBigInt(data), size);
      const dataHex = formatMultiByteValue(safeData, size);
      displayStr = `WR${sizeSuffix} ${addrHex} ${dataHex}`;
    } else {
      displayStr = `RD${sizeSuffix} ${addrHex}`;
    }

    yield* animator.animateRequestStart(safeAddr, "ACCESS...", setIndex);

    const lookupResult = this.logic.lookup(setIndex, tag);
    yield* animator.animateCheckHit(setIndex, tag);

    let line: CacheLine;
    let wayIdx: number;

    if (lookupResult.hit) {
      yield* animator.animateHit();
      line = lookupResult.line!;
      wayIdx = lookupResult.wayIndex;
      this.logic.updateReplaceState(line);
    } else {
      yield* animator.animateMiss();
      const fetchResult = yield* this.fetchLine(setIndex, tag);
      line = fetchResult.line;
      wayIdx = fetchResult.wayIndex;
    }

    let responseContent: ResponsePacket;
    let responseDisplay = "";
    let endLabel = "";

    if (data !== null) {
      const safeData = maskToSize(toBigInt(data), size);
      this.logic.writeBytesToLine(line, offset, safeData, byteCount);
      line.dirty = true;

      yield* animator.animateLineUpdate(setIndex, wayIdx, line);

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
      const value = this.logic.readBytesFromLine(line, offset, byteCount);

      yield* animator.animateLineUpdate(setIndex, wayIdx, line);

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

    yield* animator.animateRequestEnd(endLabel);

    return {
      id: "",
      display: responseDisplay,
      content: responseContent,
    };
  }

  // ==========================================================================
  // Private Handlers
  // ==========================================================================

  /**
   * Fetch a cache line from the next level.
   */
  private *fetchLine(
    setIndex: number,
    tag: number,
  ): MotionGenerator<{ line: CacheLine; wayIndex: number }> {
    const animator = this.getAnimator();
    const allocation = this.logic.allocate(setIndex, tag);

    // Writeback if needed
    if (allocation.needsWriteback) {
      yield* this.writeBackLine(allocation.victim, setIndex);
    }

    const baseAddr = this.logic.getLineBaseAddress(tag, setIndex);
    yield* animator.animateFetchStart(baseAddr, setIndex);

    // Perform bus transaction
    const readReq: ReadRequest = {
      type: "read",
      addr: baseAddr,
      size: this.logic.getOffsetBits(),
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

    // Install the line
    const line = this.logic.installLine(
      setIndex,
      allocation.victimIndex,
      tag,
      lineData,
    );

    yield* animator.animateLineUpdate(setIndex, allocation.victimIndex, line);

    return { line, wayIndex: allocation.victimIndex };
  }

  /**
   * Write back a dirty cache line.
   */
  private *writeBackLine(
    line: CacheLine,
    setIndex: number,
  ): MotionGenerator<void> {
    if (!line.valid || !line.dirty) return;

    const animator = this.getAnimator();
    const baseAddr = this.logic.getLineBaseAddress(line.tag, setIndex);

    yield* animator.animateWriteBackStart(baseAddr, setIndex);

    const writeReq: WriteRequest = {
      type: "write",
      addr: baseAddr,
      size: this.logic.getOffsetBits(),
      value: line.data,
    };
    const payload: Payload<RequestPacket> = {
      id: "",
      display: `WB ${formatAddr(baseAddr)}`,
      content: writeReq,
    };
    yield* this.bus().performTransaction(payload);

    this.logic.markClean(line);
  }

  /**
   * Handle invalidate request.
   */
  private *handleInvalidate(
    id: string,
    req: InvalidateRequest,
  ): MotionGenerator<Payload<ResponsePacket>> {
    const animator = this.getAnimator();
    const safeAddr = req.addr !== undefined ? req.addr & 0xff : undefined;
    yield* animator.animateRequestStart(safeAddr, "INVALIDATING...");

    let resultText = "";

    if (req.global || req.addr === undefined) {
      const updated = this.logic.invalidateAll();
      for (const { setIndex, wayIndex } of updated) {
        yield* animator.animateLineUpdate(
          setIndex,
          wayIndex,
          this.logic.getLine(setIndex, wayIndex),
        );
      }
      resultText = "ALL INVALIDATED";
    } else {
      const { tag, setIndex } = this.logic.parseAddress(req.addr);
      const lookupResult = this.logic.lookup(setIndex, tag);

      yield* animator.animateCheckHit(setIndex, tag);

      if (lookupResult.hit) {
        yield* animator.animateHit();
        this.logic.invalidateLine(lookupResult.line!);
        yield* animator.animateLineUpdate(
          setIndex,
          lookupResult.wayIndex,
          lookupResult.line!,
        );
        resultText = `INVAL ${formatAddr(req.addr)}`;
      } else {
        yield* animator.animateMiss();
        resultText = `INVAL MISS`;
      }
    }

    yield* animator.animateRequestEnd(resultText);

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
   * Handle clean request.
   */
  private *handleClean(
    id: string,
    req: CleanRequest,
  ): MotionGenerator<Payload<ResponsePacket>> {
    const animator = this.getAnimator();
    const safeAddr = req.addr !== undefined ? req.addr & 0xff : undefined;
    yield* animator.animateRequestStart(safeAddr, "CLEANING...");

    let resultText = "";

    if (req.global || req.addr === undefined) {
      const dirtyLines = this.logic.getDirtyLines();
      for (const { setIndex, wayIndex, line } of dirtyLines) {
        yield* this.writeBackLine(line, setIndex);
        yield* animator.animateLineUpdate(setIndex, wayIndex, line);
      }
      resultText = "ALL CLEANED";
    } else {
      const { tag, setIndex } = this.logic.parseAddress(req.addr);
      const lookupResult = this.logic.lookup(setIndex, tag);

      yield* animator.animateCheckHit(setIndex, tag);

      if (lookupResult.hit) {
        yield* animator.animateHit();
        yield* this.writeBackLine(lookupResult.line!, setIndex);
        yield* animator.animateLineUpdate(
          setIndex,
          lookupResult.wayIndex,
          lookupResult.line!,
        );
        resultText = `CLEAN ${formatAddr(req.addr)}`;
      } else {
        yield* animator.animateMiss();
        resultText = `CLEAN MISS`;
      }
    }

    yield* animator.animateRequestEnd(resultText);

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
   * Handle flush request.
   */
  private *handleFlush(
    id: string,
    req: FlushRequest,
  ): MotionGenerator<Payload<ResponsePacket>> {
    const animator = this.getAnimator();
    const safeAddr = req.addr !== undefined ? req.addr & 0xff : undefined;
    yield* animator.animateRequestStart(safeAddr, "FLUSHING...");

    let resultText = "";

    if (req.global || req.addr === undefined) {
      for (let s = 0; s < this.logic.getNumSets(); s++) {
        for (let w = 0; w < this.logic.getNumWays(); w++) {
          const line = this.logic.getLine(s, w);
          yield* this.writeBackLine(line, s);
          this.logic.invalidateLine(line);
          yield* animator.animateLineUpdate(s, w, line);
        }
      }
      resultText = "ALL FLUSHED";
    } else {
      const { tag, setIndex } = this.logic.parseAddress(req.addr);
      const lookupResult = this.logic.lookup(setIndex, tag);

      yield* animator.animateCheckHit(setIndex, tag);

      if (lookupResult.hit) {
        yield* animator.animateHit();
        yield* this.writeBackLine(lookupResult.line!, setIndex);
        this.logic.invalidateLine(lookupResult.line!);
        yield* animator.animateLineUpdate(
          setIndex,
          lookupResult.wayIndex,
          lookupResult.line!,
        );
        resultText = `FLUSH ${formatAddr(req.addr)}`;
      } else {
        yield* animator.animateMiss();
        resultText = `FLUSH MISS`;
      }
    }

    yield* animator.animateRequestEnd(resultText);

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
   * Handle zero request.
   */
  private *handleZero(
    id: string,
    req: ZeroRequest,
  ): MotionGenerator<Payload<ResponsePacket>> {
    const animator = this.getAnimator();
    const { addr } = req;
    const safeAddr = addr & 0xff;
    const { tag, setIndex } = this.logic.parseAddress(safeAddr);

    yield* animator.animateRequestStart(safeAddr, "ZEROING...", setIndex);

    const lookupResult = this.logic.lookup(setIndex, tag);
    yield* animator.animateCheckHit(setIndex, tag);

    let line: CacheLine;
    let wayIdx: number;

    if (lookupResult.hit) {
      yield* animator.animateHit();
      line = lookupResult.line!;
      wayIdx = lookupResult.wayIndex;
    } else {
      yield* animator.animateMiss();
      const allocation = this.logic.allocate(setIndex, tag);
      yield* this.writeBackLine(allocation.victim, setIndex);
      line = allocation.victim;
      wayIdx = allocation.victimIndex;
    }

    this.logic.zeroLine(line, tag);
    yield* animator.animateLineUpdate(setIndex, wayIdx, line);

    yield* animator.animateRequestEnd(`ZERO ${formatAddr(safeAddr)}`);

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
   * Handle prefetch request.
   */
  private *handlePrefetch(
    id: string,
    req: PrefetchRequest,
  ): MotionGenerator<Payload<ResponsePacket>> {
    const animator = this.getAnimator();
    const { addr } = req;
    const safeAddr = addr & 0xff;
    const { tag, setIndex } = this.logic.parseAddress(safeAddr);

    yield* animator.animateRequestStart(safeAddr, "PREFETCHING...", setIndex);

    const lookupResult = this.logic.lookup(setIndex, tag);
    yield* animator.animateCheckHit(setIndex, tag);

    let resultText = "";

    if (lookupResult.hit) {
      yield* animator.animateHit();
      resultText = "PREFETCH HIT";
      this.logic.updateReplaceState(lookupResult.line!);
      yield* animator.animateLineUpdate(
        setIndex,
        lookupResult.wayIndex,
        lookupResult.line!,
      );
    } else {
      yield* animator.animateMiss();
      yield* this.fetchLine(setIndex, tag);
      resultText = `PREFETCH ${formatAddr(safeAddr)}`;
    }

    yield* animator.animateRequestEnd(resultText);

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
   * Handle regular read/write transactions.
   */
  private *handleReadWrite(
    payload: Payload<ReadRequest | WriteRequest>,
  ): MotionGenerator<Payload<ResponsePacket>> {
    const content = payload.content;
    const animator = this.getAnimator();
    const { addr, size } = content;
    const safeAddr = addr & 0xff;
    const byteCount = getSizeInBytes(size ?? 0);
    const { tag, setIndex, offset } = this.logic.parseAddress(safeAddr);
    const sizeSuffix = getSizeSuffix(size ?? 0);

    yield* animator.animateRequestStart(safeAddr, "ACCESS...", setIndex);

    const lookupResult = this.logic.lookup(setIndex, tag);
    yield* animator.animateCheckHit(setIndex, tag);

    let line: CacheLine;
    let wayIdx: number;

    if (lookupResult.hit) {
      yield* animator.animateHit();
      line = lookupResult.line!;
      wayIdx = lookupResult.wayIndex;
      this.logic.updateReplaceState(line);
    } else {
      yield* animator.animateMiss();
      const fetchResult = yield* this.fetchLine(setIndex, tag);
      line = fetchResult.line;
      wayIdx = fetchResult.wayIndex;
    }

    let responseContent: ResponsePacket;
    let responseDisplay = "";
    let endLabel = "";

    if (isWriteRequest(content)) {
      const value = content.value;
      this.logic.writeBytesToLine(line, offset, value, byteCount);
      line.dirty = true;

      yield* animator.animateLineUpdate(setIndex, wayIdx, line);

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
      const value = this.logic.readBytesFromLine(line, offset, byteCount);

      yield* animator.animateLineUpdate(setIndex, wayIdx, line);

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

    yield* animator.animateRequestEnd(endLabel);

    return {
      id: payload.id,
      display: responseDisplay,
      content: responseContent,
    };
  }

  /**
   * Handle line read request.
   */
  private *handleLineRead(
    id: string,
    req: LineReadRequest,
  ): MotionGenerator<Payload<ResponsePacket>> {
    const animator = this.getAnimator();
    const { addr, lineSize } = req;
    const safeAddr = addr & 0xff;
    const { tag, setIndex } = this.logic.parseAddress(safeAddr);

    yield* animator.animateRequestStart(safeAddr, "LINE ACCESS...", setIndex);

    const lookupResult = this.logic.lookup(setIndex, tag);
    yield* animator.animateCheckHit(setIndex, tag);

    let line: CacheLine;
    let wayIdx: number;

    if (lookupResult.hit) {
      yield* animator.animateHit();
      line = lookupResult.line!;
      wayIdx = lookupResult.wayIndex;
      this.logic.updateReplaceState(line);
      yield* animator.animateLineUpdate(setIndex, wayIdx, line);
    } else {
      yield* animator.animateMiss();
      const fetchResult = yield* this.fetchLine(setIndex, tag);
      line = fetchResult.line;
    }

    const lineData = line.data;
    const dataHex = formatMultiByteValue(lineData, Math.log2(lineSize));

    yield* animator.animateRequestEnd(`LINE=${dataHex}`);

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
   * Handle line write request.
   */
  private *handleLineWrite(
    id: string,
    req: LineWriteRequest,
  ): MotionGenerator<Payload<ResponsePacket>> {
    const animator = this.getAnimator();
    const { addr, lineSize, data, writeMask } = req;
    const safeAddr = addr & 0xff;
    const { tag, setIndex } = this.logic.parseAddress(safeAddr);

    yield* animator.animateRequestStart(safeAddr, "LINE WRITE...", setIndex);

    const lookupResult = this.logic.lookup(setIndex, tag);
    yield* animator.animateCheckHit(setIndex, tag);

    let line: CacheLine;
    let wayIdx: number;

    if (lookupResult.hit) {
      yield* animator.animateHit();
      line = lookupResult.line!;
      wayIdx = lookupResult.wayIndex;
      this.logic.updateReplaceState(line);
    } else {
      yield* animator.animateMiss();
      const fetchResult = yield* this.fetchLine(setIndex, tag);
      line = fetchResult.line;
      wayIdx = fetchResult.wayIndex;
    }

    line.data = applyWriteMask(line.data, data, writeMask, lineSize);
    line.dirty = true;

    yield* animator.animateLineUpdate(setIndex, wayIdx, line);

    const dataHex = formatMultiByteValue(line.data, Math.log2(lineSize));
    yield* animator.animateRequestEnd(`LINE=${dataHex}`);

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
