// What the Watch 3 Pro's procedural widgets draw (tag 0x82 + 0x5c): type 4 (Rainbow Lollipop's
// rings), 5 (Briqbot's clips), 6 (DataPulse's five panels), 7 (Luminous Beam's calories).
//
// A port of cmf-watch-sdk's fw/wp2-core/src/wfproc.rs, which is what stub 10 draws on a Watch
// Pro 2 (MIT License, Copyright (c) 2026 Egor Kolesnikov), with that file's numbers as its tests
// (tests/proc-widgets.test.ts). Pure: numbers in, images and rectangles out. The stub reads the
// watch's memory; here the values come typed, from the simulator (proc.ts).

/** An image of the widget's list, or a rectangle. Colours are RGB565. */
export type Item =
  | {
      img: number;
      x: number;
      y: number;
      /** Tenths of a degree, clockwise around the image's centre. */
      angle?: number;
    }
  | { x: number; y: number; w: number; h: number; color: number; radius: number };

export interface Clock {
  hour: number;
  twelve: boolean;
}

/** An hour of the forecast, null with no value for it. */
export type Forecast = { temp: number; code: number } | null;

export interface Night {
  /** Seconds of the local day; `end` may run into the next one. */
  start: number;
  end: number;
  stages: readonly { kind: number; seconds: number }[];
}

export const GREY = 0x73ae;
export const WHITE = 0xffff;
/** By sleep stage, one row of the panel each. */
export const STAGES = [0xe71c, 0x73ae, 0x3186, 0xfa23];

// the panels inside the 466x466 widget
const PANEL_X = 11;
const TOP_Y = 2;
const LOW_Y = 293;
const PLOT_X = PANEL_X + 79;
const PLOT_Y = LOW_Y + 4;
const PLOT_H = 79;
const BOTTOM = PLOT_H - 1;
const HOURS = 24;
const BAR_W = 8;
const GLYPH_W = 14;

// image indices in the weather panel's list of 88
const ICONS = 0x1b;
const DIGIT = 0x1b;
const DEGREE = 0x25;
const MINUS = 0x26;
const NOW = 0x27;
const LABEL_12 = 0x28;
const LABEL_24 = 0x40;
// in the other panels' lists of 13
const AXIS_24 = 10;
const AXIS_12 = 11;
const DASH = 12;

const div = (a: number, b: number) => Math.trunc(a / b);
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** An hour's label: its image, and x in the column. */
export const hourLabel = (hour: number, twelve: boolean): [img: number, dx: number] =>
  twelve
    ? [LABEL_12 + hour, [0, 10, 11, 12, 22, 23].includes(hour) ? 0 : 7]
    : [LABEL_24 + hour, 17];

/** This hour and the next three, in Celsius. */
export function weather(values: readonly Forecast[], clock: Clock): Item[] {
  const out: Item[] = [];
  const y = TOP_Y + 49;

  values.forEach((value, i) => {
    const x = PANEL_X + 76 + 77 * i;
    const [label, dx] = i ? hourLabel((clock.hour + i) % HOURS, clock.twelve) : [NOW, 7];
    const code = value ? value.code : 0;

    out.push({ img: label, x: x + dx, y });
    out.push({ img: code >= 0 && code < ICONS ? code : 1, x: x + 17, y: y + 40 });

    const glyphs: number[] = [];

    if (value) {
      const t = clamp(Math.trunc(value.temp), -999, 999); // three digits fit the column

      if (t < 0) glyphs.push(MINUS);
      for (const d of String(Math.abs(t))) glyphs.push(DIGIT + Number(d));
    } else glyphs.push(MINUS, MINUS);

    // "--" is centred as one digit, which is what the watch does
    let gx = x + div(65 - GLYPH_W * (value ? glyphs.length : 1), 2);

    for (const img of glyphs) {
      out.push({ img, x: gx, y: y + 97 });
      gx += GLYPH_W;
    }
    out.push({ img: DEGREE, x: gx, y: y + 97 });
  });
  return out;
}

const axis = (clock: Clock): Item => ({
  img: clock.twelve ? AXIS_12 : AXIS_24,
  x: PANEL_X + 69,
  y: LOW_Y + 2,
});

/** One hour's bar: top and bottom are rows of the plot, at least `least` + 1 rows are drawn. */
function bar(clock: Clock, hour: number, from: number, to: number, least: number): Item {
  const top = Math.min(Math.max(from, 0), BOTTOM - least);
  const bottom = Math.min(Math.max(to, top + least), BOTTOM);

  return {
    x: PLOT_X + div(277 * hour, HOURS - 1),
    y: PLOT_Y + top,
    w: BAR_W,
    h: bottom - top + 1,
    color: hour === clock.hour ? WHITE : GREY,
    radius: BAR_W / 2,
  };
}

const upper = (v: number, min: number, max: number) =>
  PLOT_H - div((v - min) * PLOT_H, Math.max(max - min, 1));
const lower = (v: number, min: number, max: number) =>
  BOTTOM - div((v - min) * BOTTOM, Math.max(max - min, 1));

