// The Watch 3 Pro's per-screen memory budget (core/format/budget.ts) and what fitForWatch does
// to get a face under it. The face that boot-looped a Watch 3 Pro (BZ Rotator, not vendored: it
// isn't ours) showed nine 466x466 RGB565+alpha images on its main screen; `heavy` rebuilds that
// shape on a factory face whose main screen shows enough images to swap.
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  assertFlashable,
  buildBin,
  decodePixels,
  encodePixels,
  fitForWatch,
  overBudget,
  parseBin,
  screenBytes,
  screenMemory,
  shownResources,
  TAG,
} from "$lib/modules/editor/core/format";

const read = (name: string) =>
  new Uint8Array(readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url)));
const FACES = [
  "Analog__287__Simple_Dial.bin",
  "Analog__372__Time_Wheel.bin",
  "Digital__281__Metaball.bin",
  "Pro3__Chavelle.bin",
  "Pro3__CitrusDash.bin",
  "Pro3__Cyclopes.bin",
  "Pro3__Rainbow_Lollipop.bin",
  "Pro3__SlopeTime.bin",
  "Pro3__Sports_Dial.bin",
];

/** A full-screen RGB565+alpha image: a gradient with a soft transparent edge, or fully opaque. */
const art = (seed: number, opaque = false) => {
  const px = new Uint8ClampedArray(466 * 466 * 4);

  for (let y = 0; y < 466; y++)
    for (let x = 0; x < 466; x++) {
      const o = (y * 466 + x) * 4;

      px.set([(x + seed * 40) & 255, (y * 2) & 255, (x + y) & 255, opaque ? 255 : x & 255], o);
    }
  return encodePixels(px, 466, 466, 5);
};

/** Dichotomy with its main screen's shown images swapped for full-screen art, `n` of them. */
const heavy = (n: number, opaque = false) => {
  const face = parseBin(read("Default__276__Dichotomy.bin"));
  const main = face.screens.find((s) => s.tag === TAG.main)!;

  [...shownResources(main, face.resources)].slice(0, n).forEach((i, k) => {
    face.resources[i] = art(k, opaque);
  });
  return face;
};

test("factory faces fit the budget", () => {
  for (const name of FACES) expect(overBudget(parseBin(read(name))), name).toEqual([]);
});

describe("a main screen of nine full-screen RGB565+alpha images", () => {
  const face = heavy(9);
  const bin = buildBin(face);

  test("is over the budget", () => {
    const main = face.screens.find((s) => s.tag === TAG.main)!;

    expect(screenBytes(main, face.resources)).toBeGreaterThan(9 * 466 * 466 * 3);
    expect(overBudget(face).map((s) => s.screen)).toEqual([main]);
  });
  test("is refused for a Watch 3 Pro, and not for a Watch Pro 2", () => {
    expect(() => assertFlashable(bin, "watch_3_pro")).toThrow(/main screen needs .* MB/);
    expect(() => assertFlashable(bin, "watch_pro_2")).not.toThrow();
  });
  test("goes through once fitted: the largest images become ETC2, close to the source", () => {
    const { bin: fitted, compressed } = fitForWatch(bin, "watch_3_pro");
    const out = parseBin(fitted);

    expect(() => assertFlashable(fitted, "watch_3_pro")).not.toThrow();
    expect(compressed).toBeGreaterThan(0);
    expect(out.resources.filter((r) => r.cf === 28)).toHaveLength(compressed);
    out.resources.forEach((r, i) => {
      if (r.cf !== 28) return;
      const a = decodePixels(face.resources[i])!,
        b = decodePixels(r)!;
      let err = 0;

      for (let k = 0; k < a.length; k++) err += Math.abs(a[k] - b[k]);
      expect(err / a.length).toBeLessThan(6);
    });
  });
  test("is left alone for a Watch Pro 2 — it has no ETC2", () => {
    expect(fitForWatch(bin, "watch_pro_2").bin).toBe(bin);
  });
});

test("an opaque RGB565+alpha image is stored as RGB565, pixel for pixel", () => {
  const face = heavy(1, true);
  const out = parseBin(fitForWatch(buildBin(face), null).bin);
  const i = face.resources.findIndex((r) => r.w === 466 && r.cf === 5);

  expect(out.resources[i].cf).toBe(4);
  expect(decodePixels(out.resources[i])).toEqual(decodePixels(face.resources[i]));
});

test("a face with nothing to change comes back as the same bytes", () => {
  const bin = read("Pro3__SlopeTime.bin");

  expect(fitForWatch(bin, "watch_3_pro")).toEqual({ bin, compressed: 0, converted: 0 });
});

describe("screenMemory — what the editor shows against the budget", () => {
  const mainOf = (face: ReturnType<typeof parseBin>) =>
    screenMemory(
      face.screens.find((s) => s.tag === TAG.main)!,
      face.resources,
    );

  test("a factory face fits", () => {
    expect(mainOf(parseBin(read("Default__276__Dichotomy.bin"))).fit).toBe("fits");
  });
  test("nine full-screen layers get compressed on install", () => {
    expect(mainOf(heavy(9)).fit).toBe("compressed");
  });
  test("full-screen JPEGs can't be compressed further, so too many of them are too heavy", () => {
    const face = heavy(12);

    face.resources = face.resources.map((r) => (r.w === 466 ? { ...r, cf: 1 } : r));
    expect(mainOf(face)).toEqual({ bytes: expect.any(Number), fit: "too-heavy" });
  });
});
