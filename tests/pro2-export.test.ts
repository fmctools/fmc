// The converted copy of a Watch 3 Pro face for a Watch Pro 2 (core/document/pro2.ts).
import { describe, expect, test } from "vitest";
import {
  buildBin,
  decodePixels,
  encodePixels,
  parseBin,
  screenBytes,
  TAG,
} from "$lib/modules/editor/core/format";
import type { FaceNode } from "$lib/modules/editor/core/format/raw";
import { PRO2_TESTED_BYTES } from "$lib/modules/editor/core/format/compat";
import { fromLegacy, toLegacy, type Doc } from "$lib/modules/editor/core/document/doc";
import { forPro2, pro2Problem } from "$lib/modules/editor/core/document/pro2";
import { faceBin, imageNode, metaHex, procNode, squares } from "./proc-face";

const open = (bin: Uint8Array) => fromLegacy(parseBin(bin)).doc;
const convert = (bin: Uint8Array, theme = 0) =>
  parseBin(buildBin(toLegacy(forPro2(open(bin), theme))));
const firstStruct = (nodes: FaceNode[]) =>
  nodes.find((n) => n.tag === TAG.image)!.subs!.find((n) => n.tag === TAG.struct)!;

/** A 4x4 block of one colour survives ETC2 closely enough to compare after RGB565. */
function solid(cf: number, rgba: number[]) {
  const px = new Uint8ClampedArray(64);

  for (let o = 0; o < 64; o += 4) px.set(rgba, o);
  return encodePixels(px, 4, 4, cf);
}

describe("formats", () => {
  test("cf 28 becomes cf 5 with the pixels it decodes to", () => {
    const etc2 = solid(28, [200, 40, 90, 128]);
    const out = convert(faceBin([imageNode([0])], [etc2]));
    const r = out.resources[firstStruct(out.screens[0].subs!).images![0]];
    const expected = encodePixels(decodePixels(etc2)!, 4, 4, 5);

    expect(r.cf).toBe(5);
    expect(decodePixels(r)).toEqual(decodePixels(expected));
  });

  test("cf 14 becomes white with the mask as alpha", () => {
    const out = convert(faceBin([imageNode([0])], [solid(14, [0, 0, 0, 77])]));
    const r = out.resources[firstStruct(out.screens[0].subs!).images![0]];

    expect(r.cf).toBe(5);
    expect(Array.from(decodePixels(r)!.slice(0, 4))).toEqual([255, 255, 255, 77]);
  });

  test("the thumbnail too, and nothing else", () => {
    const face = parseBin(
      faceBin([imageNode([0]), imageNode([1])], [...squares(1, 4), ...squares(1, 13)]),
    );
    const preview = face.screens[0].subs!.find((n) => n.tag === TAG.preview)!.subs![0].images![0];

    face.resources[preview] = solid(28, [10, 20, 30, 255]);
    const bin = buildBin(face);

    expect(convert(bin).resources.map((r) => r.cf)).toEqual([4, 13, 5]);
  });

  test("the document it was made from is untouched", () => {
    const doc: Doc = open(faceBin([imageNode([0])], [solid(28, [1, 2, 3, 255])]));
    const before = [...doc.images.values()];

    forPro2(doc, 0);
    expect([...doc.images.values()]).toEqual(before);
  });
});

describe("the colour theme's source", () => {
  test.each([
    [0, 0],
    [2, 2],
    [4, 1], // past the run: the watch wraps
  ])("theme %i keeps frame %i alone", (theme, frame) => {
    const src = squares(3);
    const out = convert(faceBin([imageNode([0, 1, 2], 0x99, 4)], src), theme);
    const st = firstStruct(out.screens[0].subs!);

    expect(st.images).toHaveLength(1);
    expect(out.resources[st.images![0]].data).toEqual(src[frame].data);
    expect(out.resources).toHaveLength(2); // that frame and the thumbnail
    expect(st.meta).toBe(metaHex(4, 4, 0, 4)); // the source goes, the tint flag stays
  });

  test("a condition on it can't be pinned", () => {
    const node = imageNode([0]);

    node.subs!.push({ tag: TAG.bind, hex: "019901020000" });
    const doc = open(faceBin([node], squares(1)));

    expect(pro2Problem(doc)).toEqual({ reason: "theme" });
  });

  test("a number printing it can't be either", () => {
    const node: FaceNode = {
      tag: TAG.number,
      subs: [
        {
          tag: TAG.struct,
          x: 0,
          y: 0,
          meta: metaHex(4, 4, 0x99),
          refType: 0x61,
          images: Array.from({ length: 10 }, (_, i) => i),
        },
        { tag: TAG.fmt, hex: "01" },
      ],
    };

    expect(pro2Problem(open(faceBin([node], squares(10))))).toEqual({ reason: "theme" });
  });
});

describe("what isn't exported", () => {
  test.each([5, 6, 7])("type %i", (type) => {
    const doc = open(faceBin([procNode({ type, images: [0] })], squares(1, 28)));

    expect(pro2Problem(doc)).toEqual({ reason: "pro3Only" });
  });

  test("type 8", () => {
    expect(pro2Problem(open(faceBin([procNode({ type: 8 })])))).toEqual({ reason: "none" });
  });

  test("type 4 without images converts", () => {
    expect(pro2Problem(open(faceBin([procNode({ type: 4 })])))).toBeNull();
  });

  // the header alone decides what a screen weighs
  test("a screen past the bytes tested on a Pro 2", () => {
    const four = squares(4, 28).map((r) => ({ ...r, w: 464, h: 464 }));
    const doc = open(
      faceBin(
        [0, 1, 2, 3].map((i) => imageNode([i])),
        four,
      ),
    );

    expect(pro2Problem(doc)).toEqual({ reason: "tooHeavy", bytes: 4 * 464 * 464 * 3 });
  });

  test("the largest screen it lets through stays in them after converting", () => {
    const small = squares(3, 28, 64, 64);
    const bin = faceBin(
      [0, 1, 2].map((i) => imageNode([i])),
      small,
    );

    expect(pro2Problem(open(bin))).toBeNull();
    const out = convert(bin);

    expect(screenBytes(out.screens[0], out.resources)).toBe(3 * 64 * 64 * 3);
    expect(3 * 64 * 64 * 3).toBeLessThanOrEqual(PRO2_TESTED_BYTES);
  });
});
