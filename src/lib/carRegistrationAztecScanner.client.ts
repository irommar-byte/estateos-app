import { BrowserMultiFormatReader } from "@zxing/library/esm/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

export type AztecScanPhase = "starting" | "position" | "searching" | "hold" | "decoding" | "success";

function buildAztecReader() {
  const hints = new Map<DecodeHintType, unknown>();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.AZTEC]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return new BrowserMultiFormatReader(hints, 180);
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

  const handleResult = (result: { getText: () => string } | undefined) => {
    if (stopped || decodeInFlight) return;

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
  };

  onPhase("searching");

  void reader
    .decodeFromVideoElementContinuously(video, (result, error) => {
      if (stopped || decodeInFlight) return;
      if (error) {
        if (stableHits > 0) {
          stableHits = 0;
          lastPayload = "";
        }
        onPhase("searching");
        return;
      }
      handleResult(result);
    })
    .catch(() => {
      if (!stopped) onPhase("position");
    });

  return stop;
}

export async function requestCameraStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Przeglądarka nie obsługuje aparatu. Wgraj zdjęcie dowodu.");
  }

  const attempts: MediaStreamConstraints[] = [
    {
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    },
    {
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
      },
      audio: false,
    },
    { video: { facingMode: "user", width: { ideal: 1280 } }, audio: false },
    { video: true, audio: false },
  ];

  let lastError: unknown = null;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      lastError = error;
    }
  }

  const name = lastError instanceof DOMException ? lastError.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    throw new Error("Brak zgody na aparat. Zezwól w przeglądarce lub wgraj zdjęcie dowodu.");
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    throw new Error("Nie znaleziono aparatu na tym urządzeniu. Wgraj zdjęcie dowodu.");
  }
  throw new Error("Nie udało się uruchomić aparatu. Wgraj zdjęcie dowodu.");
}
