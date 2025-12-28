import {
  Layout,
  Rect,
  Txt,
  Line,
  LayoutProps,
  initial,
  signal,
} from '@motion-canvas/2d';

import {
  createRef,
  Reference,
  SimpleSignal,
  ColorSignal,
  SignalValue,
  createComputed,
  ThreadGenerator,
} from '@motion-canvas/core';

import {
  Payload,
  BusSlaveHandler,
} from '../schemes/DataBusScheme';

import { RequestPacket, ResponsePacket } from '../schemes/PacketScheme';

import { MotionGenerator } from '../schemes/UtilScheme'

/**
 * Configuration properties for the DataBus component.
 */
export interface DataBusProps extends LayoutProps {
  busWidth?: SignalValue<number>;
  busHeight?: SignalValue<number>;
  busGap?: SignalValue<number>;
  strokeColor?: SignalValue<string>;
  requestLabel?: SignalValue<string>;
  requestLabelFill?: SignalValue<string>;
  responseLabel?: SignalValue<string>;
  responseLabelFill?: SignalValue<string>;
}

/**
 * A visualization of a Data Bus.
 *
 * Acts as an orchestrator for data transactions:
 * 1. Transmits data from Master to Slave via the Request Track (Top).
 * 2. Delegates control to the Slave Handler for processing.
 * 3. Transmits the result from Slave to Master via the Response Track (Bottom).
 */
export class DataBus extends Layout {
  @initial(400)
  @signal()
  public declare readonly busWidth: SimpleSignal<number, this>;

  @initial(60)
  @signal()
  public declare readonly busHeight: SimpleSignal<number, this>;

  @initial(20)
  @signal()
  public declare readonly busGap: SimpleSignal<number, this>;

  @initial('#FFFFFF')
  @signal()
  public declare readonly strokeColor: ColorSignal<this>;

  @initial('REQ (M->S)')
  @signal()
  public declare readonly requestLabel: SimpleSignal<string, this>;

  @initial('rgba(255, 255, 255, 0.5)')
  @signal()
  public declare readonly requestLabelFill: ColorSignal<this>;

  @initial('ACK (S->M)')
  @signal()
  public declare readonly responseLabel: SimpleSignal<string, this>;

  @initial('rgba(255, 255, 255, 0.5)')
  @signal()
  public declare readonly responseLabelFill: ColorSignal<this>;

  private readonly requestTrack: Reference<Rect>;
  private readonly responseTrack: Reference<Rect>;

  public slaveHandler: BusSlaveHandler<RequestPacket, ResponsePacket> | null = null;

  public constructor(props?: DataBusProps) {
    const {
      busWidth,
      busHeight,
      busGap,
      strokeColor,
      requestLabel,
      requestLabelFill,
      responseLabel,
      responseLabelFill,
      ...layoutProps
    } = props || {};

    super({
      ...layoutProps,
      layout: true,
      direction: 'column',
      alignItems: 'center',
      gap: busGap,
    });

    if (busWidth !== undefined) this.busWidth(busWidth);
    if (busHeight !== undefined) this.busHeight(busHeight);
    if (busGap !== undefined) this.busGap(busGap);
    if (strokeColor !== undefined) this.strokeColor(strokeColor);
    if (requestLabel !== undefined) this.requestLabel(requestLabel);
    if (requestLabelFill !== undefined) this.requestLabelFill(requestLabelFill);
    if (responseLabel !== undefined) this.responseLabel(responseLabel);
    if (responseLabelFill !== undefined) this.responseLabelFill(responseLabelFill);

    this.requestTrack = createRef<Rect>();
    this.responseTrack = createRef<Rect>();

    this.add(
      <>
        <Layout direction={'column'} alignItems={'center'}>
          <Txt
            text={this.requestLabel}
            fill={this.requestLabelFill}
            fontSize={this.requestLabelFontSize}
            fontWeight={1000}
          />
          <Layout width={() => this.busWidth()} height={() => this.busHeight()}>
            <Rect
              ref={this.requestTrack}
              width={() => this.busWidth()}
              height={() => this.busHeight()}
              stroke={this.strokeColor}
              lineWidth={0}
              layout={false}
              alignItems={'center'}
            />
            <Line
              layout={false}
              points={() => [
                [-this.busWidth() / 2, -this.busHeight() / 2],
                [this.busWidth() / 2, -this.busHeight() / 2],
              ]}
              stroke={this.strokeColor}
              lineWidth={10}
            />
            <Line
              layout={false}
              points={() => [
                [-this.busWidth() / 2, this.busHeight() / 2],
                [this.busWidth() / 2, this.busHeight() / 2],
              ]}
              stroke={this.strokeColor}
              lineWidth={10}
            />
          </Layout>
        </Layout>
        <Layout direction={'column'} alignItems={'center'}>
          <Layout width={() => this.busWidth()} height={() => this.busHeight()}>
            <Rect
              ref={this.responseTrack}
              width={() => this.busWidth()}
              height={() => this.busHeight()}
              stroke={this.strokeColor}
              lineWidth={0}
              layout={false}
              alignItems={'center'}
            />
            <Line
              layout={false}
              points={() => [
                [-this.busWidth() / 2, -this.busHeight() / 2],
                [this.busWidth() / 2, -this.busHeight() / 2],
              ]}
              stroke={this.strokeColor}
              lineWidth={10}
            />
            <Line
              layout={false}
              points={() => [
                [-this.busWidth() / 2, this.busHeight() / 2],
                [this.busWidth() / 2, this.busHeight() / 2],
              ]}
              stroke={this.strokeColor}
              lineWidth={10}
            />
          </Layout>
          <Txt
            text={this.responseLabel}
            fill={this.responseLabelFill}
            fontSize={this.responseLabelFontSize}
            fontWeight={1000}
          />
        </Layout>
      </>
    );
  }

