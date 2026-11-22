// What the App Loader stub reports about the watch (wp2.ts, Watch.readWp2): the three answers to
// "which stub?" — none (stock), an old one, a versioned one — and the slot headers that decide
// "installed" against "update available".
import { expect, test } from "vitest";
import { Watch } from "$lib/modules/device/lib/ble";
import { CMD, crc32 } from "$lib/modules/device/lib/ble-protocol";
import {
  LOADER_SLOT,
  parsePackageHeader,
  parseStubReply,
  planInstall,
  samePackage,
  STUB_SLOT,
  type Wp2State,
} from "$lib/modules/device/lib/wp2";
// built by cmf-watch-sdk (widget-templates) package.pack: an app with 2 widget icons, and the same
// app packed without them — what package.strip_trailer makes of the first
import iconsUrl from "./__fixtures__/icons.wp2app?url";
import strippedUrl from "./__fixtures__/icons-stripped.wp2app?url";

const load = (url: string) =>
  fetch(url)
    .then((r) => r.arrayBuffer())
    .then((b) => new Uint8Array(b));

// a .wp2app header as wp2apps `pack` writes it (<4sHBB24sIIIIII8s)
function header(name: string, version: number, crc: number, kind = 0) {
  const h = new Uint8Array(64);
  const dv = new DataView(h.buffer);

  h.set(new TextEncoder().encode("WP2A"));
  dv.setUint16(4, 1, true);
  h[6] = kind;
  h[7] = 3;
  h.set(new TextEncoder().encode(name), 8);
  dv.setUint32(32, version, true);
  dv.setUint32(36, 1234, true);
  dv.setUint32(48, crc, true);
  return h;
}

test("a package header reads back name, version, kind and image CRC", () => {
  expect(parsePackageHeader(header("workout", 2, 0xacdf64f7))).toEqual({
    name: "workout",
    version: 2,
    kind: 0,
    abiMinor: 3,
    size: 1234,
    crc: 0xacdf64f7,
  });
  expect(parsePackageHeader(new Uint8Array(64))).toBeNull();
});

test("the stub's reply: versioned, and an older stub's BadRequest", () => {
  expect(parseStubReply(new Uint8Array([0, 2, 0, 0, 0, 3]))).toEqual({ version: 2, abiMinor: 3 });
  expect(parseStubReply(new Uint8Array([1]))).toEqual({ version: 1, abiMinor: null });
  expect(() => parseStubReply(new Uint8Array([0, 1]))).toThrow();
});

test("same build means same name and same CRC", () => {
  const a = parsePackageHeader(header("workout", 1, 7))!;

  expect(samePackage(a, parsePackageHeader(header("workout", 1, 7))!)).toBe(true);
  // a rebuild under the same version number is still a different build
  expect(samePackage(a, parsePackageHeader(header("workout", 1, 8))!)).toBe(false);
});

// a watch whose INFO answers come from a table; `null` is silence
function watchAnswering(answer: (slot: number) => Uint8Array | null) {
  const w = new Watch();
  const asked: number[] = [];
  let last = 0;

  w.send = async (key, payload) => {
    expect(key).toBe(CMD.stubInfo); // INFO and nothing else goes out
    last = payload![0];
    asked.push(last);
  };
  w.waitFor = async () => {
    const r = answer(last);

    if (!r) throw new Error("timeout");
    return r;
  };
  return { w, asked };
}

test("a stock watch doesn't answer: no stub, and nothing more is asked", async () => {
  const { w, asked } = watchAnswering(() => null);

  expect(await w.readWp2()).toBeNull();
  expect(asked).toEqual([STUB_SLOT]);
});

