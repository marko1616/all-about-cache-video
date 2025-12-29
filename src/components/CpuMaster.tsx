import {
  Img,
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
} from "@motion-canvas/core";

import { DataBus } from "./DataBus";
import { Payload } from "../schemes/DataBusScheme";
import {
  RequestPacket,
  ResponsePacket,
  ReadRequest,
  WriteRequest,
  InvalidateRequest,
  CleanRequest,
  FlushRequest,
  ZeroRequest,
  PrefetchRequest,
  LineReadRequest,
  LineWriteRequest,
} from "../schemes/PacketScheme";

import {
  isReadResponse,
  formatAddr,
  formatMultiByteValue,
  formatWriteMask,
  getSizeSuffix,
  getSizeInBytes,
  maskToSize,
  toBigInt,
  generateFullMask,
  isLineReadResponse,
} from "../utils/PacketUtils";

import { MotionGenerator } from "../schemes/UtilScheme";

import cpuSvg from "../../assets/images/cpu.svg";

/**
 * Props for the CpuMaster component.
 */
export interface CpuMasterProps extends RectProps {
  bus: Reference<DataBus>;
  backgroundFill?: SignalValue<string>;
  contentFill?: SignalValue<string>;
}

/**
 * Represents the Central Processing Unit (Master).
 * Supports two modes: direct mode and cache line mode.
 */
export class CpuMaster extends Rect {
  @initial(null)
  @signal()
  declare public readonly backgroundFill: ColorSignal<this>;

  @initial("#FFF")
  @signal()
  declare public readonly contentFill: ColorSignal<this>;

  private readonly bus: Reference<DataBus>;
  private readonly labelRef = createRef<Txt>();
  private readonly imgRef = createRef<Img>();

  private cacheLineMode: boolean = false;
  private cacheLineSize: number = 4;

  public constructor(props: CpuMasterProps) {
    const { bus, backgroundFill, contentFill, ...layoutProps } = props;

    super({
      ...layoutProps,
      layout: true,
      direction: "column",
      alignItems: "center",
      justifyContent: "center",
    });

    if (backgroundFill !== undefined) this.backgroundFill(backgroundFill);
    if (contentFill !== undefined) this.contentFill(contentFill);

    this.fill(this.backgroundFill);
    this.bus = bus;

    this.add(
      <>
        <Layout
          width={"100%"}
          height={"100%"}
          alignItems={"center"}
          justifyContent={"center"}
        >
          <Img ref={this.imgRef} src={cpuSvg} width={"100%"} height={"100%"} />
        </Layout>
        <Txt
          ref={this.labelRef}
          fill={this.contentFill}
          fontSize={48}
          fontWeight={700}
          marginTop={10}
          text={"IDLE"}
        />
      </>,
    );
  }

  /**
   * Enable cache line mode - CPU fetches full cache lines.
   */
  public enableCacheLineMode(lineSize: number): void {
    this.cacheLineMode = true;
    this.cacheLineSize = lineSize;
  }

  /**
   * Disable cache line mode - CPU uses direct byte access.
   */
  public disableCacheLineMode(): void {
    this.cacheLineMode = false;
  }

  public isCacheLineModeEnabled(): boolean {
    return this.cacheLineMode;
  }

  public getCacheLineSize(): number {
    return this.cacheLineSize;
  }

  private getLineBaseAddress(addr: number): number {
    return addr & ~(this.cacheLineSize - 1);
  }

  /**
   * Fetch a full cache line by issuing multiple byte reads.
   */
  private *fetchCacheLine(baseAddr: number): MotionGenerator<bigint> {
    let lineData = BigInt(0);

    for (let i = 0; i < this.cacheLineSize; i++) {
      const readReq: ReadRequest = {
        type: "read",
        addr: (baseAddr + i) & 0xff,
        size: 0,
      };
      const payload: Payload<RequestPacket> = {
        id: "",
        display: `FETCH ${formatAddr(baseAddr + i)}`,
        content: readReq,
      };

      this.labelRef().text(`FETCH ${formatAddr(baseAddr + i)}`);
      const response = yield* this.bus().performTransaction(payload);

      if (isReadResponse(response.content)) {
        lineData |= (response.content.value & BigInt(0xff)) << BigInt(i * 8);
      }
    }

    return lineData;
  }

