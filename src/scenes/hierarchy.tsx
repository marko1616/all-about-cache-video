import { CubicBezier, Layout, Path, Txt, makeScene2D } from '@motion-canvas/2d';
import { chain, all, sequence, waitUntil } from '@motion-canvas/core/lib/flow';
import { createRef, Reference } from '@motion-canvas/core';

import { overlayTransition } from '../transitions/overlayTransition';

export default makeScene2D(function* (view) {
  yield* overlayTransition("Chapter One - Hierarchy");

  const pyramid: Reference<Path>[] = [];
  const pyramidTexts: string[] = ["Reg", "L1 Cache", "L2 Cache", "L3 Cache", "RAM", "Disk"];
  const levels = 6;
  const layerHeight = 160;
  const gapSize = 60;
  const startWidth = 5;
  const widthIncrement = 1.2;
  const color = '#DAD2BC';
  const cornerRadius = 20;
  const fontSize = 48;

  const costArrow = createRef<CubicBezier>();
  const speedArrow = createRef<CubicBezier>();
  const costArrowTxt = createRef<Txt>();
  const speedArrowTxt = createRef<Txt>();

  view.add(
    <Layout
      layout
      alignItems={'center'}
      gap={gapSize + cornerRadius}
    >
      <Layout
        layout
        direction={'column'}
        gap={gapSize}
        alignItems={'center'}
      >
        <Txt
          ref={speedArrowTxt}
          text={'faster\nmore expensive\nsmaller'}
          fill={'#DAD2BC'}
          fontSize={fontSize}
          fontFamily={'JetBrains Mono, monospace'}
          fontWeight={700}
          opacity={0}
        />
        <CubicBezier
          ref={speedArrow}
          lineWidth={6}
          stroke={'#669BBC'}
          p0={[0, (levels - 1) * gapSize + levels * layerHeight]}
          p1={[0, (levels - 1) * gapSize + levels * layerHeight]}
          p2={[0, 0]}
          p3={[0, 0]}
          arrowSize={16}
          end={0}
          endArrow
        />
      </Layout>
      <Layout
        layout
        direction={'column'}
        gap={gapSize}
        alignItems={'center'}
      >
        {Array.from({ length: levels }).map((_, i) => {
          const shapeRef = createRef<Path>();
          pyramid.push(shapeRef);

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
              lineJoin={'round'}
              layout
              direction={'column'}
              alignItems={'center'}
              justifyContent={'center'}
            >
              <Txt
                text={`${pyramidTexts[i]}`}
                fill={'#242424'}
                fontSize={fontSize}
                fontFamily={'JetBrains Mono, monospace'}
                fontWeight={700}
              />
            </Path>
          );
        })}
      </Layout>
      <Layout
        layout
        direction={'column'}
        gap={gapSize}
        alignItems={'center'}
      >
        <CubicBezier
          ref={costArrow}
          lineWidth={6}
          stroke={'#669BBC'}
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
          text={'slower\nless expensive\nbigger'}
          fill={'#DAD2BC'}
          fontSize={fontSize}
          fontFamily={'JetBrains Mono, monospace'}
          fontWeight={700}
          opacity={0}
        />
      </Layout>
    </Layout>
  );

  yield* sequence(
    0.3,
    ...pyramid.map(shape => shape().opacity(1, 1.2))
  );

  yield* chain(
    ...pyramid.map((shape, i) =>
      chain(
        all(
          shape().scale(1.05, 1.0),
          shape().fill("#F5F1ED", 1.0),
          shape().stroke("#F5F1ED", 1.0)
        ),
        waitUntil(`level intro ${i}`),
        all(
          shape().scale(1.00, 1.0),
          shape().fill("#DAD2BC", 1.0),
          shape().stroke("#DAD2BC", 1.0)
        )
      )
    )
  );

  yield* sequence(0.5, speedArrow().end(1, 1.0), speedArrowTxt().opacity(1, 1.0))
  yield* sequence(0.5, costArrow().end(1, 1.0), costArrowTxt().opacity(1, 1.0))
});