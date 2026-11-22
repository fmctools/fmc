// The whole chain over local face files, which are the vendor's and never committed.
//
//   FMC_WP3_FACES=~/Downloads/wp3-faces-for-wp2/wp3-original   Watch 3 Pro originals
//   FMC_WP2_FACES=/path/to/stock/watchfaces/files              Watch Pro 2 stock faces
//   npx vitest run --project unit wp3-corpus
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { assertFlashable, buildBin, hex, parseBin } from "$lib/modules/editor/core/format";
import { assertWatchCompat } from "$lib/modules/editor/core/format/compat";
import { fromLegacy, toLegacy } from "$lib/modules/editor/core/document/doc";

const corpus = (dir: string | undefined) =>
  dir
    ? readdirSync(dir)
        .filter((f) => f.endsWith(".bin"))
        .sort()
        .map((name): [string, Uint8Array] => [name, new Uint8Array(readFileSync(`${dir}/${name}`))])
    : [];

describe.each([
  ["watch_3_pro", process.env.FMC_WP3_FACES],
  ["watch_pro_2", process.env.FMC_WP2_FACES],
] as const)("local faces for %s", (device, dir) => {
  test.skipIf(!dir)("open and save byte for byte", () => {
    const files = corpus(dir);
    const broken = files.filter(
      ([, bin]) => hex(buildBin(toLegacy(fromLegacy(parseBin(bin)).doc))) !== hex(bin),
    );

    expect(files.length).toBeGreaterThan(0);
    expect(broken.map(([name]) => name)).toEqual([]);
  });

  test.skipIf(!dir)("still install on the watch they were made for", async () => {
    for (const [name, bin] of corpus(dir)) {
      expect(() => assertFlashable(bin, device), name).not.toThrow();
      await expect(
        assertWatchCompat(bin, device, async () => null),
        name,
      ).resolves.toBeUndefined();
    }
  });
});
