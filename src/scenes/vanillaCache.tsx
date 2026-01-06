import {
  Code,
  LezerHighlighter,
  Layout,
  makeScene2D,
  lines,
  Latex,
  Txt,
  Rect,
} from "@motion-canvas/2d";
import { all, delay, waitFor } from "@motion-canvas/core";
import { createRef } from "@motion-canvas/core";
import { parser as cppParser } from "@lezer/cpp";

import { overlayTransition } from "../transitions/OverlayTransition";
import { DataBus } from "../components/DataBus";
import { CpuMaster } from "../components/CpuMaster";
import { MemSlave } from "../components/MemSlave";
import { Cache } from "../components/cache/Cache";

export default makeScene2D(function* (view) {
  const cpu = createRef<CpuMaster>();
  const bus = createRef<DataBus>();
  const mem = createRef<MemSlave>();
  const cache1 = createRef<Cache>();
  const cache2 = createRef<Cache>();
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
            busWidth={400}
            busHeight={60}
            busGap={40}
            strokeColor={"#DAD2BC"}
            requestLabel="REQ"
            responseLabel="ACK"
          />
          <Rect ref={cacheContainer} width={600} height={600}>
            <Layout layout={false}>
              <Cache
                ref={cache1}
                bus={bus2}
                offsetBits={0}
                setBits={0}
                numWays={1}
                titlePrefix={"L1"}
                width={600}
                height={600}
                zIndex={1}
                backgroundFill={"#DAD2BC"}
                contentFill={"#242424"}
              />

              <Cache
                ref={cache2}
                bus={bus2}
                offsetBits={1}
                setBits={0}
                numWays={1}
                titlePrefix={""}
                width={600}
                height={600}
                zIndex={1}
                opacity={0}
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
            busWidth={400}
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

  bus().slaveHandler = cache1().getHandler();
  bus2().slaveHandler = mem().getHandler();
  cpu().enableCacheLineMode(1);

  yield* overlayTransition("Chapter Three - Build a basic cache");

  yield* all(
    delay(1, cacheContainer().size([2040, 2040], 1)),
    cache1().transformDetailed(2040, 2040),
    bus().busWidth(100, 1),
    bus2().busWidth(100, 1),
  );

  yield* cache1().introCacheField("valid", 1.05, 0.5);
  yield* cache1().resetFieldIntro("valid", 0.5);
  yield* cache1().introCacheField("dirty", 1.05, 0.5);
  yield* cache1().resetFieldIntro("dirty", 0.5);
  yield* cache1().introCacheField("tag", 1.05, 0.5);
  yield* cache1().resetFieldIntro("tag", 0.5);
  yield* cache1().introCacheField("data", 1.05, 0.5);
  yield* cache1().resetFieldIntro("data", 0.5);

  yield* cpu().readByte(0x1a);
  yield* waitFor(1);

  yield* cpu().writeByte(0x1a, 0x1);
  yield* waitFor(1);

  yield* cpu().readByte(0x1c);
  yield* waitFor(1);

  yield* cache2().transformDetailed(2040, 2040);

  cacheOverlay().y(1030);
  yield* all(cacheOverlay().height(2060, 0.6), cacheOverlay().y(0, 0.6));
  cache1().opacity(0);
  cache2().opacity(1);
  bus().slaveHandler = cache2().getHandler();
  cpu().enableCacheLineMode(2);
  yield* all(cacheOverlay().height(0, 0.6), cacheOverlay().y(1030, 0.6));

  yield* cpu().writeByte(0x11, 0x1);
  yield* waitFor(1);

  yield* waitFor(10);
});
