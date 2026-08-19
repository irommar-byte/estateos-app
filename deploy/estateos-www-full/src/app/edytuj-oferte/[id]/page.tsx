"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Home, MapPin, Loader2, Save, ArrowLeft, Image as ImageIcon, Trash2, Building2, Layers,
  CheckCircle, BedDouble, Calendar, Box, Sparkles, Map, LayoutGrid, Flame, DoorOpen, Castle, Briefcase,
} from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import AgentCommissionEditor from '@/components/offer/AgentCommissionEditor';
import PriceReductionPreview from '@/components/offer/PriceReductionPreview';
import { isAgentCommissionAccount } from '@/lib/agentCommission';
import { useLocale } from '@/contexts/LocaleContext';
import { useFxRate } from '@/contexts/FxRateContext';
import { buildYearBuiltSelectOptions } from '@/lib/offerYearBuilt';
import { convertBetweenCurrencies } from '@/lib/money/convert';
import type { ListingCurrency } from '@/lib/money/types';
import {
  amenityBooleanPatch,
  buildAmenityOptions,
  readAmenitySelectionFromOffer,
  type OfferAmenityId,
} from '@/lib/offerAmenities';
import { resolveStreetFieldsForForm, streetFieldsForOfferStorage } from '@/lib/offerStreetFields';
import { descriptionForEditForm, descriptionForStorageFromEdit } from '@/lib/offerDescriptionHtml';
import { parseFloorPlanExtraUrls, serializeFloorPlanExtraUrls } from '@/lib/offerFloorPlanUrls';
import AddOfferDocVerificationPanel from '@/components/offer/AddOfferDocVerificationPanel';
import { HEATING_DICT_KEYS } from '@/i18n/addOfferDictionary';
import { isValidLandRegistryNumber, normalizeLandRegistryInput } from '@/lib/landRegistryInput';
import dynamic from 'next/dynamic';

const NeighborhoodMapPreview = dynamic(
  () => import('@/components/map/NeighborhoodMapPreview'),
  { ssr: false },
);

// --- LUKSUSOWE STYLE ---
const inputWrapper = "relative group flex items-center";
const inputPremium =
  "w-full rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] py-4 pl-14 pr-5 text-base text-[var(--eos-text)] outline-none transition-all duration-500 placeholder:text-[var(--eos-subtle)] focus:border-[var(--eos-accent)]/50 md:text-lg";
const labelPremium =
  "eos-label mb-3 ml-1 block min-w-0 w-full text-[10px] font-black uppercase tracking-[0.08em] leading-snug text-[var(--eos-muted)]";
const glassPanel =
  "eos-surface-card relative overflow-x-clip overflow-y-visible rounded-[2.5rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-6 shadow-[var(--eos-shadow-soft)] backdrop-blur-3xl transition-all duration-500 md:p-10";
const iconGlow =
  "absolute left-4 text-[var(--eos-muted)] transition-all duration-500 group-focus-within:text-[var(--eos-accent)]";

// --- FORMATOWANIE LICZB ---
const formatNum = (val: string) => val.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/** Zgodne z limitem w `/api/upload`. */
const OFFER_MAX_IMAGES = 20;

function isPolishLocality(countryCode: unknown) {
  return String(countryCode || 'PL').trim().toUpperCase() === 'PL';
}

function conditionForForm(raw: unknown): string {
  const n = String(raw || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (n === 'NEEDS_RENOVATION' || n === 'TO_RENOVATION' || n === 'RENOVATION') return 'RENOVATION';
  if (n === 'DEVELOPER_STATE' || n === 'DEVELOPER') return 'DEVELOPER';
  if (n === 'NOT_APPLICABLE') return 'NOT_APPLICABLE';
  return n || 'READY';
}

function legalStatusFromOffer(offer: { legalCheckStatus?: unknown; isLegalSafeVerified?: unknown }): 'NONE' | 'PENDING' | 'REJECTED' | 'VERIFIED' {
  const raw = String(offer.legalCheckStatus || '').trim().toUpperCase();
  if (raw === 'VERIFIED' || raw === 'APPROVED' || offer.isLegalSafeVerified) return 'VERIFIED';
  if (raw === 'PENDING') return 'PENDING';
  if (raw === 'REJECTED') return 'REJECTED';
  return 'NONE';
}

// --- KOMPONENT DRAG & DROP ZDJĘĆ ---
const SortablePhoto = ({
  url,
  onRemove,
  onMarkAsPlan,
  isMain,
}: {
  url: string;
  onRemove: (url: string) => void;
  onMarkAsPlan?: (url: string) => void;
  isMain: boolean;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: url });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`relative w-28 h-28 md:w-36 md:h-36 rounded-2xl overflow-hidden border-2 group transition-all ${isMain ? 'border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.4)]' : 'border-[#222] bg-[#0a0a0a] hover:border-emerald-500/50'}`}>
      <img src={url} className={`w-full h-full object-cover saturate-[1.2] transition-all duration-700 ${isMain ? 'opacity-100 scale-110' : 'opacity-60 group-hover:opacity-100 group-hover:scale-105'}`} alt="Foto" />
      <div
        {...attributes}
        {...listeners}
        className="absolute inset-0 z-10 flex cursor-grab items-center justify-center bg-black/45 opacity-100 backdrop-blur-[2px] transition-opacity active:cursor-grabbing sm:bg-transparent sm:opacity-0 sm:group-hover:bg-black/60 sm:group-hover:opacity-100 sm:group-hover:backdrop-blur-sm"
      >
        <div className="flex items-center gap-1 rounded-full border border-white/15 bg-black/65 px-3 py-2 shadow-xl backdrop-blur-md">
          <span className="h-1.5 w-1.5 rounded-full bg-white/85" />
          <span className="h-1.5 w-1.5 rounded-full bg-white/85" />
          <span className="h-1.5 w-1.5 rounded-full bg-white/85" />
        </div>
      </div>
      <button onClick={() => onRemove(url)} className="absolute top-2 right-2 p-2 bg-black/80 border border-white/10 hover:bg-red-500 hover:border-red-400 rounded-full text-white/80 hover:text-white z-20 transition-all shadow-xl"><Trash2 size={14} /></button>
      {onMarkAsPlan ? (
        <button
          type="button"
          onClick={() => onMarkAsPlan(url)}
          className="absolute left-2 top-2 z-20 rounded-full border border-cyan-400/40 bg-black/80 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-cyan-200 hover:bg-cyan-500 hover:text-black"
        >
          Plan
        </button>
      ) : null}
      {isMain && <div className="absolute bottom-0 left-0 w-full bg-emerald-500 text-black text-[10px] uppercase tracking-[0.2em] font-black text-center py-1.5 z-20 shadow-[0_-10px_20px_rgba(16,185,129,0.5)]">Główne</div>}
    </div>
  );
};

