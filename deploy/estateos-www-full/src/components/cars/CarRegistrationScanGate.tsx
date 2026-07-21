"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, FolderOpen, Loader2, ScanLine, Upload } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import type { CarsDictionary } from "@/i18n/carsDictionary";
import type { CarFormState } from "@/components/cars/CarListingForm";
import type { CarListingMissingFieldKey } from "@/lib/polishRegistrationDocument.shared";
import {
  freezeVideoPreview,
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

const MISSING_LABEL_KEYS: Record<CarListingMissingFieldKey, keyof CarsDictionary["scan"]> = {
  title: "missingTitle",
  description: "missingDescription",
  mileageKm: "missingMileage",
  pricePln: "missingPrice",
  city: "missingCity",
  images: "missingImages",
};

const FILE_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif";

export function missingFieldsBanner(missing: CarListingMissingFieldKey[], scan: CarsDictionary["scan"]) {
  if (!missing.length) return null;
  const labels = missing.map((key) => scan[MISSING_LABEL_KEYS[key]]).join(", ");
  return `${scan.missingBannerPrefix} ${labels}.`;
}

export default function CarRegistrationScanGate({
  open,
  onSkip,
  onPrefill,
  preferUpload = false,
}: CarRegistrationScanGateProps) {
  const { dict, locale } = useLocale();
  const s = dict.cars.scan;
  const noFileSelectedLabel =
    locale === "en" ? "No image selected." : locale === "uk" ? "Фото не вибрано." : "Nie wybrano zdjęcia.";
  const retryUploadLabel =
    locale === "en" ? "Choose again" : locale === "uk" ? "Обрати знову" : "Wybierz ponownie";
  const pickFromGalleryLabel =
    locale === "en"
      ? "Choose photo from files"
      : locale === "uk"
        ? "Обрати фото з файлів"
        : "Wybierz zdjęcie z plików";
  const phaseCopy: Record<AztecScanPhase, string> = {
    starting: s.phaseStarting,
    position: s.phasePosition,
    searching: s.phaseSearching,
    hold: s.phaseHold,
    decoding: s.phaseDecoding,
    success: s.phaseSuccess,
  };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [frameLocked, setFrameLocked] = useState(false);
  const [phase, setPhase] = useState<AztecScanPhase>("starting");
  const [awaitingUploadPicker, setAwaitingUploadPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef(0);
  const stopScanRef = useRef<(() => void) | null>(null);
  const successTimerRef = useRef<number | null>(null);
  const lockedRef = useRef(false);

  const stopCamera = useCallback(() => {
    sessionRef.current += 1;
    lockedRef.current = false;
    stopScanRef.current?.();
    stopScanRef.current = null;
    setCameraReady(false);
    setFrameLocked(false);
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

  const lockPreview = useCallback(() => {
    lockedRef.current = true;
    setFrameLocked(true);
    freezeVideoPreview(videoRef.current, streamRef.current);
  }, []);


  const decodeLivePhotoRef = useRef<(file: File) => Promise<void>>(async () => {});

  const beginScanning = useCallback(
    (video: HTMLVideoElement) => {
      if (lockedRef.current) return;
      stopScanRef.current?.();
      stopScanRef.current = startAztecVideoScan({
        video,
        onPhase: setPhase,
        onLockFrame: lockPreview,
        onPhotoCaptured: async (file) => {
          await decodeLivePhotoRef.current(file);
        },
      });
    },
    [lockPreview],
  );



  const openUploadPicker = useCallback(() => {
    setAwaitingUploadPicker(true);
    setError(null);
    // User gesture → immediate click is more reliable than a delayed one on iOS.
    fileInputRef.current?.click();
  }, []);

  const decodeImageFile = async (file: File, opts?: { fromLive?: boolean }) => {
    setLoading(true);
    setError(null);
    setPhase("decoding");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/cars/decode-registration", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : s.errReadDoc);
      }
      const prefill = (data?.prefill || {}) as Partial<CarFormState>;
      const missingFields = Array.isArray(data?.missingFields)
        ? (data.missingFields as CarListingMissingFieldKey[])
        : [];
      setPhase("success");
      await new Promise<void>((resolve) => {
        successTimerRef.current = window.setTimeout(() => resolve(), 700);
      });
      onPrefill(prefill, missingFields);
      stopCamera();
    } catch (decodeError) {
      setError(decodeError instanceof Error ? decodeError.message : s.errAztec);
      if (opts?.fromLive) {
        lockedRef.current = false;
        setFrameLocked(false);
        setPhase("searching");
        streamRef.current?.getVideoTracks().forEach((track) => {
          track.enabled = true;
        });
        if (videoRef.current && streamRef.current) {
          void videoRef.current.play().catch(() => {});
          beginScanning(videoRef.current);
        }
      } else {
        setPhase("position");
      }
    } finally {
      setLoading(false);
    }
  };

  decodeLivePhotoRef.current = async (file: File) => {
    await decodeImageFile(file, { fromLive: true });
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
    lockedRef.current = false;
    setFrameLocked(false);
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
      setError(cameraError instanceof Error ? cameraError.message : s.errCamera);
      setPhase("position");
    }
  }, [attachStreamToVideo, s.errCamera]);

  useEffect(() => {
    if (!open) {
      stopCamera();
      setPhase("starting");
      setError(null);
      setAwaitingUploadPicker(false);
      return;
    }

    if (preferUpload) {
      setPhase("position");
      setCameraReady(false);
      setError(null);
      // Defer one tick so the hidden input is mounted.
      const id = window.setTimeout(() => openUploadPicker(), 0);
      return () => {
        window.clearTimeout(id);
        stopCamera();
        setAwaitingUploadPicker(false);
      };
    }

    setAwaitingUploadPicker(false);
    void startCamera();
    return () => {
      stopCamera();
    };
  }, [open, preferUpload, startCamera, stopCamera, openUploadPicker]);

  if (!open) return null;

  const scanning = cameraReady && !frameLocked && phase !== "success" && phase !== "decoding";
  const phaseLabel = phaseCopy[phase];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto overscroll-contain bg-[var(--eos-bg)]/85 px-3 pb-8 backdrop-blur-md sm:px-4 sm:pb-10"
      style={{ paddingTop: "calc(var(--eos-nav-height) + 0.75rem)" }}
    >
      <div className="my-auto flex w-full max-w-xl flex-col rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-card)] shadow-2xl">
        <div className="shrink-0 border-b border-[var(--eos-border)] px-5 py-3 sm:px-6 sm:py-4">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-sky-500">EstateOS™Car</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-[var(--eos-text)] sm:text-xl">{s.title}</h2>
          <p className="mt-1 text-xs text-[var(--eos-muted)]">{preferUpload ? pickFromGalleryLabel : s.subtitle}</p>
        </div>

        <div className="relative h-[min(42dvh,360px)] shrink-0 bg-[var(--eos-bg-elevated)] sm:h-[min(46dvh,400px)]">
          {!preferUpload ? (
            <video
              ref={videoRef}
              className={`absolute inset-0 h-full w-full object-contain transition-[filter] duration-300 ${
                frameLocked ? "brightness-[0.92] contrast-[1.05]" : ""
              }`}
              muted
              playsInline
              autoPlay
            />
          ) : null}

          {preferUpload || !cameraReady ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black px-6 text-center">
              {error ? (
                <>
                  <p className="text-sm text-red-300">{error}</p>
                  <button
                    type="button"
                    onClick={() => {
                      if (preferUpload) {
                        setError(null);
                        openUploadPicker();
                        return;
                      }
                      void startCamera();
                    }}
                    className="rounded-full border border-sky-400/40 bg-sky-500/15 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-sky-200"
                  >
                    {preferUpload ? retryUploadLabel : s.retry}
                  </button>
                </>
              ) : (
                <>
                  {preferUpload || awaitingUploadPicker ? (
                    <FolderOpen className="size-8 text-sky-300" />
                  ) : (
                    <Loader2 className="size-8 animate-spin text-sky-300" />
                  )}
                  <p className="text-sm text-white/85">
                    {preferUpload || awaitingUploadPicker ? pickFromGalleryLabel : s.phaseStarting}
                  </p>
                  <p className="text-xs text-white/55">
                    {preferUpload ? s.uploadInstead : s.cameraDesktopHint}
                  </p>
                  {preferUpload ? (
                    <button
                      type="button"
                      onClick={openUploadPicker}
                      className="mt-2 inline-flex items-center gap-2 rounded-full border border-sky-400/40 bg-sky-500/15 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-sky-200"
                    >
                      <Upload className="size-3.5" />
                      {pickFromGalleryLabel}
                    </button>
                  ) : null}
                </>
              )}
            </div>
          ) : (
            <>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/65" />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-[12%]">
                <div
                  className={`relative aspect-square w-full max-w-[260px] rounded-2xl border-2 transition-all duration-300 ${
                    phase === "hold"
                      ? "border-amber-400 shadow-[0_0_40px_rgba(251,191,36,0.55)] scale-[1.02]"
                      : phase === "success" || frameLocked
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
                  {frameLocked && phase !== "success" ? (
                    <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/35">
                      <Loader2 className="size-8 animate-spin text-sky-200" />
                    </div>
                  ) : null}
                  {phase === "success" ? (
                    <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-emerald-500/20">
                      <CheckCircle2 className="size-10 text-emerald-300" />
                    </div>
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
                <p className="text-center text-[11px] text-white/70">{s.autoScanHint}</p>
              </div>
            </>
          )}
        </div>

        <div className="shrink-0 space-y-2 border-t border-[var(--eos-border)] px-5 py-3 sm:px-6 sm:py-4">
          {!preferUpload ? (
            <button
              type="button"
              onClick={openUploadPicker}
              disabled={loading || frameLocked}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-[var(--eos-border)] bg-[var(--eos-surface)] px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] disabled:opacity-60"
            >
              <Upload className="size-3.5" />
              {loading ? s.decoding : s.uploadInstead}
            </button>
          ) : null}
          <input
            ref={fileInputRef}
            type="file"
            accept={FILE_ACCEPT}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              setAwaitingUploadPicker(false);
              if (file) {
                void decodeImageFile(file);
              } else if (preferUpload) {
                setError(noFileSelectedLabel);
              }
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
            {s.skip}
          </button>
          {error && cameraReady ? <p className="text-center text-sm text-red-600 dark:text-red-400">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}

export function highlightClass(active: boolean) {
  return active ? "ring-2 ring-amber-400/70 border-amber-400/60" : "";
}
