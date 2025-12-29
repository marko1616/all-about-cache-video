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
  sequence,
  waitFor,
  ColorSignal,
  SignalValue,
  ThreadGenerator,
  all,
  range,
} from "@motion-canvas/core";

import { Payload, BusSlaveHandler } from "../schemes/DataBusScheme";

import {
  MemRequestPacket,
  ResponsePacket,
  ReadResponse,
  WriteResponse,
  ReadRequest,
  WriteRequest,
} from "../schemes/PacketScheme";

import {
  isWriteRequest,
  formatAddr,
  formatValue,
  formatMultiByteValue,
  getSizeInBytes,
  getSizeSuffix,
} from "../utils/PacketUtils";

import {
  readBytesLE,
  writeBytesLE,
  getAffectedAddresses,
  getCenterAddress,
} from "../utils/MemoryUtils";

import { MotionGenerator } from "../schemes/UtilScheme";

import memorySvg from "../../assets/images/memory.svg";

/**
 * Props for the MemSlave component.
 */
export interface MemSlaveProps extends RectProps {
  backgroundFill?: SignalValue<string>;
  contentFill?: SignalValue<string>;
  highlightFill?: SignalValue<string>;
  writeHighlight?: SignalValue<string>;
  simpleOnly?: boolean;
}

/**
 * Represents the Memory Unit (Slave).
 */
export class MemSlave extends Rect {
  @initial(null)
  @signal()
  declare public readonly backgroundFill: ColorSignal<this>;

  @initial("#FFF")
  @signal()
  declare public readonly contentFill: ColorSignal<this>;

  @initial("rgba(255, 255, 255, 0.2)")
  @signal()
  declare public readonly highlightFill: ColorSignal<this>;

  @initial("#474747")
  @signal()
  declare public readonly writeHighlight: ColorSignal<this>;

  private readonly simpleLayoutRef = createRef<Layout>();
  private readonly imgRef = createRef<Img>();
  private readonly labelRef = createRef<Txt>();

  private readonly detailedContainerRef = createRef<Rect>();

  private readonly listWindowRef = createRef<Rect>();
  private readonly scrollListRef = createRef<Layout>();

  private readonly rowValueTexts: Txt[] = [];
  private readonly rowRects: Rect[] = [];

  private readonly overlayRef = createRef<Rect>();

  private readonly storage: number[] = new Array(256).fill(0);
  private isDetailedMode = false;
  private readonly rowHeight = 60;
  private readonly simpleOnly: boolean;