export default function UltraPremiumEditForm({ params }: { params: Promise<{ id: string }> }) {
  const { dict } = useLocale();
  const ao = dict.addOffer;
  const eo = dict.editOffer;
  const { rate: fxRate } = useFxRate();
  const amenityOptions = React.useMemo(() => buildAmenityOptions(ao), [ao]);
  const CONDITION_TYPES = useMemo(
    () => [
      { id: 'READY', label: ao.conditionReady },
      { id: 'RENOVATION', label: ao.conditionRenovation },
      { id: 'DEVELOPER', label: ao.conditionDeveloper },
    ],
    [ao],
  );
  const HEATING_TYPES = useMemo(() => HEATING_DICT_KEYS.map((key) => ao[key]), [ao]);
  const PROPERTY_TYPES = useMemo(
    () => [
      { id: 'FLAT', label: ao.propertyFlat, icon: Building2 },
      { id: 'HOUSE', label: ao.propertyHouse, icon: Castle },
      { id: 'PLOT', label: ao.propertyPlot, icon: Map },
      { id: 'COMMERCIAL', label: ao.propertyCommercial, icon: Briefcase },
    ],
    [ao],
  );
  const landRegistryInputRef = useRef<HTMLInputElement | null>(null);
  const kwSectionRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const crmReturnHref = React.useMemo(() => {
    const ret = searchParams.get('return');
    if (ret && ret.startsWith('/moje-konto/crm')) return ret;
    return '/moje-konto/crm?tab=my_offers';
  }, [searchParams]);
  const goBackFromEdit = () => router.push(crmReturnHref);
  const [offerId, setOfferId] = useState<string | null>(null);
  const [data, setData] = useState<any>({});
  const [selectedAmenities, setSelectedAmenities] = useState<OfferAmenityId[]>([]);
  const [imagesList, setImagesList] = useState<string[]>([]);
  const [floorPlanUrl, setFloorPlanUrl] = useState<string | null>(null);
  const [floorPlanExtraUrls, setFloorPlanExtraUrls] = useState<string[]>([]);
  const [floorPlanUploading, setFloorPlanUploading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [viewerRole, setViewerRole] = useState<string | null>(null);
  const [agentCommissionPercent, setAgentCommissionPercent] = useState('');

  const updateData = (newData: any) => setData((prev: any) => ({ ...prev, ...newData }));

  useEffect(() => { params.then(p => setOfferId(p.id)); }, [params]);

  useEffect(() => {
    if (!offerId) return;
    const init = async () => {
      try {
        const [authRes, offerRes] = await Promise.all([fetch('/api/auth/check'), fetch(`/api/offers/${offerId}`)]);
        const auth = await authRes.json();
        const offer = await offerRes.json();

        if (!auth.loggedIn || offer.error) { setAuthError(eo.noAccess); setIsLoading(false); return; }
        setViewerRole(auth.user?.role ?? null);
        const isOwner = offer.user?.email === auth.user?.email;
        const isAdmin = auth.user?.role === 'ADMIN';
        if (!isOwner && !isAdmin) { setAuthError(eo.noPermission); setIsLoading(false); return; }

        const parsedImages = (() => {
          const raw = offer.images;
          if (!raw) return [] as string[];
          if (Array.isArray(raw)) return raw.filter(Boolean);
          const txt = String(raw).trim();
          if (!txt) return [];
          try {
            const decoded = JSON.parse(txt);
            if (Array.isArray(decoded)) return decoded.filter(Boolean);
          } catch {
            // fallback csv
          }
          return txt.split(',').map((v: string) => String(v || '').trim()).filter(Boolean);
        })();

        setData({
          ...offer,
          price: String(offer.price || ''),
          priceCurrency: String(offer.priceCurrency || 'PLN').toUpperCase() === 'EUR' ? 'EUR' : 'PLN',
          area: String(offer.area || ''),
          rooms: String(offer.rooms || ''),
          floor: String(offer.floor || ''),
          year: String(offer.yearBuilt ?? offer.year ?? offer.buildYear ?? ''),
          adminFee: offer.adminFee != null ? String(offer.adminFee) : '',
          plotArea: String(offer.plotArea || ''),
          district: offer.district || "",
          address: offer.street || offer.address || "",
          description: descriptionForEditForm(offer.description),
          ...resolveStreetFieldsForForm({
            street: offer.street,
            address: offer.address,
            buildingNumber: offer.buildingNumber,
          }),
          isExactLocation: offer.isExactLocation !== false,
          apartmentNumber: offer.apartmentNumber || '',
          landRegistryNumber: offer.landRegistryNumber || '',
          propertyType: offer.propertyType || 'FLAT',
          transactionType: String(offer.transactionType || 'SELL').toUpperCase() === 'RENT' ? 'RENT' : 'SELL',
          condition: conditionForForm(offer.condition),
          heating: offer.heating || '',
          isFurnished: offer.isFurnished === true,
          city: offer.city || '',
          totalFloors: offer.totalFloors != null && offer.totalFloors !== '' ? String(offer.totalFloors) : '',
          localityCountryCode: offer.localityCountryCode || 'PL',
          legalCheckStatus: offer.legalCheckStatus || 'NONE',
          isLegalSafeVerified: Boolean(offer.isLegalSafeVerified),
        });
        setSelectedAmenities(readAmenitySelectionFromOffer(offer));
        const cp = offer.agentCommissionPercent;
        setAgentCommissionPercent(
          cp === null || cp === undefined ? '' : String(cp).replace('.', ','),
        );
        if (parsedImages.length) setImagesList(parsedImages);
        const fp = String(offer.floorPlanUrl || offer.floorPlan || '').trim();
        setFloorPlanUrl(fp || null);
        setFloorPlanExtraUrls(parseFloorPlanExtraUrls(offer.floorPlanExtraUrls).filter((url) => url !== fp));
        setIsLoading(false);
      } catch (e) { setAuthError("Błąd serwera."); setIsLoading(false); }
    };
    init();
  }, [offerId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !offerId) return;
    setIsUploading(true);
    try {
      const newUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files.item(i);
        if (!f) continue;
        const formData = new FormData();
        formData.append('offerId', offerId);
        formData.append('file', f);
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || err.message || 'Upload się nie powiódł');
        }
        const d = await res.json();
        if (d.url) newUrls.push(d.url);
      }
      const merged = [...imagesList, ...newUrls].slice(0, OFFER_MAX_IMAGES);
      setImagesList(merged);
      updateData({ images: merged.join(','), imageUrl: merged[0] });
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Upload zdjęć nie powiódł się.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = (url: string) => { const n = imagesList.filter(u => u !== url); setImagesList(n); updateData({ images: n.join(","), imageUrl: n[0] || '' }); };

  const handleFloorPlanUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !offerId) return;
    setFloorPlanUploading(true);
    try {
      const formData = new FormData();
      formData.append('offerId', offerId);
      formData.append('isFloorPlan', 'true');
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData, credentials: 'include' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || 'Upload rzutu nie powiódł się');
      }
      const d = await res.json();
      if (d.url) {
        setFloorPlanUrl((current) => {
          if (current && current !== d.url) {
            setFloorPlanExtraUrls((extras) => [...new Set([...extras, current])]);
          }
          return d.url;
        });
        updateData({ floorPlanUrl: d.url, floorPlan: d.url });
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload rzutu nie powiódł się.');
    } finally {
      setFloorPlanUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveFloorPlan = () => {
    setFloorPlanUrl(null);
    setFloorPlanExtraUrls([]);
    updateData({ floorPlanUrl: null, floorPlan: null, floorPlanExtraUrls: null });
  };

  const handleMarkAsPlan = (url: string) => {
    const nextGallery = imagesList.filter((item) => item !== url);
    setImagesList(nextGallery);
    updateData({ images: nextGallery.join(','), imageUrl: nextGallery[0] || '' });
    if (!floorPlanUrl) {
      setFloorPlanUrl(url);
      updateData({ floorPlanUrl: url, floorPlan: url });
      return;
    }
    if (floorPlanUrl === url || floorPlanExtraUrls.includes(url)) return;
    setFloorPlanExtraUrls((current) => [...current, url]);
  };

  const handleReturnPlanToGallery = (url: string) => {
    if (floorPlanUrl === url) {
      const [nextPrimary, ...rest] = floorPlanExtraUrls;
      setFloorPlanUrl(nextPrimary || null);
      setFloorPlanExtraUrls(rest);
      updateData({ floorPlanUrl: nextPrimary || null, floorPlan: nextPrimary || null });
    } else {
      setFloorPlanExtraUrls((current) => current.filter((item) => item !== url));
    }
    if (!imagesList.includes(url)) {
      const nextGallery = [...imagesList, url].slice(0, OFFER_MAX_IMAGES);
      setImagesList(nextGallery);
      updateData({ images: nextGallery.join(','), imageUrl: nextGallery[0] || '' });
    }
  };

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));
  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setImagesList((items) => {
        const newItems = arrayMove(items, items.indexOf(active.id), items.indexOf(over.id));
        updateData({ images: newItems.join(","), imageUrl: newItems[0] }); return newItems;
      });
    }
  };

  const handleSave = async () => {
    const exactLocation = data.isExactLocation !== false;
    const streetName = String(data.streetName || data.address || '').trim();
    const buildingNumber = String(data.buildingNumber || '').trim();
    const storedStreet = streetFieldsForOfferStorage(streetName, buildingNumber, exactLocation);
    const listingCurrencySave = (String(data.priceCurrency || 'PLN').toUpperCase() === 'EUR' ? 'EUR' : 'PLN') as ListingCurrency;
    const kwNormalized = normalizeLandRegistryInput(String(data.landRegistryNumber || ''));
    if (kwNormalized && !isValidLandRegistryNumber(kwNormalized)) {
      alert(ao.docVerificationKwFormatError);
      landRegistryInputRef.current?.focus();
      kwSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setIsSubmitting(true);
    const payload = {
      title: data.title,
      description: descriptionForStorageFromEdit(data.description),
      price: String(data.price || '').replace(/\s/g, ''),
      priceCurrency: listingCurrencySave,
      images: JSON.stringify(imagesList),
      floorPlanUrl: floorPlanUrl || null,
      floorPlan: floorPlanUrl || null,
      floorPlanExtraUrls: serializeFloorPlanExtraUrls(floorPlanExtraUrls),
      buildYear: data.year ? Number(data.year) : null,
      yearBuilt: data.year ? Number(data.year) : null,
      area: data.area,
      rooms: data.rooms,
      floor: data.floor,
      totalFloors: data.totalFloors ? Number(data.totalFloors) : null,
      adminFee: data.adminFee ? Number(String(data.adminFee).replace(/\D/g, '')) : null,
      street: storedStreet.street,
      buildingNumber: storedStreet.buildingNumber,
      isExactLocation: exactLocation,
      lat: data.lat,
      lng: data.lng,
      city: data.city || '',
      district: data.district,
      propertyType: data.propertyType,
      transactionType: data.transactionType === 'RENT' ? 'RENT' : 'SELL',
      condition: data.propertyType === 'PLOT' ? 'NOT_APPLICABLE' : data.condition || 'READY',
      heating: data.propertyType === 'PLOT' ? null : (data.heating || null),
      isFurnished: data.propertyType === 'PLOT' ? false : Boolean(data.isFurnished),
      plotArea: data.plotArea ? String(data.plotArea).replace(',', '.') : null,
      apartmentNumber: data.apartmentNumber || '',
      landRegistryNumber: kwNormalized || '',
      ...amenityBooleanPatch(selectedAmenities),
      ...(isAgentCommissionAccount({ role: viewerRole }) && agentCommissionPercent.trim() !== ''
        ? { agentCommissionPercent: agentCommissionPercent.replace(',', '.') }
        : {}),
    };
    const res = await fetch(`/api/offers/${offerId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await res.json().catch(() => ({}));
    if (res.ok) { 
      setIsSuccess(true); 
      setTimeout(() => goBackFromEdit(), 2500); 
    } else { 
      alert(result.error || result.message || 'Wystąpił błąd zapisu.'); 
      setIsSubmitting(false); 
    }
  };

  const toggleAmenity = (id: OfferAmenityId) => {
    setSelectedAmenities((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const listingCurrency = (String(data.priceCurrency || 'PLN').toUpperCase() === 'EUR' ? 'EUR' : 'PLN') as ListingCurrency;
  const isPolishOfferLocation = isPolishLocality(data.localityCountryCode);
  const normalizedLandRegistryNumber = normalizeLandRegistryInput(String(data.landRegistryNumber || ''));
  const hasLandRegistryInput = normalizedLandRegistryNumber.length > 0;
  const landRegistryValid =
    !isPolishOfferLocation || !hasLandRegistryInput || isValidLandRegistryNumber(normalizedLandRegistryNumber);
  const legalStatus = legalStatusFromOffer(data);
  const kwLocked = (legalStatus === 'VERIFIED' || Boolean(data.isLegalSafeVerified)) && String(viewerRole || '').toUpperCase() !== 'ADMIN';
  const requiresPlot = ['HOUSE', 'PLOT'].includes(String(data.propertyType || ''));
  const isPlot = data.propertyType === 'PLOT';
  const crmPro = (dict as { crm?: { proTools?: { openHouseTitle?: string; auctionTitle?: string; openHouseSubtitle?: string } } }).crm?.proTools;

  useEffect(() => {
    if (isLoading) return;
    const focus = String(searchParams.get('focus') || '').toLowerCase();
    if (focus !== 'kw' && focus !== 'tarcza' && typeof window !== 'undefined' && window.location.hash !== '#kw') {
      return;
    }
    const timer = window.setTimeout(() => {
      kwSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      landRegistryInputRef.current?.focus();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [isLoading, searchParams, offerId]);

  if (isLoading) return <div className="theme-aware-dashboard flex min-h-screen flex-col items-center justify-center gap-6 bg-[var(--eos-bg)]"><Loader2 className="size-10 animate-spin text-[var(--eos-accent)]" /></div>;
  if (authError) return <div className="theme-aware-dashboard flex min-h-screen items-center justify-center bg-[var(--eos-bg)] font-bold uppercase tracking-widest text-red-500">{authError}</div>;

  return (
    <div className="theme-aware-dashboard min-h-screen bg-[var(--eos-bg)] pb-40 font-sans text-[var(--eos-text)] selection:bg-emerald-500/30">
      
      {/* Pasek Nawigacyjny */}
      <div className="sticky top-0 z-50 bg-[#020202]/80 backdrop-blur-2xl border-b border-white/5 p-4 md:p-6 flex items-center justify-between shadow-[0_10px_40px_rgba(0,0,0,0.8)]">
        <button onClick={goBackFromEdit} className="flex items-center gap-3 text-zinc-400 hover:text-white transition-all duration-300 group">
          <div className="w-10 h-10 rounded-full bg-[#0a0a0a] border border-white/5 flex items-center justify-center group-hover:bg-white/10 group-hover:border-white/20 transition-all"><ArrowLeft size={16} /></div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] hidden md:block">Wróć</span>
        </button>
        <div className="flex items-center gap-3 bg-emerald-500/10 px-4 py-2 rounded-full border border-emerald-500/20">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.8)]" />
          <span className="text-emerald-400 text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em]">Tryb Edycji Premium</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-6 mt-12 space-y-12">
        
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-16 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none"></div>
          <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter mb-4 relative z-10 drop-shadow-2xl">Edytuj <span className="text-transparent bg-clip-text bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-700">Ofertę</span></h1>
          <p className="text-zinc-500 text-xs md:text-sm font-bold tracking-[0.2em] uppercase relative z-10">Zarządzaj ogłoszeniem <span className="text-white/40 ml-2">#{offerId}</span></p>
        </motion.div>

        {/* --- DANE PODSTAWOWE --- */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={glassPanel}>
          <div className="flex items-center gap-4 mb-10 border-b border-white/5 pb-6">
            <div className="w-14 h-14 rounded-[1.2rem] bg-gradient-to-br from-emerald-500/20 to-emerald-900/20 flex items-center justify-center border border-emerald-500/30 shadow-[inset_0_0_20px_rgba(16,185,129,0.2)]"><Building2 className="text-emerald-400" size={24} /></div>
            <div>
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-widest text-white drop-shadow-md">Kluczowe</h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em]">Najważniejsze parametry</p>
            </div>
          </div>
          
          <div className="space-y-8">
            <div>
              <label className={labelPremium}>Tytuł Ogłoszenia</label>
              <div className={inputWrapper}>
                <Home className={iconGlow} size={20} />
                <input value={data.title || ''} onChange={e => updateData({ title: e.target.value })} className={inputPremium} placeholder="Np. Luksusowy Apartament w Centrum" />
              </div>
            </div>

            <div className="bg-[#111] border border-white/10 rounded-full p-1.5 flex shadow-inner relative w-full max-w-[400px]">
              <div className={`absolute top-1.5 bottom-1.5 left-1.5 w-[calc(50%-6px)] bg-[#0a0a0a] border border-emerald-500/30 rounded-full transition-transform duration-500 ${data.transactionType === 'RENT' ? 'translate-x-[calc(100%+12px)]' : 'translate-x-0'}`} />
              <button type="button" onClick={() => updateData({ transactionType: 'SELL' })} className={`relative z-10 flex-1 py-3 text-[10px] font-black uppercase tracking-widest ${data.transactionType === 'RENT' ? 'text-white/40' : 'text-emerald-400'}`}>
                {ao.sell}
              </button>
              <button type="button" onClick={() => updateData({ transactionType: 'RENT' })} className={`relative z-10 flex-1 py-3 text-[10px] font-black uppercase tracking-widest ${data.transactionType === 'RENT' ? 'text-emerald-400' : 'text-white/40'}`}>
                {ao.rent}
              </button>
            </div>

            <div>
              <label className={labelPremium}>{ao.step1Title}</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {PROPERTY_TYPES.map((cat) => {
                  const isActive = data.propertyType === cat.id;
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => updateData({
                        propertyType: cat.id,
                        condition: cat.id === 'PLOT' ? 'NOT_APPLICABLE' : (data.condition === 'NOT_APPLICABLE' ? 'READY' : data.condition),
                      })}
                      className={`h-24 rounded-2xl flex flex-col items-center justify-center gap-2 border transition-all ${isActive ? 'bg-emerald-500 border-emerald-400 text-black' : 'bg-white/5 border-white/10 text-zinc-400 hover:border-white/25'}`}
                    >
                      <Icon size={22} />
                      <span className="text-[10px] font-black uppercase tracking-widest">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {!isPlot ? (
              <div>
                <label className={labelPremium}>{ao.conditionLabel}</label>
                <div className="flex flex-wrap gap-3">
                  {CONDITION_TYPES.map((condition) => {
                    const isActive = data.condition === condition.id;
                    return (
                      <button
                        key={condition.id}
                        type="button"
                        onClick={() => updateData({ condition: condition.id })}
                        className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${isActive ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : 'bg-[#0a0a0a] text-zinc-500 border-white/5 hover:border-white/20'}`}
                      >
                        {condition.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className={labelPremium.replace('mb-3', 'mb-0')}>{ao.priceCurrency}</span>
                  {(['PLN', 'EUR'] as ListingCurrency[]).map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => {
                        const amount = Number(String(data.price || '').replace(/\s/g, ''));
                        const converted =
                          amount > 0 ? convertBetweenCurrencies(amount, listingCurrency, code, fxRate) : 0;
                        updateData({
                          priceCurrency: code,
                          price: converted > 0 ? String(converted).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : data.price,
                          adminFee:
                            data.adminFee && Number(String(data.adminFee).replace(/\D/g, '')) > 0
                              ? String(
                                  convertBetweenCurrencies(
                                    Number(String(data.adminFee).replace(/\D/g, '')),
                                    listingCurrency,
                                    code,
                                    fxRate,
                                  ),
                                )
                              : data.adminFee,
                        });
                      }}
                      className={`px-4 py-2 rounded-xl border-2 font-black uppercase tracking-widest text-[10px] transition-all ${
                        listingCurrency === code
                          ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                          : 'bg-[#111] border-white/10 text-white/40 hover:border-white/25'
                      }`}
                    >
                      {code}
                    </button>
                  ))}
                </div>
                <label className={labelPremium}>
                  {listingCurrency === 'EUR' ? ao.salePriceLabel : ao.salePriceLabel} ({listingCurrency})
                </label>
                <div className={inputWrapper}>
                  <Sparkles className={iconGlow} size={20} />
                  <input value={formatNum(data.price || '')} onChange={e => updateData({ price: e.target.value })} className={`${inputPremium} font-mono font-bold text-emerald-400`} placeholder={listingCurrency === 'EUR' ? 'Np. 250 000' : 'Np. 1 250 000'} />
                </div>
                <PriceReductionPreview
                  listPricePln={Number(data.listPricePln ?? data.pricePln ?? 0)}
                  draftPriceRaw={String(data.price || '')}
                  priceCurrency={listingCurrency}
                  exchangeRate={fxRate}
                />
              </div>
              <div>
                <label className={labelPremium}>Powierzchnia (m²)</label>
                <div className={inputWrapper}>
                  <Box className={iconGlow} size={20} />
                  <input type="number" value={data.area || ''} onChange={e => updateData({ area: e.target.value })} className={inputPremium} placeholder="Np. 65" />
                </div>
              </div>
              {requiresPlot ? (
                <div className="md:col-span-2">
                  <label className={labelPremium}>{ao.plotAreaLabel}</label>
                  <div className={inputWrapper}>
                    <Box className={iconGlow} size={20} />
                    <input
                      type="text"
                      value={data.plotArea || ''}
                      onChange={(e) => updateData({ plotArea: e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.').slice(0, 8) })}
                      className={inputPremium}
                      placeholder="450"
                    />
                  </div>
                </div>
              ) : null}
            </div>
            {isAgentCommissionAccount({ role: viewerRole }) ? (
              <div className="pt-4 border-t border-white/5">
                <AgentCommissionEditor
                  ao={ao}
                  priceRaw={String(data.price || '').replace(/\s/g, '')}
                  percentValue={agentCommissionPercent}
                  onPercentChange={setAgentCommissionPercent}
                />
              </div>
            ) : null}
          </div>
        </motion.div>

        {/* --- SZCZEGÓŁY --- */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className={glassPanel}>
           <div className="flex items-center gap-4 mb-10 border-b border-white/5 pb-6">
            <div className="w-14 h-14 rounded-[1.2rem] bg-gradient-to-br from-blue-500/20 to-blue-900/20 flex items-center justify-center border border-blue-500/30 shadow-[inset_0_0_20px_rgba(59,130,246,0.2)]"><Layers className="text-blue-400" size={24} /></div>
            <div>
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-widest text-white drop-shadow-md">Szczegóły</h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em]">Rozszerzone informacje</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            {!isPlot ? (
              <div>
                <label className={labelPremium}>{ao.rooms}</label>
                <div className={inputWrapper}>
                  <BedDouble className={iconGlow} size={20} />
                  <input type="number" value={data.rooms || ''} onChange={e => updateData({ rooms: e.target.value })} className={inputPremium} placeholder="Np. 3" />
                </div>
              </div>
            ) : null}
            {!isPlot ? (
              <div>
                <label className={labelPremium}>{ao.floor}</label>
                <div className={inputWrapper}>
                  <Layers className={iconGlow} size={20} />
                  <select value={data.floor === 0 || data.floor === '0' ? '0' : (data.floor || '')} onChange={e => updateData({ floor: e.target.value })} className={`${inputPremium} appearance-none cursor-pointer`}>
                    <option value="">—</option>
                    <option value="0">{ao.floorGround}</option>
                    {Array.from({ length: 30 }, (_, i) => String(i + 1)).map((floor) => (
                      <option key={floor} value={floor}>{floor}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}
            {!isPlot ? (
              <div>
                <label className={labelPremium}>Liczba pięter</label>
                <div className={inputWrapper}>
                  <Layers className={iconGlow} size={20} />
                  <input type="number" value={data.totalFloors || ''} onChange={e => updateData({ totalFloors: e.target.value })} className={inputPremium} placeholder="Np. 4" />
                </div>
              </div>
            ) : null}
            <div>
              <label className={labelPremium}>{ao.buildYearLabel}</label>
              <div className={inputWrapper}>
                <Calendar className={iconGlow} size={20} />
                <select value={data.year || ''} onChange={e => updateData({ year: e.target.value })} className={`${inputPremium} appearance-none cursor-pointer`}>
                  <option value="">—</option>
                  {buildYearBuiltSelectOptions().map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {!isPlot ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div>
                <label className={labelPremium}>{ao.heatingTypeLabel}</label>
                <div className={inputWrapper}>
                  <Flame className={iconGlow} size={20} />
                  <select value={data.heating || ''} onChange={(e) => updateData({ heating: e.target.value })} className={`${inputPremium} appearance-none cursor-pointer`}>
                    <option value="">{ao.selectPlaceholder}</option>
                    {HEATING_TYPES.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelPremium}>{ao.furnishedLabel}</label>
                <div className="flex gap-4">
                  <button type="button" onClick={() => updateData({ isFurnished: true })} className={`flex-1 py-4 rounded-xl border-2 font-black uppercase tracking-widest text-[10px] transition-all ${data.isFurnished === true ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-[#111] border-white/5 text-white/40 hover:border-white/20'}`}>{ao.yes}</button>
                  <button type="button" onClick={() => updateData({ isFurnished: false })} className={`flex-1 py-4 rounded-xl border-2 font-black uppercase tracking-widest text-[10px] transition-all ${data.isFurnished === false ? 'bg-red-500/10 border-red-500 text-red-400' : 'bg-[#111] border-white/5 text-white/40 hover:border-white/20'}`}>{ao.no}</button>
                </div>
              </div>
            </div>
          ) : null}

          <div>
            <label className={labelPremium}>{ao.adminFeeLabel}</label>
            <div className={inputWrapper}>
              <Sparkles className={iconGlow} size={18} />
              <input
                value={formatNum(data.adminFee || '')}
                onChange={(e) => updateData({ adminFee: e.target.value })}
                className={inputPremium}
                placeholder={listingCurrency === 'EUR' ? 'Np. 150' : 'Np. 650'}
              />
            </div>
            <p className="mt-2 text-[10px] uppercase tracking-widest text-zinc-500">
              {ao.adminFeeOptional} · {listingCurrency}
            </p>
          </div>

          <div>
            <label className={labelPremium}>{ao.amenitiesPremiumLabel}</label>
            <div className="flex flex-wrap gap-3 mt-4">
              {amenityOptions.map(({ id, label }) => {
                const isActive = selectedAmenities.includes(id);
                return (
                  <div
                    key={id}
                    onClick={() => toggleAmenity(id)}
                    className={`max-w-full px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.08em] leading-snug text-balance cursor-pointer transition-all duration-300 border ${isActive ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-[#0a0a0a] text-zinc-500 border-white/5 hover:bg-[#111] hover:border-white/10'}`}
                  >
                    {label}
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className={glassPanel}>
          <div className="flex items-center gap-4 mb-8 border-b border-white/5 pb-6">
            <div className="w-14 h-14 rounded-[1.2rem] bg-gradient-to-br from-emerald-500/20 to-cyan-900/20 flex items-center justify-center border border-emerald-500/30">
              <MapPin className="text-emerald-400" size={24} />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-widest text-white drop-shadow-md">Lokalizacja</h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em]">Dokładna lub przybliżona publikacja</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="inline-flex rounded-2xl border border-white/10 bg-black/30 p-1">
              <button
                type="button"
                onClick={() => updateData({ isExactLocation: true })}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${data.isExactLocation !== false ? 'bg-emerald-500 text-black' : 'text-zinc-400 hover:text-white'}`}
              >
                Dokładna lokalizacja
              </button>
              <button
                type="button"
                onClick={() => updateData({ isExactLocation: false })}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${data.isExactLocation === false ? 'bg-cyan-500 text-black' : 'text-zinc-400 hover:text-white'}`}
              >
                Przybliżona okolica
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={labelPremium}>{ao.city}</label>
                <div className={inputWrapper}>
                  <MapPin className={iconGlow} size={20} />
                  <input
                    value={data.city || ''}
                    onChange={(e) => updateData({ city: e.target.value })}
                    className={inputPremium}
                    placeholder={ao.cityPlaceholder}
                  />
                </div>
              </div>
              <div>
                <label className={labelPremium}>{ao.district}</label>
                <div className={inputWrapper}>
                  <MapPin className={iconGlow} size={20} />
                  <input
                    value={data.district || ''}
                    onChange={(e) => updateData({ district: e.target.value })}
                    className={inputPremium}
                    placeholder={ao.areaPlaceholder}
                  />
                </div>
              </div>
              <div>
                <label className={labelPremium}>Nazwa ulicy</label>
                <div className={inputWrapper}>
                  <MapPin className={iconGlow} size={20} />
                  <input
                    value={data.streetName || ''}
                    onChange={(e) => updateData({ streetName: e.target.value, address: e.target.value })}
                    className={inputPremium}
                    placeholder="Np. Inżynierska"
                  />
                </div>
              </div>
              {data.isExactLocation !== false ? (
                <div>
                  <label className={labelPremium}>Numer ulicy</label>
                  <div className={inputWrapper}>
                    <Home className={iconGlow} size={20} />
                    <input
                      value={data.buildingNumber || ''}
                      onChange={(e) => updateData({ buildingNumber: e.target.value })}
                      className={inputPremium}
                      placeholder="Np. 12A"
                    />
                  </div>
                </div>
              ) : null}
            </div>

            {Number.isFinite(Number(data.lat)) && Number.isFinite(Number(data.lng)) ? (
              <NeighborhoodMapPreview
                lat={Number(data.lat)}
                lng={Number(data.lng)}
                street={data.streetName || data.address || ''}
                city={data.city || ''}
                district={data.district || ''}
                variant="offer"
                showPin={data.isExactLocation !== false}
              />
            ) : (
              <p className="text-xs text-[var(--eos-muted)]">Brak współrzędnych GPS w tej ofercie.</p>
            )}
          </div>
        </motion.div>

        {isPolishOfferLocation ? (
          <div ref={kwSectionRef} id="kw">
            <AddOfferDocVerificationPanel
              ao={ao}
              inputPremium={inputPremium}
              labelPremium={labelPremium}
              propertyType={String(data.propertyType || 'FLAT')}
              apartmentNumber={String(data.apartmentNumber || '')}
              landRegistryNumber={normalizedLandRegistryNumber}
              landRegistryValid={landRegistryValid}
              hasLandRegistryInput={hasLandRegistryInput}
              onApartmentChange={(value) => updateData({ apartmentNumber: value })}
              onLandRegistryChange={(value) => updateData({ landRegistryNumber: normalizeLandRegistryInput(value) })}
              landRegistryInputRef={landRegistryInputRef}
              kwLocked={kwLocked}
              legalStatus={legalStatus}
            />
          </div>
        ) : null}

        {/* --- MULTIMEDIA --- */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className={glassPanel}>
          <div className="flex items-center gap-4 mb-10 border-b border-white/5 pb-6">
            <div className="w-14 h-14 rounded-[1.2rem] bg-gradient-to-br from-purple-500/20 to-purple-900/20 flex items-center justify-center border border-purple-500/30 shadow-[inset_0_0_20px_rgba(168,85,247,0.2)]"><ImageIcon className="text-purple-400" size={24} /></div>
            <div>
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-widest text-white drop-shadow-md">Galeria</h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em]">Przeciągnij by ułożyć</p>
            </div>
          </div>
          
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={imagesList} strategy={horizontalListSortingStrategy}>
              <div className="flex flex-wrap gap-4 md:gap-6 mb-6">
                {imagesList.map((url, idx) => (
                  <SortablePhoto key={url} url={url} onRemove={handleRemoveImage} onMarkAsPlan={handleMarkAsPlan} isMain={idx === 0} />
                ))}
                
                {imagesList.length < OFFER_MAX_IMAGES && (
                  <label className="w-28 h-28 md:w-36 md:h-36 rounded-2xl border-2 border-dashed border-[#222] hover:border-emerald-500/60 bg-[#0a0a0a]/50 hover:bg-[#111] flex flex-col items-center justify-center cursor-pointer transition-all duration-500 group shadow-inner">
                    {isUploading ? <Loader2 className="animate-spin text-emerald-500" size={28} /> : <><ImageIcon className="text-zinc-600 group-hover:text-emerald-400 transition-colors duration-500 mb-3" size={32} /><span className="text-[10px] uppercase font-black text-zinc-600 group-hover:text-emerald-400 tracking-widest">Dodaj</span></>}
                    <input type="file" multiple accept="image/*" onChange={handleUpload} className="hidden" />
                  </label>
                )}
              </div>
            </SortableContext>
          </DndContext>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className={glassPanel}>
          <div className="flex items-center gap-4 mb-8 border-b border-white/5 pb-6">
            <div className="w-14 h-14 rounded-[1.2rem] bg-gradient-to-br from-cyan-500/20 to-cyan-900/20 flex items-center justify-center border border-cyan-500/30">
              <Map size={24} className="text-cyan-400" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-widest text-white drop-shadow-md">Plan nieruchomości</h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em]">Rzut lokalu dla kupujących</p>
            </div>
          </div>
          {!floorPlanUrl && floorPlanExtraUrls.length === 0 ? (
            <label className="w-full min-h-[88px] rounded-2xl border-2 border-dashed border-[#222] hover:border-cyan-500/50 bg-[#0a0a0a]/50 flex flex-col items-center justify-center cursor-pointer transition-all group">
              {floorPlanUploading ? <Loader2 className="animate-spin text-cyan-400" size={28} /> : (
                <>
                  <Map size={28} className="text-zinc-600 group-hover:text-cyan-400 mb-2 transition-colors" />
                  <span className="text-[10px] uppercase font-black text-zinc-600 group-hover:text-cyan-400 tracking-widest">Dodaj plan nieruchomości</span>
                </>
              )}
              <input type="file" accept="image/*" onChange={handleFloorPlanUpload} className="hidden" />
            </label>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-[var(--eos-muted)]">
                Zaznacz zdjęcia w galerii przyciskiem Plan — trafią tutaj po zatwierdzeniu zapisu.
              </p>
              <div className="flex flex-wrap gap-4">
                {floorPlanUrl ? (
                  <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-cyan-500/30 bg-black">
                    <img src={floorPlanUrl} alt="Plan nieruchomości" className="h-56 w-full object-contain opacity-90" />
                    <span className="absolute left-3 top-3 rounded-full bg-cyan-500 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-black">Główny plan</span>
                    <div className="flex gap-2 border-t border-white/5 bg-[#0a0a0a] p-3">
                      <label className="flex-1 cursor-pointer rounded-xl border border-white/10 py-2.5 text-center text-[10px] font-black uppercase tracking-widest text-cyan-400 hover:bg-white/5">
                        {floorPlanUploading ? 'Wgrywanie…' : 'Zmień plan'}
                        <input type="file" accept="image/*" onChange={handleFloorPlanUpload} className="hidden" />
                      </label>
                      <button type="button" onClick={() => handleReturnPlanToGallery(floorPlanUrl)} className="flex-1 rounded-xl border border-white/10 py-2.5 text-[10px] font-black uppercase tracking-widest text-white/70 hover:bg-white/5">
                        Do galerii
                      </button>
                      <button type="button" onClick={handleRemoveFloorPlan} className="flex-1 rounded-xl border border-red-500/30 py-2.5 text-[10px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500/10">
                        Usuń
                      </button>
                    </div>
                  </div>
                ) : null}
                {floorPlanExtraUrls.map((url) => (
                  <div key={url} className="relative w-28 overflow-hidden rounded-2xl border border-cyan-500/20 bg-black md:w-36">
                    <img src={url} alt="Dodatkowy plan" className="h-28 w-full object-contain md:h-36" />
                    <span className="absolute left-2 top-2 rounded-full bg-cyan-500/90 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-black">Plan</span>
                    <button type="button" onClick={() => handleReturnPlanToGallery(url)} className="absolute bottom-2 right-2 rounded-full bg-black/80 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-white">
                      Galeria
                    </button>
                  </div>
                ))}
                <label className="flex h-28 w-28 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#222] bg-[#0a0a0a]/50 hover:border-cyan-500/50 md:h-36 md:w-36">
                  {floorPlanUploading ? <Loader2 className="animate-spin text-cyan-400" size={22} /> : (
                    <>
                      <LayoutGrid size={22} className="mb-2 text-zinc-600" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Dodaj plan</span>
                    </>
                  )}
                  <input type="file" accept="image/*" onChange={handleFloorPlanUpload} className="hidden" />
                </label>
              </div>
            </div>
          )}
        </motion.div>

        {/* --- OPIS --- */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className={glassPanel}>
           <div className="flex items-center gap-4 mb-10 border-b border-white/5 pb-6">
            <div className="w-14 h-14 rounded-[1.2rem] bg-gradient-to-br from-orange-500/20 to-orange-900/20 flex items-center justify-center border border-orange-500/30 shadow-[inset_0_0_20px_rgba(249,115,22,0.2)]"><Layers className="text-orange-400" size={24} /></div>
            <div>
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-widest text-white drop-shadow-md">Opis</h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em]">Treść ogłoszenia</p>
            </div>
          </div>
          <textarea value={data.description || ''} onChange={e => updateData({ description: e.target.value })} className={`${inputPremium} min-h-[250px] resize-y leading-relaxed pl-5`} placeholder="Opisz wszystkie atuty swojej nieruchomości. Dobry opis to klucz do sukcesu..." />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className={glassPanel}>
          <div className="flex items-center gap-4 mb-6 border-b border-white/5 pb-6">
            <div className="w-14 h-14 rounded-[1.2rem] bg-gradient-to-br from-amber-500/20 to-amber-900/20 flex items-center justify-center border border-amber-500/30">
              <DoorOpen className="text-amber-400" size={24} />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-widest text-white drop-shadow-md">
                {crmPro?.openHouseTitle || 'Dzień otwartych drzwi'}
              </h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em]">
                {crmPro?.auctionTitle || 'Licytacje'} · CRM
              </p>
            </div>
          </div>
          <p className="text-sm text-zinc-400 leading-relaxed mb-6">
            {crmPro?.openHouseSubtitle || 'Terminy dni otwartych i licytacji ustawiasz w CRM — nie w tym formularzu.'}
          </p>
          <a
            href={`/moje-konto/crm?return=/edytuj-oferte/${offerId}`}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-amber-300 hover:bg-amber-500 hover:text-black transition-all"
          >
            <DoorOpen size={16} />
            {eo.backToCrm}
          </a>
        </motion.div>

      </div>

      {/* --- LEWITUJĄCY, POTĘŻNY PRZYCISK ZAPISU (FLOATING ACTION BAR) --- */}
      <AnimatePresence>
        <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} className="fixed bottom-6 md:bottom-10 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-2xl z-[100]">
          <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full"></div>
          <button onClick={handleSave} disabled={isSubmitting || isSuccess} className={`relative w-full py-5 md:py-6 rounded-[2rem] font-black text-xs md:text-sm uppercase tracking-[0.3em] transition-all duration-500 flex items-center justify-center gap-3 border-2 overflow-hidden group shadow-[0_20px_50px_rgba(0,0,0,0.8)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${isSuccess ? 'bg-emerald-500 border-emerald-400 text-black scale-105' : 'bg-[#0a0a0a]/90 backdrop-blur-xl border-emerald-500/50 text-emerald-400 hover:bg-emerald-500 hover:text-black hover:border-emerald-400 hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(16,185,129,0.5)] active:scale-95'}`}>
            {/* Lśnienie w tle przycisku */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
            
            {isSubmitting ? <><Loader2 className="animate-spin" size={22} /> ZAPISYWANIE DANYCH...</> : 
             isSuccess ? <><CheckCircle size={24} className="animate-bounce" /> ZMIANY ZAPISANE!</> : 
             <><Save size={22} className="group-hover:scale-110 transition-transform" /> ZAKOŃCZ EDYCJĘ I ZAPISZ</>}
          </button>
        </motion.div>
      </AnimatePresence>

    </div>
  );
}
