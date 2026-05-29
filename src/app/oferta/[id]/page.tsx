"use client";
import PublicProfileModal from "@/components/PublicProfileModal";
import { useEffect, useState, useRef, use } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ArchiveX, Eye, Shield, Briefcase, CheckCircle2, CalendarPlus, Star, Lock, Timer, FileImage, X, Maximize2, ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";
import { getOfferPageCopy } from "@/content/offerPageCopy";
import {
  describeOfferAgentCommission,
  formatBuyerAgentCommissionLine,
} from "@/lib/agentCommission";
import {
  formatOfferBuildYear,
  formatOfferCondition,
  formatOfferPropertyType,
} from "@/lib/offerDisplayLabels";
import AppointmentModal from "@/components/AppointmentModal";
import BiddingModal from "@/components/BiddingModal";
import OfferShareLink from "@/components/offer/OfferShareLink";
import OfferFavoriteButton from "@/components/offer/OfferFavoriteButton";
import { offerPremarketUnlockMs } from "@/lib/offerPremarket";
import { useLocale } from "@/contexts/LocaleContext";
import { isOfferLegallyVerified } from "@/lib/legalVerificationStatus";
import { isOfferNewListing } from "@/lib/offerLifecycle";
import LegalVerifiedShieldBadge from "@/components/offer/LegalVerifiedShieldBadge";
import { getBestUserAvatarUrl, isAgencyUser } from "@/lib/userAvatar";
import {
  resolveSellerDisplayName,
  resolveSellerPersonName,
} from "@/lib/sellerDisplay";
import { useFormatOfferPrice } from "@/hooks/useFormatOfferPrice";
import {
  formatAmountWithCurrency,
  resolveOfferDisplayAmount,
} from "@/lib/money/format";
import { resolveOfferListingPrice } from "@/lib/money/resolveListingPrice";
import { isStrictCity } from "@/lib/location/locationCatalog";

/** Wysokość fixed Navbar (h-20) + safe-area — pasek oferty zawsze poniżej nagłówka. */
const HERO_BELOW_NAV = 'calc(env(safe-area-inset-top, 0px) + 6.25rem)';

