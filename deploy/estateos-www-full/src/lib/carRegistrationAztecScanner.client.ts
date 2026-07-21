"use client";

export type AztecScanPhase = "starting" | "position" | "searching" | "hold" | "decoding" | "success";

export type StartAztecVideoScanOptions = {
  video: HTMLVideoElement;
  onPhase: (phase: AztecScanPhase) => void;
  /** Called once after a stable decode — scanning is already stopped. */
  onPayload: (payload: string) => void;
  /** Freeze the live preview (pause video + disable tracks) before processing. */
  onLockFrame?: () => void;
  /**
   * Server-side decode of a JPEG frame (same path as photo upload).
   * Return Aztec payload text on success, or null/empty on miss.
   */
  decodeFrameOnServer: (blob: Blob) => Promise<string | null>;
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
    try {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
    } catch {
      resolve(null);
    }
  });
}

/** Capture full frame + center crops that match the on-screen scan frame. */
function captureFrameBlobs(video: HTMLVideoElement): Promise<Blob[]> {
  const vw = video.videoWidth || 0;
  const vh = video.videoHeight || 0;
  if (vw < 40 || vh < 40) return Promise.resolve([]);

  const full = document.createElement("canvas");
  const maxSide = 1400;
  const scale = Math.min(1, maxSide / Math.max(vw, vh));
  full.width = Math.max(1, Math.round(vw * scale));
  full.height = Math.max(1, Math.round(vh * scale));
  const fullCtx = full.getContext("2d");
  if (!fullCtx) return Promise.resolve([]);
  fullCtx.drawImage(video, 0, 0, full.width, full.height);

  const canvases: HTMLCanvasElement[] = [full];

  const addCrop = (ratio: number, maxOut: number) => {
    const side = Math.floor(Math.min(full.width, full.height) * ratio);
    if (side < 140) return;
    const sx = Math.floor((full.width - side) / 2);
    const sy = Math.floor((full.height - side) / 2);
    const crop = document.createElement("canvas");
    crop.width = Math.min(maxOut, side);
    crop.height = crop.width;
    const ctx = crop.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(full, sx, sy, side, side, 0, 0, crop.width, crop.height);
    canvases.push(crop);
  };

  addCrop(0.72, 960);
  addCrop(0.9, 1100);

  return Promise.all(canvases.map((c) => canvasToJpegBlob(c, 0.9))).then(
    (blobs) => blobs.filter((b): b is Blob => Boolean(b && b.size > 800)),
  );
}

/**
 * Live Aztec scan without browser ZXing (Safari-safe).
 * Samples video frames and decodes them with the same server path as photo upload.
 */
export function startAztecVideoScan({
  video,
  onPhase,
  onPayload,
  onLockFrame,
  decodeFrameOnServer,
}: StartAztecVideoScanOptions) {
  let stopped = false;
  let captured = false;
  let inFlight = false;
  let timer: number | null = null;

  const stop = () => {
    stopped = true;
    if (timer != null) {
      window.clearInterval(timer);
      timer = null;
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
    if (video.readyState < 2) {
      onPhase("searching");
      return;
    }
    // Keep scanning even if briefly paused after focus changes.
    if (video.ended) return;

    inFlight = true;
    onPhase("searching");
    try {
      if (video.paused) {
        try {
          await video.play();
        } catch {
          /* ignore */
        }
      }

      const blobs = await captureFrameBlobs(video);
      if (!blobs.length || stopped || captured) {
        onPhase("searching");
        return;
      }

      // Prefer center crop first (index 1), then full, then wider crop.
      const ordered = [blobs[1], blobs[0], blobs[2]].filter(Boolean) as Blob[];
      onPhase("hold");

      for (const blob of ordered) {
        if (stopped || captured) return;
        const payload = await decodeFrameOnServer(blob);
        if (payload?.trim()) {
          commitPayload(payload.trim());
          return;
        }
      }
      onPhase("searching");
    } catch {
      if (!stopped && !captured) onPhase("searching");
    } finally {
      inFlight = false;
    }
  };

  onPhase("searching");
  timer = window.setInterval(() => {
    void tick();
  }, 1100);
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
