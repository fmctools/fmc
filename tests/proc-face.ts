// Synthetic Watch 3 Pro faces for the tests: no vendor art, every image is made here.
import { buildBin, encodePixels, hex, TAG, type Resource } from "$lib/modules/editor/core/format";
import type { FaceNode } from "$lib/modules/editor/core/format/raw";

/** A 14-byte widget meta: size, flags and data source. */
export function metaHex(w = 466, h = 466, source = 0, flags = 0): string {
  const m = new Uint8Array(14);

  m[0] = w;
  m[1] = w >> 8;
  m[2] = h;
  m[3] = h >> 8;
  m[7] = flags;
  m[9] = source;
  return hex(m);
}

/** Opaque squares, each its own grey, so a drawn index can be told from its neighbour. */
export const squares = (n: number, cf = 5, w = 4, h = 4): Resource[] =>
  Array.from({ length: n }, (_, i) => {
    const px = new Uint8ClampedArray(w * h * 4);

    for (let o = 0; o < px.length; o += 4) px.set([(i * 3) % 256, 128, 64, 255], o);
    return encodePixels(px, w, h, cf);
  });

export interface Proc {
  type: number;
  sub?: number;
  /** 0x5c payload length. */
  len?: number;
  images?: number[];
  /** What follows the meta of a struct with no images; "" is the short struct. */
  tail?: string;
  conditions?: string;
}

/** A 0x82 widget with its 0x5c body. */
export function procNode({
  type,
  sub = 0,
  len = 25,
  images,
  tail = "0000",
  conditions,
}: Proc): FaceNode {
  const body = new Uint8Array(len);

  body[0] = type;
  body[1] = type >> 8;
  if (len > 0x14) body[0x14] = sub;
  const st: FaceNode = { tag: TAG.struct, x: 0, y: 0, meta: metaHex() };

  if (images?.length) {
    st.refType = 0x61;
    st.images = images;
  } else if (tail) st.tail = tail;

  return {
    tag: 0x82,
    subs: [
      st,
      ...(conditions ? [{ tag: TAG.bind, hex: conditions }] : []),
      { tag: 0x5c, hex: hex(body) },
    ],
  };
}

export const imageNode = (images: number[], source = 0, flags = 0): FaceNode => ({
  tag: TAG.image,
  subs: [
    { tag: TAG.struct, x: 0, y: 0, meta: metaHex(4, 4, source, flags), refType: 0x61, images },
  ],
});

/** A main screen holding `layers`, with the preview every flashable face carries. */
export function faceBin(
  layers: FaceNode[],
  resources: Resource[] = [],
  { title = true, header = "Synthetic" } = {},
): Uint8Array {
  // resource indices in `layers` count from the caller's list: the preview goes last
  const preview: FaceNode = {
    tag: TAG.preview,
    subs: [{ tag: 0x08, prefix: "0000000000", refType: 0x01, images: [resources.length] }],
  };

  return buildBin({
    name: header,
    screens: [
      {
        tag: TAG.main,
        subs: [...(title ? [{ tag: TAG.name, text: header }] : []), ...layers, preview],
      },
    ],
    // the size of a real thumbnail: a smaller one loses a panel's thin glyphs
    resources: [...resources, ...squares(1, 4, 270, 270)],
  });
}
