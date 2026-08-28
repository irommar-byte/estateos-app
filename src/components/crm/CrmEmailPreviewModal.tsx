"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Mail } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";

type PreviewData = {
  subject: string;
  html: string;
  intro: string;
  agentName: string;
  agencyName: string;
  clientName: string;
  clientEmail: string | null;
  offers: Array<{ id: number; title: string }>;
};

type Props = {
  open: boolean;
  loading?: boolean;
  preview: PreviewData | null;
  onClose: () => void;
  onConfirm: (message: string) => void;
  confirming?: boolean;
};

export default function CrmEmailPreviewModal({
  open,
  loading,
  preview,
  onClose,
  onConfirm,
  confirming,
}: Props) {
  const { dict } = useLocale();
  const cl = dict.crmClients;
  const [message, setMessage] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open && preview) setMessage(preview.intro);
  }, [open, preview]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 eos-z-share-banner flex items-end justify-center bg-black/70 p-4 backdrop-blur-md sm:items-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 32, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="eos-themed-modal max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-6 shadow-2xl sm:p-8"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-500">
                  {cl.emailPreviewEyebrow}
                </p>
                <h2 className="mt-1 text-xl font-bold text-[var(--eos-text)]">{cl.emailPreviewTitle}</h2>
                {preview?.clientEmail ? (
                  <p className="mt-1 text-sm text-[var(--eos-muted)]">
                    {cl.emailPreviewTo}: {preview.clientEmail}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-amber-600">{cl.emailPreviewNoEmail}</p>
                )}
              </div>
              <button type="button" onClick={onClose} className="rounded-full p-2 text-[var(--eos-muted)] hover:bg-[var(--eos-input)]">
                <X className="size-5" />
              </button>
            </div>

            {loading ? (
              <p className="py-12 text-center text-sm text-[var(--eos-muted)]">{cl.loading}</p>
            ) : preview ? (
              <div className="space-y-5">
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--eos-muted)]">
                    {cl.emailPreviewGreeting}
                  </span>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    className="mt-2 w-full rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-3 text-sm leading-relaxed text-[var(--eos-text)]"
                  />
                </label>

                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--eos-muted)]">
                    {cl.emailPreviewOffers} ({preview.offers.length})
                  </p>
                  <ul className="space-y-2">
                    {preview.offers.map((o) => (
                      <li
                        key={o.id}
                        className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)]/50 px-4 py-3 text-sm font-medium text-[var(--eos-text)]"
                      >
                        {o.title}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--eos-muted)]">
                    {cl.emailPreviewHtml}
                  </p>
                  <div
                    className="overflow-hidden rounded-2xl border border-[var(--eos-border)] bg-white"
                    dangerouslySetInnerHTML={{
                      __html: preview.html.replace(preview.intro, message || preview.intro),
                    }}
                  />
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-full border border-[var(--eos-border)] px-5 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-[var(--eos-text)]"
                  >
                    {cl.back}
                  </button>
                  <button
                    type="button"
                    disabled={confirming || !preview.clientEmail}
                    onClick={() => onConfirm(message)}
                    className="ml-auto inline-flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-black disabled:opacity-50"
                  >
                    {confirming ? (
                      <Mail className="size-4 animate-pulse" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    {confirming ? cl.sendingEmail : cl.confirmSendEmail}
                  </button>
                </div>
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
