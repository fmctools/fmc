// The editor's and the store's installs both end in ble.model's flash: a face with a widget that
// would boot-loop the connected watch never reaches the upload. Transport stubbed out.
import { beforeAll, beforeEach, expect, test, vi } from "vitest";
import { bleModel } from "$lib/modules/device/model";
import { faceBin, imageNode, procNode, squares } from "./proc-face";

const sent = vi.hoisted(() => ({ uploads: [] as Uint8Array[], asked: 0 }));

vi.mock("$lib/modules/device/lib/ble", async (importOriginal) => {
  class Watch {
    serial = null;
    name = "CMF Watch Pro 2-1A2B";
    onDials = () => {};
    async connect() {
      return { name: this.name, battery: null, firmware: null, serial: null };
    }
    async readWp2() {
      sent.asked++;
      return null;
    }
    async uploadWatchface(bin: Uint8Array) {
      sent.uploads.push(bin);
      return { id: 1, name: "synthetic" };
    }
    mergeDials() {}
  }

  return { ...(await importOriginal<object>()), Watch };
});

beforeAll(async () => {
  bleModel.connectRequested();
  await vi.waitFor(() => expect(bleModel.$bleInfo.getState()).not.toBeNull());
});
beforeEach(() => {
  sent.uploads.length = 0;
  sent.asked = 0; // a connection asks once by itself, for the Developer panel
});

test("a Watch Pro 2 is never sent a widget its firmware falls over", async () => {
  bleModel.flashRequested({ bin: faceBin([procNode({ type: 6, images: [0] })], squares(1)) });
  await vi.waitFor(() => expect(bleModel.$bleStatus.getState()).toMatch(/widget \(type 6\)/), {
    timeout: 5000,
  });
  expect(sent.uploads).toEqual([]);
  expect(sent.asked).toBe(0); // no stub release draws these yet, so there is nothing to ask
});

test("an A8 face is refused with a pointer to the export", async () => {
  bleModel.flashRequested({ bin: faceBin([imageNode([0])], squares(1, 14)) });
  await vi.waitFor(() => expect(bleModel.$bleStatus.getState()).toMatch(/A8 images/), {
    timeout: 5000,
  });
  expect(sent.uploads).toEqual([]);
});

test("and still gets the one it drops safely", async () => {
  bleModel.flashRequested({ bin: faceBin([procNode({ type: 4 })]) });
  await vi.waitFor(() => expect(sent.uploads).toHaveLength(1), { timeout: 5000 });
});
