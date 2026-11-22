// The procedural widgets on the canvas: panels at their places, nothing in the corner where
// their first image used to land, and what a click does in the preview.
import { describe, expect, test, vi } from "vitest";
import { parseBin } from "$lib/modules/editor/core/format";
import { fromLegacy } from "$lib/modules/editor/core/document/doc";
import {
  collectIdsDoc,
  defaultSim,
  idValue,
  previewSim,
  timeParts,
  type Sim,
} from "$lib/modules/editor/core/document/sources";
import { decodeAssets, regenPreviewAssets } from "$lib/modules/editor/core/render/pixels";
import { renderDoc } from "$lib/modules/editor/core/render/render";
import { editorModel } from "$lib/modules/editor/model";
import { faceBin, imageNode, procNode, squares, type Proc } from "./proc-face";

const SIM: Sim = { ...defaultSim(), live: false, time: new Date(2026, 0, 8, 10, 9).getTime() };

async function draw(proc: Proc, count: number, sim: Partial<Sim> = {}) {
  const images = Array.from({ length: count }, (_, i) => i);
  const { doc } = fromLegacy(parseBin(faceBin([procNode({ ...proc, images })], squares(count))));
  const cache = await decodeAssets(doc.images);
  const c = document.createElement("canvas");

  c.width = c.height = 466;
  const ctx = c.getContext("2d")!;
  const store = { assets: doc.images, cache };
  const hits = renderDoc(ctx, doc, store, "main", { ...SIM, ...sim });
  const red = (x: number, y: number) => {
    const [r, , , a] = ctx.getImageData(x, y, 1, 1).data;

    return a ? r : null;
  };

  return { red, hits, doc, store };
}
/** What a square of `squares()` reads back as after RGB565. */
const redOf = (img: number) => Math.floor(((((img * 3) % 256) >> 3) * 255) / 31);

describe("DataPulse's panels", () => {
  test("weather: the 'now' label in its column, none in the corner", async () => {
    const { red, hits } = await draw({ type: 6, sub: 0 }, 88);

    expect(red(1, 1)).toBeNull();
    expect(red(95, 52)).toBe(redOf(0x27));
    expect(hits).toHaveLength(1);
    expect([hits[0].x, hits[0].y]).toEqual([94, 51]);
    expect(hits[0].w).toBeLessThan(340);
  });

  test.each([1, 2, 3])("panel %i: the axis and bars over it", async (sub) => {
    const { red, hits } = await draw({ type: 6, sub }, 13);

    expect(red(1, 1)).toBeNull();
    expect(red(81, 296)).toBe(redOf(10));
    expect(hits[0].h).toBeGreaterThan(20);
  });

  test("sleep: the start time's first digit", async () => {
    const { red } = await draw({ type: 6, sub: 4 }, 13, { sleep: 480 }); // 23:00 to 07:00

    expect(red(92, 379)).toBe(redOf(2));
  });

  // DataPulse's lower panels each sit in a group, which centres a child at x 0 by its size:
  // that size is the widget's own box, not the ink in it
  test("inside a full-screen group it stays where the watch puts it", async () => {
    const images = Array.from({ length: 13 }, (_, i) => i);
    const group = {
      tag: 0x68,
      subs: [{ tag: 0x48, hex: "00000000d201d20100" }, procNode({ type: 6, sub: 1, images })],
    };
    const { doc } = fromLegacy(parseBin(faceBin([group], squares(13))));
    const cache = await decodeAssets(doc.images);
    const ctx = new OffscreenCanvas(466, 466).getContext("2d")!;
    const hits = renderDoc(ctx, doc, { assets: doc.images, cache }, "main", SIM);

    expect(hits[0].x).toBe(80);
  });

  test("the thumbnail baked on save has the panel", async () => {
    const { doc, store } = await draw({ type: 6, sub: 0 }, 88);
    const [baked] = [...(await regenPreviewAssets(doc, store, previewSim(SIM))).values()];
    const k = baked.asset.w / 466;
    const c = new OffscreenCanvas(baked.asset.w, baked.asset.h);
    const ctx = c.getContext("2d")!;

    ctx.drawImage(baked.bitmap, 0, 0);
    // the weather's rows, well away from the corner
    const d = ctx.getImageData(80 * k, 45 * k, 310 * k, 120 * k).data;

    expect(d.some((v, i) => i % 4 === 1 && v > 0)).toBe(true);
  });
});

