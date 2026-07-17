"use client";
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocale } from '@/contexts/LocaleContext';
import {
  HEATING_DICT_KEYS,
  type AddOfferDictionary,
} from '@/i18n/addOfferDictionary';
import { motion, AnimatePresence } from 'framer-motion';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Home, 
  Building2, Rows, Castle, Briefcase, Map as MapIcon, MapPin, 
  Sparkles, Loader2, CheckCircle, Crown, Key, Upload, Trash2, 
  LayoutTemplate, X, Lock, User, Phone, Mail, Flame, AlertCircle, Check,
  Navigation, Bold, Italic, Underline, Heading, AlignLeft, ShieldCheck, LocateFixed
} from "lucide-react";

import ProPhotoSessionDialog from '@/components/photoSession/ProPhotoSessionDialog';
import PublishAuthGate from '@/components/auth/PublishAuthGate';
import ContactVerificationPanel from '@/components/ContactVerificationPanel';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  canonicalizeCity,
  getStrictCities,
  getStrictDistrictCatalog,
  inferAreaLabelFromMapboxFeature,
  inferCityFromMapboxFeature,
  inferStrictDistrictFromMapboxFeature,
  isStrictCity,
  normalizeText,
} from "@/lib/location/locationCatalog";
import {
  resolveStrictDistrictForForm,
} from "@/lib/location/strictDistrictFromPin";
import {
  buildForwardGeocodeSearchText,
  extractCountryFromMapboxFeature,
  extractVillageLocalityHint,
  isAdministrativeAreaLabel,
  isStreetAddressMapboxFeature,
  mapboxForwardGeocodeUrl,
  parseAddressSearchQuery,
  pickBestGeocodeFeature,
} from "@/lib/mapboxGeocodeClient";
import { buildYearBuiltSelectOptions } from "@/lib/offerYearBuilt";
import {
  buildRentAdditionalFeeSelectOptions,
  parseRentAdditionalFeeForApi,
} from "@/lib/rentAdditionalFees";
import {
  AGENT_COMMISSION_MIN_NONZERO,
  validateAgentCommissionPercent,
} from "@/lib/agentCommission";
import type { OfferPriceCurrency } from "@/lib/money/offerPrice";
import { useFxRate } from "@/contexts/FxRateContext";
import { convertBetweenCurrencies } from "@/lib/money/convert";
import { formatApproxLine } from "@/lib/money/format";
import AgentCommissionEditor from "@/components/offer/AgentCommissionEditor";
import PublicationWalletPanel from "@/components/profile/PublicationWalletPanel";
import type { PublicationRedemption, PublicationCouponOption } from "@/components/publication/PublicationChoiceModal";
import { buildAddOfferSummarySections } from "@/lib/addOfferSummary";
import {
  defaultPublicationSelection,
  publicationSelectionLabel,
  publicationSelectionToRedemption,
  type PublicationSelection,
} from "@/lib/publicationSelection";
import {
  addressMentionsOtherCity,
  formatOfferLocationLine,
  formatShortStreetFromMapboxFeature,
} from "@/lib/offerLocationDisplay";
import {
  flagEmojiFromIso2,
  isStandaloneVillageAddress,
  sanitizeNonStrictAreaLabel,
} from "@/lib/location/localityDisplay";
import {
  countryLabelForLocale,
  countryLabelFromIso,
  inferCountryFromCoordinates,
  isCoordinatesInPoland,
} from "@/lib/offerLocalityCountry";
import { isAgentOrAgencySeller } from "@/lib/sellerDisplay";
import AddOfferDocVerificationPanel from "@/components/offer/AddOfferDocVerificationPanel";
import { normalizeLandRegistryInput, isValidLandRegistryNumber } from "@/lib/landRegistryInput";
import {
  ADD_OFFER_DRAFT_KEY,
  ADD_OFFER_DRAFT_VERSION,
  clearAddOfferDraft,
  patchAddOfferDraft,
  readAddOfferDraft,
  resolvePendingOfferForPublish,
} from "@/lib/addOfferDraft";

if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
  mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
}

const inputPremium =
  "eos-field w-full rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] py-4 px-5 text-base text-[var(--eos-text)] outline-none transition-all duration-300 placeholder:text-[var(--eos-muted)] focus:border-emerald-500 md:text-lg";
const inputCompact =
  "eos-field w-full min-w-0 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] py-3 px-4 text-xs sm:text-sm leading-snug text-[var(--eos-text)] outline-none transition-all duration-300 placeholder:text-[var(--eos-muted)] focus:border-emerald-500";
const labelPremium =
  "eos-label mb-2.5 ml-0.5 flex min-w-0 w-full flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[12px] font-semibold uppercase tracking-[0.055em] leading-snug md:text-[13px]";
const glassPanel =
  "rounded-[2.5rem] border border-[var(--eos-border)] bg-[var(--eos-card)]/95 p-8 shadow-2xl backdrop-blur-xl transition-all duration-500 md:p-10 relative overflow-x-clip overflow-y-visible";

function isPolishLocality(countryCode: unknown) {
  return String(countryCode || "PL").trim().toUpperCase() === "PL";
}

type FormFieldTarget = "landRegistryNumber" | "agentCommissionPercent" | null;

function buildPropertyTypes(ao: AddOfferDictionary) {
  return [
    { id: "FLAT", label: ao.propertyFlat, icon: Building2 },
    { id: "HOUSE", label: ao.propertyHouse, icon: Castle },
    { id: "PLOT", label: ao.propertyPlot, icon: MapIcon },
    { id: "COMMERCIAL", label: ao.propertyCommercial, icon: Briefcase },
  ];
}

function buildConditionTypes(ao: AddOfferDictionary) {
  return [
    { id: "READY", label: ao.conditionReady },
    { id: "RENOVATION", label: ao.conditionRenovation },
    { id: "DEVELOPER", label: ao.conditionDeveloper },
  ];
}

import {
  amenityBooleanPatch,
  buildAmenityOptions,
  OFFER_AMENITY_DEFS,
  type OfferAmenityId,
} from "@/lib/offerAmenities";

function buildHeatingTypes(ao: AddOfferDictionary) {
  return HEATING_DICT_KEYS.map((key) => ao[key]);
}

function plainTextToEditorHtml(text: string): string {
  const paragraphs = String(text || "")
    .trim()
    .split(/\n\s*\n/)
    .filter(Boolean);
  if (paragraphs.length === 0) return "";
  return paragraphs.map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");
}

function buildDescriptionDraftFromForm(
  data: Record<string, unknown>,
  locale: string,
  amenities: { id: string; label: string }[],
): Record<string, unknown> {
  const selectedLabels = Array.isArray(data.amenities) ? (data.amenities as string[]) : [];
  const selectedIds = amenities
    .filter((item) => selectedLabels.includes(item.label))
    .map((item) => item.id) as OfferAmenityId[];
  const amenityPatch = amenityBooleanPatch(selectedIds);

  return {
    locale,
    title: data.title,
    transactionType: data.transactionType,
    propertyType: data.propertyType,
    condition: data.condition,
    city: data.city,
    district: data.district,
    localityCountry: data.localityCountry,
    street: data.street,
    lat: data.lat,
    lng: data.lng,
    isExactLocation: data.locationType !== "approximate",
    priceCurrency: data.priceCurrency,
    price: data.price,
    adminFee: data.rentAdminFee,
    deposit: data.deposit,
    area: data.area,
    plotArea: data.plotArea,
    rooms: data.rooms,
    floor: data.floor,
    yearBuilt: data.buildYear,
    heating: data.heating,
    isFurnished: data.furnished === "yes" || data.furnished === true,
    agentCommissionPercent: data.agentCommissionPercent,
    hasBalcony: amenityPatch.hasBalcony,
    hasParking: amenityPatch.hasParking,
    hasStorage: amenityPatch.hasStorage,
    hasGarden: amenityPatch.hasGarden,
    isTwoLevel: amenityPatch.isDuplex,
    hasElevator: amenityPatch.hasElevator,
  };
}

type DistrictCatalogResponse = {
  strictCities: string[];
  strictCityDistricts: Record<string, string[]>;
};

const SortableItem = ({ id, img, idx, onRemove, progressObj }: any) => {
  const { dict } = useLocale();
  const ao = dict.addOffer;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 999 : 1,
    opacity: isDragging ? 0.9 : 1,
    scale: isDragging ? '1.05' : '1',
    boxShadow: isDragging ? '0 20px 40px rgba(16,185,129,0.5)' : ''
  };

  const isUploading = progressObj && progressObj.progress < 100 && !progressObj.error;
  const isError = progressObj && progressObj.error;

  return (
    <div ref={setNodeRef} style={style} className="w-32 h-32 relative rounded-2xl overflow-hidden group border border-white/10 hover:border-[#10b981]/50 transition-all z-50 shadow-lg bg-black/40 flex-shrink-0">
      <img src={img} className={`w-full h-full object-cover pointer-events-none transition-all ${isUploading ? 'opacity-40 blur-[2px]' : ''}`} alt={ao.thumbAlt} />

      {/* Nakładka z kropeczkami (Uchwyt Drag & Drop) */}
      <div {...attributes} {...listeners} className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-20">
        <div className="bg-black/60 px-3 py-2 rounded-full backdrop-blur-md border border-white/10 shadow-xl flex gap-1 items-center">
           <div className="w-1.5 h-1.5 bg-white/70 rounded-full"></div>
           <div className="w-1.5 h-1.5 bg-white/70 rounded-full"></div>
           <div className="w-1.5 h-1.5 bg-white/70 rounded-full"></div>
        </div>
      </div>

      <button onPointerDown={(e) => { e.stopPropagation(); onRemove(idx); }} className="absolute top-2 right-2 p-2 bg-red-500/90 hover:bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 group-hover:scale-110 transition-all z-[60] shadow-lg backdrop-blur-sm">
        <Trash2 size={14}/>
      </button>

      {idx === 0 && !isUploading && !isError && <span className="absolute bottom-0 left-0 w-full bg-[#10b981] backdrop-blur-md text-black text-[9px] font-black uppercase tracking-widest text-center py-1 z-10 shadow-[0_-5px_15px_rgba(16,185,129,0.3)] pointer-events-none">{ao.photosMain}</span>}

      {/* Pasek postępu */}
      {isUploading && (
        <div className="absolute bottom-0 left-0 w-full h-1.5 bg-black/50 overflow-hidden z-30">
          <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-200 ease-out" style={{ width: `${progressObj.progress}%` }} />
        </div>
      )}

      {/* Błąd */}
      {isError && (
         <div className="absolute inset-0 flex items-center justify-center bg-red-500/20 backdrop-blur-sm z-30 pointer-events-none">
            <span className="text-[9px] font-black text-white uppercase bg-red-500 px-2 py-1 rounded-md">{ao.photosError}</span>
         </div>
      )}
    </div>
  );
};

