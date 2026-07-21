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

function isContinuityOrPhoneCamera(label: string): boolean {
  const value = label.toLowerCase();
  return (
    value.includes("iphone") ||
    value.includes("ipad") ||
    value.includes("continuity") ||
    value.includes("kontynuacja") ||
    /\bios\b/.test(value)
  );
}

function scoreVideoInput(device: MediaDeviceInfo): number {
  const label = String(device.label || "").toLowerCase();
  let score = 0;

  if (isContinuityOrPhoneCamera(label)) score -= 100;
  if (label.includes("facetime") || label.includes("built-in") || label.includes("integrated")) score += 40;
  if (label.includes("webcam") || label.includes("usb") || label.includes("hd")) score += 20;
  if (label.includes("back") || label.includes("rear") || label.includes("environment")) score += 10;
  if (!label.trim()) score -= 5;

  return score;
}

async function pickPreferredVideoDeviceId(): Promise<{ deviceId: string; localOnly: boolean } | null> {
  if (!navigator.mediaDevices?.enumerateDevices) return null;

  // Permissions / labels: a short probe unlocks device labels on desktop browsers.
  let probe: MediaStream | null = null;
  try {
    probe = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  } catch {
    // continue — enumerate may still return unlabeled devices
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((device) => device.kind === "videoinput" && device.deviceId);
    if (!cameras.length) return null;

    const localCameras = cameras.filter((device) => !isContinuityOrPhoneCamera(device.label || ""));
    const pool = localCameras.length ? localCameras : cameras;
    const ranked = [...pool].sort((a, b) => scoreVideoInput(b) - scoreVideoInput(a));
    const best = ranked[0];
    if (!best?.deviceId) return null;
    return { deviceId: best.deviceId, localOnly: localCameras.length > 0 };
  } finally {
    probe?.getTracks().forEach((track) => track.stop());
  }
}

export async function requestCameraStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Przeglądarka nie obsługuje aparatu. Wgraj zdjęcie dowodu.");
  }

  const preferred = await pickPreferredVideoDeviceId();
  const preferredDeviceId = preferred?.deviceId || null;

  const attempts: MediaStreamConstraints[] = [];
  if (preferredDeviceId) {
    attempts.push({
      video: {
        deviceId: { exact: preferredDeviceId },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });
    attempts.push({
      video: {
        deviceId: { ideal: preferredDeviceId },
        width: { ideal: 1280 },
      },
      audio: false,
    });
  }

  attempts.push(
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
  );

  let lastError: unknown = null;
  for (const constraints of attempts) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const label = stream.getVideoTracks()[0]?.label || "";
      // Prefer laptop/webcam over Continuity Camera when a local device exists.
      if (preferred?.localOnly && preferredDeviceId && isContinuityOrPhoneCamera(label)) {
        try {
          const localOnly = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: preferredDeviceId }, width: { ideal: 1280 } },
            audio: false,
          });
          stream.getTracks().forEach((track) => track.stop());
          return localOnly;
        } catch {
          // keep original stream if forced local reopen fails
        }
      }
      return stream;
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