  public constructor(props?: MemSlaveProps) {
    const {
      backgroundFill,
      contentFill,
      highlightFill,
      writeHighlight,
      simpleOnly = false,
      ...layoutProps
    } = props || {};

    super({
      ...layoutProps,
      layout: true,
      direction: "column",
      alignItems: "center",
      justifyContent: "center",
      clip: true,
      radius: 24,
      lineWidth: 4,
    });

    this.simpleOnly = simpleOnly;

    if (backgroundFill !== undefined) this.backgroundFill(backgroundFill);
    if (contentFill !== undefined) this.contentFill(contentFill);
    if (highlightFill !== undefined) this.highlightFill(highlightFill);
    if (writeHighlight !== undefined) this.writeHighlight(writeHighlight);

    this.fill(this.backgroundFill);

    this.add(
      <>
        {/* Simple Mode */}
        <Layout
          ref={this.simpleLayoutRef}
          width={"100%"}
          height={"100%"}
          alignItems={"center"}
          justifyContent={"center"}
        >
          <Img
            ref={this.imgRef}
            src={memorySvg}
            width={"100%"}
            height={"100%"}
          />
        </Layout>
        <Txt
          ref={this.labelRef}
          fill={this.contentFill}
          fontSize={48}
          fontWeight={700}
          marginTop={10}
          text={"IDLE"}
        />

        {/* Detailed Mode Container - only created if not simpleOnly */}
        {!simpleOnly && (
          <Rect
            ref={this.detailedContainerRef}
            layout={false}
            width={() => this.width()}
            height={() => this.height()}
            opacity={0}
          >
            <Layout
              width={() => this.detailedContainerRef().width()}
              height={() => this.detailedContainerRef().height()}
              layout={true}
              direction={"column"}
              padding={20}
            >
              {/* Header Row */}
              <Layout
                width={"100%"}
                height={60}
                direction={"row"}
                alignItems={"center"}
                justifyContent={"space-between"}
                padding={[0, 40]}
              >
                <Txt
                  fill={this.contentFill}
                  fontSize={48}
                  fontWeight={700}
                  text={"ADDR"}
                />
                <Txt
                  fill={this.contentFill}
                  fontSize={48}
                  fontWeight={700}
                  text={"DATA"}
                />
              </Layout>

              <Rect
                height={5}
                radius={2}
                width={"100%"}
                fill={this.contentFill}
                marginBottom={10}
              />

              {/* Scrollable List Container */}
              <Rect
                ref={this.listWindowRef}
                grow={1}
                width={"100%"}
                clip={true}
                fill={"rgba(0, 0, 0, 0.05)"}
                radius={8}
                lineWidth={2}
              >
                <Rect
                  layout={false}
                  width={() => this.listWindowRef().width()}
                  height={() => this.listWindowRef().height()}
                >
                  <Layout
                    ref={this.scrollListRef}
                    layout={true}
                    direction={"column"}
                    width={() => this.listWindowRef().width()}
                  >
                    {range(256).map((i) => (
                      <Rect
                        ref={(el) => (this.rowRects[i] = el)}
                        height={this.rowHeight}
                        alignItems={"center"}
                        justifyContent={"space-between"}
                        padding={[0, 40]}
                        fill={this.backgroundFill}
                        margin={[5, 10]}
                        radius={8}
                      >
                        <Txt
                          fill={this.contentFill}
                          fontSize={40}
                          fontWeight={700}
                          text={formatAddr(i)}
                        />
                        <Txt
                          ref={(el) => (this.rowValueTexts[i] = el)}
                          fill={this.contentFill}
                          fontSize={40}
                          fontWeight={700}
                          text={"0x00"}
                        />
                      </Rect>
                    ))}
                  </Layout>
                </Rect>
              </Rect>
            </Layout>
          </Rect>
        )}

        {/* Overlay - only needed for transitions */}
        {!simpleOnly && (
          <Rect
            ref={this.overlayRef}
            width={() => this.width()}
            y={() => this.height() / 2}
            height={0}
            fill={this.contentFill}
            layout={false}
          />
        )}
      </>,
    );
  }

  public getHandler(): BusSlaveHandler<MemRequestPacket, ResponsePacket> {
    return (payload: Payload<MemRequestPacket>) =>
      this.processTransaction(
        payload as Payload<ReadRequest> | Payload<WriteRequest>,
      );
  }

  public *transformDetailed(width: number, height: number): ThreadGenerator {
    if (this.simpleOnly) {
      console.warn("MemSlave: transformDetailed called but simpleOnly is true");
      return;
    }

    this.isDetailedMode = true;

    for (let i = 0; i < 256; i++) {
      this.rowValueTexts[i].text(formatValue(this.storage[i]));
    }

    yield* all(
      this.overlayRef().height(this.height(), 1.0),
      this.overlayRef().y(0, 1.0),
    );

    this.fill("#00000000");
    this.simpleLayoutRef().opacity(0);
    this.labelRef().opacity(0);
    this.detailedContainerRef().opacity(1);

    yield* all(
      this.size([width, height], 1.0),
      this.overlayRef().height(height, 1.0),
    );

    this.fill(this.backgroundFill);

    yield* all(
      this.overlayRef().height(0, 1.0),
      this.overlayRef().y(height / 2, 1.0),
    );
  }

