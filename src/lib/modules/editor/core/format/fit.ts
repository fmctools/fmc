// A face file made smaller in RAM before it goes to a watch: what the watch would decode
// anyway, stored in a format that costs it less (see budget.ts for why it matters).

import { buildBin, parseBin } from "./bin";
import { decodedBytes, overBudget, shownResources, TO_ETC2 } from "./budget";
import { PRO2_CONVERTS, PRO2_TESTED_BYTES, unpackedBytes } from "./compat";
import { decodePixels, encodePixels } from "./pixels-codec";
import type { Resource } from "./raw";

const opaque = (px: Uint8ClampedArray) => {
  for (let i = 3; i < px.length; i += 4) if (px[i] !== 255) return false;
  return true;
};

/** cf 5 with no transparent pixel is cf 4 plus a byte of 255 per pixel: drop it, lossless. */
function dropOpaqueAlpha(r: Resource): Resource {
  if (r.cf !== 5) return r;
  const px = decodePixels(r)!;

  return opaque(px) ? encodePixels(px, r.w, r.h, 4) : r;
}

/**
 * The file as it should go to the watch. Every model: opaque cf 5 images become cf 4. A Watch 3
 * Pro screen still over its budget then has its largest shown images re-encoded as ETC2 (cf 28,
 * 1 byte per pixel, the format the watch's own faces use) until it fits — lossy, so only as far
 * as needed. JPEG is left alone. `bin` is the input itself when nothing changed, and a file it
 * can't parse comes back untouched (assertFlashable decides about those); `compressed` counts
 * the images re-encoded as ETC2.
 */
export interface Fitted {
  bin: Uint8Array;
  compressed: number;
  /** Images a Watch Pro 2 gets as cf 4/5 instead of A8 or ETC2. */
  converted: number;
}

export function fitForWatch(bin: Uint8Array, device: string | null): Fitted {
  let face;

  try {
    face = parseBin(bin);
  } catch {
    return { bin, compressed: 0, converted: 0 };
  }
  let changed = false,
    compressed = 0,
    converted = 0;
  const swap = (i: number, r: Resource) => {
    if (r === face.resources[i]) return;
    face.resources[i] = r;
    changed = true;
  };

  // A Watch Pro 2 gets the Watch 3 Pro's formats as cf 5 — what Export for Watch Pro 2 does by
  // hand, the thumbnail included — unless a screen would then need more than it has been tested
  // with; the gate refuses that face (compat.ts). First, so an opaque one goes on to cf 4.
  if (
    device === "watch_pro_2" &&
    face.resources.some((r) => PRO2_CONVERTS.includes(r.cf)) &&
    face.screens.every((s) => unpackedBytes(s, face.resources) <= PRO2_TESTED_BYTES)
  )
    face.resources.forEach((r, i) => {
      if (!PRO2_CONVERTS.includes(r.cf)) return;
      swap(i, encodePixels(decodePixels(r)!, r.w, r.h, 5));
      converted++;
    });
  face.resources.forEach((r, i) => swap(i, dropOpaqueAlpha(r)));
  if (device === "watch_3_pro")
    for (const { screen } of overBudget(face)) {
      const heaviest = [...shownResources(screen, face.resources)]
        .filter((i) => TO_ETC2.includes(face.resources[i].cf))
        .sort((a, b) => decodedBytes(face.resources[b]) - decodedBytes(face.resources[a]));

      for (const i of heaviest) {
        if (!overBudget(face).some((s) => s.screen === screen)) break;
        const r = face.resources[i];

        swap(i, encodePixels(decodePixels(r)!, r.w, r.h, 28));
        compressed++;
      }
    }
  return { bin: changed ? buildBin(face) : bin, compressed, converted };
}

/** fitForWatch in a worker (fit.worker.ts), so the page stays responsive while a heavy face is
 *  re-encoded. Same answer, including the input itself when nothing changed.
 *  ponytail: a worker per call — a flash is rare and the worker is gone once it answers. */
export function fitForWatchOffThread(bin: Uint8Array, device: string | null): Promise<Fitted> {
  const worker = new Worker(new URL("./fit.worker.ts", import.meta.url), { type: "module" });

  return new Promise<Fitted>((resolve, reject) => {
    worker.onmessage = ({
      data,
    }: MessageEvent<{
      out?: Uint8Array | null;
      compressed?: number;
      converted?: number;
      error?: string;
    }>) =>
      data.error
        ? reject(new Error(data.error))
        : resolve({
            bin: data.out ?? bin,
            compressed: data.compressed ?? 0,
            converted: data.converted ?? 0,
          });
    worker.onerror = (e) => {
      e.preventDefault();
      reject(new Error(e.message || "the face could not be prepared for the watch"));
    };
    worker.postMessage({ bin, device });
  }).finally(() => worker.terminate());
}
