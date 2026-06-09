"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink, Loader2, Search, X } from "lucide-react";
import Link from "next/link";
import type { CrmExtendedDictionary } from "@/i18n/crmExtendedDictionary";
import type { OtodomImportDraft } from "@/lib/otodomImport";
import type { OtodomPresentationCopy } from "@/lib/otodomImportRewrite";

type Props = {
  isOpen: boolean;
  copy: CrmExtendedDictionary["proTools"];
  onClose: () => void;
  onCreated?: () => void;
};

export default function ProPortalImportModal({ isOpen, copy, onClose, onCreated }: Props) {
  const [mounted, setMounted] = useState(false);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<OtodomImportDraft | null>(null);
  const [presentation, setPresentation] = useState<OtodomPresentationCopy | null>(null);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [successLinks, setSuccessLinks] = useState<{ editUrl: string; publicUrl: string } | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen) {
      setUrl("");
      setError("");
      setDraft(null);
      setPresentation(null);
      setSuccessLinks(null);
      setRightsConfirmed(false);
    }
  }, [isOpen]);

  const analyze = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true);
    setError("");
    setDraft(null);
    setPresentation(null);
    setSuccessLinks(null);
    try {
      const res = await fetch("/api/pro/otodom-import", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json();
      if (!res.ok || !data?.draft) {
        setError(data?.message || "Import nie powiódł się.");
        return;
      }
      setDraft(data.draft);
      setPresentation(data.presentation ?? null);
    } catch {
      setError("Błąd połączenia.");
    } finally {
      setLoading(false);
    }
  };

  const createOffer = async () => {
    if (!draft || !rightsConfirmed) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/pro/otodom-import/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft,
          rightsConfirmed: true,
          redemption: { source: "plus_credit" },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.code === "NO_PLUS_CREDIT" || data?.code === "PUBLICATION_REQUIRED") {
          setError(copy.importNoCredit);
        } else {
          setError(data?.message || "Nie udało się utworzyć oferty.");
        }
        return;
      }
      setSuccessLinks({
        editUrl: data.editUrl || `/edytuj-oferte/${data.offerId}`,
        publicUrl: data.publicUrl || `/oferta/${data.offerId}`,
      });
      onCreated?.();
    } catch {
      setError("Błąd połączenia.");
    } finally {
      setCreating(false);
    }
  };

  if (!mounted) return null;

  const modal = (
    <AnimatePresence>
      {isOpen ? (
        <div className="fixed inset-0 z-[999998] flex items-start justify-center overflow-y-auto p-4 pb-10 pt-10 sm:pt-16">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/85 backdrop-blur-md"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            onClick={(e) => e.stopPropagation()}
            className="relative my-auto w-full max-w-lg overflow-hidden rounded-[2rem] border border-white/10 bg-[#0a0a0a] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/5 px-6 py-5">
              <h3 className="text-lg font-black text-white">{copy.importModalTitle}</h3>
              <button type="button" onClick={onClose} className="rounded-full bg-white/5 p-2 text-white/50">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 p-6">
              {successLinks ? (
                <div className="py-6 text-center">
                  <p className="text-lg font-bold text-emerald-400">{copy.importSuccess}</p>
                  <div className="mt-6 flex flex-col gap-3">
                    <Link
                      href={successLinks.editUrl}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3 text-xs font-black uppercase tracking-widest text-black"
                    >
                      Edytuj ofertę <ExternalLink size={14} />
                    </Link>
                    <Link
                      href={successLinks.publicUrl}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 py-3 text-xs font-black uppercase tracking-widest text-white/70"
                    >
                      Podgląd <ExternalLink size={14} />
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && void analyze()}
                      placeholder={copy.importUrlPlaceholder}
                      className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/40"
                    />
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => void analyze()}
                      className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-xs font-black uppercase tracking-wider text-black disabled:opacity-50"
                    >
                      {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                      {copy.importAnalyze}
                    </button>
                  </div>

                  {error ? <p className="text-sm text-red-400">{error}</p> : null}

                  {draft ? (
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm">
                      <p className="font-semibold text-white">{presentation?.title ?? draft.title}</p>
                      <p className="mt-2 text-white/45">
                        {draft.city} · {draft.district} · {draft.price ? `${draft.price} PLN` : "—"} ·{" "}
                        {draft.area ? `${draft.area} m²` : "—"}
                      </p>
                      <label className="mt-4 flex items-start gap-3 rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white/60">
                        <input
                          type="checkbox"
                          checked={rightsConfirmed}
                          onChange={(e) => setRightsConfirmed(e.target.checked)}
                          className="mt-0.5"
                        />
                        <span>
                          Potwierdzam, że mam prawo publikować te dane i zdjęcia oraz akceptuję zużycie kredytu
                          Pakietu Plus.
                        </span>
                      </label>
                      <button
                        type="button"
                        disabled={!rightsConfirmed || creating}
                        onClick={() => void createOffer()}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3 text-xs font-black uppercase tracking-widest text-black disabled:opacity-50"
                      >
                        {creating ? <Loader2 size={16} className="animate-spin" /> : null}
                        {copy.importCreate}
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );

  return createPortal(modal, document.body);
}
