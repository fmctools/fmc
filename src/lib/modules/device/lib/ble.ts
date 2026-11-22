/// <reference types="web-bluetooth" />
// Web Bluetooth session for the CMF Watch Pro 2: connect, pair/authenticate, read device info,
// upload watchfaces. The wire format it speaks lives in ble-protocol.ts.
// Chromium only (no Web Bluetooth in Firefox/Safari); requires a user gesture and
// localhost or HTTPS.
import { MANUFACTURERS, observeIdentity, productReply, type WatchIdentity } from "./watch-identity";
import { dialLabel, flashedOn, unclaimDial } from "./catalog-names";
import {
  cat,
  CMD,
  cmdName,
  Codec,
  dbg,
  dialId,
  eqBytes,
  fromHex,
  isKnownCmd,
  MARKER,
  SERVICES,
  sha256,
  toHex,
  utf8,
  UUID,
  verbose,
  crc32,
  errText,
  fullUuid,
} from "./ble-protocol";
import {
  APP_SLOTS,
  LOADER_SLOT,
  MAX_DATA,
  parsePackageHeader,
  planInstall,
  STATUS_NAMES,
  parseStubReply,
  STATUS_OK,
  STUB_SLOT,
  type Wp2Package,
  type Wp2State,
} from "./wp2";

export interface WatchInfo {
  /** The advertised name ("CMF Watch Pro 2 …", "CMF Watch Pro 3 …") ; factory identity is optional */
  name: string | null;
  battery: number | null;
  firmware: string | null;
  serial: string | null;
  identity?: WatchIdentity | null;
}
// ponytail: flat list of installed dial ids — this firmware reports everything before the
// §9.5g gallery sentinel, so the builtin/downloaded split always left one side empty.
// Split it again if a firmware shows up that actually populates both.
export type WatchDials = number[];

// there's no room for another watchface, so the caller has to name an installed dial to
// overwrite instead. Own class so the model can tell it from a real failure.
export class NoFreeSlotError extends Error {}
// old_wf_id doesn't name a dial the watch actually has (removed on the watch, watch reset, or a
// different physical unit). Recoverable here — the upload is retried as a plain append.
class StaleSlotError extends Error {}

// How many watchfaces the watch holds. The source is the a055 header (byte 3, see onNotify),
// which reads 07 on every Pro 2 sample so far; these constants are only the fallback for a
// connection where no a055, or a malformed one, came in. ponytail: WF_CAPACITY was taken on
// report from a CMF Watch Pro 2 (fw 1.0.0.73) and the header says 7 there, so 6 is likely one
// short — kept as the cautious guess, since erring low only opens the slot dialog early.
export const WF_CAPACITY = 6;
// ponytail: also taken on report, not measured — a Watch 3 Pro owner on #49 found Nothing X asking
// to replace a face at the 8th after a factory reset (Album/Video/Studio dials sit outside it).
// Fallback only, like WF_CAPACITY: the header's own capacity wins when it arrives.
export const WF_CAPACITY_PRO3 = 7;
// the advertised name is the only model id there is: "CMF Watch Pro 2-1A2B", "CMF Watch 3 Pro-9A9D"
// bytes of firmware per 0x9042 frame — the size every hardware flash so far used
const OTA_CHUNK = 224;

export const capacityOf = (name: string | null) =>
  /watch (3 pro|pro 3)/i.test(name ?? "") ? WF_CAPACITY_PRO3 : WF_CAPACITY;

const KEY_STORE = "fmc_authkey";
const LISTEN = ["cmdRead", "dataRead", "shellRead", "otaRead"] as const;

type ListenKey = (typeof LISTEN)[number];
// commands and their answers, and the data channel a face delete runs over; the shell to pair
const RESCUE_LISTEN = (keyed: boolean): ListenKey[] =>
  keyed ? ["cmdRead", "dataRead"] : ["cmdRead", "dataRead", "shellRead"];
// A live watch answers a subscription in 8–11 ms (emulator); one past its crash, still
// advertising and accepting a link, never does until it reboots. ponytail: 500 ms, not the
// emulator's 300, to leave room for a slow host stack — lower it if real logs show no answer
// ever takes that long.
const RESCUE_SUB_MS = 500;
/** `p`, or `err()` if it hasn't settled within `ms`. */
export const within = <T>(p: Promise<T>, ms: number, err: () => Error): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;

  return Promise.race([
    p,
    new Promise<never>((_, rej) => (timer = setTimeout(() => rej(err()), ms))),
  ]).finally(() => clearTimeout(timer));
};
// The watch drops every frame for its first 200 ms on a link (the command channel opens on a
// timer in its connected callback; WP3 firmware, seen in the emulator), so on rescue — which
// connects as early as it can — authName is re-sent at this pace until it is answered.
const RESCUE_NAME_MS = 20;
// The way out of a boot loop on a Watch 3 Pro (fw 1.0.1.77, found in the emulator): the face list
// lives in RAM that outlives the crash reboot — WfmPara_Load reads it at 0x3800f73a, behind a
// magic — and the shell takes `dbg` with no auth. A zero over the magic makes the next boot
// rebuild the list from the stock faces alone (WFM _REST), so the bad face is never loaded again;
// its file stays. ponytail: the address is that firmware's; another build needs its own, and a
// write there lands in RAM only, so a wrong one is lost at the next restart.
export const ESCAPE_CMD = "dbg mwb 0x3800f73a 0";
// how long a shell blast keeps writing, and how often: the shell opens ~200 ms into a link
const SHELL_BLAST_MS = 1000;
const SHELL_BLAST_EVERY_MS = 15;
// the shell's service on the Watch 3 Pro (and the Pro 2), see SERVICES
const SHELL_SERVICE = "77d4e67c-2fe2-2334-0d35-9ccd078f529c";
// a live watch answers the shell in milliseconds; one past its fault, never
const SHELL_ANSWER_MS = 1500;
// how long the rescue page waits for a pairing to be confirmed before it reconnects and asks again
const RESCUE_PAIR_MS = 30000;
const loadKey = (): Uint8Array | null => {
  const h = localStorage.getItem(KEY_STORE);

  return h && h.length === 32 ? fromHex(h) : null;
};
const saveKey = (k: Uint8Array) => localStorage.setItem(KEY_STORE, toHex(k));
/** Whether this browser holds an auth key: without one, connecting means pairing, which needs a
 *  tap on the watch — what the rescue page can't count on. */
export const hasSavedKey = () => loadKey() !== null;
/** Takes a key copied out of another browser or address, where the watch was paired: the line
 *  `fmc_authkey=<32 hex>` the old address's /rescue prints, or the bare digits. False if the
 *  text holds no key. */
export function importKey(text: string): boolean {
  const m = /fmc_authkey=([0-9a-f]{32})\b/i.exec(text) ?? /^\s*([0-9a-f]{32})\s*$/i.exec(text);

  if (m) localStorage.setItem(KEY_STORE, m[1].toLowerCase());
  return Boolean(m);
}

