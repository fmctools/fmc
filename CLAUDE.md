# fmc_frontend — project rules

SvelteKit (Svelte 5 runes) + hand-written components with token-based scoped CSS
(no Tailwind, no shadcn/bits-ui), static SPA build
(`@sveltejs/adapter-static`, `fallback: 'index.html'`). Backend — the sibling repo
`fmc_pocketbase` (PocketBase); the address comes from `VITE_PB_URL` (set in dev via `.env`,
pointing straight at PocketBase — no vite dev-server proxy involved), and falls back to
same-origin (`location.origin`) without it, which is what prod uses — through Caddy on the
same domain as the backend (see `fmc_pocketbase/README.md`).

App: the store at the root, three shelves under one "Store" tab — watchfaces (`/`, with
`?mine` for the signed-in user's own shelf; `/my`
redirects there; `/market/[id]` — a face's showcase page), apps (`/apps`, `/apps/[id]` —
`.wp2app` packages published from fmctools/apps, built with the wp2-apps SDK) and firmware (`/firmware`,
`/firmware/[id]` — OTA images), plus a Community section (`/community`, links out; the old
`/?community` redirects there); creator profiles (`/user/[id]`), watchface editor (`/editor`,
with a BLE connection to the CMF Watch Pro 2) and auth (`/login`, `/register`).