test("Luminous Beam: the percent along the dial, not in the corner", async () => {
  const { red, hits } = await draw({ type: 7 }, 10, { calories: 210, calGoal: 500 });

  expect(red(1, 1)).toBeNull();
  expect(red(277, 334)).toBe(redOf(2));
  expect(red(261, 340)).toBe(redOf(4));
  expect(hits).toHaveLength(1);
});

describe("Rainbow Lollipop", () => {
  const ringTop = 233 - 23;

  test("draws nothing until it is touched", async () => {
    expect((await draw({ type: 4 }, 0)).red(233, ringTop)).toBeNull();
  });

  test("lights the ring under the finger", async () => {
    const { red, hits } = await draw({ type: 4 }, 0, { touch: { x: 250, y: 233 } });

    expect(red(233, ringTop)).toBeGreaterThan(200);
    expect(red(233, 233)).toBeNull();
    expect(hits).toEqual([]); // a full-screen box would swallow every click
  });
});

describe("Briqbot", () => {
  test("rests on the end of its first clip", async () => {
    expect((await draw({ type: 5 }, 159)).red(1, 1)).toBe(redOf(39));
  });

  test("plays the clip a tap started", async () => {
    const now = Date.now();

    expect((await draw({ type: 5 }, 159, { clip: 1, clipAt: now })).red(1, 1)).toBeLessThanOrEqual(
      redOf(45),
    );
    expect((await draw({ type: 5 }, 159, { clip: 1, clipAt: now - 60_000 })).red(1, 1)).toBe(
      redOf(89),
    );
  });
});

test("the simulator offers what a widget reads", () => {
  const ids = (p: Proc) =>
    collectIdsDoc(fromLegacy(parseBin(faceBin([procNode(p)]))).doc).map(({ id }) => id);

  expect(ids({ type: 6, sub: 0 })).toEqual([0x5f]);
  expect(ids({ type: 6, sub: 1 })).toEqual([0x1a]);
  expect(ids({ type: 6, sub: 2 })).toEqual([0x1b]);
  expect(ids({ type: 6, sub: 3 })).toEqual([0x8c]);
  expect(ids({ type: 6, sub: 4 })).toEqual([0x46]);
  expect(ids({ type: 7 })).toEqual([0x1c]);
});

test("source 0x99 is the colour theme", () => {
  expect(idValue(0x99, { ...SIM, theme: 3 }, timeParts(SIM))).toBe(3);
});

// 3 Pro's getter reads the night's minutes as they are (0x101D2CD2)
test("source 0x93 is the minutes of last night's sleep", () => {
  expect(idValue(0x93, { ...SIM, sleep: 7 * 60 + 36 }, timeParts(SIM))).toBe(36);
});

test("a published preview carries no touch and no clip", () => {
  const p = previewSim({ ...SIM, touch: { x: 1, y: 2 }, clip: 2, clipAt: 5 });

  expect([p.touch, p.clip, p.clipAt]).toEqual([null, 0, null]);
});

describe("clicking the preview", () => {
  const open = async (bin: Uint8Array) => {
    editorModel.loadRequested({ buf: bin, label: "proc" });
    await vi.waitFor(() => expect(editorModel.$loading.getState()).toBe(false));
  };

  test("press and release light and clear a ring", async () => {
    await open(faceBin([procNode({ type: 4 })]));
    editorModel.watchPressed({ x: 250, y: 233 });
    expect(editorModel.$sim.getState().touch).toEqual({ x: 250, y: 233 });
    editorModel.watchReleased();
    expect(editorModel.$sim.getState().touch).toBeNull();
  });

  test("a tap starts the next clip", async () => {
    await open(faceBin([procNode({ type: 5, images: [0] })], squares(1)));
    editorModel.watchTapped(1000);
    expect(editorModel.$sim.getState()).toMatchObject({ clip: 1, clipAt: 1000 });
    editorModel.watchTapped(2000);
    expect(editorModel.$sim.getState()).toMatchObject({ clip: 2, clipAt: 2000 });
  });

  test("a face without such widgets leaves the simulator alone", async () => {
    await open(faceBin([imageNode([0])], squares(1)));
    const before = editorModel.$sim.getState();

    editorModel.watchPressed({ x: 1, y: 2 });
    editorModel.watchTapped(3000);
    expect(editorModel.$sim.getState()).toBe(before);
  });
});