export default function ClientForm({
  initialUser,
  agencyClientId = null,
  crmSellerPrefill = null,
}: {
  initialUser?: any;
  agencyClientId?: number | null;
  crmSellerPrefill?: {
    transactionType?: string;
    propertyType?: string;
    city?: string;
    district?: string;
    price?: number;
    area?: number;
    rooms?: number;
    description?: string;
    titleHint?: string;
  } | null;
}) {
  const { dict, locale } = useLocale();
  const ao = dict.addOffer;
  const PROPERTY_TYPES = useMemo(() => buildPropertyTypes(ao), [ao]);
  const CONDITION_TYPES = useMemo(() => buildConditionTypes(ao), [ao]);
  const AMENITIES = useMemo(() => buildAmenityOptions(ao), [ao]);
  const HEATING_TYPES = useMemo(() => buildHeatingTypes(ao), [ao]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const { rate: fxRate } = useFxRate();
  const [data, setData] = useState<any>({
    transactionType: 'SELL', rentAdminFee: '', deposit: '', rentMinPeriod: '', rentAvailableFrom: '', petsAllowed: false, rentType: '',
    propertyType: '', title: '', 
    condition: '', locationType: 'exact', address: '', city: '', lng: null, lat: null, district: '',
    apartmentNumber: '', landRegistryNumber: '',
    localityCountry: 'Polska', localityCountryCode: 'PL',
    price: '', priceCurrency: 'PLN' as OfferPriceCurrency, agentCommissionPercent: '',
    area: '', rooms: '', floor: '', buildYear: '', plotArea: '', heating: '', furnished: '', rent: '', 
    amenities: [], description: '', 
    advertiserType: 'private', agencyName: '',
    contactName: initialUser?.name || '', contactPhone: initialUser?.phone || '', email: initialUser?.email || '', password: '' 
  });
  
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [addressError, setAddressError] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [locatingUser, setLocatingUser] = useState(false);
  
  const [imagesList, setImagesList] = useState<string[]>([]);
  const [uploadStats, setUploadStats] = useState<{[key: string]: {progress: number, error: boolean, sizeMB: number}}>({});
  const [filesMap, setFilesMap] = useState<{[key: string]: File}>({}); 
  const [totalSizeMB, setTotalSizeMB] = useState(0);
  const [floorPlan, setFloorPlan] = useState<string | null>(null);
  const [floorPlanFile, setFloorPlanFile] = useState<File | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [actionModal, setActionModal] = useState<"none" | "limit" | "success" | "error" | "otp" | "payment_success" | "oferta_plus" | "verify">("none");
  const [serverErrorMessage, setServerErrorMessage] = useState('');
  const [errorFieldTarget, setErrorFieldTarget] = useState<FormFieldTarget>(null);
  const [walletCoupons, setWalletCoupons] = useState<PublicationCouponOption[]>([]);
  const [walletPlusCredits, setWalletPlusCredits] = useState(0);
  const [walletHasPlusCredit, setWalletHasPlusCredit] = useState(false);
  const [walletPlusExpiresAt, setWalletPlusExpiresAt] = useState<string | null>(null);
  const [publicationSelection, setPublicationSelection] = useState<PublicationSelection | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  
  const [uploadProgress, setUploadProgress] = useState('');
  const [emailStatus, setEmailStatus] = useState('idle');
  const [phoneStatus, setPhoneStatus] = useState('idle');
  const [currentStep, setCurrentStep] = useState(1);
  const [activeUser, setActiveUser] = useState(initialUser);
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const isLoggedIn = Boolean(activeUser?.isLoggedIn);
  const [photoSessionOpen, setPhotoSessionOpen] = useState(false);
  const [locationCatalog, setLocationCatalog] = useState<DistrictCatalogResponse>({ strictCities: [], strictCityDistricts: {} });

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const orbitFrameRef = useRef<number | null>(null);
  const orbitTimeoutRef = useRef<number | null>(null);
  const lastGeocodedAddressRef = useRef<string>("");
  const editorRef = useRef<HTMLDivElement>(null);
  const agentCommissionInputRef = useRef<HTMLDivElement>(null);
  const landRegistryInputRef = useRef<HTMLInputElement>(null);
  const draftHydratedRef = useRef(false);
  const draftSaveTimerRef = useRef<number | null>(null);
  const plusResumeStartedRef = useRef(false);
  const submitOfferRef = useRef<(redemption: PublicationRedemption) => Promise<void>>(async () => {});

  const updateData = (newData: any) => setData((prev: any) => ({ ...prev, ...newData }));
  const strictCities = locationCatalog.strictCities || [];
  const canonicalFormCity = canonicalizeCity(data.city) || String(data.city || "").trim();
  const districtOptions = locationCatalog.strictCityDistricts[canonicalFormCity] || [];
  const isStrictCityForm = isStrictCity(canonicalFormCity);
  const finalImages = imagesList.filter((img) => typeof img === 'string' && img.length > 0);
  const finalFloorPlan = floorPlan;

  useEffect(() => {
    if (typeof window === "undefined" || draftHydratedRef.current) return;
    try {
      const raw = window.localStorage.getItem(ADD_OFFER_DRAFT_KEY);
      if (!raw) {
        draftHydratedRef.current = true;
        return;
      }
      const parsed = JSON.parse(raw) as {
        version?: number;
        data?: Record<string, unknown>;
        currentStep?: number;
        images?: string[];
        floorPlan?: string | null;
      };
      if (!parsed || (parsed.version !== 1 && parsed.version !== ADD_OFFER_DRAFT_VERSION)) {
        draftHydratedRef.current = true;
        return;
      }
      const persistedData = parsed.data || {};
      setData((prev: any) => ({
        ...prev,
        ...persistedData,
        // świeże dane sesji użytkownika mają priorytet nad draftem
        contactName: initialUser?.name || (persistedData.contactName as string) || prev.contactName,
        contactPhone: initialUser?.phone || (persistedData.contactPhone as string) || prev.contactPhone,
        email: initialUser?.email || (persistedData.email as string) || prev.email,
      }));
      const safeStep = Number(parsed.currentStep || 1);
      setCurrentStep(Number.isFinite(safeStep) ? Math.min(6, Math.max(1, safeStep)) : 1);
      const persistedImages = Array.isArray(parsed.images) ? parsed.images.filter((v) => typeof v === "string" && v.trim()) : [];
      if (persistedImages.length > 0) setImagesList(persistedImages);
      const persistedFloorPlan = typeof parsed.floorPlan === "string" ? parsed.floorPlan : null;
      if (persistedFloorPlan) setFloorPlan(persistedFloorPlan);
    } catch {
      // ignore draft parsing errors
    } finally {
      draftHydratedRef.current = true;
    }
  }, [initialUser?.email, initialUser?.name, initialUser?.phone]);
  useEffect(() => {
    if (!crmSellerPrefill) return;
    setData((prev: any) => ({
      ...prev,
      transactionType: crmSellerPrefill.transactionType || prev.transactionType,
      propertyType: crmSellerPrefill.propertyType || prev.propertyType,
      city: crmSellerPrefill.city || prev.city,
      district: crmSellerPrefill.district || prev.district,
      price: crmSellerPrefill.price ? String(crmSellerPrefill.price) : prev.price,
      area: crmSellerPrefill.area ? String(crmSellerPrefill.area) : prev.area,
      rooms: crmSellerPrefill.rooms ? String(crmSellerPrefill.rooms) : prev.rooms,
      description: crmSellerPrefill.description || prev.description,
      title: crmSellerPrefill.titleHint || prev.title,
    }));
  }, [crmSellerPrefill]);



  const isAgencyAdvertiser = useMemo(() => {
    if (isLoggedIn) return isAgentOrAgencySeller(initialUser);
    return data.advertiserType === "agency";
  }, [initialUser, data.advertiserType]);

  useEffect(() => {
    if (!isLoggedIn) return;
    const role = String(initialUser.role || "").toUpperCase();
    const company = String(initialUser.companyName || "").trim();
    if (role !== "AGENT" && !company) return;
    setData((prev: any) => ({
      ...prev,
      advertiserType: "agency",
      agencyName: company || prev.agencyName || "",
    }));
  }, [isLoggedIn, initialUser?.role, initialUser?.companyName]);

  useEffect(() => {
    if (typeof window === "undefined" || !draftHydratedRef.current) return;
    if (draftSaveTimerRef.current) window.clearTimeout(draftSaveTimerRef.current);
    draftSaveTimerRef.current = window.setTimeout(() => {
      try {
        const persistableImages = imagesList.filter((img) => typeof img === "string" && !img.startsWith("blob:"));
        const persistableFloorPlan = floorPlan && !floorPlan.startsWith("blob:") ? floorPlan : null;
        const existingDraft = readAddOfferDraft();
        patchAddOfferDraft({
          data,
          currentStep,
          images: persistableImages,
          floorPlan: persistableFloorPlan,
          pendingOfferId: existingDraft?.pendingOfferId ?? null,
        });
      } catch {
        // ignore storage errors
      }
    }, 250);
    return () => {
      if (draftSaveTimerRef.current) window.clearTimeout(draftSaveTimerRef.current);
    };
  }, [data, currentStep, imagesList, floorPlan]);

  const pickDistrictFromText = (city: string, text: string, allowedDistricts?: string[]) => {
    if (!city || !text) return "";
    const candidates = (allowedDistricts && allowedDistricts.length > 0)
      ? allowedDistricts
      : (locationCatalog.strictCityDistricts[city] || []);
    if (!candidates.length) return "";
    const source = normalizeText(text);
    if (!source) return "";
    for (const district of candidates) {
      const nd = normalizeText(district);
      if (!nd) continue;
      if (source.includes(nd)) {
        return district;
      }
    }
    return "";
  };

  const handleAddressSearch = async (value: string) => {
    const parsed = parseAddressSearchQuery(value);
    const trimmed = value.trim();
    if (trimmed.length < 3) {
      updateData({ address: value, city: "", district: "", lat: null, lng: null, street: "" });
      setAddressSuggestions([]);
      setAddressError("");
      return;
    }

    const patch: Record<string, unknown> = { address: value };
    if (parsed.cityPart && value.includes(",")) {
      patch.city = parsed.cityPart;
    }
    updateData(patch);
    setAddressError("");

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!value || value.trim().length < 3 || !token) {
      setAddressSuggestions([]);
      return;
    }

    const cityHintRaw = parsed.cityPart || data.city;
    const cityHint = isAdministrativeAreaLabel(cityHintRaw) ? "" : cityHintRaw;
    const searchText = parsed.fullQuery || buildForwardGeocodeSearchText(parsed.streetPart || value, cityHint || parsed.cityPart, parsed.countryIso || undefined);

    try {
      const res = await fetch(
        mapboxForwardGeocodeUrl(searchText, token, { limit: 8, autocomplete: true, cityHint }),
      );
      const geo = await res.json();
      setAddressSuggestions(Array.isArray(geo?.features) ? geo.features : []);
    } catch {
      setAddressSuggestions([]);
    }
  };

  const geocodeAddressFromInput = async (force = false, rawQuery?: string) => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    const query = String(rawQuery ?? data.address ?? "").trim();
    if (!token || query.length < 3) return;
    if (!force && query === lastGeocodedAddressRef.current) return;

    const parsed = parseAddressSearchQuery(query);
    const cityHintRaw = parsed.cityPart || data.city;
    const cityHint = isAdministrativeAreaLabel(cityHintRaw) ? parsed.cityPart || "" : cityHintRaw;

    if (force && addressSuggestions.length > 0) {
      const feature = pickBestGeocodeFeature(addressSuggestions, query, cityHint);
      if (feature) {
        setIsGeocoding(false);
        setAddressError("");
        selectAddress(feature, parsed.cityPart || cityHint || undefined);
        return;
      }
    }

    setIsGeocoding(true);
    const searchText = parsed.fullQuery || buildForwardGeocodeSearchText(parsed.streetPart || query, cityHint, parsed.countryIso || undefined);

    try {
      const res = await fetch(
        mapboxForwardGeocodeUrl(searchText, token, { limit: 8, autocomplete: false, cityHint }),
      );
      if (!res.ok) return;
      const geo = await res.json();
      const features = Array.isArray(geo?.features) ? geo.features : [];
      const feature = pickBestGeocodeFeature(features, query, cityHint);
      if (!feature) {
        if (!query.includes(",") && !cityHint) {
          setAddressError(ao.geocodeCityHint);
        } else {
          setAddressError(ao.pinError);
        }
        return;
      }
      lastGeocodedAddressRef.current = query;
      setAddressError("");
      selectAddress(feature, parsed.cityPart || cityHint || undefined);
    } catch {
      // no-op
    } finally {
      setIsGeocoding(false);
    }
  };

  const resolveLocationFromCoordinates = useCallback(
    async (lat: number, lng: number, fallbackAddress?: string, preferredCity?: string) => {
      try {
        const response = await fetch(`/api/location/reverse?lat=${lat}&lng=${lng}`, { cache: "no-store" });
        if (!response.ok) return;
        const reverse = await response.json();

        let countryCode = String(reverse.countryCode || "").trim().toUpperCase();
        let countryName = String(reverse.country || "").trim();
        if (!countryCode || (countryCode === "PL" && !isCoordinatesInPoland(lat, lng))) {
          const inferred = await inferCountryFromCoordinates(lat, lng);
          countryCode = inferred.localityCountryCode;
          countryName = inferred.localityCountry;
        }
        if (countryCode && !countryName) {
          countryName = countryLabelFromIso(countryCode);
        }

        setData((prev: any) => {
          const reverseCity = canonicalizeCity(reverse.city || "") || String(reverse.city || "").trim();
          let preferred = canonicalizeCity(preferredCity || "") || String(preferredCity || "").trim();
          const fallbackStreetToken = normalizeText(
            String(fallbackAddress || "").split(/\s+\d/)[0] || "",
          );
          if (preferred && fallbackStreetToken && normalizeText(preferred) === fallbackStreetToken) {
            preferred = "";
          }
          const fromPin = !fallbackAddress;
          const nextCity = fromPin
            ? reverseCity || preferred || prev.city
            : preferred || reverseCity || prev.city;
          const reverseStreet = String(reverse.street || "").trim();
          const fallback = String(fallbackAddress || "").trim();
          const prevStreet = String(prev.address || "").split(",")[0]?.trim() || "";
          const preserveUserStreet =
            Boolean(fallback && /\d/.test(fallback)) &&
            Boolean(reverseStreet) &&
            normalizeText(reverseStreet) !== normalizeText(fallback);
          const streetLine = fromPin
            ? reverseStreet || String(reverse.addressLabel || "").split(",")[0]?.trim() || prevStreet
            : preserveUserStreet
              ? fallback
              : reverseStreet || fallback || prevStreet;
          const nextDistrict = reverse.strictCity
            ? String(reverse.district || "").trim() ||
              resolveStrictDistrictForForm(nextCity, lat, lng, [
                String(prev.district || "").trim(),
              ])
            : sanitizeNonStrictAreaLabel(
                String(reverse.district || prev.district || "").trim(),
                nextCity,
                streetLine,
              );

          return {
            ...prev,
            lat,
            lng,
            city: nextCity,
            district: nextDistrict,
            address: streetLine,
            street: streetLine,
            localityCountry: countryName || prev.localityCountry,
            localityCountryCode: countryCode || prev.localityCountryCode,
          };
        });
      } catch {
        // no-op, manual selection still available
      }
    },
    [],
  );

  const handleUseMyLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      window.alert(ao.myLocationUnsupported);
      return;
    }
    setLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        setData((prev: any) => ({ ...prev, lat, lng }));
        void resolveLocationFromCoordinates(lat, lng, String(data.address || "").trim() || undefined);
        setLocatingUser(false);
      },
      () => {
        setLocatingUser(false);
        window.alert(ao.myLocationDenied);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }, [ao.myLocationDenied, ao.myLocationUnsupported, data.address, resolveLocationFromCoordinates]);

  const selectAddress = (feature: any, cityOverride?: string) => {
    const userQuery = String(data.address || "").trim();
    const coords = feature?.center;
    const nextLng = Array.isArray(coords) ? Number(coords[0]) : data.lng;
    const nextLat = Array.isArray(coords) ? Number(coords[1]) : data.lat;
    const shortStreet = formatShortStreetFromMapboxFeature(feature, userQuery);

    const parsed = parseAddressSearchQuery(userQuery);
    const cityFromFeature = inferCityFromMapboxFeature(feature);
    const isAddress = isStreetAddressMapboxFeature(feature);
    const explicitCityRaw = userQuery.includes(",")
      ? parsed.cityPart
      : isAdministrativeAreaLabel(cityOverride || "")
        ? ""
        : String(cityOverride || "").trim();
    const overrideCanon =
      canonicalizeCity(isAdministrativeAreaLabel(explicitCityRaw) ? "" : explicitCityRaw) ||
      (explicitCityRaw && !isAdministrativeAreaLabel(explicitCityRaw) ? explicitCityRaw : "");
    const villageFromQuery = extractVillageLocalityHint(userQuery, feature);
    let cityCanon = isAddress
      ? canonicalizeCity(cityFromFeature) ||
        overrideCanon ||
        canonicalizeCity(data.city) ||
        data.city
      : overrideCanon ||
        (villageFromQuery && !isStrictCity(cityFromFeature) ? villageFromQuery : "") ||
        canonicalizeCity(cityFromFeature) ||
        canonicalizeCity(data.city) ||
        data.city;
    if (
      villageFromQuery &&
      isStandaloneVillageAddress(userQuery, villageFromQuery) &&
      normalizeText(villageFromQuery) !== normalizeText(String(cityCanon || ""))
    ) {
      cityCanon = villageFromQuery;
    }
    const strict = isStrictCity(cityCanon);
    const districtGuessByContext = strict ? inferStrictDistrictFromMapboxFeature(cityCanon, feature) : "";
    const districtGuessByLabel = strict
      ? pickDistrictFromText(cityCanon, feature?.place_name_pl || feature?.place_name || "")
      : "";
    const areaGuess = strict ? "" : inferAreaLabelFromMapboxFeature(cityCanon, feature);
    const districtGuess = districtGuessByContext || districtGuessByLabel || areaGuess;
    let nextDistrictValue = strict
      ? districtGuess
      : sanitizeNonStrictAreaLabel(districtGuess, cityCanon, shortStreet);

    if (strict && nextLat && nextLng) {
      nextDistrictValue =
        resolveStrictDistrictForForm(cityCanon, nextLat, nextLng, [
          nextDistrictValue,
          districtGuessByContext,
          districtGuessByLabel,
        ]) || nextDistrictValue;
    }

    lastGeocodedAddressRef.current = shortStreet;
    const { country, countryCode } = extractCountryFromMapboxFeature(feature);
    updateData({
      address: shortStreet,
      street: shortStreet,
      lng: nextLng,
      lat: nextLat,
      ...(cityCanon ? { city: cityCanon } : {}),
      district: nextDistrictValue,
      ...(countryCode
        ? {
            localityCountry: country || countryLabelFromIso(countryCode),
            localityCountryCode: countryCode,
          }
        : {}),
    });
    setAddressSuggestions([]);
    setAddressError("");

    if (nextLat && nextLng) {
      void resolveLocationFromCoordinates(nextLat, nextLng, shortStreet, cityCanon);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const currentSize = files.reduce((acc, file) => acc + file.size, 0) / (1024 * 1024);
    setTotalSizeMB((prev) => prev + currentSize);

    const nextUrls = files.map((file) => URL.createObjectURL(file));
    const nextMap: { [key: string]: File } = {};
    const nextStats: { [key: string]: { progress: number; error: boolean; sizeMB: number } } = {};

    nextUrls.forEach((url, index) => {
      nextMap[url] = files[index];
      nextStats[url] = { progress: 100, error: false, sizeMB: +(files[index].size / (1024 * 1024)).toFixed(2) };
    });

    setFilesMap((prev) => ({ ...prev, ...nextMap }));
    setUploadStats((prev) => ({ ...prev, ...nextStats }));
    setImagesList((prev) => [...prev, ...nextUrls]);
    e.target.value = '';
  };

  const handleRemoveImage = (idx: number) => {
    setImagesList((prev) => {
      const toRemove = prev[idx];
      if (toRemove?.startsWith('blob:')) URL.revokeObjectURL(toRemove);
      const next = prev.filter((_, i) => i !== idx);
      return next;
    });
  };

  const handleFloorPlanUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setFloorPlan(url);
    setFloorPlanFile(file);
    e.target.value = '';
  };

  const execCommand = (command: string) => {
    if (typeof document === 'undefined') return;
    document.execCommand(command, false);
  };

  const handleGenerateAI = async () => {
    const hasBasics =
      String(data.propertyType || "").trim() ||
      String(data.city || "").trim() ||
      String(data.area || "").trim() ||
      String(data.price || "").trim();
    if (!hasBasics) {
      alert(ao.aiGenInsufficientData);
      return;
    }

    setIsGeneratingAI(true);
    try {
      const res = await fetch("/api/user/offers/description/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(buildDescriptionDraftFromForm(data, locale, AMENITIES)),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload?.success || !String(payload?.description || "").trim()) {
        throw new Error(String(payload?.error || ao.aiGenFailed));
      }
      const html = plainTextToEditorHtml(String(payload.description).trim());
      updateData({ description: html });
      if (editorRef.current) editorRef.current.innerHTML = html;
    } catch (err) {
      alert(err instanceof Error ? err.message : ao.aiGenFailed);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const normalized = e.target.value.replace(/[^\d+ ]/g, '');
    updateData({ contactPhone: normalized });
    const digits = normalized.replace(/\D/g, '');
    setPhoneStatus(digits.length >= 9 ? 'available' : 'invalid');
  };

  const getAmenityPatch = (amenityId: string, selected: boolean) => {
    const entry = OFFER_AMENITY_DEFS.find((a) => a.id === amenityId);
    if (entry?.field) return { [entry.field]: selected };
    return {};
  };

  useEffect(() => {
    if (!data.email) {
      setEmailStatus('idle');
      return;
    }
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email);
    setEmailStatus(ok ? 'available' : 'invalid');
  }, [data.email]);

  useEffect(() => {
    const loadDistrictCatalog = async () => {
      try {
        const response = await fetch('/api/location/districts', { cache: 'no-store' });
        if (!response.ok) return;
        const catalog = await response.json();
        setLocationCatalog(catalog);
      } catch {
        // fallback to manual text flow
      }
    };

    void loadDistrictCatalog();
  }, []);

  useEffect(() => {
    if (currentStep !== 2) {
      if (mapInstance.current) {
        markerRef.current?.remove();
        markerRef.current = null;
        if (orbitFrameRef.current) cancelAnimationFrame(orbitFrameRef.current);
        if (orbitTimeoutRef.current) window.clearTimeout(orbitTimeoutRef.current);
        orbitFrameRef.current = null;
        orbitTimeoutRef.current = null;
        try {
          mapInstance.current.remove();
        } catch {
          /* Mapbox może rzucić przy drugim remove */
        }
        mapInstance.current = null;
      }
      return;
    }

    if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
      setAddressError(ao.mapTokenMissing);
      return;
    }

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    let bootAttempts = 0;
    let outerRaf = 0;
    let innerRaf = 0;

    const teardown = () => {
      markerRef.current?.remove();
      markerRef.current = null;
      if (orbitFrameRef.current) cancelAnimationFrame(orbitFrameRef.current);
      if (orbitTimeoutRef.current) window.clearTimeout(orbitTimeoutRef.current);
      orbitFrameRef.current = null;
      orbitTimeoutRef.current = null;
      resizeObserver?.disconnect();
      resizeObserver = null;
      const existing = mapInstance.current;
      if (existing) {
        try {
          existing.remove();
        } catch {
          /* ignore */
        }
        mapInstance.current = null;
      }
    };

    const boot = () => {
      if (cancelled || mapInstance.current) return;
      const el = mapContainerRef.current;
      bootAttempts += 1;
      if (!el || el.clientWidth < 32 || el.clientHeight < 32) {
        if (bootAttempts < 120) {
          innerRaf = requestAnimationFrame(boot);
        }
        return;
      }

      if (cancelled || mapInstance.current) return;

      const map = new mapboxgl.Map({
        container: el,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [
          Number(data.lng) || 19.1451,
          Number(data.lat) || 51.9194,
        ],
        zoom: data.lat && data.lng ? 12.5 : 6.2,
        pitch: 55,
        bearing: -20,
        antialias: true,
        attributionControl: false,
      });

      mapInstance.current = map;
      map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");

      map.on("style.load", () => {
        map.setFog({
          range: [0.8, 8],
          color: "#0f172a",
          "high-color": "#1e293b",
          "space-color": "#000000",
          "star-intensity": 0.08,
        } as any);

        const layers = map.getStyle().layers || [];
        const labelLayerId = layers.find((l) => l.type === "symbol" && (l.layout as any)?.["text-field"])?.id;

        if (!map.getLayer("estateos-3d-buildings")) {
          try {
            map.addLayer(
              {
                id: "estateos-3d-buildings",
                source: "composite",
                "source-layer": "building",
                filter: ["==", "extrude", "true"],
                type: "fill-extrusion",
                minzoom: 13,
                paint: {
                  "fill-extrusion-color": "#1e293b",
                  "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 13, 0, 16, ["get", "height"]],
                  "fill-extrusion-base": ["interpolate", ["linear"], ["zoom"], 13, 0, 16, ["get", "min_height"]],
                  "fill-extrusion-opacity": 0.82,
                },
              } as any,
              labelLayerId,
            );
          } catch {
            /* brak warstwy building w danym stylu */
          }
        }
      });

      map.on("load", () => {
        map.resize();
      });

      resizeObserver = new ResizeObserver(() => {
        mapInstance.current?.resize();
      });
      resizeObserver.observe(el);

      map.on("click", (e) => {
        const nextLng = +e.lngLat.lng.toFixed(6);
        const nextLat = +e.lngLat.lat.toFixed(6);
        setData((prev: any) => ({ ...prev, lng: nextLng, lat: nextLat }));
        void resolveLocationFromCoordinates(nextLat, nextLng);
      });
    };

    outerRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(boot);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(outerRaf);
      cancelAnimationFrame(innerRaf);
      teardown();
    };
  }, [currentStep, resolveLocationFromCoordinates]);

  const startLuxuryOrbit = (target: [number, number]) => {
    const map = mapInstance.current;
    if (!map) return;
    if (orbitFrameRef.current) cancelAnimationFrame(orbitFrameRef.current);
    if (orbitTimeoutRef.current) window.clearTimeout(orbitTimeoutRef.current);

    const start = performance.now();
    const durationMs = 5200;
    const initialBearing = map.getBearing();

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const bearing = initialBearing + eased * 360;

      map.easeTo({
        center: target,
        bearing,
        pitch: 68,
        zoom: 16.2,
        duration: 120,
        easing: (x) => x,
      });

      if (t < 1) orbitFrameRef.current = requestAnimationFrame(tick);
    };

    orbitFrameRef.current = requestAnimationFrame(tick);
    orbitTimeoutRef.current = window.setTimeout(() => {
      map.easeTo({
        center: target,
        zoom: 15.4,
        pitch: 60,
        duration: 900,
      });
    }, durationMs + 80);
  };

  useEffect(() => {
    if (!mapInstance.current || !data.lat || !data.lng) return;
    const lngLat: [number, number] = [Number(data.lng), Number(data.lat)];

    if (!markerRef.current) {
      const marker = new mapboxgl.Marker({ color: "#10b981", draggable: true })
        .setLngLat(lngLat)
        .addTo(mapInstance.current);
      marker.on("dragend", () => {
        const pos = marker.getLngLat();
        const nextLat = +pos.lat.toFixed(6);
        const nextLng = +pos.lng.toFixed(6);
        setData((prev: any) => ({ ...prev, lat: nextLat, lng: nextLng }));
        void resolveLocationFromCoordinates(nextLat, nextLng);
      });
      markerRef.current = marker;
    } else {
      markerRef.current.setLngLat(lngLat);
    }

    mapInstance.current.flyTo({
      center: lngLat,
      zoom: 16,
      pitch: 68,
      bearing: mapInstance.current.getBearing() + 20,
      speed: 0.6,
      curve: 1.5,
      essential: true,
    });
    startLuxuryOrbit(lngLat);
  }, [data.lat, data.lng]);

  useEffect(() => {
    if (currentStep !== 2 || !mapInstance.current) return;
    const id = window.setTimeout(() => {
      mapInstance.current?.resize();
      if (data.lat && data.lng) {
        mapInstance.current?.easeTo({
          center: [Number(data.lng), Number(data.lat)],
          zoom: 14.8,
          pitch: 62,
          duration: 700,
        });
      }
    }, 120);
    return () => window.clearTimeout(id);
  }, [currentStep, data.lat, data.lng]);

  const publishAfterAuth = async () => {
    const checkRes = await fetch("/api/auth/check", { cache: "no-store", credentials: "include" });
    const check = await checkRes.json().catch(() => ({}));
    if (!check?.loggedIn || !check?.user?.id) {
      throw new Error("Logowanie nie powiodło się — spróbuj ponownie.");
    }

    setActiveUser({
      isLoggedIn: true,
      id: check.user.id,
      name: check.user.name,
      email: check.user.email,
      phone: check.user.phone,
      role: check.user.role,
      isEmailVerified: check.user.isEmailVerified,
      isVerifiedPhone: check.user.isVerifiedPhone,
    });

    const walletRes = await fetch(`/api/user/publication-wallet?locale=${locale}`, { cache: "no-store", credentials: "include" });
    const walletData = await walletRes.json().catch(() => ({}));
    if (!walletRes.ok || !walletData?.success) {
      throw new Error(String(walletData?.error || walletData?.message || ao.walletFetchFailed));
    }

    const coupons = Array.isArray(walletData.publicationCoupons)
      ? walletData.publicationCoupons
      : Array.isArray(walletData.coupons)
        ? walletData.coupons
        : [];
    const selection = defaultPublicationSelection({
      couponIds: coupons.map((c: PublicationCouponOption) => c.id),
      hasPlusCredit: Boolean(walletData.hasPlusCredit),
    });

    setAuthGateOpen(false);
    const resolved = publicationSelectionToRedemption(selection);
    if ("action" in resolved && resolved.action === "buy_plus") {
      await handlePlusPayment();
      return;
    }
    await submitOfferWithRedemption(resolved as PublicationRedemption);
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (isLoggedIn && !publishContactOk) {
      setActionModal('verify');
      return;
    }
    if (!canPublish) return;
    if (!isLoggedIn) {
      setAuthGateOpen(true);
      return;
    }
    if (isLoggedIn) {
      if (!publicationSelection) {
        setServerErrorMessage(ao.selectPublicationMethod);
        setActionModal('error');
        return;
      }
      const resolved = publicationSelectionToRedemption(publicationSelection);
      if ('action' in resolved && resolved.action === 'buy_plus') {
        await handlePlusPayment();
        return;
      }
      await submitOfferWithRedemption(resolved as PublicationRedemption);
    }
  };

  const [isProcessingPlus, setIsProcessingPlus] = useState(false);
  const handlePlusPayment = async () => {
    if (isLoggedIn && !publishContactOk) {
      setActionModal('verify');
      return;
    }
    setIsProcessingPlus(true);
    try {
      await startPakietPlusCheckout();
    } catch (error) {
      setServerErrorMessage(error instanceof Error ? error.message : ao.stripePaymentError);
      setErrorFieldTarget(null);
      setActionModal("error");
    } finally {
      setIsProcessingPlus(false);
    }
  };

  const submitOfferWithRedemption = async (redemption: PublicationRedemption) => {
    if (isSubmitting) return;
    if (addressMentionsOtherCity(data.address, data.city)) {
      setServerErrorMessage(ao.addressFormMismatch);
      setErrorFieldTarget(null);
      setActionModal('error');
      return;
    }
    setIsSubmitting(true);
    setUploadProgress(ao.progressCreatingOffer);
    try {
      const draft = readAddOfferDraft();
      const resume = await resolvePendingOfferForPublish(draft?.pendingOfferId);
      if (resume.mode === "already_submitted") {
        clearAddOfferDraft();
        setActionModal("success");
        return;
      }

      const { payload } = buildOfferPayload();
      if (!isPolishLocality(data.localityCountryCode)) {
        payload.apartmentNumber = "";
        payload.landRegistryNumber = "";
      }
      if (!applyAgentCommissionToPayload(payload)) return;

      let offerId = resume.mode === "reuse" ? resume.offerId : null;

      if (offerId) {
        const updateRes = await fetch(`/api/offers/${offerId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        const updateData = await updateRes.json().catch(() => ({}));
        if (!updateRes.ok) {
          const serverMessage = updateData.error || updateData.message || ao.createOfferFailed;
          setServerErrorMessage(serverMessage);
          setErrorFieldTarget(resolveErrorFieldTarget(serverMessage));
          setActionModal("error");
          return;
        }
      } else {
        const createRes = await fetch('/api/offers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
        const createData = await createRes.json().catch(() => ({}));
        if (!createRes.ok) {
          const serverMessage = createData.error || createData.message || ao.createOfferFailed;
          setServerErrorMessage(serverMessage);
          setErrorFieldTarget(resolveErrorFieldTarget(serverMessage));
          setActionModal("error");
          return;
        }
        offerId = Number(createData?.offer?.id || createData?.id);
        if (!Number.isFinite(offerId) || offerId <= 0) {
          setServerErrorMessage(ao.createOfferNoId);
          setActionModal('error');
          return;
        }
        patchAddOfferDraft({ pendingOfferId: offerId });
      }

      const createdOfferId = offerId as number;
      const uploadableImages = finalImages.filter((img) => filesMap[img]);
      for (let i = 0; i < uploadableImages.length; i++) {
        const blobKey = uploadableImages[i];
        const file = filesMap[blobKey];
        if (!file) continue;
        setUploadProgress(
          ao.progressUploadingPhoto
            .replace("{current}", String(i + 1))
            .replace("{total}", String(uploadableImages.length)),
        );
        const formData = new FormData();
        formData.append('offerId', String(createdOfferId));
        formData.append('file', file);
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });
        if (!uploadRes.ok) throw new Error(ao.photoUploadFailed.replace("{n}", String(i + 1)));
      }
      if (floorPlanFile) {
        setUploadProgress(ao.progressUploadingFloorPlan);
        const fpFormData = new FormData();
        fpFormData.append('offerId', String(createdOfferId));
        fpFormData.append('file', floorPlanFile);
        fpFormData.append('isFloorPlan', 'true');
        const fpRes = await fetch('/api/upload', {
          method: 'POST',
          body: fpFormData,
          credentials: 'include',
        });
        if (!fpRes.ok) throw new Error(ao.floorPlanUploadError);
      }
      const activationRes = await fetch(`/api/offers/${createdOfferId}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ publication: redemption }),
      });
      const activationData = await activationRes.json().catch(() => ({}));
      if (!activationRes.ok) {
        patchAddOfferDraft({ pendingOfferId: createdOfferId });
        if (activationData?.errorCode === 'PUBLICATION_REQUIRES_PLUS') {
          setServerErrorMessage(activationData?.message || ao.plusPackageRequired);
          setActionModal('limit');
        } else {
          setServerErrorMessage(activationData?.error || activationData?.message || ao.activationFailed);
          setActionModal('error');
        }
        return;
      }
      clearAddOfferDraft();
      setActionModal('success');
    } catch {
      setServerErrorMessage(ao.apiConnectionError);
      setActionModal('error');
    } finally {
      setIsSubmitting(false);
      setUploadProgress('');
    }
  };
  submitOfferRef.current = submitOfferWithRedemption;

  // --- Żelazna Walidacja Kroków ---
  const isTypeSelected = !!data.propertyType;
  
  const hasBuildingNumber = /\d/.test((data.address || '').split(',')[0]);
  const locationAddressConflict = addressMentionsOtherCity(data.address, data.city);
  const locationDisplayLine = formatOfferLocationLine({
    address: data.address,
    street: data.street,
    city: data.city,
    district: data.district,
  });
  const hasGeocodedLocation =
    Number.isFinite(Number(data.lat)) && Number.isFinite(Number(data.lng));
  const showLocationMeta = (data.address || "").trim().length >= 3 && hasGeocodedLocation;
  const showStrictCityDistrict = showLocationMeta && isStrictCityForm;
  const showRestLocality = showLocationMeta && !isStrictCityForm;
  const restLocalityLabel = String(data.city || "").trim();
  const restAreaLabel = sanitizeNonStrictAreaLabel(data.district, data.city, data.street || data.address);
  const localityCountryFlag = flagEmojiFromIso2(data.localityCountryCode || "PL");
  const countryDisplayLocale: "pl" | "en" = locale === "en" || locale === "uk" ? "en" : "pl";
  const localityCountryLabel = data.localityCountryCode
    ? countryLabelForLocale(String(data.localityCountryCode), countryDisplayLocale)
    : String(data.localityCountry || countryLabelForLocale("PL", countryDisplayLocale)).trim();
  const isPolishOfferLocation = isPolishLocality(data.localityCountryCode);
  const districtRequirementMet = isStrictCityForm ? !!data.district : true;
  const normalizedLandRegistryNumber = normalizeLandRegistryInput(String(data.landRegistryNumber || ""));
  const hasLandRegistryInput = normalizedLandRegistryNumber.length > 0;
  const landRegistryValid =
    !isPolishOfferLocation ||
    !hasLandRegistryInput ||
    isValidLandRegistryNumber(normalizedLandRegistryNumber);
  const isLocationDone =
    !!data.lat &&
    !!data.lng &&
    !!data.city &&
    districtRequirementMet &&
    !addressError &&
    hasBuildingNumber &&
    !locationAddressConflict &&
    landRegistryValid;

  const propertyTypeLabel = PROPERTY_TYPES.find((t) => t.id === data.propertyType)?.label;
  const conditionLabel = CONDITION_TYPES.find((c) => c.id === data.condition)?.label;
  
  const cleanPrice = String(data.price || '').replace(/\D/g, "");
  const cleanArea = String(data.area || '').replace(/[^0-9.]/g, "");
  const isFinanceDone = isLocationDone && cleanPrice.length > 0 && cleanArea.length > 0;
  
  const requiresPlot = ['HOUSE', 'PLOT'].includes(data.propertyType);
  const isParameterSetDone =
    data.propertyType === 'PLOT'
      ? !!data.area && !!data.plotArea
      : data.propertyType === 'HOUSE'
        ? !!data.area && !!data.plotArea && !!data.rooms && !!data.floor && !!data.buildYear
        : !!data.area && !!data.rooms && !!data.floor && !!data.buildYear;
  const isTechDone = isFinanceDone && isParameterSetDone;
  
  const descriptionText = String(data.description || '').replace(/<[^>]*>/g, '').trim();
  const isMediaDone = isTechDone && imagesList.length > 0 && String(data.title || '').trim().length >= 10 && descriptionText.length >= 10;
  
  const isContactDone = isLoggedIn ? true : (
    !!data.email && emailStatus === 'available' &&
    !!data.contactPhone && phoneStatus === 'available' &&
    !!data.contactName && !!data.password && data.password.length >= 6 &&
    (data.advertiserType === 'private' || (data.advertiserType === 'agency' && !!data.agencyName))
  );

  const publishContactOk =
    !isLoggedIn ||
    (Boolean(activeUser?.isEmailVerified) && Boolean(activeUser?.isVerifiedPhone));

  const canPublish =
    isTypeSelected &&
    isLocationDone &&
    isFinanceDone &&
    isTechDone &&
    isMediaDone &&
    (isLoggedIn ? publishContactOk && Boolean(publicationSelection) : true);
  const totalSteps = 5;
  const isStep1Done = isTypeSelected && (data.propertyType === 'PLOT' || !!data.condition);
  const isStep2Done = isLocationDone;
  const isStep3Done = isTechDone;
  const isStep4Done = isMediaDone;
  const isStep5Done = isLoggedIn ? Boolean(publicationSelection) && publishContactOk : isMediaDone;

  const canAdvanceStep = (step: number) => {
    if (step === 1) return isStep1Done;
    if (step === 2) return isStep2Done;
    if (step === 3) return isStep3Done;
    if (step === 4) return isStep4Done;
    return true;
  };

  const isStepDone = (step: number) => {
    if (step === 1) return isStep1Done;
    if (step === 2) return isStep2Done;
    if (step === 3) return isStep3Done;
    if (step === 4) return isStep4Done;
    if (step === totalSteps) return canPublish;
    return true;
  };

  const stepNeedsFix = (step: number) => {
    if (isStepDone(step)) return false;
    return currentStep > step || currentStep === totalSteps;
  };

  const stepNavItems = useMemo(() => {
    const items = [
      { step: 1, label: ao.stepNavShort1 },
      { step: 2, label: ao.stepNavShort2 },
      { step: 3, label: ao.stepNavShort3 },
      { step: 4, label: ao.stepNavShort4 },
      { step: totalSteps, label: ao.stepNavPublish },
    ];
    return items;
  }, [ao.stepNavShort1, ao.stepNavShort2, ao.stepNavShort3, ao.stepNavShort4, ao.stepNavPublish, totalSteps]);

  const focusFieldTarget = (target: FormFieldTarget) => {
    if (!target) return;
    const byTarget: Record<Exclude<FormFieldTarget, null>, { step: number; node: HTMLElement | null }> = {
      landRegistryNumber: { step: 2, node: landRegistryInputRef.current },
      agentCommissionPercent: { step: 3, node: agentCommissionInputRef.current },
    };
    const config = byTarget[target];
    setCurrentStep(config.step);
    window.setTimeout(() => {
      if (!config.node) return;
      config.node.scrollIntoView({ behavior: "smooth", block: "center" });
      if (target === "agentCommissionPercent") {
        const input = config.node.querySelector("input");
        if (input) (input as HTMLInputElement).focus();
      } else {
        (config.node as HTMLInputElement).focus();
      }
    }, 140);
  };

  const resolveErrorFieldTarget = (messageRaw: unknown): FormFieldTarget => {
    const message = String(messageRaw || "").toLowerCase();
    if (message.includes("księgi wieczystej") || message.includes("kw")) return "landRegistryNumber";
    if (message.includes("agentcommissionpercent") || message.includes("prowiz")) return "agentCommissionPercent";
    return null;
  };

  const applyAgentCommissionToPayload = (payload: Record<string, unknown>): boolean => {
    if (!isAgencyAdvertiser) {
      payload.agentCommissionPercent = 0;
      return true;
    }
    const raw = String(data.agentCommissionPercent ?? "").trim();
    if (!raw) {
      // Jeśli użytkownik nie poda prowizji, zapisujemy jawnie 0% (bez prowizji).
      payload.agentCommissionPercent = 0;
      return true;
    }
    const validation = validateAgentCommissionPercent(raw);
    if (!validation.ok) {
      setServerErrorMessage(validation.message);
      setErrorFieldTarget("agentCommissionPercent");
      setActionModal("error");
      return false;
    }
    payload.agentCommissionPercent = validation.value;
    return true;
  };

  const buildOfferPayload = () => {
    const cleanPriceValue = String(data.price || '').replace(/\D/g, "");
    const finalDesc = editorRef.current?.innerHTML || data.description || '';
    const dbCondition = data.propertyType === 'PLOT' ? 'NOT_APPLICABLE' : (data.condition || 'READY');
    const payload: Record<string, unknown> = {
      ...data,
      userId: activeUser?.id,
      transactionType: data.transactionType,
      propertyType: data.propertyType,
      condition: dbCondition,
      description: finalDesc,
      title: data.title || `${propertyTypeLabel || data.propertyType} - ${data.district || data.city || 'Polska'}`,
      price: cleanPriceValue,
      priceCurrency: data.priceCurrency || 'PLN',
      yearBuilt: data.buildYear ? Number(data.buildYear) : null,
      area: String(data.area).replace(',', '.'),
      adminFee:
        data.transactionType === "RENT"
          ? parseRentAdditionalFeeForApi(data.rentAdminFee)
          : String(data.rent || "").trim()
            ? Number(String(data.rent).replace(/\D/g, ""))
            : null,
      images: '[]',
      imageUrl: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=2075&auto=format&fit=crop",
      floorPlan: null,
      amenities: Array.isArray(data.amenities) ? data.amenities.join(", ") : data.amenities,
    };
    if (agencyClientId) {
      payload.agencyClientId = agencyClientId;
    }
    return { payload, finalDesc };
  };

  const loadPublicationWallet = async () => {
    setWalletLoading(true);
    try {
      const res = await fetch(`/api/user/publication-wallet?locale=${locale}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(String(data?.error || data?.message || ao.walletFetchFailed));
      }
      const coupons = Array.isArray(data.publicationCoupons)
        ? data.publicationCoupons
        : Array.isArray(data.coupons)
          ? data.coupons
          : [];
      setWalletCoupons(coupons);
      setWalletPlusCredits(Number(data.plusCredits || 0));
      setWalletHasPlusCredit(Boolean(data.hasPlusCredit));
      setWalletPlusExpiresAt(data.plusExpiresAt ? String(data.plusExpiresAt) : null);
      setPublicationSelection((prev) => {
        const couponIds = coupons.map((c: PublicationCouponOption) => c.id);
        const preferred = defaultPublicationSelection({
          couponIds,
          hasPlusCredit: Boolean(data.hasPlusCredit),
        });
        if (!prev) return preferred;
        if (couponIds.length > 0 && (prev === "buy_plus" || prev === "pay_renewal")) {
          return preferred;
        }
        if (prev.startsWith("coupon:")) {
          const id = prev.replace("coupon:", "");
          if (!couponIds.includes(id)) return preferred;
        }
        return prev;
      });
    } finally {
      setWalletLoading(false);
    }
  };

  const startPakietPlusCheckout = async () => {
    const returnUrl = `${window.location.origin}/dodaj-oferte?plus=success`;
    const cancelUrl = `${window.location.origin}/dodaj-oferte?plus=cancel`;
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'pakiet_plus', returnUrl, cancelUrl }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body?.url) {
      throw new Error(String(body?.error || ao.plusCheckoutFailed));
    }
    window.location.href = String(body.url);
  };

  const handleFixDataFromErrorModal = () => {
    setActionModal("none");
    if (errorFieldTarget) {
      focusFieldTarget(errorFieldTarget);
    }
    setErrorFieldTarget(null);
  };

  const nextStep = () => {
    if (!canAdvanceStep(currentStep)) return;
    if (isLoggedIn) {
      setCurrentStep((prev) => Math.min(5, prev + 1));
      return;
    }
    setCurrentStep((prev) => Math.min(6, prev + 1));
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };
  const stepTransition = {
    initial: { opacity: 0, y: 14, filter: 'blur(4px)' },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
    exit: { opacity: 0, y: -8, filter: 'blur(4px)' },
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  };

  const summarySections = useMemo(
    () =>
      buildAddOfferSummarySections({
        ao,
        data,
        descriptionText,
        propertyTypeLabel,
        conditionLabel,
      }),
    [ao, data, descriptionText, propertyTypeLabel, conditionLabel],
  );

  useEffect(() => {
    if (!isLoggedIn || currentStep !== totalSteps) return;
    loadPublicationWallet().catch(() => {
      // panel pokaże błąd ładowania
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, currentStep, totalSteps]);

  useEffect(() => {
    if (isPolishOfferLocation) return;
    if (!data.apartmentNumber && !data.landRegistryNumber) return;
    setData((prev: any) => ({
      ...prev,
      apartmentNumber: "",
      landRegistryNumber: "",
    }));
  }, [isPolishOfferLocation, data.apartmentNumber, data.landRegistryNumber]);

  useEffect(() => {
    if (typeof window === "undefined" || !isLoggedIn || !draftHydratedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("plus") !== "success" || plusResumeStartedRef.current) return;
    plusResumeStartedRef.current = true;
    params.delete("plus");
    const nextUrl = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
    window.history.replaceState({}, "", nextUrl);

    void (async () => {
      try {
        const walletRes = await fetch(`/api/user/publication-wallet?locale=${locale}`, {
          cache: "no-store",
          credentials: "include",
        });
        const walletData = await walletRes.json().catch(() => ({}));
        if (!walletRes.ok || !walletData?.success) return;
        const coupons = Array.isArray(walletData.publicationCoupons)
          ? walletData.publicationCoupons
          : Array.isArray(walletData.coupons)
            ? walletData.coupons
            : [];
        const selection = defaultPublicationSelection({
          couponIds: coupons.map((c: PublicationCouponOption) => c.id),
          hasPlusCredit: Boolean(walletData.hasPlusCredit),
        });
        if (selection === "buy_plus") return;
        const resolved = publicationSelectionToRedemption(selection);
        if ("action" in resolved) return;
        setPublicationSelection(selection);
        await submitOfferRef.current(resolved as PublicationRedemption);
      } catch {
        // użytkownik może opublikować ręcznie
      }
    })();
  }, [isLoggedIn, locale]);

  const publishButtonLabel = useMemo(() => {
    if (!isLoggedIn) return ao.publishFinishGuest;
    if (!publicationSelection) return ao.publishSelectMethod;
    return publicationSelectionLabel(publicationSelection, locale).toUpperCase();
  }, [isLoggedIn, publicationSelection, ao.publishFinishGuest, ao.publishSelectMethod, locale]);

  return (
    <main className="theme-aware-dashboard min-h-screen bg-[var(--eos-bg)] text-[var(--eos-text)] pt-28 pb-32 px-4 md:px-6 lg:px-8 font-sans overflow-x-hidden relative selection:bg-emerald-500/30">
      
      {/* Dynamiczne Tło */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-[#10b981]/5 to-transparent blur-[150px] pointer-events-none rounded-full" />

      <div className="max-w-4xl mx-auto relative z-10">
        <div className="text-center mb-12">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/5 border border-white/10 text-[#f5f5f7] text-xs font-bold tracking-widest mb-6 backdrop-blur-md">
            <Sparkles size={14} className="text-emerald-500" /> {ao.formBadge}
          </motion.div>
          <h1 className="text-5xl md:text-7xl font-black mb-4 tracking-tighter text-[var(--eos-text)]">
            {ao.title}{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-emerald-400">
              {ao.titleHighlight}
            </span>
          </h1>
        </div>

        <div className="sticky top-[calc(var(--eos-nav-height)+0.5rem)] z-40 mb-8 rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)]/95 px-4 py-4 shadow-[var(--eos-shadow-soft)] backdrop-blur-2xl md:px-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--eos-muted)]">
              {ao.stepLabel} {currentStep} {ao.stepOf} {totalSteps}
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-500">
              {Math.round((currentStep / totalSteps) * 100)}%
            </span>
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {stepNavItems.map((item) => {
              const active = currentStep === item.step;
              const done = isStepDone(item.step);
              const needsFix = stepNeedsFix(item.step);
              return (
                <button
                  key={item.step}
                  type="button"
                  onClick={() => setCurrentStep(item.step)}
                  title={item.label}
                  className={`min-w-[7.5rem] shrink-0 rounded-2xl border px-3 py-2.5 text-left transition-all ${
                    active
                      ? "border-emerald-500/60 bg-emerald-500/10 shadow-[0_0_18px_rgba(16,185,129,0.12)]"
                      : needsFix
                        ? "border-red-500/45 bg-red-500/10"
                        : done
                          ? "border-emerald-500/25 bg-emerald-500/5"
                          : "border-[var(--eos-border)] bg-[var(--eos-input)] hover:border-[var(--eos-border-strong)]"
                  }`}
                >
                  <span className="block text-[9px] font-black uppercase tracking-[0.14em] text-[var(--eos-subtle)]">
                    {ao.stepLabel} {item.step}
                  </span>
                  <span className="mt-0.5 block text-[11px] font-bold leading-snug text-[var(--eos-text)]">
                    {item.label}
                  </span>
                  {needsFix ? (
                    <span className="mt-1 block text-[9px] font-black uppercase tracking-[0.08em] text-red-500">
                      {ao.stepNavFixNeeded}
                    </span>
                  ) : done ? (
                    <span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.08em] text-emerald-600 dark:text-emerald-400">
                      OK
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* NOWY PRZEŁĄCZNIK KUPNO / WYNAJEM */}
        <div className={`flex justify-center mb-12 ${currentStep === 1 ? '' : 'hidden'}`}>
          <div className="bg-[#111] border border-white/10 rounded-full p-1.5 flex shadow-inner relative w-full max-w-[400px]">
             <div className={`absolute top-1.5 bottom-1.5 left-1.5 w-[calc(50%-6px)] bg-[#0a0a0a] border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.15)] rounded-full transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${data.transactionType === 'RENT' ? 'translate-x-[calc(100%+12px)]' : 'translate-x-0'}`}></div>
             
             <button type="button" onClick={() => updateData({ transactionType: 'SELL' })} className={`relative z-10 flex-1 py-3.5 text-[10px] md:text-xs font-black uppercase tracking-widest transition-colors duration-500 text-center ${data.transactionType === 'SELL' ? 'text-emerald-400' : 'text-white/40 hover:text-white/80'}`}>
               {ao.sell}
             </button>
             
             <button type="button" onClick={() => updateData({ transactionType: 'RENT' })} className={`relative z-10 flex-1 py-3.5 text-[10px] md:text-xs font-black uppercase tracking-widest transition-colors duration-500 text-center ${data.transactionType === 'RENT' ? 'text-emerald-400' : 'text-white/40 hover:text-white/80'}`}>
               {ao.rent}
             </button>
          </div>
        </div>


        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={`step-${currentStep}`} className="space-y-6" initial={stepTransition.initial} animate={stepTransition.animate} exit={stepTransition.exit} transition={stepTransition.transition}>
            
            {/* KROK 1: TOŻSAMOŚĆ I RODZAJ */}
            <section className={`${glassPanel} ${currentStep === 1 ? '' : 'hidden'} ring-1 ring-white/5`}>
              <div className="flex items-center gap-5 mb-10">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-lg transition-all duration-500 ${isTypeSelected ? 'bg-[#10b981] text-black shadow-[0_0_30px_rgba(16,185,129,0.5)] scale-110' : 'bg-white/5 text-zinc-500 border border-white/10'}`}>1</div>
                <h2 className="text-2xl font-black uppercase tracking-[0.08em] text-[var(--eos-text)]">{ao.step1Title}</h2>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {PROPERTY_TYPES.map(cat => {
                  const isActive = data.propertyType === cat.id;
                  return (
                    <button key={cat.id} onClick={() => updateData({ propertyType: cat.id, condition: cat.id === 'PLOT' ? 'NOT_APPLICABLE' : data.condition })} 
                      className={`h-36 rounded-[2rem] flex flex-col items-center justify-center gap-4 transition-all duration-400 relative overflow-hidden group ${isActive ? 'bg-[#10b981] border-2 border-emerald-400 shadow-[0_0_40px_rgba(16,185,129,0.4)] scale-[1.02]' : 'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20'}`}>
                      <cat.icon size={36} strokeWidth={1.5} className={`transition-colors duration-400 ${isActive ? 'text-black' : 'text-zinc-400 group-hover:text-white'}`} />
                      <span className={`text-[11px] font-black uppercase tracking-widest transition-colors duration-400 ${isActive ? 'text-black' : 'text-zinc-400 group-hover:text-white'}`}>{cat.label}</span>
                    </button>
                  );
                })}
              </div>

              {data.propertyType && data.propertyType !== 'PLOT' && (
                <div className="relative">
                  <label className={labelPremium}>{ao.conditionLabel}</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {CONDITION_TYPES.map((condition) => {
                      const isActive = data.condition === condition.id;
                      return (
                        <button
                          key={condition.id}
                          type="button"
                          onClick={() => updateData({ condition: condition.id })}
                          className={`py-4 rounded-2xl border font-black uppercase tracking-widest text-[10px] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
                            isActive ? "eos-chip-on" : "eos-chip-off"
                          }`}
                        >
                          {condition.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            {/* KROK 2: LOKALIZACJA I MAPA */}
            <section className={`${glassPanel} ${currentStep === 2 ? '' : 'hidden'} ring-1 ring-white/5 ${isTypeSelected ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
              <div className="flex items-center gap-5 mb-10">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-lg transition-all duration-500 ${isLocationDone ? 'bg-[#10b981] text-black shadow-[0_0_30px_rgba(16,185,129,0.5)] scale-110' : 'bg-white/5 text-zinc-500 border border-white/10'}`}>
                  {isLocationDone ? <Check size={24} /> : '2'}
                </div>
                <h2 className="text-2xl font-black uppercase tracking-[0.08em] text-[var(--eos-text)]">{ao.step2Title}</h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="space-y-8">
                  
                  <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
                    <button onClick={() => updateData({ locationType: 'exact' })} className={`flex-1 py-3 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 ${data.locationType === 'exact' ? 'bg-emerald-500 text-black shadow-md' : 'text-[var(--eos-muted)] hover:text-[var(--eos-text)]'}`}><MapPin size={16}/> {ao.locationExact}</button>
                    <button onClick={() => updateData({ locationType: 'approximate' })} className={`flex-1 py-3 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 ${data.locationType === 'approximate' ? 'bg-emerald-500 text-black shadow-md' : 'text-[var(--eos-muted)] hover:text-[var(--eos-text)]'}`}><Navigation size={16}/> {ao.locationApprox}</button>
                  </div>
                  
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-xs text-zinc-400 leading-relaxed">
                    <strong className="text-[var(--eos-text)]">{ao.locationVisibilityTitle}</strong> {ao.locationVisibilityBody}
                  </div>

                  <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/20 text-xs text-zinc-400 leading-relaxed">
                    {ao.locationInputHint}
                  </div>

                  <div className="relative z-50">
                    <label className={labelPremium}>{ao.searchAddress}</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder={ao.searchAddressPlaceholder}
                        className={`${inputPremium} pr-14`}
                        onChange={(e) => handleAddressSearch(e.target.value)}
                        onBlur={(e) => {
                          void geocodeAddressFromInput(false, e.currentTarget.value);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void geocodeAddressFromInput(true, (e.target as HTMLInputElement).value);
                          }
                        }}
                        value={data.address || ''}
                      />
                      <button
                        type="button"
                        onClick={handleUseMyLocation}
                        disabled={locatingUser}
                        title={ao.myLocationLabel}
                        aria-label={ao.myLocationLabel}
                        className="absolute right-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 transition-all hover:border-emerald-400/50 hover:bg-emerald-500/20 disabled:opacity-50"
                      >
                        {locatingUser ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <LocateFixed size={18} />
                        )}
                      </button>
                    </div>
                    {isGeocoding && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 text-[11px] font-bold text-emerald-400 flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin" /> {ao.locationGeocoding}
                      </motion.div>
                    )}
                    {data.address && !hasBuildingNumber && !isGeocoding && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 text-[11px] font-bold text-red-400 flex items-center gap-1"><AlertCircle size={14} /> {ao.buildingNumberRequired}</motion.div>
                    )}
                    {locationAddressConflict && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 text-[11px] font-bold text-red-400 flex items-center gap-1">
                        <AlertCircle size={14} /> {ao.addressCityConflict}
                      </motion.div>
                    )}
                    {addressSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1a]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl max-h-60 overflow-y-auto z-50 overflow-hidden divide-y divide-white/5">
                        {addressSuggestions.map((f, i) => (
                          <div
                            key={i}
                            onClick={() =>
                              selectAddress(
                                f,
                                data.address.includes(",")
                                  ? parseAddressSearchQuery(data.address || "").cityPart
                                  : isAdministrativeAreaLabel(data.city)
                                    ? ""
                                    : data.city,
                              )
                            }
                            className="p-4 hover:bg-[#10b981]/20 cursor-pointer text-zinc-300 hover:text-white font-medium transition-colors text-sm leading-snug"
                          >
                            {f.place_name_pl || f.place_name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <AnimatePresence>
                    {showStrictCityDistrict ? (
                      <motion.div
                        key="strict-location"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                      >
                        <div className="min-w-0">
                          <label className={labelPremium}>{ao.city}</label>
                          <select
                            className={`${inputCompact} appearance-none cursor-pointer`}
                            value={data.city || ""}
                            onChange={(e) => {
                              const newCity = e.target.value;
                              const patch: Record<string, unknown> = {
                                city: newCity,
                                district: "",
                              };
                              if (
                                data.lat != null &&
                                data.lng != null &&
                                isStrictCity(newCity)
                              ) {
                                patch.district = resolveStrictDistrictForForm(
                                  newCity,
                                  Number(data.lat),
                                  Number(data.lng),
                                  [String(data.district || "")],
                                );
                              }
                              updateData(patch);
                            }}
                          >
                            <option value="" disabled>
                              {ao.selectPlaceholder}
                            </option>
                            {strictCities.map((city) => (
                              <option key={city} value={city}>
                                {city}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="min-w-0">
                          <label className={labelPremium}>{ao.district}</label>
                          <select
                            className={`${inputCompact} appearance-none cursor-pointer`}
                            value={data.district || ""}
                            onChange={(e) => updateData({ district: e.target.value })}
                          >
                            <option value="" disabled>
                              {ao.selectPlaceholder}
                            </option>
                            {districtOptions.map((district) => (
                              <option key={district} value={district}>
                                {district}
                              </option>
                            ))}
                          </select>
                        </div>
                      </motion.div>
                    ) : null}

                    {showRestLocality ? (
                      <motion.div
                        key="rest-locality"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                      >
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-400/90 mb-1">
                            {ao.localityLabel}
                          </p>
                          <p className="text-base font-semibold text-[var(--eos-text)]">
                            {restLocalityLabel || "—"}
                          </p>
                          {restAreaLabel && restAreaLabel !== restLocalityLabel ? (
                            <p className="mt-1 text-xs text-zinc-500">
                              {ao.areaLabel}: {restAreaLabel}
                            </p>
                          ) : null}
                          <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                            {ao.localityAutoHint}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-400/90 mb-1">
                            {ao.countryLabel}
                          </p>
                          <div className="flex items-center gap-2.5">
                            <span className="text-2xl leading-none" aria-hidden>
                              {localityCountryFlag}
                            </span>
                            <p className="text-base font-semibold text-[var(--eos-text)]">
                              {localityCountryLabel}
                            </p>
                          </div>
                          <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                            {ao.countryAutoHint}
                          </p>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>

                  {showLocationMeta && data.city && data.address ? (
                    <p className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-white/55">
                      <span className="font-black uppercase tracking-widest text-[9px] text-emerald-400/90">{ao.locationPreviewLabel} · </span>
                      {locationDisplayLine}
                    </p>
                  ) : null}
                </div>

                <div className="relative w-full min-h-[420px] h-[clamp(360px,48svh,560px)] lg:min-h-[440px] rounded-[2rem] overflow-hidden bg-[#111] border border-white/10 shadow-[inset_0_0_50px_rgba(0,0,0,0.5)] isolate">
                  <div ref={mapContainerRef} className="absolute inset-0 h-full w-full min-h-[420px]" />
                  <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-10 rounded-xl border border-white/10 bg-black/70 px-4 py-3 text-[11px] text-white/75 leading-relaxed backdrop-blur-md">
                    {ao.locationMapHint}
                  </div>
                </div>
              </div>

              {isPolishOfferLocation ? (
                <AddOfferDocVerificationPanel
                  ao={ao}
                  inputPremium={inputPremium}
                  labelPremium={labelPremium}
                  propertyType={data.propertyType}
                  apartmentNumber={String(data.apartmentNumber || "")}
                  landRegistryNumber={String(data.landRegistryNumber || "")}
                  landRegistryValid={landRegistryValid}
                  hasLandRegistryInput={hasLandRegistryInput}
                  onApartmentChange={(value) => updateData({ apartmentNumber: value })}
                  onLandRegistryChange={(value) =>
                    updateData({ landRegistryNumber: normalizeLandRegistryInput(value) })
                  }
                  landRegistryInputRef={landRegistryInputRef}
                />
              ) : null}
            </section>

            {/* KROK 3: PARAMETRY I FINANSE */}
            <section className={`${glassPanel} ${currentStep === 3 ? '' : 'hidden'} ring-1 ring-white/5 ${isLocationDone ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
              <div className="flex items-center gap-5 mb-10">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-lg transition-all duration-500 ${isTechDone ? 'bg-[#10b981] text-black shadow-[0_0_30px_rgba(16,185,129,0.5)] scale-110' : 'bg-white/5 text-zinc-500 border border-white/10'}`}>
                  {isTechDone ? <Check size={24} /> : '3'}
                </div>
                <h2 className="text-2xl font-black uppercase tracking-[0.08em] text-white">{ao.step3FinancialTitle}</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-4 flex flex-wrap items-center gap-3">
                  <span className={labelPremium.replace('mb-2.5', 'mb-0')}>{ao.priceCurrency}</span>
                  {(['PLN', 'EUR'] as OfferPriceCurrency[]).map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => {
                        const amount = Number(cleanPrice);
                        const converted =
                          amount > 0
                            ? convertBetweenCurrencies(amount, data.priceCurrency, code, fxRate)
                            : 0;
                        updateData({
                          priceCurrency: code,
                          price:
                            converted > 0
                              ? String(converted).replace(/\B(?=(\d{3})+(?!\d))/g, " ")
                              : data.price,
                        });
                      }}
                      className={`px-5 py-2.5 rounded-xl border-2 font-black uppercase tracking-widest text-[10px] transition-all ${
                        data.priceCurrency === code
                          ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                          : 'bg-[#111] border-white/10 text-white/40 hover:border-white/25'
                      }`}
                    >
                      {code}
                    </button>
                  ))}
                  {cleanPrice && Number(cleanPrice) > 0 && formatApproxLine(Number(cleanPrice), data.priceCurrency, fxRate) ? (
                    <span className="text-[10px] font-bold text-zinc-400">
                      {formatApproxLine(Number(cleanPrice), data.priceCurrency, fxRate)} {ao.nbpTag}
                    </span>
                  ) : null}
                  {cleanPrice && Number(cleanPrice) > 0 && cleanArea && Number(cleanArea) > 0 ? (
                    <span className="text-[10px] font-bold text-zinc-500">
                      {Math.round(Number(cleanPrice) / Number(cleanArea)).toLocaleString('pl-PL')}{' '}
                      {ao.pricePerSqm.replace("{currency}", data.priceCurrency || "PLN")}
                    </span>
                  ) : null}
                </div>
                <div>
                  <label className={labelPremium}>
                    {data.transactionType === 'RENT'
                      ? `${ao.rentPriceLabel} (${data.priceCurrency || 'PLN'}) *`
                      : `${ao.salePriceLabel} (${data.priceCurrency || 'PLN'}) *`}
                  </label>
                  <input type="text" className={inputPremium} placeholder="850 000" value={data.price || ''} 
                    onChange={(e) => updateData({ price: e.target.value.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, " ") })} />
                </div>
                <div>
                  <label className={labelPremium}>{ao.area}</label>
                  <input type="text" className={inputPremium} placeholder="45.5" value={data.area || ''} 
                    onChange={(e) => updateData({ area: e.target.value.replace(/[^0-9.,]/g, "").replace(',', '.').slice(0, 7) })} />
                </div>

                {requiresPlot && (
                  <div>
                    <label className={labelPremium}>{ao.plotAreaLabel}</label>
                    <input type="text" className={inputPremium} placeholder="450" value={data.plotArea || ''}
                      onChange={(e) => updateData({ plotArea: e.target.value.replace(/[^0-9.,]/g, "").replace(',', '.').slice(0, 8) })} />
                  </div>
                )}

                {data.propertyType !== 'PLOT' && (
                  <>
                    <div>
                      <label className={labelPremium}>{ao.rooms} *</label>
                      <select className={`${inputPremium} appearance-none cursor-pointer`} value={data.rooms || ''} onChange={(e) => updateData({ rooms: e.target.value })}>
                        <option value="">-</option>
                        {Array.from({ length: 10 }, (_, i) => String(i + 1)).map(room => <option key={room} value={room}>{room}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelPremium}>{ao.floor} *</label>
                      <select className={`${inputPremium} appearance-none cursor-pointer`} value={data.floor || ''} onChange={(e) => updateData({ floor: e.target.value })}>
                        <option value="">-</option>
                        <option value="0">{ao.floorGround}</option>
                        {Array.from({ length: 30 }, (_, i) => String(i + 1)).map(floor => <option key={floor} value={floor}>{floor}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelPremium}>{ao.buildYearLabel}</label>
                      <select className={`${inputPremium} appearance-none cursor-pointer`} value={data.buildYear || ''} onChange={(e) => updateData({ buildYear: e.target.value })}>
                        <option value="">-</option>
                        {buildYearBuiltSelectOptions().map(year => <option key={year} value={year}>{year}</option>)}
                      </select>
                    </div>
                  </>
                )}
                
                {data.propertyType !== 'PLOT' && (
                  <>
                    <div className={requiresPlot ? 'lg:col-span-2' : ''}>
                      <label className={labelPremium}>{ao.heatingTypeLabel}</label>
                      <select className={`${inputPremium} appearance-none cursor-pointer`} value={data.heating || ''} onChange={(e) => updateData({ heating: e.target.value })}>
                        <option value="">{ao.selectPlaceholder}</option>
                        {HEATING_TYPES.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>

                    {/* Luksusowe przyciski Umeblowania */}
                    <div>
                      <label className={labelPremium}>{ao.furnishedLabel}</label>
                      <div className="flex gap-4">
                        <button type="button" onClick={(e) => { e.preventDefault(); updateData({ isFurnished: true }); }} className={`flex-1 py-4 rounded-xl border-2 font-black uppercase tracking-widest text-[10px] transition-all ${data.isFurnished === true ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-[#111] border-white/5 text-white/40 hover:border-white/20 hover:bg-white/5'}`}>{ao.yes}</button>
                        <button type="button" onClick={(e) => { e.preventDefault(); updateData({ isFurnished: false }); }} className={`flex-1 py-4 rounded-xl border-2 font-black uppercase tracking-widest text-[10px] transition-all ${data.isFurnished === false ? 'bg-red-500/10 border-red-500 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'bg-[#111] border-white/5 text-white/40 hover:border-white/20 hover:bg-white/5'}`}>{ao.no}</button>
                      </div>
                    </div>

                    {data.transactionType !== 'RENT' ? (
                    <div className="md:col-span-2 lg:col-span-2">
                      <label className={labelPremium}>
                        <span>{ao.adminFeeLabel}</span>
                        <span className="text-white/30 font-normal normal-case tracking-normal text-[10px]">{ao.adminFeeOptional}</span>
                      </label>
                      <div className="relative group">
                        <input type="text" placeholder={ao.rentPlaceholder} className={`${inputPremium} pr-12`} value={data.rent || ''} onChange={(e) => updateData({ rent: e.target.value.replace(/[^0-9]/g, '') })} />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 text-[10px] font-black tracking-widest uppercase">{data.priceCurrency || 'PLN'}</div>
                      </div>
                    </div>
                    ) : null}
                  </>
                )}

                {isAgencyAdvertiser ? (
                  <div ref={agentCommissionInputRef} className="lg:col-span-4 rounded-2xl border border-orange-500/25 bg-orange-500/5 p-5">
                    <label className={labelPremium}>{ao.commissionBlockTitle}</label>
                    <p className="text-[10px] text-zinc-400 mb-3 leading-relaxed">
                      {ao.commissionBlockIntro.replace("{min}", String(AGENT_COMMISSION_MIN_NONZERO))}
                    </p>
                    <AgentCommissionEditor
                      ao={ao}
                      priceRaw={data.price || 0}
                      percentValue={String(data.agentCommissionPercent ?? "")}
                      onPercentChange={(value) =>
                        updateData({
                          agentCommissionPercent: value,
                        })
                      }
                    />
                  </div>
                ) : null}
                
                {/* AI Monitor Przelicznik */}
                {(() => {
                  const p = parseInt(String(data.price || '').replace(/\D/g, ''));
                  const a = parseFloat(String(data.area || '').replace(',', '.'));
                  if (!p || !a || a === 0) return null;
                  const ppm = Math.round(p / a);
                  let config = { color: 'text-[#10b981]', bg: 'bg-[#10b981]/10', border: 'border-[#10b981]/30', label: ao.aiSegmentOpportunity, icon: <CheckCircle size={20} /> };
                  if (ppm > 18000) config = { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', label: ao.aiSegmentPremium, icon: <Flame size={20} /> };
                  if (ppm > 25000) config = { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', label: ao.aiSegmentLuxury, icon: <Crown size={20} /> };
                  return (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className={`mt-4 lg:col-span-4 flex items-center justify-between p-6 rounded-2xl border ${config.bg} ${config.border} backdrop-blur-md`}>
                      <div className="flex flex-col">
                        <span className="text-[11px] text-zinc-400 font-black uppercase tracking-widest mb-1">{ao.aiValuationKicker}</span>
                        <span className={`text-3xl font-black tracking-tight ${config.color}`}>{ppm.toLocaleString('pl-PL')} <span className="text-base font-bold opacity-80">PLN</span></span>
                      </div>
                      <div className={`flex items-center gap-3 px-5 py-3 rounded-xl border ${config.border} bg-black/40 shadow-inner`}>
                        <span className={`${config.color}`}>{config.icon}</span>
                        <span className={`text-[11px] font-black uppercase tracking-widest ${config.color}`}>{config.label}</span>
                      </div>
                    </motion.div>
                  );
                })()}
              </div>
            </section>

            {/* KROK 4: GALERIA I PREZENTACJA */}
            <section className={`${glassPanel} ${currentStep === 4 ? '' : 'hidden'} ring-1 ring-white/5 ${isTechDone ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
              <div className="flex items-center gap-5 mb-10">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-lg transition-all duration-500 ${isMediaDone ? 'bg-[#10b981] text-black shadow-[0_0_30px_rgba(16,185,129,0.5)] scale-110' : 'bg-white/5 text-zinc-500 border border-white/10'}`}>
                  {isMediaDone ? <Check size={24} /> : '4'}
                </div>
                <h2 className="text-2xl font-black uppercase tracking-[0.08em] text-white">{ao.step4GalleryTitle}</h2>
              </div>

              <div className="mb-10">
                <label className={labelPremium}>{ao.offerTitleLabel}</label>
                <input
                  type="text"
                  placeholder={ao.offerTitlePlaceholder}
                  className={inputPremium}
                  maxLength={70}
                  onChange={(e) => updateData({ title: e.target.value })}
                  value={data.title || ''}
                />
                <p className={`text-[10px] mt-2 ml-1 font-bold ${String(data.title || '').length >= 10 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                  {ao.titleMinHint}
                </p>
              </div>

              <div className="mb-12">
                <div className="flex items-center justify-between mb-4">
                  <label className={labelPremium}>{ao.photoGalleryLabel}</label>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${totalSizeMB > 25 ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-zinc-400'}`}>{ao.photoGalleryUsed} {totalSizeMB.toFixed(1)} / 30 MB</span>
                </div>
                <div className="flex flex-wrap gap-4 p-6 rounded-[2rem] bg-white/5 border border-white/10 shadow-inner min-h-[180px]">
                  <label className="w-32 h-32 border-2 border-dashed border-white/20 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all bg-black/20 hover:border-[#10b981] hover:bg-[#10b981]/5 hover:text-[#10b981] text-zinc-500 group">
                    <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} />
                    <Upload size={28} className="mb-3 transition-transform group-hover:-translate-y-1" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-center px-2">{ao.photoAddLine1}<br/>{ao.photoAddLine2}</span>
                  </label>
                  
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => { const { active, over } = e; if (active.id !== over?.id && over) { setImagesList((items) => arrayMove(items, items.indexOf(active.id as string), items.indexOf(over.id as string))); } }}>
                    <SortableContext items={imagesList} strategy={rectSortingStrategy}>
                      {imagesList.map((img, idx) => <SortableItem key={img} id={img} img={img} idx={idx} onRemove={handleRemoveImage} progressObj={uploadStats[img]} />)}
                    </SortableContext>
                  </DndContext>
                </div>
                <p className="text-[10px] text-zinc-500 mt-3 text-center">{ao.photoGalleryHint}</p>
                {imagesList.length === 0 ? (
                  <p className="mt-2 text-center text-[11px] font-bold text-red-500">{ao.sumNoPhotos}</p>
                ) : null}
              </div>

              <div className="mb-10 rounded-[2rem] border border-[#10b981]/40 bg-gradient-to-br from-[#10b981]/15 to-emerald-950/20 p-6 shadow-[0_0_40px_rgba(16,185,129,0.12)]">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300">EstateOS Studio</p>
                    <h3 className="mt-2 text-xl font-black uppercase tracking-wide text-white">Profesjonalna sesja zdjęciowa</h3>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
                      Zamów sesję ze zdjęciami i kompleksową ofertą — negocjuj termin online, tak jak w aplikacji mobilnej.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPhotoSessionOpen(true)}
                    className="shrink-0 rounded-full bg-[#10b981] px-6 py-4 text-[11px] font-black uppercase tracking-widest text-black shadow-[0_0_24px_rgba(16,185,129,0.35)] transition hover:scale-[1.02]"
                  >
                    Zamów sesję
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-2">
                  <div className="flex items-center justify-between mb-4">
                    <label className={labelPremium}>{ao.exclusiveDescLabel}</label>
                    <button onClick={handleGenerateAI} disabled={isGeneratingAI} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#10b981]/20 to-emerald-900/40 border border-[#10b981]/50 text-[#10b981] text-[11px] font-black uppercase tracking-widest hover:bg-[#10b981] hover:text-black transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                      {isGeneratingAI ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                      {isGeneratingAI ? ao.generating : ao.aiAssistantBtn}
                    </button>
                  </div>
                  
                  {/* Edytor Premium */}
                  <div className="rounded-[2rem] border border-white/10 bg-white/5 overflow-hidden focus-within:border-[#10b981] transition-colors shadow-inner">
                    <div className="flex items-center gap-2 p-3 border-b border-white/10 bg-black/40">
                      <button onClick={() => execCommand('bold')} className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors"><Bold size={16}/></button>
                      <button onClick={() => execCommand('italic')} className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors"><Italic size={16}/></button>
                      <button onClick={() => execCommand('underline')} className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors"><Underline size={16}/></button>
                      <div className="w-px h-4 bg-white/10 mx-2"></div>
                      <button onClick={() => execCommand('formatBlock')} onMouseDown={(e) => { e.preventDefault(); document.execCommand('formatBlock', false, 'H3'); }} className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors"><Heading size={16}/></button>
                    </div>
                    <div 
                      ref={editorRef}
                      contentEditable
                      className="w-full h-64 p-6 outline-none text-[#f5f5f7] leading-relaxed overflow-y-auto"
                      style={{ minHeight: '16rem' }}
                      onInput={(e) => updateData({ description: e.currentTarget.innerHTML })}
                      data-placeholder={ao.descriptionPlaceholderAttr}
                    ></div>
                  </div>
                </div>
                
                <div className="space-y-8">
                  <div>
                    <label className={labelPremium}>{ao.propertyPlanLabel}</label>
                    {!floorPlan ? (
                      <label className="w-full h-24 border-2 border-dashed border-white/20 rounded-2xl flex items-center justify-center gap-3 cursor-pointer transition-all bg-white/5 hover:border-[#10b981] hover:text-[#10b981] text-zinc-500 group">
                        <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFloorPlanUpload} />
                        <LayoutTemplate size={24} className="group-hover:scale-110 transition-transform"/>
                        <span className="text-[10px] font-black uppercase tracking-widest">{ao.uploadFloorPlanBtn}</span>
                      </label>
                    ) : (
                      <div className="relative w-full h-32 rounded-2xl overflow-hidden border border-[#10b981]/50 shadow-[0_0_20px_rgba(16,185,129,0.2)] group">
                        <img src={floorPlan} className="w-full h-full object-cover opacity-80" alt={ao.floorPlanAlt} />
                        <button onClick={() => { setFloorPlan(null); setFloorPlanFile(null); }} className="absolute top-2 right-2 p-2 bg-red-500/90 rounded-full text-white opacity-0 group-hover:opacity-100 transition-all shadow-lg"><Trash2 size={14}/></button>
                      </div>
                    )}
                  </div>

                  
                  {/* --- NOWA SEKCJA: WARUNKI NAJMU --- */}
                  <AnimatePresence>
                    {data.transactionType === 'RENT' && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }} 
                        animate={{ opacity: 1, height: 'auto' }} 
                        exit={{ opacity: 0, height: 0 }}
                        className="col-span-full overflow-hidden mb-4"
                      >
                        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-[2rem] p-6 md:p-8 shadow-[0_0_30px_rgba(16,185,129,0.05)]">
                          <h3 className="text-emerald-400 font-black text-[11px] uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
                            <Key size={14} /> {ao.rentDetailsHeading}
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <label className={labelPremium}>{ao.rentAdminFeeLabel}</label>
                              <p className="text-[10px] text-zinc-500 mb-2 leading-relaxed">
                                {ao.rentAdminFeeHint}
                              </p>
                              <select
                                className={`${inputPremium} appearance-none cursor-pointer`}
                                value={String(data.rentAdminFee ?? "")}
                                onChange={(e) => updateData({ rentAdminFee: e.target.value })}
                              >
                                <option value="">{ao.rentNoneOption}</option>
                                {buildRentAdditionalFeeSelectOptions()
                                  .filter((v) => v > 0)
                                  .map((fee) => (
                                    <option key={fee} value={String(fee)}>
                                      {fee.toLocaleString(locale === "pl" ? "pl-PL" : locale === "uk" ? "uk-UA" : "en-GB")} {ao.rentPerMonthSuffix}
                                    </option>
                                  ))}
                              </select>
                            </div>
                            <div>
                              <label className={labelPremium}>{ao.depositLabel}</label>
                              <input
                                type="text"
                                className={inputPremium}
                                placeholder="np. 5000"
                                value={data.deposit || ""}
                                onChange={(e) => updateData({ deposit: e.target.value.replace(/[^0-9]/g, "") })}
                              />
                            </div>
                            <div>
                              <label className={labelPremium}>{ao.rentTypeLabel}</label>
                              <input 
                                type="text" 
                                className={inputPremium} 
                                placeholder={ao.rentTypePlaceholder} 
                                value={data.rentType || ''} 
                                onChange={(e) => updateData({ rentType: e.target.value })} 
                              />
                            </div>
                            <div className="flex flex-col justify-end">
                              <label className={labelPremium}>{ao.sumRowPets}</label>
                              <button
                                type="button"
                                onClick={() => updateData({ petsAllowed: !data.petsAllowed })}
                                className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl border transition-all duration-300 ${data.petsAllowed ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}
                              >
                                <span className="font-bold uppercase tracking-widest text-[10px]">{ao.petsAcceptLabel}</span>
                                {data.petsAllowed ? <CheckCircle size={20} /> : <div className="w-5 h-5 rounded-full border-2 border-white/10" />}
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

              <div>
                    <label className={labelPremium}>{ao.amenitiesPremiumLabel}</label>
                    <div className="flex flex-wrap gap-2">
                      {AMENITIES.map((item) => {
                        const isSelected = data.amenities.includes(item.label);
                        return (
                          <button key={item.id} onClick={() => {
                            const nextSelected = !isSelected;
                            updateData({
                              amenities: isSelected ? data.amenities.filter((a: string) => a !== item.label) : [...data.amenities, item.label],
                              ...getAmenityPatch(item.id, nextSelected),
                            });
                          }} 
                                  className={`px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 ${isSelected ? 'bg-[#10b981] text-black border border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.6)] scale-[1.05]' : 'bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 hover:border-white/20'}`}>
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* KROK 5: DANE KONTAKTOWE — przeniesione do modala rejestracji przy publikacji */}
            {false && !isLoggedIn && (
              <section className={`${glassPanel} ${currentStep === 5 ? '' : 'hidden'} ring-1 ring-white/5 ${isMediaDone ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                <div className="flex items-center gap-5 mb-10">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-lg transition-all duration-500 ${isContactDone ? 'bg-[#10b981] text-black shadow-[0_0_30px_rgba(16,185,129,0.5)] scale-110' : 'bg-white/5 text-zinc-500 border border-white/10'}`}>
                    {isContactDone ? <Check size={24} /> : '5'}
                  </div>
                  <h2 className="text-2xl font-black uppercase tracking-[0.08em] text-white">{ao.advertiserProfileTitle}</h2>
                </div>

                <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 w-full max-w-md mb-8">
                  <button onClick={() => updateData({ advertiserType: 'private', agentCommissionPercent: '' })} className={`flex-1 py-4 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all ${data.advertiserType === 'private' ? 'bg-[#10b981] text-black shadow-md' : 'text-zinc-400 hover:text-white'}`}>{ao.advertiserPrivate}</button>
                  <button onClick={() => updateData({ advertiserType: 'agency' })} className={`flex-1 py-4 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all ${data.advertiserType === 'agency' ? 'bg-[#10b981] text-black shadow-md' : 'text-zinc-400 hover:text-white'}`}>{ao.advertiserAgency}</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {data.advertiserType === 'agency' && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="md:col-span-2">
                      <label className={labelPremium}>{ao.agencyNameRequired}</label>
                      <input type="text" className={inputPremium} onChange={(e) => updateData({ agencyName: e.target.value })} value={data.agencyName || ''} placeholder={ao.agencyNamePlaceholder} />
                    </motion.div>
                  )}
                  
                  <div>
                    <label className={labelPremium}><User size={14}/> {ao.contactNameLabel}</label>
                    <input type="text" className={inputPremium} onChange={(e) => updateData({ contactName: e.target.value })} value={data.contactName || ''} />
                  </div>
                  <div>
                    <label className={labelPremium}><Phone size={14}/> {ao.phoneLabel}</label>
                    <div className="relative">
                      <input type="tel" placeholder="+48 500 600 700" className={`${inputPremium} pr-12 ${phoneStatus === 'invalid' || phoneStatus === 'taken' ? 'border-red-500/50' : ''}`} onChange={handlePhoneChange} value={data.contactPhone || ''} />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        {phoneStatus === 'checking' && <Loader2 size={18} className="animate-spin text-zinc-500" />}
                        {phoneStatus === 'available' && <CheckCircle size={18} className="text-[#10b981]" />}
                        {(phoneStatus === 'invalid' || phoneStatus === 'taken') && <X size={18} className="text-red-500" />}
                      </div>
                    </div>
                    {phoneStatus === 'taken' && <p className="text-[10px] text-red-400 mt-2 font-bold">{ao.phoneTakenMsg}</p>}
                  </div>
                  <div>
                    <label className={labelPremium}><Mail size={14}/> {ao.emailLabel}</label>
                    <div className="relative">
                      <input type="email" placeholder="jan@kowalski.pl" className={`${inputPremium} pr-12 ${emailStatus === 'invalid' || emailStatus === 'taken' ? 'border-red-500/50' : ''}`} onChange={(e) => updateData({ email: e.target.value })} value={data.email || ''} />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        {emailStatus === 'checking' && <Loader2 size={18} className="animate-spin text-zinc-500" />}
                        {emailStatus === 'available' && <CheckCircle size={18} className="text-[#10b981]" />}
                        {(emailStatus === 'invalid' || emailStatus === 'taken') && <X size={18} className="text-red-500" />}
                      </div>
                    </div>
                    {emailStatus === 'taken' && <p className="text-[10px] text-red-400 mt-2 font-bold">{ao.emailTakenMsg}</p>}
                  </div>
                  <div>
                    <label className={labelPremium}><Lock size={14}/> {ao.passwordLabel}</label>
                    <input type="password" placeholder="••••••••" className={inputPremium} onChange={(e) => updateData({ password: e.target.value })} value={data.password || ''} />
                  </div>
                </div>
              </section>
            )}

            {/* FINAŁOWY PRZYCISK APPLE LUXURY */}
            <div className={`pt-8 pb-24 relative z-50 ${currentStep === totalSteps ? '' : 'hidden'}`}>
              <div className="mb-6 rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 md:p-6">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300 mb-3">
                  {ao.publishSummaryHeading}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs mb-3">
                  <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                    <p className="text-white/40 uppercase tracking-wider text-[10px] mb-1">{ao.sumTitle}</p>
                    <p className="text-white font-semibold">{String(data.title || '').trim() || '-'}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                    <p className="text-white/40 uppercase tracking-wider text-[10px] mb-1">{ao.sumTypeTransaction}</p>
                    <p className="text-white font-semibold">
                      {propertyTypeLabel || '—'} / {data.transactionType === 'RENT' ? ao.rent : ao.sell}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                    <p className="text-white/40 uppercase tracking-wider text-[10px] mb-1">{ao.sumPriceArea}</p>
                    <p className="text-white font-semibold">
                      {String(data.price || '').trim() ? `${String(data.price).trim()} ${data.priceCurrency || 'PLN'}` : '-'}
                      {" · "}
                      {String(data.area || '').trim() ? `${String(data.area).trim()} m²` : '-'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                    <p className="text-white/40 uppercase tracking-wider text-[10px] mb-1">{ao.sumLocation}</p>
                    <p className="text-white font-semibold">{locationDisplayLine}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs mb-3">
                  <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                    <p className="text-white/40 uppercase tracking-wider text-[10px] mb-1">{ao.sumParams}</p>
                    <p className="text-white/80">
                      {ao.sumRooms}: {data.rooms || '-'} · {ao.sumFloor}: {data.floor || '-'} · {ao.sumYear}: {data.buildYear || '-'}
                    </p>
                    <p className="text-white/60 mt-1">
                      {ao.sumHeating}: {data.heating || '-'} · {ao.sumFurnished}: {data.isFurnished === true ? ao.yes.toLowerCase() : data.isFurnished === false ? ao.no.toLowerCase() : '-'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                    <p className="text-white/40 uppercase tracking-wider text-[10px] mb-1">
                      {isAgencyAdvertiser ? ao.sumCostsCommission : ao.sumRent}
                    </p>
                    <p className="text-white/80">
                      {ao.sumRent}: {String(data.rent || '').trim() ? `${String(data.rent).trim()} PLN` : '-'}
                    </p>
                    {isAgencyAdvertiser ? (
                      <p className="text-white/60 mt-1">
                        {ao.sumCommission}: {String(data.agentCommissionPercent || '').trim() ? `${String(data.agentCommissionPercent).trim()}%` : ao.sumCommissionZero}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                  <p className="text-white/40 uppercase tracking-wider text-[10px] mb-2">{ao.sumAmenitiesMedia}</p>
                  <p className="text-white/80 mb-2">
                    {Array.isArray(data.amenities) && data.amenities.length > 0 ? data.amenities.join(', ') : ao.sumNoAmenities}
                  </p>
                  {finalImages.length > 0 ? (
                    <div className="mb-2 text-[10px] uppercase tracking-wider text-white/45">
                      {ao.sumPhotos}: {finalImages.length} · {ao.sumFloorPlan}: {finalFloorPlan ? '1' : '0'}
                    </div>
                  ) : null}
                  <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                    {finalImages.length > 0 ? finalImages.map((img, idx) => (
                      <img key={`${img}-${idx}`} src={img} alt={ao.sumPhotoPreviewAlt.replace("{n}", String(idx + 1))} className="h-14 w-14 rounded-lg object-cover border border-white/15" />
                    )) : (
                      <div className="col-span-full rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-[11px] font-semibold text-red-500">
                        {ao.sumNoPhotos}
                      </div>
                    )}
                    {finalFloorPlan ? (
                      <img src={finalFloorPlan} alt={ao.sumFloorPreviewAlt} className="h-14 w-14 rounded-lg object-cover border border-emerald-500/30" />
                    ) : null}
                  </div>
                </div>

                {summarySections.map((section) => (
                  <div key={section.title} className="mt-3 rounded-xl border border-white/10 bg-black/25 p-4">
                    <p className="text-white/40 uppercase tracking-[0.18em] text-[10px] font-black mb-3">
                      {section.title}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                      {section.rows.map((row) => (
                        <div key={`${section.title}-${row.label}`} className="rounded-lg border border-white/10 bg-black/30 px-3 py-2.5">
                          <p className="text-white/45 text-[10px] font-semibold tracking-wide">{row.label}</p>
                          <p className="text-white/90 break-words mt-1 leading-relaxed">{row.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {isLoggedIn ? (
                <PublicationWalletPanel
                  selectable
                  selection={publicationSelection ?? undefined}
                  onSelectionChange={setPublicationSelection}
                  walletOverride={{
                    coupons: walletCoupons.map((c) => ({
                      id: c.id,
                      kind: c.kind,
                      title: c.title,
                      subtitle: c.subtitle,
                      pillLabel: c.pillLabel,
                      meta: c.meta,
                    })),
                    plusCredits: walletPlusCredits,
                    hasPlusCredit: walletHasPlusCredit,
                    plusExpiresAt: walletPlusExpiresAt,
                  }}
                  onBuyPlus={handlePlusPayment}
                  buyingPlus={isProcessingPlus || walletLoading}
                />
              ) : null}

              {isLoggedIn && !publishContactOk ? (
                <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-left">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400 mb-2">{ao.acctVerifyTitle}</p>
                  <p className="text-sm text-white/70 mb-4 leading-relaxed">
                    {ao.acctVerifyBefore}{' '}
                    {!initialUser?.isVerifiedPhone ? ao.acctVerifyPhone : ''}
                    {!initialUser?.isVerifiedPhone && !initialUser?.isEmailVerified ? ` ${ao.acctVerifyAnd} ` : ''}
                    {!initialUser?.isEmailVerified ? ao.acctVerifyEmail : ''}.
                  </p>
                  <a
                    href="/moje-konto/weryfikacja"
                    className="inline-block py-3 px-6 rounded-xl bg-emerald-500 text-black text-[10px] font-black uppercase tracking-[0.2em] hover:bg-emerald-400 transition-colors"
                  >
                    {ao.acctVerifyGo}
                  </a>
                </div>
              ) : null}
              <button 
                onClick={handleSubmit} 
                disabled={isSubmitting || !canPublish} 
                className={`w-full py-6 md:py-8 rounded-[2rem] flex items-center justify-center gap-4 transition-all duration-500 overflow-hidden relative group font-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
                  (!canPublish || isSubmitting)
                    ? 'bg-white/5 border border-white/10 text-zinc-500 cursor-not-allowed backdrop-blur-md'
                    : 'bg-white/10 border border-white/20 text-[#f5f5f7] cursor-pointer backdrop-blur-xl hover:bg-[#10b981] hover:border-[#10b981] hover:text-black shadow-[0_10px_30px_rgba(0,0,0,0.5)] hover:shadow-[0_0_40px_rgba(16,185,129,0.5)] hover:scale-[1.02] active:scale-95'
                }`}
              >
                <span className="relative z-10 flex items-center gap-3 text-xl md:text-2xl font-black uppercase tracking-[0.2em]">
                  {isSubmitting ? <Loader2 className="animate-spin" size={28} /> : (!canPublish ? <Lock size={24} /> : <Crown size={32} className="group-hover:animate-bounce" />)}
                  {isSubmitting ? (uploadProgress || ao.processing) : (!canPublish ? ao.fillMissingData : publishButtonLabel)}
                </span>
              </button>
            </div>

            <div className={`pb-12 ${currentStep === totalSteps ? 'hidden' : ''}`}>
              <div
                className={`flex gap-3 rounded-[1.5rem] p-3 backdrop-blur-xl border ${
                  currentStep === 1
                    ? "bg-zinc-950/80 border-zinc-600/60 ring-1 ring-white/10"
                    : "bg-white/[0.03] border-white/10"
                }`}
              >
                <button
                  type="button"
                  onClick={prevStep}
                  disabled={currentStep === 1}
                  className={`flex-1 py-4 rounded-xl border text-[10px] font-black uppercase tracking-[0.22em] transition-all ${
                    currentStep === 1
                      ? "border-zinc-700 text-zinc-500 cursor-not-allowed bg-zinc-900/40"
                      : "border-zinc-500/70 text-zinc-100 bg-zinc-900/50 hover:bg-zinc-800 hover:text-white"
                  }`}
                >
                  {ao.prev}
                </button>
                <button
                  type="button"
                  onClick={nextStep}
                  disabled={!canAdvanceStep(currentStep)}
                  className={`flex-1 py-4 rounded-xl border text-[10px] font-black uppercase tracking-[0.22em] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
                    canAdvanceStep(currentStep)
                      ? currentStep === 1
                        ? "eos-chip-on"
                        : "border-emerald-300/70 text-black bg-gradient-to-r from-emerald-300 to-emerald-500 hover:from-emerald-400 hover:to-emerald-500 hover:shadow-[0_0_24px_rgba(16,185,129,0.45)] hover:-translate-y-[1px]"
                      : currentStep === 1
                        ? "border-zinc-600 text-zinc-200 bg-zinc-900/80 cursor-not-allowed"
                        : "border-white/20 text-white/55 bg-white/5 cursor-not-allowed"
                  }`}
                >
                  {ao.next}
                </button>
              </div>
              {!canAdvanceStep(currentStep) && (
                <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-[0.16em] text-red-500">
                  {ao.stepRequiredHint}
                </p>
              )}
            </div>

          </motion.div>
        </AnimatePresence>
      </div>

      
      {/* 1. STANDARDOWE OKNA (BŁĄD, LIMIT, SUKCES ZWYKŁY) */}
      <AnimatePresence>
        {actionModal === "verify" && (
          <div className="fixed inset-0 z-[999999] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="relative flex max-h-[min(100dvh,820px)] w-full max-w-2xl flex-col overflow-hidden rounded-t-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)] shadow-[0_28px_90px_rgba(0,0,0,0.35)] sm:max-h-[min(92dvh,820px)] sm:rounded-3xl"
            >
              <button
                onClick={() => setActionModal("none")}
                className="absolute right-4 top-4 z-10 rounded-full border border-[var(--eos-border)] bg-[var(--eos-surface)] p-2 text-[var(--eos-muted)] transition hover:text-[var(--eos-text)]"
                aria-label={ao.modalClose}
              >
                <X size={18} />
              </button>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pt-12 sm:p-6 sm:pt-14">
                {serverErrorMessage ? (
                  <p className="mb-4 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
                    {serverErrorMessage}
                  </p>
                ) : null}
                <ContactVerificationPanel
                  compact
                  initial={{
                    email: activeUser?.email,
                    phone: activeUser?.phone,
                    isEmailVerified: activeUser?.isEmailVerified,
                    isVerifiedPhone: activeUser?.isVerifiedPhone,
                  }}
                  onUpdated={async () => {
                    const checkRes = await fetch("/api/auth/check", { cache: "no-store", credentials: "include" });
                    const check = await checkRes.json().catch(() => ({}));
                    if (check?.loggedIn && check?.user) {
                      setActiveUser({
                        isLoggedIn: true,
                        id: check.user.id,
                        name: check.user.name,
                        email: check.user.email,
                        phone: check.user.phone,
                        role: check.user.role,
                        isEmailVerified: check.user.isEmailVerified,
                        isVerifiedPhone: check.user.isVerifiedPhone,
                      });
                      if (check.user.isEmailVerified && check.user.isVerifiedPhone) {
                        setActionModal("none");
                        setServerErrorMessage("");
                      }
                    }
                  }}
                />
              </div>
            </motion.div>
          </div>
        )}
        {actionModal !== "none" && actionModal !== "payment_success" && actionModal !== "oferta_plus" && actionModal !== "verify" && (
          <div className="fixed inset-0 z-[999999] flex items-start overflow-y-auto pt-10 pb-10 sm:pt-20 sm:pb-20 justify-center p-4 bg-black/90 backdrop-blur-xl">
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="bg-[#0a0a0a] border border-white/10 rounded-[3rem] p-10 max-w-lg w-full shadow-2xl relative text-center">
              <button onClick={() => setActionModal("none")} className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors"><X size={24} /></button>
              
              {actionModal === "success" && (
                <>
                  <div className="w-24 h-24 bg-[#10b981]/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-[#10b981]/30 shadow-[0_0_40px_rgba(16,185,129,0.3)]"><CheckCircle className="text-[#10b981]" size={40} /></div>
                  <h2 className="text-3xl font-black text-white mb-4">{ao.modalSuccessTitle}</h2>
                  <p className="text-zinc-400 mb-8 leading-relaxed">
                    {ao.modalSuccessBody}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      window.location.href = "/moje-konto/crm?tab=my_offers";
                    }}
                    className="w-full rounded-2xl border border-emerald-400/45 bg-gradient-to-b from-emerald-400 to-emerald-600 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-black shadow-[0_12px_32px_rgba(16,185,129,0.22)] transition hover:brightness-105"
                  >
                    {ao.modalSuccessPanel}
                  </button>
                </>
              )}

              {actionModal === "error" && (
                <>
                  <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/30"><AlertCircle className="text-red-500" size={40} /></div>
                  <h2 className="text-3xl font-black text-white mb-4">{ao.modalErrorTitle}</h2>
                  <p className="text-[var(--eos-muted)] mb-8 leading-relaxed">{serverErrorMessage || ao.serverErrorHint}</p>
                  <button onClick={handleFixDataFromErrorModal} className="w-full py-4 bg-white/10 border border-white/20 text-white hover:bg-red-500 font-black uppercase tracking-widest rounded-2xl transition-all duration-300">{ao.modalFixData}</button>
                </>
              )}

              {actionModal === "limit" && (
                <>
                  <div className="w-24 h-24 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-500/30 shadow-[0_0_40px_rgba(59,130,246,0.3)]"><Sparkles className="text-blue-400" size={40} /></div>
                  <h2 className="text-3xl font-black text-white mb-2 tracking-tighter">{ao.modalLimitTitle}</h2>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[9px] font-black uppercase tracking-[0.2em] text-blue-400 mb-6 animate-pulse">{ao.modalLimitBadge}</div>
                  <p className="text-zinc-400 mb-8 leading-relaxed font-medium">{ao.modalLimitBody} <br/><span className="text-zinc-600 line-through text-lg mr-2 decoration-red-500/40">49,99 zł</span><span className="text-white font-black text-3xl">29,99 zł</span></p>
                  <button onClick={handlePlusPayment} disabled={isProcessingPlus} className="w-full py-5 bg-blue-600 text-white font-black uppercase tracking-[0.2em] rounded-[1.5rem] transition-all duration-300 hover:bg-blue-500 hover:brightness-125 shadow-xl flex flex-col items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                    {isProcessingPlus ? <span>{ao.modalCheckoutLoading}</span> : <><span>{ao.modalUnlock}</span><span className="text-[9px] opacity-70 mt-1 font-bold">{ao.modalAutoPublish}</span></>}
                  </button>
                  <button onClick={() => setActionModal("none")} className="mt-6 text-[10px] text-zinc-500 uppercase tracking-widest font-bold hover:text-white transition-colors">{ao.modalBackEdit}</button>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. RYTUAŁ PRO (ROLLS ROYCE) */}
      {actionModal === "payment_success" && (
        <div className="fixed inset-0 z-[999999] flex flex-col items-start overflow-y-auto pt-10 pb-10 sm:pt-20 sm:pb-20 justify-center bg-black font-sans m-0 p-0" style={{ margin: '-40px' }}>
          
          {/* FAZA 1: Kosmiczne Zaćmienie (Apple Keynote Style) */}
          <AnimatePresence mode="wait">
            <motion.div
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, delay: 4.2 }}
              className="absolute inset-0 flex items-center justify-center z-10"
            >
              {/* Obracająca się korona zaćmienia (Tytanowy blask) */}
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: [0.5, 1.2, 0.05], opacity: [0, 1, 1], rotate: 180 }}
                transition={{ duration: 4, times: [0, 0.7, 1], ease: [0.25, 1, 0.5, 1] }}
                className="absolute w-72 h-72 md:w-96 md:h-96 rounded-full border-[1px] border-white/20 shadow-[0_0_80px_rgba(255,255,255,0.15)] flex items-center justify-center"
              >
                {/* Oślepiająca flara na krawędzi */}
                <motion.div className="absolute top-0 w-24 h-1 md:w-32 md:h-2 bg-white rounded-full blur-[4px] shadow-[0_0_30px_rgba(255,255,255,1)]" />
              </motion.div>

              {/* Osobliwość - zapada się i eksploduje czystym światłem */}
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [0, 0.2, 0.5, 50], opacity: [0, 1, 1, 0] }}
                transition={{ duration: 4.5, times: [0, 0.6, 0.9, 1], ease: "easeInOut" }}
                className="absolute w-6 h-6 md:w-10 md:h-10 bg-white rounded-full blur-[2px] shadow-[0_0_100px_rgba(255,255,255,1)]"
              />
            </motion.div>
          </AnimatePresence>

          {/* FAZA 2: Bezszelestna Szklana Fala Uderzeniowa (Glassmorphism Wave) */}
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: [0, 1, 0], scale: [0.2, 3] }}
              transition={{ duration: 2.5, delay: 3.8, ease: "easeOut" }}
              className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
            >
              <div className="w-[150vw] h-[150vw] rounded-full border-[15vw] border-white/5 backdrop-blur-2xl" />
            </motion.div>
          </AnimatePresence>

          {/* FAZA 3: Monolit PRO (Apple Typography) */}
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 2, delay: 4.5 }}
              className="absolute inset-0 z-30 flex flex-col items-center justify-center font-sans"
            >
              {/* Bardzo subtelne tło studyjne (ciemny grafit, jak tył iPhone Pro) */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(20,20,22,1)_0%,rgba(0,0,0,1)_80%)]" />

              <motion.div
                initial={{ scale: 0.9, y: 30, opacity: 0, filter: "blur(15px)" }}
                animate={{ scale: 1, y: 0, opacity: 1, filter: "blur(0px)" }}
                transition={{ duration: 2.5, delay: 4.8, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10 flex flex-col items-center text-center px-6"
              >
                {/* Tytanowy napis PRO. (Gruby, ciasny tracking) */}
                <div className="relative mb-2 overflow-visible">
                  <h1 className="text-[120px] md:text-[200px] font-semibold tracking-[-0.05em] text-transparent bg-clip-text bg-gradient-to-b from-[#ffffff] via-[#e2e2e2] to-[#666666] drop-shadow-[0_20px_40px_rgba(0,0,0,0.8)] leading-none px-4" style={{ fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif" }}>
                    PRO.
                  </h1>
                  
                  {/* Efekt skanowania światłem (Light Sweep) po literach */}
                  <motion.div
                    initial={{ x: '-150%', opacity: 0 }}
                    animate={{ x: '150%', opacity: [0, 0.5, 0] }}
                    transition={{ duration: 3.5, delay: 6.8, ease: "easeInOut" }}
                    className="absolute inset-0 top-0 h-full w-1/2 bg-gradient-to-r from-transparent via-white to-transparent opacity-40 blur-[8px] mix-blend-overlay pointer-events-none"
                  />
                </div>

                <motion.p
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 1.5, delay: 5.8, ease: [0.16, 1, 0.3, 1] }}
                  className="text-xl md:text-3xl text-[#a1a1a6] font-normal tracking-wide max-w-2xl mt-4"
                >
                  Witamy w absolutnej elicie <span className="text-white font-medium">EstateOS</span>.
                </motion.p>

                {/* Luksusowy przycisk w stylu Apple (Frost Glass) */}
                <motion.button
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 1.5, delay: 6.8, ease: [0.16, 1, 0.3, 1] }}
                  onClick={() => { window.location.href = '/moje-konto/crm'; }}
                  className="mt-16 px-12 py-5 btn-apple-glass text-sm md:text-base font-bold tracking-[0.2em] uppercase rounded-full group"
                >
                  <span className="relative z-10 transition-transform duration-500 group-hover:scale-105 inline-block">Rozpocznij</span>
                </motion.button>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {actionModal === "oferta_plus" && (
        <div className="fixed inset-0 z-[999999] flex flex-col items-start overflow-y-auto pt-10 pb-10 sm:pt-20 sm:pb-20 justify-center bg-[#030712] overflow-hidden font-sans m-0 p-0" style={{ margin: '-40px' }}>
          <AnimatePresence mode="wait">
            <motion.div initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1, delay: 3.5 }} className="absolute inset-0 flex items-center justify-center z-10">
              <motion.div animate={{ opacity: [0, 0.4, 0] }} transition={{ duration: 3, ease: "easeInOut" }} className="absolute inset-0 bg-blue-600/30 blur-[150px] rounded-full" />
              
              <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                {[...Array(24)].map((_, i) => {
                  const angle = (i / 24) * Math.PI * 2;
                  const distance = Math.random() * 350 + 150;
                  return (
                    <motion.div key={'card'+i} initial={{ scale: 0, x: 0, y: 0, opacity: 0, rotate: 0 }} animate={{ x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, scale: [0, 1, 1.2, 0.8], opacity: [0, 1, 0.8, 0], rotate: Math.random() * 180 - 90 }} transition={{ duration: 2.2, ease: "easeOut", delay: 1 + (i * 0.05) }} className="absolute w-32 h-44 bg-[#0f172a] border border-blue-500/30 rounded-xl flex flex-col p-2">
                      <div className="w-full h-1/2 bg-[#1e293b] rounded-md mb-2 flex items-center justify-center"><Home className="text-blue-500/30" size={24} /></div>
                      <div className="w-3/4 h-2 bg-[#334155] rounded-full mb-1"></div>
                      <div className="w-1/2 h-2 bg-[#334155] rounded-full"></div>
                    </motion.div>
                  );
                })}
              </div>

              <motion.div initial={{ scale: 0, y: 50 }} animate={{ scale: [0, 1, 1.05, 1, 0], opacity: [0, 1, 1, 1, 0] }} transition={{ duration: 3.5, times: [0, 0.15, 0.3, 0.8, 1], ease: "easeInOut" }} className="relative w-56 h-80 bg-gradient-to-br from-[#0f172a] to-black border border-blue-400/50 rounded-2xl shadow-[0_0_80px_rgba(59,130,246,0.6)] flex flex-col p-4 z-20">
                <div className="w-full h-1/2 bg-gradient-to-b from-[#1e293b] to-[#0f172a] rounded-xl mb-4 flex items-center justify-center relative overflow-hidden">
                   <Home className="text-blue-400 relative z-10" size={50} />
                </div>
                <div className="w-full h-3 bg-[#334155] rounded-full mb-3"></div>
                <div className="w-4/5 h-3 bg-[#334155] rounded-full mb-3"></div>
                <div className="w-full h-10 bg-blue-600/20 border border-blue-500/30 rounded-lg flex items-center justify-center mt-auto">
                   <span className="text-blue-400 font-bold text-xs">PLUS+ LISTING</span>
                </div>
              </motion.div>

              {/* LATAJĄCE PLUSIKI JAK KONFETTI */}
              <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden">
                {[...Array(120)].map((_, i) => {
                  const angle = Math.random() * Math.PI * 2;
                  const distance = Math.random() * 800 + 100;
                  return (
                    <motion.div
                      key={'plus'+i}
                      className="absolute font-black drop-shadow-[0_0_15px_rgba(96,165,250,0.9)]"
                      style={{ color: Math.random() > 0.5 ? '#60a5fa' : '#38bdf8', fontSize: Math.random() * 30 + 20 + 'px' }}
                      initial={{ x: '50vw', y: '50vh', scale: 0, opacity: 1, rotate: 0 }}
                      animate={{ x: `calc(50vw + ${Math.cos(angle) * distance}px)`, y: `calc(50vh + ${Math.sin(angle) * distance}px)`, scale: [0, Math.random() * 1.5 + 0.5, 0], opacity: [1, 1, 0], rotate: Math.random() * 720 - 360 }}
                      transition={{ duration: 2.5 + Math.random(), ease: "easeOut", delay: 1.8 }}
                    >
                      +
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>

          <AnimatePresence>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0] }} transition={{ duration: 1.2, times: [0, 0.1, 0.8, 1], delay: 3.2, ease: "easeInOut" }} className="absolute inset-0 z-50 bg-gradient-to-br from-white via-blue-100 to-white flex items-center justify-center pointer-events-none">
              <div className="absolute inset-0 bg-white blur-[100px]" />
            </motion.div>
          </AnimatePresence>

          <AnimatePresence>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 2, delay: 3.8 }} className="absolute inset-0 z-40 bg-[#020617] flex flex-col items-center justify-center font-sans">
              <motion.div initial={{ scale: 0.5, y: 100, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} transition={{ duration: 2.5, delay: 4.0, type: "spring", bounce: 0.3 }} className="relative z-10 flex flex-col items-center text-center px-6 overflow-visible">
                <motion.div initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 5.0, type: "spring" }} className="mb-8 px-6 py-2 rounded-full border border-blue-400/50 bg-blue-900/30 flex items-center gap-3">
                   <Sparkles className="text-blue-300" size={20} />
                   <span className="text-blue-200 font-bold tracking-[0.3em] uppercase text-xs">{ao.plusReachBadge}</span>
                </motion.div>
                <div className="relative mb-6 overflow-visible">
                  <h1 className="text-[60px] md:text-[110px] font-black tracking-tighter italic text-transparent bg-clip-text bg-gradient-to-b from-blue-100 via-white to-blue-500 drop-shadow-[0_0_80px_rgba(59,130,246,0.8)] p-4" style={{ lineHeight: 1 }}>
                    OFERTA <span className="text-transparent bg-clip-text bg-gradient-to-br from-blue-400 to-cyan-300">PLUS+</span>
                  </h1>
                </div>
                <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 5.5, duration: 1 }} className="text-2xl md:text-3xl text-zinc-300 font-medium max-w-3xl tracking-wide">
                  {ao.plusActivatedBody}
                </motion.p>
                
                {/* NAPRAWIONY TAG MOTION.BUTTON ZAMIAST BUTTON */}
                <motion.button initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 7.0, duration: 1 }} onClick={() => { window.location.href = '/moje-konto/crm'; }} className="mt-16 px-12 py-6 bg-blue-900/20 border-2 border-blue-500 text-white font-black uppercase tracking-[0.3em] rounded-full hover:bg-blue-600 transition-all duration-500 shadow-[0_0_30px_rgba(59,130,246,0.3)] text-xl relative overflow-hidden group">
                  <span className="relative z-10 drop-shadow-md">{ao.plusViewStats}</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-500 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                </motion.button>

              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      <PublishAuthGate
        open={authGateOpen}
        brand="home"
        onClose={() => setAuthGateOpen(false)}
        onAuthenticated={async (report) => {
          report("Publikuję ofertę nieruchomości…");
          await publishAfterAuth();
        }}
      />

      <ProPhotoSessionDialog
        open={photoSessionOpen}
        onClose={() => setPhotoSessionOpen(false)}
        draft={{
          propertyLabel: [data.title, data.city, data.district, data.address]
            .map((x) => String(x || '').trim())
            .filter(Boolean)
            .join(' · ') || undefined,
          propertyType: data.propertyType || undefined,
          transactionType: data.transactionType || undefined,
        }}
      />

    </main>
  );
}