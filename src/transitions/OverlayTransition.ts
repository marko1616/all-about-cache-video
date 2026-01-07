import {
  ThreadGenerator,
  useScene,
  useTransition,
  all,
  createSignal,
  easeInOutCubic,
  delay,
  waitFor,
  Vector2,
} from "@motion-canvas/core";

import { Rect, Txt } from "@motion-canvas/2d";

/**
 * A custom transition that sequentially slides colored overlays and a title screen over the scene.
 *
 * @param title - The text to display on the main title layer during the transition.
 * @param duration - The duration of each individual slide animation in seconds. Default is 0.6s.
 */
export function* overlayTransition(
  title: string,
  duration: number = 1.2,
): ThreadGenerator {
  const size = useScene().getRealSize();
  const hiddenX = size.x;

  const blueX = createSignal(hiddenX);
  const yellowX = createSignal(hiddenX);
  const readX = createSignal(hiddenX);
  const mainX = createSignal(hiddenX);
  const previousOnTop = createSignal(true);

  const blueOverlay = new Rect({
    width: size.x,
    height: size.y,
    fill: "#1446a0",
  });
  const yellowOverlay = new Rect({
    width: size.x,
    height: size.y,
    fill: "#f5d547",
  });
  const readOverlay = new Rect({
    width: size.x,
    height: size.y,
    fill: "#db3069",
  });
  const mainOverlay = new Rect({
    width: size.x,
    height: size.y,
    fill: "#242424",
  });

  const titleTxt = new Txt({
    text: title,
    fill: "#F5F1ED",
    fontFamily: "Roboto",
    fontSize: 80,
    fontWeight: 700,
  });
  mainOverlay.add(titleTxt);

  const drawOverlays = (ctx: CanvasRenderingContext2D) => {
    ctx.save();
    ctx.translate(size.x / 2, size.y / 2);

    blueOverlay.position(new Vector2(blueX(), 0));
    blueOverlay.render(ctx);

    yellowOverlay.position(new Vector2(yellowX(), 0));
    yellowOverlay.render(ctx);

    readOverlay.position(new Vector2(readX(), 0));
    readOverlay.render(ctx);

    mainOverlay.position(new Vector2(mainX(), 0));
    mainOverlay.render(ctx);

    ctx.restore();
  };

  const clipScene = (ctx: CanvasRenderingContext2D) => {
    const blueLeftEdge = blueX() - size.x / 2;
    const screenLeft = -size.x / 2;
    const clipWidth = Math.max(0, blueLeftEdge - screenLeft);

    ctx.beginPath();
    ctx.save();
    ctx.translate(size.x / 2, size.y / 2);
    ctx.rect(screenLeft, -size.y / 2, clipWidth + 1, size.y);
    ctx.restore();
    ctx.clip();
  };

  const endTransition = useTransition(
    (ctx) => {
      if (previousOnTop()) {
        ctx.globalAlpha = 0;
      } else {
        drawOverlays(ctx);
        clipScene(ctx);
      }
    },
    (ctx) => {
      if (previousOnTop()) {
        drawOverlays(ctx);
        clipScene(ctx);
      } else {
        ctx.globalAlpha = 0;
      }
    },
    previousOnTop,
  );

  // Slide In
  yield* all(
    blueX(0, duration, easeInOutCubic),
    delay(0.1, yellowX(0, duration, easeInOutCubic)),
    delay(0.2, readX(0, duration, easeInOutCubic)),
    delay(0.3, mainX(0, duration, easeInOutCubic)),
  );

  previousOnTop(false);

  // Hold
  yield* waitFor(1.0);

  // Slide Out
  yield* all(
    mainX(hiddenX, duration, easeInOutCubic),
    delay(0.1, readX(hiddenX, duration, easeInOutCubic)),
    delay(0.2, yellowX(hiddenX, duration, easeInOutCubic)),
    delay(0.3, blueX(hiddenX, duration, easeInOutCubic)),
  );

  endTransition();
}

