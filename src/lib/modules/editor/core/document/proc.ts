// The Watch 3 Pro's procedural widgets as the document holds them: an image layer tagged 0x82
// whose 0x5c body (kept in `extra`) names the type. Types 0..3 are drawn like any image layer;
// 4..7 draw themselves (core/render/proc.ts).
import { TAG, unhex } from "../format";
import type { Layer } from "./doc";

export const RINGS = 4;
export const CLIPS = 5;
export const PANELS = 6;
export const CALORIES = 7;

export interface Proc {
  type: number;
  /** Type 6's panel, 0x5c byte 0x14: 0 weather, 1 heart rate, 2 SpO2, 3 stress, 4 sleep. */
  panel: number;
}

/** What a type 6 panel reads, as the data source id the simulator knows it by. */
const PANEL_SOURCES = [0x5f, 0x1a, 0x1b, 0x8c, 0x46];

/** A layer that draws itself, or null. */
export function procOf(l: Layer): Proc | null {
  if (l.kind === "group" || l.kind === "raw" || l.tag !== 0x82) return null;
  const body = l.extra?.find((e) => e.tag === TAG.proc);

  if (!body) return null;
  const v = unhex(body.hex);
  const type = v[0] | (v[1] << 8);

  return type > 3 ? { type, panel: v[0x14] ?? 0 } : null;
}

/** The sources a widget reads without naming them in its meta. */
export function procSources(l: Layer): number[] {
  const p = procOf(l);

  if (p?.type === CALORIES) return [0x1c];
  return p?.type === PANELS && p.panel < PANEL_SOURCES.length ? [PANEL_SOURCES[p.panel]] : [];
}

/** Whether any layer of the list, groups included, is a procedural widget of this type. */
export const hasProc = (layers: readonly Layer[], type: number): boolean =>
  layers.some((l) => procOf(l)?.type === type || (l.kind === "group" && hasProc(l.children, type)));
