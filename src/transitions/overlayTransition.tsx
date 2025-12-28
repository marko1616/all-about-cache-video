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
} from '@motion-canvas/core';

import {
  Rect,
  Txt,
} from '@motion-canvas/2d';

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

  // Note: These nodes are detached (not added to the scene tree),
  // so we must manually handle their rendering in the transition hook.
  const blueOverlay = new Rect({
    width: size.x,
    height: size.y,
    fill: '#1446a0',
  });

  const yellowOverlay = new Rect({
    width: size.x,
    height: size.y,
    fill: '#f5d547',
  });

  const readOverlay = new Rect({
    width: size.x,
    height: size.y,
    fill: '#db3069',
  });

  const mainOverlay = new Rect({
    width: size.x,
    height: size.y,
    fill: '#363636',
  });

  const titleTxt = new Txt({
    text: title,
    fill: '#F5F1ED',
    fontFamily: 'Roboto',
    fontSize: 80,
    fontWeight: 700,
  });

  mainOverlay.add(titleTxt);

  const endTransition = useTransition(
    (ctx) => {
      // Save the context state before transformations
      ctx.save();
    
      // FIX: Translate the coordinate system origin from Top-Left to Center
      ctx.translate(size.x / 2, size.y / 2);

      // Now (0,0) is the center of the screen, just like in the Scene.
    
      blueOverlay.position(new Vector2(blueX(), 0));
      blueOverlay.render(ctx);

      yellowOverlay.position(new Vector2(yellowX(), 0));
      yellowOverlay.render(ctx);

      readOverlay.position(new Vector2(readX(), 0));
      readOverlay.render(ctx);

      mainOverlay.position(new Vector2(mainX(), 0));
      mainOverlay.render(ctx);

      // Restore context to avoid polluting other renders
      ctx.restore();
    },
    () => {
      // Previous scene remains static in the background
    },
  );

  // Slide In Sequence
  yield* all(
    blueX(0, duration, easeInOutCubic),
    delay(0.1, yellowX(0, duration, easeInOutCubic)),
    delay(0.2, readX(0, duration, easeInOutCubic)),
    delay(0.3, mainX(0, duration, easeInOutCubic)),
  );

  // Hold
  yield* waitFor(1.0);

  // Slide Out Sequence (Reverse order)
  yield* all(
    mainX(hiddenX, duration, easeInOutCubic),
    delay(0.1, readX(hiddenX, duration, easeInOutCubic)),
    delay(0.2, yellowX(hiddenX, duration, easeInOutCubic)),
    delay(0.3, blueX(hiddenX, duration, easeInOutCubic)),
  );

  endTransition();
}