test("a watch with the stub reports its release, the loader and the apps by slot", async () => {
  const { w, asked } = watchAnswering((slot) => {
    if (slot === STUB_SLOT) return new Uint8Array([0, 2, 0, 0, 0, 3]);
    if (slot === LOADER_SLOT) return new Uint8Array([0, ...header("loader", 1, 9, 1)]);
    if (slot === 3) return new Uint8Array([0, ...header("workout", 2, 7)]);
    return new Uint8Array([0]); // an empty slot: status only
  });
  const state = await w.readWp2();

  expect(state?.stub).toEqual({ version: 2, abiMinor: 3 });
  expect(state?.loader?.name).toBe("loader");
  expect(Object.keys(state!.apps)).toEqual(["3"]);
  expect(state!.apps[3].name).toBe("workout");
  expect(asked).toEqual([STUB_SLOT, LOADER_SLOT, 0, 1, 2, 3, 4, 5, 6, 7]);
});

// ---- installing ----
// a whole, valid package the way wp2apps `pack` builds one: header (its own CRC over 0x34 bytes),
// image, relocation table; the header's CRC field covers image ‖ table
function pack(name: string, size: number, kind = 0, abiMinor = 3) {
  const body = new Uint8Array(size + 8).map((_, i) => (i * 31) & 0xff); // image + 2 relocs
  const h = new Uint8Array(64);
  const dv = new DataView(h.buffer);

  h.set(new TextEncoder().encode("WP2A"));
  dv.setUint16(4, 1, true);
  h[6] = kind;
  h[7] = abiMinor;
  h.set(new TextEncoder().encode(name), 8);
  dv.setUint32(32, 1, true);
  dv.setUint32(36, size, true);
  dv.setUint32(44, 2, true);
  dv.setUint32(48, crc32(body), true);
  dv.setUint32(0x34, crc32(h.subarray(0, 0x34)), true);
  const out = new Uint8Array(64 + body.length);

  out.set(h);
  out.set(body, 64);
  return out;
}
const state = (
  apps: Record<number, string>,
  abiMinor: number | null = 3,
  version = 2,
): Wp2State => ({
  stub: { version, abiMinor },
  loader: null,
  apps: Object.fromEntries(
    Object.entries(apps).map(([slot, name]) => [slot, parsePackageHeader(pack(name, 64))!]),
  ),
});

test("an app goes to its own slot when it's there, else the first free one; a loader to L", () => {
  const p = pack("workout", 300);

  expect(planInstall(p, state({ 0: "a", 4: "workout" }), crc32).slot).toBe(4);
  expect(planInstall(p, state({ 0: "a", 1: "b" }), crc32).slot).toBe(2);
  expect(planInstall(pack("loader", 300, 1), state({}), crc32).slot).toBe(LOADER_SLOT);
});

test.each([
  [
    "a full watch",
    pack("new", 64),
    state(Object.fromEntries([...Array(8)].map((_, i) => [i, `x${i}`]))),
    /slots are taken/,
  ],
  ["a newer ABI than the stub takes", pack("x", 64, 0, 4), state({}), /ABI 1\.4/],
  [
    "a damaged body",
    (() => {
      const p = pack("x", 64);

      p[100] ^= 1;
      return p;
    })(),
    state({}),
    /body checksum/,
  ],
  [
    "a damaged header",
    (() => {
      const p = pack("x", 64);

      p[9] ^= 1;
      return p;
    })(),
    state({}),
    /header checksum/,
  ],
  ["a truncated file", pack("x", 64).subarray(0, 100), state({}), /truncated/],
] as const)("refuses %s before sending anything", (_, data, st, why) => {
  expect(() => planInstall(data, st, crc32)).toThrow(why);
});

test("widget icons go whole to stub 10 and later, cut off for an older stub", async () => {
  const [icons, stripped] = await Promise.all([load(iconsUrl), load(strippedUrl)]);

  expect(planInstall(icons, state({}, 3, 10), crc32).body).toEqual(icons);
  expect(planInstall(icons, state({}, 3, 9), crc32).body).toEqual(stripped);
  expect(planInstall(icons, state({}, null, 1), crc32).body).toEqual(stripped);
  expect(planInstall(stripped, state({}, 3, 9), crc32).body).toEqual(stripped);
});

