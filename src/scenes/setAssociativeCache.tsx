import { Code, Layout, makeScene2D, Rect } from "@motion-canvas/2d";
import { all, delay, waitFor } from "@motion-canvas/core";
import { createRef } from "@motion-canvas/core";

import { verticalOverlayTransition } from "../transitions/OverlayTransition";
import { DataBus } from "../components/DataBus";
import { CpuMaster } from "../components/CpuMaster";
import { MemSlave } from "../components/MemSlave";
import { Cache } from "../components/cache/Cache";

export default makeScene2D(function* (view) {
  const cpu = createRef<CpuMaster>();
  const bus = createRef<DataBus>();
  const mem = createRef<MemSlave>();
  const cache = createRef<Cache>();
  const bus2 = createRef<DataBus>();

  const mainContainer = createRef<Layout>();
  const code = createRef<Code>();

  const cacheContainer = createRef<Rect>();
  const cacheOverlay = createRef<Rect>();

  view.add(
    <>
      <Layout
        layout
        ref={mainContainer}
        direction={"column"}
        alignItems={"center"}
        gap={0}
      >
        <Code
          ref={code}
          code={""}
          fontSize={0}
          fontFamily={"JetBrains Mono"}
        ></Code>
        <Layout layout alignItems={"center"} gap={0}>
          <CpuMaster
            ref={cpu}
            bus={bus}
            width={600}
            height={600}
            zIndex={1}
            padding={60}
            radius={10}
            backgroundFill={"#DAD2BC"}
            contentFill={"#242424"}
          />
          <DataBus
            ref={bus}
            busWidth={100}
            busHeight={60}
            busGap={40}
            strokeColor={"#DAD2BC"}
            requestLabel="REQ"
            responseLabel="ACK"
          />
          <Rect ref={cacheContainer} width={2040} height={2040}>
            <Layout layout={false}>
              <Cache
                ref={cache}
                bus={bus2}
                offsetBits={1}
                setBits={3}
                numWays={4}
                titlePrefix={""}
                width={600}
                height={600}
                zIndex={1}
                backgroundFill={"#DAD2BC"}
                contentFill={"#242424"}
              />
              <Rect
                ref={cacheOverlay}
                width={2060}
                height={0}
                radius={24}
                fill={"#242424"}
                zIndex={100}
              />
            </Layout>
          </Rect>
          <DataBus
            ref={bus2}
            busWidth={100}
            busHeight={60}
            busGap={40}
            strokeColor={"#DAD2BC"}
            requestLabel="REQ"
            responseLabel="ACK"
          />
          <MemSlave
            ref={mem}
            width={600}
            height={600}
            zIndex={1}
            padding={60}
            radius={10}
            simpleOnly={true}
            backgroundFill={"#DAD2BC"}
            highlightFill={"#F5F1ED"}
            writeHighlight={"#474747"}
            contentFill={"#242424"}
          />
        </Layout>
      </Layout>
    </>,
  );

  bus().slaveHandler = cache().getHandler();
  bus2().slaveHandler = mem().getHandler();
  cpu().enableCacheLineMode(1);
  cache().setDetailedImmediate(2040, 2040);

  yield* verticalOverlayTransition(
    "Chapter Four - Mapping strategy - Part 3 - Set Associative Cache",
    "Fully Associative Cache",
    "Set Associative Cache",
    0.1,
  );

  yield* cpu().writeByte(0x10, 0x1);
  yield* waitFor(1);

  yield* cpu().writeByte(0x12, 0x1);
  yield* waitFor(1);

  yield* cpu().writeByte(0x14, 0x1);
  yield* waitFor(1);

  yield* cpu().writeByte(0x16, 0x1);
  yield* waitFor(1);

  yield* all(
    mem().transformDetailed(400, 1600),
    delay(1, bus2().busWidth(300, 1)),
  );
});