// dev hygiene: resets Chrome's device permissions and the local auth key.
// ponytail: doesn't fix the lock on the watch side (the bond is held by the firmware, not the browser) —
// it only clears our state so the next connect() starts fresh.
export async function forgetKnownDevices(): Promise<number> {
  localStorage.removeItem(KEY_STORE);
  if (!navigator.bluetooth?.getDevices) return 0;
  const devices = await navigator.bluetooth.getDevices();

  await Promise.all(devices.map((d) => d.forget()));
  return devices.length;
}

// how full the watch is: `used` counts every dial on it, side-loaded ones included
export interface WatchSlots {
  used: number;
  capacity: number;
}

export class Watch {
  onStatus: (s: string) => void;
  onDials: ((d: WatchDials, slots: WatchSlots) => void) | null = null;
  codec = new Codec();
  chars: Record<string, BluetoothRemoteGATTCharacteristic> = {};
  waiters = new Map<number, (p: Uint8Array) => void>(); // cmd key -> one-shot resolver
  // cmd key -> persistent handler (upload chunk loop); awaited, so it holds the rx chain
  handlers = new Map<number, (p: Uint8Array) => void | Promise<void>>();
  rx: Promise<void> = Promise.resolve(); // serializes inbound notifications, see subscribe()
  shellWaiter: ((s: string) => void) | null = null;
  identity: WatchIdentity | null = null;
  private identityReply: ((s: string) => void) | null = null;
  shellService: string | null = null; // where shellBlast found the shell, for its next try
  device: BluetoothDevice | null = null;
  name: string | null = null; // advertised name; factory identity is separate
  battery: number | null = null;
  firmware: string | null = null;
  serial: string | null = null;
  capacity = WF_CAPACITY; // the model's guess from its name, then the a055 header's
  reportedWf: number[] = []; // dial ids exactly as cmdWfInstalled listed them (§9.5g)
  installedWf: number[] = []; // …plus the side-loaded ones a055 leaves out, see mergeDials
  // dials on the watch per the a055 header, side-loaded included; null until one arrives, and
  // then the slot count falls back to installedWf
  headerCount: number | null = null;

  get slots(): WatchSlots {
    return {
      used: this.headerCount ?? this.installedWf.length,
      capacity: this.capacity,
    };
  }

  constructor(onStatus: (s: string) => void = () => {}) {
    this.onStatus = onStatus;
  }
  status(s: string) {
    dbg("status:", s);
    this.onStatus(s);
  }

  // a055 doesn't list dials that were side-loaded, so on a fresh connection a full watch looks
  // like it still has room — and the pre-flight capacity check waves through an append the
  // watch will only refuse at 100%, after the whole file has gone over BLE. Fold in what this
  // browser flashed onto *this* watch so the slot count, the slot dialog and the oldId lookup
  // all see the same slots the watch does. Called from both sides of the race: the a055
  // notification, and fetchInfo learning the serial these records are keyed by.
  mergeDials() {
    const mine = this.serial ? flashedOn(this.serial) : [];

    this.installedWf = [...this.reportedWf, ...mine.filter((id) => !this.reportedWf.includes(id))];
    dbg("dials:", this.installedWf, "reported:", this.reportedWf, "flashed here:", mine);
    this.onDials?.([...this.installedWf], this.slots);
  }

  // like in fmc CLI: the advertisement doesn't always carry the service, so match by name and by manufacturer id too
  private async pick(): Promise<BluetoothDevice> {
    let d: BluetoothDevice;

    try {
      d = await navigator.bluetooth.requestDevice({
        filters: [
          { services: [0xefe7] },
          { namePrefix: "CMF Watch" },
          { manufacturerData: [{ companyIdentifier: 0x0ccb }] },
        ],
        optionalServices: SERVICES,
        optionalManufacturerData: MANUFACTURERS,
      });
    } catch (e) {
      dbg("requestDevice failed:", errText(e));
      // the picker closed without a choice (Chromium's NotFoundError), or no permission
      if (e instanceof Error && /NotFound|Security|Abort/.test(e.name)) throw e;
      // ponytail: a Web BLE browser outside Chromium (Bluefy) refuses some of the above —
      // likely the manufacturerData filter or numeric UUIDs; ask again with the plainest form
      d = await navigator.bluetooth.requestDevice({
        // this form is the one Bluefy took (3.9.3, iOS 18.7). A watch another app on the phone
        // holds stays invisible to it whatever the filters — the help page says to free it
        filters: [
          { namePrefix: "CMF Watch" },
          ...SERVICES.map((u) => ({ services: [fullUuid(u)] })),
        ],
        optionalServices: SERVICES.map(fullUuid),
      });
    }

    dbg("device chosen:", d.name, d.id);
    d.addEventListener("gattserverdisconnected", () => {
      dbg("gattserverdisconnected");
      this.status("disconnected");
    });
    return d;
  }

  /**
   * Rescue's way out of a boot loop on a Watch 3 Pro: from the moment the link is up, `cmd` goes
   * to the shell again and again for SHELL_BLAST_MS — the shell opens ~200 ms into a link and the
   * watch faults ~100 ms after that, so only a stream gets a write into that window. Then asks the
   * shell its version: true if it answers, which a watch past its fault never does (it keeps the
   * link for seconds, until its watchdog restarts it, so a link still up proves nothing).
   * again: the watch picked on an earlier call, with no picker.
   */
  async shellBlast(cmd: string, again = false): Promise<boolean> {
    const device = again && this.device ? this.device : await this.pick();

    this.device = device;
    this.name = device.name ?? null;
    if (!/watch (3 pro|pro 3)/i.test(this.name ?? ""))
      throw new Error(`this way out is for a CMF Watch 3 Pro, not ${this.name ?? "this watch"}`);
    const t0 = performance.now();
    const since = () => `${Math.round(performance.now() - t0)} ms`;

    dbg("shell blast: connecting");
    const server = await within(
      device.gatt!.connect(),
      15000,
      () =>
        new Error(
          "connection timed out — the watch is probably connected to another app or browser tab; close it (phone app, fmc CLI, old editor tab) and retry",
        ),
    );
    const start = performance.now();
    const shell: Record<string, BluetoothRemoteGATTCharacteristic> = {};

    dbg("shell blast: connected after", since());
    // one targeted lookup, not a full discovery: on real hardware the full one never came back
    // inside the window a looping watch answers in (fmc.tools/rescue logs, Windows). The shell's
    // service is 77d4e67c on the Watch 3 Pro too (its firmware's GATT table); a full discovery
    // is the fallback should a build ever move it
    try {
      const svc = await server.getPrimaryService(this.shellService ?? SHELL_SERVICE);

      dbg("shell blast: service after", since());
      for (const u of [UUID.shellWrite, UUID.shellRead]) shell[u] = await svc.getCharacteristic(u);
    } catch (e) {
      dbg("shell blast: targeted lookup failed after", since(), errText(e));
      if (!device.gatt!.connected) throw e;
      for (const svc of await server.getPrimaryServices())
        for (const c of await svc.getCharacteristics().catch(() => []))
          if (fullUuid(c.uuid) === UUID.shellWrite || fullUuid(c.uuid) === UUID.shellRead) {
            shell[fullUuid(c.uuid)] = c;
            this.shellService = svc.uuid;
          }
    }
    const [w, r] = [shell[UUID.shellWrite], shell[UUID.shellRead]];

    if (!w || !r) throw new Error("characteristic shell not found");
    const elapsed = () => Math.round(performance.now() - start);
    const write = (line: string) => {
      const bytes = utf8(`${line}\r\n`) as BufferSource;

      return w.properties.writeWithoutResponse
        ? w.writeValueWithoutResponse(bytes)
        : w.writeValueWithResponse(bytes);
    };
    let n = 0;

    dbg("shell blast: shell found after", since());
    while (device.gatt!.connected && elapsed() < SHELL_BLAST_MS) {
      await write(cmd).then(
        () => n++,
        (e) => dbg("shell blast: write failed:", errText(e)),
      );
      await new Promise((res) => setTimeout(res, SHELL_BLAST_EVERY_MS));
    }
    dbg(
      "shell blast:",
      n,
      "writes, link",
      device.gatt!.connected ? "up" : "dropped",
      "after",
      since(),
    );
    if (!device.gatt!.connected) return false;
    const answered = new Promise<boolean>((res) =>
      r.addEventListener("characteristicvaluechanged", () => {
        const s = new TextDecoder().decode(r.value!);

        dbg("shell:", s.trim());
        if (s.includes("GETVERSION:")) res(true);
      }),
    );
    const silent = () => new Error("timeout waiting for GETVERSION");

    try {
      await within(r.startNotifications(), SHELL_ANSWER_MS, silent);
      await write("AT GETVERSION");
      return await within(answered, SHELL_ANSWER_MS, silent);
    } catch (e) {
      dbg("shell blast:", errText(e));
      // a watch past its fault keeps the link until it restarts; let go, so the next try is a
      // fresh link to the next boot and not an instant reconnect to this one
      device.gatt!.disconnect();
      return false;
    }
  }