test.each([
  ["a bad magic", 0, 0x20],
  ["an unknown version", 4, 1],
  ["no icons", 5, -2],
  ["17 icons", 5, 15],
  ["another icon size", 6, 1],
  ["a nonzero pad", 7, 1],
  ["a bad CRC", 12, 1],
] as const)("refuses a widget icon trailer with %s", async (_, at, delta) => {
  const icons = await load(iconsUrl);
  const stripped = await load(strippedUrl);
  const bad = icons.slice();

  bad[stripped.length + at] += delta;
  for (const version of [9, 10])
    expect(() => planInstall(bad, state({}, 3, version), crc32)).toThrow(
      /broken widget icon trailer/,
    );
});

test("refuses a widget icon trailer that is cut short or runs long", async () => {
  const icons = await load(iconsUrl);
  const stripped = await load(strippedUrl);
  const long = new Uint8Array(icons.length + 1);

  long.set(icons);
  for (const bad of [icons.subarray(0, -1), long, icons.subarray(0, stripped.length + 5)])
    expect(() => planInstall(bad, state({}, 3, 10), crc32)).toThrow(/broken widget icon trailer/);
});

test("an older stub is sent the package without its icons, size and CRC to match", async () => {
  const [icons, stripped] = await Promise.all([load(iconsUrl), load(strippedUrl)]);
  const w = new Watch();
  const sent: [number, Uint8Array][] = [];
  let written = 0;
  let last = 0;

  w.send = async (key, payload) => {
    sent.push([key, payload!]);
    last = key;
    if (key === CMD.stubData) written += payload!.length - 4;
  };
  w.waitFor = async () => {
    if (last !== CMD.stubData) return new Uint8Array([0]);
    const r = new Uint8Array(5);

    new DataView(r.buffer).setUint32(1, written, true);
    return r;
  };
  await w.installPackage(icons, state({}, 3, 9));
  const begin = new DataView(sent[0][1].buffer);

  expect(begin.getUint32(1, true)).toBe(stripped.length);
  expect(begin.getUint32(5, true)).toBe(crc32(stripped));
  expect(written).toBe(stripped.length);
});

test("an install is BEGIN, DATA at the stub's offset in 128-byte pieces, END", async () => {
  const w = new Watch();
  const data = pack("workout", 300);
  const sent: [number, Uint8Array][] = [];
  let written = 0;
  let last = 0;

  w.send = async (key, payload) => {
    sent.push([key, payload!]);
    last = key;
    if (key === CMD.stubData) written += payload!.length - 4;
  };
  w.waitFor = async () => {
    if (last !== CMD.stubData) return new Uint8Array([0]);
    const r = new Uint8Array(5);

    new DataView(r.buffer).setUint32(1, written, true);
    return r;
  };
  const progress: number[] = [];

  expect(await w.installPackage(data, state({ 2: "workout" }), (p) => progress.push(p))).toEqual({
    name: "workout",
    slot: 2,
  });
  const begin = sent[0][1];

  expect(sent[0][0]).toBe(CMD.stubBegin);
  expect([...begin.subarray(0, 1)]).toEqual([2]);
  expect(new DataView(begin.buffer).getUint32(1, true)).toBe(data.length);
  expect(new DataView(begin.buffer).getUint32(5, true)).toBe(crc32(data));
  const pieces = sent.filter(([k]) => k === CMD.stubData).map(([, p]) => p);

  expect(pieces.map((p) => new DataView(p.buffer).getUint32(0, true))).toEqual(
    [...Array(Math.ceil(data.length / 128))].map((_, i) => i * 128),
  );
  expect(pieces.every((p) => p.length <= 4 + 128)).toBe(true);
  expect(sent.at(-1)![0]).toBe(CMD.stubEnd);
  expect(progress.at(-1)).toBe(100);
});

test("a busy slot says the app is running", async () => {
  const w = new Watch();

  w.send = async () => {};
  w.waitFor = async () => new Uint8Array([5]);
  await expect(w.installPackage(pack("workout", 64), state({}))).rejects.toThrow(/running/);
});
