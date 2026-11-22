// A flash cut off by the link dropping fails *after* the drop has already reset $bleInfo — this
// drives that order through the real ble.model and checks the failure still names the watch.
import { test, expect, vi } from "vitest";
import { bleModel } from "$lib/modules/device/model";
import "$lib/modules/analytics/model";
import url from "./__fixtures__/Analog__287__Simple_Dial.bin?url";

const sent = vi.hoisted((): [string, unknown][] => []);

// stand in for the transport, which a test build (no VITE_APTABASE_KEY) turns into a no-op
vi.mock("$lib/modules/analytics/lib/aptabase", () => ({
  enabled: true,
  sendEvent: (name: string, props?: unknown) => sent.push([name, props]),
}));

vi.mock("$lib/modules/device/lib/ble", async (importOriginal) => {
  class Watch {
    constructor(private status: (s: string) => void) {}
    onDials = () => {};
    async connect() {
      return { name: "CMF Watch Pro 2-1A2B", battery: null, firmware: null, serial: null };
    }
    async uploadWatchface() {
      this.status("disconnected");
      throw new Error("GATT Server is disconnected. Cannot perform GATT operations.");
    }
  }

  return { ...(await importOriginal<object>()), Watch };
});

test("a flash cut off by a disconnect still names the watch it was going to", async () => {
  bleModel.connectRequested();
  await vi.waitFor(() => expect(bleModel.$bleInfo.getState()).not.toBeNull());
  // a face the gate lets through: one it refuses never gets as far as the link
  const bin = new Uint8Array(await (await fetch(url)).arrayBuffer());

  bleModel.flashRequested({ bin });
  // the file goes through a worker first (fitForWatchOffThread), which a loaded run starts slowly
  await vi.waitFor(() => expect(sent).toHaveLength(2), { timeout: 5000 });

  expect(sent).toEqual([
    ["watch_connect", { device: "CMF Watch Pro 2" }],
    ["watch_upload_failed", { device: "CMF Watch Pro 2", reason: "disconnected" }],
  ]);
});
