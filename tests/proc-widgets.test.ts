// The drawing logic of the procedural widgets. The numbers are the ones cmf-watch-sdk's
// fw/wp2-core/src/wfproc.rs is tested with (MIT, Copyright (c) 2026 Egor Kolesnikov): the stub
// and the editor have to put the same image at the same pixel.
import { describe, expect, test } from "vitest";
import {
  calories,
  frameAt,
  GREY,
  heart,
  hourLabel,
  nextClip,
  ringAt,
  ringBand,
  sleep,
  spo2,
  STAGES,
  stress,
  weather,
  WHITE,
  type Forecast,
  type Item,
} from "$lib/modules/editor/core/render/proc-scene";

const images = (s: Item[]) => s.flatMap((i) => ("img" in i ? [[i.img, i.x, i.y]] : []));
const rects = (s: Item[]) => s.flatMap((i) => ("w" in i ? [[i.x, i.y, i.w, i.h, i.color]] : []));
const C24 = { hour: 8, twelve: false };
const day = (n: number, at: Record<number, number[]>) =>
  Array.from({ length: 24 }, (_, h) => at[h] ?? Array(n).fill(0));

describe("weather", () => {
  const forecast: Forecast[] = [
    { temp: 20, code: 2 },
    { temp: -3, code: 3 },
    { temp: -2, code: 4 },
    { temp: -1, code: 5 },
  ];

  test("columns, 24h", () => {
    const got = images(weather(forecast, C24));

    // "now", icon, two digits, degree
    expect(got.slice(0, 5)).toEqual([
      [0x27, 94, 51],
      [2, 104, 91],
      [0x1b + 2, 105, 148],
      [0x1b, 119, 148],
      [0x25, 133, 148],
    ]);
    // 9:00, icon, minus, 3, degree
    expect(got.slice(5, 10)).toEqual([
      [0x40 + 9, 181, 51],
      [3, 181, 91],
      [0x26, 182, 148],
      [0x1b + 3, 196, 148],
      [0x25, 210, 148],
    ]);
    expect(got).toHaveLength(20);
  });

  test("hour labels, 12h", () => {
    for (let h = 0; h < 24; h++)
      expect(hourLabel(h, true)).toEqual([0x28 + h, [0, 10, 11, 12, 22, 23].includes(h) ? 0 : 7]);
    expect(hourLabel(13, false)).toEqual([0x40 + 13, 17]);
  });

  // the 3 Pro centres "--" as one digit, seen in its frame
  test("without data", () => {
    expect(images(weather([null, null, null, null], C24)).slice(1, 5)).toEqual([
      [0, 104, 91],
      [0x26, 112, 148],
      [0x26, 126, 148],
      [0x25, 140, 148],
    ]);
  });

  test("a code past the face's 27 icons doesn't show a digit", () => {
    expect(images(weather([{ temp: 5, code: 0x40 }], C24))[1][0]).toBe(1);
  });

  test.each([-2147483648, -1000, -5, 0, 999, 100000, 2147483647])("%i fits the column", (temp) => {
    for (const [img] of images(weather(Array(4).fill({ temp, code: 1 }), C24))) {
      expect(img).toBeGreaterThanOrEqual(0);
      expect(img).toBeLessThan(88);
    }
  });
});

describe("heart rate", () => {
  test("bars span min to max", () => {
    const s = heart(day(4, { 0: [100, 80, 120, 70], 8: [150, 150, 0, 0] }), 150, 50, C24);

    expect(images(s)).toEqual([[10, 80, 295]]);
    expect(rects(s)).toEqual([
      [90, 321, 8, 40, GREY],
      [186, 297, 8, 2, WHITE],
    ]);
  });

  test("one value, and none", () => {
    const none = heart(day(4, {}), 0, 0, { hour: 8, twelve: true });

    expect(images(none)).toEqual([[11, 80, 295]]);
    expect(rects(none)).toEqual([]);
    expect(rects(heart(day(4, { 0: [70, 70, 0, 0] }), 70, 70, C24))).toEqual([
      [90, 297, 8, 5, GREY],
    ]);
  });
});