  /**
   * Performs a complete transaction cycle on the bus.
   *
   * @param requestPayload The data sent from the Master.
   * @param duration Duration for the transmission animation (one way).
   * @returns The payload returned by the slave handler.
   */
  public *performTransaction(
    requestPayload: Payload<RequestPacket>,
    duration: number = 1
  ): MotionGenerator<Payload<ResponsePacket>> {
    yield* this.animateTransmission(
      requestPayload,
      this.requestTrack(),
      1,
      duration
    );

    let responsePayload: Payload<ResponsePacket>;

    if (this.slaveHandler) {
      responsePayload = yield* this.slaveHandler(requestPayload);
    } else {
      throw Error("Interconnect error");
    }

    yield* this.animateTransmission(
      responsePayload,
      this.responseTrack(),
      -1,
      duration
    );

    return responsePayload;
  }

  private *animateTransmission<T>(
    payload: Payload<T>,
    track: Rect,
    direction: number,
    duration: number
  ): ThreadGenerator {
    const label = createRef<Txt>();
    const busWidth = this.busWidth();
   
    const startX = (-busWidth / 2 + 40) * direction;
    const travelDistance = busWidth - 80;

    const packet = (
      <Txt
        ref={label}
        text={payload.display}
        fill={this.strokeColor}
        fontSize={24}
        opacity={0}
        fontWeight={700}
        position={[startX, 0]}
      />
    );

    track.add(packet);

    yield* label().opacity(1, 0.3 * duration);

    yield* label().position.x(
      startX + (travelDistance * direction),
      1.0 * duration
    );

    yield* label().opacity(0, 0.3 * duration);

    label().remove();
  }

  private createLabelFontSize(labelSignal: () => string) {
    return createComputed(() => {
      const targetFontSize = 32;
      const text = labelSignal();
     
      if (!text) return 0;

      const fontWeightFactor = 1.1;
      const isChinese = /[\u4e00-\u9fa5]/.test(text);
      const charWidthRatio = isChinese ? 1.0 : 0.55;
     
      const estimatedWidth = text.length * targetFontSize * charWidthRatio * fontWeightFactor;
      const padding = 20;
      const threshold = estimatedWidth + padding;
     
      const currentWidth = this.busWidth();
      const flickerZone = 100;
      const flickerCount = 4;
     
      if (currentWidth < threshold) return 0;
     
      const progress = Math.min((currentWidth - threshold - flickerZone) / flickerZone, 1);
      const flicker = Math.cos(progress * Math.PI * flickerCount * 2) > 0;
      return flicker ? targetFontSize : 0;
    });
  }

  private responseLabelFontSize = this.createLabelFontSize(() => this.responseLabel());
  private requestLabelFontSize = this.createLabelFontSize(() => this.requestLabel());
}