function OfferDetails({ offer, currentUser }: { offer: any, currentUser: any }) {
  const { locale } = useLocale();
  const { formatOffer, pricePerSqmLabel, rate } = useFormatOfferPrice();
  const t = getOfferPageCopy(locale);
  const priceFormatted = formatOffer(offer);
  const listingPrice = resolveOfferListingPrice(offer, rate);
  const favoriteLabels =
    locale === 'en'
      ? { add: 'Save', remove: 'Saved' }
      : { add: 'Ulubione', remove: 'W ulubionych' };

  const tx = String(offer.transactionType || "sale").toLowerCase();
  const isRent = tx.includes("rent") || tx.includes("wynajem");
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
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "15%"]);
  
  const rawImages = (() => { if (!offer.images) return []; try { const p = JSON.parse(offer.images); return Array.isArray(p) ? p : offer.images.split(','); } catch(e) { return offer.images.split(','); } })();
  const allImages = [offer.imageUrl, ...rawImages].filter((v: string, i: number, a: string[]) => v && v.length > 5 && a.indexOf(v) === i);
  const images = allImages.length > 0 ? allImages : ["/placeholder.jpg"];

  const isArchived = offer.status === 'ARCHIVED' || (offer.expiresAt && new Date(offer.expiresAt).getTime() < Date.now());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBiddingOpen, setIsBiddingOpen] = useState(false);

  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [publicProfileId, setPublicProfileId] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [resolvedCountry, setResolvedCountry] = useState<{ name: string; code: string }>({
    name: locale === "pl" ? "Polska" : "Poland",
    code: "PL",
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isGalleryOpen) return;
      if (e.key === 'Escape') setIsGalleryOpen(false);
      if (e.key === 'ArrowRight') setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
      if (e.key === 'ArrowLeft') setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGalleryOpen, images.length]);

  const openGallery = (index: number) => {
    setCurrentImageIndex(index);
    setIsGalleryOpen(true);
  };

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const [negotiatorsCount, setNegotiatorsCount] = useState(0);
  const [isFloorplanModalOpen, setIsFloorplanModalOpen] = useState(false);
  const verificationStatus = String(offer.verificationStatus || "UNVERIFIED");
  const verificationUi =
    verificationStatus === "VERIFIED"
      ? { label: t.verified, hint: t.verifiedHint, cls: "text-emerald-300 bg-emerald-500/12 border-emerald-500/35" }
      : verificationStatus === "PENDING_REVIEW"
        ? { label: t.pendingReview, hint: t.pendingHint, cls: "text-amber-300 bg-amber-500/12 border-amber-500/35" }
        : { label: t.notVerified, hint: t.notVerifiedHint, cls: "text-zinc-300 bg-white/5 border-white/15" };
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
  const isOwner = currentUser && (currentUser.id === offer.userId || currentUser.email === offer.user?.email || currentUser.email === offer.contactEmail);
  const isPro = offer._viewerIsPro || currentUser?.role === 'ADMIN';
  
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

  const rawAreaStr = String(offer.area || '0').replace(/,/g, '.').replace(/[^\d.]/g, '');
  const numericArea = parseFloat(rawAreaStr) || 0;
  const dateLocale = locale === "pl" ? "pl" : "en";
  const cityRaw = String(offer.city || "").trim();
  const districtRaw = String(offer.district || "").trim();
  const streetRaw = String(offer.street || offer.address || "").trim();
  const addressNumberRaw = String(offer.buildingNumber || "").trim();
  const streetLine = [streetRaw, addressNumberRaw].filter(Boolean).join(" ").trim();
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

  const mainParams = [
    { label: t.area, value: numericArea > 0 ? `${numericArea} m²` : null },
    {
      label: t.pricePerSqm,
      value: perSqmDisplay && !isLocked ? perSqmDisplay : isLocked ? t.hiddenPrice : null,
    },
    { label: t.rooms, value: offer.rooms },
    { label: t.floor, value: offer.floor },
    {
      label: t.standard,
      value: formatOfferCondition(offer.condition || offer.finishCondition, locale) || null,
    },
  ].filter((p) => p.value);

  const agentCommissionInfo = describeOfferAgentCommission(offer, offer.price);
  const agentCommissionLine = agentCommissionInfo
    ? agentCommissionInfo.isZero
      ? t.agentCommissionZero
      : formatBuyerAgentCommissionLine(agentCommissionInfo, locale)
    : null;

  const buildingParams = [
    { label: t.buildingType, value: formatOfferPropertyType(offer.propertyType, locale) },
    { label: t.buildYear, value: formatOfferBuildYear(offer) },
    { label: t.heating, value: offer.heating },
    {
      label: t.furnished,
      value: offer.isFurnished === true ? t.furnishedYes : offer.isFurnished === false ? t.furnishedNo : null,
    },
    { label: t.rentFee, value: offer.rent ? `${String(offer.rent).replace(/\D/g, "")} PLN` : null },
    {
      label: t.availability,
      value: offer.availabilityDate
        ? new Date(offer.availabilityDate).toLocaleDateString(locale === "pl" ? "pl-PL" : "en-GB")
        : null,
    },
  ].filter((p) => p.value);
  const commissionCompanyName =
    String(offer?.agencyName || "").trim() ||
    String(offer?.user?.companyName || "").trim() ||
    String(offer?.user?.agencyName || "").trim() ||
    sellerLabel ||
    t.privateOwner;

  const costsParams = agentCommissionInfo
    ? [
        {
          label: t.commissionPercent,
          value: agentCommissionInfo.percentLabel,
        },
        {
          label: t.commissionAmount,
          value: agentCommissionInfo.amountLabel,
        },
      ]
    : [];

  useEffect(() => {
    if (!offer?.lat || !offer?.lng) return;
    let cancelled = false;
    fetch(`/api/location/reverse?lat=${encodeURIComponent(String(offer.lat))}&lng=${encodeURIComponent(String(offer.lng))}`, {
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const countryName = String(data.country || "").trim();
        const countryCode = String(data.countryCode || "").trim().toUpperCase();
        if (countryName) {
          setResolvedCountry({
            name: countryName,
            code: countryCode || "PL",
          });
        }
      })
      .catch(() => {
        /* noop */
      });
    return () => {
      cancelled = true;
    };
  }, [offer?.lat, offer?.lng]);

  const countryFlag = resolvedCountry.code
    ? String.fromCodePoint(
        ...resolvedCountry.code
          .slice(0, 2)
          .split("")
          .map((char) => 127397 + char.toUpperCase().charCodeAt(0)),
      )
    : "🌍";

  return (
    <main className="theme-aware-dashboard min-h-screen bg-[var(--eos-bg)] pb-32 font-sans text-[var(--eos-text)] selection:bg-emerald-500/20">
      
      <div ref={ref} className="relative w-full min-h-[64vh] h-[72svh] sm:min-h-[100vh] sm:h-[100dvh] overflow-hidden bg-black">
        <motion.div style={{ y: bgY, backgroundImage: `url('${images[0]}')` }} className={`absolute inset-0 z-0 bg-cover bg-center opacity-60 ${isLocked ? 'blur-xl' : ''} ${isArchived ? 'grayscale' : ''}`} />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent z-10" />

        <div
          className="absolute inset-x-0 z-40 px-4 sm:px-6 pointer-events-none"
          style={{ top: HERO_BELOW_NAV }}
        >
          <div className="mx-auto flex max-w-5xl flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pointer-events-auto">
              <Link href="/odkryj-mape" className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl backdrop-blur-2xl transition-all hover:bg-white hover:text-black">
                {t.backToMap}
              </Link>
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

            <div
              className="pointer-events-auto w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex w-full flex-nowrap items-center justify-start gap-2 overflow-x-auto rounded-3xl border border-white/10 bg-zinc-950/80 px-3 py-2 shadow-2xl backdrop-blur-3xl sm:justify-center sm:gap-4 sm:px-5 sm:py-2.5 sm:rounded-full hover:border-white/20 transition-all duration-300">
                <button 
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPublicProfileId(String(offer?.user?.id || offer?.userId)); }} 
                  className="flex items-center gap-3 shrink-0 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-full px-4 py-2 transition-all duration-300 group cursor-pointer shadow-inner"
                >
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-white/10 to-transparent border border-white/10 group-hover:border-white/30 transition-colors ${themeColors.textActive}`}>
                     {sellerAvatar ? (
                       <img src={sellerAvatar} alt="" className="w-full h-full object-cover" />
                     ) : sellerIsAgency ? (
                       <Briefcase size={14} />
                     ) : (
                       <span className="text-[14px] group-hover:scale-110 transition-transform">👤</span>
                     )}
                  </div>
                  
                  <div className="flex flex-col items-start leading-tight">
                      <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black tracking-widest text-white/90 uppercase group-hover:text-white transition-colors max-w-[12rem] sm:max-w-[16rem] truncate">
                            {sellerLabel}
                          </span>
                          <span className={`w-1.5 h-1.5 rounded-full animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.5)] ${themeColors.primaryBg}`}></span>
                      </div>
                      {sellerPersonLine ? (
                        <span className="text-[8px] font-bold text-white/50 uppercase tracking-widest truncate max-w-[14rem]">
                          {sellerPersonLine}
                        </span>
                      ) : null}
                      {(() => {
                        const total = Number(offer?.user?.reviewsData?.totalReviews ?? 0);
                        const avg = total > 0 ? Number(offer?.user?.reviewsData?.averageRating ?? 0) : 0;
                        if (total === 0) return null;
                        return (
                      <div className="flex items-center gap-1 mt-0.5">
                          {[1,2,3,4,5].map(i => <Star key={i} size={10} className={i <= Math.round(avg) ? "text-yellow-500 fill-yellow-500" : "text-white/20"} />)}
                          <span className="text-[9px] font-bold text-yellow-500/80 tracking-widest ml-1">{avg.toFixed(1)}</span>
                      </div>
                        );
                      })()}
                  </div>
                </button>

                <span className="w-px h-6 bg-white/10 shrink-0 hidden sm:block"></span>
                
                <div className="flex items-center justify-center gap-2 sm:gap-3 shrink-0 min-w-0 px-1">
                  <div className="flex flex-col items-center justify-center shrink-0">
                      <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5">{t.views}</span>
                      <div className="flex items-center gap-1.5">
                          <Eye size={12} className="text-zinc-400" />
                          <span className="text-[11px] font-black text-white tracking-widest">{offer?.views || 0}</span>
                      </div>
                  </div>

                  {isLegalKwVerified ? (
                    <LegalVerifiedShieldBadge label={t.legalVerifiedKw} compact />
                  ) : null}

                  {isNewListing ? (
                    <motion.span
                      className="rounded-full border border-blue-500/45 bg-blue-500/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-blue-300"
                      animate={{ opacity: [1, 0.45, 1] }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                    >
                      {t.newOfferBadge}
                    </motion.span>
                  ) : null}
                </div>

                <span className="w-px h-6 bg-white/10 shrink-0 hidden sm:block"></span>

                <div className="flex items-center gap-2 sm:gap-4 shrink-0 px-1">
                  <div className="flex flex-col items-center justify-center">
                      <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5">{t.offerId}</span>
                      <span className={`text-[11px] font-black tracking-[0.2em] px-2 py-0.5 rounded-md border ${themeColors.textActive} ${themeColors.bgActiveSoft} ${themeColors.borderActive}`}>{offer?.id || offer?._id}</span>
                  </div>

                  <span className="w-px h-6 bg-white/10 hidden sm:block"></span>

                  <div className="flex flex-col items-center justify-center hidden sm:flex">
                      <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5">{t.listedSince}</span>
                      <span className="text-[11px] font-black text-white/70 tracking-widest">{offer?.createdAt ? new Date(offer.createdAt).toLocaleDateString(locale === "pl" ? "pl-PL" : "en-GB") : t.noData}</span>
                  </div>

                  {!isLegalKwVerified ? (
                    <div className={`shrink-0 rounded-full border px-3 py-2 ${verificationUi.cls}`}>
                      <div className="flex items-center gap-1.5">
                        <Shield size={12} />
                        <span className="text-[9px] font-black uppercase tracking-[0.14em]">{verificationUi.label}</span>
                      </div>
                    </div>
                  ) : null}
                </div>

              </div>
            </div>
          </div>
        </div>

        <div
          onClick={() => !isLocked && openGallery(0)}
          className="absolute inset-x-0 bottom-0 z-20 hidden cursor-pointer flex-col items-center justify-end px-4 pb-16 pt-32 hover:bg-black/10 sm:flex sm:pb-24"
        >
          <h1 className="max-w-7xl text-center text-4xl font-light leading-tight tracking-tighter drop-shadow-2xl [text-wrap:balance] sm:text-6xl md:text-[6vw] px-4 sm:px-8 pointer-events-none">
            {isLocked ? t.beforeLaunchTitle : offer.title}
          </h1>
        </div>
        {isArchived && (
          <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none px-4">
             <div className="bg-zinc-950/90 backdrop-blur-3xl border border-white/10 p-8 sm:p-12 rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.9)] text-center flex flex-col items-center">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10">
                   <ArchiveX size={32} className="text-zinc-500" />
                </div>
                <h2 className="text-3xl sm:text-5xl font-black text-white mb-2 uppercase tracking-tighter opacity-50">{t.archivedTitle}</h2>
                <p className="text-zinc-500 text-xs sm:text-sm font-bold uppercase tracking-widest">{t.archivedSubtitle}</p>
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
              
              <div className={`text-4xl sm:text-6xl font-mono font-black mb-10 tracking-widest relative z-10 flex items-center justify-center gap-4 ${themeColors.textActive} ${themeColors.glowActive}`}>
                <Timer size={36} className="opacity-50" />
                {timeString}
              </div>
              
              <Link href="/cennik" className={`block w-full py-5 sm:py-6 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest relative z-10 transition-colors ${themeColors.primaryBg} ${themeColors.primaryText} ${themeColors.primaryHover} ${themeColors.primaryShadow}`}>
                {t.unlockPro}
              </Link>
            </div>
          </div>
        )}

        {/* ORYGINALNA ZAWARTOŚĆ (ZAMAZANA JEŚLI ZABLOKOWANA) */}
        <div className={`max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 -mt-20 relative z-30 flex flex-col xl:flex-row gap-8 transition-all duration-1000 ${isLocked ? 'blur-2xl opacity-20 pointer-events-none select-none h-[850px] overflow-hidden' : ''}`}>
          
          <div className="xl:w-2/3 flex flex-col gap-10 sm:gap-16">
            {images.length > 1 && (
              <div className={`grid grid-cols-4 gap-2 sm:gap-3 md:gap-4 auto-rows-[80px] sm:auto-rows-[120px] md:auto-rows-[180px] rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden bg-black/20 p-2 sm:p-3 border border-white/5 backdrop-blur-3xl shadow-2xl ${isArchived ? 'grayscale opacity-50' : ''}`}>
                {images[1] && <div className="col-span-4 row-span-2 md:row-span-3 rounded-[1.2rem] sm:rounded-[1.8rem] overflow-hidden"><img onClick={() => openGallery(1)} src={images[1]} className="cursor-pointer w-full h-full object-cover hover:scale-105 transition-transform duration-500" /></div>}
                {images[2] && <div className="col-span-2 row-span-1 md:row-span-2 rounded-[1rem] sm:rounded-[1.5rem] overflow-hidden"><img onClick={() => openGallery(2)} src={images[2]} className="cursor-pointer w-full h-full object-cover hover:scale-105 transition-transform duration-500" /></div>}
                {images[3] && <div className="col-span-2 row-span-1 md:row-span-1 rounded-[1rem] sm:rounded-[1.5rem] overflow-hidden"><img onClick={() => openGallery(3)} src={images[3]} className="cursor-pointer w-full h-full object-cover hover:scale-105 transition-transform duration-500" /></div>}
                {images[4] && <div className="col-span-1 row-span-1 rounded-[1rem] sm:rounded-[1.5rem] overflow-hidden"><img onClick={() => openGallery(4)} src={images[4]} className="cursor-pointer w-full h-full object-cover hover:scale-105 transition-transform duration-500" /></div>}
                {images[5] && <div className="col-span-1 row-span-1 rounded-[1rem] sm:rounded-[1.5rem] overflow-hidden"><img onClick={() => openGallery(5)} src={images[5]} className="cursor-pointer w-full h-full object-cover hover:scale-105 transition-transform duration-500" /></div>}
                {images[6] && <div className="col-span-2 row-span-1 rounded-[1rem] sm:rounded-[1.5rem] overflow-hidden"><img onClick={() => openGallery(6)} src={images[6]} className="cursor-pointer w-full h-full object-cover hover:scale-105 transition-transform duration-500" /></div>}
              </div>
            )}

            <div>
                <h1 className="mb-7 text-4xl font-light leading-tight tracking-tighter text-[var(--eos-text)] [text-wrap:balance] sm:hidden">
                  {isLocked ? t.beforeLaunchTitle : offer.title}
                </h1>
                <h2 className="mb-2 text-4xl font-light tracking-tighter text-[var(--eos-text)] sm:text-6xl md:text-7xl">
                  {priceFormatted.primary}
                </h2>
                {!isLocked && priceFormatted.secondary ? (
                  <p className="eos-muted-copy mb-6 text-sm font-semibold">{priceFormatted.secondary}</p>
                ) : (
                  <div className="mb-6" />
                )}
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
                <div className="eos-offer-panel p-8 md:p-12">
                  <h3 className="eos-offer-metric-label mb-6">{t.aboutProperty}</h3>
                  <p className="text-base font-light leading-relaxed text-[var(--eos-muted)] whitespace-pre-line break-words sm:text-lg">{offer.description}</p>
                </div>

                {offer.amenities && offer.amenities.length > 0 && (
                <div className="eos-offer-panel mt-8 p-8 md:p-12">
                  <h3 className="eos-offer-metric-label mb-6">{t.amenities}</h3>
                  <div className="flex flex-wrap gap-3">
                    {offer.amenities.split(',').filter(Boolean).map((amenity: string, idx: number) => (
                      <div key={idx} className={`flex items-center gap-2 rounded-2xl border bg-[var(--eos-input)] px-4 py-2.5 ${themeColors.borderActive}`}>
                        <CheckCircle2 size={16} className={themeColors.textActive} />
                        <span className="text-sm font-semibold text-[var(--eos-text)]">{amenity.trim()}</span>
                      </div>
                    ))}
                  </div>
                </div>
                )}

                {offer.floorPlan && !isLocked && (
                <div className="bg-zinc-900/50 border border-white/10 rounded-[2.5rem] p-8 md:p-12 backdrop-blur-3xl mt-8 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-6 flex items-center gap-2">
                    <FileImage size={16} /> {t.floorPlan}
                  </h3>
                  <div 
                    onClick={() => setIsFloorplanModalOpen(true)}
                    className="relative w-full h-[400px] rounded-[2rem] overflow-hidden border border-white/10 cursor-pointer group bg-black"
                  >
                    <img src={offer.floorPlan} className="w-full h-full object-contain opacity-70 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700" alt={t.floorPlan} />
                    <div className="eos-on-media absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                       <span className="flex items-center gap-2 rounded-full border border-white/20 bg-black/60 px-6 py-3 text-[11px] font-bold uppercase tracking-[0.2em] text-white shadow-2xl backdrop-blur-xl">
                         <Maximize2 size={14} /> {t.enlarge}
                       </span>
                    </div>
                  </div>
                </div>
                )}

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
                </div>

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

                {(costsParams.length > 0 || agentCommissionLine) && (
                  <div className="eos-offer-panel p-6">
                    <h4 className={`eos-offer-metric-label mb-5 ml-2 ${themeColors.textActive}`}>{t.costsSection}</h4>
                    {costsParams.length > 0 ? (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          {costsParams.map((param, idx) => (
                            <div key={idx} className="flex min-h-[90px] flex-col justify-between rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] p-4 transition-colors hover:bg-[var(--eos-surface-strong)]">
                              <span className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--eos-muted)]">{param.label}</span>
                              <span className="text-base font-bold text-[var(--eos-text)]">{param.value}</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] p-4">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--eos-muted)]">{t.commissionCompany}</p>
                          <button
                            type="button"
                            onClick={() => setPublicProfileId(String(offer?.user?.id || offer?.userId))}
                            className="mt-2 inline-flex items-center gap-2 rounded-full border border-[var(--eos-border)] bg-[var(--eos-card)] px-3 py-1.5 text-sm font-bold text-[var(--eos-text)] transition-colors hover:text-emerald-400"
                          >
                            {commissionCompanyName}
                            <span className="text-[10px] uppercase tracking-wider text-[var(--eos-muted)]">{t.openCompanyProfile}</span>
                          </button>
                        </div>
                        {agentCommissionLine ? (
                          <p className="eos-subtle-copy mt-3 text-[11px]">{agentCommissionLine}</p>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-sm text-[var(--eos-text)]">{t.agentCommissionZero}</p>
                    )}
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
                <div className="flex flex-col gap-3 relative z-10">
                  {isArchived ? (
                  <div className="py-8 text-center flex flex-col items-center justify-center">
                     <ArchiveX size={24} className="text-zinc-600 mb-3" />
                     <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">{t.contactDisabled}</p>
                  </div>
                ) : (
                  <>
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

                  <OfferShareLink offerId={Number(offer.id ?? offer._id)} />

                  </>
                )}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
      
      <AppointmentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} offerId={offer.id || offer._id} sellerId={offer.userId || offer.user?.id || ""} />
      
      {isBiddingOpen && (
         <BiddingModal offerId={offer.id || offer._id} currentPrice={listingPrice.plnAmount} onClose={() => setIsBiddingOpen(false)} />
      )}

      <AnimatePresence>
        {isFloorplanModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999999] bg-black/95 backdrop-blur-xl flex items-start overflow-y-auto pt-10 pb-10 sm:pt-20 sm:pb-20 justify-center p-4 sm:p-8"
            onClick={() => setIsFloorplanModalOpen(false)}
          >
            <button onClick={() => setIsFloorplanModalOpen(false)} className="absolute top-6 right-6 p-4 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-50">
              <X size={24} />
            </button>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="relative w-full max-w-5xl max-h-screen flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
              <img src={offer.floorPlan} className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-white/10 bg-[#0a0a0a]" alt="Rzut Zoomony" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    
      {/* 🔥 GALERIA ZDJĘĆ LIGHTBOX 🔥 */}
      <AnimatePresence>
        {isGalleryOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[999999] bg-black/95 backdrop-blur-xl flex flex-col items-start overflow-y-auto pt-10 pb-10 sm:pt-20 sm:pb-20 justify-center"
            onClick={() => setIsGalleryOpen(false)}
          >
            <div className="eos-on-media absolute top-0 left-0 z-50 flex w-full items-center justify-between bg-gradient-to-b from-black/80 to-transparent p-6">
              <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/10 px-5 py-2.5 shadow-2xl backdrop-blur-md">
                <ImageIcon size={16} className={themeColors.textActive} />
                <span className="font-black text-[10px] uppercase tracking-widest text-white">{currentImageIndex + 1} / {images.length}</span>
              </div>
              <button onClick={() => setIsGalleryOpen(false)} className="group rounded-full bg-white/10 p-4 text-white shadow-2xl transition-all hover:bg-red-500">
                <X size={20} className="group-hover:rotate-90 transition-transform" />
              </button>
            </div>

            {images.length > 1 && (
              <>
                <button onClick={prevImage} className={`absolute left-4 sm:left-8 p-4 sm:p-5 bg-black/50 ${themeColors.primaryHover} border border-white/10 rounded-full text-white ${themeColors.primaryText} transition-all hover:scale-110 z-50 backdrop-blur-xl shadow-[0_0_30px_rgba(0,0,0,0.8)]`}>
                  <ChevronLeft size={24} strokeWidth={3} />
                </button>
                <button onClick={nextImage} className={`absolute right-4 sm:right-8 p-4 sm:p-5 bg-black/50 ${themeColors.primaryHover} border border-white/10 rounded-full text-white ${themeColors.primaryText} transition-all hover:scale-110 z-50 backdrop-blur-xl shadow-[0_0_30px_rgba(0,0,0,0.8)]`}>
                  <ChevronRight size={24} strokeWidth={3} />
                </button>
              </>
            )}

            <div className="w-full h-full flex items-center justify-center p-4 sm:p-20 pb-32 sm:pb-40" onClick={(e) => e.stopPropagation()}>
              <AnimatePresence mode="wait">
                <motion.img 
                  key={currentImageIndex}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  transition={{ duration: 0.2 }}
                  src={images[currentImageIndex]} 
                  className="max-w-full max-h-full object-contain drop-shadow-[0_0_50px_rgba(0,0,0,0.8)] rounded-2xl" 
                  alt="Galeria" 
                />
              </AnimatePresence>
            </div>

            {images.length > 1 && (
              <div className="absolute bottom-6 w-full flex justify-center px-4 z-50">
                <div className="flex gap-2 p-2 bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10 overflow-x-auto max-w-2xl w-full custom-scrollbar shadow-2xl" onClick={(e) => e.stopPropagation()}>
                  {images.map((img, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => setCurrentImageIndex(idx)} 
                      className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden cursor-pointer shrink-0 border-2 transition-all duration-300 ${currentImageIndex === idx ? `${themeColors.borderActive} scale-105 ${themeColors.glowActive} brightness-110` : 'border-transparent opacity-40 hover:opacity-100 hover:scale-95'}`}
                    >
                      <img src={img} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

    
      <PublicProfileModal 
        isOpen={!!publicProfileId} 
        userId={publicProfileId} 
        onClose={() => setPublicProfileId(null)} 
      />
    </main>
  );
}

export default function SingleOfferPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [offer, setOffer] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  useEffect(() => {
    const fetchUserAndOffer = async () => {
      // 1. Sprawdzamy, czy użytkownik jest PRO / Zalogowany
      try {
        const userRes = await fetch('/api/user/profile');
        if (userRes.ok) {
          const userData = await userRes.json();
          if (userData && userData.email) setCurrentUser(userData);
        }
      } catch (e) {}

      // 2. Pobieramy ofertę
      const id = resolvedParams.id;
      if (!id) return;
      try {
        fetch(`/api/offers/${id}/view`, {
          method: 'POST',
          headers: { 'x-client-source': 'web' }
        }).catch(() => console.log("View count error"));
        const res = await fetch(`/api/offers/${id}`);
        if(res.ok) {
           const data = await res.json();
           setOffer(data);
        }
      } catch (error) {
        console.error("Błąd ładowania oferty:", error);
      }
    };
    fetchUserAndOffer();
  }, [resolvedParams]);

  if (!offer) return <div className="min-h-screen bg-[var(--eos-bg)]" />;
  
  return <OfferDetails offer={offer} currentUser={currentUser} />;
}
