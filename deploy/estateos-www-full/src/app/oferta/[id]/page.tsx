"use client";
import { useSearchParams, useRouter } from "next/navigation";
import PublicProfileModal from "@/components/PublicProfileModal";
import dynamic from "next/dynamic";
import { Suspense, useEffect, useState, use } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ArchiveX, Shield, Briefcase, CheckCircle2, CalendarPlus, Lock, Timer, FileImage, X, Maximize2, BedDouble, Layers, Calendar, Ruler, Home } from "lucide-react";
import { getOfferPageCopy } from "@/content/offerPageCopy";
import {
  describeOfferAgentCommission,
  formatBuyerAgentCommissionLine,
  formatCommissionAmountForDisplay,
} from "@/lib/agentCommission";
import {
  formatOfferBuildYear,
  formatOfferCondition,
  formatOfferPropertyType,
} from "@/lib/offerDisplayLabels";
import { isOutsidePolandBounds } from "@/lib/location/locationNameMatch";
import AppointmentModal from "@/components/AppointmentModal";
import BiddingModal from "@/components/BiddingModal";
import OfferShareLink from "@/components/offer/OfferShareLink";
import OfferOwnerPublishPanel from "@/components/offer/OfferOwnerPublishPanel";
import OfferDiscountPriceHero from "@/components/offer/OfferDiscountPriceHero";
import OfferPriceHistoryProSection from "@/components/offer/OfferPriceHistoryProSection";
import OfferMarketAnalysis from "@/components/market/OfferMarketAnalysis";
import OfferFavoriteButton from "@/components/offer/OfferFavoriteButton";
import OfferDiscoveryActions from "@/components/discovery/OfferDiscoveryActions";
import DiscoveryOfferExplainer from "@/components/discovery/DiscoveryOfferExplainer";
import EosButton from "@/components/ui/EosButton";
import DiscoveryVisitHint from "@/components/discovery/DiscoveryVisitHint";
import OfferGalleryLightbox from "@/components/offer/OfferGalleryLightbox";
import ClientPortalReturnBar from "@/components/portal/ClientPortalReturnBar";
import { offerPremarketUnlockMs } from "@/lib/offerPremarket";
import { useLocale } from "@/contexts/LocaleContext";
import { isOfferLegallyVerified } from "@/lib/legalVerificationStatus";
import { isOfferNewListing } from "@/lib/offerLifecycle";
import OfferDescriptionBody from "@/components/offer/OfferDescriptionBody";
import OfferFloorPlanPanel from "@/components/offers/OfferFloorPlanPanel";
import { parseFloorPlanScanMeta } from "@/lib/roomScan/parseFloorPlanScanMeta";
import OpenHouseOfferBanner from "@/components/offer/OpenHouseOfferBanner";
import OpenHouseReserveModal from "@/components/offer/OpenHouseReserveModal";
import AuctionOfferBanner from "@/components/offer/AuctionOfferBanner";
import AuctionBidModal from "@/components/offer/AuctionBidModal";
import ProfileWriteMessageButton from "@/components/contact/ProfileWriteMessageButton";
import OfferHeroMetaBar from "@/components/offer/OfferHeroMetaBar";
import LiveOfferHero from "@/components/offer/LiveOfferHero";
import OfferGuestAskModal from "@/components/offer/OfferGuestAskModal";
import type { OpenHouseEventRecord } from "@/lib/openHouseTypes";
import type { AuctionEventRecord } from "@/lib/auctionTypes";
import { getBestUserAvatarUrl, isAgencyUser } from "@/lib/userAvatar";
import {
  resolveSellerDisplayName,
  resolveSellerPersonName,
  resolveServicingCompanyName,
  isAgentOrAgencySeller,
} from "@/lib/sellerDisplay";
import { resolveRentAdminFeeAmount, formatRentAdminFeeCostsLabel } from "@/lib/offers/rentAdminFeeDisplay";
import { formatAdminFeeDisplay } from "@/lib/money/adminFee";
import { normalizeListingCurrency } from "@/lib/money/convert";
import { amenityLabelsFromOffer } from "@/lib/offerAmenities";
import { useFormatOfferPrice } from "@/hooks/useFormatOfferPrice";
import {
  formatAmountWithCurrency,
  resolveOfferDisplayAmount,
} from "@/lib/money/format";
import { resolveOfferListingPrice } from "@/lib/money/resolveListingPrice";
import { isStrictCity } from "@/lib/location/locationCatalog";
import { mosaicCellClass, offerPhotoMosaicCells } from "@/lib/offerPhotoMosaic";

const NeighborhoodMapPreview = dynamic(
  () => import("@/components/map/NeighborhoodMapPreview"),
  { ssr: false },
);

/** Wysokość fixed Navbar (h-20) + safe-area — pasek oferty zawsze poniżej nagłówka. */
const HERO_BELOW_NAV = 'calc(env(safe-area-inset-top, 0px) + 6.25rem)';

