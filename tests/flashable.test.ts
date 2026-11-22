import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  assertFlashable,
  buildBin,
  flashWarning,
  parseBin,
  shownResources,
  TAG,
} from "$lib/modules/editor/core/format";
import type { Face, FaceNode } from "$lib/modules/editor/core/format";
import { fromLegacy, toLegacy } from "$lib/modules/editor/core/document/doc";
import { withPreviews } from "$lib/modules/editor/core/document/factory";

const bytes = new Uint8Array(
  readFileSync(new URL("./__fixtures__/Analog__287__Simple_Dial.bin", import.meta.url)),
);

test("an official face passes", () => {
  expect(() => assertFlashable(bytes)).not.toThrow();
});

// the face that boot-looped a Watch 3 Pro had a 1386x1386 AOD image
test("an image far past the panel is refused", () => {
  const face = parseBin(bytes);

  face.resources[0] = { ...face.resources[0], w: 1386, h: 1386 };
  expect(() => assertFlashable(buildBin(face))).toThrow(/1386×1386/);
});

// one Pro 3 factory face ships a 576x530 image, so that size installs, but only once confirmed
test("an image past every factory face but under the limit asks first", () => {
  const face = parseBin(bytes);

  expect(flashWarning(bytes)).toBeNull();
  face.resources[0] = { ...face.resources[0], w: 576, h: 530 };
  const big = buildBin(face);

  expect(() => assertFlashable(big)).not.toThrow();
  expect(flashWarning(big)).toMatch(/576×530/);
});

// #49: the FMC face that crash-looped a Watch 3 Pro on AOD was the one whose AOD screen had lost
// its 0x28 thumbnail, which every stock AOD screen has. The raw file is refused; the same face
// rebuilt by the editor gets the thumbnail back and goes through.
test("an AOD screen without its preview is refused, and the editor's export restores it", () => {
  const face = parseBin(bytes);
  const aod = face.screens.find((s) => s.tag === TAG.aod)!;

  aod.subs = aod.subs!.filter((n) => n.tag !== TAG.preview);
  const bare = buildBin(face);

  expect(() => assertFlashable(bare)).toThrow(/always-on screen has no preview/);
  const { doc } = fromLegacy(parseBin(bare));
  const fixed = withPreviews(doc, face.resources[0]);

  expect(withPreviews(fixed, face.resources[0])).toBe(fixed); // nothing left to restore
  expect(() => assertFlashable(buildBin(toLegacy(fixed)))).not.toThrow();
});

// The face that boot-looped a Watch 3 Pro went through the gate in each of these shapes: whatever
// the parser couldn't read was counted as zero bytes, or not checked at all.
test("a file that does not parse is refused for every watch", () => {
  const cut = bytes.slice();

  cut[cut.length - 36] ^= 1; // the footer no longer repeats the header
  expect(() => parseBin(cut)).toThrow();
  for (const device of [null, "watch_pro_2", "watch_3_pro"])
    expect(() => assertFlashable(cut, device)).toThrow(/can't read this file/);
});

describe("what can't be measured is refused for a Watch 3 Pro, and only for it", () => {
  const refused = (change: (main: FaceNode, face: Face) => void) => {
    const face = parseBin(bytes);

    change(
      face.screens.find((s) => s.tag === TAG.main)!,
      face,
    );
    const bin = buildBin(face);

    expect(() => assertFlashable(bin, "watch_3_pro")).toThrow(/can't measure/);
    expect(() => assertFlashable(bin, "watch_pro_2")).not.toThrow();
  };

  test("a shown image in an unknown colour format", () =>
    refused((main, face) => {
      const [shown] = shownResources(main, face.resources);

      face.resources[shown] = { ...face.resources[shown], cf: 6 };
    }));
  test("an image reference that leads to no resource", () =>
    refused((main) => {
      main.subs!.push({
        tag: TAG.image,
        subs: [{ tag: TAG.struct, x: 0, y: 0, meta: "00".repeat(14), tail: "010100ffffff7f" }],
      });
    }));
  test("a screen whose layers don't parse", () =>
    refused((main) => {
      delete main.subs;
      main.hex = "30ffff";
    }));
  test("a layer whose contents don't parse", () =>
    refused((main) => {
      main.subs!.push({ tag: TAG.group, hex: "30ffff" });
    }));
});

test("every factory face can be measured", () => {
  const dir = new URL("./__fixtures__/", import.meta.url);

  for (const name of readdirSync(dir).filter((f) => f.endsWith(".bin"))) {
    const bin = new Uint8Array(readFileSync(new URL(name, dir)));

    expect(() => assertFlashable(bin, "watch_3_pro"), name).not.toThrow();
  }
});