  /**
   * Write back a full cache line by issuing multiple byte writes.
   */
  private *writeBackCacheLine(
    baseAddr: number,
    lineData: bigint,
  ): MotionGenerator<void> {
    for (let i = 0; i < this.cacheLineSize; i++) {
      const byteVal = (lineData >> BigInt(i * 8)) & BigInt(0xff);
      const writeReq: WriteRequest = {
        type: "write",
        addr: (baseAddr + i) & 0xff,
        size: 0,
        value: byteVal,
      };
      const payload: Payload<RequestPacket> = {
        id: "",
        display: `WB ${formatAddr(baseAddr + i)}`,
        content: writeReq,
      };

      this.labelRef().text(`WB ${formatAddr(baseAddr + i)}`);
      yield* this.bus().performTransaction(payload);
    }
  }

  /**
   * Send a memory request with automatic cross-line handling in cache line mode.
   */
  public *sendRequest(
    addr: number,
    data: bigint | number | null = null,
    size: number = 0,
  ): MotionGenerator<Payload<ResponsePacket>> {
    const safeAddr = addr & 0xff;
    const addrHex = formatAddr(safeAddr);
    const sizeSuffix = getSizeSuffix(size);
    const byteCount = getSizeInBytes(size);

    // Direct mode: single transaction
    if (!this.cacheLineMode) {
      let displayStr = "";
      let payloadContent: RequestPacket;

      if (data !== null) {
        const safeData = maskToSize(toBigInt(data), size);
        const dataHex = formatMultiByteValue(safeData, size);
        displayStr = `WR${sizeSuffix} ${addrHex} ${dataHex}`;

        const writeRequest: WriteRequest = {
          type: "write",
          addr: safeAddr,
          size: size,
          value: safeData,
        };
        payloadContent = writeRequest;
      } else {
        displayStr = `RD${sizeSuffix} ${addrHex}`;
        const readRequest: ReadRequest = {
          type: "read",
          addr: safeAddr,
          size: size,
        };
        payloadContent = readRequest;
      }

      this.labelRef().text(displayStr);
      yield* this.imgRef().scale(1.04, 0.2);

      const requestPayload: Payload<RequestPacket> = {
        id: "",
        display: displayStr,
        content: payloadContent,
      };

      const response = yield* this.bus().performTransaction(requestPayload);

      if (isReadResponse(response.content)) {
        const valHex = formatMultiByteValue(
          response.content.value,
          response.content.size,
        );
        this.labelRef().text(`GOT: ${valHex}`);
      } else {
        this.labelRef().text(`OK`);
      }

      yield* this.imgRef().scale(1.0, 0.2);
      yield* waitFor(0.5);
      this.labelRef().text("IDLE");

      return response;
    }

    // Cache line mode: may span multiple lines
    let displayStr = "";
    if (data !== null) {
      const dataHex = formatMultiByteValue(BigInt(data), size);
      displayStr = `WR${sizeSuffix} ${addrHex} ${dataHex}`;
    } else {
      displayStr = `RD${sizeSuffix} ${addrHex}`;
    }
    this.labelRef().text(displayStr);
    yield* this.imgRef().scale(1.04, 0.2);
    yield* waitFor(0.5);

    const startAddr = safeAddr;
    const endAddr = (safeAddr + byteCount - 1) & 0xff;
    const startLineBase = this.getLineBaseAddress(startAddr);
    const endLineBase = this.getLineBaseAddress(endAddr);

    // Calculate how many cache lines we need to access
    const linesToAccess: number[] = [];
    for (
      let lineBase = startLineBase;
      ;
      lineBase = (lineBase + this.cacheLineSize) & 0xff
    ) {
      linesToAccess.push(lineBase);
      if (lineBase === endLineBase) break;
      // Prevent infinite loop if addresses wrap around
      if (linesToAccess.length > 256 / this.cacheLineSize) break;
    }

    let result = BigInt(0);

    if (data !== null) {
      // Write operation: process each line
      const safeData = maskToSize(toBigInt(data), size);
      let remainingBytes = byteCount;
      let currentAddr = startAddr;
      let dataOffset = 0;

      for (const lineBase of linesToAccess) {
        const offsetInLine = currentAddr - lineBase;
        const bytesInThisLine = Math.min(
          remainingBytes,
          this.cacheLineSize - offsetInLine,
        );

        let lineData = BigInt(0);
        let writeMask = 0;

        for (let i = 0; i < bytesInThisLine; i++) {
          const byteOffset = offsetInLine + i;
          writeMask |= 1 << byteOffset;

          const byteVal = (safeData >> BigInt(dataOffset * 8)) & BigInt(0xff);
          lineData |= byteVal << BigInt(byteOffset * 8);
          dataOffset++;
        }

        this.labelRef().text(`LINE WR ${formatAddr(lineBase)}`);
        const lineWriteReq: LineWriteRequest = {
          type: "line_write",
          addr: lineBase,
          lineSize: this.cacheLineSize,
          data: lineData,
          writeMask: writeMask,
        };
        const lineWritePayload: Payload<RequestPacket> = {
          id: "",
          display: `LINE WR ${formatAddr(lineBase)} M=${formatWriteMask(writeMask, this.cacheLineSize)}`,
          content: lineWriteReq,
        };
        yield* this.bus().performTransaction(lineWritePayload);

        currentAddr = (currentAddr + bytesInThisLine) & 0xff;
        remainingBytes -= bytesInThisLine;
      }

      const dataHex = formatMultiByteValue(safeData, size);
      this.labelRef().text(`WR${sizeSuffix} ${addrHex} ${dataHex} OK`);

      yield* this.imgRef().scale(1.0, 0.2);
      yield* waitFor(0.5);
      this.labelRef().text("IDLE");

      return {
        id: "",
        display: "",
        content: {
          type: "write",
          addr: safeAddr,
          size: size,
          value: safeData,
        },
      };
    } else {
      // Read operation: gather data from multiple lines
      let remainingBytes = byteCount;
      let currentAddr = startAddr;
      let dataOffset = 0;

      for (const lineBase of linesToAccess) {
        const offsetInLine = currentAddr - lineBase;
        const bytesInThisLine = Math.min(
          remainingBytes,
          this.cacheLineSize - offsetInLine,
        );

        // Read line
        this.labelRef().text(`LINE RD ${formatAddr(lineBase)}`);
        const lineReadReq: LineReadRequest = {
          type: "line_read",
          addr: lineBase,
          lineSize: this.cacheLineSize,
        };
        const lineReadPayload: Payload<RequestPacket> = {
          id: "",
          display: `LINE RD ${formatAddr(lineBase)}`,
          content: lineReadReq,
        };
        const lineReadResp =
          yield* this.bus().performTransaction(lineReadPayload);

        let lineData = BigInt(0);
        if (isLineReadResponse(lineReadResp.content)) {
          lineData = lineReadResp.content.data;
        }

        // Extract bytes from this line
        for (let i = 0; i < bytesInThisLine; i++) {
          const byteVal =
            (lineData >> BigInt((offsetInLine + i) * 8)) & BigInt(0xff);
          result |= byteVal << BigInt(dataOffset * 8);
          dataOffset++;
        }

        currentAddr = (currentAddr + bytesInThisLine) & 0xff;
        remainingBytes -= bytesInThisLine;
      }

      const valHex = formatMultiByteValue(result, size);
      this.labelRef().text(`RD${sizeSuffix} ${addrHex} = ${valHex}`);

      yield* this.imgRef().scale(1.0, 0.2);
      yield* waitFor(0.5);
      this.labelRef().text("IDLE");

      return {
        id: "",
        display: "",
        content: {
          type: "read",
          addr: safeAddr,
          size: size,
          value: result,
        },
      };
    }
  }

