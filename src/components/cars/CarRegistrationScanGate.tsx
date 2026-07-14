"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, ScanLine, Upload } from "lucide-react";
import type { CarFormState } from "@/components/cars/CarListingForm";
import type { CarListingMissingFieldKey } from "@/lib/polishRegistrationDocument.shared";
import {
  requestCameraStream,
  startAztecVideoScan,
  type AztecScanPhase,
} from "@/lib/carRegistrationAztecScanner.client";

type CarRegistrationScanGateProps = {
  open: boolean;
  onSkip: () => void;
  onPrefill: (prefill: Partial<CarFormState>, missingFields: CarListingMissingFieldKey[]) => void;
  preferUpload?: boolean;
};

const MISSING_LABELS: Record<CarListingMissingFieldKey, string> = {
  title: "tytuł",
  description: "opis",
  mileageKm: "przebieg",
  pricePln: "cenę",
  city: "miejscowość",
  images: "zdjęcia",
};

const PHASE_COPY: Record<AztecScanPhase, string> = {
  starting: "Uruchamiam aparat…",
  position: "Ustaw tył dowodu — kod Aztec po prawej w ramce",
  searching: "Szukam kodu Aztec…",
  hold: "Kod wykryty — trzymaj nieruchomo…",
  decoding: "Odczytuję dane z dowodu…",
  success: "Gotowe!",
};

