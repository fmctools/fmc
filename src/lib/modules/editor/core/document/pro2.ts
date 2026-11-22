// A Watch 3 Pro face as a copy a stock Watch Pro 2 shows: ETC2 and A8 images as cf 5, and what
// the colour theme picked pinned to the theme that is selected. A converted copy for export —
// the open document is never replaced by it.
//
// The palette's numbers are left alone: the theme the wearer picked overrides a layer's number,
// and the factory thumbnails don't agree with a straight renumbering of the two palettes.
import { decodePixels, encodePixels, screenBytes } from "../format";
import { PRO2_TESTED_BYTES } from "../format/compat";
import { framesOf, toLegacy, type Doc, type ImageId, type Layer } from "./doc";
import { PRO2_CONVERTS, THEME_SOURCE, watchSupport } from "./support";

export type Pro2Problem =
  | { reason: "none" | "pro3Only" | "theme" }
  | { reason: "tooHeavy"; bytes: number };

// only a picked image can be pinned: a printed number or a condition would need the number itself
const unpinnable = (layers: readonly Layer[]): boolean =>
  layers.some(
    (l) =>
      l.conditions.some((c) => c.source === THEME_SOURCE) ||
      (l.kind === "group"
        ? unpinnable(l.children)
        : l.kind !== "raw" && l.kind !== "image" && l.meta.source === THEME_SOURCE),
  );

/** Why this face has no Watch Pro 2 copy, or null when it has one. */
export function pro2Problem(doc: Doc): Pro2Problem | null {
  const support = watchSupport(doc);

  if (support === "none" || support === "pro3Only") return { reason: support };
  if (doc.screens.some((s) => unpinnable(s.layers))) return { reason: "theme" };
  const { screens, resources } = toLegacy(doc);
  const converted = resources.map((r) => (PRO2_CONVERTS.includes(r.cf) ? { ...r, cf: 5 } : r));

  for (const screen of screens) {
    const bytes = screenBytes(screen, converted);

    if (bytes > PRO2_TESTED_BYTES) return { reason: "tooHeavy", bytes };
  }
  return null;
}

/** The converted copy; ask pro2Problem first. */
export function forPro2(doc: Doc, theme: number): Doc {
  const used = new Set<ImageId>();
  const pin = (l: Layer): Layer => {
    if (l.kind === "group") return { ...l, children: l.children.map(pin) };
    if (l.kind === "raw") {
      framesOf(l).forEach((id) => used.add(id));
      return l.children ? { ...l, children: l.children.map(pin) } : l;
    }
    let next: Layer = l;

    if (l.kind === "image" && l.meta.source === THEME_SOURCE && l.frames.length)
      next = {
        ...l,
        frames: [l.frames[theme % l.frames.length]],
        meta: { ...l.meta, source: 0, sub: 0, max: 0 },
      };
    framesOf(next).forEach((id) => used.add(id));
    return next;
  };
  const screens = doc.screens.map((s) => ({ ...s, layers: s.layers.map(pin) }));
  const images = new Map(doc.images);

  for (const id of used) {
    const a = doc.images.get(id);

    if (!a || !PRO2_CONVERTS.includes(a.cf)) continue;
    const r = encodePixels(decodePixels(a)!, a.w, a.h, 5);

    images.set(id, { ...a, cf: r.cf, data: r.data });
  }
  return { ...doc, screens, images };
}
