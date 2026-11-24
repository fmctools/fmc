// fitForWatch off the main thread: re-encoding a heavy face to ETC2 takes seconds. Answers
// `null` when the file needs no change, so the caller keeps sending its own bytes.
import { fitForWatch } from "./fit";

self.onmessage = ({ data }: MessageEvent<{ bin: Uint8Array; device: string | null }>) => {
  try {
    const { bin: out, compressed, converted } = fitForWatch(data.bin, data.device);

    if (out === data.bin) self.postMessage({ out: null, compressed, converted });
    else self.postMessage({ out, compressed, converted }, { transfer: [out.buffer] });
  } catch (e) {
    self.postMessage({ error: e instanceof Error ? e.message : String(e) });
  }
};
