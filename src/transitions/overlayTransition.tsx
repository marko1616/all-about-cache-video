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
  const size = useScene().getSize();
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
    fill: "#363636",
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