  // rescue: stop right after auth — a watch wedged on a bad face may never answer fwGet/a055,
  // and the only thing the caller wants to send is factoryReset. again: reconnect to the watch
  // picked on an earlier call, with no picker — the rescue page retries every time it shows up
  async connect({ rescue = false, again = false } = {}): Promise<WatchInfo> {
    if (!navigator.bluetooth)
      throw new Error(
        "Web Bluetooth isn't available here — open this page in Chrome or Edge, or in Bluefy on an iPhone",
      );
    this.status("requesting device…");
    let device = again && this.device ? this.device : await this.pick();

    this.device = device;
    this.identity = null;
    let advertisedIdentity = rescue ? Promise.resolve(null) : observeIdentity(device);

    this.name = device.name ?? null;
    this.capacity = capacityOf(this.name);
    this.headerCount = null;

    (window as unknown as { __wf?: BluetoothDevice }).__wf = device; // ponytail: dev console hook, remove after debugging
    this.status("connecting…");
    // gatt.connect() hangs forever if the watch is already holding a connection with someone else
    const timeout = (ms: number, what: string) =>
      new Promise<never>((_, rej) =>
        setTimeout(
          () =>
            rej(
              new Error(
                `${what} timed out — the watch is probably connected to another app or browser tab; close it (phone app, fmc CLI, old editor tab) and retry`,
              ),
            ),
          ms,
        ),
      );
    const discover = async () => {
      this.chars = {};
      dbg("gatt.connect()…");
      const server = await device.gatt!.connect();

      dbg("gatt connected, discovering services…");
      // full (undirected) discovery: CoreBluetooth sometimes fails to find a service via a
      // targeted getPrimaryService(uuid) right after connecting, even though it's there — compared to
      // fmc CLI (ble.go), which always does DiscoverServices(nil) and sees the shell service
      // reliably. The outer Promise.race(…, timeout(15000)) in connectOrRepick guards
      // against the very hang that previously led to picking the targeted variant.
      const svcs = await server.getPrimaryServices();

      for (const svc of svcs) {
        try {
          const cc = await svc.getCharacteristics();

          dbg(
            "service",
            svc.uuid,
            "→",
            cc.map((c) => c.uuid),
          );
          for (const ch of cc) this.chars[fullUuid(ch.uuid)] = ch;
        } catch (e) {
          dbg("service", svc.uuid, "characteristics failed:", (e as Error).message);
        }
      }
      dbg(
        "required chars:",
        Object.fromEntries(
          (
            ["cmdRead", "cmdWrite", "dataRead", "dataWrite", "shellRead", "shellWrite"] as const
          ).map((k) => [k, Boolean(this.chars[UUID[k]])]),
        ),
      );
    };
    // some Web Bluetooth outside Chromium (an iOS BLE browser) only allows connect right after the picker selection —
    // after a disconnect it throws "not offered to this origin"; in that case we show the picker again
    const connectOrRepick = async (what: string) => {
      try {
        await Promise.race([discover(), timeout(15000, what)]);
      } catch (e) {
        if (!/not offered to this origin/i.test((e as Error).message)) throw e;
        this.status("re-picking device…");
        device = await this.pick();
        this.device = device;
        this.name = device.name ?? null;
        this.capacity = capacityOf(this.name);
        advertisedIdentity = rescue ? Promise.resolve(null) : observeIdentity(device);
        await Promise.race([discover(), timeout(15000, what)]);
      }
    };

    try {
      await connectOrRepick("connection");
      // the shell (pairing) service sometimes shows up only on a fresh connection
      // 3s pause like in fmc CLI: reconnecting without a pause hangs the watch's firmware
      if (!this.chars[UUID.shellWrite] && !loadKey()) {
        this.status("pairing service hidden — reconnecting…");
        device.gatt!.disconnect();
        await new Promise((r) => setTimeout(r, 3000));
        await connectOrRepick("reconnection");
      }
    } catch (e) {
      try {
        device.gatt!.disconnect();
      } catch {
        /* already gone */
      }
      throw e;
    }
    // Rescue listens only where its actions get answers — the shell only when it has to pair, the
    // firmware-update channel never — and gives each subscription RESCUE_SUB_MS. On a watch stuck
    // in a boot loop this is the first step the watch itself has to answer (Windows can serve the
    // service list from its cache), and it answers at once or not before it restarts ~17 s later:
    // failing fast leaves time for more tries in the windows it is up.
    const subscribed = new Set<string>();
    const subscribe = async (
      keys: readonly ListenKey[] = rescue ? RESCUE_LISTEN(Boolean(loadKey())) : LISTEN,
    ) => {
      for (const key of keys) {
        const ch = this.chars[UUID[key]];

        if (subscribed.has(ch?.uuid)) continue;
        // shell service is only needed for first-time pairing; some firmwares hide it. The
        // firmware-update channel only for a firmware update, which checks for it itself
        if (!ch) {
          if (key === "shellRead" || key === "otaRead") continue;
          throw new Error(`characteristic ${key} not found`);
        }
        // write vs writeWithoutResponse decides whether upload frames are acknowledged —
        // see sendData
        dbg("startNotifications", key, {
          write: ch.properties.write,
          writeNoResp: ch.properties.writeWithoutResponse,
        });
        await (rescue
          ? within(
              ch.startNotifications(),
              RESCUE_SUB_MS,
              () => new Error(`the watch didn't answer the ${key} subscription`),
            )
          : ch.startNotifications());
        subscribed.add(ch.uuid);
        ch.addEventListener("characteristicvaluechanged", (e) => {
          const value = (e.target as BluetoothRemoteGATTCharacteristic).value!;
          const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);

          // Notifications must be handled one at a time, in arrival order. onNotify is async
          // (it awaits decode) and so is the upload's chunk handler (it awaits encode before
          // writing), so firing them off concurrently let two chunk responses interleave their
          // frames on the data channel and raced the codec's own reassembly buffer — the watch
          // then rejected the finished file at random. ponytail: one chain for both
          // characteristics; split per channel only if cmd traffic ever needs to overtake an
          // upload, which today it never does.
          this.rx = this.rx.then(() => this.onNotify(fullUuid(ch.uuid), bytes)).catch(() => {});
        });
      }
    };

