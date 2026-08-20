"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ExternalLink, Link2, Loader2, PlusCircle, Search, Sparkles } from "lucide-react";
import type { OtodomImportDraft } from "@/lib/otodomImport";
import type { OtodomPresentationCopy } from "@/lib/otodomImportRewrite";
import type { ImportDraftIssue } from "@/lib/importDraftValidate";
import { collectOtodomImportDraftIssues } from "@/lib/importDraftValidate";
import { applyImportDraftPatch } from "@/lib/portalImportEnrich";
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
import PortalImportImagePicker, {
  type PortalImportFloorPlanSelection,
} from "@/components/otodom/PortalImportImagePicker";
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

type ImportPatchForm = {
  city: string;
  district: string;
  price: string;
  area: string;
};

type ImportImagePeek = {
  imageCount: number;
  imageUrls: string[];
  suggestedFloorPlanIndex: number | null;
};

function issueNeedsField(issues: ImportDraftIssue[], field: string): boolean {
  return issues.some((issue) => issue.field === field);
}

function importPatchSatisfiesIssues(issues: ImportDraftIssue[], patch: ImportPatchForm): boolean {
  for (const issue of issues) {
    if (issue.field === "city") {
      if (issue.kind === "invalid" && !patch.city.trim()) return false;
      if (!patch.city.trim() && !patch.district.trim()) return false;
      continue;
    }
    if (issue.field === "price") {
      if (!(Number(patch.price) > 0)) return false;
      continue;
    }
    if (issue.field === "area") {
      if (!(Number(patch.area) > 0)) return false;
      continue;
    }
    if (issue.field === "coords") continue;
  }
  return true;
}

