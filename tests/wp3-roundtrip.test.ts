// Opening and saving a Watch 3 Pro face loses nothing. Synthetic shapes here; the owner's files
// in tests/wp3-corpus.test.ts.
import { expect, test } from "vitest";
import { buildBin, hex, parseBin, TAG } from "$lib/modules/editor/core/format";
import { fromLegacy, toLegacy } from "$lib/modules/editor/core/document/doc";
import { withName } from "$lib/modules/editor/core/document/factory";
import type { FaceNode } from "$lib/modules/editor/core/format/raw";
import { faceBin, metaHex, procNode, squares } from "./proc-face";

const saved = (bin: Uint8Array) => buildBin(toLegacy(fromLegacy(parseBin(bin)).doc));

// a payload of zeroes reads as a run of empty tags: 0x5c with 24 of them was dropped on save
test.each([3, 6, 9, 24, 25, 27])("a 0x5c of %i bytes survives saving", (len) => {
  const bin = faceBin([procNode({ type: 6, len, images: [0] })], squares(1));

  expect(hex(saved(bin))).toBe(hex(bin));
});

test.each([
  [0x83, 0x5d],
  [0x84, 0x5e],
  [0x89, 0x63],
])("widget tag %i keeps a body (%i) that reads as tags", (tag, body) => {
  const node: FaceNode = {
    tag,
    subs: [
      { tag: TAG.struct, x: 1, y: 2, meta: metaHex(), tail: "0000" },
      { tag: body, hex: "010000000000" },
    ],
  };
  const bin = faceBin([node]);

  expect(hex(saved(bin))).toBe(hex(bin));
});

// two stock faces (Sun Circle, SlopeTime) have no 0x86 title and used to gain one
test("a face with no title node doesn't gain one", () => {
  const bin = faceBin([procNode({ type: 4 })], [], { title: false });

  expect(hex(saved(bin))).toBe(hex(bin));
});

test("until it is renamed", () => {
  const { doc } = fromLegacy(parseBin(faceBin([procNode({ type: 4 })], [], { title: false })));
  const title = toLegacy(withName(doc, "Renamed")).screens[0].subs?.find(
    (n) => n.tag === TAG.name,
  )?.text;

  expect(title).toBe("Renamed");
});

test("a face built here, not read from a file, still gets its title", () => {
  const { doc } = fromLegacy({
    name: "Imported",
    screens: [{ tag: TAG.main, subs: [] }],
    resources: [],
  });

  expect(toLegacy(doc).screens[0].subs?.[0]).toEqual({ tag: TAG.name, text: "Imported" });
});

test("an importer's face, which carries a header, gets its title too", () => {
  const { doc } = fromLegacy({
    name: "Imported",
    nameRaw: "496d706f7274656400000000000000" + "0a",
    screens: [{ tag: TAG.main, subs: [] }],
    resources: [],
  });

  expect(toLegacy(doc).screens[0].subs?.[0]).toEqual({ tag: TAG.name, text: "Imported" });
});
