"use client";

import { useRef, useState } from "react";
import type { CarFormState } from "@/components/cars/CarListingForm";
import type { CarListingMissingFieldKey } from "@/lib/polishRegistrationDocument";

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

export default function CarRegistrationScanGate({ open, onSkip, onPrefill }: CarRegistrationScanGateProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanLockRef = useRef(false);

  if (!open) return null;

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

  const decodePayload = async (aztecPayload: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/cars/decode-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ aztecPayload }),
      });
      await applyResponse(response);
      stopCamera();
    } catch (decodeError) {
      setError(decodeError instanceof Error ? decodeError.message : "Nie udało się odczytać dowodu.");
    } finally {
      setLoading(false);
      scanLockRef.current = false;
    }
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
      setError(decodeError instanceof Error ? decodeError.message : "Nie udało się odczytać zdjęcia dowodu.");
    } finally {
      setLoading(false);
    }
  };

  const stopCamera = () => {
    setCameraOpen(false);
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const startCamera = async () => {
    setError(null);
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      setStream(media);
      setCameraOpen(true);
      scanLockRef.current = false;
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = media;
          void videoRef.current.play();
        }
      });
    } catch {
      setError("Brak dostępu do aparatu. Możesz wgrać zdjęcie dowodu.");
    }
  };

  const scanFrame = async () => {
    if (!videoRef.current || scanLockRef.current || loading) return;
    scanLockRef.current = true;
    try {
      const { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } = await import("@zxing/library");
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.AZTEC]);
      const reader = new BrowserMultiFormatReader(hints);
      const result = await reader.decodeFromVideoElement(videoRef.current);
      const payload = result.getText();
      if (payload) await decodePayload(payload);
      else scanLockRef.current = false;
    } catch {
      scanLockRef.current = false;
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-6 shadow-2xl">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-sky-400">Dowód rejestracyjny</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">Czy masz dowód rejestracyjny?</h2>
        <p className="mt-3 text-sm text-[var(--eos-muted)]">
          Zeskanuj kod Aztec z dowodu aparatem lub wgraj zdjęcie — uzupełnimy VIN, nr rejestracyjny, markę, model i
          parametry silnika. Cenę, opis i zdjęcia auta uzupełnisz ręcznie.
        </p>

        {cameraOpen ? (
          <div className="mt-4 space-y-3">
            <div className="overflow-hidden rounded-2xl border border-[var(--eos-border)] bg-black">
              <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline />
            </div>
            <button
              type="button"
              onClick={() => void scanFrame()}
              disabled={loading}
              className="w-full rounded-full border border-sky-400/40 bg-sky-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-sky-300 disabled:opacity-60"
            >
              {loading ? "Odczytywanie..." : "Skanuj klatkę"}
            </button>
            <button
              type="button"
              onClick={stopCamera}
              className="w-full rounded-full border border-[var(--eos-border)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em]"
            >
              Zamknij aparat
            </button>
          </div>
        ) : (
          <div className="mt-5 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => void startCamera()}
              disabled={loading}
              className="rounded-full border border-sky-400/40 bg-sky-500/10 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-sky-300 disabled:opacity-60"
            >
              Skanuj aparatem
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="rounded-full border border-[var(--eos-border)] bg-[var(--eos-surface)] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] disabled:opacity-60"
            >
              {loading ? "Odczytywanie..." : "Wgraj zdjęcie dowodu"}
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
              className="rounded-full px-4 py-2 text-xs font-semibold text-[var(--eos-muted)] hover:text-[var(--eos-text)]"
            >
              Nie mam dowodu — wypełnię ręcznie
            </button>
          </div>
        )}

        {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
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