  public *inval(addr?: number): MotionGenerator<Payload<ResponsePacket>> {
    const global = addr === undefined;
    const displayStr = global ? "INVAL ALL" : `INVAL ${formatAddr(addr!)}`;

    this.labelRef().text(displayStr);
    yield* this.imgRef().scale(1.04, 0.2);

    const request: InvalidateRequest = {
      type: "inval",
      addr: addr,
      global: global,
    };

    const payload: Payload<RequestPacket> = {
      id: "",
      display: displayStr,
      content: request,
    };

    const response = yield* this.bus().performTransaction(payload);

    this.labelRef().text("OK");
    yield* this.imgRef().scale(1.0, 0.2);
    yield* waitFor(0.3);
    this.labelRef().text("IDLE");

    return response;
  }

  public *clean(addr?: number): MotionGenerator<Payload<ResponsePacket>> {
    const global = addr === undefined;
    const displayStr = global ? "CLEAN ALL" : `CLEAN ${formatAddr(addr!)}`;

    this.labelRef().text(displayStr);
    yield* this.imgRef().scale(1.04, 0.2);

    const request: CleanRequest = {
      type: "clean",
      addr: addr,
      global: global,
    };

    const payload: Payload<RequestPacket> = {
      id: "",
      display: displayStr,
      content: request,
    };

    const response = yield* this.bus().performTransaction(payload);

    this.labelRef().text("OK");
    yield* this.imgRef().scale(1.0, 0.2);
    yield* waitFor(0.3);
    this.labelRef().text("IDLE");

    return response;
  }

