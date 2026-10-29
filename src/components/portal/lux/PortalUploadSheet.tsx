"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, RefreshCw, Send, UploadCloud, X } from "lucide-react";
import PortalFilePreview from "@/components/portal/lux/PortalFilePreview";
import {
  PORTAL_UPLOAD_MAX_BYTES,
  formatBytes,
  formatEta,
  isUploadProblem,
  uploadWithProgress,
  validatePortalFile,
  type UploadProblem,
  type UploadProgress,
} from "@/lib/portalUpload";
import { usePortalLocale } from "@/components/portal/PortalLocale";

type Phase = "review" | "uploading" | "done" | "error";

/**
 * Okno wysyłania pliku: podgląd przed wysłaniem, rozmiar względem limitu, pasek postępu
 * z prędkością i czasem do końca, potwierdzenie albo konkretna przyczyna błędu.
 */
export default function PortalUploadSheet<T = Record<string, unknown>>({
  file,
  targetLabel,
  targetHint,
  agentFirst,
  url,
  buildForm,
  onPickAnother,
  onClose,
  onUploaded,
}: {
  file: File | null;
  targetLabel: string;
  targetHint?: string | null;
  agentFirst: string;
  url: string;
  buildForm: (file: File) => FormData;
  onPickAnother: () => void;
  onClose: () => void;
  onUploaded: (json: T) => void;
}) {
  const { t } = usePortalLocale();
  // Komponent jest montowany od nowa dla każdego pliku (key w rodzicu) — stan startowy liczymy raz.
  const [problem, setProblem] = useState<UploadProblem | null>(() => (file ? validatePortalFile(file) : null));
  const [phase, setPhase] = useState<Phase>(() => (file && validatePortalFile(file) ? "error" : "review"));
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const objectUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  useEffect(() => {
    if (!file) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [file]);

  const close = useCallback(() => {
    if (phase === "uploading") return;
    onClose();
  }, [phase, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const send = async () => {
    if (!file) return;
    const local = validatePortalFile(file);
    if (local) {
      setProblem(local);
      setPhase("error");
      return;
    }
    setProblem(null);
    setPhase("uploading");
    setProgress({ loaded: 0, total: file.size, percent: 0, speed: 0, etaSeconds: null, processing: false });
    const handle = uploadWithProgress<T>({ url, form: buildForm(file), file, onProgress: setProgress });
    abortRef.current = handle.abort;
    try {
      const json = await handle.promise;
      setPhase("done");
      window.setTimeout(() => onUploaded(json), 1300);
    } catch (e) {
      setProblem(
        isUploadProblem(e)
          ? e
          : { title: t("Nie udało się wysłać"), detail: e instanceof Error ? e.message : t("Nieznana przyczyna — spróbuj ponownie.") },
      );
      setPhase("error");
    } finally {
      abortRef.current = null;
    }
  };

  if (typeof document === "undefined") return null;
  const usage = file ? Math.min(100, (file.size / PORTAL_UPLOAD_MAX_BYTES) * 100) : 0;
  const tooBig = file ? file.size > PORTAL_UPLOAD_MAX_BYTES : false;

  return createPortal(
    <AnimatePresence>
      {file ? (
        <motion.div
          key="backdrop"
          className="portal-lux fixed inset-0 z-[90] flex items-end justify-center bg-black/55 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
          role="presentation"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`${t("Wysyłanie")}: ${targetLabel}`}
            className="relative max-h-[94dvh] w-full max-w-[560px] overflow-y-auto rounded-t-[28px] bg-[var(--lux-well)] text-[var(--lux-ink)] shadow-[0_30px_80px_rgba(0,0,0,0.35)] sm:rounded-[28px]"
            initial={{ y: 60, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 60, scale: 0.97, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
              <div className="min-w-0">
                <p className="lux-kicker">
                  {phase === "done" ? t("Wysłane") : phase === "uploading" ? t("Wysyłanie") : phase === "error" ? t("Nie wysłano") : t("Sprawdź przed wysłaniem")}
                </p>
                <h2 className="lux-serif mt-1 text-[22px] font-medium leading-tight">{targetLabel}</h2>
                {targetHint && phase === "review" ? <p className="mt-1 text-[12px] text-[var(--lux-ink-3)]">{targetHint}</p> : null}
              </div>
              <button
                type="button"
                onClick={close}
                disabled={phase === "uploading"}
                aria-label={t("Zamknij")}
                className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[var(--lux-line)] bg-[var(--lux-card)] disabled:opacity-30"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 pb-6">
              {/* Okno podglądu — przyciemnia się i „unosi” w trakcie wysyłania */}
              <motion.div
                className="relative"
                animate={phase === "uploading" ? { scale: 0.97, opacity: 0.75 } : phase === "done" ? { scale: 0.92, opacity: 0.35 } : { scale: 1, opacity: 1 }}
                transition={{ duration: 0.35 }}
              >
                {objectUrl ? <PortalFilePreview src={objectUrl} name={file.name} mimeType={file.type} height={300} /> : null}
                {phase === "uploading" ? <div className="eos-upload-scan pointer-events-none absolute inset-0 rounded-[18px]" /> : null}
                <AnimatePresence>
                  {phase === "done" ? (
                    <motion.div
                      className="absolute inset-0 flex items-center justify-center"
                      initial={{ scale: 0.4, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 260, damping: 16 }}
                    >
                      <span className="flex size-24 items-center justify-center rounded-full bg-[#2F9E6A] text-white shadow-[0_18px_40px_rgba(47,158,106,0.45)]">
                        <CheckCircle2 className="size-12" strokeWidth={2.2} />
                      </span>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.div>

              {/* Plik i rozmiar względem limitu */}
              <div className="rounded-[18px] border border-[var(--lux-line)] bg-[var(--lux-card)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-[14px] font-bold">{file.name}</p>
                  <p className={`shrink-0 text-[13px] font-bold ${tooBig ? "text-[var(--lux-danger)]" : "text-[var(--lux-ink)]"}`}>{formatBytes(file.size)}</p>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--lux-well)]">
                  <div className={`h-full rounded-full ${tooBig ? "bg-[#C2412D]" : "bg-[#D8C3A0]"}`} style={{ width: `${usage}%` }} />
                </div>
                <p className="mt-1.5 text-[11px] text-[var(--lux-ink-3)]">
                  {formatBytes(file.size)} / {formatBytes(PORTAL_UPLOAD_MAX_BYTES)}
                </p>
              </div>

              {phase === "uploading" && progress ? (
                <div className="rounded-[18px] bg-black p-4 text-[#F6F3EE]">
                  <div className="flex items-baseline justify-between">
                    <p className="text-[13px] font-semibold text-[#D8C3A0]">
                      {progress.processing ? t("Zapisuję…") : t("Wysyłam…")}
                    </p>
                    <p className="lux-serif text-[26px] leading-none">{progress.percent}%</p>
                  </div>
                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/15">
                    <motion.div
                      className={`h-full rounded-full bg-[#D8C3A0] ${progress.processing ? "eos-upload-bar--busy" : ""}`}
                      animate={{ width: `${Math.max(3, progress.percent)}%` }}
                      transition={{ ease: "easeOut", duration: 0.25 }}
                    />
                  </div>
                  <p className="mt-2 text-[12px] text-[#BDB6AA]">
                    {formatBytes(progress.loaded)} / {formatBytes(progress.total)}
                    {!progress.processing && progress.speed > 0 ? ` · ${formatBytes(progress.speed)}/s · ${t(formatEta(progress.etaSeconds))}` : ""}
                  </p>
                </div>
              ) : null}

              {phase === "done" ? (
                <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-center text-[14px] font-semibold text-[var(--lux-good)]">
                  {t("Gotowe — {agent} dostał powiadomienie i sprawdzi dokument.", { agent: agentFirst })}
                </motion.p>
              ) : null}

              {phase === "error" && problem ? (
                <motion.div
                  initial={{ x: -8 }}
                  animate={{ x: [0, -6, 6, -3, 3, 0] }}
                  transition={{ duration: 0.4 }}
                  className="rounded-[18px] border border-[var(--lux-danger-line)] bg-[var(--lux-danger-soft)] p-4"
                  role="alert"
                >
                  <p className="flex items-center gap-2 text-[14px] font-bold text-[var(--lux-danger)]">
                    <AlertTriangle className="size-4 shrink-0" />
                    {t(problem.title)}
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-[var(--lux-ink-2)]">{t(problem.detail)}</p>
                </motion.div>
              ) : null}

              <div className="flex flex-col gap-2 sm:flex-row-reverse">
                {phase === "review" ? (
                  <button type="button" onClick={() => void send()} className="lux-btn lux-btn--ink flex-1">
                    <Send className="size-4" /> {t("Wyślij do agenta")}
                  </button>
                ) : null}
                {phase === "error" && !validatePortalFile(file) ? (
                  <button type="button" onClick={() => void send()} className="lux-btn lux-btn--ink flex-1">
                    <RefreshCw className="size-4" /> {t("Spróbuj ponownie")}
                  </button>
                ) : null}
                {phase === "uploading" ? (
                  <button type="button" onClick={() => abortRef.current?.()} className="lux-btn lux-btn--ghost flex-1">
                    {t("Przerwij wysyłanie")}
                  </button>
                ) : null}
                {phase === "review" || phase === "error" ? (
                  <button type="button" onClick={onPickAnother} className="lux-btn lux-btn--ghost flex-1">
                    <UploadCloud className="size-4" /> {t("Wybierz inny plik")}
                  </button>
                ) : null}
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
