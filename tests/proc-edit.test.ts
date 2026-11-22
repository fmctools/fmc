// What may be edited on a procedural widget, and where the resulting face can go.
import { describe, expect, test } from "vitest";
import { buildBin, hex, parseBin, TAG } from "$lib/modules/editor/core/format";
import { procWidgets } from "$lib/modules/editor/core/format/compat";
import { fromLegacy, toLegacy, type Layer } from "$lib/modules/editor/core/document/doc";
import { patchLayer, withPanel } from "$lib/modules/editor/core/document/edits";
import { procOf } from "$lib/modules/editor/core/document/proc";
import { watchSupport } from "$lib/modules/editor/core/document/support";
import { resizable, rotatable } from "$lib/modules/editor/core/render/overlay";
import { dragItem } from "$lib/modules/editor/shared/drag";
import { faceBin, imageNode, procNode, squares, type Proc } from "./proc-face";

function open(p: Proc) {
  const { doc } = fromLegacy(parseBin(faceBin([procNode(p)], squares(p.images?.length ?? 0))));
  const layer = doc.screens[0].layers.find((l) => procOf(l))!;

  return { doc, layer, id: layer.id };
}
const thirteen = Array.from({ length: 13 }, (_, i) => i);
const patch = (p: object) => p as Partial<Layer>;

describe("position", () => {
  test.each([5, 6, 7])("type %i moves", (type) => {
    const { doc, id } = open({ type, images: [0] });
    const moved = patchLayer(doc, id, patch({ x: 10, y: 20 })).screens[0].layers[0];

    expect(moved).toMatchObject({ x: 10, y: 20 });
  });

  // the watch tests the finger against the screen's centre, so a moved ring lights off its art
  test("type 4 stays put, from every way in", () => {
    const { doc, id, layer } = open({ type: 4 });

    expect(patchLayer(doc, id, patch({ x: 10, y: 20 }))).toBe(doc);
    expect(dragItem(layer)).toBeNull();
  });
});

describe("images", () => {
  test("the count is the widget's own: a shorter run is rejected", () => {
    const { doc, id, layer } = open({ type: 6, sub: 1, images: thirteen });
    const frames = "frames" in layer ? layer.frames!.slice(1) : [];

    expect(patchLayer(doc, id, patch({ frames }))).toBe(doc);
  });

  test("the same count in another order is fine", () => {
    const { doc, id, layer } = open({ type: 6, sub: 1, images: thirteen });
    const frames = "frames" in layer ? [...layer.frames!].reverse() : [];

    expect(patchLayer(doc, id, patch({ frames })).screens[0].layers[0]).toMatchObject({ frames });
  });

  // positions are fixed by the firmware, so scaled glyphs would pile up
  test("no resize or rotate handles", () => {
    const { layer } = open({ type: 6, sub: 1, images: thirteen });

    expect([resizable(layer), rotatable(layer)]).toEqual([false, false]);
  });
});

describe("panel", () => {
  test.each([1, 2, 3, 4])("heart rate can become panel %i", (panel) => {
    const { doc, id } = open({ type: 6, sub: 1, images: thirteen });
    const next = withPanel(doc, id, panel);

    expect(procOf(next.screens[0].layers[0])).toEqual({ type: 6, panel });
  });

  test("and only that byte of the file changes", () => {
    const { doc, id } = open({ type: 6, sub: 1, images: thirteen });
    const expected = faceBin([procNode({ type: 6, sub: 3, images: thirteen })], squares(13));

    expect(hex(buildBin(toLegacy(withPanel(doc, id, 3))))).toBe(hex(expected));
  });

  test("weather has 88 images, the others 13: no switching to it or from it", () => {
    const low = open({ type: 6, sub: 1, images: thirteen });
    const top = open({ type: 6, sub: 0, images: thirteen });

    expect(withPanel(low.doc, low.id, 0)).toBe(low.doc);
    expect(withPanel(low.doc, low.id, 5)).toBe(low.doc);
    expect(withPanel(top.doc, top.id, 2)).toBe(top.doc);
  });

  test("other types have no panel", () => {
    const { doc, id } = open({ type: 7, images: [0] });

    expect(withPanel(doc, id, 2)).toBe(doc);
  });
});

describe("where the face can go", () => {
  const support = (bin: Uint8Array) => watchSupport(fromLegacy(parseBin(bin)).doc);

  test("an ordinary face needs no note", () => {
    expect(support(faceBin([imageNode([0])], squares(1)))).toBeNull();
  });

  test.each([5, 6, 7])("type %i is the Watch 3 Pro's alone", (type) => {
    expect(support(faceBin([procNode({ type, images: [0] })], squares(1)))).toBe("pro3Only");
  });

  test("type 4 without images: a Pro 2 drops it", () => {
    expect(support(faceBin([procNode({ type: 4 })]))).toBe("pro2Drops");
  });

  test("a short struct with a condition is the 3 Pro's alone, as at install", () => {
    const bin = faceBin([procNode({ type: 4, tail: "", conditions: "010b02630000" })]);

    expect(procWidgets(bin)[0].hasImages).toBe(true);
    expect(support(bin)).toBe("pro3Only");
  });

  test("type 8 is nobody's", () => {
    expect(support(faceBin([procNode({ type: 8 })]))).toBe("none");
  });

  test.each([14, 28])("cf %i needs converting for a Pro 2", (cf) => {
    expect(support(faceBin([imageNode([0])], squares(1, cf)))).toBe("pro2Converts");
  });

  test("so does a layer picked by the colour theme", () => {
    expect(support(faceBin([imageNode([0, 1], 0x99)], squares(2)))).toBe("pro2Converts");
  });

  // the install refuses it, so the note has to offer the export that gets past that
  test("an A8 thumbnail alone needs converting", () => {
    const face = parseBin(faceBin([imageNode([0])], squares(1)));

    face.resources[face.resources.length - 1] = squares(1, 14, 8, 8)[0];
    expect(support(buildBin(face))).toBe("pro2Converts");
  });

  test("an ETC2 thumbnail alone asks for nothing", () => {
    const face = parseBin(faceBin([imageNode([0])], squares(1)));
    const preview = face.screens[0].subs!.find((n) => n.tag === TAG.preview)!.subs![0].images![0];

    face.resources[preview] = squares(1, 28, 8, 8)[0];
    expect(support(buildBin(face))).toBeNull();
  });
});
