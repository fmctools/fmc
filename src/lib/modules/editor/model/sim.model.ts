// The simulator: the fake watch state the canvas renders against (time, steps, accent colour)
// plus the list of data sources the current document actually reads, which is what the panel
// offers to override.
import { createEvent, createStore, sample } from "effector";
import { collectIdsDoc, defaultSim, type Sim } from "../core/document/sources";
import { CLIPS, hasProc, RINGS } from "../core/document/proc";
import { nextClip } from "../core/render/proc-scene";
import type { Point } from "../core/render/canvas";
import type { Doc } from "../core/document/doc";
import { $doc, docLoaded } from "./doc.model";

// ---- stores ----
export const $sim = createStore<Sim>(defaultSim());
/** Every data source appearing in the document, with the max its widget declares. */
export const $ids = createStore<{ id: number; max: number }[]>([]);

// ---- events ----
export const simPatched = createEvent<Partial<Sim>>();
export const overrideSet = createEvent<{ id: number; value: number | string }>();
/** A finger on the preview, for the widgets that answer one (types 4 and 5). */
export const watchPressed = createEvent<Point>();
export const watchReleased = createEvent();
/** A press that didn't turn into a drag; payload: when. */
export const watchTapped = createEvent<number>();

const answers = (doc: Doc | null, type: number) =>
  Boolean(doc?.screens.some((s) => hasProc(s.layers, type)));

// ---- business logic ----
sample({
  clock: simPatched,
  source: $sim,
  fn: (sim, patch) => ({ ...sim, ...patch }),
  target: $sim,
});
sample({
  clock: overrideSet,
  source: $sim,
  fn: (sim, { id, value }) => ({ ...sim, overrides: { ...sim.overrides, [id]: value } }),
  target: $sim,
});
// the source list follows the document: a new layer can introduce a source, deleting one can
// retire it, so it is recomputed rather than patched at every edit site
sample({
  clock: $doc,
  filter: Boolean,
  fn: collectIdsDoc,
  target: $ids,
});
sample({
  clock: watchPressed,
  source: { doc: $doc, sim: $sim },
  filter: ({ doc }) => answers(doc, RINGS),
  fn: ({ sim }, touch) => ({ ...sim, touch }),
  target: $sim,
});
sample({
  clock: watchReleased,
  source: $sim,
  filter: (sim) => sim.touch !== null,
  fn: (sim) => ({ ...sim, touch: null }),
  target: $sim,
});
sample({
  clock: watchTapped,
  source: { doc: $doc, sim: $sim },
  filter: ({ doc }) => answers(doc, CLIPS),
  fn: ({ sim }, clipAt) => ({ ...sim, clip: nextClip(sim.clip), clipAt }),
  target: $sim,
});
// a watch switched to another face starts its clips over
sample({
  clock: docLoaded,
  source: $sim,
  filter: (sim) => sim.clipAt !== null || sim.touch !== null,
  fn: (sim) => ({ ...sim, touch: null, clip: 0, clipAt: null }),
  target: $sim,
});