export default function CarRegistrationScanGate({ open, onSkip, onPrefill, preferUpload = false }: CarRegistrationScanGateProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [phase, setPhase] = useState<AztecScanPhase>("starting");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef(0);
  const stopScanRef = useRef<(() => void) | null>(null);
  const successTimerRef = useRef<number | null>(null);
  const decodePayloadRef = useRef<(payload: string) => void>(() => {});

  const stopCamera = useCallback(() => {
    sessionRef.current += 1;
    stopScanRef.current?.();
    stopScanRef.current = null;
    setCameraReady(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (successTimerRef.current) {
      window.clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
  }, []);

  const applyResponse = async (response: Response) => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(typeof data?.error === "string" ? data.error : "Nie udało się odczytać dowodu.");
    }
    const prefill = (data?.prefill || {}) as Partial<CarFormState>;
    const missingFields = Array.isArray(data?.missingFields)
      ? (data.missingFields as CarListingMissingFieldKey[])
      : [];
    onPrefill(prefill, missingFields);
  };

  const beginScanning = useCallback((video: HTMLVideoElement) => {
    stopScanRef.current?.();
    stopScanRef.current = startAztecVideoScan({
      video,
      onPhase: setPhase,
      onPayload: (payload) => decodePayloadRef.current(payload),
    });
  }, []);

  const decodeAztecPayload = useCallback(
    async (aztecPayload: string) => {
      setLoading(true);
      setError(null);
      setPhase("decoding");
      try {
        const response = await fetch("/api/cars/decode-registration", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ aztecPayload }),
        });
        await applyResponse(response);
        setPhase("success");
        successTimerRef.current = window.setTimeout(() => {
          stopCamera();
        }, 700);
      } catch (decodeError) {
        setPhase("searching");
        setError(
          decodeError instanceof Error
            ? decodeError.message
            : "Nie udało się odczytać kodu Aztec — ustaw dowód w kadrze i spróbuj ponownie.",
        );
        if (videoRef.current && streamRef.current) beginScanning(videoRef.current);
      } finally {
        setLoading(false);
      }
    },
    [beginScanning, onPrefill, stopCamera],
  );

  decodePayloadRef.current = (payload: string) => {
    void decodeAztecPayload(payload);
  };

  const decodeImageFile = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/cars/decode-registration", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      await applyResponse(response);
      stopCamera();
    } catch (decodeError) {
      setError(
        decodeError instanceof Error
          ? decodeError.message
          : "Nie udało się odczytać kodu Aztec — ustaw dowód w kadrze i spróbuj ponownie.",
      );
    } finally {
      setLoading(false);
    }
  };

  const attachStreamToVideo = useCallback(
    async (media: MediaStream, session: number) => {
      const video = videoRef.current;
      if (!video || session !== sessionRef.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }

      video.setAttribute("playsinline", "true");
      video.setAttribute("webkit-playsinline", "true");
      video.muted = true;
      video.srcObject = media;

      await new Promise<void>((resolve, reject) => {
        const onReady = () => {
          video.removeEventListener("loadedmetadata", onReady);
          resolve();
        };
        video.addEventListener("loadedmetadata", onReady);
        void video.play().catch(reject);
      });

      if (session !== sessionRef.current) return;

      setCameraReady(true);
      setPhase("searching");
      beginScanning(video);
    },
    [beginScanning],
  );

  const startCamera = useCallback(async () => {
    const session = sessionRef.current;
    setError(null);
    setPhase("starting");
    setCameraReady(false);
    try {
      const media = await requestCameraStream();
      if (session !== sessionRef.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = media;
      await attachStreamToVideo(media, session);
    } catch (cameraError) {
      if (session !== sessionRef.current) return;
      setError(cameraError instanceof Error ? cameraError.message : "Nie udało się uruchomić aparatu.");
      setPhase("position");
    }
  }, [attachStreamToVideo]);

  useEffect(() => {
    if (!open) {
      stopCamera();
      setPhase("starting");
      setError(null);
      return;
    }

    if (preferUpload) {
      setPhase("position");
      setCameraReady(false);
      window.setTimeout(() => fileInputRef.current?.click(), 120);
      return () => {
        stopCamera();
      };
    }

    void startCamera();
    return () => {
      stopCamera();
    };
  }, [open, preferUpload, startCamera, stopCamera]);

  if (!open) return null;

  const scanning = cameraReady && phase !== "success";
  const phaseLabel = PHASE_COPY[phase];

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/80 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[100dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)] shadow-2xl sm:max-h-[92dvh] sm:rounded-3xl">
        <div className="shrink-0 border-b border-[var(--eos-border)] px-5 py-3 sm:px-6 sm:py-4">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-sky-500">Skaner dowodu</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight sm:text-xl">Kod Aztec — skan automatyczny</h2>
        </div>

        <div className="relative min-h-[min(58dvh,520px)] flex-1 bg-black">
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-contain"
            muted
            playsInline
            autoPlay
          />

          {!cameraReady ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black px-6 text-center">
              {error ? (
                <>
                  <p className="text-sm text-red-300">{error}</p>
                  <button
                    type="button"
                    onClick={() => void startCamera()}
                    className="rounded-full border border-sky-400/40 bg-sky-500/15 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-sky-200"
                  >
                    Spróbuj ponownie
                  </button>
                </>
              ) : (
                <>
                  <Loader2 className="size-8 animate-spin text-sky-300" />
                  <p className="text-sm text-white/85">Uruchamiam aparat…</p>
                  <p className="text-xs text-white/55">Na komputerze wybierz kamerę w pasku adresu Safari/Chrome.</p>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/65" />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-end px-[7%] py-[10%]">
                <div
                  className={`relative aspect-square w-[46%] max-w-[240px] rounded-2xl border-2 transition-all duration-300 ${
                    phase === "hold"
                      ? "border-amber-400 shadow-[0_0_40px_rgba(251,191,36,0.55)]"
                      : phase === "success"
                        ? "border-emerald-400 shadow-[0_0_40px_rgba(52,211,153,0.55)]"
                        : "border-sky-300/90 shadow-[0_0_28px_rgba(56,189,248,0.35)]"
                  }`}
                >
                  <span className="absolute -left-1 -top-1 size-5 border-l-2 border-t-2 border-current text-sky-300" />
                  <span className="absolute -right-1 -top-1 size-5 border-r-2 border-t-2 border-current text-sky-300" />
                  <span className="absolute -bottom-1 -left-1 size-5 border-b-2 border-l-2 border-current text-sky-300" />
                  <span className="absolute -bottom-1 -right-1 size-5 border-b-2 border-r-2 border-current text-sky-300" />
                  {scanning ? (
                    <div className="absolute inset-x-2 top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-gradient-to-r from-transparent via-sky-300 to-transparent" />
                  ) : null}
                </div>
              </div>
              <div className="absolute inset-x-0 bottom-0 space-y-1 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-4 pb-4 pt-12">
                <div className="flex items-center justify-center gap-2 text-center text-sm font-semibold text-white">
                  {phase === "decoding" || loading ? (
                    <Loader2 className="size-4 animate-spin text-sky-300" />
                  ) : phase === "success" ? (
                    <CheckCircle2 className="size-4 text-emerald-400" />
                  ) : (
                    <ScanLine className="size-4 text-sky-300" />
                  )}
                  <span>{phaseLabel}</span>
                </div>
                <p className="text-center text-[11px] text-white/70">
                  Przyłóż tył dowodu — przechwycimy kod sam, bez przycisku.
                </p>
              </div>
            </>
          )}
        </div>

        <div className="shrink-0 space-y-2 border-t border-[var(--eos-border)] px-5 py-3 sm:px-6 sm:py-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-[var(--eos-border)] bg-[var(--eos-surface)] px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] disabled:opacity-60"
          >
            <Upload className="size-3.5" />
            {loading ? "Odczytywanie…" : "Wgraj zdjęcie zamiast aparatu"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void decodeImageFile(file);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onSkip();
            }}
            className="w-full rounded-full px-4 py-2 text-xs font-semibold text-[var(--eos-muted)] hover:text-[var(--eos-text)]"
          >
            Nie mam dowodu — wypełnię ręcznie
          </button>
          {error && cameraReady ? <p className="text-center text-sm text-red-400">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}

export function missingFieldsBanner(missing: CarListingMissingFieldKey[]) {
  if (!missing.length) return null;
  const labels = missing.map((key) => MISSING_LABELS[key]).join(", ");
  return `Uzupełnij jeszcze: ${labels}.`;
}

export function highlightClass(active: boolean) {
  return active ? "ring-2 ring-amber-400/70 border-amber-400/60" : "";
}
