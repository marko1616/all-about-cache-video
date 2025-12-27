import { Rect, RectProps, initial, signal } from '@motion-canvas/2d';
import { Vector2, SignalValue, SimpleSignal } from '@motion-canvas/core'

export interface HighlightMarkerProps extends RectProps {
  points?: SignalValue<Vector2[] | number[][]>;
  progress?: SignalValue<number>;
}

export class HighlightMarker extends Rect {
  @signal()
  public declare readonly progress: SimpleSignal<number, this>;

  @initial([])
  @signal()
  public declare readonly points: SimpleSignal<Vector2[] | number[][], this>;

  public constructor(props?: HighlightMarkerProps) {
    super({
      fill: '#ffc66d',
      opacity: 0.8,
      radius: 4,
      ...props,
    });
    this.offset([-1, 1]);

    this.position(() => {
      const pts = this.points();
      if (!pts || pts.length < 2) return [0, 0];
   
      const p1 = new Vector2(pts[0] as [number, number]);
      const p2 = new Vector2(pts[1] as [number, number]);
      return [Math.min(p1.x, p2.x), Math.max(p1.y, p2.y)];
    });

    this.height(() => {
      const pts = this.points();
      if (!pts || pts.length < 2) return 0;

      const p1 = new Vector2(pts[0] as [number, number]);
      const p2 = new Vector2(pts[1] as [number, number]);

      return Math.abs(p1.y - p2.y);
    });

    this.width(() => {
      const pts = this.points();
      if (!pts || pts.length < 2) return 0;

      const p1 = new Vector2(pts[0] as [number, number]);
      const p2 = new Vector2(pts[1] as [number, number]);

      const totalWidth = Math.abs(p1.x - p2.x);
      return totalWidth * this.progress();
    });
  }
}
