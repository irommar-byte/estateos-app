"use client";

import { BrowserMultiFormatReader } from "@zxing/library/esm/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

export type AztecScanPhase = "starting" | "position" | "searching" | "hold" | "decoding" | "success";

function buildAztecReader() {
  const hints = new Map<DecodeHintType, unknown>();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.AZTEC]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return new BrowserMultiFormatReader(hints, 250);
}

export type StartAztecVideoScanOptions = {
  video: HTMLVideoElement;
  onPhase: (phase: AztecScanPhase) => void;
  /** Called once after a stable decode — scanning is already stopped. */
  onPayload: (payload: string) => void;
  /** Freeze the live preview (pause video + disable tracks) before processing. */
  onLockFrame?: () => void;
  /**
   * Optional server-side decode of a JPEG frame (same path as photo upload).
   * Return Aztec payload text on success, or null/empty on miss.
   */
  decodeFrameOnServer?: (blob: Blob) => Promise<string | null>;
};

/** Pause preview so the last decoded frame stays on screen. */
export function freezeVideoPreview(video: HTMLVideoElement | null, stream: MediaStream | null) {
  if (video) {
    try {
      video.pause();
    } catch {
      /* ignore */
    }
  }
  stream?.getVideoTracks().forEach((track) => {
    try {
      track.enabled = false;
    } catch {
      /* ignore */
    }
  });
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality = 0.92): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
  });
}

function drawVideoVariants(video: HTMLVideoElement): HTMLCanvasElement[] {
  const vw = video.videoWidth || 0;
  const vh = video.videoHeight || 0;
  if (vw < 40 || vh < 40) return [];

  const out: HTMLCanvasElement[] = [];

  const full = document.createElement("canvas");
  const maxSide = 1280;
  const scale = Math.min(1, maxSide / Math.max(vw, vh));
  full.width = Math.max(1, Math.round(vw * scale));
  full.height = Math.max(1, Math.round(vh * scale));
  const fullCtx = full.getContext("2d", { willReadFrequently: true });
  if (!fullCtx) return [];
  fullCtx.drawImage(video, 0, 0, full.width, full.height);
  out.push(full);

  // Center square crop — matches the on-screen scan frame.
  const side = Math.floor(Math.min(full.width, full.height) * 0.72);
  const sx = Math.floor((full.width - side) / 2);
  const sy = Math.floor((full.height - side) / 2);
  if (side >= 120) {
    const crop = document.createElement("canvas");
    crop.width = Math.min(900, side);
    crop.height = crop.width;
    const cropCtx = crop.getContext("2d", { willReadFrequently: true });
    if (cropCtx) {
      cropCtx.drawImage(full, sx, sy, side, side, 0, 0, crop.width, crop.height);
      out.push(crop);
    }
  }

  // Slightly larger center region (helps when code is near frame edge).
  const side2 = Math.floor(Math.min(full.width, full.height) * 0.88);
  const sx2 = Math.floor((full.width - side2) / 2);
  const sy2 = Math.floor((full.height - side2) / 2);
  if (side2 >= 120 && side2 !== side) {
    const crop2 = document.createElement("canvas");
    crop2.width = Math.min(1000, side2);
    crop2.height = crop2.width;
    const crop2Ctx = crop2.getContext("2d", { willReadFrequently: true });
    if (crop2Ctx) {
      crop2Ctx.drawImage(full, sx2, sy2, side2, side2, 0, 0, crop2.width, crop2.height);
      out.push(crop2);
    }
  }

  return out;
}

function tryDecodeLocal(reader: BrowserMultiFormatReader, canvases: HTMLCanvasElement[]): string | null {
  for (const canvas of canvases) {
    try {
      const result = reader.decodeFromCanvas(canvas);
      const text = result?.getText()?.trim();
      if (text) return text;
    } catch {
      /* no code in this variant */
    }
  }
  return null;
}

/**
 * Live Aztec scan: grab frames from an already-playing video element,
 * try local ZXing, then fall back to the same server decoder used by photo upload.
 */
export function startAztecVideoScan({
  video,
  onPhase,
  onPayload,
  onLockFrame,
  decodeFrameOnServer,
}: StartAztecVideoScanOptions) {
  const reader = buildAztecReader();
  let stopped = false;
  let captured = false;
  let inFlight = false;
  let lastServerAt = 0;
  let consecutiveLocalHits = 0;
  let lastLocalPayload = "";
  let raf = 0;
  let timer: number | null = null;

  const stop = () => {
    stopped = true;
    if (raf) cancelAnimationFrame(raf);
    if (timer != null) window.clearInterval(timer);
    try {
      reader.reset();
    } catch {
      /* ignore */
    }
  };

  const commitPayload = (payload: string) => {
    if (captured || stopped) return;
    const text = payload.trim();
    if (!text) return;
    captured = true;
    onPhase("hold");
    stop();
    onLockFrame?.();
    onPhase("decoding");
    onPayload(text);
  };

  const tick = async () => {
    if (stopped || captured || inFlight) return;
    if (video.readyState < 2 || video.paused || video.ended) {
      onPhase("searching");
      return;
    }

    inFlight = true;
    try {
      const canvases = drawVideoVariants(video);
      if (!canvases.length) {
        onPhase("searching");
        return;
      }

      const local = tryDecodeLocal(reader, canvases);
      if (local) {
        if (local === lastLocalPayload) consecutiveLocalHits += 1;
        else {
          lastLocalPayload = local;
          consecutiveLocalHits = 1;
        }
        // One solid local hit is enough — previous continuous decoder kept resetting on misses.
        if (consecutiveLocalHits >= 1) {
          commitPayload(local);
          return;
        }
        onPhase("hold");
        return;
      }

      consecutiveLocalHits = 0;
      lastLocalPayload = "";
      onPhase("searching");

      if (!decodeFrameOnServer) return;
      const now = Date.now();
      if (now - lastServerAt < 1400) return;
      lastServerAt = now;

      // Prefer center crop for server (matches UI frame + upload success path).
      const preferred = canvases[1] || canvases[0];
      if (!preferred) return;
      const blob = await canvasToJpegBlob(preferred, 0.9);
      if (!blob || stopped || captured) return;

      onPhase("hold");
      const payload = await decodeFrameOnServer(blob);
      if (stopped || captured) return;
      if (payload?.trim()) {
        commitPayload(payload.trim());
        return;
      }
      onPhase("searching");
    } catch {
      if (!stopped && !captured) onPhase("searching");
    } finally {
      inFlight = false;
    }
  };

  onPhase("searching");
  // Interval is more reliable than depending solely on ZXing's continuous callback.
  timer = window.setInterval(() => {
    void tick();
  }, 450);
  void tick();

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

  let probe: MediaStream | null = null;
  try {
    probe = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  } catch {
    // continue
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
      if (preferred?.localOnly && preferredDeviceId && isContinuityOrPhoneCamera(label)) {
        try {
          const localOnly = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: preferredDeviceId }, width: { ideal: 1280 } },
            audio: false,
          });
          stream.getTracks().forEach((track) => track.stop());
          return localOnly;
        } catch {
          // keep original stream
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
