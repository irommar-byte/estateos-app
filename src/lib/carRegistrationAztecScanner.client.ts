import { BrowserMultiFormatReader } from "@zxing/library/esm/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

export type AztecScanPhase = "starting" | "position" | "searching" | "hold" | "decoding" | "success";

function buildAztecReader() {
  const hints = new Map<DecodeHintType, unknown>();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.AZTEC]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return new BrowserMultiFormatReader(hints, 220);
}

export type StartAztecVideoScanOptions = {
  video: HTMLVideoElement;
  onPhase: (phase: AztecScanPhase) => void;
  onPayload: (payload: string) => void;
  stableHitsRequired?: number;
};

export function startAztecVideoScan({
  video,
  onPhase,
  onPayload,
  stableHitsRequired = 2,
}: StartAztecVideoScanOptions) {
  const reader = buildAztecReader();
  let stopped = false;
  let lastPayload = "";
  let stableHits = 0;
  let decodeInFlight = false;

  const stop = () => {
    stopped = true;
    try {
      reader.reset();
    } catch {
      /* ignore */
    }
  };

  onPhase("starting");

  void reader
    .decodeFromVideoDevice(null, video, (result, error) => {
      if (stopped || decodeInFlight) return;

      if (error) {
        if (stableHits > 0) {
          stableHits = 0;
          lastPayload = "";
        }
        onPhase("searching");
        return;
      }

      const payload = result?.getText()?.trim() || "";
      if (!payload) {
        onPhase("searching");
        return;
      }

      if (payload === lastPayload) {
        stableHits += 1;
      } else {
        lastPayload = payload;
        stableHits = 1;
      }

      if (stableHits < stableHitsRequired) {
        onPhase("hold");
        return;
      }

      decodeInFlight = true;
      onPhase("decoding");
      stop();
      onPayload(payload);
    })
    .then(() => {
      if (!stopped) onPhase("searching");
    })
    .catch(() => {
      if (!stopped) onPhase("position");
    });

  return stop;
}
