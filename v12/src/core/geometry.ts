export interface Vec2 { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }

export function pointInRect(p: Vec2, r: Rect): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

/** Keep a circle of `radius` inside `r`. Rooms are boxes you are inside of,
 *  so containment is the operation — not the usual push-out-of-an-obstacle. */
export function clampInside(p: Vec2, radius: number, r: Rect): Vec2 {
  return {
    x: Math.min(Math.max(p.x, r.x + radius), r.x + r.w - radius),
    y: Math.min(Math.max(p.y, r.y + radius), r.y + r.h - radius),
  };
}

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
