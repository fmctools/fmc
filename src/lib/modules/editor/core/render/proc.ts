// The procedural widgets on the canvas: the simulator's values turned into the histories the
// watch would have (proc-scene.ts says where everything goes), and the drawing of that.
//
// ponytail: the simulator holds one value per metric, so a day's history is a fixed wave around
// it up to the simulated hour, and the forecast and the night have fixed shapes. Edit them as
// series if a face ever has to be previewed against particular data.
import { CALORIES, CLIPS, PANELS, RINGS, type Proc } from "../document/proc";
import { idValue, type Sim, type SimValue, type TimeParts } from "../document/sources";
import type { Ctx, Drawable, Point, Size } from "./canvas";
import * as scene from "./proc-scene";

const NIGHT_END = 7 * 60;
/** Stage and its share of the night. */
const NIGHT: [kind: number, share: number][] = [
  [1, 0.15],
  [2, 0.2],
  [1, 0.15],
  [3, 0.15],
  [1, 0.15],
  [0, 0.05],
  [1, 0.15],
];

const day = (hour: number, fn: (h: number) => number[]) =>
  Array.from({ length: 24 }, (_, h) => (h <= hour ? fn(h) : [0, 0, 0, 0]));

/** An emptied field is "no data", unless an override pins the source. */
const empty = (field: SimValue, id: number, sim: Sim) =>
  field === "" && (sim.overrides[id] === undefined || sim.overrides[id] === "");

function items({ type, panel }: Proc, sim: Sim, t: TimeParts): scene.Item[] {
  const value = (id: number) => Math.round(idValue(id, sim, t));
  const clock = { hour: t.h, twelve: !sim.is24h };

  if (type === CALORIES) return scene.calories(Number(sim.calGoal), value(0x1c));
  if (type !== PANELS) return [];

  if (panel === 0) {
    const temp = value(0x5f);
    const none = empty(sim.temp, 0x5f, sim);
    const ahead = [
      [0, 1],
      [1, 1],
      [2, 2],
      [1, 3],
    ];

    return scene.weather(
      // the watch's card reads no further than the forecast's day
      ahead.map(([d, code], i) => (none || t.h + i >= 24 ? null : { temp: temp + d, code })),
      clock,
    );
  }
  if (panel === 1) {
    const v = value(0x1a);

    if (!v) return scene.heart([], 0, 0, clock);
    const hours = day(t.h, (h) => {
      const high = v + 4 + Math.round(22 * Math.abs(Math.sin(h * 1.7)));
      const low = Math.max(1, v - 4 - Math.round(12 * Math.abs(Math.cos(h * 1.3))));

      return [high, low, high, low];
    });
    const seen = hours.flat().filter(Boolean);

    return scene.heart(hours, Math.max(...seen), Math.min(...seen), clock);
  }
  if (panel === 2) {
    const v = value(0x1b);
    const hours = day(v ? t.h : -1, (h) => [Math.min(100, v + (h % 3 ? 0 : 1)), v - (h % 4)]);

    return scene.spo2(
      hours.map(([high, low]) => [high, low]),
      clock,
    );
  }
  if (panel === 3) {
    const v = value(0x8c);
    const hours = day(v ? t.h : -1, (h) => {
      const high = Math.min(100, v + Math.round(20 * Math.abs(Math.sin(h * 1.3))));

      return [high, Math.max(1, v - 10 - (h % 5))];
    });

    return scene.stress(hours, clock);
  }
  if (panel === 4) {
    const mins = value(0x46);

    if (mins <= 0) return scene.sleep(null);
    const start = (((NIGHT_END - mins) % 1440) + 1440) % 1440;

    return scene.sleep({
      start: start * 60,
      end: (start + mins) * 60,
      stages: NIGHT.map(([kind, share]) => ({ kind, seconds: Math.round(mins * 60 * share) })),
    });
  }
  return [];
}

const css565 = (c: number) =>
  `rgb(${((c >> 11) * 255) / 31} ${(((c >> 5) & 63) * 255) / 63} ${((c & 31) * 255) / 31})`;

/**
 * Draw a widget with its corner at `x`/`y`; `image` resolves an index of its list. Returns the
 * box of what was drawn, which is also what a click can hit: the widget's own box is the whole
 * screen, and five of them are stacked on one face.
 */
export function drawProc(
  ctx: Ctx | null,
  proc: Proc,
  x: number,
  y: number,
  sim: Sim,
  t: TimeParts,
  image: (index: number) => Drawable | undefined,
): (Point & Size) | null {
  if (proc.type === RINGS) {
    // the watch tests the touch against the screen's centre, wherever the widget is
    const ring = sim.touch ? scene.ringAt(sim.touch.x, sim.touch.y) : null;

    if (ring === null || !ctx) return null;
    const { at, size, color } = scene.ringBand(ring);

    ctx.save();
    ctx.strokeStyle = css565(color);
    ctx.lineWidth = scene.RING_W;
    ctx.beginPath();
    ctx.arc(x + at + size / 2, y + at + size / 2, (size - scene.RING_W) / 2, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.restore();
    return null; // no box: it would cover every layer under the finger
  }
  if (proc.type === CLIPS) {
    // with no tap yet: the end of the first clip, where the watch comes to rest
    const ms = sim.clipAt === null ? Infinity : Date.now() - sim.clipAt;
    const b = image(scene.frameAt(sim.clip, ms));

    if (!b) return null;
    ctx?.drawImage(b, x, y);
    return { x, y, w: b.width, h: b.height };
  }

  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;

  for (const it of items(proc, sim, t)) {
    const at = { x: x + it.x, y: y + it.y };
    let size: Size;

    if ("img" in it) {
      const b = image(it.img);

      if (!b) continue;
      size = { w: b.width, h: b.height };
      if (ctx && it.angle) {
        ctx.save();
        ctx.translate(at.x + size.w / 2, at.y + size.h / 2);
        ctx.rotate(((it.angle / 10) * Math.PI) / 180);
        ctx.drawImage(b, -size.w / 2, -size.h / 2);
        ctx.restore();
      } else ctx?.drawImage(b, at.x, at.y);
    } else {
      size = it;
      if (ctx) {
        ctx.save();
        ctx.fillStyle = css565(it.color);
        ctx.beginPath();
        ctx.roundRect(at.x, at.y, it.w, it.h, Math.min(it.radius, it.w / 2, it.h / 2));
        ctx.fill();
        ctx.restore();
      }
    }
    x0 = Math.min(x0, at.x);
    y0 = Math.min(y0, at.y);
    x1 = Math.max(x1, at.x + size.w);
    y1 = Math.max(y1, at.y + size.h);
  }
  return x1 > x0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}
