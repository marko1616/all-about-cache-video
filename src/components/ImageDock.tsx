import { Layout, Img, Spline, Rect, LayoutProps } from "@motion-canvas/2d";
import { all, waitFor, chain } from "@motion-canvas/core/lib/flow";
import {
  createRef,
  map,
  Reference,
  tween,
  easeOutBack,
  easeInBack,
  easeInOutCubic,
  easeOutCubic,
} from "@motion-canvas/core";

const DOCKER_SCALE = 0.4;
const FOCUS_SCALE = 1.0;
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
  rangeScale: number;
}

interface ImageContainer {
  layout: Reference<Layout>;
  img: Reference<Img>;
  overlay: Reference<Rect>;
}

export class ImageDock extends Layout {
  private readonly spline = createRef<Spline>();
  private readonly containers: ImageContainer[] = [];
  private readonly imageUrls: string[];
  private readonly rangeScale: number;

  constructor(props: ImageDockProps) {
    super(props);
    this.imageUrls = props.images;
    this.rangeScale = props.rangeScale;
    this.containers = this.imageUrls.map(() => ({
      layout: createRef<Layout>(),
      img: createRef<Img>(),
      overlay: createRef<Rect>(),
    }));

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
            <Layout
              key={`container-${index}`}
              ref={this.containers[index].layout}
              scale={0}
            >
              <Img ref={this.containers[index].img} src={src} />
              <Rect
                ref={this.containers[index].overlay}
                fill="black"
                opacity={0}
                size={() => {
                  const img = this.containers[index].img();
                  return [img.width(), img.height()];
                }}
              />
            </Layout>
          ))}
        </Layout>
      </>,
    );
  }

  public *intro() {
    const targetPoints = getDistributionPoints(
      this.containers.length,
      0.5 - this.rangeScale,
      0.5 + this.rangeScale,
    );

    yield* all(
      ...this.containers.map((container, index) => {
        const targetT = targetPoints[index];
        return (function* (that) {
          yield* waitFor(index * 0.2);
          yield* tween(1.6, (value) => {
            const eased = easeOutBack(value);
            const currentT = map(0, targetT, eased);
            const transform = getCurveTransform(that.spline(), currentT);

            container.layout().position(transform.position);
            container.layout().rotation(transform.rotation);
            container.layout().scale(map(0, DOCKER_SCALE, eased));
            container.layout().opacity(1);
          });
        })(this);
      }),
    );
  }

  public *focus(focusIndex: number, duration: number = 1.6) {
    const focusContainer = this.containers[focusIndex];
    const otherContainers = this.containers.filter((_, i) => i !== focusIndex);
    const newDockPoints = getDistributionPoints(
      otherContainers.length,
      0.5 - this.rangeScale,
      0.5 + this.rangeScale,
    );
    const currentPos = focusContainer.layout().position();

    const overshootY = -800;
    const shrinkScale = DOCKER_SCALE * 0.7;

    const phase1Duration = duration * 0.35;
    const phase2Duration = duration * 0.65;

    yield* all(
      chain(
        all(
          focusContainer
            .layout()
            .position(
              [currentPos.x, currentPos.y + overshootY],
              phase1Duration,
              easeOutCubic,
            ),
          focusContainer
            .layout()
            .scale(shrinkScale, phase1Duration, easeOutCubic),
          focusContainer.layout().rotation(0, phase1Duration, easeOutCubic),
        ),
        (function* () {
          focusContainer.layout().zIndex(100);
        })(),
        all(
          focusContainer.layout().position([0, 0], phase2Duration, easeOutBack),
          focusContainer
            .layout()
            .scale(FOCUS_SCALE, phase2Duration, easeOutBack),
        ),
      ),

      ...otherContainers.map((container, i) => {
        const targetT = newDockPoints[i];
        const transform = getCurveTransform(this.spline(), targetT);

        container.layout().zIndex(i);

        return all(
          container
            .layout()
            .position(transform.position, duration, easeInOutCubic),
          container
            .layout()
            .rotation(transform.rotation, duration, easeInOutCubic),
          container.layout().scale(DOCKER_SCALE, duration, easeInOutCubic),
          container.overlay().opacity(0.5, duration, easeInOutCubic),
        );
      }),
    );
  }

  public *unfocus(duration: number = 1.6) {
    const targetPoints = getDistributionPoints(
      this.containers.length,
      0.5 - this.rangeScale,
      0.5 + this.rangeScale,
    );

    const focusedIndex = this.containers.findIndex(
      (container) => container.layout().zIndex() === 100,
    );

    const overshootY = 0;
    const shrinkScale = DOCKER_SCALE * 0.7;

    const phase1Duration = duration * 0.35;
    const phase2Duration = duration * 0.65;

    if (focusedIndex !== -1) {
      const focusedContainer = this.containers[focusedIndex];
      const otherContainers = this.containers.filter(
        (_, i) => i !== focusedIndex,
      );

      const targetT = targetPoints[focusedIndex];
      const targetTransform = getCurveTransform(this.spline(), targetT);

      yield* all(
        chain(
          all(
            focusedContainer
              .layout()
              .position([0, overshootY], phase1Duration, easeOutCubic),
            focusedContainer
              .layout()
              .scale(shrinkScale, phase1Duration, easeOutCubic),
          ),
          (function* () {
            focusedContainer.layout().zIndex(focusedIndex);
          })(),
          all(
            focusedContainer
              .layout()
              .position(targetTransform.position, phase2Duration, easeOutBack),
            focusedContainer
              .layout()
              .rotation(targetTransform.rotation, phase2Duration, easeOutBack),
            focusedContainer
              .layout()
              .scale(DOCKER_SCALE, phase2Duration, easeOutBack),
          ),
        ),

        ...otherContainers.map((container, i) => {
          const originalIndex = this.containers.indexOf(container);
          const targetT = targetPoints[originalIndex];
          const transform = getCurveTransform(this.spline(), targetT);

          container.layout().zIndex(originalIndex);

          return all(
            container
              .layout()
              .position(transform.position, duration, easeInOutCubic),
            container
              .layout()
              .rotation(transform.rotation, duration, easeInOutCubic),
            container.layout().scale(DOCKER_SCALE, duration, easeInOutCubic),
            container.overlay().opacity(0, duration, easeInOutCubic),
          );
        }),
      );
    } else {
      yield* all(
        ...this.containers.map((container, index) => {
          const targetT = targetPoints[index];
          const transform = getCurveTransform(this.spline(), targetT);

          container.layout().zIndex(index);

          return all(
            container
              .layout()
              .position(transform.position, duration, easeInOutCubic),
            container
              .layout()
              .rotation(transform.rotation, duration, easeInOutCubic),
            container.layout().scale(DOCKER_SCALE, duration, easeInOutCubic),
            container.overlay().opacity(0, duration, easeInOutCubic),
          );
        }),
      );
    }
  }

  public *exit() {
    const startPoints = getDistributionPoints(
      this.containers.length,
      0.5 - this.rangeScale,
      0.5 + this.rangeScale,
    );

    yield* all(
      ...this.containers.map((container, index) => {
        const startT = startPoints[index];

        return (function* (that) {
          yield* waitFor((that.containers.length - 1 - index) * 0.2);

          yield* tween(1.6, (value) => {
            const eased = easeInBack(value);

            const currentT = map(startT, 0, eased);
            const transform = getCurveTransform(that.spline(), currentT);

            container.layout().position(transform.position);
            container.layout().rotation(transform.rotation);
            container.layout().scale(map(DOCKER_SCALE, 0, eased));
          });
        })(this);
      }),
    );
  }
}
