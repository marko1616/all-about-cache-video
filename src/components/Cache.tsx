import {
  Layout,
  RectProps,
  Rect,
  Txt,
  initial,
  signal,
} from '@motion-canvas/2d';

import {
  createRef,
  waitFor,
  Reference,
  ColorSignal,
  SignalValue,
  SimpleSignal,
} from '@motion-canvas/core';

import { DataBus } from './DataBus';
import { BusSlaveHandler, Payload } from '../schemes/DataBusScheme';
import {
  RequestPacket,
  ResponsePacket,
  ReadRequest,
  WriteRequest,
} from '../schemes/PacketScheme';

import {
  isReadResponse,
  formatAddr,
  formatMultiByteValue,
  getSizeSuffix,
  maskToSize,
  toBigInt,
} from '../utils/PacketUtils';

import { MotionGenerator } from '../schemes/UtilScheme';

/**
 * Props for the Cache component.
 */
export interface CacheProps extends RectProps {
  bus: Reference<DataBus>;
  titlePrefix?: SignalValue<string>;
  backgroundFill?: SignalValue<string>;
  contentFill?: SignalValue<string>;
}

/**
 * Represents a Cache Unit.
 * Currently acts as a pass-through, forwarding all requests to the bus.
 */
export class Cache extends Rect {
  @initial(null)
  @signal()
  public declare readonly backgroundFill: ColorSignal<this>;

  @initial('#FFF')
  @signal()
  public declare readonly contentFill: ColorSignal<this>;

  @initial('L1')
  @signal()
  public declare readonly titlePrefix: SimpleSignal<string>;

  private readonly bus: Reference<DataBus>;
  private readonly titleRef = createRef<Txt>();
  private readonly labelRef = createRef<Txt>();
  private readonly containerRef = createRef<Rect>();

  public constructor(props: CacheProps) {
    const {
      bus,
      titlePrefix,
      backgroundFill,
      contentFill,
      ...layoutProps
    } = props;

    super({
      ...layoutProps,
      layout: true,
      direction: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      radius: 24,
      clip: true,
    });

    if (backgroundFill !== undefined) this.backgroundFill(backgroundFill);
    if (contentFill !== undefined) this.contentFill(contentFill);
    if (titlePrefix !== undefined) this.titlePrefix(titlePrefix);

    this.fill(this.backgroundFill);
    this.bus = bus;

    this.add(
      <>
        <Rect
          ref={this.containerRef}
          width={'100%'}
          height={'100%'}
          layout={true}
          direction={'column'}
          alignItems={'center'}
          justifyContent={'center'}
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
            text={'IDLE'}
          />
        </Rect>
      </>
    );
  }

  /**
   * Initiates a read/write request, forwarding to the connected DataBus.
   * Currently acts as a simple pass-through.
   */
  public *sendRequest(
    addr: number,
    data: bigint | number | null = null,
    size: number = 0
  ): MotionGenerator<Payload<ResponsePacket>> {
    const safeAddr = addr & 0xFF;
    const addrHex = formatAddr(safeAddr);
    const sizeSuffix = getSizeSuffix(size);
  
    let displayStr = '';
    let payloadContent: RequestPacket;

    if (data !== null) {
      const safeData = maskToSize(toBigInt(data), size);
      const dataHex = formatMultiByteValue(safeData, size);
      displayStr = `WR${sizeSuffix} ${addrHex} ${dataHex}`;
     
      const writeRequest: WriteRequest = {
        type: 'write',
        addr: safeAddr,
        size: size,
        value: safeData,
      };
      payloadContent = writeRequest;
    } else {
      displayStr = `RD${sizeSuffix} ${addrHex}`;
      const readRequest: ReadRequest = {
        type: 'read',
        addr: safeAddr,
        size: size,
      };
      payloadContent = readRequest;
    }

    // Show forwarding status
    this.labelRef().text('FORWARD...');
    yield* this.containerRef().scale(1.03, 0.2);
  
    const requestPayload: Payload<RequestPacket> = {
      id: '',
      display: displayStr,
      content: payloadContent,
    };

    // Forward to bus (pass-through)
    const response = yield* this.bus().performTransaction(requestPayload);

    // Show response status
    if (isReadResponse(response.content)) {
      const valHex = formatMultiByteValue(response.content.value, response.content.size);
      this.labelRef().text(`GOT: ${valHex}`);
    } else {
      this.labelRef().text(`SENT OK`);
    }

    yield* this.containerRef().scale(1.0, 0.2);
    yield* waitFor(0.5);
    this.labelRef().text('IDLE');
  
    return response;
  }

  /**
   * Returns a handler for the cache to act as a bus slave.
   * Currently just forwards all requests to the downstream bus.
   */
  public getHandler(): BusSlaveHandler<RequestPacket, ResponsePacket> {
    return (payload: Payload<RequestPacket>) => this.processTransaction(payload);
  }

  /**
   * Process incoming transaction - currently just forwards to downstream bus.
   */
  private *processTransaction(payload: Payload<RequestPacket>): MotionGenerator<Payload<ResponsePacket>> {
    const sizeSuffix = getSizeSuffix(payload.content.size ?? 0);
    const addrHex = formatAddr(payload.content.addr);
   
    // Show forwarding status
    this.labelRef().text('FORWARD...');
    yield* this.containerRef().scale(1.03, 0.2);

    // Forward to downstream bus (pass-through)
    const response = yield* this.bus().performTransaction(payload);

    // Show response status
    if (isReadResponse(response.content)) {
      const valHex = formatMultiByteValue(response.content.value, response.content.size);
      this.labelRef().text(`GOT: ${valHex}`);
    } else {
      this.labelRef().text(`SENT OK`);
    }

    yield* this.containerRef().scale(1.0, 0.2);
    yield* waitFor(0.3);
    this.labelRef().text('IDLE');

    return response;
  }

  // Convenience methods for byte operations
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

  public *writeByte(addr: number, value: number | bigint): MotionGenerator<Payload<ResponsePacket>> {
    return yield* this.sendRequest(addr, value, 0);
  }

  public *writeWord(addr: number, value: number | bigint): MotionGenerator<Payload<ResponsePacket>> {
    return yield* this.sendRequest(addr, value, 1);
  }

  public *writeDword(addr: number, value: number | bigint): MotionGenerator<Payload<ResponsePacket>> {
    return yield* this.sendRequest(addr, value, 2);
  }

  public *writeQword(addr: number, value: number | bigint): MotionGenerator<Payload<ResponsePacket>> {
    return yield* this.sendRequest(addr, value, 3);
  }
}