test("SpO2 under 90 is a stub on the axis", () => {
  expect(rects(spo2(day(2, { 0: [99, 91], 2: [89, 85] }), C24))).toEqual([
    [90, 297, 8, 46, GREY],
    [114, 371, 8, 5, GREY],
  ]);
});

test("stress bars", () => {
  expect(rects(stress(day(2, { 0: [100, 50], 1: [1, 1] }), C24))).toEqual([
    [90, 297, 8, 40, GREY],
    [102, 374, 8, 2, GREY],
  ]);
});

describe("sleep", () => {
  test("stages and times", () => {
    const s = sleep({
      start: 23 * 3600 + 30 * 60,
      end: 25 * 3600 + 30 * 60,
      stages: [
        { kind: 1, seconds: 3600 },
        { kind: 3, seconds: 3600 },
      ],
    });

    expect(rects(s)).toEqual([
      [91, 316, 140, 17, STAGES[1]],
      [233, 350, 140, 17, STAGES[3]],
    ]);
    expect(images(s).map(([img]) => img)).toEqual([2, 3, 3, 0, 0, 1, 3, 0]);
    expect([images(s)[0][1], images(s)[0][2], images(s)[7][1]]).toEqual([91, 378, 361]);
  });

  test("without data: eight dashes", () => {
    const s = sleep(null);

    expect(rects(s)).toEqual([]);
    expect(images(s).map(([img]) => img)).toEqual(Array(8).fill(12));
  });

  test("more stages than the panel has room for are not drawn", () => {
    const stages = Array(51).fill({ kind: 1, seconds: 60 });

    expect(rects(sleep({ start: 0, end: 3060, stages }))).toEqual([]);
  });
});

test("calories percent", () => {
  const full = [
    [0, 275, 332, 3350],
    [0, 259, 338, 3440],
    [1, 242, 341, 3530],
  ];
  const glyphs = (goal: number, burned: number) =>
    calories(goal, burned).flatMap((i) => ("img" in i ? [[i.img, i.x, i.y, i.angle]] : []));

  expect(glyphs(500, 0)).toEqual([[0, 275, 332, 3350]]);
  expect(glyphs(500, 210)).toEqual([
    [2, 275, 332, 3350],
    [4, 259, 338, 3440],
  ]);
  expect(glyphs(500, 500)).toEqual(full);
  expect(glyphs(500, 4294967295)).toEqual(full);
  // the 3 Pro shows 100 without a goal
  expect(glyphs(0, 7)).toEqual(full);
});

test("rings under a touch", () => {
  // 14 rings 16 px apart, each takes 4 px more on both sides
  expect(ringAt(233, 233)).toBeNull();
  expect(ringAt(233 + 17, 233)).toBe(0);
  expect(ringAt(233, 233 - 29)).toBe(0);
  expect(ringAt(233, 233 + 30)).toBeNull();
  expect(ringAt(233 + 225, 233)).toBe(13);
  expect(ringAt(233 + 238, 233)).toBeNull();
  expect(ringBand(0)).toEqual({ at: 208, size: 50, color: 0xfce1 });
  expect(ringBand(13)).toEqual({ at: 0, size: 466, color: 0x0c3f });
});

test("robot clips play once and hold their last frame; a tap starts the next", () => {
  expect([0, 33, 39 * 33, 1e6].map((ms) => frameAt(0, ms))).toEqual([0, 1, 39, 39]);
  expect([0, 49 * 33, 1e6].map((ms) => frameAt(1, ms))).toEqual([40, 89, 89]);
  expect([0, 1e6].map((ms) => frameAt(2, ms))).toEqual([90, 158]);
  expect([0, 1, 2, 9].map(nextClip)).toEqual([1, 2, 0, 0]);
});
