import {
  Img,
  Spline,
  Rect,
  Node,
  NodeProps,
  initial,
  signal,
} from '@motion-canvas/2d';
import {
  all,
  createRef,
  sequence,
  useRandom,
  Reference,
  tween,
  easeOutExpo,
  map,
  SimpleSignal,
  ColorSignal,
  PossibleColor,
} from '@motion-canvas/core';
import { generateStraightPathPoints } from '../utils/PathUtils';

export interface ImageStreamProps extends NodeProps {
  /** List of image sources to display. */
  images: string[];
  /** Duration of the fly-in animation for a single image. */
  flyDuration?: number;
  /** Time interval between emitting images. */
  interval?: number;

  /** Target scale for the images. Defaults to 1. */
  imageScale?: number;
  /** Background color of the rectangle. */
  rectFill?: PossibleColor;
  /** Border color of the rectangle. */
  borderColor?: PossibleColor;
}

/**
 * Internal interface to store references for each image object.
 */
interface StreamItem {
  rect: Reference<Rect>;
  spline: Reference<Spline>;
  targetRotation: number;
  startRotation: number;
}

export class ImageStream extends Node {
  @initial(1)
  @signal()
  public declare readonly imageScale: SimpleSignal<number, this>;

  @initial('white')
  @signal()
  public declare readonly rectFill: ColorSignal<this>;

  @initial('white')
  @signal()
  public declare readonly borderColor: ColorSignal<this>;

  private readonly items: StreamItem[] = [];
  private readonly flyDuration: number;
  private readonly interval: number;

  public constructor(props: ImageStreamProps) {
    super(props);
    this.flyDuration = props.flyDuration ?? 1.5;
    this.interval = props.interval ?? 0.1;

    const random = useRandom();

    props.images.forEach((src) => {
      const rectRef = createRef<Rect>();
      const splineRef = createRef<Spline>();
 
      const targetRotation = random.nextInt(-5, 5);
      const startRotation = targetRotation + random.nextInt(-25, 25);

      const points = generateStraightPathPoints(random);

      this.add(
        <>
          <Spline
            ref={splineRef}
            points={points}
            opacity={0}
          />
          <Rect
            ref={rectRef}
            layout
            padding={0}
            clip
            radius={15}
            lineWidth={6}
            stroke={this.borderColor}
            fill={this.rectFill}
            opacity={0}
            position={points[0]}
            rotation={startRotation}
            alignItems={'center'}
            justifyContent={'center'}
          >
            <Img
              src={src}
            />
          </Rect>
        </>
      );

      this.items.push({
        rect: rectRef,
        spline: splineRef,
        targetRotation,
        startRotation
      });
    });
  }

  public *flyIn() {
    const targetScale = this.imageScale();
    const startScale = targetScale * 0.4;

    yield* sequence(
      this.interval,
      ...this.items.map((item) => {
        const r = item.rect();
        const s = item.spline();
   
        r.opacity(1);
        r.scale(startScale);

        return all(
          tween(this.flyDuration, value => {
            const eased = easeOutExpo(value);
            const point = s.getPointAtPercentage(eased);
            r.position(point.position);
          }),

          tween(this.flyDuration, value => {
            const eased = easeOutExpo(value);
            r.rotation(map(item.startRotation, item.targetRotation, eased));
          }),

          tween(this.flyDuration, value => {
            const eased = easeOutExpo(value);
            r.scale(map(startScale, targetScale, eased));
          })
        );
      })
    );
  }

  public *flyOut() {
    const startScale = this.imageScale();

    yield* sequence(
      this.interval,
      ...this.items.map((item) => {
        const r = item.rect();
   
        return all(
          tween(this.flyDuration, value => {
            // Using easeInExpo for flyOut often looks better (accelerating out),
            // but easeOutExpo matches the flyIn style.
            const eased = easeOutExpo(value);
       
            // Scale down to 0
            r.scale(map(startScale, 0, eased));
       
            // Fade out
            r.opacity(map(1, 0, eased));
       
            // Add a small rotation effect on exit (e.g., -20 degrees relative to current)
            r.rotation(map(item.targetRotation, item.targetRotation - 20, eased));
          })
        );
      })
    );
  }
}
