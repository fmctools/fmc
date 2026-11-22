// What the App Loader firmware (fmctools/cmf-watch-sdk) keeps on the watch, as its stub reports
// it — the stub's own release and the package in each slot — and the checks a package passes
// before Watch.installPackage sends it (the same ones the stub runs when it lands).
//
// The stub answers INFO (0x90A0) on the stock command channel, under the session this app already
// holds. Stock firmware passes commands it doesn't know to a default branch that ignores them —
// the branch the stub hooks — so a stock watch simply doesn't answer.

/** Package slots 0–7 hold apps; L (0xFF) the loader. */
export const APP_SLOTS = 8;
export const LOADER_SLOT = 0xff;
/** INFO for this slot answers the stub's release instead of a header (stub 2+). */
export const STUB_SLOT = 0xfe;

export const STATUS_OK = 0;
export const STATUS_BAD_REQUEST = 1;

export interface Wp2Stub {
  /** 1 for every stub from before the release was readable. */
  version: number;
  /** The highest package abi_minor it takes; unknown on stub 1. */
  abiMinor: number | null;
}

export interface Wp2Package {
  name: string;
  version: number;
  /** 0 app, 1 loader */
  kind: number;
  abiMinor: number;
  size: number;
  /** CRC32 of image ‖ relocation table — the same build has the same one, on the watch and off. */
  crc: number;
}

export interface Wp2State {
  stub: Wp2Stub;
  loader: Wp2Package | null;
  /** slot → package, apps only */
  apps: Record<number, Wp2Package>;
}

export const HEADER_SIZE = 64;

// <4sHBB24sIIIIII8s: magic, abi, kind, abi_minor, name, version, size, entry, relocs, crc, header crc, reserved
export function parsePackageHeader(h: Uint8Array): Wp2Package | null {
  if (h.length < HEADER_SIZE || new TextDecoder().decode(h.subarray(0, 4)) !== "WP2A") return null;
  const dv = new DataView(h.buffer, h.byteOffset, HEADER_SIZE);
  const raw = h.subarray(8, 32);
  const nul = raw.indexOf(0);

  return {
    name: new TextDecoder().decode(nul < 0 ? raw : raw.subarray(0, nul)),
    version: dv.getUint32(32, true),
    kind: h[6],
    abiMinor: h[7],
    size: dv.getUint32(36, true),
    crc: dv.getUint32(48, true),
  };
}

export function parseStubReply(r: Uint8Array): Wp2Stub {
  // an older stub reads 0xFE as a bad slot
  if (r[0] === STATUS_BAD_REQUEST) return { version: 1, abiMinor: null };
  if (r.length !== 6 || r[0] !== STATUS_OK) throw new Error("unexpected stub reply");
  return { version: new DataView(r.buffer, r.byteOffset).getUint32(1, true), abiMinor: r[5] };
}

/** Is the catalog's build the one on the watch? Same name, same image. */
export const samePackage = (a: Wp2Package, b: Wp2Package) => a.name === b.name && a.crc === b.crc;

// ---- installing ----

export const STATUS_NAMES = [
  "OK",
  "bad request",
  "storage error",
  "out of sequence",
  "checksum mismatch",
  "busy",
  "invalid package",
  "no app",
  "full",
  "paused",
];
/** Bytes per DATA request: the stub's MAX_DATA, and what keeps a request in one BLE frame. */
export const MAX_DATA = 128;
const LOADER_SIZE = 0x1_0000;
const APP_SIZE = 0x2_0000;
// stub 1 doesn't say which abi_minor it takes; every stub on a watch so far takes 3
const DEFAULT_ABI_MINOR = 3;
// Widget icons (cmf-watch-sdk docs/app-icons.md): an optional trailer after the relocation table,
// outside the header's sizes and body CRC — "WP2W", version 1, count 1..16, size 40, 0, crc32 of the
// pixels, count × 40·40·3 bytes. Stubs before 10 refuse any byte past the relocations.
const STUB_TRAILER = 10;
const ICON_BYTES = 40 * 40 * 3;

function trailerOk(t: Uint8Array, crc32: (d: Uint8Array) => number) {
  if (t.length < 12 || new TextDecoder().decode(t.subarray(0, 4)) !== "WP2W") return false;
  const [version, count, side, zero] = t.subarray(4, 8);

  return (
    version === 1 &&
    count >= 1 &&
    count <= 16 &&
    side === 40 &&
    zero === 0 &&
    t.length === 12 + count * ICON_BYTES &&
    crc32(t.subarray(12)) === new DataView(t.buffer, t.byteOffset + 8, 4).getUint32(0, true)
  );
}

/**
 * The stub's own checks (wp2-core pkg.rs: parse_header, check_slot, the body CRC), run before a
 * byte goes out so a package that would be refused at the end isn't sent first. Returns the slot
 * it goes to: L for a loader, else the slot that already holds an app of that name (an update
 * replaces it), else the first free one — and `body`, what goes out: the package whole, or for a
 * stub before 10 without its widget icon trailer.
 */
export function planInstall(data: Uint8Array, state: Wp2State, crc32: (d: Uint8Array) => number) {
  const fail = (why: string) => {
    throw new Error(`can't install this package: ${why}`);
  };
  const h = parsePackageHeader(data);

  if (!h) fail("not a .wp2app");
  const pkg = h!;
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);

  if (crc32(data.subarray(0, 0x34)) !== dv.getUint32(0x34, true)) fail("header checksum");
  if (dv.getUint16(4, true) !== 1) fail("unknown ABI");
  const maxMinor = state.stub.abiMinor ?? DEFAULT_ABI_MINOR;

  if (pkg.abiMinor > maxMinor)
    fail(`it needs app ABI 1.${pkg.abiMinor}, the watch's App Loader takes up to 1.${maxMinor}`);
  const relocs = dv.getUint32(44, true);

  if (pkg.size > (pkg.kind === 1 ? LOADER_SIZE : APP_SIZE)) fail("too big for its slot");
  const end = HEADER_SIZE + pkg.size + 4 * relocs;

  if (data.length < end) fail("truncated or padded");
  if (data.length > end && !trailerOk(data.subarray(end), crc32))
    fail("broken widget icon trailer");
  if (crc32(data.subarray(HEADER_SIZE, end)) !== pkg.crc) fail("body checksum");
  const body = state.stub.version < STUB_TRAILER ? data.subarray(0, end) : data;

  let slot: number;

  if (pkg.kind === 1) slot = LOADER_SLOT;
  else if (pkg.kind === 0) {
    const same = Object.entries(state.apps).find(([, p]) => p.name === pkg.name);
    const free = Array.from({ length: APP_SLOTS }, (_, i) => i).find((i) => !state.apps[i]);

    if (same) slot = Number(same[0]);
    else if (free !== undefined) slot = free;
    else throw new Error(`all ${APP_SLOTS} app slots are taken — remove an app on the watch first`);
  } else throw new Error("can't install this package: unknown kind");
  return { pkg, slot: slot!, body };
}