function OfferDetails({
  offer,
  currentUser,
  portalToken,
}: {
  offer: any;
  currentUser: any;
  portalToken?: string | null;
}) {
  const { locale, dict } = useLocale();
  const router = useRouter();
  const { formatOffer, pricePerSqmLabel, rate, preference } = useFormatOfferPrice();
  const t = getOfferPageCopy(locale);
  const priceFormatted = formatOffer(offer);
  const listingPrice = resolveOfferListingPrice(offer, rate);
  const dateLocale = locale === "pl" ? "pl" : "en";
  const isDiscounted = Boolean((offer as { isDiscounted?: boolean }).isDiscounted);
  const discountPercent = Number((offer as { priceDiscountPercent?: number }).priceDiscountPercent) || 0;
  const listPricePln = Number((offer as { listPricePln?: number }).listPricePln ?? (offer as { previousPrice?: number }).previousPrice ?? 0);
  const favoriteLabels =
    locale === 'en'
      ? { add: 'Save', remove: 'Saved' }
      : { add: 'Ulubione', remove: 'W ulubionych' };

  const tx = String(offer.transactionType || "sale").toLowerCase();
  const isRent = tx.includes("rent") || tx.includes("wynajem");
  const rentAdminFeeAmount = isRent ? resolveRentAdminFeeAmount(offer) : null;
  const listingCurrency = normalizeListingCurrency(offer.priceCurrency);
  const rentAdminFeeInline =
    rentAdminFeeAmount != null
      ? formatRentAdminFeeCostsLabel(
          rentAdminFeeAmount,
          locale === "en" ? "en" : locale === "uk" ? "uk" : "pl",
          listingCurrency,
          { preference, rate },
        )
      : null;
  const isDealRoom = offer.badges?.isPartner === true;
  const themeColors = {
    primaryBg: isDealRoom ? "bg-orange-500" : isRent ? "bg-blue-500" : "bg-emerald-500",
    primaryHover: isDealRoom ? "hover:bg-orange-400" : isRent ? "hover:bg-blue-400" : "hover:bg-emerald-400",
    primaryText: isDealRoom ? "text-black" : isRent ? "text-white" : "text-black",
    primaryShadow: isDealRoom
      ? "shadow-[0_15px_40px_rgba(249,115,22,0.3)]"
      : isRent
        ? "shadow-[0_15px_40px_rgba(59,130,246,0.3)]"
        : "shadow-[0_15px_40px_rgba(16,185,129,0.3)]",
    textActive: isDealRoom ? "text-orange-500" : isRent ? "text-blue-500" : "text-emerald-500",
    borderActive: isDealRoom ? "border-orange-500/30" : isRent ? "border-blue-500/30" : "border-emerald-500/30",
    hoverBorderActive: isDealRoom ? "hover:border-orange-400" : isRent ? "hover:border-blue-400" : "hover:border-emerald-400",
    glowActive: isDealRoom
      ? "shadow-[0_0_40px_rgba(249,115,22,0.3)]"
      : isRent
        ? "shadow-[0_0_40px_rgba(59,130,246,0.3)]"
        : "shadow-[0_0_40px_rgba(16,185,129,0.3)]",
    bgActiveSoft: isDealRoom ? "bg-orange-500/10" : isRent ? "bg-blue-500/10" : "bg-emerald-500/10",
  };
  const { scrollYProgress } = useScroll();
  const bgY = useTransform(scrollYProgress, [0, 0.25], ["0%", "12%"]);
  
  const rawImages = (() => {
    if (!offer.images) return [];
    if (Array.isArray(offer.images)) return offer.images.map(String);
    const raw = String(offer.images);
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : raw.split(",").map((s) => s.trim()).filter(Boolean);
    } catch {
      return raw.split(",").map((s) => s.trim()).filter(Boolean);
    }
  })();
  const plannedImages: string[] = Array.isArray(offer?.galleryPlan?.orderedAssets)
    ? (offer.galleryPlan.orderedAssets as unknown[])
        .map((v) => String(v || ""))
        .filter((v) => v.length > 5)
    : [];
  const allImages: string[] =
    plannedImages.length > 0
      ? plannedImages.filter((v, i, a) => a.indexOf(v) === i)
      : [offer.imageUrl, ...rawImages].filter(
          (v: string, i: number, a: string[]) => v && v.length > 5 && a.indexOf(v) === i,
        );
  const images: string[] = allImages.length > 0 ? allImages : ["/placeholder.jpg"];
  const thumbImages: string[] = images.slice(1);
  const mosaicCells = offerPhotoMosaicCells(Math.min(thumbImages.length, 6));
  const hiddenThumbCount = Math.max(0, thumbImages.length - mosaicCells.length);
  const galleryPersonalized = Boolean(offer?.galleryPersonalized);

  const offerStatus = String(offer.status || '').toUpperCase();
  const expiredByDate =
    offer.expiresAt && new Date(offer.expiresAt).getTime() < Date.now();
  const isArchived =
    offerStatus === 'ARCHIVED' ||
    offerStatus === 'SOLD' ||
    (offerStatus !== 'ACTIVE' && Boolean(expiredByDate));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBiddingOpen, setIsBiddingOpen] = useState(false);

  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [publicProfileId, setPublicProfileId] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const initialCountryName = String(offer?.localityCountry || "").trim();
  const initialCountryCode = String(offer?.localityCountryCode || "").trim().toUpperCase();
  const [resolvedCountry, setResolvedCountry] = useState<{ name: string; code: string }>(() => {
    if (initialCountryName && initialCountryCode) {
      return { name: initialCountryName, code: initialCountryCode };
    }
    const lat = Number(offer?.lat);
    const lng = Number(offer?.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng) && isOutsidePolandBounds(lat, lng)) {
      return { name: locale === "pl" ? "Inny kraj" : "Other country", code: "" };
    }
    return { name: locale === "pl" ? "Polska" : "Poland", code: "PL" };
  });

  const openGallery = (index: number) => {
    setCurrentImageIndex(index);
    setIsGalleryOpen(true);
  };

  const [negotiatorsCount, setNegotiatorsCount] = useState(0);
  const [isFloorplanModalOpen, setIsFloorplanModalOpen] = useState(false);
  const [openHouseEvent, setOpenHouseEvent] = useState<OpenHouseEventRecord | null>(null);
  const [isOpenHouseModalOpen, setIsOpenHouseModalOpen] = useState(false);
  const [auctionEvent, setAuctionEvent] = useState<AuctionEventRecord | null>(null);
  const [isAuctionModalOpen, setIsAuctionModalOpen] = useState(false);
  const [isGuestAskOpen, setIsGuestAskOpen] = useState(false);
  const isLegalKwVerified = isOfferLegallyVerified(offer);
  const isNewListing = isOfferNewListing(offer);
  const sellerAvatar = getBestUserAvatarUrl(offer?.user);
  const sellerIsAgency = isAgencyUser(offer?.user);
  const sellerLabel = resolveSellerDisplayName(
    offer?.user,
    offer?.user?.buyerType === "AGENCY" ? t.agency : t.privateOwner,
  );
  const sellerPersonLine = resolveSellerPersonName(offer?.user);

  // 🔥 SILNIK FOMO: LOGIKA CZASU I BLOKADY 🔥
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const isOwner =
    !!currentUser &&
    (Number(currentUser.id) === Number(offer.userId) ||
      currentUser.email === offer.user?.email ||
      currentUser.email === offer.contactEmail);
  const isAdminViewer = String(currentUser?.role || "").toUpperCase() === "ADMIN";
  const canManageOffer = isOwner || isAdminViewer;
  const isFormerOwnerViewer =
    !!currentUser &&
    offer.managementStatus === 'AGENCY_MANAGED' &&
    offer.originalOwnerUserId === currentUser.id &&
    offer.userId !== currentUser.id;
  const canContactSeller = !isFormerOwnerViewer;
  const isPro = offer._viewerIsPro || currentUser?.role === 'ADMIN' || Boolean(currentUser?.hasMarketPro || currentUser?.officePro);
  
  const unlockTime = offerPremarketUnlockMs(offer.createdAt);

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date().getTime();
      const diff = unlockTime - now;
      setTimeLeft(diff > 0 ? diff : 0);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [unlockTime]);

  // Ukrycie szczegółów do „premiery na szerokim rynku” (PRO i właściciel widzą od razu)
  const isLocked = timeLeft > 0 && !isPro && !isOwner;
  const contentSuppressed = isLocked || isArchived;

  // Formatowanie zegara (HH:MM:SS)
  const h = Math.floor(timeLeft / (1000 * 60 * 60));
  const m = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  const s = Math.floor((timeLeft % (1000 * 60)) / 1000);
  const timeString = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

  useEffect(() => {
    const fetchNegotiations = async () => {
      const offerId = offer.id || offer._id;
      if (!offerId) return;
      try {
        const res = await fetch(`/api/offers/${offerId}/negotiations`);
        if (res.ok) {
          const data = await res.json();
          setNegotiatorsCount(data.count || 0);
        }
      } catch (error) {}
    };
    fetchNegotiations();
  }, [offer]);

  useEffect(() => {
    const offerId = offer.id || offer._id;
    if (!offerId || isArchived) {
      setOpenHouseEvent(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/offers/${offerId}/open-house`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const event = data?.event as OpenHouseEventRecord | null;
        if (
          event &&
          event.status === "PUBLISHED" &&
          event.totalSpotsLeft > 0
        ) {
          setOpenHouseEvent(event);
        } else {
          setOpenHouseEvent(null);
        }
      })
      .catch(() => {
        if (!cancelled) setOpenHouseEvent(null);
      });
    return () => {
      cancelled = true;
    };
  }, [offer, isArchived]);

  useEffect(() => {
    const offerId = offer.id || offer._id;
    if (!offerId || isArchived) {
      setAuctionEvent(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/auction/offers/${offerId}`, { cache: "no-store", credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const event = data?.event as AuctionEventRecord | null;
        if (event && (event.status === "LIVE" || event.status === "SCHEDULED")) {
          setAuctionEvent(event);
        } else {
          setAuctionEvent(null);
        }
      })
      .catch(() => {
        if (!cancelled) setAuctionEvent(null);
      });
    return () => {
      cancelled = true;
    };
  }, [offer, isArchived]);

  const showOpenHouseBanner = Boolean(openHouseEvent);
  const showAuctionBanner = Boolean(auctionEvent);
  const openOpenHouseModal = () => setIsOpenHouseModalOpen(true);
  const openAuctionModal = () => setIsAuctionModalOpen(true);
  const offerLocale = locale === "uk" ? "uk" : locale === "en" ? "en" : "pl";
  const openHouseDateLabel = (() => {
    const raw = openHouseEvent?.nextSlotStartsAt;
    if (!raw) return null;
    const start = new Date(raw);
    if (!Number.isFinite(start.getTime()) || start.getTime() < Date.now()) return null;
    return start.toLocaleString(offerLocale === "en" ? "en-GB" : "pl-PL", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  })();

  const rawAreaStr = String(offer.area || '0').replace(/,/g, '.').replace(/[^\d.]/g, '');
  const numericArea = parseFloat(rawAreaStr) || 0;
  const rawPlotAreaStr = String(offer.plotArea || '').replace(/,/g, '.').replace(/[^\d.]/g, '');
  const numericPlotArea = parseFloat(rawPlotAreaStr) || 0;
  const propertyTypeRaw = String(offer.propertyType || '').toUpperCase();
  const cityRaw = String(offer.city || "").trim();
  const districtRaw = String(offer.district || "").trim();
  const streetRaw = String(offer.street || offer.address || "").trim();
  const addressNumberRaw = String(offer.buildingNumber || "").trim();
  const exactLocation = offer.isExactLocation !== false;
  const streetLine = exactLocation
    ? [streetRaw, addressNumberRaw].filter(Boolean).join(" ").trim()
    : streetRaw;
  const districtUpper = districtRaw.toUpperCase();
  const districtSpecified =
    districtRaw.length > 0 &&
    !["OTHER", "INNE", "INNY OBSZAR", "BRAK", "-", "N/A"].includes(districtUpper);
  const cityLooksGeneric = /reszta kraju|pozosta[ał]e|other|ca[łl]y kraj|polska/i.test(cityRaw);
  const strictCity = isStrictCity(cityRaw);
  const localityValue = isLocked
    ? t.hiddenLocation
    : !cityRaw || cityLooksGeneric
      ? districtSpecified
        ? districtRaw
        : streetRaw || t.noData
      : cityRaw;
  const showDistrictField = !isLocked && strictCity && districtSpecified;
  const districtValue = showDistrictField ? districtRaw : null;
  const cityLabel = cityLooksGeneric || !cityRaw ? t.locality : t.city;

  const plnResolved =
    listingPrice.amount > 0
      ? resolveOfferDisplayAmount({
          amount: listingPrice.amount,
          listingCurrency: listingPrice.currency,
          pricePln: listingPrice.plnAmount,
          displayPreference: "PLN",
          rate,
        })
      : null;
  const eurResolved =
    listingPrice.amount > 0
      ? resolveOfferDisplayAmount({
          amount: listingPrice.amount,
          listingCurrency: listingPrice.currency,
          pricePln: listingPrice.plnAmount,
          displayPreference: "EUR",
          rate,
        })
      : null;
  const perSqmDisplay = pricePerSqmLabel(offer);
  const perSqmPln =
    plnResolved && numericArea > 0
      ? `${Math.round(plnResolved.displayAmount / numericArea).toLocaleString(locale === "pl" ? "pl-PL" : "en-GB")} zł/m²`
      : t.noData;
  const perSqmEur =
    eurResolved && numericArea > 0
      ? `${Math.round(eurResolved.displayAmount / numericArea).toLocaleString(locale === "pl" ? "pl-PL" : "en-GB")} €/m²`
      : t.noData;

    // Sekcje Specyfikacji Luksusowej
  
  const amenityLabels = amenityLabelsFromOffer(offer as Record<string, unknown>, dict.addOffer);

  const ensureAuthenticated = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentUser) {
      alert(t.authRequired);
      window.location.href = '/login';
      return false;
    }
    return true;
  };

  const openBidFlow = (e: React.MouseEvent) => {
    if (!ensureAuthenticated(e)) return;
    setIsBiddingOpen(true);
  };

  const openAppointmentFlow = (e: React.MouseEvent) => {
    if (!ensureAuthenticated(e)) return;
    setIsModalOpen(true);
  };

  const locationParams = [
    { label: cityLabel, value: localityValue || t.noData },
    ...(districtValue ? [{ label: t.district, value: districtValue }] : []),
    { label: t.street, value: isLocked ? t.hiddenLocation : streetLine || t.noData },
  ].filter((p) => p.value);

  const yearBuiltLabel = formatOfferBuildYear(offer);
  const heatingLabel = offer.heating ? String(offer.heating) : null;
  const floorPlanSrc = String(offer.floorPlanUrl || offer.floorPlan || "").trim();
  const extraFloorPlanSrcs = (() => {
    const raw = offer.floorPlanExtraUrls;
    if (Array.isArray(raw)) return raw.map((item: unknown) => String(item || "").trim()).filter(Boolean);
    const text = String(raw || "").trim();
    if (!text) return [];
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map((item: unknown) => String(item || "").trim()).filter(Boolean);
    } catch {
      return text.split(",").map((item: string) => item.trim()).filter(Boolean);
    }
    return [];
  })();
  const floorPlan3dSrc = String(offer.floorPlan3dUrl || "").trim();
  const floorPlanScanMeta = parseFloorPlanScanMeta(offer.floorPlanScanMeta);
  const propertyTypeLabel = formatOfferPropertyType(offer.propertyType, locale);
  const floorDisplay = (() => {
    const floorVal = offer.floor != null && offer.floor !== "" ? String(offer.floor) : null;
    const totalVal =
      offer.totalFloors != null && offer.totalFloors !== "" ? String(offer.totalFloors) : null;
    if (floorVal && totalVal) return `${floorVal} / ${totalVal}`;
    return floorVal || totalVal;
  })();
  const transactionLabel = isRent
    ? locale === "en"
      ? "For rent"
      : locale === "uk"
        ? "Оренда"
        : "Wynajem"
    : locale === "en"
      ? "For sale"
      : locale === "uk"
        ? "Продаж"
        : "Sprzedaż";
  const adminFeeLabel =
    rentAdminFeeAmount != null
      ? formatAdminFeeDisplay({
          adminFeePln: rentAdminFeeAmount,
          listingCurrency,
          displayPreference: preference,
          rate,
          locale: dateLocale === "en" ? "en" : "pl",
        })
      : null;

  const mainParams = [
    {
      label: propertyTypeRaw === 'PLOT' ? t.plotArea : t.area,
      value: numericArea > 0 ? `${numericArea} m²` : null,
    },
    ...(propertyTypeRaw === 'HOUSE' && numericPlotArea > 0
      ? [{ label: t.plotArea, value: `${numericPlotArea} m²` }]
      : []),
    ...(propertyTypeRaw === 'PLOT'
      ? []
      : [
          {
            label: t.pricePerSqm,
            value: perSqmDisplay && !isLocked ? perSqmDisplay : isLocked ? t.hiddenPrice : null,
          },
          { label: t.rooms, value: offer.rooms != null && offer.rooms !== '' ? String(offer.rooms) : null },
          { label: t.floor, value: floorDisplay },
          ...(floorDisplay && offer.totalFloors != null && offer.totalFloors !== '' && !String(offer.floor ?? '').trim()
            ? [{ label: t.totalFloors, value: String(offer.totalFloors) }]
            : []),
          {
            label: t.standard,
            value: formatOfferCondition(offer.condition || offer.finishCondition, locale) || null,
          },
        ]),
  ].filter((p) => p.value);

  const quickFacts = [
    propertyTypeLabel ? { icon: Home, label: propertyTypeLabel } : null,
    numericArea > 0 ? { icon: Ruler, label: `${numericArea} m²` } : null,
    offer.rooms != null && offer.rooms !== "" ? { icon: BedDouble, label: `${offer.rooms} ${t.rooms.toLowerCase()}` } : null,
    floorDisplay ? { icon: Layers, label: floorDisplay } : null,
    yearBuiltLabel ? { icon: Calendar, label: yearBuiltLabel } : null,
    propertyTypeRaw === "HOUSE" && numericPlotArea > 0
      ? { icon: Ruler, label: `${t.plotArea}: ${numericPlotArea} m²` }
      : null,
  ].filter(Boolean) as Array<{ icon: typeof Home; label: string }>;

  const agentCommissionInfo = isAgentOrAgencySeller(offer?.user)
    ? describeOfferAgentCommission(offer, offer.price)
    : null;
  const agentCommissionAmountLabel = agentCommissionInfo
    ? formatCommissionAmountForDisplay(
        agentCommissionInfo.amount,
        offer,
        offer.price,
        preference,
        rate,
        dateLocale,
      )
    : null;
  const agentCommissionLine = agentCommissionInfo
    ? agentCommissionInfo.isZero
      ? t.agentCommissionZero
      : formatBuyerAgentCommissionLine(
          {
            ...agentCommissionInfo,
            amountLabel: agentCommissionAmountLabel ?? agentCommissionInfo.amountLabel,
          },
          locale,
        )
    : null;

  const buildingParams = [
    { label: t.buildingType, value: formatOfferPropertyType(offer.propertyType, locale) },
    { label: t.buildYear, value: yearBuiltLabel },
    { label: t.heating, value: heatingLabel },
    {
      label: t.furnished,
      value: offer.isFurnished === true ? t.furnishedYes : offer.isFurnished === false ? t.furnishedNo : null,
    },
    ...(isRent && adminFeeLabel ? [{ label: t.rentFee, value: adminFeeLabel }] : []),
    {
      label: t.availability,
      value: offer.availabilityDate
        ? new Date(offer.availabilityDate).toLocaleDateString(locale === "pl" ? "pl-PL" : "en-GB")
        : null,
    },
  ].filter((p) => p.value);
  const servicingCompanyName = resolveServicingCompanyName(offer?.user, offer?.agencyName);
  const agentPersonName = resolveSellerPersonName(offer?.user);
  const servicingCompanyLogoUrl = String(
    offer?.servicingCompanyLogoUrl || offer?.user?.companyLogoUrl || "",
  ).trim() || null;
  const agentPhotoUrl = String(
    offer?.agentPhotoUrl ||
      offer?.presentingAgent?.image ||
      offer?.user?.agentPhotoUrl ||
      sellerAvatar ||
      "",
  ).trim() || null;
  const showServicingCompanyBlock =
    isAgentOrAgencySeller(offer?.user) && Boolean(servicingCompanyName || agentPersonName);
  const showCommissionSection =
    Boolean(servicingCompanyName) ||
    Boolean(agentCommissionInfo) ||
    isAgentOrAgencySeller(offer?.user);

  const costsParams =
    agentCommissionInfo && !agentCommissionInfo.isZero
      ? [
          {
            label: t.commissionPercent,
            value: agentCommissionInfo.percentLabel,
          },
          {
            label: t.commissionAmount,
            value: agentCommissionAmountLabel,
          },
        ]
      : [];

  useEffect(() => {
    if (!offer?.lat || !offer?.lng) return;
    const lat = Number(offer.lat);
    const lng = Number(offer.lng);
    const storedCode = String(offer?.localityCountryCode || "").trim().toUpperCase();
    const storedName = String(offer?.localityCountry || "").trim();
    const pinOutsidePl = Number.isFinite(lat) && Number.isFinite(lng) && isOutsidePolandBounds(lat, lng);
    const needsReverse =
      pinOutsidePl && (!storedCode || storedCode === "PL") || !storedName || !storedCode;

    if (!needsReverse && storedName && storedCode) {
      setResolvedCountry({ name: storedName, code: storedCode });
      return;
    }

    let cancelled = false;
    fetch(`/api/location/reverse?lat=${encodeURIComponent(String(offer.lat))}&lng=${encodeURIComponent(String(offer.lng))}`, {
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const countryName = String(data.country || "").trim();
        const countryCode = String(data.countryCode || "").trim().toUpperCase();
        if (countryName && countryCode) {
          setResolvedCountry({ name: countryName, code: countryCode });
        } else if (countryName) {
          setResolvedCountry({ name: countryName, code: storedCode || "" });
        }
      })
      .catch(() => {
        /* noop */
      });
    return () => {
      cancelled = true;
    };
  }, [offer?.lat, offer?.lng, offer?.localityCountry, offer?.localityCountryCode]);

  const countryFlag = resolvedCountry.code
    ? String.fromCodePoint(
        ...resolvedCountry.code
          .slice(0, 2)
          .split("")
          .map((char) => 127397 + char.toUpperCase().charCodeAt(0)),
      )
    : "🌍";

  return (
    <main className="theme-aware-dashboard min-h-screen bg-[var(--eos-bg)] pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))] font-sans text-[var(--eos-text)] selection:bg-emerald-500/20 sm:pb-32">
      {portalToken ? <ClientPortalReturnBar token={portalToken} /> : null}
      
      <div className="eos-cinematic-dark relative h-[58svh] min-h-[52svh] w-full overflow-hidden bg-black sm:h-[100dvh] sm:min-h-[100vh]">
        <motion.div style={{ y: bgY }} className="absolute inset-0 z-0 overflow-hidden">
          <LiveOfferHero images={images} disabled={isArchived || isLocked} />
        </motion.div>
        <div className="absolute inset-0 eos-offer-hero-vignette z-10" />

        <div
          className="pointer-events-none absolute inset-x-0 z-40 max-h-[min(92%,calc(100%-0.75rem))] overflow-y-auto overscroll-contain px-3 sm:px-6"
          style={{ top: HERO_BELOW_NAV }}
        >
          <div className="mx-auto flex max-w-5xl flex-col gap-2.5 sm:gap-4">
            <div className="eos-offer-hero-chrome pointer-events-auto">
              <Link href="/odkryj-mape" className="eos-offer-hero-back">
                {t.backToMap}
              </Link>
              <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
                {!isArchived && !isLocked ? (
                  <div className="sm:hidden" onClick={(e) => e.stopPropagation()}>
                    <OfferDiscoveryActions
                      offerId={offer.id}
                      variant="compact"
                      trackOpen
                      source="web_offer_detail"
                      onRequireAuth={() => {
                        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
                      }}
                    />
                  </div>
                ) : null}
                <OfferFavoriteButton
                  offerId={offer.id}
                  variant="pill"
                  size={22}
                  labelAdd={favoriteLabels.add}
                  labelRemove={favoriteLabels.remove}
                  className="shrink-0"
                  onRequireAuth={() => {
                    window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
                  }}
                />
              </div>
            </div>
            {!isArchived && !isLocked ? (
              <div className="pointer-events-auto hidden sm:block" onClick={(e) => e.stopPropagation()}>
                <OfferDiscoveryActions
                  offerId={offer.id}
                  variant="full"
                  source="web_offer_detail"
                  onRequireAuth={() => {
                    window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
                  }}
                />
              </div>
            ) : null}

            {!isArchived ? (
              <h1 className="eos-offer-hero-title pointer-events-none hidden max-w-4xl self-center px-2 text-center text-3xl font-light leading-tight tracking-tighter [text-wrap:balance] sm:block sm:text-5xl md:text-5xl lg:text-6xl">
                {isLocked ? t.beforeLaunchTitle : offer.title}
              </h1>
            ) : null}

            {!isArchived ? (
            <div
              className="pointer-events-auto hidden w-full flex-col gap-3 md:flex"
              onClick={(e) => e.stopPropagation()}
            >
              {offer.isPresentedByAgent ? (
                <p className="rounded-2xl border border-emerald-500/35 bg-emerald-50 px-4 py-2.5 text-center text-[9px] font-black uppercase tracking-[0.18em] text-emerald-800 dark:border-emerald-400/40 dark:bg-emerald-500/20 dark:text-emerald-100">
                  {locale === "en" ? "Listing presented by your agent" : "Oferta prowadzona przez Twojego agenta"}
                  {offer.presentingAgent?.personName || offer.presentingAgent?.displayName
                    ? ` · ${offer.presentingAgent.personName || offer.presentingAgent.displayName}`
                    : ""}
                </p>
              ) : null}
              <OfferHeroMetaBar
                sellerLabel={sellerLabel}
                sellerPersonLine={sellerPersonLine}
                sellerAvatar={sellerAvatar}
                sellerIsAgency={sellerIsAgency}
                averageRating={Number(offer?.user?.reviewsData?.averageRating ?? offer?.sellerReviewsData?.averageRating ?? 0)}
                totalReviews={Number(offer?.user?.reviewsData?.totalReviews ?? offer?.sellerReviewsData?.totalReviews ?? 0)}
                isOnline={Boolean(offer?.user?.isOnline ?? offer?.sellerIsOnline)}
                lastSeenAt={
                  offer?.user?.lastSeenAt ?? offer?.sellerLastSeenAt ?? null
                }
                isOwner={isOwner}
                canAsk={canContactSeller && Boolean(offer?.user?.id || offer?.userId)}
                views={Number(offer?.views || 0)}
                favoritesCount={Number(offer?.favoritesCount || 0)}
                offerId={offer?.id || offer?._id}
                listedAtLabel={
                  offer?.createdAt
                    ? new Date(offer.createdAt).toLocaleDateString(locale === "pl" ? "pl-PL" : "en-GB")
                    : t.noData
                }
                isLegalKwVerified={isLegalKwVerified}
                isNewListing={isNewListing}
                themeTextActive={themeColors.textActive}
                themeBgActiveSoft={themeColors.bgActiveSoft}
                themeBorderActive={themeColors.borderActive}
                locale={locale}
                labels={{
                  ask: t.askSeller,
                  views: t.views,
                  favorites: t.favorites,
                  favoritesHint: t.favoritesHint,
                  offerId: t.offerId,
                  listedSince: t.listedSince,
                  online: t.sellerOnline,
                  offline: t.sellerOffline,
                  lastSeenPrefix: t.sellerLastSeenPrefix,
                  legalVerifiedKw: t.legalVerifiedKw,
                  legalUnverifiedKw: t.legalUnverifiedKw,
                  legalVerifiedKwSublabel: t.legalVerifiedKwSublabel,
                  newOfferBadge: t.newOfferBadge,
                  noData: t.noData,
                  openHouseMark: t.openHouse.markLabel,
                  openHouseDate: openHouseDateLabel,
                }}
                onOpenProfile={() => setPublicProfileId(String(offer?.user?.id || offer?.userId))}
                onAsk={() => setIsGuestAskOpen(true)}
                onOpenHousePress={openOpenHouseModal}
                onLegalShieldPress={() => router.push(`/edytuj-oferte/${offer?.id || offer?._id}?focus=kw`)}
              />

            {showAuctionBanner && auctionEvent ? (
              <AuctionOfferBanner
                variant="hero"
                event={auctionEvent}
                locale={offerLocale}
                copy={{
                  title: t.auction.bannerTitle,
                  subtitleLive: t.auction.bannerSubtitleLive,
                  subtitleScheduled: t.auction.bannerSubtitleScheduled,
                  cta: t.auction.bannerCta,
                  liveBadge: t.auction.liveBadge,
                }}
                onPress={openAuctionModal}
              />
            ) : null}
            {showOpenHouseBanner && openHouseEvent ? (
              <OpenHouseOfferBanner
                variant="hero"
                event={openHouseEvent}
                locale={offerLocale}
                copy={{
                  title: t.openHouse.bannerTitle,
                  subtitle: t.openHouse.bannerSubtitle,
                  cta: t.openHouse.bannerCta,
                }}
                onPress={openOpenHouseModal}
              />
            ) : null}
            </div>
            ) : null}
          </div>
        </div>

        {isArchived && (
          <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none px-4">
             <div className="bg-zinc-950/95 backdrop-blur-3xl border border-white/10 p-8 sm:p-12 rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.9)] text-center flex flex-col items-center max-w-lg w-full">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10">
                   <ArchiveX size={32} className="text-zinc-500" />
                </div>
                <p className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white mb-2">{t.archivedTitle}</p>
                <p className="text-zinc-500 text-xs sm:text-sm font-bold uppercase tracking-widest mb-4">{t.archivedSubtitle}</p>
                <h2 className="text-2xl sm:text-3xl font-light text-white mb-4 tracking-tight leading-snug [text-wrap:balance]">{offer.title}</h2>
                <p className="text-4xl sm:text-5xl font-light text-white tracking-tighter">
                  <span>{priceFormatted.primary}</span>
                  {rentAdminFeeInline ? (
                    <span className="ml-2 text-2xl sm:text-3xl font-normal text-zinc-400">
                      + {rentAdminFeeInline}
                    </span>
                  ) : null}
                </p>
                {!isLocked && priceFormatted.secondary ? (
                  <p className="mt-2 text-sm font-semibold text-zinc-400">{priceFormatted.secondary}</p>
                ) : null}
             </div>
          </div>
        )}
      </div>

      <div className="relative">
        {/* 🔥 POTEŻNA NAKŁADKA FOMO (WYŚWIETLA SIĘ TYLKO ZABLOKOWANYM) 🔥 */}
        {isLocked && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center px-4 pb-20">
            <div className="bg-zinc-950/90 backdrop-blur-3xl border border-white/10 p-8 sm:p-12 rounded-[3rem] max-w-2xl w-full shadow-[0_0_100px_rgba(0,0,0,0.9)] text-center relative overflow-hidden">
              <div className={`absolute inset-0 bg-gradient-to-b ${themeColors.bgActiveSoft} to-transparent opacity-50`}></div>
              
              <div className={`w-20 h-20 sm:w-24 sm:h-24 bg-black border border-white/10 rounded-full flex items-center justify-center mx-auto mb-6 sm:mb-8 relative z-10 ${themeColors.glowActive}`}>
                <Lock size={40} className={themeColors.textActive} />
              </div>
              
              <h2 className="text-2xl sm:text-4xl font-black text-white mb-4 relative z-10 tracking-tighter">{t.lockTitle}</h2>
              <p className="text-zinc-400 text-xs sm:text-sm mb-8 relative z-10 max-w-md mx-auto leading-relaxed">
                {t.lockBody}
              </p>
              
              <div className="relative z-10 mb-10 inline-flex items-center justify-center gap-3 sm:gap-4 rounded-2xl border border-white/[0.08] bg-black/25 px-5 sm:px-8 py-3.5 sm:py-4 backdrop-blur-md">
                <Timer size={28} className={`shrink-0 opacity-45 ${themeColors.textActive}`} aria-hidden />
                <span
                  className={`text-[2rem] sm:text-[3.25rem] font-semibold tabular-nums tracking-[0.12em] leading-none ${themeColors.textActive}`}
                  style={{ fontFeatureSettings: '"tnum" 1', WebkitFontSmoothing: "antialiased" }}
                  aria-live="polite"
                >
                  {timeString.replace(/:/g, " : ")}
                </span>
              </div>
              
              <Link href="/cennik" className={`block w-full py-5 sm:py-6 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest relative z-10 transition-colors ${themeColors.primaryBg} ${themeColors.primaryText} ${themeColors.primaryHover} ${themeColors.primaryShadow}`}>
                {t.unlockPro}
              </Link>
            </div>
          </div>
        )}

        {/* ORYGINALNA ZAWARTOŚĆ (ZAMAZANA JEŚLI ZABLOKOWANA) */}
        {isArchived ? (
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-30 pb-24" aria-hidden />
        ) : (
        <div className={`relative z-30 mx-auto flex max-w-[1400px] flex-col gap-6 px-4 transition-all duration-1000 sm:gap-8 sm:px-6 lg:px-8 xl:flex-row ${isLocked ? "h-[850px] select-none overflow-hidden opacity-20 blur-2xl pointer-events-none" : ""} ${isArchived ? "-mt-8 pb-24" : "mt-4 sm:-mt-10 md:-mt-14"}`}>
          
          <div className="flex flex-col gap-8 sm:gap-12 xl:w-2/3 xl:gap-16">
            {!isArchived ? (
              <div className="md:hidden">
                {offer.isPresentedByAgent ? (
                  <p className="mb-3 rounded-2xl border border-emerald-500/35 bg-emerald-50 px-4 py-2.5 text-center text-[9px] font-black uppercase tracking-[0.18em] text-emerald-800 dark:border-emerald-400/40 dark:bg-emerald-500/20 dark:text-emerald-100">
                    {locale === "en" ? "Listing presented by your agent" : "Oferta prowadzona przez Twojego agenta"}
                    {offer.presentingAgent?.personName || offer.presentingAgent?.displayName
                      ? ` · ${offer.presentingAgent.personName || offer.presentingAgent.displayName}`
                      : ""}
                  </p>
                ) : null}
                <OfferHeroMetaBar
                  sellerLabel={sellerLabel}
                  sellerPersonLine={sellerPersonLine}
                  sellerAvatar={sellerAvatar}
                  sellerIsAgency={sellerIsAgency}
                  averageRating={Number(offer?.user?.reviewsData?.averageRating ?? offer?.sellerReviewsData?.averageRating ?? 0)}
                  totalReviews={Number(offer?.user?.reviewsData?.totalReviews ?? offer?.sellerReviewsData?.totalReviews ?? 0)}
                  isOnline={Boolean(offer?.user?.isOnline ?? offer?.sellerIsOnline)}
                  lastSeenAt={
                    offer?.user?.lastSeenAt ?? offer?.sellerLastSeenAt ?? null
                  }
                  isOwner={isOwner}
                  canAsk={canContactSeller && Boolean(offer?.user?.id || offer?.userId)}
                  views={Number(offer?.views || 0)}
                  favoritesCount={Number(offer?.favoritesCount || 0)}
                  offerId={offer?.id || offer?._id}
                  listedAtLabel={
                    offer?.createdAt
                      ? new Date(offer.createdAt).toLocaleDateString(locale === "pl" ? "pl-PL" : "en-GB")
                      : t.noData
                  }
                  isLegalKwVerified={isLegalKwVerified}
                  isNewListing={isNewListing}
                  themeTextActive={themeColors.textActive}
                  themeBgActiveSoft={themeColors.bgActiveSoft}
                  themeBorderActive={themeColors.borderActive}
                  locale={locale}
                  labels={{
                    ask: t.askSeller,
                    views: t.views,
                    favorites: t.favorites,
                    favoritesHint: t.favoritesHint,
                    offerId: t.offerId,
                    listedSince: t.listedSince,
                    online: t.sellerOnline,
                    offline: t.sellerOffline,
                    lastSeenPrefix: t.sellerLastSeenPrefix,
                    legalVerifiedKw: t.legalVerifiedKw,
                    legalUnverifiedKw: t.legalUnverifiedKw,
                    legalVerifiedKwSublabel: t.legalVerifiedKwSublabel,
                    newOfferBadge: t.newOfferBadge,
                    noData: t.noData,
                    openHouseMark: t.openHouse.markLabel,
                    openHouseDate: openHouseDateLabel,
                  }}
                  onOpenProfile={() => setPublicProfileId(String(offer?.user?.id || offer?.userId))}
                  onAsk={() => setIsGuestAskOpen(true)}
                  onOpenHousePress={openOpenHouseModal}
                onLegalShieldPress={() => router.push(`/edytuj-oferte/${offer?.id || offer?._id}?focus=kw`)}
                />
              </div>
            ) : null}

            {thumbImages.length > 0 && (
              <div className="flex flex-col gap-3">
                {galleryPersonalized ? (
                  <p className="px-1 text-[10px] font-medium tracking-[0.04em] text-white/45 sm:text-[11px]">
                    Zdjęcia ułożone pod Twój kierunek · EstateOS™ Intelligence
                  </p>
                ) : null}
                <div className={`grid grid-cols-4 auto-rows-[72px] gap-0.5 overflow-hidden rounded-[1.5rem] border border-white/5 bg-black/20 shadow-2xl backdrop-blur-3xl sm:auto-rows-[110px] sm:gap-1 sm:rounded-[2.5rem] md:auto-rows-[150px] ${isArchived ? "grayscale opacity-50" : ""}`}>
                {thumbImages.slice(0, mosaicCells.length).map((src, idx) => (
                  <div
                    key={`${idx}-${src}`}
                    className={`${mosaicCellClass(mosaicCells[idx])} relative overflow-hidden bg-zinc-950`}
                  >
                    <img
                      onClick={() => openGallery(idx + 1)}
                      src={src}
                      alt=""
                      className="h-full w-full cursor-pointer object-cover transition-transform duration-500 hover:scale-[1.03]"
                      style={{ filter: "contrast(1.04) saturate(1.08) brightness(1.02)" }}
                    />
                    {hiddenThumbCount > 0 && idx === mosaicCells.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => openGallery(idx + 1)}
                        className="absolute inset-0 flex items-center justify-center bg-black/55 text-lg font-black text-white backdrop-blur-[2px] sm:text-2xl"
                      >
                        +{hiddenThumbCount}
                      </button>
                    ) : null}
                  </div>
                ))}
                </div>
              </div>
            )}

            <div className="relative z-10 min-w-0">
                <div className="mb-3 flex flex-wrap items-center gap-2 sm:mb-4 sm:hidden">
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${themeColors.borderActive} ${themeColors.bgActiveSoft} ${themeColors.textActive}`}
                  >
                    {transactionLabel}
                  </span>
                  {propertyTypeLabel ? (
                    <span className="inline-flex items-center rounded-full border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--eos-muted)]">
                      {propertyTypeLabel}
                    </span>
                  ) : null}
                </div>
                <h1 className="mb-2 text-[1.75rem] font-light leading-[1.15] tracking-tight text-[var(--eos-text)] [text-wrap:balance] sm:mb-7 sm:hidden sm:text-4xl sm:leading-tight sm:tracking-tighter">
                  {isLocked ? t.beforeLaunchTitle : offer.title}
                </h1>
                {!isLocked && (localityValue || districtValue) ? (
                  <p className="mb-5 text-sm leading-snug text-[var(--eos-muted)] sm:hidden">
                    {[localityValue, districtValue].filter(Boolean).join(", ")}
                  </p>
                ) : null}
                {!isLocked && !isArchived ? (
                  <div className="sm:hidden">
                    <DiscoveryOfferExplainer offerId={offer.id || offer._id} />
                  </div>
                ) : null}
                {showAuctionBanner && auctionEvent && !isLocked ? (
                  <div className="mb-6 sm:hidden">
                    <AuctionOfferBanner
                      variant="inline"
                      event={auctionEvent}
                      locale={offerLocale}
                      copy={{
                        title: t.auction.bannerTitle,
                        subtitleLive: t.auction.bannerSubtitleLive,
                        subtitleScheduled: t.auction.bannerSubtitleScheduled,
                        cta: t.auction.bannerCta,
                        liveBadge: t.auction.liveBadge,
                      }}
                      onPress={openAuctionModal}
                    />
                  </div>
                ) : null}
                {showOpenHouseBanner && openHouseEvent && !isLocked ? (
                  <div className="mb-6 sm:hidden">
                    <OpenHouseOfferBanner
                      variant="inline"
                      event={openHouseEvent}
                      locale={offerLocale}
                      copy={{
                        title: t.openHouse.bannerTitle,
                        subtitle: t.openHouse.bannerSubtitle,
                        cta: t.openHouse.bannerCta,
                      }}
                      onPress={openOpenHouseModal}
                    />
                  </div>
                ) : null}
                {!isLocked && !isArchived ? (
                  <div className="hidden sm:block">
                    <DiscoveryOfferExplainer offerId={offer.id || offer._id} />
                  </div>
                ) : null}
                <div className="mb-2">
                  {isDiscounted && discountPercent > 0 && listPricePln > 0 ? (
                    <OfferDiscountPriceHero
                      listPricePln={listPricePln}
                      currentPrimary={priceFormatted.primary}
                      discountPercent={discountPercent}
                    />
                  ) : (
                    <h2 className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[1.85rem] font-light tracking-tight text-[var(--eos-text)] sm:gap-x-3 sm:text-6xl sm:tracking-tighter md:text-7xl">
                      <span>{priceFormatted.primary}</span>
                      {rentAdminFeeInline ? (
                        <span className="text-lg font-normal text-[var(--eos-muted)] sm:text-4xl md:text-5xl">
                          + {rentAdminFeeInline}
                        </span>
                      ) : null}
                    </h2>
                  )}
                </div>
                {rentAdminFeeInline ? (
                  <p className="eos-muted-copy -mt-1 mb-4 text-xs sm:text-sm">
                    {isDiscounted ? `+ ${rentAdminFeeInline}` : t.rentCostsMonthlyHint}
                  </p>
                ) : null}
                {!isLocked && priceFormatted.secondary ? (
                  <p className="eos-muted-copy mb-6 text-sm font-semibold">{priceFormatted.secondary}</p>
                ) : (
                  <div className="mb-6" />
                )}
                {!isLocked && quickFacts.length > 0 ? (
                  <div className="mb-8 flex flex-wrap gap-2.5">
                    {quickFacts.map((fact) => {
                      const Icon = fact.icon;
                      return (
                        <div
                          key={fact.label}
                          className={`inline-flex items-center gap-2 rounded-2xl border bg-[var(--eos-input)] px-4 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${themeColors.borderActive}`}
                        >
                          <Icon size={15} className={themeColors.textActive} />
                          <span className="text-sm font-semibold text-[var(--eos-text)]">{fact.label}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                {!isLocked && listingPrice.amount > 0 && (
                  <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {eurResolved && priceFormatted.displayCurrency !== "EUR" ? (
                      <div className="eos-offer-metric-card px-4 py-3">
                        <p className="eos-offer-metric-label">{t.priceInEur}</p>
                        <p className="eos-offer-metric-value mt-1">
                          {formatAmountWithCurrency(eurResolved.displayAmount, "EUR", dateLocale)}
                        </p>
                      </div>
                    ) : null}
                    {plnResolved && priceFormatted.displayCurrency !== "PLN" ? (
                      <div className="eos-offer-metric-card px-4 py-3">
                        <p className="eos-offer-metric-label">{locale === "en" ? "Price in PLN" : "Cena w PLN"}</p>
                        <p className="eos-offer-metric-value mt-1">
                          {formatAmountWithCurrency(plnResolved.displayAmount, "PLN", dateLocale)}
                        </p>
                      </div>
                    ) : null}
                    <div className="eos-offer-metric-card px-4 py-3">
                      <p className="eos-offer-metric-label">{t.pricePerSqm}</p>
                      <p className="eos-offer-metric-value mt-1">{perSqmPln}</p>
                    </div>
                    <div className="eos-offer-metric-card px-4 py-3">
                      <p className="eos-offer-metric-label">{t.pricePerSqmEur}</p>
                      <p className="eos-offer-metric-value mt-1">{perSqmEur}</p>
                    </div>
                  </div>
                )}
                {!isLocked && agentCommissionLine ? (
                  <div className="eos-offer-panel mb-8 px-4 py-3">
                    <p className="text-sm text-[var(--eos-text)]">{agentCommissionLine}</p>
                    <p className="eos-subtle-copy mt-1 text-[11px]">{t.listingPriceIncludesCommission}</p>
                  </div>
                ) : null}

                {(floorPlanSrc || floorPlan3dSrc || floorPlanScanMeta) && !isLocked ? (
                  <OfferFloorPlanPanel
                    floorPlanSrc={floorPlanSrc}
                    extraFloorPlanSrcs={extraFloorPlanSrcs}
                    floorPlan3dSrc={floorPlan3dSrc || undefined}
                    scanMeta={floorPlanScanMeta}
                    locale={locale}
                    copy={t}
                    themeColors={themeColors}
                    variant="full"
                    onEnlarge={() => setIsFloorplanModalOpen(true)}
                  />
                ) : null}

                <div className="eos-offer-panel p-8 md:p-12">
                  <h3 className="eos-offer-metric-label mb-6">{t.aboutProperty}</h3>
                  <OfferDescriptionBody description={offer.description || ""} />
                </div>

                {amenityLabels.length > 0 && (
                <div className="eos-offer-panel mt-8 p-8 md:p-12">
                  <h3 className="eos-offer-metric-label mb-6">{t.amenities}</h3>
                  <div className="flex flex-wrap gap-3">
                    {amenityLabels.map((amenity: string, idx: number) => (
                      <div key={idx} className={`flex items-center gap-2 rounded-2xl border bg-[var(--eos-input)] px-4 py-2.5 ${themeColors.borderActive}`}>
                        <CheckCircle2 size={16} className={themeColors.textActive} />
                        <span className="text-sm font-semibold text-[var(--eos-text)]">{amenity.trim()}</span>
                      </div>
                    ))}
                  </div>
                </div>
                )}

                <OfferPriceHistoryProSection
                  offerId={Number(offer.id ?? offer._id)}
                  enabled={Boolean(isPro && !isLocked)}
                />
                {!isLocked ? (
                  <OfferMarketAnalysis
                    lat={Number(offer.lat)}
                    lng={Number(offer.lng)}
                    area={numericArea || null}
                    rooms={Number(offer.rooms) || null}
                    floor={Number(offer.floor) || null}
                    city={cityRaw || "Warszawa"}
                    district={districtSpecified ? districtRaw : null}
                    address={[streetRaw, cityRaw].filter(Boolean).join(", ")}
                    price={plnResolved?.displayAmount || listingPrice.plnAmount || listingPrice.amount || null}
                    hasMarketPro={Boolean(isPro)}
                    teaserHref={
                      currentUser &&
                      (String(currentUser.role || "").toUpperCase() === "AGENT" ||
                        String(currentUser.planType || "").toUpperCase() === "AGENCY")
                        ? "/moje-konto/firma?upgrade=pro#pakiet"
                        : "/cennik"
                    }
                    teaserCta={
                      currentUser &&
                      (String(currentUser.role || "").toUpperCase() === "AGENT" ||
                        String(currentUser.planType || "").toUpperCase() === "AGENCY")
                        ? "Ulepsz do Partner Pro"
                        : "Odblokuj Investor Pro"
                    }
                  />
                ) : null}

            </div>
          </div>

          <div className="xl:w-1/3 flex flex-col relative mt-8 xl:mt-0">
            <div className="xl:sticky top-32 space-y-6 pt-2">
              
              <div className="space-y-8">
                <div className="eos-offer-panel p-6">
                  <h4 className={`eos-offer-metric-label mb-5 ml-2 ${themeColors.textActive}`}>{t.locationSection}</h4>
                  <div className="mb-3 flex items-center justify-between rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--eos-muted)]">{t.country}</span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--eos-border)] bg-[var(--eos-card)] px-3 py-1.5 text-sm font-bold text-[var(--eos-text)] shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-white/90 to-white/55 text-base shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_4px_10px_rgba(0,0,0,0.15)]">
                        {countryFlag}
                      </span>
                      {resolvedCountry.name}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {locationParams.map((param, idx) => (
                      <div key={idx} className="flex items-center justify-between rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] p-4 transition-colors hover:bg-[var(--eos-surface-strong)]">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--eos-muted)]">{param.label}</span>
                        <span className="max-w-[65%] text-right text-sm font-bold text-[var(--eos-text)]">{param.value}</span>
                      </div>
                    ))}
                  </div>
                  {offer?.lat && offer?.lng ? (
                    <div className="mt-5">
                      <NeighborhoodMapPreview
                        lat={Number(offer.lat)}
                        lng={Number(offer.lng)}
                        street={offer.street}
                        city={offer.city}
                        district={offer.district}
                        variant="offer"
                        showPin={exactLocation}
                        sectionLabel={t.neighborhoodPreview}
                      />
                    </div>
                  ) : null}
                </div>

                {(floorPlanSrc || floorPlan3dSrc || floorPlanScanMeta) && !isLocked ? (
                  <OfferFloorPlanPanel
                    floorPlanSrc={floorPlanSrc}
                    extraFloorPlanSrcs={extraFloorPlanSrcs}
                    floorPlan3dSrc={floorPlan3dSrc || undefined}
                    scanMeta={floorPlanScanMeta}
                    locale={locale}
                    copy={t}
                    themeColors={themeColors}
                    variant="compact"
                    onEnlarge={() => setIsFloorplanModalOpen(true)}
                  />
                ) : null}

                <div className="eos-offer-panel p-6">
                  <h4 className={`eos-offer-metric-label mb-5 ml-2 ${themeColors.textActive}`}>{t.mainParamsSection}</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {mainParams.map((param, idx) => (
                      <div key={idx} className="flex min-h-[90px] flex-col justify-between rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] p-4 transition-colors hover:bg-[var(--eos-surface-strong)]">
                        <span className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--eos-muted)]">{param.label}</span>
                        <span className="text-lg font-bold text-[var(--eos-text)]">{param.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {buildingParams.length > 0 && (
                  <div className="eos-offer-panel p-6">
                    <h4 className={`eos-offer-metric-label mb-5 ml-2 ${themeColors.textActive}`}>{t.buildingSection}</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {buildingParams.map((param, idx) => (
                        <div key={idx} className="flex min-h-[90px] flex-col justify-between rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] p-4 transition-colors hover:bg-[var(--eos-surface-strong)]">
                          <span className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--eos-muted)]">{param.label}</span>
                          <span className="text-base font-bold text-[var(--eos-text)]">{param.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {showCommissionSection && !contentSuppressed && (
                  <div className="eos-offer-panel p-6">
                    <h4 className={`eos-offer-metric-label mb-5 ml-2 ${themeColors.textActive}`}>{t.costsSection}</h4>
                    {agentCommissionInfo?.isZero ? (
                      <div className="mb-4 rounded-2xl border-2 border-emerald-500/45 bg-emerald-500/15 px-4 py-6 text-center shadow-[0_0_40px_rgba(16,185,129,0.12)]">
                        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-emerald-500">
                          {t.commissionZeroBadge}
                        </p>
                        <p className="mt-2 text-3xl sm:text-4xl font-black uppercase tracking-tight text-emerald-400">
                          {t.commissionZeroTitle}
                        </p>
                        <p className="mt-3 text-xs sm:text-sm leading-relaxed text-[var(--eos-muted)] max-w-md mx-auto">
                          {t.commissionZeroSub}
                        </p>
                      </div>
                    ) : costsParams.length > 0 ? (
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        {costsParams.map((param, idx) => (
                          <div key={idx} className="flex min-h-[90px] flex-col justify-between rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] p-4 transition-colors hover:bg-[var(--eos-surface-strong)]">
                            <span className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--eos-muted)]">{param.label}</span>
                            <span className="text-base font-bold text-[var(--eos-text)]">{param.value}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {showServicingCompanyBlock ? (
                      <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] p-4 sm:p-5">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--eos-muted)]">
                          {t.commissionCompany}
                        </p>

                        <div className="mt-4 flex flex-col items-center text-center">
                          <div className="flex size-20 items-center justify-center overflow-hidden rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] shadow-[var(--eos-shadow-soft)] sm:size-24">
                            {servicingCompanyLogoUrl ? (
                              <img
                                src={servicingCompanyLogoUrl}
                                alt={t.companyLogoAlt}
                                className="h-full w-full object-contain p-2"
                              />
                            ) : (
                              <Briefcase className={`size-8 ${themeColors.textActive}`} aria-hidden />
                            )}
                          </div>
                          {servicingCompanyName ? (
                            <p className="mt-3 text-base font-bold leading-snug text-[var(--eos-text)] sm:text-lg">
                              {servicingCompanyName}
                            </p>
                          ) : null}
                        </div>

                        {(agentPhotoUrl || agentPersonName) ? (
                          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] px-3 py-3">
                            <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--eos-border)] bg-[var(--eos-input)]">
                              {agentPhotoUrl ? (
                                <img
                                  src={agentPhotoUrl}
                                  alt={t.agentPhotoAlt}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span className="text-lg" aria-hidden>
                                  👤
                                </span>
                              )}
                            </div>
                            <div className="min-w-0 text-left">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--eos-muted)]">
                                {t.agentRoleLabel}
                              </p>
                              {agentPersonName ? (
                                <p className="truncate text-sm font-semibold text-[var(--eos-text)]">
                                  {agentPersonName}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        ) : null}

                        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                          <button
                            type="button"
                            onClick={() => setPublicProfileId(String(offer?.user?.id || offer?.userId))}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-[var(--eos-border)] bg-[var(--eos-card)] px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-[var(--eos-text)] transition-colors hover:text-emerald-400"
                          >
                            {t.openCompanyProfile}
                          </button>
                          {!isOwner && canContactSeller && (offer?.user?.id || offer?.userId) ? (
                            currentUser?.id ? (
                              <ProfileWriteMessageButton
                                peerUserId={Number(offer?.user?.id || offer?.userId)}
                                peerName={sellerLabel}
                                currentUserId={currentUser?.id}
                                variant="light"
                                label={t.contactSeller}
                                className="!min-h-0 flex-1 !px-3 !py-2.5"
                              />
                            ) : (
                              <EosButton
                                type="button"
                                variant="home"
                                size="sm"
                                onClick={() => setIsGuestAskOpen(true)}
                                className="flex-1 !whitespace-normal"
                              >
                                {t.askSeller}
                              </EosButton>
                            )
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                    {agentCommissionLine && !agentCommissionInfo?.isZero ? (
                      <p className="eos-subtle-copy mt-3 text-[11px]">{agentCommissionLine}</p>
                    ) : null}
                  </div>
                )}
              </div>

              <AnimatePresence>
                {negotiatorsCount > 0 && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-4 bg-[#0a0a0a] border border-red-500/20 rounded-full px-6 py-3 mb-6 shadow-[0_0_30px_rgba(239,68,68,0.1)] justify-center relative overflow-hidden group cursor-default mt-6">
                    <div className="absolute inset-0 bg-red-500/5 group-hover:bg-red-500/10 transition-colors"></div>
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 shadow-[0_0_10px_#ef4444]"></span>
                    </span>
                    <span className="text-[10px] text-white/90 font-black uppercase tracking-[0.2em] relative z-10">
                      {negotiatorsCount === 1 ? t.negotiatorsOne : t.negotiatorsMany(negotiatorsCount)}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="bg-zinc-900/50 border border-white/10 rounded-[2.5rem] p-3 backdrop-blur-3xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] relative overflow-hidden">
                {isFormerOwnerViewer ? (
                  <div className="rounded-[2rem] border border-blue-500/25 bg-blue-500/10 px-6 py-8 text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-300">Podgląd właściciela</p>
                    <p className="mt-3 text-sm leading-relaxed text-white/70">
                      Ta nieruchomość jest zarządzana przez agencję. Widzisz wszystkie zmiany na bieżąco — kontakt z kupującymi i umawianie spotkań obsługuje biuro.
                    </p>
                  </div>
                ) : !canManageOffer ? (
                <div className="flex flex-col gap-3 relative z-10">
                  {isArchived ? (
                  <div className="py-8 text-center flex flex-col items-center justify-center">
                     <ArchiveX size={24} className="text-zinc-600 mb-3" />
                     <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">{t.contactDisabled}</p>
                  </div>
                ) : (
                  <>
                    <DiscoveryVisitHint
                      offerId={offer.id || offer._id}
                      className="mb-1 border-emerald-500/20 bg-emerald-500/[0.08]"
                    />
                    <button
                    onClick={openBidFlow}
                    className={`relative overflow-hidden w-full group flex flex-col items-center justify-center gap-1.5 rounded-[2rem] px-4 py-6 transition-all duration-500 hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${themeColors.primaryBg} ${themeColors.primaryText} ${themeColors.primaryShadow}`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                    
                    <span className="relative z-10 flex items-center gap-3 text-lg sm:text-xl font-black tracking-tight">
                      <Briefcase size={22} /> {t.submitOffer}
                    </span>
                    <span className="relative z-10 text-[9px] font-black uppercase tracking-[0.3em] opacity-70">
                      {t.startNegotiations}
                    </span>
                  </button>

                  <button
                    onClick={openAppointmentFlow}
                    className={`relative overflow-hidden w-full group flex items-center justify-center gap-3 rounded-[2rem] border px-4 py-5 transition-all duration-500 hover:scale-[1.02] active:scale-[0.98] cursor-pointer bg-zinc-950/80 ${themeColors.borderActive} ${themeColors.hoverBorderActive} ${themeColors.glowActive}`}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-r from-transparent ${themeColors.bgActiveSoft} to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out`}></div>
                    <CalendarPlus size={18} className={`relative z-10 transition-all duration-300 ${themeColors.textActive} group-hover:text-white group-hover:scale-125 group-hover:-translate-y-0.5 group-hover:rotate-[-5deg]`} />
                    <span className={`relative z-10 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] transition-colors duration-300 ${themeColors.textActive} group-hover:text-white`}>
                      {t.proposeViewing}
                    </span>
                  </button>

                  <div className="mt-2 mb-3 flex items-center justify-center gap-1.5 opacity-40 select-none">
                    <Shield size={10} className="text-white" />
                    <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white">{t.securedBy}</span>
                  </div>

                  <OfferShareLink
                    offerId={Number(offer.id ?? offer._id)}
                    presentingAgentId={
                      offer.isPresentedByAgent
                        ? Number(offer.presentingAgent?.userId ?? offer.user?.id)
                        : currentUser?.id && isAgentOrAgencySeller(currentUser)
                          ? Number(currentUser.id)
                          : undefined
                    }
                  />

                  </>
                )}
                </div>
                ) : (
                <OfferOwnerPublishPanel
                  offerId={Number(offer.id ?? offer._id)}
                  presentingAgentId={
                    offer.isPresentedByAgent
                      ? Number(offer.presentingAgent?.userId ?? offer.user?.id)
                      : currentUser?.id && isAgentOrAgencySeller(currentUser)
                        ? Number(currentUser.id)
                        : undefined
                  }
                />
                )}
              </div>

            </div>
          </div>
        </div>
        )}
      </div>
      
      <AppointmentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} offerId={offer.id || offer._id} sellerId={offer.userId || offer.user?.id || ""} />
      
      {isBiddingOpen && (
         <BiddingModal offerId={offer.id || offer._id} currentPrice={listingPrice.plnAmount} onClose={() => setIsBiddingOpen(false)} />
      )}

      <AnimatePresence>
        {isFloorplanModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="eos-cinematic-dark fixed inset-0 z-[999999] bg-black/95 backdrop-blur-xl flex items-start overflow-y-auto pt-10 pb-10 sm:pt-20 sm:pb-20 justify-center p-4 sm:p-8"
            onClick={() => setIsFloorplanModalOpen(false)}
          >
            <button onClick={() => setIsFloorplanModalOpen(false)} className="absolute top-6 right-6 p-4 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-50">
              <X size={24} />
            </button>
            <motion.div initial={{ scale: 0.96, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 16 }} className="relative w-full max-w-6xl" onClick={(e) => e.stopPropagation()}>
              <OfferFloorPlanPanel
                floorPlanSrc={floorPlanSrc}
                extraFloorPlanSrcs={extraFloorPlanSrcs}
                floorPlan3dSrc={floorPlan3dSrc || undefined}
                scanMeta={floorPlanScanMeta}
                locale={locale}
                copy={t}
                themeColors={themeColors}
                variant="full"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <OfferGalleryLightbox
        images={images}
        index={currentImageIndex}
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
        onIndexChange={setCurrentImageIndex}
        accentClass={themeColors.textActive}
        primaryHoverClass={themeColors.primaryHover}
        borderActiveClass={themeColors.borderActive}
        glowActiveClass={themeColors.glowActive}
      />

    
      <PublicProfileModal 
        isOpen={!!publicProfileId} 
        userId={publicProfileId} 
        onClose={() => setPublicProfileId(null)} 
      />

      <OfferGuestAskModal
        isOpen={isGuestAskOpen}
        onClose={() => setIsGuestAskOpen(false)}
        offerId={Number(offer.id || offer._id)}
        offerTitle={String(offer.title || `Oferta #${offer.id || offer._id}`)}
        copy={t.guestAsk}
        defaultPhone={String(currentUser?.phone || '')}
        defaultName={String(currentUser?.name || '').split(' ')[0] || ''}
      />

      <OpenHouseReserveModal
        isOpen={isOpenHouseModalOpen}
        eventId={openHouseEvent?.id ?? null}
        currentUser={currentUser}
        locale={locale}
        onClose={() => setIsOpenHouseModalOpen(false)}
        onRequireAuth={() => {
          window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
        }}
      />

      <AuctionBidModal
        isOpen={isAuctionModalOpen}
        eventId={auctionEvent?.id ?? null}
        currentUser={currentUser}
        locale={locale}
        onClose={() => setIsAuctionModalOpen(false)}
        onRequireAuth={() => {
          window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
        }}
      />
    </main>
  );
}