/**
 * A custom transition with overlays sliding from top and bottom.
 * Colored bars slide in vertically, then a main overlay covers the center.
 * On exit, the main overlay slides out, then colored bars slide out horizontally.
 *
 * @param title - The text to display on the center overlay.
 * @param barTitleIn - The text to display on the colored bars during slide in. Defaults to title if not provided.
 * @param barTitleOut - The text to display on the colored bars during slide out. Defaults to barTitleIn if not provided.
 * @param coverPercent - How much of the screen each colored overlay covers (0-0.5).
 * @param duration - The duration of each individual slide animation in seconds.
 */
export function* verticalOverlayTransition(
  title: string,
  barTitleIn: string = "",
  barTitleOut: string = "",
  coverPercent: number = 0.3,
  duration: number = 1.2,
): ThreadGenerator {
  const size = useScene().getRealSize();
  coverPercent = Math.max(0, Math.min(0.5, coverPercent));

  // Determine the text to show on bars (with fallback chain)
  const effectiveBarTitleIn = barTitleIn === "" ? title : barTitleIn;
  const effectiveBarTitleOut =
    barTitleOut === "" ? effectiveBarTitleIn : barTitleOut;

  // Signal to track current bar text (switches during transition)
  const currentBarTitle = createSignal(effectiveBarTitleIn);

  const colorOverlayHeight = size.y * coverPercent;
  const mainOverlayHeight = size.y / 2;
  const fontSize = 60;
  const textGap = 40;
  const textColor = "#F5F1ED";

  // Hidden positions (off-screen)
  const topColorHiddenY = -size.y / 2 - colorOverlayHeight / 2;
  const bottomColorHiddenY = size.y / 2 + colorOverlayHeight / 2;
  const topMainHiddenY = -size.y / 2 - mainOverlayHeight / 2;
  const bottomMainHiddenY = size.y / 2 + mainOverlayHeight / 2;

  // Visible positions (on-screen)
  const topColorVisibleY = -size.y / 2 + colorOverlayHeight / 2;
  const bottomColorVisibleY = size.y / 2 - colorOverlayHeight / 2;
  const topMainVisibleY = -size.y / 4 + 1;
  const bottomMainVisibleY = size.y / 4 - 1;

  // Y position signals
  const topBlueY = createSignal(topColorHiddenY);
  const topYellowY = createSignal(topColorHiddenY);
  const topRedY = createSignal(topColorHiddenY);
  const bottomBlueY = createSignal(bottomColorHiddenY);
  const bottomYellowY = createSignal(bottomColorHiddenY);
  const bottomRedY = createSignal(bottomColorHiddenY);
  const topMainY = createSignal(topMainHiddenY);
  const bottomMainY = createSignal(bottomMainHiddenY);

  // X position signals (for exit animation)
  const topBlueX = createSignal(0);
  const topYellowX = createSignal(0);
  const topRedX = createSignal(0);
  const bottomBlueX = createSignal(0);
  const bottomYellowX = createSignal(0);
  const bottomRedX = createSignal(0);

  const previousOnTop = createSignal(true);
  const showCenterTitle = createSignal(false);
  const centerTitleOpacity = createSignal(0);

  const createBar = (fill: string, height: number) => {
    return new Rect({ width: size.x, height, fill });
  };

  const topBlueOverlay = createBar("#1446a0", colorOverlayHeight);
  const topYellowOverlay = createBar("#f5d547", colorOverlayHeight);
  const topRedOverlay = createBar("#db3069", colorOverlayHeight);
  const bottomBlueOverlay = createBar("#1446a0", colorOverlayHeight);
  const bottomYellowOverlay = createBar("#f5d547", colorOverlayHeight);
  const bottomRedOverlay = createBar("#db3069", colorOverlayHeight);
  const topMainOverlay = createBar("#242424", mainOverlayHeight + 2);
  const bottomMainOverlay = createBar("#242424", mainOverlayHeight + 2);

  // Center title remains using the original `title`
  const centerTitleTxt = new Txt({
    text: title,
    fill: textColor,
    fontSize: 80,
    fontWeight: 700,
  });

  const calculateTextPositions = (textWidth: number): number[] => {
    const positions: number[] = [];
    const totalTextWidth = textWidth + textGap;
    const copies = Math.ceil((size.x * 2) / totalTextWidth) + 2;
    const startX = -((copies * totalTextWidth) / 2) + totalTextWidth / 2;
    for (let i = 0; i < copies; i++) {
      positions.push(startX + i * totalTextWidth);
    }
    return positions;
  };

  const drawOverlays = (ctx: CanvasRenderingContext2D) => {
    ctx.save();
    ctx.translate(size.x / 2, size.y / 2);

    const drawRect = (obj: Rect, x: number, y: number) => {
      obj.position(new Vector2(x, y));
      obj.render(ctx);
    };

    const drawBarWithText = (
      bar: Rect,
      barX: number,
      barY: number,
      barHeight: number,
    ) => {
      drawRect(bar, barX, barY);
      ctx.save();
      ctx.beginPath();
      ctx.rect(barX - size.x / 2, barY - barHeight / 2, size.x, barHeight);
      ctx.clip();
      ctx.fillStyle = textColor;
      ctx.font = `700 ${fontSize}px Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Use current bar title and calculate positions dynamically
      const barText = currentBarTitle();
      const estimatedTextWidth = barText.length * fontSize * 0.6;
      const textPositions = calculateTextPositions(estimatedTextWidth);

      for (const textX of textPositions) {
        ctx.fillText(barText, barX + textX, barY);
      }
      ctx.restore();
    };

    drawBarWithText(topBlueOverlay, topBlueX(), topBlueY(), colorOverlayHeight);
    drawBarWithText(
      topYellowOverlay,
      topYellowX(),
      topYellowY(),
      colorOverlayHeight,
    );
    drawBarWithText(topRedOverlay, topRedX(), topRedY(), colorOverlayHeight);
    drawBarWithText(
      bottomBlueOverlay,
      bottomBlueX(),
      bottomBlueY(),
      colorOverlayHeight,
    );
    drawBarWithText(
      bottomYellowOverlay,
      bottomYellowX(),
      bottomYellowY(),
      colorOverlayHeight,
    );
    drawBarWithText(
      bottomRedOverlay,
      bottomRedX(),
      bottomRedY(),
      colorOverlayHeight,
    );

    drawRect(topMainOverlay, 0, topMainY());
    drawRect(bottomMainOverlay, 0, bottomMainY());

    if (showCenterTitle()) {
      ctx.save();
      ctx.globalAlpha = centerTitleOpacity();
      centerTitleTxt.position(new Vector2(0, 0));
      centerTitleTxt.render(ctx);
      ctx.restore();
    }

    ctx.restore();
  };

  const clipScene = (ctx: CanvasRenderingContext2D) => {
    const topCoverBottom = Math.max(
      topBlueY() + colorOverlayHeight / 2,
      topYellowY() + colorOverlayHeight / 2,
      topRedY() + colorOverlayHeight / 2,
      topMainY() + (mainOverlayHeight + 2) / 2,
    );
    const bottomCoverTop = Math.min(
      bottomBlueY() - colorOverlayHeight / 2,
      bottomYellowY() - colorOverlayHeight / 2,
      bottomRedY() - colorOverlayHeight / 2,
      bottomMainY() - (mainOverlayHeight + 2) / 2,
    );

    // 1. Center Gap Logic (Vertical phase)
    // Subtract 1px to prevent clipping artifacts when fully closed
    const gapHeight = Math.max(0, bottomCoverTop - topCoverBottom - 1);

    // 2. Horizontal Slide Logic
    // Find the furthest edge of the sliding bars to determine what is revealed
    const maxTopBarX = Math.max(topBlueX(), topYellowX(), topRedX());
    const minBottomBarX = Math.min(
      bottomBlueX(),
      bottomYellowX(),
      bottomRedX(),
    );

    // Top bars slide LEFT, revealing area on the RIGHT.
    // The bars cover up to: maxTopBarX + size.x / 2.
    const topRevealStart = maxTopBarX + size.x / 2;

    // Bottom bars slide RIGHT, revealing area on the LEFT.
    // The bars cover from: minBottomBarX - size.x / 2.
    const bottomRevealEnd = minBottomBarX - size.x / 2;

    ctx.beginPath();
    ctx.save();
    ctx.translate(size.x / 2, size.y / 2);

    // Draw Center Gap (Standard vertical reveal)
    ctx.rect(-size.x / 2, topCoverBottom + 0.5, size.x, gapHeight);

    // Draw Top Reveal (If bars have moved left)
    // Reveal from the right edge of the bars to the screen edge
    if (topRevealStart < size.x / 2) {
      const topH = topCoverBottom - -size.y / 2;
      // Extend height slightly (+2) to overlap with center gap and avoid hairline cracks
      if (topH > 0) {
        ctx.rect(
          topRevealStart,
          -size.y / 2,
          size.x / 2 - topRevealStart,
          topH + 2,
        );
      }
    }

    // Draw Bottom Reveal (If bars have moved right)
    // Reveal from the screen left edge to the left edge of the bars
    if (bottomRevealEnd > -size.x / 2) {
      const bottomH = size.y / 2 - bottomCoverTop;
      // Extend height slightly (+2) to overlap with center gap and avoid hairline cracks
      if (bottomH > 0) {
        ctx.rect(
          -size.x / 2,
          bottomCoverTop - 2,
          bottomRevealEnd - -size.x / 2,
          bottomH + 2,
        );
      }
    }

    ctx.restore();
    ctx.clip();
  };

  const endTransition = useTransition(
    (ctx) => {
      if (previousOnTop()) {
        ctx.globalAlpha = 0;
      } else {
        drawOverlays(ctx);
        clipScene(ctx);
      }
    },
    (ctx) => {
      if (previousOnTop()) {
        drawOverlays(ctx);
        clipScene(ctx);
      } else {
        ctx.globalAlpha = 0;
      }
    },
  );

  // === Slide In ===
  yield* all(
    topBlueY(topColorVisibleY, duration, easeInOutCubic),
    delay(0.1, topYellowY(topColorVisibleY, duration, easeInOutCubic)),
    delay(0.2, topRedY(topColorVisibleY, duration, easeInOutCubic)),
    bottomBlueY(bottomColorVisibleY, duration, easeInOutCubic),
    delay(0.1, bottomYellowY(bottomColorVisibleY, duration, easeInOutCubic)),
    delay(0.2, bottomRedY(bottomColorVisibleY, duration, easeInOutCubic)),
  );

  yield* all(
    topMainY(topMainVisibleY, duration, easeInOutCubic),
    bottomMainY(bottomMainVisibleY, duration, easeInOutCubic),
  );

  // === Title Fade In ===
  showCenterTitle(true);
  yield* centerTitleOpacity(1, 0.4, easeInOutCubic);

  previousOnTop(false);

  // === Hold ===
  yield* waitFor(0.6);

  // === Title Fade Out ===
  yield* centerTitleOpacity(0, 0.4, easeInOutCubic);
  showCenterTitle(false);

  // Switch bar text for slide out
  currentBarTitle(effectiveBarTitleOut);

  // === Slide Out ===
  yield* all(
    topMainY(topMainHiddenY, duration, easeInOutCubic),
    bottomMainY(bottomMainHiddenY, duration, easeInOutCubic),
  );

  const moveDuration = duration * 1.2;
  const targetLeft = -size.x;
  const targetRight = size.x;

  yield* all(
    topRedX(targetLeft, moveDuration, easeInOutCubic),
    delay(0.1, topYellowX(targetLeft, moveDuration, easeInOutCubic)),
    delay(0.2, topBlueX(targetLeft, moveDuration, easeInOutCubic)),
    bottomRedX(targetRight, moveDuration, easeInOutCubic),
    delay(0.1, bottomYellowX(targetRight, moveDuration, easeInOutCubic)),
    delay(0.2, bottomBlueX(targetRight, moveDuration, easeInOutCubic)),
  );

  endTransition();
}
