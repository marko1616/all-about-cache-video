import { Img, Layout, LayoutProps, initial, signal } from "@motion-canvas/2d";
import {
  Vector2,
  SimpleSignal,
  usePlayback,
  easeInOutCubic,
  easeOutBack,
  easeInBack,
} from "@motion-canvas/core";

export interface OrbitalBallProps extends LayoutProps {
  src: string;
  index: number;
  total?: number;
}

export class OrbitalBall extends Layout {
  @initial(0) @signal() declare public readonly progress: SimpleSignal<
    number,
    this
  >;
  @initial(0) @signal() declare public readonly rotation: SimpleSignal<
    number,
    this
  >;
  @initial(0) @signal() declare public readonly focusAmount: SimpleSignal<
    number,
    this
  >;

  private readonly orbitRadius = 600;
  private readonly entryDist = 4500;
  private readonly focusInwardOffset = 150;
  private readonly defocusOutwardOffset = 150;

  constructor(props: OrbitalBallProps) {
    super(props);
    const initialAngle = props.index * ((2 * Math.PI) / (props.total ?? 3));

    this.position(() => {
      const p = this.progress();
      const rot = this.rotation();
      const focus = this.focusAmount();

      const t = usePlayback().time;

      const noise = new Vector2(
        Math.sin(t * 1.5 + props.index) * 25,
        Math.cos(t * 1.2 + props.index) * 25,
      ).scale(p);

      const angle = initialAngle + rot;

      const radiusOffset =
        focus > 0
          ? -this.focusInwardOffset * focus
          : -this.defocusOutwardOffset * focus;

      const currentRadius = this.orbitRadius + radiusOffset;

      const target = new Vector2(
        Math.cos(angle) * currentRadius,
        Math.sin(angle) * currentRadius,
      ).add(noise);

      const start = new Vector2(
        Math.cos(initialAngle) * this.entryDist,
        Math.sin(initialAngle) * this.entryDist,
      );

      return start.lerp(target, p);
    });

    this.scale(() => {
      const focus = this.focusAmount();
      return 1 + focus * 0.5;
    });

    this.add(<Img src={props.src} width={this.width} height={this.height} />);
  }

  /**
   * Animate the ball flying into its orbital position
   */
  public *flyIn(duration: number) {
    yield* this.progress(1, duration, easeOutBack);
  }

  /**
   * Animate the ball flying out from its orbital position
   */
  public *flyOut(duration: number) {
    yield* this.progress(0, duration, easeInBack);
  }

  /**
   * Rotate the ball around the center
   */
  public *rotate(laps: number, duration: number) {
    yield* this.rotation(
      this.rotation() + Math.PI * 2 * laps,
      duration,
      easeInOutCubic,
    );
  }

  /**
   * Focus on this ball - moves it closer to center and scales it up
   */
  public *focus(duration: number) {
    yield* this.focusAmount(1, duration, easeInOutCubic);
  }

  /**
   * Defocus this ball - moves it away from center and scales it down
   */
  public *defocus(duration: number) {
    yield* this.focusAmount(-1, duration, easeInOutCubic);
  }

  /**
   * Reset focus state to neutral position
   */
  public *resetFocus(duration: number) {
    yield* this.focusAmount(0, duration, easeInOutCubic);
  }
}
