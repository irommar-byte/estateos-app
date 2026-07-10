"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, ScanLine } from "lucide-react";
import type { CarFormState } from "@/components/cars/CarListingForm";
import type { CarListingMissingFieldKey } from "@/lib/polishRegistrationDocument.shared";
import { startAztecVideoScan, type AztecScanPhase } from "@/lib/carRegistrationAztecScanner.client";

type CarRegistrationScanGateProps = {
  open: boolean;
  onSkip: () => void;
  onPrefill: (prefill: Partial<CarFormState>, missingFields: CarListingMissingFieldKey[]) => void;
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
  position: "Ustaw tył dowodu w ramce — kod Aztec po prawej",
  searching: "Szukam kodu Aztec…",
  hold: "Kod wykryty — trzymaj nieruchomo…",
  decoding: "Odczytuję dane z dowodu…",
  success: "Gotowe!",
};

export default function CarRegistrationScanGate({ open, onSkip, onPrefill }: CarRegistrationScanGateProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [phase, setPhase] = useState<AztecScanPhase>("starting");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopScanRef = useRef<(() => void) | null>(null);
  const successTimerRef = useRef<number | null>(null);
  const decodePayloadRef = useRef<(payload: string) => void>(() => {});

  const stopCamera = useCallback(() => {
    stopScanRef.current?.();
    stopScanRef.current = null;
    setCameraOpen(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStream(null);
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
        if (videoRef.current) {
          stopScanRef.current = startAztecVideoScan({
            video: videoRef.current,
            onPhase: setPhase,
            onPayload: (payload) => decodePayloadRef.current(payload),
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [onPrefill, stopCamera],
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

  const startCamera = useCallback(async () => {
    setError(null);
    setPhase("starting");
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = media;
      setStream(media);
      setCameraOpen(true);
    } catch {
      setError("Brak dostępu do aparatu. Możesz wgrać zdjęcie dowodu.");
      setCameraOpen(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      stopCamera();
      setPhase("starting");
      setError(null);
      return;
    }
    void startCamera();
    return () => {
      stopCamera();
    };
  }, [open, startCamera, stopCamera]);

  useEffect(() => {
    if (!cameraOpen || !stream || !videoRef.current) return;
    const video = videoRef.current;
    video.srcObject = stream;
    void video.play().catch(() => {
      setError("Nie udało się uruchomić podglądu aparatu.");
    });

    const onReady = () => {
      stopScanRef.current?.();
      stopScanRef.current = startAztecVideoScan({
        video,
        onPhase: setPhase,
        onPayload: (payload) => decodePayloadRef.current(payload),
      });
    };

    if (video.readyState >= 2) onReady();
    else video.addEventListener("loadeddata", onReady, { once: true });

    return () => {
      video.removeEventListener("loadeddata", onReady);
      stopScanRef.current?.();
      stopScanRef.current = null;
    };
  }, [cameraOpen, stream]);

  if (!open) return null;

  const scanning = cameraOpen && phase !== "success";
  const phaseLabel = PHASE_COPY[phase];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-4">
      <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-card)] shadow-2xl">
        <div className="border-b border-[var(--eos-border)] px-5 py-4 sm:px-6">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-sky-500">Dowód rejestracyjny</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">Skanuj kod Aztec automatycznie</h2>
          <p className="mt-2 text-sm text-[var(--eos-muted)]">
            Ustaw tył dowodu w kadrze — gdy kod będzie ostry i w ramce, sam go przechwycimy i uzupełnimy formularz.
          </p>
        </div>

        {cameraOpen ? (
          <div className="relative bg-black">
            <video ref={videoRef} className="aspect-[3/4] w-full object-cover" muted playsInline autoPlay />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/55" />

            <div className="pointer-events-none absolute inset-0 flex items-center justify-end px-[8%] py-[14%]">
              <div
                className={`relative aspect-square w-[42%] max-w-[220px] rounded-2xl border-2 transition-all duration-300 ${
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

            <div className="absolute inset-x-0 bottom-0 space-y-2 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-4 pb-4 pt-10">
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
                Kod kwadratowy (Aztec) po prawej stronie tyłu dowodu — bez przycisku, skan trwa sam.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex aspect-[3/4] items-center justify-center bg-black/90 px-6 text-center text-sm text-white/80">
            {error ? error : "Ładowanie aparatu…"}
          </div>
        )}

        <div className="space-y-3 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="w-full rounded-full border border-[var(--eos-border)] bg-[var(--eos-surface)] px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] disabled:opacity-60"
          >
            {loading ? "Odczytywanie…" : "Wgraj zdjęcie zamiast aparatu"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
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
          {error && cameraOpen ? <p className="text-center text-sm text-red-400">{error}</p> : null}
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
