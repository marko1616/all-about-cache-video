import {
  Img,
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
} from '@motion-canvas/core';

import { DataBus } from './DataBus';
import { Payload } from '../schemes/DataBusScheme';
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

import cpuSvg from '../../assets/images/cpu.svg';

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
 */
export class CpuMaster extends Rect {
  @initial(null)
  @signal()
  public declare readonly backgroundFill: ColorSignal<this>;

  @initial('#FFF')
  @signal()
  public declare readonly contentFill: ColorSignal<this>;

  private readonly bus: Reference<DataBus>;
  private readonly labelRef = createRef<Txt>();
  private readonly imgRef = createRef<Img>();

  public constructor(props: CpuMasterProps) {
    const {
      bus,
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
    });

    if (backgroundFill !== undefined) this.backgroundFill(backgroundFill);
    if (contentFill !== undefined) this.contentFill(contentFill);

    this.fill(this.backgroundFill);
    this.bus = bus;

    this.add(
      <>
        <Layout width={'100%'} height={'100%'} alignItems={'center'} justifyContent={'center'}>
           <Img
            ref={this.imgRef}
            src={cpuSvg}
            width={'100%'}
            height={'100%'}
          />
        </Layout>
        <Txt
          ref={this.labelRef}
          fill={this.contentFill}
          fontSize={48}
          fontWeight={700}
          marginTop={10}
          text={'IDLE'}
        />
      </>
    );
  }

  /**
   * Initiates a read/write request to the connected DataBus.
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

    this.labelRef().text(displayStr);
    yield* this.imgRef().scale(1.04, 0.2);
  
    const requestPayload: Payload<RequestPacket> = {
      id: '',
      display: displayStr,
      content: payloadContent,
    };

    const response = yield* this.bus().performTransaction(requestPayload);

    if (isReadResponse(response.content)) {
      const valHex = formatMultiByteValue(response.content.value, response.content.size);
      this.labelRef().text(`GOT: ${valHex}`);
    } else {
      this.labelRef().text(`SENT OK`);
    }

    yield* this.imgRef().scale(1.0, 0.2);
    yield* waitFor(0.5);
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
