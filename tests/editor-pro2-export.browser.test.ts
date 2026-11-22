// Export for Watch Pro 2 through the model: what actually gets downloaded.
import { afterEach, expect, test, vi } from "vitest";
import { editorModel } from "$lib/modules/editor/model";
import { parseBin } from "$lib/modules/editor/core/format";
import { assertWatchCompat, procWidgets } from "$lib/modules/editor/core/format/compat";
import { faceBin, imageNode, procNode, squares } from "./proc-face";

afterEach(() => {
  vi.restoreAllMocks();
});

async function exported(bin: Uint8Array) {
  const files: Blob[] = [];
  const names: string[] = [];

  vi.spyOn(URL, "createObjectURL").mockImplementation((b) => {
    files.push(b as Blob);
    return "blob:export";
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
    function (this: HTMLAnchorElement) {
      names.push(this.download);
    },
  );
  editorModel.errored("");
  editorModel.loadRequested({ buf: bin, label: "export" });
  await vi.waitFor(() => {
    expect(editorModel.$loading.getState()).toBe(false);
    expect(editorModel.$fileLabel.getState()).toBe("export");
  });
  editorModel.exportPro2();
  await vi.waitFor(() => expect(files.length + editorModel.$err.getState().length).toBeTruthy(), {
    timeout: 8000,
  });
  return { files, names, err: editorModel.$err.getState() };
}

test("a copy a stock Watch Pro 2 takes", async () => {
  const src = faceBin(
    [imageNode([0]), imageNode([1, 2], 0x99), procNode({ type: 4 })],
    [...squares(1, 28), ...squares(2, 14)],
  );
  const { files, names, err } = await exported(src);

  expect(err).toBe("");
  expect(names).toEqual(["Synthetic-watch-pro-2.bin"]);
  const out = new Uint8Array(await files[0].arrayBuffer());

  expect(new Set(parseBin(out).resources.map((r) => r.cf))).not.toContain(28);
  expect(new Set(parseBin(out).resources.map((r) => r.cf))).not.toContain(14);
  expect(procWidgets(out)).toEqual([{ type: 4, hasImages: false }]);
  await expect(assertWatchCompat(out, "watch_pro_2", async () => null)).resolves.toBeUndefined();
});

test("a face that would boot-loop it downloads nothing", async () => {
  const { files, err } = await exported(faceBin([procNode({ type: 5, images: [0] })], squares(1)));

  expect(files).toEqual([]);
  expect(err).toMatch(/Watch 3 Pro only/);
});