Apps and firmware are curated: the `apps` and `firmwares` collections are writable only by a
PocketBase superuser; the frontend lists them, downloads them, and puts them on a watch. Flashing
a firmware image from its page (`Watch.flashFirmware`, the stock CMF OTA protocol, port of
cmf-watch-utils `ota_client.py`) waits for the at-your-own-risk tick, and every image passes
`device/lib/ota-image.ts` (AOTA CRCs, AGPS trailer, and `checkOtaTarget`: the image's board must be
the board, in `BOARDS`, of the connected watch by its advertised name and of the record's `device`)
before a byte goes out; only a Watch Pro 2 at 50% or more is offered the update. With another
model connected (`$wrongWatch`), the firmware page says so and Install is off; Download stays.
The catalog itself isn't checked — a PocketBase hook for it was tried and rolled back. Installing an app or the App Loader
(`Watch.installPackage`: BEGIN/DATA/END to the wp2-apps stub, checked first by `planInstall` in
`wp2.ts` the way the stub checks it) writes only the App Loader's files, never the firmware. The
store reads what the watch runs (`Watch.readWp2`: INFO to the stub — a stock watch doesn't
answer) and badges apps and firmware "Installed" / "Update": an app or the App Loader by its
build CRC against the catalog package's header, firmware by the record's `stub` number against
the stub's reported release. The App Loader record (`kind: loader`) sits on the firmware shelf
but never goes down the OTA path. A detail page is one action block — a red at-your-own-risk
plate for firmware, Download and Install, one progress bar — with everything else folded under
Details. The Developer panel (`dev-sheet`, a button in the connected watch panel) is the developer's way around the catalog: a local `.wp2app`
or OTA image picked from disk (`devModel`, a File System Access handle so "Install again" re-reads
a rebuild) goes through the same `planInstall` / `checkOtaTarget` gates — nothing is uploaded.
Don't add an upload form for either without an explicit ask: a firmware image can brick
a watch.

## Architecture

Modular structure like in gymmate — all code in TypeScript:

```
src/lib/
  shared/
    api/          # PocketBase client (pb, fileUrl, downloadUrl)
    styles/       # tokens.css — design tokens, the only source of colors/type/motion
    lib/          # tiny pure helpers shared by modules (format.ts: compact numbers, dates)
    components/   # one folder per component (button/, input/, dialog/, …) + barrel index.ts;
                  # app chrome: app-nav/ (floating dock on a phone, left rail on md+),
                  # store-tabs/ (the store's sections, a segmented row — every shelf page opens with it),
                  # page/ (a routed page's frame: header + one scroller that runs under the
                  # phone's floating dock); prose/ (a record's markdown, sanitized)
  modules/<feature>/   # auth, market, store (apps + firmware), editor, device
    model/        # <feature>.model.ts + index.ts (export * as fooModel)
    core/         # editor only: the domain, split by concern (see the map below)
    lib/          # other modules' domain libraries (see the device map below)
    components/   # module components
    pages/        # pages + index.ts (export { default as FooPage })
src/routes/       # thin: import a page from the module and render it
```

The editor's domain sits under `editor/core/`, in four folders that answer four different
questions — keep them that way instead of growing one file:

```
editor/core/
  format/          # the .bin file, and nothing about editing
    bin.ts           parseBin/buildBin: TLV tree, header, resource table
    lz4.ts           the block codec every resource payload is stored under
    pixels-codec.ts  Resource payload <-> RGBA (cf 4/5/13/24/28, 1 = JPEG)
    etc2.ts          cf 28 (ETC2 RGBA8) block codec
    budget.ts        what a screen takes in a Watch 3 Pro's RAM (SCREEN_BUDGET)
    fit.ts           fitForWatch: the file shrunk in RAM before it goes to a watch
    compat.ts        which watch and firmware a face may go to: widgets (raw bytes), A8, ETC2
    raw.ts           Face/FaceNode/Resource + TAG + byte primitives
  document/        # the document the editor edits
    doc.ts           Doc/Layer/Screen, meta + condition decoding, fromLegacy/toLegacy
    edits.ts         pure Doc -> Doc edits: add/remove/move/group/patch
    factory.ts       the layers the editor creates from scratch, and a blank document
    sources.ts       data sources: id labels, Sim, idValue, slot/condition helpers
    proc.ts          the Watch 3 Pro's procedural widgets (0x82 + 0x5c) as layers
    support.ts       where the open face can go — the editor's note, by compat.ts's rule
    pro2.ts          the converted copy Export for Watch Pro 2 downloads
  render/
    render.ts        draw a screen from a Doc: per-kind draw functions + group auto-layout
    canvas.ts        renderer types (Ctx/Point/Size/LayerHit/ImageStore)
    arc.ts           progress rings: 0x5a/0x5b spec, fill fraction, both draw paths
    proc-scene.ts    types 4..7's layout, a port of cmf-watch-sdk's wfproc.rs — change them together
    proc.ts          the simulator's values fed to that layout, and its drawing
    pixels.ts        asset pixels: decode, resize/adjust, accent tint, previews
    screen.ts        screen and panel dimensions
    overlay.ts       editor chrome over a screen: selection boxes, handles, snap guides
  import/          # other apps' formats -> Face -> fromLegacy
    facer/           assets.ts (files/images/fonts), text.ts (tags), index.ts
    watchmaker.ts
    wff.ts           Wear OS Watch Face Format: unzips a .aab, bakes res/raw/watchface.xml
    field.ts         the live-text row every importer emits (Part/Live + buildRow)

device/lib/
  ble-protocol.ts  # GATT ids, command table, 0xF5 frame codec (AES/CRC)
  ble.ts           # Web Bluetooth session: connect, pair, upload, firmware update
  ota-image.ts     # the AOTA firmware container: verify before offering it to a watch
  wp2.ts           # what the App Loader stub reports: its release, the loader, the apps by slot
```

Every watchface install ends in `flashFx` (`ble.model`): `fitForWatch`, `assertFlashable`, then
`assertWatchCompat` (`core/format/compat.ts`) on the bytes that go out. The last one reads the raw
file as the firmware's parser does, because a wrong verdict is a boot loop: never move it onto
`parseBin`'s tree, and don't add a way to send a face around it. `PRO2_FACES_STUB` stays null
until a stub release that draws types 4..7 has its number reserved in cmf-watch-sdk and is tried
on a real watch, and a Watch Pro 2 gets no cf 14 until that is seen working on one. A procedural
layer's rules (fixed image count, type 4 doesn't move, no rescale) live in `edits.ts` `procPatch`
and `overlay.ts` `resizable`.

`Face`/`FaceNode` are the file's own shape, not the editor's: `parseBin` produces them,
`fromLegacy` turns them into a `Doc`, `toLegacy` turns one back, and the importers build them
because that is the cheapest target to convert into. Nothing else should touch them — the editor
edits a `Doc`.

