import { CubicBezier, Layout, Path, Txt, makeScene2D } from "@motion-canvas/2d";
import {
  chain,
  all,
  sequence,
  waitUntil,
  waitFor,
} from "@motion-canvas/core/lib/flow";
import { createRef, Reference, Color } from "@motion-canvas/core";

import { overlayTransition } from "../transitions/OverlayTransition";
import { DataBus } from "../components/DataBus";
import { CpuMaster } from "../components/CpuMaster";
import { MemSlave } from "../components/MemSlave";
import { Cache } from "../components/Cache";
import { OrbitalBall } from "../components/OrbitalBall";

import ballsShader from "../../assets/shaders/balls.glsl";

// https://stackoverflow.com/questions/40864852/what-happened-to-the-l4-cache
import l4CacheJpg from "../../assets/images/l4Cache.jpg";
import { ImageStream } from "../components/ImageStream";

// https://www.svgrepo.com/svg/506167/coin
import coinSvg from "../../assets/images/coin.svg";
// https://www.svgrepo.com/svg/520559/box-open-2
import boxSvg from "../../assets/images/box.svg";
// https://www.svgrepo.com/svg/34878/bolt
import boltSvg from "../../assets/images/bolt.svg";

export default makeScene2D(function* (view) {
  const cpu = createRef<CpuMaster>();
  const bus = createRef<DataBus>();
  const mem = createRef<MemSlave>();
  const cache = createRef<Cache>();
  const bus2 = createRef<DataBus>();

  const ballA = createRef<OrbitalBall>();
  const ballB = createRef<OrbitalBall>();
  const ballC = createRef<OrbitalBall>();

  const colorA = new Color("#db3069");
  const colorB = new Color("#f5d547");
  const colorC = new Color("#1446a0");

  view.add(
    <Layout
      height={"100%"}
      width={"100%"}
      shaders={{
        fragment: ballsShader,
        uniforms: {
          u_circle1: () => [ballA().position().x, ballA().position().y, 300],
          u_color1: colorA,
          u_circle2: () => [ballB().position().x, ballB().position().y, 300],
          u_color2: colorB,
          u_circle3: () => [ballC().position().x, ballC().position().y, 300],
          u_color3: colorC,
          u_bg_ref_color: new Color("#363636"),
          u_smoothness: 100.0,
          u_border1_w: 100.0,
          u_border2_w: 2000.0,
        },
      }}
    >
      <OrbitalBall
        ref={ballA}
        index={0}
        total={3}
        src={coinSvg}
        width={300}
        height={300}
      />
      <OrbitalBall
        ref={ballB}
        index={1}
        total={3}
        src={boltSvg}
        width={300}
        height={300}
      />
      <OrbitalBall
        ref={ballC}
        index={2}
        total={3}
        src={boxSvg}
        width={300}
        height={300}
      />
    </Layout>,
  );

  view.add(
    <Layout layout alignItems={"center"} gap={0}>
      <CpuMaster
        ref={cpu}
        bus={bus}
        width={600}
        height={600}
        zIndex={1}
        padding={60}
        radius={10}
        opacity={0}
        backgroundFill={"#DAD2BC"}
        contentFill={"#242424"}
      />
      <DataBus
        ref={bus}
        busWidth={0}
        busHeight={60}
        busGap={40}
        strokeColor={"#DAD2BC"}
        requestLabel="REQ"
        responseLabel="ACK"
        opacity={0}
      />
      <Cache
        ref={cache}
        bus={bus2}
        offsetBits={0}
        setBits={0}
        numWays={1}
        titlePrefix={""}
        width={0}
        height={600}
        zIndex={1}
        opacity={0}
        backgroundFill={"#DAD2BC"}
        contentFill={"#242424"}
      />
      <DataBus
        ref={bus2}
        busWidth={0}
        busHeight={60}
        busGap={40}
        strokeColor={"#DAD2BC"}
        requestLabel="REQ"
        responseLabel="ACK"
        opacity={0}
      />
      <MemSlave
        ref={mem}
        width={600}
        height={600}
        zIndex={1}
        padding={60}
        radius={10}
        opacity={0}
        backgroundFill={"#DAD2BC"}
        highlightFill={"#F5F1ED"}
        writeHighlight={"#474747"}
        contentFill={"#242424"}
      />
    </Layout>,
  );

  bus().slaveHandler = mem().getHandler();
  bus2().slaveHandler = mem().getHandler();

  yield* overlayTransition("Chapter One - Memory hierarchy");

  yield* all(
    ballA().rotate(2.5, 20),
    ballB().rotate(2.5, 20),
    ballC().rotate(2.5, 20),
    sequence(
      4,
      all(ballA().flyIn(1.5), ballB().flyIn(1.7), ballC().flyIn(1.9)),
      all(ballA().focus(0.8), ballB().defocus(0.8), ballC().defocus(0.8)),
      all(ballA().defocus(0.8), ballB().focus(0.8), ballC().defocus(0.8)),
      all(ballA().defocus(0.8), ballB().defocus(0.8), ballC().focus(0.8)),
      all(
        ballA().resetFocus(0.8),
        ballB().resetFocus(0.8),
        ballC().resetFocus(0.8),
      ),
    ),
  );

  yield* all(ballA().flyOut(1.2), ballB().flyOut(1.2), ballC().flyOut(1.2));

  yield* all(bus().opacity(1, 1), bus().busWidth(400, 1.5));

  yield* all(cpu().opacity(1, 1), mem().opacity(1, 1));

  yield* waitFor(0.5);

  yield* cpu().sendRequest(0x1a, 0x88);
  yield* waitFor(1);

  yield* cpu().sendRequest(0x1a);
  yield* waitFor(1);

  yield* cpu().sendRequest(0xff);
  yield* waitFor(1);

  yield* mem().transformDetailed(400, 1600);

  yield* cpu().sendRequest(0x1a, 0x12);
  yield* waitFor(1);

  yield* cpu().readDword(0x1a);
  yield* waitFor(1);

  yield* cpu().sendRequest(0xff);
  yield* waitFor(1);

  yield* mem().transformSimple(600, 600);

  yield* cpu().sendRequest(0x1a, 0x89);
  yield* waitFor(1);

  yield* cpu().sendRequest(0x1a);
  yield* waitFor(1);

  bus2().opacity(1);

  yield* bus2().busWidth(400, 1.2);

  yield* all(cache().opacity(1, 0.8), cache().width(600, 1.0));

  yield* waitFor(0.5);
  bus().slaveHandler = cache().getHandler();

  yield* cpu().readByte(0x1a);
  yield* waitFor(1);

  yield* cpu().readByte(0x1a);
  yield* waitFor(1);

  yield* all(cpu().opacity(0, 1), mem().opacity(0, 1), cache().opacity(0, 1));

  yield* all(
    bus().opacity(0, 1),
    bus().busWidth(0, 1),
    bus2().opacity(0, 1),
    bus2().busWidth(0, 1),
    cache().width(0, 1),
  );

  const pyramid: Reference<Path>[] = [];
  const l1d = createRef<Path>();
  const l1i = createRef<Path>();

  const pyramidTexts: string[] = ["Reg", "L2 Cache", "L3 Cache", "RAM", "Disk"];
  const levels = 6;
  const layerHeight = 160;
  const gapSize = 60;
  const startWidth = 5;
  const widthIncrement = 1.2;
  const color = "#DAD2BC";
  const cornerRadius = 20;
  const fontSize = 48;

  const costArrow = createRef<CubicBezier>();
  const speedArrow = createRef<CubicBezier>();
  const costArrowTxt = createRef<Txt>();
  const speedArrowTxt = createRef<Txt>();

  const l1TopY = 1 * (layerHeight + gapSize);
  const l1BottomY = l1TopY + layerHeight;
  const l1TopWidth = startWidth + l1TopY * widthIncrement;
  const l1BottomWidth = startWidth + l1BottomY * widthIncrement;

  const l1HalfTop = (l1TopWidth - gapSize) / 2;
  const l1HalfBottom = (l1BottomWidth - gapSize) / 2;

  const l1dRightX = l1HalfBottom / 2;
  const l1dTopLeftX = l1dRightX - l1HalfTop;
  const l1dBottomLeftX = -l1HalfBottom / 2;

  const l1dPathData = `
    M ${l1dTopLeftX} ${-layerHeight / 2}
    L ${l1dRightX} ${-layerHeight / 2}
    L ${l1dRightX} ${layerHeight / 2}
    L ${l1dBottomLeftX} ${layerHeight / 2}
    Z
  `;

  const l1iLeftX = -l1HalfBottom / 2;
  const l1iTopRightX = l1iLeftX + l1HalfTop;
  const l1iBottomRightX = l1HalfBottom / 2;

  const l1iPathData = `
    M ${l1iLeftX} ${-layerHeight / 2}
    L ${l1iTopRightX} ${-layerHeight / 2}
    L ${l1iBottomRightX} ${layerHeight / 2}
    L ${l1iLeftX} ${layerHeight / 2}
    Z
  `;

  view.add(
    <Layout layout alignItems={"center"} gap={gapSize + cornerRadius}>
      <Layout layout direction={"column"} gap={gapSize} alignItems={"center"}>
        <Txt
          ref={speedArrowTxt}
          text={"faster\nmore expensive\nsmaller"}
          fill={"#DAD2BC"}
          fontSize={fontSize}
          fontFamily={"JetBrains Mono, monospace"}
          fontWeight={700}
          opacity={0}
        />
        <CubicBezier
          ref={speedArrow}
          lineWidth={6}
          stroke={"#669BBC"}
          p0={[0, (levels - 1) * gapSize + levels * layerHeight]}
          p1={[0, (levels - 1) * gapSize + levels * layerHeight]}
          p2={[0, 0]}
          p3={[0, 0]}
          arrowSize={16}
          end={0}
          endArrow
        />
      </Layout>
      <Layout layout direction={"column"} gap={gapSize} alignItems={"center"}>
        {Array.from({ length: levels }).map((_, i) => {
          if (i === 1) {
            return (
              <Layout
                layout
                direction={"row"}
                gap={gapSize}
                alignItems={"center"}
              >
                <Path
                  ref={l1d}
                  data={l1dPathData}
                  fill={color}
                  opacity={0}
                  width={l1HalfBottom}
                  height={layerHeight}
                  stroke={color}
                  lineWidth={cornerRadius * 2}
                  lineJoin={"round"}
                  layout
                  direction={"column"}
                  alignItems={"center"}
                  justifyContent={"center"}
                >
                  <Txt
                    marginRight={-40}
                    text={"L1D"}
                    fill={"#242424"}
                    fontSize={fontSize}
                    fontFamily={"JetBrains Mono, monospace"}
                    fontWeight={700}
                  />
                </Path>
                <Path
                  ref={l1i}
                  data={l1iPathData}
                  fill={color}
                  opacity={0}
                  width={l1HalfBottom}
                  height={layerHeight}
                  stroke={color}
                  lineWidth={cornerRadius * 2}
                  lineJoin={"round"}
                  layout
                  direction={"column"}
                  alignItems={"center"}
                  justifyContent={"center"}
                >
                  <Txt
                    marginLeft={-40}
                    text={"L1I"}
                    fill={"#242424"}
                    fontSize={fontSize}
                    fontFamily={"JetBrains Mono, monospace"}
                    fontWeight={700}
                  />
                </Path>
              </Layout>
            );
          }

          const shapeRef = createRef<Path>();
          pyramid.push(shapeRef);

          const textIndex = i === 0 ? 0 : i - 1;

          const currentTopY = i * (layerHeight + gapSize);
          const currentBottomY = currentTopY + layerHeight;

          const topWidth = startWidth + currentTopY * widthIncrement;
          const bottomWidth = startWidth + currentBottomY * widthIncrement;

          const h = layerHeight;
          const halfTop = topWidth / 2;
          const halfBottom = bottomWidth / 2;

          const pathData = `
            M ${-halfTop} ${-h / 2}
            L ${halfTop} ${-h / 2}
            L ${halfBottom} ${h / 2}
            L ${-halfBottom} ${h / 2}
            Z
          `;

          return (
            <Path
              ref={shapeRef}
              data={pathData}
              fill={color}
              opacity={0}
              width={bottomWidth}
              height={layerHeight}
              stroke={color}
              lineWidth={cornerRadius * 2}
              lineJoin={"round"}
              layout
              direction={"column"}
              alignItems={"center"}
              justifyContent={"center"}
            >
              <Txt
                text={`${pyramidTexts[textIndex]}`}
                fill={"#242424"}
                fontSize={fontSize}
                fontFamily={"JetBrains Mono, monospace"}
                fontWeight={700}
              />
            </Path>
          );
        })}
      </Layout>
      <Layout layout direction={"column"} gap={gapSize} alignItems={"center"}>
        <CubicBezier
          ref={costArrow}
          lineWidth={6}
          stroke={"#669BBC"}
          p0={[0, 0]}
          p1={[0, 0]}
          p2={[0, (levels - 1) * gapSize + levels * layerHeight]}
          p3={[0, (levels - 1) * gapSize + levels * layerHeight]}
          arrowSize={16}
          end={0}
          endArrow
        />
        <Txt
          ref={costArrowTxt}
          text={"slower\nless expensive\nbigger"}
          fill={"#DAD2BC"}
          fontSize={fontSize}
          fontFamily={"JetBrains Mono, monospace"}
          fontWeight={700}
          opacity={0}
        />
      </Layout>
    </Layout>,
  );

  const allShapes = [
    pyramid[0], // Reg
    l1d, // L1D
    l1i, // L1I
    ...pyramid.slice(1), // L2, L3, RAM, Disk
  ];

  yield* sequence(0.3, ...allShapes.map((shape) => shape().opacity(1, 1.2)));

  yield* chain(
    // Reg (level 0)
    chain(
      all(
        pyramid[0]().scale(1.05, 1.0),
        pyramid[0]().fill("#F5F1ED", 1.0),
        pyramid[0]().stroke("#F5F1ED", 1.0),
      ),
      waitUntil(`level intro 0`),
      all(
        pyramid[0]().scale(1.0, 1.0),
        pyramid[0]().fill("#DAD2BC", 1.0),
        pyramid[0]().stroke("#DAD2BC", 1.0),
      ),
    ),
    // L1D + L1I (level 1)
    chain(
      all(
        l1d().scale(1.05, 1.0),
        l1d().fill("#F5F1ED", 1.0),
        l1d().stroke("#F5F1ED", 1.0),
        l1i().scale(1.05, 1.0),
        l1i().fill("#F5F1ED", 1.0),
        l1i().stroke("#F5F1ED", 1.0),
      ),
      waitUntil(`level intro 1`),
      all(
        l1d().scale(1.0, 1.0),
        l1d().fill("#DAD2BC", 1.0),
        l1d().stroke("#DAD2BC", 1.0),
        l1i().scale(1.0, 1.0),
        l1i().fill("#DAD2BC", 1.0),
        l1i().stroke("#DAD2BC", 1.0),
      ),
    ),
    // L2, L3, RAM, Disk (levels 2-5)
    ...pyramid
      .slice(1)
      .map((shape, i) =>
        chain(
          all(
            shape().scale(1.05, 1.0),
            shape().fill("#F5F1ED", 1.0),
            shape().stroke("#F5F1ED", 1.0),
          ),
          waitUntil(`level intro ${i + 2}`),
          all(
            shape().scale(1.0, 1.0),
            shape().fill("#DAD2BC", 1.0),
            shape().stroke("#DAD2BC", 1.0),
          ),
        ),
      ),
  );

  const stream = createRef<ImageStream>();
  view.add(<ImageStream ref={stream} images={[l4CacheJpg]} scale={0.85} />);
  yield* stream().flyIn();
  yield* waitUntil("SLC LLC L4 level intro");
  yield* stream().flyOut();

  yield* sequence(
    0.5,
    speedArrow().end(1, 1.0),
    speedArrowTxt().opacity(1, 1.0),
  );
  yield* sequence(0.5, costArrow().end(1, 1.0), costArrowTxt().opacity(1, 1.0));
});
