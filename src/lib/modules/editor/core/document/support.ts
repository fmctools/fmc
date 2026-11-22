// Where the open face can go, for the note under the editor's canvas. The widgets are judged by
// the install's own rule on the bytes this document lays out (core/format/compat.ts), so the
// note can't promise what the gate then refuses.
import { buildBin } from "../format";
import { drawnFormats, isUnknownWidget, procWidgets, stockSafe } from "../format/compat";
import { toLegacy, type Doc, type Layer } from "./doc";

/** The colour theme's number: a source only a Watch 3 Pro answers. */
export const THEME_SOURCE = 0x99;
/** What the export re-encodes: A8 (not sent to a Watch Pro 2) and ETC2 (stock doesn't show it). */
export const PRO2_CONVERTS = [14, 28];

/**
 * `none`: a widget no watch knows. `pro3Only`: one a Watch Pro 2 would boot-loop on.
 * `pro2Converts`: a Pro 2 needs the converted export. `pro2Drops`: it runs there, minus a widget.
 * null: nothing to say.
 */
export type Support = "none" | "pro3Only" | "pro2Converts" | "pro2Drops" | null;

const NO_BYTES = new Uint8Array(0);

const readsTheme = (layers: readonly Layer[]): boolean =>
  layers.some(
    (l) =>
      l.conditions.some((c) => c.source === THEME_SOURCE) ||
      (l.kind === "group"
        ? readsTheme(l.children)
        : l.kind !== "raw" && l.meta.source === THEME_SOURCE),
  );

export const usesTheme = (doc: Doc) => doc.screens.some((s) => readsTheme(s.layers));

export function watchSupport(doc: Doc): Support {
  const face = toLegacy(doc);
  let widgets;

  try {
    // structure only: the payloads don't matter to the check, and this runs on every edit
    const light = { ...face, resources: face.resources.map((r) => ({ ...r, data: NO_BYTES })) };

    widgets = procWidgets(buildBin(light));
  } catch {
    return null; // a document that can't be laid out says why on export
  }
  if (widgets.some(isUnknownWidget)) return "none";
  if (widgets.some((w) => !stockSafe(w, "watch_pro_2"))) return "pro3Only";
  // A8 anywhere, the thumbnail included, is refused at install (compat.ts); ETC2 only matters
  // where a screen draws it
  const converts =
    face.resources.some((r) => r.cf === 14) ||
    face.screens.some((s) => drawnFormats(s, face.resources).has(28));

  if (converts || usesTheme(doc)) return "pro2Converts";
  return widgets.some((w) => w.type === 4) ? "pro2Drops" : null;
}
