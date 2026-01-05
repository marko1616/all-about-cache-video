import {
  Code,
  LezerHighlighter,
  Layout,
  makeScene2D,
  lines,
  Latex,
  Txt,
} from "@motion-canvas/2d";
import { all, waitUntil, waitFor } from "@motion-canvas/core/lib/flow";
import { createRef } from "@motion-canvas/core";
import { parser as cppParser } from "@lezer/cpp";

import { overlayTransition } from "../transitions/OverlayTransition";
import { DataBus } from "../components/DataBus";
import { CpuMaster } from "../components/CpuMaster";
import { MemSlave } from "../components/MemSlave";
import { Cache } from "../components/Cache";

export default makeScene2D(function* (view) {
  const cpu = createRef<CpuMaster>();
  const bus = createRef<DataBus>();
  const mem = createRef<MemSlave>();
  const cache = createRef<Cache>();
  const bus2 = createRef<DataBus>();

  const mainContainer = createRef<Layout>();
  const code = createRef<Code>();

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
          <Cache
            ref={cache}
            bus={bus2}
            offsetBits={0}
            setBits={0}
            numWays={1}
            titlePrefix={""}
            width={600}
            height={600}
            zIndex={1}
            backgroundFill={"#DAD2BC"}
            contentFill={"#242424"}
          />
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

  bus().slaveHandler = cache().getHandler();
  bus2().slaveHandler = mem().getHandler();
  cpu().enableCacheLineMode(2);

  yield* overlayTransition("Chapter Three - Build a basic cache");

  yield* all(
    cache().transformDetailed(2040, 2040),
    bus().busWidth(100, 1),
    bus2().busWidth(100, 1),
  );

  yield* cpu().readByte(0x1a);
  yield* waitFor(1);

  yield* cpu().readByte(0x1c);
  yield* waitFor(1);

  yield* waitFor(10);
});
