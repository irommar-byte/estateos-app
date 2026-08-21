"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArchiveX,
  Building2,
  Clock,
  DollarSign,
  Edit2,
  ExternalLink,
  Eye,
  LayoutGrid,
  LayoutList,
  Loader2,
  MapPin,
  Maximize2,
  MessageSquare,
  Plus,
  RefreshCcw,
  Ruler,
  Save,
  BedDouble,
} from "lucide-react";
import OfferFavoriteButton from "@/components/offer/OfferFavoriteButton";
import { resolveOfferPrimaryImage } from "@/lib/offers/primaryImage";
import type { CrmExtendedDictionary } from "@/i18n/crmExtendedDictionary";
import { fmtDict } from "@/i18n/crmExtendedDictionary";

export type OfferBoardView = "list" | "cards" | "large";

type Bid = {
  id: number | string;
  offerId?: number | string;
  dealId?: number | string;
  amount?: number | string;
  financing?: string;
  status?: string;
};

type OfferBoardCopy = CrmExtendedDictionary["offers"] & {
  sale: string;
  rent: string;
  deposit?: string;
  favoritesEmpty?: string;
  favoritesDiscoverMarket?: string;
};

type Props = {
  offers: any[];
  bids: Bid[];
  sectionFilter: "ACTIVE" | "PENDING" | "COMPLETED";
  onSectionFilter: (v: "ACTIVE" | "PENDING" | "COMPLETED") => void;
  sectionCounts: { ACTIVE: number; PENDING: number; COMPLETED: number };
  isListingsTab: boolean;
  isFavoritesTab: boolean;
  isAgencyWorkspace: boolean;
  showAddTile: boolean;
  copy: OfferBoardCopy;
  filterLabels: { active: string; pending: string; completed: string };
  onAdd: () => void;
  onRefresh: (offer: { id: string; title?: string }) => void;
  onArchive: (offer: any) => void;
  onComment: (offer: { id: number; title?: string }) => void;
  onTransfer: (offer: { id: number; title?: string }) => void;
  onBidResponse: (
    e: React.MouseEvent,
    bid: { id: number | string; dealId?: number | string },
    decision: "ACCEPT" | "REJECT",
  ) => void;
  onPriceSaved?: (offerId: number, price: number) => void;
  isOfferAwaitingReview: (offer: any) => boolean;
  classifyOfferSection: (offer: any) => "ACTIVE" | "PENDING" | "COMPLETED";
};

const VIEW_KEY = "eos-crm-offers-view";

function formatPrice(raw: unknown) {
  const n = Number(String(raw ?? "0").replace(/\D/g, "") || 0);
  return n.toLocaleString("pl-PL");
}

function locationLine(offer: any) {
  const parts = [offer.district, offer.city, offer.street].filter(Boolean).map(String);
  return parts.join(" · ") || "Lokalizacja do uzupełnienia";
}

function metaBits(offer: any) {
  const bits: string[] = [];
  if (offer.propertyType) bits.push(String(offer.propertyType));
  if (offer.area) bits.push(`${Number(offer.area)} m²`);
  if (offer.rooms) bits.push(`${offer.rooms} pok.`);
  if (offer.floor != null && String(offer.floor).trim() !== "") bits.push(`p. ${offer.floor}`);
  return bits;
}

