// On the way to a Watch Pro 2, fitForWatch re-encodes the Watch 3 Pro's formats as RGB565 — what
// Export for Watch Pro 2 does by hand — as long as the screens stay in the bytes tested there.
import { describe, expect, test } from "vitest";
import { buildBin, decodePixels, fitForWatch, parseBin } from "$lib/modules/editor/core/format";
import { assertWatchCompat } from "$lib/modules/editor/core/format/compat";
import { faceBin, imageNode, squares } from "./proc-face";

const P2 = "watch_pro_2";
const noStub = async () => null;
const formats = (bin: Uint8Array) => parseBin(bin).resources.map((r) => r.cf);

describe("a Watch Pro 2", () => {
  // the A8 squares are opaque, so the cf 5 they become goes on to cf 4, as any opaque cf 5 does
  test("gets A8 as RGB565, with the pixels it decodes to", async () => {
    const src = squares(2, 14);
    const bin = faceBin([imageNode([0]), imageNode([1])], src);
    const { bin: out, converted } = fitForWatch(bin, P2);

    expect(formats(out)).toEqual([4, 4, 4]);
    expect(converted).toBe(2);
    parseBin(out)
      .resources.slice(0, 2)
      .forEach((r, i) => {
        expect(decodePixels(r)).toEqual(decodePixels(src[i]));
      });
    await expect(assertWatchCompat(out, P2, noStub)).resolves.toBeUndefined();
  });

  test("gets ETC2 as RGB565, which stock firmware draws", () => {
    const { bin: out, converted } = fitForWatch(faceBin([imageNode([0])], squares(1, 28)), P2);

    expect(formats(out)).toEqual([4, 4]);
    expect(converted).toBe(1);
  });

  test("the thumbnail too", () => {
    const face = parseBin(faceBin([imageNode([0])], squares(1)));

    face.resources[face.resources.length - 1] = squares(1, 14, 8, 8)[0];
    expect(formats(fitForWatch(buildBin(face), P2).bin)).toEqual([4, 4]);
  });

  // 4 x 464 x 464 x 3 bytes once unpacked: past the 1.955 MB tested on a Pro 2
  test("a face too heavy once converted goes untouched, and the gate refuses it", async () => {
    const heavy = squares(4, 14).map((r) => ({ ...r, w: 464, h: 464 }));
    const bin = faceBin(
      [0, 1, 2, 3].map((i) => imageNode([i])),
      heavy,
    );
    const fitted = fitForWatch(bin, P2);

    expect(fitted).toEqual({ bin, compressed: 0, converted: 0 });
    await expect(assertWatchCompat(bin, P2, noStub)).rejects.toThrow(/2\.6 MB/);
  });
});

test.each(["watch_3_pro", null])("%s keeps its formats", (device) => {
  const bin = faceBin([imageNode([0])], squares(1, 14));

  expect(fitForWatch(bin, device).converted).toBe(0);
  expect(formats(fitForWatch(bin, device).bin)).toContain(14);
});
