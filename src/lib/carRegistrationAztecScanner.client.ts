"use client";

export type AztecScanPhase = "starting" | "position" | "searching" | "hold" | "decoding" | "success";

export type StartAztecVideoScanOptions = {
  video: HTMLVideoElement;
  onPhase: (phase: AztecScanPhase) => void;
  /** Freeze the live preview (pause video + disable tracks) before processing. */
  onLockFrame?: () => void;
  /** Countdown seconds left (10…1), then null when capturing. */
  onCountdown?: (secondsLeft: number | null) => void;
  /**
   * Called once a still was taken from the camera after countdown.
   * Should run the same decode path as "upload photo".
   */
  onPhotoCaptured: (file: File) => void | Promise<void>;
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

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality = 0.95): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
    } catch {
      resolve(null);
    }
  });
}

/** High-quality still as if the user took a photo for upload. */
async function takePhotoFromVideo(video: HTMLVideoElement): Promise<File | null> {
  const vw = video.videoWidth || 0;
  const vh = video.videoHeight || 0;
  if (vw < 40 || vh < 40) return null;

  const canvas = document.createElement("canvas");
  const maxSide = 2000;
  const scale = Math.min(1, maxSide / Math.max(vw, vh));
  canvas.width = Math.max(1, Math.round(vw * scale));
  canvas.height = Math.max(1, Math.round(vh * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const blob = await canvasToJpegBlob(canvas, 0.95);
  if (!blob || blob.size < 2000) return null;
  return new File([blob], `aztec-live-${Date.now()}.jpg`, { type: "image/jpeg" });
}

/**
 * Live scan: give the user 10 seconds to place a clear Aztec code in the frame,
 * then take one photo and decode it with the same pipeline as "upload photo".
 */
export function startAztecVideoScan({
  video,
  onPhase,
  onLockFrame,
  onCountdown,
  onPhotoCaptured,
}: StartAztecVideoScanOptions) {
  let stopped = false;
  let captured = false;
  let inFlight = false;
  let secondsLeft = 10;
  let timer: number | null = null;

  const stop = () => {
    stopped = true;
    if (timer != null) {
      window.clearInterval(timer);
      timer = null;
    }
  };

  const keepVideoPlaying = async () => {
    try {
      if (video.paused) {
        await video.play().catch(() => undefined);
      }
    } catch {
      /* ignore */
    }
  };

  const snapAndDecode = async () => {
    if (stopped || captured || inFlight) return;
    inFlight = true;
    onCountdown?.(null);
    try {
      await keepVideoPlaying();
      const file = await takePhotoFromVideo(video);
      if (!file || stopped || captured) {
        onPhase("position");
        return;
      }

      captured = true;
      stop();
      onLockFrame?.();
      onPhase("decoding");
      await onPhotoCaptured(file);
      // On failure the gate resumes a new scanning session itself.
    } catch {
      captured = false;
      if (!stopped) onPhase("position");
    } finally {
      inFlight = false;
    }
  };

  const tickCountdown = () => {
    if (stopped || captured || inFlight) return;
    void keepVideoPlaying();

    secondsLeft -= 1;
    if (secondsLeft > 0) {
      onPhase(secondsLeft <= 3 ? "hold" : "position");
      onCountdown?.(secondsLeft);
      return;
    }

    onPhase("hold");
    void snapAndDecode();
  };

  onPhase("position");
  onCountdown?.(10);
  timer = window.setInterval(() => {
    tickCountdown();
  }, 1000);

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
