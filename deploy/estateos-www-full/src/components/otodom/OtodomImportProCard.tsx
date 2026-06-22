"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { ExternalLink, Link2, Loader2, PlusCircle, Search } from "lucide-react";
import type { OtodomImportDraft } from "@/lib/otodomImport";
import type { OtodomPresentationCopy } from "@/lib/otodomImportRewrite";
import { pasteHttpUrlFromClipboard } from "@/lib/clipboardPaste";
import ProToolBadge from "@/components/crm/ProToolBadge";
import { useLocale } from "@/contexts/LocaleContext";
import { getDictionary } from "@/i18n/dictionaries";
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
  const { locale } = useLocale();
  const copy = getDictionary(locale).crm.proTools;
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
    const res = await fetch(`/api/user/publication-wallet?locale=${locale}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      throw new Error(String(data?.error || data?.message || copy.importWalletError));
    }
    const coupons = Array.isArray(data.publicationCoupons)
      ? data.publicationCoupons
      : Array.isArray(data.coupons)
        ? data.coupons
        : [];
    setWalletCoupons(coupons);
    setWalletPlusCredits(Number(data.plusCredits || 0));
    setWalletHasPlusCredit(Boolean(data.hasPlusCredit));
  }, [copy.importWalletError, locale]);

  const handleUrlFocus = () => {
    void pasteHttpUrlFromClipboard(setOtodomUrl, otodomUrl);
  };

  const handleAnalyze = async () => {
    const url = otodomUrl.trim();
    if (!url) {
      setError(copy.importUrlEmpty);
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
      <ProToolBadge
        icon="crown"
        badgeLabel={copy.exclusiveBadge}
        title={copy.importTitle}
        subtitle={copy.importSubtitle}
        onClick={() => setPanelOpen(true)}
      />

      <EosModal
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        title={copy.importModalTitle}
        badge={`Pro · OtoDom + OLX + Nieruchomosci-Online`}
        icon={<Link2 size={18} />}
        maxWidth="max-w-3xl"
      >
        <div className="space-y-5">
          <p className="text-[13px] leading-relaxed text-[var(--eos-muted)]">
            {copy.importModalLead}
          </p>

          <div className="eos-modal-panel p-4">
            <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-[var(--eos-subtle)]">
              {copy.importLinkLabel}
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
                placeholder={copy.importUrlPlaceholder}
                className="flex-1 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-bg-elevated)] px-4 py-3.5 text-sm text-[var(--eos-text)] shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)] outline-none transition-colors focus:border-emerald-500/45 focus:ring-2 focus:ring-emerald-500/15"
              />
              <button
                type="button"
                onClick={() => void handleAnalyze()}
                disabled={loading}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3.5 text-xs font-black uppercase tracking-wider text-black shadow-[0_12px_28px_rgba(16,185,129,0.28)] disabled:opacity-60"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                {copy.importAnalyze}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-[var(--eos-subtle)]">
              {copy.importHint}
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
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">{copy.importPreviewLabel}</p>
                <p className="mt-2 text-sm font-semibold text-[var(--eos-text)]">
                  {presentation?.title ?? draft.title}
                </p>
                      <p className="mt-1 text-xs text-[var(--eos-muted)]">
                        {draft.city}
                        {draft.district ? ` · ${draft.district}` : ""} · {draft.price != null ? `${draft.price} PLN` : ""}
                        {" · "}
                        {draft.propertyType === "PLOT"
                          ? "Działka"
                          : draft.propertyType === "HOUSE"
                            ? "Dom"
                            : draft.propertyType === "COMMERCIAL"
                              ? "Lokal użytkowy"
                              : "Mieszkanie"}
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
                {copy.importPayCreate}
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
                    {copy.importEditLink} <ExternalLink size={12} />
                  </a>
                  <a
                    href={createdLinks.publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-blue-400/30 bg-blue-500/5 px-4 py-2 text-xs font-bold uppercase text-blue-600 dark:text-blue-300"
                  >
                    {copy.importPreviewLink} <ExternalLink size={12} />
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
        title={copy.importPubTitle}
        subtitle={copy.importPubSubtitle}
        coupons={walletCoupons}
        hasPlusCredit={walletHasPlusCredit}
        plusCredits={walletPlusCredits}
        onConfirm={(result) => {
          if (result.action === "cancel") {
            setPubOpen(false);
            return;
          }
          if (result.action === "buy_plus") {
            setCreateError(copy.importBuyPlusHint);
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
        title={presentation?.title ?? draft?.title ?? copy.importSourceOfferFallback}
        imageCount={draft?.imageCount ?? 0}
        confirming={creating}
        variant="pro"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void handleCreate()}
      />
    </>
  );
}