  public *flush(addr?: number): MotionGenerator<Payload<ResponsePacket>> {
    const global = addr === undefined;
    const displayStr = global ? "FLUSH ALL" : `FLUSH ${formatAddr(addr!)}`;

    this.labelRef().text(displayStr);
    yield* this.imgRef().scale(1.04, 0.2);

    const request: FlushRequest = {
      type: "flush",
      addr: addr,
      global: global,
    };

    const payload: Payload<RequestPacket> = {
      id: "",
      display: displayStr,
      content: request,
    };

    const response = yield* this.bus().performTransaction(payload);

    this.labelRef().text("OK");
    yield* this.imgRef().scale(1.0, 0.2);
    yield* waitFor(0.3);
    this.labelRef().text("IDLE");

    return response;
  }

  public *zero(addr: number): MotionGenerator<Payload<ResponsePacket>> {
    const safeAddr = addr & 0xff;
    const displayStr = `ZERO ${formatAddr(safeAddr)}`;

    this.labelRef().text(displayStr);
    yield* this.imgRef().scale(1.04, 0.2);

    const request: ZeroRequest = {
      type: "zero",
      addr: safeAddr,
    };

    const payload: Payload<RequestPacket> = {
      id: "",
      display: displayStr,
      content: request,
    };

    const response = yield* this.bus().performTransaction(payload);

    this.labelRef().text("OK");
    yield* this.imgRef().scale(1.0, 0.2);
    yield* waitFor(0.3);
    this.labelRef().text("IDLE");

    return response;
  }

  public *prefetch(addr: number): MotionGenerator<Payload<ResponsePacket>> {
    const safeAddr = addr & 0xff;
    const displayStr = `PREFETCH ${formatAddr(safeAddr)}`;

    this.labelRef().text(displayStr);
    yield* this.imgRef().scale(1.04, 0.2);

    const request: PrefetchRequest = {
      type: "prefetch",
      addr: safeAddr,
    };

    const payload: Payload<RequestPacket> = {
      id: "",
      display: displayStr,
      content: request,
    };

    const response = yield* this.bus().performTransaction(payload);

    this.labelRef().text("OK");
    yield* this.imgRef().scale(1.0, 0.2);
    yield* waitFor(0.3);
    this.labelRef().text("IDLE");

    return response;
  }

  public *lineWrite(
    addr: number,
    data: bigint | number,
    lineSize: number,
    writeMask?: number,
  ): MotionGenerator<Payload<ResponsePacket>> {
    const safeAddr = addr & 0xff;
    const safeData = toBigInt(data);
    const mask = writeMask ?? generateFullMask(lineSize);
    const displayStr = `LINE WR ${formatAddr(safeAddr)}`;

    this.labelRef().text(displayStr);
    yield* this.imgRef().scale(1.04, 0.2);

    const request: LineWriteRequest = {
      type: "line_write",
      addr: safeAddr,
      lineSize: lineSize,
      data: safeData,
      writeMask: mask,
    };

    const payload: Payload<RequestPacket> = {
      id: "",
      display: `${displayStr} M=${formatWriteMask(mask, lineSize)}`,
      content: request,
    };

    const response = yield* this.bus().performTransaction(payload);

    this.labelRef().text("OK");
    yield* this.imgRef().scale(1.0, 0.2);
    yield* waitFor(0.3);
    this.labelRef().text("IDLE");

    return response;
  }

  public *readByte(addr: number): MotionGenerator<Payload<ResponsePacket>> {
    return yield* this.sendRequest(addr, null, 0);
  }

  public *readWord(addr: number): MotionGenerator<Payload<ResponsePacket>> {
    return yield* this.sendRequest(addr, null, 1);
  }

  public *readDword(addr: number): MotionGenerator<Payload<ResponsePacket>> {
    return yield* this.sendRequest(addr, null, 2);
  }

  public *readQword(addr: number): MotionGenerator<Payload<ResponsePacket>> {
    return yield* this.sendRequest(addr, null, 3);
  }

  public *writeByte(
    addr: number,
    value: number | bigint,
  ): MotionGenerator<Payload<ResponsePacket>> {
    return yield* this.sendRequest(addr, value, 0);
  }

  public *writeWord(
    addr: number,
    value: number | bigint,
  ): MotionGenerator<Payload<ResponsePacket>> {
    return yield* this.sendRequest(addr, value, 1);
  }

  public *writeDword(
    addr: number,
    value: number | bigint,
  ): MotionGenerator<Payload<ResponsePacket>> {
    return yield* this.sendRequest(addr, value, 2);
  }

  public *writeQword(
    addr: number,
    value: number | bigint,
  ): MotionGenerator<Payload<ResponsePacket>> {
    return yield* this.sendRequest(addr, value, 3);
  }
}