The editor inspector is split the same way: `components/props/` holds `geometry`, `adjust`, `source`
and `frames` sections; `PropsPanel.svelte` is the container and owns the shared field CSS
(via a `:global` block, so the sections only carry styles that are theirs).

- **All logic lives in effector models** (`modules/*/model/*.model.ts`). Components are
  view only: `import { editorModel } from '../model'`, destructure stores/events at the
  top, subscribe via `$store`. Don't put business logic or data loading in components.
  A component's own `$state` is for view-local, throwaway things only — an element ref, a
  drag in progress, which row is hovered. Anything an action reads (form fields, a
  computed preview, a list fetched or derived from somewhere) belongs in a store, even if
  only one component uses it: a dialog with more than a couple of fields gets its own
  `<feature>.model.ts` rather than a pile of `$state` (see `font-sprite.model.ts`).
- Domain types: `Doc`, `Layer`, `Screen`, `ImageAsset`, `NodeId`/`ImageId` — in
  `core/document/doc.ts`; `Sim` — in `core/document/sources.ts`; `LayerHit`, `ImageStore` — in
  `core/render/canvas.ts`; `Face`/`FaceNode`/`Resource` — in `core/format/raw.ts` (file shape only).
- All Svelte components use `<script lang="ts">` — TypeScript everywhere, no plain-JS `<script>`.
- Cross-module imports — through barrels: `$lib/modules/auth/model`, `$lib/modules/device/model`.

## Effector conventions

- **Never `store.getState()`** — anywhere, including inside an effect. State reaches an effect as
  a parameter: `attach({ source: $doc, effect(doc, params) {…} })` for one that's called, or
  `sample({ clock, source: $doc, fn, target })` for one that's triggered. Components read the
  store through `$store`; code that needs a value outside a reactive context (an rAF loop) mirrors
  `$store` into a plain local, it doesn't reach back into the store. Enforced by the
  `effector/no-get-state` oxlint rule (tests are exempt — they assert on `$store.getState()`).
- One-shot user actions (delete layer, group, align, export) are a plain event the component fires
  - an `attach`ed effect wired with `sample({ clock: event, target: fx })`. Only queries that hand a
    value back (`buildCurrentBin`, `previewBlob`, `previewThumb`) are exported as callable effects.
- Busy flags — from `someFx.pending`, don't add manual `$state` flags.
- Effect errors — via `fail`/`failData` into an error store (`errored` in editor, `marketErr` in market).
- Fire-and-forget effect calls in components — with `.catch(() => {})`, the error is already
  handled in the model.
- The editor model is split by concern, one file each, all re-exported through `editor.model.ts`
  so components keep importing a single `editorModel`:
  `doc.model` (the `Doc` + history), `selection.model` (`$sel`/`$more`/`$screen`, by `NodeId`),
  `sim.model`, `ui.model` (panel tab, last error), `assets.model` (assets + the bitmap cache),
  `edit.model` (every action on the existing layer tree), `create.model` (adding what wasn't
  there: new widgets, generated frames, slot metric icons, the AOD screen), `io.model`
  (open/create/import/export),
  `font-sprite.model` (the "sprites from a font" generator: dialog, form, preview).
- **The document is immutable.** Every edit is a pure `Doc -> Doc` function from
  `core/document/edits.ts`, handed to `committed` — which checkpoints and applies in one step, and
  skips both when the edit returns the document unchanged (a rejected move must not eat an undo).
  Undo/redo is therefore a stack of `Doc` references, not serialized trees.
- Layers are addressed by `NodeId`, never by object reference: an immutable edit rebuilds the
  objects, so a stored reference goes stale while the id doesn't.
- Decoded pixels are NOT part of the document: `assets.model`'s `$cache` holds `ImageBitmap`s and
  is merged **field by field**, because the accent pass is async and reports only its own tint —
  replacing whole entries would drop a `bitmap`/`original` written while it was running.
  A document and its decoded pixels arrive together, in `docLoaded`.
- The canvas is drawn via rAF off a plain mirror of the stores (see `snapshot` in editor.svelte),
  so the render effect isn't re-run — and restarted — by every store update.

## UI

