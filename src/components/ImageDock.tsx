import { Layout, Img, Spline, LayoutProps } from "@motion-canvas/2d";
import { all, waitFor } from "@motion-canvas/core/lib/flow";
import {
  createRef,
  map,
  Reference,
  tween,
  easeOutBack,
  easeInBack,
  easeInOutCubic,
} from "@motion-canvas/core";

const DOCKER_SCALE = 0.4;
const FOCUS_SCALE = 1.65;
const DOCK_RANGE = [0.45, 0.55];
const ROTATION_RANGE = [-45, 45];

function getRotationByT(t: number) {
  return map(ROTATION_RANGE[0], ROTATION_RANGE[1], t);
}

function getCurveTransform(spline: Spline, t: number) {
  const position = spline.getPointAtPercentage(t).position;
  const rotation = getRotationByT(t);
  return { position, rotation };
}

function getDistributionPoints(
  count: number,
  start: number,
  end: number,
): number[] {
  if (count === 0) return [];
  if (count === 1) return [0.5];
  const step = (end - start) / (count - 1);
  return Array.from({ length: count }, (_, i) => start + step * i);
}

export interface ImageDockProps extends LayoutProps {
  images: string[];
}

export class ImageDock extends Layout {
  private readonly spline = createRef<Spline>();
  private readonly imageRefs: Reference<Img>[] = [];
  private readonly imageUrls: string[];

  constructor(props: ImageDockProps) {
    super(props);
    this.imageUrls = props.images;
    this.imageRefs = this.imageUrls.map(() => createRef<Img>());

    this.add(
      <>
        <Spline
          ref={this.spline}
          lineWidth={4}
          points={[
            [-1400, 1200],
            [0, 650],
            [1400, 1200],
          ]}
          smoothness={0.6}
          opacity={0}
        />
        <Layout>
          {this.imageUrls.map((src, index) => (
            <Img
              key={`${index}`}
              ref={this.imageRefs[index]}
              src={src}
              scale={0}
            />
          ))}
        </Layout>
      </>,
    );
  }

  public *intro() {
    const targetPoints = getDistributionPoints(
      this.imageRefs.length,
      DOCK_RANGE[0],
      DOCK_RANGE[1],
    );

    yield* all(
      ...this.imageRefs.map((ref, index) => {
        const targetT = targetPoints[index];
        return (function* (that) {
          yield* waitFor(index * 0.2);
          yield* tween(1.6, (value) => {
            const eased = easeOutBack(value);
            const currentT = map(0, targetT, eased);
            const transform = getCurveTransform(that.spline(), currentT);

            ref().position(transform.position);
            ref().rotation(transform.rotation);
            ref().scale(map(0, DOCKER_SCALE, eased));
            ref().opacity(1);
          });
        })(this);
      }),
    );
  }

  public *focus(focusIndex: number, duration: number = 1.6) {
    const focusRef = this.imageRefs[focusIndex];
    const otherRefs = this.imageRefs.filter((_, i) => i !== focusIndex);
    const newDockPoints = getDistributionPoints(
      otherRefs.length,
      DOCK_RANGE[0],
      DOCK_RANGE[1],
    );

    focusRef().zIndex(100);

    yield* all(
      focusRef().position([0, 0], duration, easeInOutCubic),
      focusRef().rotation(0, duration, easeInOutCubic),
      focusRef().scale(FOCUS_SCALE, duration, easeInOutCubic),
      focusRef().opacity(1, duration, easeInOutCubic),

      ...otherRefs.map((ref, i) => {
        const targetT = newDockPoints[i];
        const transform = getCurveTransform(this.spline(), targetT);

        ref().zIndex(i);

        return all(
          ref().position(transform.position, duration, easeInOutCubic),
          ref().rotation(transform.rotation, duration, easeInOutCubic),
          ref().opacity(0.5, duration, easeInOutCubic),
          ref().scale(DOCKER_SCALE, duration, easeInOutCubic),
        );
      }),
    );
  }

  public *unfocus(duration: number = 1.6) {
    const targetPoints = getDistributionPoints(
      this.imageRefs.length,
      DOCK_RANGE[0],
      DOCK_RANGE[1],
    );

    yield* all(
      ...this.imageRefs.map((ref, index) => {
        const targetT = targetPoints[index];
        const transform = getCurveTransform(this.spline(), targetT);

        ref().zIndex(index);

        return all(
          ref().position(transform.position, duration, easeInOutCubic),
          ref().rotation(transform.rotation, duration, easeInOutCubic),
          ref().scale(DOCKER_SCALE, duration, easeInOutCubic),
          ref().opacity(1, duration, easeInOutCubic),
        );
      }),
    );
  }

  public *exit() {
    const startPoints = getDistributionPoints(
      this.imageRefs.length,
      DOCK_RANGE[0],
      DOCK_RANGE[1],
    );

    yield* all(
      ...this.imageRefs.map((ref, index) => {
        const startT = startPoints[index];

        return (function* (that) {
          yield* waitFor((that.imageRefs.length - 1 - index) * 0.2);

          yield* tween(1.6, (value) => {
            const eased = easeInBack(value);

            const currentT = map(startT, 0, eased);
            const transform = getCurveTransform(that.spline(), currentT);

            ref().position(transform.position);
            ref().rotation(transform.rotation);
            ref().scale(map(DOCKER_SCALE, 0, eased));
          });
        })(this);
      }),
    );
  }
}
