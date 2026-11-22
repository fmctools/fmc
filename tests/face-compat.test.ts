// Which Watch 3 Pro widgets may go to which watch and firmware (core/format/compat.ts). Every
// refusal here was a boot loop in the cmf-watch-utils emulator, or falls in the same table bug.
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { buildBin, parseBin, TAG } from "$lib/modules/editor/core/format";
import {
  assertWatchCompat,
  PRO2_FACES_STUB,
  procWidgets,
} from "$lib/modules/editor/core/format/compat";
import { faceBin, imageNode, procNode, squares, type Proc } from "./proc-face";

const P2 = "watch_pro_2";
const P3 = "watch_3_pro";
const face = (p: Proc) => faceBin([procNode(p)], p.images ? squares(p.images.length) : []);
const noStub = async () => null;
const stub = (n: number | null) => async () => n;
const check = (bin: Uint8Array, device: string | null, version: number | null = null, min = 10) =>
  assertWatchCompat(bin, device, stub(version), min);

describe("what the firmware would read", () => {
  test("type and whether the image lookup finds a list", () => {
    expect(procWidgets(face({ type: 6, images: [0] }))).toEqual([{ type: 6, hasImages: true }]);
    expect(procWidgets(face({ type: 4 }))).toEqual([{ type: 4, hasImages: false }]);
  });

  // the parser reads the list at a fixed offset, past the end of a short struct
  test("a short struct with a condition after it has a list, as far as the watch is concerned", () => {
    const bin = face({ type: 4, tail: "", conditions: "010b02630000" });

    expect(procWidgets(bin)).toEqual([{ type: 4, hasImages: true }]);
  });

  test("the type is two bytes", () => {
    expect(procWidgets(face({ type: 0xffff }))[0].type).toBe(0xffff);
    expect(procWidgets(face({ type: 0x0104 }))[0].type).toBe(0x0104);
  });

  // parseBin takes some of these payloads for a subtree; the check must not depend on it
  test.each([2, 3, 6, 9, 24, 25, 27])("a %i-byte payload is still seen", (len) => {
    expect(procWidgets(face({ type: 8, len }))[0].type).toBe(8);
  });

  test("inside groups, however deep", () => {
    const group = (child: ReturnType<typeof procNode>) => ({
      tag: TAG.group,
      subs: [{ tag: TAG.frame, hex: "00000000d201d20100" }, child],
    });
    const bin = faceBin([group(group(procNode({ type: 6, images: [0] })))], squares(1));

    expect(procWidgets(bin)).toEqual([{ type: 6, hasImages: true }]);
  });

  test("no widget, nothing to report", () => {
    expect(procWidgets(faceBin([imageNode([0])], squares(1)))).toEqual([]);
  });

  test("a screen that doesn't walk is unreadable, not safe", () => {
    const bin = face({ type: 6 }).slice();

    bin[36 + 3 + 3 + 1] = 0xff; // the first layer's length now runs past its screen
    bin[36 + 3 + 3 + 2] = 0xff;
    expect(() => procWidgets(bin)).toThrow(/can't read this file/);
  });
});

describe("Watch Pro 2 on stock or older patched firmware", () => {
  test.each([0, 1, 2, 3])("type %i is its own", async (type) => {
    await expect(check(face({ type, images: [0] }), P2)).resolves.toBeUndefined();
  });

  test("type 4 without images is dropped by the watch, so it goes", async () => {
    await expect(check(face({ type: 4 }), P2)).resolves.toBeUndefined();
  });

  test("type 4 with images is refused", async () => {
    await expect(check(face({ type: 4, images: [0] }), P2)).rejects.toThrow(/widget \(type 4\)/);
  });

  test("type 4 with a short struct is refused", async () => {
    const bin = face({ type: 4, tail: "", conditions: "010b02630000" });

    await expect(check(bin, P2)).rejects.toThrow(/widget \(type 4\)/);
  });

  test.each([5, 6, 7])("type %i is refused, images or not", async (type) => {
    await expect(check(face({ type, images: [0] }), P2)).rejects.toThrow(/restart in a loop/);
    await expect(check(face({ type }), P2)).rejects.toThrow(/restart in a loop/);
  });

  test.each([1, 8, 9])("stub %i is not enough", async (version) => {
    await expect(check(face({ type: 6, images: [0] }), P2, version)).rejects.toThrow(/type 6/);
  });
});

describe("Watch Pro 2 with a stub that draws them", () => {
  test.each([4, 5, 6, 7])("type %i goes to stub 10", async (type) => {
    await expect(check(face({ type, images: [0] }), P2, 10)).resolves.toBeUndefined();
  });

  test("until that stub ships nobody is asked and the widgets are refused", async () => {
    expect(PRO2_FACES_STUB).toBeNull();
    let asked = false;
    const read = async () => {
      asked = true;
      return 99;
    };

    await expect(assertWatchCompat(face({ type: 6 }), P2, read)).rejects.toThrow(/type 6/);
    expect(asked).toBe(false);
  });

  test("a watch that doesn't answer counts as stock", async () => {
    const silent = async () => {
      throw new Error("timeout waiting for stubInfoRep");
    };

    await expect(assertWatchCompat(face({ type: 5 }), P2, silent, 10)).rejects.toThrow(/type 5/);
  });

  test("the stub is asked only for a face that needs it", async () => {
    let asked = 0;
    const read = async () => {
      asked++;
      return 10;
    };

    await assertWatchCompat(face({ type: 2 }), P2, read, 10);
    await assertWatchCompat(face({ type: 4 }), P2, read, 10);
    await assertWatchCompat(face({ type: 6 }), P3, read, 10);
    expect(asked).toBe(0);
    await assertWatchCompat(face({ type: 6 }), P2, read, 10);
    expect(asked).toBe(1);
  });
});

describe("Watch 3 Pro", () => {
  test.each([0, 1, 2, 3, 4, 5, 6, 7])("type %i is in its table", async (type) => {
    await expect(check(face({ type }), P3)).resolves.toBeUndefined();
  });
});

describe("a watch with no known model", () => {
  test("gets types 0..3 and nothing newer", async () => {
    await expect(check(face({ type: 3 }), null)).resolves.toBeUndefined();
    await expect(check(face({ type: 4 }), null)).rejects.toThrow(/type 4/);
    await expect(check(face({ type: 6 }), null, 10)).rejects.toThrow(/type 6/);
  });
});

describe.each([8, 12, 0xff, 0x100, 0xffff])("type %i", (type) => {
  test.each([P2, P3, null])("goes to no watch (%s)", async (device) => {
    await expect(check(face({ type }), device, 10)).rejects.toThrow(/no supported watch/);
  });
});

// A stub that decodes cf 28 unpacks it to cf 5, three bytes a pixel; FMC's budget counts one.
describe("ETC2 on a Watch Pro 2", () => {
  const etc2 = (n: number) =>
    faceBin(
      Array.from({ length: n }, (_, i) => imageNode([i])),
      // only the header's size counts: nothing here decodes the payload
      squares(n, 28).map((r) => ({ ...r, w: 464, h: 464 })),
    );

  test("is counted unpacked", async () => {
    await expect(assertWatchCompat(etc2(3), P2, noStub)).resolves.toBeUndefined(); // 1.94 MB
    await expect(assertWatchCompat(etc2(4), P2, noStub)).rejects.toThrow(/2\.6 MB unpacked/);
  });

  test("also when it isn't the largest frame of its run as stored", async () => {
    const big = squares(4, 28).map((r) => ({ ...r, w: 464, h: 464 }));
    // cf 5 at 280x280 outweighs cf 28 at 464x464 until the latter is unpacked
    const small = squares(4, 5).map((r) => ({ ...r, w: 280, h: 280 }));
    const bin = faceBin(
      [0, 2, 4, 6].map((i) => imageNode([i, i + 1])),
      big.flatMap((r, i) => [r, small[i]]),
    );

    await expect(assertWatchCompat(bin, P2, noStub)).rejects.toThrow(/2\.6 MB unpacked/);
  });

  test("and left to the budget on a Watch 3 Pro", async () => {
    await expect(assertWatchCompat(etc2(4), P3, noStub)).resolves.toBeUndefined();
  });
});

// Nobody has seen what a Watch Pro 2 does with an A8 image, and the emulator stops on them.
describe("A8 (cf 14) on a Watch Pro 2", () => {
  const a8 = () => faceBin([imageNode([0])], squares(1, 14));

  test("is refused, with the way out", async () => {
    await expect(assertWatchCompat(a8(), P2, noStub)).rejects.toThrow(
      /A8 images \(cf 14\).*Export for Watch Pro 2/,
    );
  });

  test("whatever the stub: none of them converts A8", async () => {
    await expect(check(a8(), P2, 10)).rejects.toThrow(/A8 images/);
  });

  test("also as a frame that isn't the run's largest", async () => {
    const bin = faceBin([imageNode([0, 1])], [...squares(1, 5, 8, 8), ...squares(1, 14)]);

    await expect(assertWatchCompat(bin, P2, noStub)).rejects.toThrow(/A8 images/);
  });

  test("the thumbnail counts: the face picker draws it on the same watch", async () => {
    const face = parseBin(faceBin([imageNode([0])], squares(1)));

    face.resources[face.resources.length - 1] = squares(1, 14, 8, 8)[0];
    await expect(assertWatchCompat(buildBin(face), P2, noStub)).rejects.toThrow(/A8 images/);
  });

  test("a Watch 3 Pro takes them", async () => {
    await expect(assertWatchCompat(a8(), P3, noStub)).resolves.toBeUndefined();
  });

  test("a boot loop is named before a format", async () => {
    const bin = faceBin([procNode({ type: 6, images: [0] })], squares(1, 14));

    await expect(assertWatchCompat(bin, P2, noStub)).rejects.toThrow(/type 6/);
  });
});

// the repo's factory faces: the check must not refuse a watch its own faces
const fixtures = new URL("./__fixtures__/", import.meta.url);

test.each(readdirSync(fixtures).filter((f) => f.endsWith(".bin")))(
  "%s still goes to the watch it was made for",
  async (name) => {
    const bin = new Uint8Array(readFileSync(new URL(name, fixtures)));

    await expect(
      assertWatchCompat(bin, name.startsWith("Pro3__") ? P3 : P2, noStub),
    ).resolves.toBeUndefined();
  },
);