/** `hours`: two half hours each, max then min. `max` and `min` are the day's. */
export function heart(
  hours: readonly (readonly number[])[],
  max: number,
  min: number,
  clock: Clock,
): Item[] {
  const out = [axis(clock)];

  if (!max || !min) return out;
  hours.forEach(([max1, min1, max2, min2], h) => {
    const high = Math.max(max1, max2);

    if (!high) return;
    const low = !min1 ? min2 : !min2 ? min1 : Math.min(min1, min2);

    out.push(
      min === max
        ? bar(clock, h, upper(high, min - 30, max), 4, 4)
        : bar(clock, h, upper(high, min, max), lower(low, min, max), 1),
    );
  });
  return out;
}

/** `hours`: high then low. The day's range is computed from them. */
export function spo2(hours: readonly (readonly number[])[], clock: Clock): Item[] {
  const out = [axis(clock)];
  const seen = hours.flat().filter(Boolean);
  let min = Math.min(...seen),
    max = Math.max(...seen);

  // one value all day
  if (min >= max) [min, max] = [85, 99];
  hours.forEach(([high, low], h) => {
    if (!high) return;
    out.push(
      high < 90
        ? bar(clock, h, BOTTOM - 4, BOTTOM, 4)
        : bar(clock, h, upper(high, min, max), lower(low || high, min, max), 4),
    );
  });
  return out;
}

export function stress(hours: readonly (readonly number[])[], clock: Clock): Item[] {
  const out = [axis(clock)];

  hours.forEach(([high, low], h) => {
    if (high) out.push(bar(clock, h, upper(high, 0, 100), lower(low, 0, 100), 1));
  });
  return out;
}

export function sleep(night: Night | null): Item[] {
  const out: Item[] = [];
  const count = night?.stages.length ?? 0;

  if (night && count && count <= 50 && night.end > night.start) {
    const room = 284 - 2 * count; // the stages share 284 px with 2 px between them
    let x = 0;

    for (const { kind, seconds } of night.stages) {
      if (!seconds || x >= 284) continue;
      const w = Math.min(Math.max(div(room * seconds, night.end - night.start), 1), 284 - x);
      const known = kind in STAGES;

      out.push({
        x: PANEL_X + 80 + x,
        y: LOW_Y + 6 + 17 * (known ? kind : 0),
        w,
        h: 17,
        color: known ? STAGES[kind] : 0,
        radius: 0,
      });
      x += w + 2;
    }
  }
  for (const [time, xs] of [
    [night?.start ?? 0, [0x50, 0x60, 0x80, 0x92]],
    [night?.end ?? 0, [0x11e, 0x12e, 0x14e, 0x15e]],
  ] as const) {
    const h = div(time, 3600) % 24;
    const m = div(time, 60) % 60;

    [div(h, 10), h % 10, div(m, 10), m % 10].forEach((digit, i) =>
      out.push({ img: night && count ? digit : DASH, x: PANEL_X + xs[i], y: LOW_Y + 0x55 }),
    );
  }
  return out;
}

/** Type 7: percent of the calorie goal along the dial, three rotated digits, units first. */
export function calories(goal: number, burned: number): Item[] {
  const pct = goal ? clamp(div(burned * 100, goal), 0, 100) : 100;
  const out: Item[] = [{ img: pct % 10, x: 275, y: 332, angle: 3350 }];

  if (pct >= 10) out.push({ img: div(pct, 10) % 10, x: 259, y: 338, angle: 3440 });
  if (pct >= 100) out.push({ img: div(pct, 100), x: 242, y: 341, angle: 3530 });
  return out;
}

// type 4: rings 4 px wide, 16 px apart, the colours repeat after 9
const CENTRE = 233;
const RINGS = 14;
const RING_IN = 21;
const RING_STEP = 16;
export const RING_W = 4;
const RING_REACH = 4;
const RING_COLORS = [64737, 65185, 22244, 26297, 3135, 19834, 23292, 47838, 64039];

/** Type 4: the ring under a touch. */
export function ringAt(x: number, y: number): number | null {
  const d2 = (x - CENTRE) ** 2 + (y - CENTRE) ** 2;

  for (let i = 0; i < RINGS; i++) {
    const inner = RING_IN + RING_STEP * i - RING_REACH;
    // up to outer + reach, the distance rounded down
    const past = RING_IN + RING_STEP * i + RING_W + RING_REACH + 1;

    if (d2 >= inner * inner && d2 < past * past) return i;
  }
  return null;
}

/** The band that lights a ring up: its x and y, diameter and colour. */
export function ringBand(ring: number) {
  const r = RING_IN + RING_STEP * ring + RING_W;

  return { at: CENTRE - r, size: 2 * r, color: RING_COLORS[ring % RING_COLORS.length] };
}

// type 5: first and last frame of each clip
const CLIPS = [
  [0, 39],
  [40, 89],
  [90, 158],
];
export const FRAME_MS = 33;

export const nextClip = (clip: number) => (clip + 1 < CLIPS.length ? clip + 1 : 0);

/** Type 5: the frame `ms` into a clip, which holds its last one. */
export function frameAt(clip: number, ms: number): number {
  const [first, last] = CLIPS[clip % CLIPS.length];

  return Math.min(last, first + Math.max(0, div(ms, FRAME_MS)));
}
