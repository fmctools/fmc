// Which watch a face is safe on: by its procedural widgets (tag 0x82 with a 0x5c body), and for a
// Watch Pro 2 by the Watch 3 Pro's image formats too (the end of assertWatchCompat).
//
// Both watches' firmware looks the widget's type (a u16) up in a table that ends in 0xffff with a
// loop that stops at 0xff, so a type the table doesn't have reads on past it and calls whatever
// matches. Watch Pro 2 (1.0.0.73) has types 0..3, Watch 3 Pro (1.0.1.77) 0..7; stub 10 of
// cmf-watch-sdk draws 4..7 on a Watch Pro 2. Seen in the cmf-watch-utils emulator: types 5..7 and
// 4 with images boot-loop a Pro 2; 8 and 0xffff fault both watches.
//
// This reads the raw bytes the way the firmware's parser does (WP2 0x100DB1B4, reached from a
// screen's layers and from groups) and not through parseBin: the parser reads the image list at a
// fixed offset whatever the struct's length is, so a type 4 with a short struct and a condition
// after it "has images" on the watch and boot-loops it, with none in the tree.

import { parseBin } from "./bin";
import { screenBytes } from "./budget";
import type { FaceNode, Resource } from "./raw";
import { TAG, u16 } from "./raw";

/** The stub release that draws types 4..7 on a Watch Pro 2, or null while none has shipped: then
 *  no Pro 2 gets them and nobody asks for its stub. Set it only once the number is reserved in
 *  cmf-watch-sdk and tried on a real watch — two branches there have both called themselves 9. */
export const PRO2_FACES_STUB: number | null = null;

/** Decoded bytes a screen is known to load on a Watch Pro 2.
 *  ponytail: not its limit, which is unknown — in the emulator synthetic full-screen layers load
 *  at 1.95 MB and fail at 2.6, while stock Ring_data runs with 3.7. So only what FMC itself
 *  unpacks for a Pro 2 is held to it; measure the heap to raise it. */
export const PRO2_TESTED_BYTES = 1_955_000;

const HDR = 36;
const PROC = 0x82;
const PRO2_LAST = 3;
const PRO3_LAST = 7;

export interface ProcWidget {
  type: number;
  /** The firmware's first-image lookup finds a list: it creates a type 4 then. */
  hasImages: boolean;
}

/** The face's procedural widgets as the firmware would read them; throws when it can't be walked. */
export function procWidgets(d: Uint8Array): ProcWidget[] {
  const unreadable = () =>
    new Error(
      "FMC can't read this file, so it can't check that the watch will survive it. Nothing was sent to the watch.",
    );
  const found: ProcWidget[] = [];

  const widget = (at: number, len: number) => {
    const body = at + 3;

    // the firmware's search: it steps into a tag with bit 0x20 and over any other
    for (let i = 0; len > 3 && i < len;) {
      const p = body + i;
      const n = u16(d, p + 1);

      if (d[p] === TAG.proc && len - i >= n + 3) {
        // body+0 is the struct: its list sits at +0x15 of the node, inside it or past its end
        const list = d[body + 0x15];
        const count = d[body + 0x16];
        const hasImages =
          d[body] !== TAG.struct ||
          (count !== 0 && (list & 0xf) !== 0 && [0, 1, 3].includes(list >> 5));

        found.push({ type: u16(d, p + 3), hasImages });
        return;
      }
      i += 3 + (d[p] & 0x20 ? 0 : n);
    }
  };
  // layers of a screen or a group; the root's children are screens, or layers with no 0x21 first
  const walk = (from: number, end: number, root = false) => {
    for (let at = from; at < end;) {
      if (at + 3 > end) throw unreadable();
      const len = u16(d, at + 1);
      const next = at + 3 + len;

      if (next > end) throw unreadable();
      const tag = d[at];

      if (tag === PROC) widget(at, len);
      else if (tag === TAG.group || (root && (tag === TAG.main || tag === TAG.aod)))
        walk(at + 3, next);
      at = next;
    }
  };

  if (d.length < 2 * HDR + 3 || d[HDR] !== TAG.root) throw unreadable();
  const end = HDR + 3 + u16(d, HDR + 1);

  if (end > d.length - HDR) throw unreadable();
  walk(HDR + 3, end, true);
  return found;
}