export default function SingleOfferPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<OfferPageLoading />}>
      <SingleOfferPageInner params={params} />
    </Suspense>
  );
}

function OfferPageLoading() {
  return (
    <main className="theme-aware-dashboard min-h-screen bg-[var(--eos-bg)]">
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="size-10 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-500" />
        <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[var(--eos-muted)]">
          Ładowanie oferty…
        </p>
      </div>
    </main>
  );
}

function SingleOfferPageInner({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const searchParams = useSearchParams();
  const [offer, setOffer] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const portal = searchParams.get("portal");
  const agent = searchParams.get("agent");
  const offerQs = new URLSearchParams();
  if (portal) offerQs.set("portal", portal);
  else if (agent) offerQs.set("agent", agent);
  const offerQuery = offerQs.toString() ? `?${offerQs.toString()}` : "";
  
  useEffect(() => {
    const fetchUserAndOffer = async () => {
      let userData: any = null;
      try {
        const userRes = await fetch('/api/user/profile');
        if (userRes.ok) {
          userData = await userRes.json();
          if (userData?.email) setCurrentUser(userData);
        }
      } catch (e) {}

      const id = resolvedParams.id;
      if (!id) {
        setLoadState("error");
        return;
      }
      try {
        fetch(`/api/offers/${id}/view`, {
          method: 'POST',
          headers: { 'x-client-source': 'web' }
        }).catch(() => {});
        const res = await fetch(`/api/offers/${id}${offerQuery}`);
        if (res.ok) {
          const data = await res.json();
          setOffer(data);
          setLoadState("ready");
        } else {
          setLoadState("error");
        }
      } catch (error) {
        console.error("Błąd ładowania oferty:", error);
        setLoadState("error");
      }
    };
    void fetchUserAndOffer();
  }, [resolvedParams, offerQuery]);

  useEffect(() => {
    if (loadState !== "ready" || !offer) return;
    const sellerId = Number(offer?.user?.id || offer?.userId || 0);
    if (!Number.isFinite(sellerId) || sellerId <= 0) return;

    let cancelled = false;
    const refresh = async () => {
      try {
        const res = await fetch(`/api/presence/status?userId=${sellerId}`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const online = Boolean(data?.isOnline);
        const lastSeenAt = data?.lastSeenAt ? String(data.lastSeenAt) : null;
        setOffer((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            sellerIsOnline: online,
            sellerLastSeenAt: lastSeenAt ?? prev.sellerLastSeenAt ?? null,
            user: prev.user
              ? {
                  ...prev.user,
                  isOnline: online,
                  lastSeenAt: lastSeenAt ?? prev.user.lastSeenAt ?? null,
                }
              : prev.user,
          };
        });
      } catch {
        /* ignore */
      }
    };

    const id = window.setInterval(() => void refresh(), 30_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [loadState, offer?.user?.id, offer?.userId]);

  if (loadState === "loading") return <OfferPageLoading />;

  if (loadState === "error" || !offer) {
    return (
      <main className="theme-aware-dashboard flex min-h-screen flex-col items-center justify-center bg-[var(--eos-bg)] px-6 pb-24 pt-32 text-center text-[var(--eos-text)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--eos-muted)]">Oferta</p>
        <h1 className="mt-4 max-w-lg text-3xl font-semibold tracking-tight">Nie udało się wczytać oferty</h1>
        <p className="mt-4 max-w-md text-[17px] leading-relaxed text-[var(--eos-muted)]">
          Oferta mogła wygasnąć lub adres jest nieprawidłowy. Możesz wrócić do wizytówki lub założyć konto.
        </p>
        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href={`/o/${resolvedParams.id}${offerQuery}`}
            className="inline-flex min-h-[48px] min-w-[200px] items-center justify-center rounded-full bg-emerald-500 px-8 text-[15px] font-semibold text-black"
          >
            Wizytówka oferty
          </Link>
          <Link
            href="/oferty"
            className="inline-flex min-h-[48px] min-w-[200px] items-center justify-center rounded-full border border-[var(--eos-border)] bg-[var(--eos-input)] px-8 text-[15px] font-semibold text-[var(--eos-text)]"
          >
            Przeglądaj oferty
          </Link>
        </div>
      </main>
    );
  }
  
  return <OfferDetails offer={offer} currentUser={currentUser} portalToken={portal} />;
}
