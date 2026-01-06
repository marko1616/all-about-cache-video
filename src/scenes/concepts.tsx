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
import { Cache } from "../components/cache/Cache";

export default makeScene2D(function* (view) {
  const cpu = createRef<CpuMaster>();
  const bus = createRef<DataBus>();
  const mem = createRef<MemSlave>();
  const cache = createRef<Cache>();
  const bus2 = createRef<DataBus>();

  const mainContainer = createRef<Layout>();
  const code = createRef<Code>();
  const latex = createRef<Latex>();
  const title = createRef<Txt>();

  Code.defaultHighlighter = new LezerHighlighter(cppParser);

  <Latex ref={latex} fontSize={70} fill={"#DAD2BC"}></Latex>;

  view.add(
    <>
      <Txt
        ref={title}
        y={() => -view.height() / 2 + 300}
        fill={"#DAD2BC"}
        fontSize={100}
        fontWeight={700}
        zIndex={100}
      />
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
            offsetBits={1}
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

  yield* overlayTransition("Chapter Two - Basic concepts of cache");

  yield* title().text("Read Miss", 1);
  yield* cpu().readByte(0x1a);
  yield* waitFor(1);

  yield* waitUntil("Intro read miss done");
  yield* title().text("Read Hit", 0.5);
  yield* cpu().readByte(0x1a);
  yield* waitFor(1);

  yield* waitUntil("Intro read hit done");
  yield* title().text("Cacheline & Crossline Access", 0.5);
  yield* cpu().readWord(0x1b);
  yield* waitFor(1);

  yield* waitUntil("Intro cacheline done");
  yield* title().text("Write Miss", 0.5);
  yield* cpu().writeByte(0x20, 0xff);
  yield* waitFor(1);

  yield* waitUntil("Intro write miss done");
  yield* title().text("Write Hit", 0.5);
  yield* cpu().writeByte(0x20, 0xff);
  yield* waitFor(1);

  yield* waitUntil("Intro write hit done");
  yield* title().text("Write Back", 0.5);
  yield* cpu().readByte(0x1a);
  yield* waitFor(1);

  yield* waitUntil("Intro write back done");
  yield* title().text("Cacheline Invalidation", 0.5);
  yield* cpu().writeByte(0x1a, 0x1);
  yield* waitFor(1);
  yield* cpu().inval(0x1a);
  yield* waitFor(1);
  yield* cpu().readByte(0x1a);

  yield* waitUntil("Intro cacheline invalidation done");
  yield* title().text("Cacheline Clean", 0.5);
  yield* cpu().writeByte(0x1a, 0x1);
  yield* waitFor(1);
  yield* cpu().clean(0x1a);
  yield* waitFor(1);
  yield* cpu().readByte(0x1a);

  yield* waitUntil("Intro cacheline clean done");
  yield* title().text("Cacheline Flush", 0.5);
  yield* cpu().writeByte(0x1a, 0x1);
  yield* waitFor(1);
  yield* cpu().flush(0x1a);
  yield* waitFor(1);
  yield* cpu().readByte(0x1a);

  yield* waitUntil("Intro cacheline flush done");
  yield* title().text("Cacheline Prefetch", 0.5);
  yield* cpu().prefetch(0x20);
  yield* waitFor(1);
  yield* cpu().readByte(0x20);

  // Temporal Locality (Time) - Accessing the same address
  yield* all(
    title().text("Temporal Locality", 0.5),
    mainContainer().gap(200, 1),
    code().fontSize(50, 1),
    code().code(
      `for(size_t i = 0; i < N; ++i) {
    uint8_t data = *reinterpret_cast<uint8_t*>(BASE)
}`,
      1,
    ),
  );

  for (var i = 0; i < 4; ++i) {
    yield* cpu().readByte(0x10);
    yield* waitFor(1);
  }

  // Spatial Locality (Space) - Accessing sequential addresses
  yield* all(
    title().text("Spatial Locality", 0.5),
    code().code.replace(
      lines(1),
      `    uint8_t data = *reinterpret_cast<uint8_t*>(BASE+i)\n`,
      1,
    ),
  );

  for (var i = 0; i < 4; ++i) {
    yield* cpu().readByte(0x10 + i);
    yield* waitFor(1);
  }

  yield* all(
    title().text("AMAT", 0.5),
    mainContainer().gap(0, 1),
    code().fontSize(0, 1),
    code().code(``, 1),
  );

  code().remove();
  mainContainer().insert(latex());

  yield* all(
    mainContainer().gap(200, 1),
    latex().tex("AMAT = HitTime + MissRate \\cdot MissPenalty", 1),
  );

  yield* waitFor(1);
});