  public *transformSimple(width: number, height: number): ThreadGenerator {
    if (this.simpleOnly) {
      console.warn("MemSlave: transformSimple called but simpleOnly is true");
      return;
    }

    this.isDetailedMode = false;

    yield* all(
      this.overlayRef().height(this.height(), 1.0),
      this.overlayRef().y(0, 1.0),
    );

    this.fill("#00000000");
    this.detailedContainerRef().opacity(0);
    this.simpleLayoutRef().opacity(1);
    this.labelRef().opacity(1);

    this.scrollListRef().y(0);

    yield* all(
      this.size([width, height], 1.0),
      this.overlayRef().height(height, 1.0),
    );

    this.fill(this.backgroundFill);

    yield* all(
      this.overlayRef().height(0, 1.0),
      this.overlayRef().y(height / 2, 1.0),
    );
  }

  private *processTransaction(
    payload: Payload<ReadRequest> | Payload<WriteRequest>,
  ): MotionGenerator<Payload<ResponsePacket>> {
    const safeAddr = payload.content.addr & 0xff;
    const size = payload.content.size ?? 0;
    const byteCount = getSizeInBytes(size);
    const affectedAddrs = getAffectedAddresses(safeAddr, byteCount);
    const sizeSuffix = getSizeSuffix(size);
    const addrHex = formatAddr(safeAddr);

    if (!this.isDetailedMode) {
      this.labelRef().text("ACCESS...");
      yield* sequence(
        0.2,
        this.imgRef().scale(1.04, 0.4),
        this.imgRef().scale(1.0, 0.4),
      );
    } else {
      const rowHeightWithMargin = this.rowHeight + 10;
      const listHeight = 256 * rowHeightWithMargin;
      const centerAddr = getCenterAddress(affectedAddrs);
      const rowCenterFromTop =
        centerAddr * rowHeightWithMargin + rowHeightWithMargin / 2;
      const rowCenterFromListCenter = rowCenterFromTop - listHeight / 2;
      yield* this.scrollListRef().y(-rowCenterFromListCenter, 1.0);
    }

    let responseContent: ResponsePacket;
    let responseDisplay = "";

    if (this.isDetailedMode) {
      yield* all(
        ...affectedAddrs.map((addr) =>
          this.rowRects[addr].fill(this.highlightFill(), 0.4),
        ),
        ...affectedAddrs.map((addr) =>
          this.rowValueTexts[addr].scale(1.1, 0.4),
        ),
      );
    }

    if (isWriteRequest(payload.content)) {
      const val = payload.content.value;
      writeBytesLE(this.storage, safeAddr, val, byteCount);

      const writeResponse: WriteResponse = {
        type: "write",
        addr: safeAddr,
        size: size,
        value: val,
      };
      responseContent = writeResponse;
      responseDisplay = `WR${sizeSuffix} [${addrHex}] OK`;

      if (this.isDetailedMode) {
        for (const addr of affectedAddrs) {
          this.rowValueTexts[addr].text(formatValue(this.storage[addr]));
        }

        yield* all(
          ...affectedAddrs.map((addr) =>
            this.rowValueTexts[addr]
              .fill(this.writeHighlight(), 0.4)
              .to(this.contentFill(), 0.4),
          ),
        );
      }
    } else {
      const val = readBytesLE(this.storage, safeAddr, byteCount);

      const readResponse: ReadResponse = {
        type: "read",
        addr: safeAddr,
        size: size,
        value: val,
      };
      responseContent = readResponse;
      const valHex = formatMultiByteValue(val, size);
      responseDisplay = `RD${sizeSuffix} [${addrHex}]=${valHex}`;

      if (this.isDetailedMode) {
        yield* waitFor(0.2);
      }
    }

    if (this.isDetailedMode) {
      yield* all(
        ...affectedAddrs.map((addr) =>
          this.rowRects[addr].fill(this.backgroundFill, 0.6),
        ),
        ...affectedAddrs.map((addr) => this.rowValueTexts[addr].scale(1, 0.6)),
      );
    }

    const responsePayload: Payload<ResponsePacket> = {
      id: payload.id,
      display: responseDisplay,
      content: responseContent,
    };

    if (!this.isDetailedMode) {
      this.labelRef().text("READY");
      yield* waitFor(1.0);
      this.labelRef().text("IDLE");
    } else {
      yield* waitFor(1.0);
    }

    return responsePayload;
  }
}