    try {
      await subscribe();
      dbg("subscriptions done, key saved:", Boolean(loadKey()));
      const k = loadKey();

      // rescue pairs only when it must, and never waits on it for long: the confirmation is a tap
      // on a watch whose screen may never light up, so a try that gets no answer ends and the
      // caller comes back for another
      const pairMs = rescue ? RESCUE_PAIR_MS : undefined;

      if (k) {
        try {
          await this.authenticate(k, rescue);
        } catch (e) {
          // a stale key (the watch was re-paired/reset) shows up as authFailed or silence on the first
          // encrypted exchange (authMac = 0x49); other errors don't touch the saved key. On rescue
          // a wedged watch going silent proves nothing — keep the key and let the caller try again;
          // an outright refusal does mean pairing, but the key stays until a new one replaces it
          const stale = rescue
            ? /rejected the auth key/
            : /rejected the auth key|timeout waiting for 0x49/;

          if (!stale.test((e as Error).message)) throw e;
          dbg("stored key stale:", (e as Error).message);
          if (!rescue) localStorage.removeItem(KEY_STORE);
          // pairing needs the shell service — if it's not visible on the current connection, reconnect,
          // same as on first pairing (§233), and re-subscribe to notifications
          if (!this.chars[UUID.shellWrite]) {
            this.status("pairing service hidden — reconnecting…");
            device.gatt!.disconnect();
            await new Promise((r) => setTimeout(r, 3000));
            await connectOrRepick("reconnection");
            await subscribe();
          }
          await subscribe(["shellRead"]);
          await this.pair(pairMs);
        }
      } else {
        await subscribe(["shellRead"]);
        await this.pair(pairMs);
      }
      if (!rescue) {
        await this.fetchInfo();
        const advertised = await advertisedIdentity;
        const reported = await this.readProductIdentity();
        // A conflicting factory PID cannot borrow the advertisement's colour.
        this.identity =
          reported && advertised && reported.productId !== advertised.productId
            ? reported
            : (advertised ?? reported);
      }
    } catch (e) {
      // without this a failed pair()/authenticate() leaves the physical GATT link hanging:
      // the watch thinks it's busy with us, and the next Connect won't see the shell service again
      try {
        device.gatt!.disconnect();
      } catch {
        /* already gone */
      }
      throw e;
    }
    this.status("connected");
    return {
      name: device.name ?? null,
      battery: this.battery,
      firmware: this.firmware,
      serial: this.serial,
      identity: this.identity,
    };
  }

  async onNotify(uuid: string, bytes: Uint8Array) {
    if (uuid === UUID.shellRead) {
      const s = new TextDecoder().decode(bytes);

      dbg("shell:", s.trim());
      this.identityReply?.(s);
      if (this.shellWaiter && s.includes("GETSECRET:")) {
        this.shellWaiter(s);
        this.shellWaiter = null;
      }
      return;
    }
    if (uuid !== UUID.cmdRead && uuid !== UUID.dataRead && uuid !== UUID.otaRead) return;
    let res;

    try {
      res = await this.codec.decode(bytes);
    } catch (e) {
      this.status(`decode: ${(e as Error).message}`);
      return;
    }
    if (!res) return;
    // an unrecognised key is the whole point of probe() — always dump its payload, that's the
    // only thing that tells you what the command means
    if ((res.key !== CMD.wfChunkReq && res.key !== CMD.otaChunkReq) || verbose())
      dbg(
        "recv",
        cmdName(res.key),
        "len",
        res.payload.length,
        !isKnownCmd(res.key) || verbose() ? toHex(res.payload) : "",
      );
    if (res.key === CMD.battery && res.payload.length) this.battery = res.payload[0];
    if (res.key === CMD.wfInstalled) {
      // built-ins ‖ 0xFFFFFFFF ‖ gallery ids (§9.5g) — the sentinel just separates two groups
      // the UI doesn't distinguish, so flatten
      const p = res.payload;

      this.reportedWf = [];
      for (let off = 4; off + 4 <= p.length; off += 4) {
        const id = new DataView(p.buffer, p.byteOffset + off).getUint32(0, true);

        if (id !== 0xffffffff) this.reportedWf.push(id);
      }
      // Header: ?? ‖ active dial index (probably) ‖ dials on the watch ‖ capacity. Samples
      // (watch_health docs/cmf-protocol.md §9.5d-h): 01 00 06 07 with 5 ids listed + 1
      // side-loaded, 01 06 07 07 with 6 + that one, 01 04 06 07 with 6 after a reset — so byte 2
      // counts the dials a055 leaves out too, and byte 3 is 7 on a Pro 2. ponytail: no sample
      // from a watch known to be full yet; the finish-0a → slot dialog path stays the safety
      // net. Keep logging the raw header so field reports can confirm it.
      dbg("installed dials:", this.reportedWf, "header:", toHex(p.slice(0, 4)));
      if (p.length >= 4 && p[3] > 0 && p[2] <= p[3]) {
        this.headerCount = p[2];
        this.capacity = p[3];
      }
      this.mergeDials();
    }
    const w = this.waiters.get(res.key);

    if (w) {
      this.waiters.delete(res.key);
      w(res.payload);
    }
    const h = this.handlers.get(res.key);

    // awaited: the chunk handler's writes have to finish before the next notification is
    // decoded, or its frames interleave with the following chunk's
    if (h) await h(res.payload);
  }

  waitFor(cmdKey: number, ms = 8000): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        this.waiters.delete(cmdKey);
        reject(new Error(`timeout waiting for 0x${(cmdKey & 0xffff).toString(16)}`));
      }, ms);

      this.waiters.set(cmdKey, (p) => {
        clearTimeout(t);
        resolve(p);
      });
    });
  }
  async send(cmdKey: number, payload?: Uint8Array) {
    if (cmdKey !== CMD.wfChunkWrite || verbose())
      dbg("send", cmdName(cmdKey), "len", payload?.length ?? 0);
    const ch = this.chars[UUID.cmdWrite];

    for (const f of await this.codec.encode(cmdKey, payload || new Uint8Array(0)))
      await ch.writeValueWithoutResponse(f as BufferSource);
  }
  async sendData(cmdKey: number, payload?: Uint8Array) {
    // upload traffic goes over the data channel
    if (cmdKey !== CMD.wfChunkWrite || verbose())
      dbg("sendData", cmdName(cmdKey), "len", payload?.length ?? 0);
    const ch = this.chars[UUID.dataWrite];
    // Unacknowledged writes on purpose. Acknowledged ones (writeValueWithResponse, which this
    // characteristic does support) were tried against the random finish: 0a rejections and cost
    // 6 minutes per 800 KB face against 55 seconds here — a round trip per frame — while
    // failing just the same. The cause was new_wf_id, not lost frames; if silent drops ever do
    // turn up, this is the knob.
    for (const f of await this.codec.encode(cmdKey, payload || new Uint8Array(0)))
      await ch.writeValueWithoutResponse(f as BufferSource);
  }

  // Watchface upload — port of upload.go (§9.5). data: Uint8Array of a valid .bin.
  // seed: what identifies this face across flashes — a marketplace record id where there is
  // one, otherwise the name baked into the file. Same seed → same slot on every re-flash.
  async uploadWatchface(
    data: Uint8Array,
    slot?: number,
    seed?: string,
    onProgress: (pct: number) => void = () => {},
  ) {
    if (data.length > 32 << 20) throw new Error("file larger than 32 MB");
    const magicOk =
      data.length >= 36 &&
      data[4] === 1 &&
      data[5] === 0 &&
      data[6] === 0 &&
      (data[7] === 0 || data[7] === 2);

    if (!magicOk) throw new Error("not a watchface: no 01 00 00 0x magic at offset 4");
    const nul = (off: number) => {
      const e = data.indexOf(0, off);

      return e < 0 ? null : new TextDecoder().decode(data.slice(off, e));
    };
    const name = nul(8),
      trailer = nul(data.length - 28);

    if (!name || name !== trailer) throw new Error("trailer name mismatch — corrupted file?");

    const id = dialId(seed || name);
    // §9.5g: old_wf_id names the installed dial this upload overwrites — that's the "slot".
    // 0 means add a new one. Since the id is derived from the face, a face already on the watch
    // overwrites *itself*: re-flashing the one you're editing costs no slot and never has to ask
    // which dial to sacrifice, however many times you do it.
    const oldId = slot ?? (this.installedWf.includes(id) ? id : 0);

    // the watch only refuses an append at the very end of the upload, so check the count up
    // front rather than shipping the whole file over BLE to be told no — the header's count
    // when one came, the merged list otherwise (see slots)
    if (!oldId && this.slots.used >= this.capacity)
      throw new NoFreeSlotError(`all ${this.capacity} slots taken`);

    const attempt = async (oldId: number, picked = false) => {
      dbg("upload ids:", {
        newId: id,
        oldId,
        bytes: data.length,
        installed: this.installedWf,
      });
      this.status(`uploading “${name}”…`);
      await this.sendData(CMD.wfInit1Req, new Uint8Array([MARKER]));
      const r1 = await this.waitFor(CMD.wfInit1Rep);

      if (!r1.length || r1[0] !== 1)
        throw new Error(`watch rejected the upload (init1: ${toHex(r1)})`);

      // §9.5e: 13 bytes, little-endian, no marker: ctr_type(3) ‖ old_wf_id ‖ new_wf_id ‖ size
      const init2 = new Uint8Array(13),
        dv2 = new DataView(init2.buffer);

      init2[0] = 3;
      dv2.setUint32(1, oldId, true);
      dv2.setUint32(5, id, true);
      dv2.setUint32(9, data.length, true);
      await this.sendData(CMD.wfInit2Req, init2);
      const r2 = await this.waitFor(CMD.wfInit2Rep);

      if (!r2.length || r2[0] !== 1) {
        // re-running attempt() with a real id starts a fresh init1/init2 handshake, which is
        // why the sequence lives in a function
        if (!oldId) throw new NoFreeSlotError(`append refused (init2: ${toHex(r2)})`);
        throw new StaleSlotError(`overwrite refused (init2: ${toHex(r2)})`);
      }

      try {
        await new Promise<void>((resolve, reject) => {
          let watchdog: ReturnType<typeof setTimeout>;
          const cleanup = () => {
            clearTimeout(watchdog);
            this.handlers.delete(CMD.wfChunkReq);
            this.handlers.delete(CMD.wfFinishAck1);
          };
          const fail = (e: Error) => {
            cleanup();
            reject(e);
          };
          const kick = () => {
            clearTimeout(watchdog);
            watchdog = setTimeout(() => fail(new Error("upload stalled")), 30000);
          };

          kick();
          this.handlers.set(CMD.wfChunkReq, async (p) => {
            if (p.length < 9) return fail(new Error(`short chunk request: ${toHex(p)}`));
            kick();
            const dv = new DataView(p.buffer, p.byteOffset);
            const off = dv.getUint32(0),
              len = dv.getUint32(4);

            if (off + len > data.length)
              return fail(new Error(`chunk request out of bounds: ${off}+${len}`));
            onProgress(p[8]);
            this.status(`uploading “${name}”… ${p[8]}%`);
            try {
              await this.sendData(CMD.wfChunkWrite, data.slice(off, off + len));
            } catch (e) {
              fail(e as Error);
            }
          });
          this.handlers.set(CMD.wfFinishAck1, async (p) => {
            cleanup();
            try {
              await this.sendData(CMD.wfFinishAck2, new Uint8Array([MARKER]));
            } catch {
              /* ack is best-effort */
            }
            if (p.length && p[0] === 1) {
              // the watch doesn't re-announce wfInstalled after an upload — patch the slot in
              // place so the list stays right and the next flash can target another slot
              const i = this.reportedWf.indexOf(oldId);

              if (i >= 0) this.reportedWf[i] = id;
              // a side-loaded dial isn't in reportedWf — it was counted through catalog-names,
              // and this upload has just written over it, so drop its claim or it goes on
              // holding a slot that no longer exists (and keeps showing up in the slot dialog)
              else if (oldId && oldId !== id) unclaimDial(oldId);
              // no fresh a055 either, so an append bumps the header's count by hand
              if (!oldId && this.headerCount !== null) this.headerCount++;
              // the new id joins the list through catalog-names, which the caller writes the
              // moment this resolves — it calls mergeDials() again right after
              this.mergeDials();
              resolve();
            } else {
              // the watch vetting what it received, after a transfer that completed cleanly.
              // 0x0a is the documented "stored but not activated" code — the file landed intact
              // and the watch refused to switch to it. It's the only answer an out-of-room
              // append ever gets (the watch doesn't say no at init2), so on an append it means
              // the same as `append refused` above and has to reach the slot dialog the same
              // way — leaving it a plain Error is what made every flash after the first one a
              // dead end on a full watch (#43). With a real old_wf_id it means that dial isn't
              // installed, which attempt() below retries as an append — or, for a dial a055
              // listed, that the watch won't take it as a target (see below).
              // `picked` is the append that follows a refused overwrite of the slot the user
              // chose in the dialog: 0a a second time on the same file isn't about slots, so
              // let it surface as a plain error instead of reopening the slot dialog on a loop
              // the user can't see the reason for. The append after a stale *guessed* id (a
              // re-flash after a reset, or a dial deleted on the watch) is still the first
              // append, and its 0a is the full-watch answer — it has to reach the dialog (#62).
              const kb = Math.round(data.length / 1024);

              if (p[0] === 0x0a && !picked)
                reject(
                  oldId
                    ? new StaleSlotError(`dial ${oldId} not installed (finish: 0a)`)
                    : new NoFreeSlotError(`append refused (finish: 0a; ${kb} KB)`),
                );
              else {
                const why = p[0] === 0x0a ? "stored but not activated" : `finish: ${toHex(p)}`;

                reject(new Error(`watch did not accept the file (${why}; ${kb} KB)`));
              }
            }
          });
        });
      } finally {
        this.handlers.delete(CMD.wfChunkReq);
        this.handlers.delete(CMD.wfFinishAck1);
      }
    };

    // the id list we aimed at is a guess (see oldId above) — when the watch says that dial
    // isn't there, fall back to a plain append instead of failing the flash
    await attempt(oldId).catch((e) => {
      if (!(e instanceof StaleSlotError)) throw e;
      // …but a dial a055 listed this session is no guess: the watch has it. Refusing to replace
      // it is the watch's state talking — after a reset one watch took a single stock dial out
      // of five as a replace target and answered 0a to the rest, appends included (watch_health
      // docs/cmf-protocol.md §9.5h). Dropping it from the list and appending threw away a real
      // slot and spent a second transfer on a certain refusal (#62); the way out is another
      // target. ponytail: which targets a given watch accepts is unknown — the user bisects.
      if (this.reportedWf.includes(oldId))
        throw new Error(
          `the watch refused to replace “${dialLabel(oldId, this.installedWf.indexOf(oldId))}” — flash again and pick a different dial to replace`,
        );
      dbg("stale old_wf_id", oldId, "→ retrying as append:", (e as Error).message);
      // stop counting it as a taken slot — otherwise a face deleted on the watch keeps the
      // count at six and every later flash pays this same wasted round trip. The claim is all
      // that goes: the watch may have refused for a reason we can't read off 0a, and dropping a
      // real dial's name and preview over a guess is not a trade worth making.
      this.reportedWf = this.reportedWf.filter((x) => x !== oldId);
      unclaimDial(oldId);
      this.mergeDials();
      if (this.slots.used >= this.capacity)
        throw new NoFreeSlotError(`all ${this.capacity} slots taken`);
      return attempt(0, slot !== undefined);
    });
    onProgress(100);
    this.status("connected");
    // the id is random and the name only exists inside the file — the caller needs both to
    // record what now sits in that slot (see catalog-names)
    return { id, name };
  }

  // Firmware update over the stock CMF OTA protocol — port of cmf-watch-utils ota_client.py, the
  // client that flashed real watches. `image` must have passed inspectOtaImage (ota-image.ts).
  //
  //   fff2  0x9052 A5              → A052 01   "may I update"
  //   ff01  0x9040 01 00 00 5a     → A040 01   start; the 4 bytes are copied from the phone app
  //   ff02  A042 off len pct       ← the watch pulls ranges, in any order, only what differs
  //   ff01  0x9042 bytes           → plaintext, 224 bytes a frame, no ack: the next A042 is one
  //   fff2  0x9041 A5              ← on A041 (01 = image valid): commit; the watch installs and
  //                                  reboots on its own
  //
  // The characteristic is part of the protocol: 0x9040 sent on fff2 with a live session reboots
  // the watch, which is why there is no "retry on the other channel" here (the reference has
  // one; it is the suspect in the one unexplained reboot). Nothing is sent before A040, so a
  // refusal anywhere up to it leaves the watch as it was.
  async flashFirmware(image: Uint8Array, onProgress: (pct: number) => void = () => {}) {
    const write = this.chars[UUID.otaWrite];

    if (!write || !this.chars[UUID.otaRead])
      throw new Error("the watch didn't offer its firmware-update channel — reconnect and retry");
    const sendOta = async (cmdKey: number, payload: Uint8Array) => {
      // 224 is the frame size proven on hardware; the MTU-derived size isn't, so don't use it
      for (const f of await this.codec.encode(cmdKey, payload, OTA_CHUNK)) {
        try {
          await write.writeValueWithoutResponse(f as BufferSource);
        } catch {
          // a frame over MTU−3 can't go as a write command; a long write (with response)
          // carries it — the same fallback as the reference client
          await write.writeValueWithResponse(f as BufferSource);
        }
      }
    };

    this.status("asking the watch to update…");
    await this.send(CMD.otaBeginReq, new Uint8Array([MARKER]));
    const r1 = await this.waitFor(CMD.otaBeginRep, 6000);

    if (r1[0] !== 1) throw new Error(`the watch refused the update (${toHex(r1)})`);
    await sendOta(CMD.otaStartReq, new Uint8Array([0x01, 0x00, 0x00, 0x5a]));
    const r2 = await this.waitFor(CMD.otaStartRep, 5000);

    if (r2[0] !== 1) throw new Error(`the watch refused to start (${toHex(r2)})`);

    let served = 0;

    try {
      await new Promise<void>((resolve, reject) => {
        let watchdog: ReturnType<typeof setTimeout>;
        // a drop mid-transfer won't come back on its own (no resume in the protocol): say so
        // now instead of after two minutes of watchdog
        const dropped = () => finish(new Error("the watch disconnected during the update"));
        let done = false;
        const finish = (e?: Error) => {
          if (done) return;
          done = true;
          clearTimeout(watchdog);
          this.device?.removeEventListener("gattserverdisconnected", dropped);
          if (e) reject(e);
          else resolve();
        };
        // the watch can think for a while between ranges (it writes NAND); two minutes of
        // silence is the reference client's line for "it's gone"
        const kick = () => {
          clearTimeout(watchdog);
          watchdog = setTimeout(
            () => finish(new Error("the watch stopped asking for data")),
            120000,
          );
        };
        const commit = async (verdict?: Uint8Array) => {
          // without this the update stays staged and is never installed
          await this.send(CMD.otaCommit, new Uint8Array([MARKER])).catch(() => {});
          if (verdict && verdict[0] !== 1)
            finish(new Error(`the watch rejected the image (${toHex(verdict)})`));
          else finish();
        };

        this.device?.addEventListener("gattserverdisconnected", dropped);
        kick();
        this.handlers.set(CMD.otaChunkReq, async (p) => {
          if (done || p.length < 8) return;
          kick();
          const dv = new DataView(p.buffer, p.byteOffset);
          const off = dv.getUint32(0),
            len = dv.getUint32(4);

          // a zero range is the other way the watch says "that's all"
          if (off === 0 && len === 0) return commit();
          if (off >= image.length) return dbg("ota: range past the image", off, len);
          const end = Math.min(off + len, image.length);

          try {
            await sendOta(CMD.otaChunkWrite, image.subarray(off, end));
          } catch (e) {
            return finish(e as Error);
          }
          served += end - off;
          // the watch skips what it already has, so bytes sent says little; its own percent
          // byte (the ninth, as in the watchface upload) is the honest number when present
          const pct = p.length > 8 ? p[8] : Math.round((served / image.length) * 100);

          onProgress(Math.min(pct, 99));
          this.status(`updating firmware… ${pct}%`);
        });
        this.handlers.set(CMD.otaVerdict, (p) => commit(p));
        for (const k of [CMD.otaStatus43, CMD.otaStatus44])
          this.handlers.set(k, (p) =>
            finish(new Error(`the watch stopped the update (${cmdName(k)} ${toHex(p)})`)),
          );
      });
    } finally {
      for (const k of [CMD.otaChunkReq, CMD.otaVerdict, CMD.otaStatus43, CMD.otaStatus44])
        this.handlers.delete(k);
      dbg("ota: served", served, "of", image.length);
    }
    onProgress(100);
    this.status("firmware sent — the watch installs it and restarts");
  }

  // What the App Loader stub reports — null for stock firmware, which doesn't answer INFO (see
  // wp2.ts). Read-only: INFO only reads a slot's header (it also drops an install the stub had
  // open, and nothing here opens one).
  async readWp2(): Promise<Wp2State | null> {
    const info = async (slot: number, ms: number) => {
      await this.send(CMD.stubInfo, new Uint8Array([slot]));
      return this.waitFor(CMD.stubInfoRep, ms);
    };
    let stubReply: Uint8Array;

    try {
      // a stub answers at once; stock stays silent — 2.5 s is the price of asking a stock watch
      stubReply = await info(STUB_SLOT, 2500);
    } catch {
      return null;
    }
    const stub = parseStubReply(stubReply);
    const read = async (slot: number): Promise<Wp2Package | null> => {
      const r = await info(slot, 4000);

      return r[0] === STATUS_OK ? parsePackageHeader(r.subarray(1)) : null;
    };
    const loader = await read(LOADER_SLOT);
    const apps: Record<number, Wp2Package> = {};

    for (let slot = 0; slot < APP_SLOTS; slot++) {
      const p = await read(slot);

      if (p) apps[slot] = p;
    }
    dbg("wp2:", { stub, loader, apps });
    return { stub, loader, apps };
  }

  // Install a .wp2app into the App Loader — port of cmf-watch-sdk install.py: BEGIN (slot, size, CRC of
  // the whole file), DATA in 128-byte pieces at the offset the stub has written so far, END (the
  // stub verifies, then swaps the file in). Writes only the App Loader's own files on NAND, never
  // the firmware; a refusal anywhere leaves the old package in place. `state` is a fresh readWp2.
  async installPackage(
    data: Uint8Array,
    state: Wp2State,
    onProgress: (pct: number) => void = () => {},
  ) {
    const { pkg, slot, body } = planInstall(data, state, crc32);
    const call = async (req: number, rep: number, payload: Uint8Array) => {
      await this.send(req, payload);
      const r = await this.waitFor(rep, 8000);

      if (r[0] !== STATUS_OK) {
        const why = STATUS_NAMES[r[0]] ?? `status ${r[0]}`;

        throw new Error(
          r[0] === 5
            ? `${pkg.name} is running on the watch — leave it and try again`
            : `the watch refused ${cmdName(req)}: ${why}`,
        );
      }
      return r;
    };
    const head = new Uint8Array(9),
      hv = new DataView(head.buffer);

    head[0] = slot;
    hv.setUint32(1, body.length, true);
    hv.setUint32(5, crc32(body), true);
    this.status(`installing ${pkg.name}…`);
    dbg("install", pkg.name, "v" + pkg.version, "slot", slot === LOADER_SLOT ? "L" : slot);
    await call(CMD.stubBegin, CMD.stubBeginRep, head);
    for (let off = 0; off < body.length; off += MAX_DATA) {
      const part = body.subarray(off, off + MAX_DATA);
      const req = new Uint8Array(4 + part.length);

      new DataView(req.buffer).setUint32(0, off, true);
      req.set(part, 4);
      const r = await call(CMD.stubData, CMD.stubDataRep, req);
      const written = new DataView(r.buffer, r.byteOffset).getUint32(1, true);

      if (written !== off + part.length)
        throw new Error(`the watch has ${written} bytes, expected ${off + part.length}`);
      onProgress(Math.min(99, Math.floor(((off + part.length) / body.length) * 100)));
    }
    // the stub's decrypt returns nothing for an empty plaintext, so END carries one dummy byte
    await call(CMD.stubEnd, CMD.stubEndRep, new Uint8Array([0]));
    onProgress(100);
    this.status("connected");
    return { name: pkg.name, slot };
  }

  // There was a probe()/sweep() pair here for guessing at undocumented commands. Removed after
  // it earned its keep in reverse: 0x8050-0x8056 and 0x9054-0x9056 drew no reply at all (the
  // firmware simply ignores commands it doesn't know), while a *known* command sent with a
  // malformed payload — CMD.time with one byte instead of eight — answered 0xffffa082 5a and
  // then rebooted and factory-reset the watch. Guessing at this firmware costs more than it
  // returns; read what it volunteers instead (onNotify dumps the payload of unknown commands).

  /** `ms`: give up on the confirmation after this long (rescue); without it the wait is the user's. */
  async pair(ms?: number) {
    if (!this.chars[UUID.shellWrite]) {
      // the shell service's own UUID isn't fixed (seen as 77d4e67c, docs assumed 77d4ff00) —
      // Web Bluetooth only exposes services listed in optionalServices at requestDevice() time,
      // so if it ever rotates to something not in SERVICES, add the new UUID there
      throw new Error(
        "pairing service not found — reconnect and try again; if this keeps happening the watch may be using a new service UUID (see SERVICES in ble.ts)",
      );
    }
    this.status("pairing — confirm on the watch");
    await this.codec.setKey(null);
    let giveUp: (e: Error) => void = () => {};
    const gotSecret = new Promise<string>((res, rej) => {
      this.shellWaiter = res;
      giveUp = rej;
    });
    // a watch that drops the link will never answer: without this the wait outlives the connection
    const dropped = () =>
      giveUp(new Error("the watch disconnected before the pairing was confirmed"));
    const timer =
      ms && setTimeout(() => giveUp(new Error("timeout waiting for the pairing confirmation")), ms);
    let str: string;

    this.device?.addEventListener("gattserverdisconnected", dropped);
    try {
      await this.chars[UUID.shellWrite].writeValue(utf8("AT GETSECRET") as BufferSource);
      str = (await gotSecret).trim();
    } finally {
      clearTimeout(timer);
      this.device?.removeEventListener("gattserverdisconnected", dropped);
      this.shellWaiter = null;
    }

    if (!str.endsWith(",OK") || str.length < 42) throw new Error(`pairing rejected: ${str}`);
    const secret = fromHex(str.slice(10, 42));
    const random1 = crypto.getRandomValues(new Uint8Array(16));
    const sig = await sha256(cat(random1, secret));

    await this.send(CMD.authPairReq, cat(random1, sig));
    const rep = await this.waitFor(CMD.authPairRep);
    const random2 = rep.slice(0, 16),
      sig2 = rep.slice(16, 48);

    if (!eqBytes(sig2, await sha256(cat(random2, secret))))
      throw new Error("watch signature mismatch");
    const k1 = (await sha256(cat(random1, random2, secret))).slice(0, 16);

    saveKey(k1);
    await this.authenticate(k1);
  }

  /** `repeatName`: re-send authName until the watch answers it — see RESCUE_NAME_MS. */
  async authenticate(k1: Uint8Array, repeatName = false) {
    this.status("authenticating…");
    await this.codec.setKey(k1);
    // the watch sends authFailed if it can't decrypt with the key — we react immediately instead of waiting for the timeout
    const failed = new Promise<never>((_, rej) =>
      this.waiters.set(CMD.authFailed, () => rej(new Error("watch rejected the auth key"))),
    );

    failed.catch(() => {}); // the race might not manage to subscribe in time — suppress the unhandled rejection
    const wait = (key: number) => Promise.race([this.waitFor(key), failed]);

    try {
      const name = () => this.send(CMD.authName, cat(new Uint8Array([MARKER]), utf8("fmc")));

      await name();
      const again = repeatName ? setInterval(() => name().catch(() => {}), RESCUE_NAME_MS) : 0;

      try {
        await wait(CMD.authMac);
      } finally {
        clearInterval(again);
      }
      await this.send(CMD.authNonceReq, new Uint8Array([MARKER]));
      const nonce = await wait(CMD.authNonceRep);

      await this.codec.setKey((await sha256(cat(nonce, k1))).slice(0, 16));
      await this.send(CMD.authConfirmReq, new Uint8Array([MARKER]));
      await wait(CMD.authConfirmRep);
    } finally {
      this.waiters.delete(CMD.authFailed);
    }
  }

  // Gadgetbridge's FACTORY_RESET: the marker byte and nothing else. The watch wipes itself and
  // reboots; it won't answer, so there is nothing to wait for. It ignores the reset until a time
  // write has marked the link live (SetLinkFlg in the 0x8004 handler; WP3 firmware, confirmed in
  // the cmf-watch-utils emulator), and a clock more than 2 min off takes the time only on the
  // second write: so the time twice, then the reset. The payload is the reference client's
  // (cmf_watch.py: >ii unix seconds, UTC offset in ms) — a malformed one once reset a watch.
  async factoryReset() {
    const time = new Uint8Array(8);
    const dv = new DataView(time.buffer);

    dv.setInt32(0, Math.floor(Date.now() / 1000));
    dv.setInt32(4, -new Date().getTimezoneOffset() * 60000);
    await this.send(CMD.time, time);
    await this.send(CMD.time, time);
    await this.send(CMD.factoryReset, new Uint8Array([MARKER]));
  }

  /**
   * Deletes an installed dial: the upload handshake with old_wf_id = the dial and new_wf_id = 0
   * (cmf-watch-utils `wf-delete`). The watch still pulls a file, so `filler` (any valid face)
   * goes over and is thrown away. False when the watch says that dial isn't there (0x0a).
   * ponytail: the upload's chunk loop, without its slot bookkeeping — fold the two together if
   * this outgrows the rescue page. Verified on a Watch Pro 2 by the CLI only, not from here.
   */
  async deleteDial(id: number, filler: Uint8Array): Promise<boolean> {
    await this.sendData(CMD.wfInit1Req, new Uint8Array([MARKER]));
    const r1 = await this.waitFor(CMD.wfInit1Rep);

    if (!r1.length || r1[0] !== 1)
      throw new Error(`watch rejected the upload (init1: ${toHex(r1)})`);
    const init2 = new Uint8Array(13),
      dv2 = new DataView(init2.buffer);

    init2[0] = 3;
    dv2.setUint32(1, id, true);
    dv2.setUint32(5, 0, true);
    dv2.setUint32(9, filler.length, true);
    await this.sendData(CMD.wfInit2Req, init2);
    const r2 = await this.waitFor(CMD.wfInit2Rep);

    if (r2[0] === 0x0a) return false;
    if (!r2.length || r2[0] !== 1)
      throw new Error(`watch rejected the upload (init2: ${toHex(r2)})`);
    try {
      return await new Promise<boolean>((resolve, reject) => {
        let watchdog: ReturnType<typeof setTimeout>;
        const kick = () => {
          clearTimeout(watchdog);
          watchdog = setTimeout(() => reject(new Error("upload stalled")), 30000);
        };

        kick();
        this.handlers.set(CMD.wfChunkReq, async (p) => {
          if (p.length < 9) return reject(new Error(`short chunk request: ${toHex(p)}`));
          kick();
          const dv = new DataView(p.buffer, p.byteOffset);
          const off = dv.getUint32(0),
            len = dv.getUint32(4);

          if (off + len > filler.length)
            return reject(new Error(`chunk request out of bounds: ${off}+${len}`));
          try {
            await this.sendData(CMD.wfChunkWrite, filler.slice(off, off + len));
          } catch (e) {
            reject(e as Error);
          }
        });
        this.handlers.set(CMD.wfFinishAck1, async (p) => {
          clearTimeout(watchdog);
          try {
            await this.sendData(CMD.wfFinishAck2, new Uint8Array([MARKER]));
          } catch {
            /* ack is best-effort */
          }
          if (p[0] === 1) resolve(true);
          else if (p[0] === 0x0a) resolve(false);
          else reject(new Error(`dial delete failed (finish: ${toHex(p)})`));
        });
      });
    } finally {
      this.handlers.delete(CMD.wfChunkReq);
      this.handlers.delete(CMD.wfFinishAck1);
    }
  }

  /** Optional factory product ID. No writes to settings or flash; rescue never calls this. */
  private async readProductIdentity(): Promise<WatchIdentity | null> {
    const write = this.chars[UUID.shellWrite];

    if (!write || !this.chars[UUID.shellRead]) return null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let buffer = "";
    const response = new Promise<WatchIdentity | null>((resolve) => {
      timer = setTimeout(() => resolve(null), 1200);
      this.identityReply = (chunk) => {
        buffer = (buffer + chunk).replaceAll("\0", "").slice(-256);
        const result = productReply(buffer.trim());

        if (result) resolve(result);
      };
    });

    try {
      await within(write.writeValue(utf8("AT GETPID") as BufferSource), 1200, () => new Error());
      return await response;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
      this.identityReply = null;
    }
  }

  async fetchInfo() {
    const now = Math.floor(Date.now() / 1000),
      tz = -new Date().getTimezoneOffset() * 60;
    const t = new Uint8Array(8),
      dv = new DataView(t.buffer);

    dv.setUint32(0, now);
    dv.setUint32(4, (tz * 1000) >>> 0);
    await this.send(CMD.time, t);
    await this.send(CMD.fwGet, new Uint8Array(0));
    try {
      this.firmware = [...(await this.waitFor(CMD.fwRet, 4000))].join(".");
    } catch {
      /* optional */
    }
    await this.send(CMD.serialGet, new Uint8Array(0));
    try {
      const p = await this.waitFor(CMD.serialRet, 4000);

      if (p.length > 1 && p[0] <= p.length - 1)
        this.serial = new TextDecoder().decode(p.slice(1, 1 + p[0]));
    } catch {
      /* optional */
    }
    // the flashed-here records are keyed by serial, so the merged list is only right from here
    // on — a055 may well have arrived before this point
    this.mergeDials();
    try {
      if (this.chars[UUID.battery])
        this.battery = (await this.chars[UUID.battery].readValue()).getUint8(0);
    } catch {
      /* optional */
    }
  }
}
