// Editing a procedural widget through the model and the inspector.
import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import PropsPanel from "$lib/modules/editor/components/PropsPanel.svelte";
import { editorModel } from "$lib/modules/editor/model";
import { procOf } from "$lib/modules/editor/core/document/proc";
import { framesOf, type Doc } from "$lib/modules/editor/core/document/doc";
import { faceBin, procNode, squares, type Proc } from "./proc-face";

const doc = () => editorModel.$doc.getState() as Doc;
const first = () => doc().screens[0].layers[0];

async function open(p: Proc, cf = 5) {
  const bin = faceBin([procNode(p)], squares(p.images?.length ?? 0, cf, 8, 8));

  editorModel.loadRequested({ buf: bin, label: "proc" });
  await vi.waitFor(() => {
    expect(editorModel.$loading.getState()).toBe(false);
    expect(procOf(first())?.type).toBe(p.type);
  });
  editorModel.select(first().id);
}
const thirteen = Array.from({ length: 13 }, (_, i) => i);

test("a panel change is one undoable edit", async () => {
  await open({ type: 6, sub: 1, images: thirteen });
  editorModel.panelSet({ id: first().id, panel: 4 });
  expect(procOf(first())?.panel).toBe(4);
  editorModel.undo();
  expect(procOf(first())?.panel).toBe(1);
});

test("a resize leaves the widget's images alone", async () => {
  await open({ type: 6, sub: 1, images: thirteen });
  const before = doc();

  editorModel.resizeImageRequested({ layer: first().id, w: 32, h: 32 });
  editorModel.rotateImageRequested({ layer: first().id, deg: 90 });
  await new Promise((r) => setTimeout(r, 300));
  expect(doc()).toBe(before);
});

// Briqbot's frames are JPEG (cf 1): the bytes of a picked PNG are not one
test("a PNG dropped on a JPEG frame is stored as a JPEG", async () => {
  await open({ type: 7, images: [0] });
  const id = framesOf(first())[0];
  const c = new OffscreenCanvas(8, 8);

  c.getContext("2d")!.fillRect(0, 0, 8, 8);
  const jpeg = new Uint8Array(await (await c.convertToBlob({ type: "image/jpeg" })).arrayBuffer());

  editorModel.committed({
    edit: (d) => ({
      ...d,
      images: new Map(d.images).set(id, { ...d.images.get(id)!, cf: 1, data: jpeg }),
    }),
  });
  const png = new File([await c.convertToBlob({ type: "image/png" })], "frame.png", {
    type: "image/png",
  });

  editorModel.replaceImageRequested({ id, file: png });
  await vi.waitFor(() => expect(doc().images.get(id)!.data).not.toBe(jpeg), { timeout: 5000 });
  expect(Array.from(doc().images.get(id)!.data.subarray(0, 2))).toEqual([0xff, 0xd8]);
});

describe("the inspector", () => {
  test("says which watch a widget is for and offers the panel", async () => {
    await open({ type: 6, sub: 1, images: thirteen });
    const screen = await render(PropsPanel);

    await expect.element(screen.getByText(/Watch 3 Pro widget/)).toBeInTheDocument();
    await expect.element(screen.getByText("Heart rate").first()).toBeInTheDocument();
    expect(screen.container.textContent).not.toMatch(/regenerate from a font|none — static/i);
  });

  test("a ring widget has no position fields", async () => {
    await open({ type: 4 });
    const screen = await render(PropsPanel);

    await expect.element(screen.getByText(/follows the finger/)).toBeInTheDocument();
    expect(screen.container.querySelectorAll('input[type="number"]')).toHaveLength(0);
  });
});
