export type Point = { x: number; y: number };
export type ImageTransform = Point & { scale: number };
export type ImageBounds = { width: number; height: number; imageWidth?: number; imageHeight?: number };
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const midpoint = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
export function boundTransform(value: ImageTransform, bounds: ImageBounds): ImageTransform {
  const scale = Math.max(1, Math.min(4, value.scale));
  const x = Math.max(0, ((bounds.imageWidth ?? bounds.width) * scale - bounds.width) / 2);
  const y = Math.max(0, ((bounds.imageHeight ?? bounds.height) * scale - bounds.height) / 2);
  return { scale, x: Math.max(-x, Math.min(x, value.x)), y: Math.max(-y, Math.min(y, value.y)) };
}
/** Coordinates are relative to the image stage center. Kept outside React so
 * multi-touch updates and finger lifts never become accidental tap-to-close. */
export class ImageGesture {
  transform: ImageTransform = { scale: 1, x: 0, y: 0 };
  private pointers = new Map<number, Point>();
  private start: Point = { x: 0, y: 0 };
  private base = this.transform;
  private pinch?: { center: Point; distance: number };
  private multi = false;
  private moved = false;
  private rebase() {
    const [a, b] = [...this.pointers.values()];
    this.base = this.transform;
    if (a) this.start = a;
    this.pinch = a && b ? { center: midpoint(a, b), distance: Math.max(1, distance(a, b)) } : undefined;
  }
  down(id: number, point: Point) {
    if (!this.pointers.size) { this.multi = false; this.moved = false; }
    this.pointers.set(id, point);
    if (this.pointers.size > 1) this.multi = true;
    this.rebase();
  }
  move(id: number, point: Point, bounds: ImageBounds) {
    if (!this.pointers.has(id)) return;
    this.pointers.set(id, point);
    const [a, b] = [...this.pointers.values()];
    if (b && this.pinch) {
      const center = midpoint(a, b);
      const scale = Math.max(1, Math.min(4, this.base.scale * distance(a, b) / this.pinch.distance));
      const ratio = scale / this.base.scale;
      this.transform = boundTransform({ scale, x: center.x - (this.pinch.center.x - this.base.x) * ratio, y: center.y - (this.pinch.center.y - this.base.y) * ratio }, bounds);
    } else {
      if (distance(point, this.start) > 8) this.moved = true;
      if (this.base.scale > 1) this.transform = boundTransform({ scale: this.base.scale, x: this.base.x + point.x - this.start.x, y: this.base.y + point.y - this.start.y }, bounds);
    }
  }
  up(id: number, point: Point, bounds: ImageBounds): "tap" | "next" | "previous" | undefined {
    if (!this.pointers.has(id)) return;
    this.move(id, point, bounds);
    this.pointers.delete(id);
    if (this.pointers.size) { this.rebase(); return; }
    if (this.multi) return;
    if (!this.moved) return "tap";
    const dx = point.x - this.start.x, dy = point.y - this.start.y;
    if (this.base.scale === 1 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) return dx < 0 ? "next" : "previous";
  }
  cancel() { this.pointers.clear(); this.pinch = undefined; this.multi = true; }
  zoom(scale: number, bounds: ImageBounds) { this.transform = boundTransform({ scale, x: 0, y: 0 }, bounds); }
}
