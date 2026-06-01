"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import {
  Crown,
  ExternalLink,
  Link2,
  Loader2,
  PlusCircle,
  Search,
  Sparkles,
} from "lucide-react";
import type { OtodomImportDraft } from "@/lib/otodomImport";
import type { OtodomPresentationCopy } from "@/lib/otodomImportRewrite";
import { pasteHttpUrlFromClipboard } from "@/lib/clipboardPaste";
import PublicationChoiceModal, {
  type PublicationCouponOption,
  type PublicationRedemption,
} from "@/components/publication/PublicationChoiceModal";
import OtodomCreateConfirmModal from "@/components/admin/OtodomCreateConfirmModal";
import OfferDescriptionBody from "@/components/offer/OfferDescriptionBody";
import EosModal from "@/components/ui/EosModal";

const OtodomImportLocationPreview = dynamic(
  () => import("@/components/admin/OtodomImportLocationPreview"),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] min-h-[240px] flex items-center justify-center">
        <Loader2 className="animate-spin text-emerald-500" size={24} />
      </div>
    ),
  },
);

export default function OtodomImportProCard() {
  const [panelOpen, setPanelOpen] = useState(false);
  const [otodomUrl, setOtodomUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<OtodomImportDraft | null>(null);
  const [presentation, setPresentation] = useState<OtodomPresentationCopy | null>(null);
  const [creating, setCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState("");
  const [createError, setCreateError] = useState("");
  const [createdLinks, setCreatedLinks] = useState<{
    offerId: number;
    editUrl: string;
    publicUrl: string;
  } | null>(null);
  const [pubOpen, setPubOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingRedemption, setPendingRedemption] = useState<PublicationRedemption | null>(null);
  const [walletCoupons, setWalletCoupons] = useState<PublicationCouponOption[]>([]);
  const [walletPlusCredits, setWalletPlusCredits] = useState(0);
  const [walletHasPlusCredit, setWalletHasPlusCredit] = useState(false);

  const resetCreateState = () => {
    setCreateMessage("");
    setCreateError("");
    setCreatedLinks(null);
    setPendingRedemption(null);
  };

  const loadWallet = useCallback(async () => {
    const res = await fetch("/api/user/publication-wallet?locale=pl", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      throw new Error(String(data?.error || data?.message || "Nie udało się pobrać portfela publikacji."));
    }
    const coupons = Array.isArray(data.publicationCoupons) ? data.publicationCoupons : [];
    setWalletCoupons(coupons);
    setWalletPlusCredits(Number(data.plusCredits || 0));
    setWalletHasPlusCredit(Boolean(data.hasPlusCredit));
  }, []);

  const handleUrlFocus = () => {
    void pasteHttpUrlFromClipboard(setOtodomUrl, otodomUrl);
  };

  const handleAnalyze = async () => {
    const url = otodomUrl.trim();
    if (!url) {
      setError("Wklej link do oferty OtoDom.");
      return;
    }
    setLoading(true);
    setError("");
    setDraft(null);
    setPresentation(null);
    resetCreateState();
    try {
      const res = await fetch("/api/otodom-import", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || `Błąd importu (${res.status}).`);
        return;
      }
      setDraft(data.draft ?? null);
      setPresentation(data.presentation ?? null);
    } catch {
      setError("Błąd połączenia z serwerem.");
    } finally {
      setLoading(false);
    }
  };

  const startPaidImport = async () => {
    if (!draft) return;
    try {
      await loadWallet();
      setPubOpen(true);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Nie udało się załadować metod płatności.");
    }
  };

  const handleCreate = async () => {
    if (!draft || !pendingRedemption) return;
    setCreating(true);
    setCreateError("");
    setCreateMessage("");
    setCreatedLinks(null);
    try {
      const res = await fetch("/api/otodom-import/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft,
          rightsConfirmed: true,
          publication: pendingRedemption,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.code === "ALREADY_IMPORTED" && data?.existingOfferId) {
          setCreatedLinks({
            offerId: Number(data.existingOfferId),
            editUrl: String(data.editUrl || `/edytuj-oferte/${data.existingOfferId}`),
            publicUrl: String(data.publicUrl || `/oferta/${data.existingOfferId}`),
          });
        }
        setCreateError(data?.error || `Nie udało się utworzyć oferty (${res.status}).`);
        return;
      }
      setCreateMessage(
        String(
          data?.message ||
            "Oferta została utworzona i opłacona — trafi do weryfikacji, a po akceptacji od razu na rynek.",
        ),
      );
      setCreatedLinks({
        offerId: Number(data.offerId),
        editUrl: String(data.editUrl || `/edytuj-oferte/${data.offerId}`),
        publicUrl: String(data.publicUrl || `/oferta/${data.offerId}`),
      });
    } catch {
      setCreateError("Błąd połączenia podczas tworzenia oferty.");
    } finally {
      setCreating(false);
      setConfirmOpen(false);
    }
  };

  return (
    <>
      <motion.button
        type="button"
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => setPanelOpen(true)}
        className="group relative w-full overflow-hidden rounded-2xl border border-[#D4AF37]/35 bg-gradient-to-br from-[#1a1508] via-[#0a0a0a] to-[#050505] p-5 text-left shadow-[0_20px_50px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(212,175,55,0.15)]"
      >
        <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[#D4AF37]/10 blur-2xl" />
        <div className="relative flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37] shadow-[0_0_24px_rgba(212,175,55,0.2)]">
            <Crown size={22} strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black uppercase tracking-[0.28em] text-[#D4AF37]/90">
              Ekskluzywne narzędzie Pro
            </p>
            <h3 className="mt-1 text-sm font-black uppercase tracking-[0.12em] text-white/95">
              Import z OtoDom
            </h3>
            <p className="mt-2 text-[11px] leading-relaxed text-white/45">
              Przenieś ogłoszenie na EstateOS — z opłatą publikacji jak przy zwykłym wystawieniu.
            </p>
          </div>
          <Sparkles size={16} className="shrink-0 text-emerald-500/80 opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
      </motion.button>

      <EosModal
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        title="Import ogłoszenia"
        badge="Pro · OtoDom"
        icon={<Link2 size={18} />}
        maxWidth="max-w-3xl"
      >
        <div className="space-y-5">
          <p className="text-[13px] leading-relaxed text-[var(--eos-muted)]">
            Wklej link do ogłoszenia — kliknij w pole, a adres ze schowka wklei się automatycznie. Przed konwersją
            wybierzesz kupon lub kredyt Plus. Po opłaceniu oferta trafi do weryfikacji z zarezerwowaną publikacją.
          </p>

          <div className="eos-modal-panel p-4">
            <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-[var(--eos-subtle)]">
              Link OtoDom
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="url"
                value={otodomUrl}
                onChange={(e) => setOtodomUrl(e.target.value)}
                onFocus={handleUrlFocus}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleAnalyze();
                }}
                placeholder="https://www.otodom.pl/pl/oferta/..."
                className="flex-1 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-bg-elevated)] px-4 py-3.5 text-sm text-[var(--eos-text)] shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)] outline-none transition-colors focus:border-emerald-500/45 focus:ring-2 focus:ring-emerald-500/15"
              />
              <button
                type="button"
                onClick={() => void handleAnalyze()}
                disabled={loading}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3.5 text-xs font-black uppercase tracking-wider text-black shadow-[0_12px_28px_rgba(16,185,129,0.28)] disabled:opacity-60"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                Analizuj
              </button>
            </div>
            <p className="mt-2 text-[11px] text-[var(--eos-subtle)]">
              Wskazówka: skopiuj link w OtoDom, kliknij pole powyżej — wklei się sam.
            </p>
          </div>

          {error ? (
            <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-500">
              {error}
            </p>
          ) : null}

          {draft ? (
            <div className="space-y-4">
              <div className="eos-modal-panel p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">Podgląd</p>
                <p className="mt-2 text-sm font-semibold text-[var(--eos-text)]">
                  {presentation?.title ?? draft.title}
                </p>
                <p className="mt-1 text-xs text-[var(--eos-muted)]">
                  {draft.city}
                  {draft.district ? ` · ${draft.district}` : ""} · {draft.price != null ? `${draft.price} PLN` : ""}
                </p>
              </div>

              {presentation ? (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <OfferDescriptionBody
                    description={presentation.descriptionHtml}
                    className="max-h-40 overflow-y-auto text-sm text-[var(--eos-muted)]"
                  />
                </div>
              ) : null}

              {draft.lat != null && draft.lng != null ? (
                <OtodomImportLocationPreview
                  lat={draft.lat}
                  lng={draft.lng}
                  title={draft.title}
                  street={draft.street}
                  city={draft.city}
                  district={draft.district}
                  previewImageUrl={draft.imageUrls[0] ?? null}
                  showPin
                />
              ) : null}

              <button
                type="button"
                onClick={() => void startPaidImport()}
                disabled={creating}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/10 py-4 text-xs font-black uppercase tracking-wider text-emerald-600 shadow-[0_12px_32px_rgba(16,185,129,0.12)] transition-colors hover:bg-emerald-500/15 disabled:opacity-60 dark:text-emerald-400"
              >
                <PlusCircle size={16} />
                Opłać i utwórz na EstateOS
              </button>

              {createMessage ? (
                <p className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-300">
                  {createMessage}
                </p>
              ) : null}
              {createError ? (
                <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-500">
                  {createError}
                </p>
              ) : null}
              {createdLinks ? (
                <div className="flex flex-wrap gap-2">
                  <a
                    href={createdLinks.editUrl}
                    className="inline-flex items-center gap-2 rounded-xl border border-[var(--eos-border)] bg-[var(--eos-card)] px-4 py-2 text-xs font-bold uppercase text-[var(--eos-text)]"
                  >
                    Edytuj <ExternalLink size={12} />
                  </a>
                  <a
                    href={createdLinks.publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-blue-400/30 bg-blue-500/5 px-4 py-2 text-xs font-bold uppercase text-blue-600 dark:text-blue-300"
                  >
                    Podgląd <ExternalLink size={12} />
                  </a>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </EosModal>

      <PublicationChoiceModal
        isOpen={pubOpen}
        onClose={() => setPubOpen(false)}
        title="Opłata za publikację importu"
        subtitle="Import z OtoDom zużywa ten sam kredyt lub kupon co zwykłe wystawienie oferty na 30 dni. Po opłaceniu oferta trafi do weryfikacji z zarezerwowaną publikacją."
        coupons={walletCoupons}
        hasPlusCredit={walletHasPlusCredit}
        plusCredits={walletPlusCredits}
        onConfirm={(result) => {
          if (result.action === "cancel") {
            setPubOpen(false);
            return;
          }
          if (result.action === "buy_plus") {
            setCreateError("Kup Pakiet Plus w portfelu publikacji, a następnie ponów import.");
            setPubOpen(false);
            return;
          }
          setPendingRedemption(result.redemption);
          setPubOpen(false);
          setConfirmOpen(true);
        }}
      />

      <OtodomCreateConfirmModal
        open={confirmOpen}
        title={presentation?.title ?? draft?.title ?? "Oferta OtoDom"}
        imageCount={draft?.imageCount ?? 0}
        confirming={creating}
        variant="pro"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void handleCreate()}
      />
    </>
  );
}