/** A type no watch's table holds. */
export const isUnknownWidget = (w: ProcWidget) => w.type > PRO3_LAST;

/** Safe on `device` without patched firmware. */
export function stockSafe(w: ProcWidget, device: string | null): boolean {
  if (w.type <= PRO2_LAST) return true;
  if (device === "watch_3_pro") return w.type <= PRO3_LAST;
  // a Pro 2 drops an imageless type 4 in the parser, before it gets to the table
  return device === "watch_pro_2" && w.type === 4 && !w.hasImages;
}

/** The colour formats of everything a screen can draw, every frame of every run; the embedded
 *  thumbnail, which the face picker shows, left out. */
export function drawnFormats(screen: FaceNode, resources: Resource[]): Set<number> {
  const formats = new Set<number>();
  const walk = (n: FaceNode) => {
    if (n.tag === TAG.preview) return;
    n.images?.forEach((i) => formats.add(resources[i].cf));
    n.subs?.forEach(walk);
  };

  walk(screen);
  return formats;
}

/** Bytes a screen takes with its ETC2 images unpacked to cf 5, which is how a Watch Pro 2 holds
 *  them (stub 10 does it on load, FMC's export does it in the file). */
export const unpackedBytes = (screen: FaceNode, resources: Resource[]) =>
  screenBytes(
    screen,
    resources.map((r) => (r.cf === 28 ? { ...r, cf: 5 } : r)),
  );

/**
 * Throws when this face would restart this watch, running this firmware, in a loop. `readStub`
 * is asked only when the answer depends on it, and no answer counts as stock. Run it on the bytes
 * that go out, after fitForWatch and assertFlashable.
 */
export async function assertWatchCompat(
  bin: Uint8Array,
  device: string | null,
  readStub: () => Promise<number | null>,
  minStub: number | null = PRO2_FACES_STUB,
): Promise<void> {
  const widgets = procWidgets(bin);
  const unknown = widgets.find(isUnknownWidget);

  if (unknown)
    throw new Error(
      `this face has a widget of type ${unknown.type}, which no supported watch knows — it can restart a watch in a loop. Nothing was sent to the watch.`,
    );
  const unsafe = widgets.find((w) => !stockSafe(w, device));

  if (unsafe) {
    const stub =
      device === "watch_pro_2" && minStub !== null ? await readStub().catch(() => null) : null;

    if (minStub === null || stub === null || stub < minStub)
      throw new Error(
        `this face has a Watch 3 Pro widget (type ${unsafe.type}) that this watch's firmware can't draw — the watch would restart in a loop. Nothing was sent to the watch.`,
      );
  }
  if (device !== "watch_pro_2") return;

  // whatever the stub's release says: one that decodes cf 28 may be on the watch already, and on
  // stock those images don't show at all
  const { screens, resources } = parseBin(bin);

  // unknown on a real watch, and no stub converts it. Every resource counts, the thumbnail (the
  // face picker draws it there too) and whatever the tree walk can't place: unknown means refused.
  // ponytail: lift it, or narrow it to the thumbnail, once cf 14 has been seen on a Watch Pro 2.
  if (resources.some((r) => r.cf === 14))
    throw new Error(
      "this face has A8 images (cf 14), which haven't been tested on a Watch Pro 2. Open it in the editor, use Export for Watch Pro 2 and install the exported file. Nothing was sent to the watch.",
    );

  for (const screen of screens) {
    const etc2 = drawnFormats(screen, resources).has(28);
    const bytes = etc2 ? unpackedBytes(screen, resources) : 0;

    if (bytes > PRO2_TESTED_BYTES)
      throw new Error(
        `this face's ETC2 images need ${(bytes / 1e6).toFixed(1)} MB unpacked on a Watch Pro 2, over the ${(PRO2_TESTED_BYTES / 1e6).toFixed(2)} MB tested there — the watch could restart in a loop. Nothing was sent to the watch.`,
      );
  }
}