- The look is Nothing OS: monochrome, true black in the dark scheme, dot-matrix display type,
  and red kept for signals. Design tokens in `lib/styles/tokens.css`: `--color-text`,
  `--color-background` (#000 dark), `--color-surface` (what floats over the page: dialog, sheet,
  menu), `--color-accent` (#d71921 — a dot, a ring, a link; never the fill of a main action,
  which is ink: `--color-text` under `--color-background`), `--color-on-accent` (white or black,
  derived from the accent's lightness, since the user can pick the accent), `--color-error`,
  `--color-selection` (#4af) and `--color-guide` (#ff44ff88), the editor canvas's selection
  boxes/handles and snap guides — read once via `getComputedStyle`, since a canvas can't take a
  var, `--border-radius` (controls), `--border-radius-tile` (cards, banners, dialogs),
  `--font-family` (Geist, self-hosted in `static/fonts/`), `--font-display` (Doto, dot matrix:
  the `display`/`title` steps and counts only — below ~1.5rem it stops reading),
  `--font-mono` (Geist Mono: badges and small labels), `--spring-transition`. Buttons take
  `.type-button` (body size, 600), `size="small"` + `.type-button-small` on a dense surface;
  icon-only controls are round, 2.75rem on a phone and a notch smaller with a cursor (from md up: a button and `--control-height` are 2.5rem, a small button and a close × 2rem, a large one 3rem; the phone raises them to clear 44px). A button squares off while pressed (a spring on
  `border-radius`), and an inspector toggle stays squared while on — the shape is the state. Never hardcode a
  hex in a component — derive every shade via relative color:
  `oklch(from var(--color-text) l c h / 55%)` (muted text), `/ 12%` (borders), `/ 7%` (tinted
  surfaces; less disappears on black). A cover with no picture is a dot grid, not a colour wash.
- All sizes — `rem`, never `px`: `:root { font-size: 16px }` in tokens.css is the single
  scale knob for the whole UI (1rem = 16px, so 8px → `0.5rem`, 12px → `0.75rem`). Exceptions
  that stay in `px`: hairline borders/outlines (`1px`, `2px`) and media-query breakpoints
  (they measure the viewport, not the type scale).
- Body text and every control — button, input, select, textarea, menu row, tab, field label —
  run at the body step: `1rem` (16px) on a phone, `0.9375rem` (15px) from md up, where
  global.css takes the whole `.type-*` scale a notch down with the controls; only secondary
  text goes smaller, snapped to the 1px step (`0.75rem` = 12px, `0.625rem` = 10px). Everything
  moves together when `:root` changes. A phone's fields stay >=16px, so no iOS zoom guard is
  needed in global.css.
- Components: Svelte 5 runes, typed `interface Props` + `$props()`, `Snippet` children
  via `{@render}`, callback props (`onClick`, `onChange`), `$bindable()` for form values;
  no event dispatchers. Scoped `<style>` with native `&`-nesting (Lightning CSS via Vite
  `css.transformer` handles targets/minify — no PostCSS, no Tailwind).
- Overlays are native-platform: `dialog/` wraps `<dialog>` — a centred modal on md+, the
  swipeable `sheet/` on a phone, so everything over a phone screen rises from the bottom
  (the editor's Tree/Props/Sim panels included); a sheet's title and close button go in its
  `header` snippet, outside the scroller, so they never scroll away; a `menu/` opens to the
  side with more room and is never larger than the room it has;
  `select/` is a `menu/` with a check on the chosen row; `menu/` is a popover anchored to its
  trigger (CSS anchor positioning, top layer), absolute-positioned in a relative parent as the
  fallback; `adaptive-popover/` is the watch panel's shell — a drawer beside the rail on
  desktop, the swipeable sheet on the phone —
  no portal/floating-ui deps. Button & co. don't forward arbitrary attrs; for `title`
  tooltips wrap in a `<span title>` (see `tool-slot` in editor.svelte).
- Icons are Material Symbols Rounded, the full font bundled in `static/fonts/material-symbols.woff2`. `name` IS
  the ligature — `<Icon name="storefront" />`, any name from fonts.google.com/icons works with
  no map to edit and no build step. Keep the font local and preserve the load guard and fixed icon slot; do not reintroduce the external Google Fonts icon stylesheet. A name the font doesn't know is invalid, so
  `tests/ui-icon.browser.test.ts` measures every name the app spells.
- Phone first for the store: the watchface grid is two dials across on a phone
  (`watchface-list`), a detail page is one column with a single ink button (the action that
  puts the thing on the watch) and its numbers in a `stat-strip/`, not a list of rows. New
  routed pages use `page/` rather than re-deriving the under-the-tab-bar scroll.
- Controls are an instrument's, not a form's (the look is borrowed from the cmf-watch-utils
  web emulator): `input/`, `select/` and `textarea/` are borderless tinted boxes at `--border-radius` (an ink ring on focus), never pills;
  `slider/` is a thin rail with a small ringed knob; `switch/` is small. Their height is
  `--control-height` — a dense surface (the editor's inspector and simulator) lowers it on its
  own container and marks it `data-dense` instead of restyling the controls; menu rows follow
  `--control-height` too. Buttons, tabs and badges are pills.
- A side panel is a stack of `panel-section/`s: a mono small-caps title over its controls, a
  hairline between sections; a section with nothing to render hides itself. Small labels over
  a field or under a number are mono, uppercase, `0.6875rem`.
- A dial the user is looking at as a watch (the editor canvas, the showcase page) sits in
  `watch-case/` — the Watch Pro 2 front render from `static/frames/` (Nothing's artwork, the
  one the cmf-watch-utils emulator uses) with the children laid over its display. The
  component's box is the metal case; strap and crown hang outside it. Thumbnails in a grid
  stay bare discs.
- Theme is automatic via `prefers-color-scheme` (dark overrides in tokens.css). Don't add
  a `.dark` class on `<html>`.
- The catalog dialog in the editor was removed intentionally — don't restore it. Catalog
  watchfaces are visible in the shared marketplace.

## Bluetooth (device/lib/ble.ts)

- Pairing with the watch happens entirely in the browser — `SERVICES` in `ble.ts` must
  list **all** GATT services the runtime needs: Web Bluetooth only returns what's
  explicitly declared in `optionalServices` at `requestDevice()` time via
  `getPrimaryServices()`, even if the device actually exposes more services (verify via
  `chrome://bluetooth-internals`, which shows everything, bypassing this limitation).
- The shell/pairing service lives under UUID `77d4e67c-...` on the verified watch unit,
  not `77d4ff00-...` as the old protocol docs assumed — its child characteristics
  (`77d4ff01`/`77d4ff02`) didn't change though. Not verified on other physical watches:
  if pairing stops finding the shell service, look up the current UUID the same way
  (`chrome://bluetooth-internals`) and add it to `SERVICES`.
- iOS goes through Bluefy (a WKWebView browser with its own Web Bluetooth). Its quirks: it
  rejects the first `requestDevice` (manufacturerData filter, numeric UUIDs), so `pick()` retries
  with name + one filter per service as full strings; it reports UUIDs uppercase and short
  ("FFF2"), so every characteristic lookup goes through `fullUuid`; and it rejects with non-Errors
  (`errText`). A watch some app on the phone already holds doesn't show up at all. beacio was
  tried and dropped — don't bring it back.
- No dev bridge or external process is needed — pairing (`AT GETSECRET` →
  `authPairReq`/`authPairRep` → session key) happens entirely over Web Bluetooth.

## Style

- Ponytail: minimal solutions, stdlib/platform before dependencies, short diffs.
  Mark deliberate simplifications with a `ponytail:` comment stating the ceiling and the
  upgrade path.
- **English everywhere in the repo and around it**: code, identifiers, comments, docs,
  commit messages, PR titles and descriptions, issue text, CI/workflow files. Chat with the
  user can be in any language — anything that lands in git or on GitHub is English.

## Watch identity and preview overrides

`docs/watch-identity.md` records the Nothing X model/color formats and browser limitations. Keep factory identity separate from preview overrides. Unknown SKU values stay unknown, advertisement observation is optional and bounded, and recovery skips the extra PID query. The preview selectors must never feed firmware or package compatibility checks. No physical-device claim follows from fixture tests.