export default function OtodomImportProCard() {
  const { locale } = useLocale();
  const copy = getDictionary(locale).crm.proTools;
  const [panelOpen, setPanelOpen] = useState(false);
  const [otodomUrl, setOtodomUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<OtodomImportDraft | null>(null);
  const [presentation, setPresentation] = useState<OtodomPresentationCopy | null>(null);
  const [previewIssues, setPreviewIssues] = useState<ImportDraftIssue[]>([]);
  const [imagePeek, setImagePeek] = useState<ImportImagePeek | null>(null);
  const [importPatch, setImportPatch] = useState<ImportPatchForm>({
    city: "",
    district: "",
    price: "",
    area: "",
  });
  const [selectedImages, setSelectedImages] = useState<Set<number>>(new Set());
  const [floorPlan, setFloorPlan] = useState<PortalImportFloorPlanSelection>({
    enabled: false,
    imageIndex: 0,
  });
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

  const resetPreviewState = () => {
    setPreviewIssues([]);
    setImagePeek(null);
    setImportPatch({ city: "", district: "", price: "", area: "" });
    setSelectedImages(new Set());
    setFloorPlan({ enabled: false, imageIndex: 0 });
  };

  const mergedDraft = useMemo(() => {
    if (!draft) return null;
    return applyImportDraftPatch(draft, {
      city: importPatch.city.trim() || undefined,
      district: importPatch.district.trim() || undefined,
      price: importPatch.price.trim() ? Number(importPatch.price) : undefined,
      area: importPatch.area.trim() ? Number(importPatch.area) : undefined,
    });
  }, [draft, importPatch]);

  const remainingIssues = useMemo(() => {
    if (!mergedDraft) return [];
    return collectOtodomImportDraftIssues(mergedDraft);
  }, [mergedDraft]);

  const canProceedToPayment =
    Boolean(mergedDraft) &&
    selectedImages.size > 0 &&
    (remainingIssues.length === 0 || importPatchSatisfiesIssues(previewIssues, importPatch));

  const selectedImageCount = selectedImages.size;

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
    resetPreviewState();
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
      const nextDraft = (data.draft ?? null) as OtodomImportDraft | null;
      const peek = (data.imagePeek ?? null) as ImportImagePeek | null;
      const issues = Array.isArray(data.issues) ? (data.issues as ImportDraftIssue[]) : [];

      setDraft(nextDraft);
      setPresentation(data.presentation ?? null);
      setPreviewIssues(issues);
      setImagePeek(peek);

      if (nextDraft) {
        const urls = peek?.imageUrls?.length ? peek.imageUrls : nextDraft.imageUrls;
        setSelectedImages(new Set(urls.map((_, index) => index)));
        const suggested = peek?.suggestedFloorPlanIndex;
        setFloorPlan({
          enabled: suggested != null,
          imageIndex: suggested ?? Math.max(urls.length - 1, 0),
        });
        setImportPatch({
          city: nextDraft.city || "",
          district: nextDraft.district || "",
          price: nextDraft.price != null ? String(nextDraft.price) : "",
          area: nextDraft.area != null ? String(nextDraft.area) : "",
        });
      }
    } catch {
      setError("Błąd połączenia z serwerem.");
    } finally {
      setLoading(false);
    }
  };

  const startPaidImport = async () => {
    if (!mergedDraft || !canProceedToPayment) return;
    try {
      await loadWallet();
      setPubOpen(true);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Nie udało się załadować metod płatności.");
    }
  };

  const handleCreate = async () => {
    if (!mergedDraft || !pendingRedemption) return;
    const selectedImageIndices = [...selectedImages].sort((a, b) => a - b);
    const floorPlanImageIndex =
      floorPlan.enabled && selectedImages.has(floorPlan.imageIndex) ? floorPlan.imageIndex : null;

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
          draft: mergedDraft,
          patch: {
            city: importPatch.city.trim() || undefined,
            district: importPatch.district.trim() || undefined,
            price: importPatch.price.trim() ? Number(importPatch.price) : undefined,
            area: importPatch.area.trim() ? Number(importPatch.area) : undefined,
          },
          selectedImageIndices,
          floorPlanImageIndex,
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

          {draft && mergedDraft ? (
            <div className="space-y-4">
              <div className="eos-modal-panel p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">{copy.importPreviewLabel}</p>
                <p className="mt-2 text-sm font-semibold text-[var(--eos-text)]">
                  {presentation?.title ?? mergedDraft.title}
                </p>
                <p className="mt-1 text-xs text-[var(--eos-muted)]">
                  {mergedDraft.city}
                  {mergedDraft.district ? ` · ${mergedDraft.district}` : ""}
                  {mergedDraft.price != null ? ` · ${mergedDraft.price} PLN` : ""}
                  {mergedDraft.area != null ? ` · ${mergedDraft.area} m²` : ""}
                  {" · "}
                  {mergedDraft.propertyType === "PLOT"
                    ? "Działka"
                    : mergedDraft.propertyType === "HOUSE"
                      ? "Dom"
                      : mergedDraft.propertyType === "COMMERCIAL"
                        ? "Lokal użytkowy"
                        : "Mieszkanie"}
                </p>
              </div>

              {(issueNeedsField(previewIssues, "price") || issueNeedsField(previewIssues, "area")) && (
                <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 space-y-3">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                    Uzupełnij brakujące dane zanim opublikujesz ofertę.
                  </p>
                  {issueNeedsField(previewIssues, "price") ? (
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">
                        Cena (PLN)
                      </span>
                      <input
                        type="number"
                        min={1}
                        value={importPatch.price}
                        onChange={(e) => setImportPatch((prev) => ({ ...prev, price: e.target.value }))}
                        className="w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-bg-elevated)] px-3 py-2.5 text-sm"
                      />
                    </label>
                  ) : null}
                  {issueNeedsField(previewIssues, "area") ? (
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">
                        Metraż (m²)
                      </span>
                      <input
                        type="number"
                        min={1}
                        step="0.1"
                        value={importPatch.area}
                        onChange={(e) => setImportPatch((prev) => ({ ...prev, area: e.target.value }))}
                        className="w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-bg-elevated)] px-3 py-2.5 text-sm"
                      />
                    </label>
                  ) : null}
                </div>
              )}

              {presentation ? (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-300">
                    <Sparkles size={12} />
                    {presentation.rewrittenByAi ? "Opis przepisany przez AI" : "Podgląd opisu"}
                  </div>
                  <OfferDescriptionBody
                    description={presentation.descriptionHtml}
                    className="max-h-40 overflow-y-auto text-sm text-[var(--eos-muted)]"
                  />
                </div>
              ) : null}

              <PortalImportImagePicker
                imageUrls={imagePeek?.imageUrls?.length ? imagePeek.imageUrls : mergedDraft.imageUrls}
                selectedIndices={selectedImages}
                suggestedFloorPlanIndex={imagePeek?.suggestedFloorPlanIndex ?? null}
                floorPlan={floorPlan}
                onToggleImage={(index) => {
                  setSelectedImages((prev) => {
                    const next = new Set(prev);
                    if (next.has(index)) {
                      next.delete(index);
                      if (floorPlan.enabled && floorPlan.imageIndex === index) {
                        setFloorPlan((fp) => ({ ...fp, enabled: false }));
                      }
                    } else {
                      next.add(index);
                    }
                    return next;
                  });
                }}
                onSelectFloorPlan={(index) => {
                  setSelectedImages((prev) => new Set(prev).add(index));
                  setFloorPlan({ enabled: true, imageIndex: index });
                }}
                onToggleFloorPlan={(enabled) => {
                  setFloorPlan((prev) => ({
                    enabled,
                    imageIndex: enabled ? prev.imageIndex : prev.imageIndex,
                  }));
                }}
              />

              {mergedDraft.lat != null && mergedDraft.lng != null ? (
                <OtodomImportLocationPreview
                  lat={mergedDraft.lat}
                  lng={mergedDraft.lng}
                  title={mergedDraft.title}
                  street={mergedDraft.street}
                  city={mergedDraft.city}
                  district={mergedDraft.district}
                  previewImageUrl={(imagePeek?.imageUrls?.[0] ?? mergedDraft.imageUrls[0]) || null}
                  showPin
                />
              ) : null}

              {!canProceedToPayment ? (
                <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                  {selectedImages.size === 0
                    ? "Zaznacz co najmniej jedno zdjęcie do importu."
                    : "Uzupełnij wymagane pola powyżej, aby kontynuować."}
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => void startPaidImport()}
                disabled={creating || !canProceedToPayment}
                className="eos-btn eos-btn--home eos-btn--block"
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
        title={presentation?.title ?? mergedDraft?.title ?? draft?.title ?? copy.importSourceOfferFallback}
        imageCount={selectedImageCount}
        confirming={creating}
        variant="pro"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void handleCreate()}
      />
    </>
  );
}
