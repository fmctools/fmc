// Going back to a firmware without the Watch 3 Pro widgets can strand a face that needs them in
// a boot loop, and the install gate can't see that coming: both ways to flash an image say so.
import { expect, test } from "vitest";
import { render } from "vitest-browser-svelte";
import type { RecordModel } from "pocketbase";
import DevSheet from "$lib/modules/device/components/dev-sheet.svelte";
import { devModel } from "$lib/modules/device/model";
import * as storeApi from "$lib/modules/store/model/store.api";
import { FirmwarePage } from "$lib/modules/store/pages";

const rec = (id: string, extra: object) =>
  ({ id, name: id, image: `${id}.bin`, ...extra }) as unknown as RecordModel;
const stock = rec("stock", { kind: "stock", device: "watch_pro_2" });
const loader = rec("loader", { kind: "loader", device: "watch_pro_2" });
const WARNING = /Before installing stock or older firmware, switch to a built-in face/;

storeApi.loadFirmwaresFx.use(() => [stock, loader]);
storeApi.loadFirmwareFx.use((id) => [stock, loader].find((r) => r.id === id)!);

test("a firmware page warns before a rollback", async () => {
  const screen = await render(FirmwarePage, { id: "stock" });

  await expect.element(screen.getByText(WARNING)).toBeInTheDocument();
});

test("the App Loader isn't firmware: no such warning", async () => {
  const screen = await render(FirmwarePage, { id: "loader" });

  await expect.element(screen.getByRole("heading", { name: "loader" })).toBeInTheDocument();
  expect(screen.container.textContent).not.toMatch(WARNING);
});

test("the Developer panel warns over a local image", async () => {
  (devModel.$build as unknown as { setState(v: devModel.LocalBuild): void }).setState({
    name: "local.bin",
    size: 1024,
    modified: 0,
    kind: "firmware",
    what: "firmware 1.0 for board jx402_01_3089c",
  });
  devModel.panelOpened();
  const screen = await render(DevSheet);

  await expect.element(screen.getByText(WARNING)).toBeInTheDocument();
});