export default function CrmMyOffersBoard(props: Props) {
  const {
    offers,
    bids,
    sectionFilter,
    onSectionFilter,
    sectionCounts,
    isListingsTab,
    isFavoritesTab,
    isAgencyWorkspace,
    showAddTile,
    copy: c,
    filterLabels,
    onAdd,
    onRefresh,
    onArchive,
    onComment,
    onTransfer,
    onBidResponse,
    onPriceSaved,
    isOfferAwaitingReview,
    classifyOfferSection,
  } = props;

  const reduceMotion = useReducedMotion();
  const [view, setView] = useState<OfferBoardView>("cards");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [draftPrice, setDraftPrice] = useState<Record<number, string>>({});
  const [saveMsg, setSaveMsg] = useState<Record<number, string>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(VIEW_KEY) as OfferBoardView | null;
      if (raw === "list" || raw === "cards" || raw === "large") setView(raw);
    } catch {
      /* ignore */
    }
  }, []);

  const setViewPersist = useCallback((v: OfferBoardView) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* ignore */
    }
  }, []);

  const items = useMemo(
    () => [...(showAddTile ? [{ id: "ADD_NEW_BTN", isDummy: true }] : []), ...offers],
    [offers, showAddTile],
  );

  const savePrice = async (offer: any) => {
    const id = Number(offer.id);
    const raw = draftPrice[id] ?? String(offer.price ?? "");
    const parsed = Number(String(raw).replace(/\s/g, "").replace(",", ".").replace(/[^\d.]/g, ""));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setSaveMsg((m) => ({ ...m, [id]: "Podaj poprawną cenę" }));
      return;
    }
    setSavingId(id);
    setSaveMsg((m) => ({ ...m, [id]: "" }));
    try {
      const res = await fetch(`/api/offers/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price: parsed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveMsg((m) => ({ ...m, [id]: String(data?.error || "Nie udało się zapisać") }));
        return;
      }
      setSaveMsg((m) => ({ ...m, [id]: "Zapisano" }));
      onPriceSaved?.(id, parsed);
      window.setTimeout(() => setSaveMsg((m) => ({ ...m, [id]: "" })), 2200);
    } catch {
      setSaveMsg((m) => ({ ...m, [id]: "Błąd sieci" }));
    } finally {
      setSavingId(null);
    }
  };

  const gridClass =
    view === "list"
      ? "flex flex-col gap-3"
      : view === "large"
        ? "grid grid-cols-1 gap-5 xl:grid-cols-2"
        : "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3";

  const viewBtns: { id: OfferBoardView; label: string; icon: typeof LayoutList }[] = [
    { id: "list", label: "Lista", icon: LayoutList },
    { id: "cards", label: "Okienka", icon: LayoutGrid },
    { id: "large", label: "Duże", icon: Maximize2 },
  ];

  return (
    <div className="eos-crm-offers-board space-y-5">
      <div className="eos-crm-offers-toolbar flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {isListingsTab ? (
          <div className="eos-crm-offers-filter flex w-full max-w-xl flex-wrap gap-2">
            {(
              [
                ["ACTIVE", filterLabels.active, sectionCounts.ACTIVE],
                ["PENDING", filterLabels.pending, sectionCounts.PENDING],
                ["COMPLETED", filterLabels.completed, sectionCounts.COMPLETED],
              ] as const
            ).map(([key, labelTpl, n]) => {
              const on = sectionFilter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSectionFilter(key)}
                  className={`eos-raised-chip ${on ? "eos-raised-chip--on" : ""} px-4 py-2.5 text-[9px] font-black uppercase tracking-[0.14em] sm:text-[10px]`}
                >
                  {fmtDict(labelTpl, { n })}
                </button>
              );
            })}
          </div>
        ) : (
          <div />
        )}

        <div className="eos-lux-switch eos-crm-offers-views relative inline-flex shrink-0 items-stretch gap-0.5 self-end p-1 lg:self-auto">
          <span className="eos-lux-switch__rim" aria-hidden />
          <span className="eos-lux-switch__well" aria-hidden />
          {viewBtns.map(({ id, label, icon: Icon }) => {
            const on = view === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={on}
                title={label}
                onClick={() => setViewPersist(id)}
                className={`eos-lux-switch__seg relative z-[2] flex items-center gap-1.5 px-3 py-2 text-[9px] font-black uppercase tracking-[0.12em] sm:px-3.5 ${
                  on ? "text-emerald-700" : "text-[var(--eos-muted)]"
                }`}
              >
                {on ? (
                  <span
                    className="eos-lux-switch__pill eos-lux-switch__pill--home pointer-events-none absolute inset-x-0.5 inset-y-[0.18rem] z-[-1]"
                    aria-hidden
                  />
                ) : null}
                <Icon size={14} strokeWidth={2} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {offers.length === 0 ? (
        <div className="eos-lux-panel flex flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-[rgba(196,163,90,0.28)] px-6 py-20 text-center">
          <p className="eos-portal-label mb-6">
            {isFavoritesTab
              ? c.favoritesEmpty
              : sectionFilter === "ACTIVE"
                ? c.emptyActive
                : sectionFilter === "PENDING"
                  ? c.emptyPending
                  : c.emptyCompleted}
          </p>
          {isListingsTab ? (
            <button type="button" onClick={onAdd} className="eos-lux-btn eos-lux-btn--primary">
              <Plus size={16} /> {c.addProperty}
            </button>
          ) : null}
          {isFavoritesTab ? (
            <button
              type="button"
              onClick={() => {
                window.location.href = "/oferty";
              }}
              className="eos-lux-btn eos-lux-btn--platinum"
            >
              {c.favoritesDiscoverMarket}
            </button>
          ) : null}
        </div>
      ) : (
        <div className={gridClass}>
          <AnimatePresence mode="popLayout" initial={false}>
            {items.map((offer: any) => {
              if (offer.isDummy) {
                return (
                  <motion.button
                    key="add-new"
                    type="button"
                    layout={!reduceMotion}
                    initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    whileHover={reduceMotion ? undefined : { y: -2 }}
                    onClick={onAdd}
                    className={`eos-crm-offer-card eos-crm-offer-card--add ${
                      view === "list" ? "eos-crm-offer-card--list-add" : view === "large" ? "min-h-[220px]" : "min-h-[280px]"
                    }`}
                  >
                    <span className="eos-crm-offer-card__add-ring">
                      <Plus size={26} />
                    </span>
                    <span className="eos-portal-label eos-portal-label--ok mt-3">{c.addAnother}</span>
                  </motion.button>
                );
              }

              const now = new Date();
              const expiresAtMs = offer?.expiresAt ? new Date(offer.expiresAt).getTime() : Number.NaN;
              const hasValidExpiry = Number.isFinite(expiresAtMs);
              const createdAt = new Date(offer.createdAt || now);
              const isPending = isOfferAwaitingReview(offer);
              const isArchived = classifyOfferSection(offer) === "COMPLETED";
              const daysLeft = hasValidExpiry
                ? Math.max(0, Math.ceil((expiresAtMs - now.getTime()) / (1000 * 60 * 60 * 24)))
                : null;
              const isNew = now.getTime() - createdAt.getTime() < 1000 * 60 * 60 * 24;
              const offerBids = (bids || []).filter(
                (b) => Number(b.offerId) === Number(offer.id) && String(b.status || "").toUpperCase() === "PENDING",
              );
              const img = resolveOfferPrimaryImage(offer);
              const isRent = offer.transactionType === "rent";
              const id = Number(offer.id);
              const priceDraft = draftPrice[id] ?? formatPrice(offer.price);
              const bits = metaBits(offer);
              const showInlineEdit = isListingsTab && !isArchived && (view === "large" || view === "list");

              const badge = isArchived ? (
                <span className="eos-lux-badge eos-lux-badge--danger">{c.badgeExpired}</span>
              ) : isPending ? (
                <span className="eos-lux-badge eos-lux-badge--warn animate-pulse">{c.badgeInReview}</span>
              ) : isNew ? (
                <span className="eos-lux-badge eos-lux-badge--info">{c.badgeNew}</span>
              ) : (
                <span className="eos-lux-badge eos-lux-badge--ok">{c.badgeActive}</span>
              );

              const txBadge = (
                <span className={`eos-lux-badge ${isRent ? "eos-lux-badge--info" : "eos-lux-badge--ok"}`}>
                  {isRent ? c.rent : c.sale}
                </span>
              );

              const actions = (
                <div className={`eos-crm-offer-card__actions ${view === "list" ? "eos-crm-offer-card__actions--row" : ""}`}>
                  {isArchived ? (
                    <button type="button" onClick={() => onRefresh(offer)} className="eos-lux-btn eos-lux-btn--primary eos-crm-offer-card__renew">
                      <RefreshCcw size={15} /> {c.renewCta}
                    </button>
                  ) : (
                    <div className="eos-crm-offer-card__expiry">
                      <Clock
                        size={14}
                        className={isPending || (daysLeft != null && daysLeft <= 5) ? "text-amber-600" : "text-emerald-600"}
                      />
                      <div>
                        {isPending ? (
                          <>
                            <p className="eos-crm-offer-card__meta-label">{c.pubStatus}</p>
                            <p className="font-black text-amber-700">{c.pubAwaiting}</p>
                          </>
                        ) : hasValidExpiry ? (
                          <>
                            <p className="eos-crm-offer-card__meta-label">
                              {c.pubValidUntil} {new Date(expiresAtMs).toLocaleDateString("pl-PL")}
                            </p>
                            <p className={`font-black ${daysLeft != null && daysLeft <= 5 ? "text-amber-700" : "text-emerald-700"}`}>
                              {c.pubDaysLeft.replace("{n}", String(daysLeft ?? 0))}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="eos-crm-offer-card__meta-label">{c.pubLabel}</p>
                            <p className="font-black text-emerald-700">{c.pubLive}</p>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="eos-crm-offer-card__btn-row">
                    <Link href={`/edytuj-oferte/${offer.id}`} className="eos-raised-chip eos-crm-offer-card__chip" title={c.editHint}>
                      <Edit2 size={13} /> {c.edit}
                    </Link>
                    <button type="button" onClick={() => onArchive(offer)} className="eos-raised-chip eos-raised-chip--no eos-crm-offer-card__chip">
                      <ArchiveX size={13} /> {c.pause}
                    </button>
                    {isListingsTab ? (
                      <button
                        type="button"
                        onClick={() => onComment({ id, title: String(offer.title || "") })}
                        className="eos-raised-chip eos-crm-offer-card__chip"
                      >
                        <MessageSquare size={13} /> Komentarz
                      </button>
                    ) : null}
                    {isListingsTab && !isAgencyWorkspace && sectionFilter === "ACTIVE" && !isArchived ? (
                      <button
                        type="button"
                        onClick={() => onTransfer({ id, title: String(offer.title || "") })}
                        className="eos-raised-chip eos-crm-offer-card__chip"
                      >
                        <Building2 size={13} /> Agencja
                      </button>
                    ) : null}
                  </div>
                </div>
              );

              const bidsBlock =
                offerBids.length > 0 && isListingsTab && !isArchived ? (
                  <div className="eos-crm-offer-card__bids">
                    <p className="eos-portal-label mb-2 flex items-center gap-1.5 text-amber-800">
                      <DollarSign size={12} /> {c.bidsPendingTitle}
                    </p>
                    <div className="space-y-2">
                      {offerBids.map((bid) => (
                        <div key={String(bid.id)} className="eos-crm-offer-card__bid">
                          <div>
                            <p className="text-base font-black text-amber-700">{formatPrice(bid.amount)} PLN</p>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--eos-muted)]">
                              {bid.financing === "CASH" ? c.bidCash : c.bidMortgage}
                            </p>
                          </div>
                          <div className="flex gap-1.5">
                            <button type="button" onClick={(e) => onBidResponse(e, bid, "ACCEPT")} className="eos-raised-chip eos-raised-chip--on text-[9px]">
                              {c.bidAccept}
                            </button>
                            <button type="button" onClick={(e) => onBidResponse(e, bid, "REJECT")} className="eos-raised-chip eos-raised-chip--no text-[9px]">
                              {c.bidReject}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;

              const inlinePrice =
                showInlineEdit ? (
                  <div className="eos-crm-offer-card__inline-edit">
                    <label className="eos-crm-offer-card__meta-label">Cena (PLN){isRent ? " / mies." : ""}</label>
                    <div className="flex items-center gap-2">
                      <input
                        className="eos-field-inset eos-field-inset--pill flex-1 font-black tabular-nums"
                        value={priceDraft}
                        onChange={(e) => setDraftPrice((d) => ({ ...d, [id]: e.target.value }))}
                        inputMode="decimal"
                      />
                      <button
                        type="button"
                        disabled={savingId === id}
                        onClick={() => void savePrice(offer)}
                        className="eos-lux-btn eos-lux-btn--primary !min-h-0 !px-3 !py-2"
                      >
                        {savingId === id ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        Zapisz
                      </button>
                    </div>
                    {saveMsg[id] ? (
                      <p className={`mt-1 text-[10px] font-bold ${saveMsg[id] === "Zapisano" ? "text-emerald-700" : "text-amber-700"}`}>
                        {saveMsg[id]}
                        {saveMsg[id] === "Zapisano" ? ` · ${c.editHint}` : ""}
                      </p>
                    ) : (
                      <p className="mt-1 text-[9px] text-[var(--eos-muted)]">{c.editHint}</p>
                    )}
                  </div>
                ) : null;

              return (
                <motion.article
                  key={offer.id}
                  layout={!reduceMotion}
                  initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                  className={`eos-crm-offer-card ${isArchived ? "eos-crm-offer-card--archived" : ""} eos-crm-offer-card--${view}`}
                >
                  {isFavoritesTab ? (
                    <OfferFavoriteButton
                      offerId={offer.id}
                      variant="icon"
                      size={18}
                      className="absolute right-4 top-4 z-20"
                      onRequireAuth={() => {
                        window.location.href = `/login?redirect=${encodeURIComponent("/moje-konto/crm")}`;
                      }}
                    />
                  ) : null}

                  {view === "list" ? (
                    <div className="eos-crm-offer-card__list">
                      <div className="eos-crm-offer-card__thumb eos-crm-offer-card__thumb--sm">
                        {img ? <img src={img} alt={offer.title || c.thumbAlt} /> : <Building2 size={18} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-1.5">
                          {txBadge}
                          {badge}
                        </div>
                        <Link href={`/oferta/${offer.id}`} className="eos-crm-offer-card__title group inline-flex items-center gap-1">
                          <span className="truncate">{offer.title}</span>
                          <ExternalLink size={12} className="opacity-0 transition group-hover:opacity-100" />
                        </Link>
                        <p className="eos-crm-offer-card__loc">
                          <MapPin size={11} /> {locationLine(offer)}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-2 text-[10px] font-bold text-[var(--eos-muted)]">
                          {bits.map((b) => (
                            <span key={b} className="eos-raised-chip !cursor-default !px-2 !py-0.5 text-[9px]">
                              {b}
                            </span>
                          ))}
                          <span className="inline-flex items-center gap-1">
                            <Eye size={11} /> {offer.views || 0}
                          </span>
                        </div>
                        {!showInlineEdit ? (
                          <p className={`mt-1.5 text-sm font-black tabular-nums ${isRent ? "text-sky-700" : "text-emerald-700"}`}>
                            {formatPrice(offer.price)} PLN{isRent ? " / mies." : ""}
                          </p>
                        ) : null}
                        {inlinePrice}
                      </div>
                      <div className="eos-crm-offer-card__list-side">{actions}</div>
                    </div>
                  ) : null}

                  {view === "cards" ? (
                    <>
                      <div className="eos-crm-offer-card__hero">
                        <div className="eos-crm-offer-card__thumb">
                          {img ? <img src={img} alt={offer.title || c.thumbAlt} /> : <Building2 size={22} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-1.5 flex flex-wrap gap-1.5">
                            {txBadge}
                            {badge}
                          </div>
                          <Link href={`/oferta/${offer.id}`} className="eos-crm-offer-card__title line-clamp-2">
                            {offer.title}
                          </Link>
                          <p className={`mt-1 text-lg font-black tabular-nums tracking-tight ${isRent ? "text-sky-700" : "text-emerald-700"}`}>
                            {formatPrice(offer.price)} <span className="text-xs font-bold text-[var(--eos-muted)]">PLN{isRent ? "/mies." : ""}</span>
                          </p>
                        </div>
                      </div>
                      <p className="eos-crm-offer-card__loc">
                        <MapPin size={12} /> {locationLine(offer)}
                      </p>
                      <div className="eos-crm-offer-card__stats">
                        <div>
                          <Eye size={13} />
                          <span>{offer.views || 0}</span>
                          <small>{c.reach}</small>
                        </div>
                        {offer.area ? (
                          <div>
                            <Ruler size={13} />
                            <span>{Number(offer.area)}</span>
                            <small>m²</small>
                          </div>
                        ) : null}
                        {offer.rooms ? (
                          <div>
                            <BedDouble size={13} />
                            <span>{offer.rooms}</span>
                            <small>pok.</small>
                          </div>
                        ) : null}
                      </div>
                      {bidsBlock}
                      {actions}
                    </>
                  ) : null}

                  {view === "large" ? (
                    <>
                      <div className="eos-crm-offer-card__large-top">
                        <div className="eos-crm-offer-card__thumb eos-crm-offer-card__thumb--lg">
                          {img ? <img src={img} alt={offer.title || c.thumbAlt} /> : <Building2 size={28} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap gap-1.5">
                            {txBadge}
                            {badge}
                          </div>
                          <Link href={`/oferta/${offer.id}`} className="eos-crm-offer-card__title text-lg sm:text-xl">
                            {offer.title}
                          </Link>
                          <p className="eos-crm-offer-card__loc mt-1.5">
                            <MapPin size={13} /> {locationLine(offer)}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {bits.map((b) => (
                              <span key={b} className="eos-raised-chip !cursor-default !px-2.5 !py-1 text-[9px]">
                                {b}
                              </span>
                            ))}
                          </div>
                          <div className="eos-crm-offer-card__stats eos-crm-offer-card__stats--large mt-3">
                            <div>
                              <Eye size={14} />
                              <span>{offer.views || 0}</span>
                              <small>{c.reach}</small>
                            </div>
                            {offer.area ? (
                              <div>
                                <Ruler size={14} />
                                <span>{Number(offer.area)} m²</span>
                                <small>Metraż</small>
                              </div>
                            ) : null}
                            {offer.rooms ? (
                              <div>
                                <BedDouble size={14} />
                                <span>{offer.rooms}</span>
                                <small>Pokoje</small>
                              </div>
                            ) : null}
                            {offer.deposit && isRent ? (
                              <div>
                                <DollarSign size={14} />
                                <span>{formatPrice(offer.deposit)}</span>
                                <small>Kaucja</small>
                              </div>
                            ) : null}
                          </div>
                          {inlinePrice}
                          {isRent && !isArchived ? (
                            <div className="mt-2 space-y-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--eos-muted)]">
                              {offer.rentAdminFee ? <p>Czynsz adm: {formatPrice(offer.rentAdminFee)} PLN</p> : null}
                              {offer.petsAllowed ? <p className="text-emerald-700">{c.petsAllowed}</p> : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      {bidsBlock}
                      {actions}
                    </>
                  ) : null}
                </motion.article>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
